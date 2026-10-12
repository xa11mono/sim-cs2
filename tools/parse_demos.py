"""
Разбор демок CS2 для симулятора Ancient.

Что делает: берёт все .dem из папки, вытаскивает то, что нужно для сравнения
с ботами (позиции и взгляд игроков 4 раза в секунду, смерти, гранаты, плант,
начало/конец раундов) и сохраняет в маленькие сжатые файлы *.csv.gz.
Вместо ~300 МБ демки получается ~1–3 МБ — их и присылай.

Как запустить (Windows):
  1. Установи Python 3.10+ с python.org (галочка "Add Python to PATH").
  2. Открой cmd в папке с этим скриптом и выполни:
         pip install demoparser2 pandas
  3. Положи .dem файлы в ту же папку (или укажи путь к папке) и выполни:
         python parse_demos.py
     или
         python parse_demos.py "C:\\путь\\к\\папке\\с\\демками"
  4. Появится папка demo_export с файлами. Присылай всё из неё
     (можно заархивировать в zip).

Готовые демки пропускаются при повторном запуске (видит файлы в demo_export) —
можно докидывать новые .dem в ту же папку и перезапускать, старые не трогаются.
Пересобрать всё заново: python parse_demos.py --force
Что получилось и что не получилось — demo_export/_log.txt.
"""
import os
import sys
import glob
import time

try:
    import pandas as pd
    from demoparser2 import DemoParser
except ImportError:
    print("Нужно установить библиотеки: pip install demoparser2 pandas")
    sys.exit(1)

SAMPLE_EVERY = 16  # тиков: 64 тика в секунду -> 4 снимка в секунду

TICK_PROPS_FULL = ["X", "Y", "Z", "yaw", "pitch", "health", "team_num", "is_alive",
                   "active_weapon_name", "total_rounds_played", "is_warmup_period"]
TICK_PROPS_MIN = ["X", "Y", "Z", "yaw", "health", "team_num", "is_alive"]

EVENTS = {
    "round_start": {},
    "round_freeze_end": {},
    "round_end": {},
    "player_death": {"player": ["X", "Y", "team_num"]},
    "bomb_planted": {"player": ["X", "Y"]},
    "bomb_defused": {"player": ["X", "Y"]},
    "bomb_exploded": {},
    "smokegrenade_detonate": {},
    "inferno_startburn": {},
    "flashbang_detonate": {},
    "hegrenade_detonate": {},
    "weapon_fire": {"player": ["X", "Y", "yaw", "team_num"]},
    # (этап 3 аудита, P0-1/P2-2) урон и ослепления — для сверки попаданий ботов и флешек; раньше брали урон по health
    "player_hurt": {"player": ["X", "Y", "team_num"]},
    "player_blind": {"player": ["X", "Y", "team_num"]},
}


def already_done(name, out_dir):
    """хотя бы файл тиков этой демки уже есть — считаем демку разобранной"""
    return os.path.exists(os.path.join(out_dir, f"{name}_ticks.csv.gz"))


def parse_sampled_ticks(p, max_tick):
    """быстрый путь: просим у demoparser2 сразу только каждый SAMPLE_EVERY-й тик
    (на больших демках в разы быстрее полного разбора). Не все версии
    demoparser2 поддерживают список тиков — если упадёт, вызывающий код сам
    откатится на parse_ticks(TICK_PROPS_FULL) без ticks="""
    wanted = list(range(0, max_tick + 1, SAMPLE_EVERY))
    return p.parse_ticks(TICK_PROPS_FULL, ticks=wanted)


