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
"""
import os
import sys
import glob

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
}


def parse_one(path, out_dir):
    name = os.path.splitext(os.path.basename(path))[0]
    print(f"== {name}")
    p = DemoParser(path)

    try:
        hdr = p.parse_header()
        map_name = hdr.get("map_name", "?")
    except Exception:
        map_name = "?"
    print(f"   карта: {map_name}")
    if "ancient" not in str(map_name).lower():
        print("   это не Ancient — пропускаю (переименуй проверку в скрипте, если нужно)")
        return

    # все тики, потом берём каждый SAMPLE_EVERY-й
    try:
        df = p.parse_ticks(TICK_PROPS_FULL)
    except Exception as e:
        print(f"   полный набор полей не поддержан ({e}); беру минимальный")
        df = p.parse_ticks(TICK_PROPS_MIN)
    df = df[df["tick"] % SAMPLE_EVERY == 0]
    if "is_warmup_period" in df.columns:
        df = df[df["is_warmup_period"] != True]
    for c in ("X", "Y", "Z", "yaw", "pitch"):
        if c in df.columns:
            df[c] = df[c].round(1)
    df.to_csv(os.path.join(out_dir, f"{name}_ticks.csv.gz"), index=False, compression="gzip")
    print(f"   позиции: {len(df)} строк")

    for ev, extra in EVENTS.items():
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
        if ev == "weapon_fire":
            # выстрелов очень много — оставляем только первый в каждой очереди (раз в 0.5с на игрока)
            if "user_steamid" in e.columns:
                e = e.sort_values("tick")
                e["_b"] = e["tick"] // 32
                e = e.drop_duplicates(["user_steamid", "_b"]).drop(columns="_b")
        e.to_csv(os.path.join(out_dir, f"{name}_{ev}.csv.gz"), index=False, compression="gzip")
        print(f"   {ev}: {len(e)}")


def main():
    folder = sys.argv[1] if len(sys.argv) > 1 else os.path.dirname(os.path.abspath(__file__))
    demos = sorted(glob.glob(os.path.join(folder, "*.dem")))
    if not demos:
        print(f"В папке {folder} нет .dem файлов")
        return
    out_dir = os.path.join(folder, "demo_export")
    os.makedirs(out_dir, exist_ok=True)
    for d in demos:
        try:
            parse_one(d, out_dir)
        except Exception as e:
            print(f"   ошибка: {e}")
    total = sum(os.path.getsize(os.path.join(out_dir, f)) for f in os.listdir(out_dir))
    print(f"\nГотово. Папка {out_dir}, всего {total/1e6:.1f} МБ — присылай её содержимое.")


if __name__ == "__main__":
    main()