def parse_one(path, out_dir, log):
    name = os.path.splitext(os.path.basename(path))[0]
    print(f"== {name}")
    t_start = time.time()
    p = DemoParser(path)

    try:
        hdr = p.parse_header()
        map_name = hdr.get("map_name", "?")
    except Exception:
        hdr = {}
        map_name = "?"
    print(f"   карта: {map_name}")
    if "ancient" not in str(map_name).lower():
        print("   это не Ancient — пропускаю (переименуй проверку в скрипте, если нужно)")
        log.append(f"{name}: пропущена (карта {map_name}, не Ancient)")
        return

    # быстрый путь — сразу только нужные тики; если demoparser2 не умеет
    # (старая версия без параметра ticks=, или другая ошибка) — старый путь:
    # парсим всё, урезаем после
    df = None
    try:
        max_tick = int(hdr.get("playback_ticks") or 0)
        if max_tick > 0:
            df = parse_sampled_ticks(p, max_tick)
    except Exception as e:
        print(f"   выборочный разбор тиков не сработал ({e}); беру полный путь")
        df = None
    if df is None or len(df) == 0:
        try:
            df = p.parse_ticks(TICK_PROPS_FULL)
        except Exception as e:
            print(f"   полный набор полей не поддержан ({e}); беру минимальный")
            df = p.parse_ticks(TICK_PROPS_MIN)
        df = df[df["tick"] % SAMPLE_EVERY == 0]

    # варминг — по факту, не по полю: граница = последний тик с is_warmup_period
    warmup_end = 0
    if "is_warmup_period" in df.columns:
        w = df[df["is_warmup_period"] == True]  # noqa: E712
        if len(w):
            warmup_end = int(w["tick"].max())
        df = df[df["tick"] > warmup_end]
    for c in ("X", "Y", "Z", "yaw", "pitch"):
        if c in df.columns:
            df[c] = df[c].round(1)
    df.to_csv(os.path.join(out_dir, f"{name}_ticks.csv.gz"), index=False, compression="gzip")
    print(f"   позиции: {len(df)} строк")

    parse_events(p, name, out_dir, warmup_end)

    dt = time.time() - t_start
    print(f"   готово за {dt:.0f} с")
    log.append(f"{name}: готово, {len(df)} тиков, {dt:.0f} с")


def parse_events(p, name, out_dir, warmup_end, only_missing=False):
    for ev, extra in EVENTS.items():
        if only_missing and os.path.exists(os.path.join(out_dir, f"{name}_{ev}.csv.gz")):
            continue
        try:
            e = p.parse_event(ev, player=extra.get("player", []), other=["total_rounds_played"])
        except Exception:
            try:
                e = p.parse_event(ev)
            except Exception as ex:
                print(f"   {ev}: нет ({ex})")
                continue
        if e is None or len(e) == 0:
            continue
        if "tick" in e.columns and warmup_end:
            e = e[e["tick"] > warmup_end]   # варминг-раунды не попадают в события
        if ev == "weapon_fire":
            # выстрелов очень много — оставляем только первый в каждой очереди (раз в 0.5с на игрока)
            if "user_steamid" in e.columns:
                e = e.sort_values("tick")
                e["_b"] = e["tick"] // 32
                e = e.drop_duplicates(["user_steamid", "_b"]).drop(columns="_b")
        e.to_csv(os.path.join(out_dir, f"{name}_{ev}.csv.gz"), index=False, compression="gzip")
        print(f"   {ev}: {len(e)}")


def events_only(dem, out_dir):
    """--events: у уже разобранных демок дописать только недостающие события (player_hurt, player_blind), без тиков"""
    import pandas as pd
    from demoparser2 import DemoParser
    name = os.path.splitext(os.path.basename(dem))[0]
    t = pd.read_csv(os.path.join(out_dir, f"{name}_ticks.csv.gz"), usecols=["tick"])
    print(f"== {name}: события")
    parse_events(DemoParser(dem), name, out_dir, int(t.tick.min()) - 1, only_missing=True)


def main():
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    force = "--force" in sys.argv
    folder = args[0] if args else os.path.dirname(os.path.abspath(__file__))
    demos = sorted(glob.glob(os.path.join(folder, "*.dem")))
    if not demos:
        print(f"В папке {folder} нет .dem файлов")
        return
    out_dir = os.path.join(folder, "demo_export")
    os.makedirs(out_dir, exist_ok=True)
    log = []
    skipped = 0
    for d in demos:
        name = os.path.splitext(os.path.basename(d))[0]
        if "--events" in sys.argv and already_done(name, out_dir):
            events_only(d, out_dir)
            continue
        if not force and already_done(name, out_dir):
            print(f"== {name}: уже разобрана, пропускаю (--force — переразобрать всё)")
            skipped += 1
            continue
        try:
            parse_one(d, out_dir, log)
        except Exception as e:
            print(f"   ошибка: {e}")
            log.append(f"{name}: ОШИБКА — {e}")
    with open(os.path.join(out_dir, "_log.txt"), "a", encoding="utf-8") as f:
        f.write(f"\n--- запуск {time.strftime('%Y-%m-%d %H:%M')} ---\n")
        f.write("\n".join(log) + "\n")
    total = sum(os.path.getsize(os.path.join(out_dir, f)) for f in os.listdir(out_dir))
    print(f"\nГотово. Папка {out_dir}, всего {total/1e6:.1f} МБ"
          f"{f' (пропущено уже готовых: {skipped})' if skipped else ''} — присылай её содержимое.")
    print(f"Подробности по каждой демке — {out_dir}/_log.txt")


if __name__ == "__main__":
    main()
