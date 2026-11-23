#!/usr/bin/env python3
"""Достать отметки владельца из localStorage страницы (ключ `sim_marks`) в tools/marks/inbox/.

Отметки живут в браузере владельца: `src/marks.js` пишет их в localStorage страницы, снимки —
внутри записи (`snap` — момент, `pre` — за 15 с до), сжатые gzip+base64. Сервера и скачиваний нет:
этот скрипт открывает ту же страницу в браузере владельца и читает localStorage.

Запуск (браузер владельца должен быть закрыт — профиль блокируется, пока он открыт):

    python tools/marks/mark_pull.py --profile "C:/Users/<user>/AppData/Local/Microsoft/Edge/User Data"

Уже запущенный браузер с отладочным портом (закрывать не нужно):

    python tools/marks/mark_pull.py --cdp http://127.0.0.1:9222

Адрес страницы по умолчанию — file://<repo>/sim.html; другой — через --url.
Результат: <out>/marks.json и <out>/<id>/{record.json,snap.json,pre.json} (снимки — распакованные).
"""
import argparse
import base64
import gzip
import json
import os
import sys
from pathlib import Path

from playwright.sync_api import sync_playwright

try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")
except Exception:
    pass


def decode_snapshot(stored: str) -> str:
    """В localStorage снимок лежит сжатым: "gz:" + base64(gzip). Без префикса — как есть."""
    if stored and stored.startswith("gz:"):
        return gzip.decompress(base64.b64decode(stored[3:])).decode("utf-8")
    return stored


def default_profile():
    local = os.environ.get("LOCALAPPDATA", "")
    for rel in ("Microsoft/Edge/User Data", "Google/Chrome/User Data", "Chromium/User Data"):
        p = Path(local) / rel
        if p.is_dir():
            return str(p)
    return None


def write_marks(raw, out_dir: Path):
    marks = json.loads(raw or "[]")
    if not isinstance(marks, list):
        raise SystemExit("sim_marks: ожидался массив, пришло " + type(marks).__name__)
    out_dir.mkdir(parents=True, exist_ok=True)
    (out_dir / "marks.json").write_text(json.dumps(marks, ensure_ascii=False, indent=1), encoding="utf-8")
    for m in marks:
        mid = str(m.get("id") or ("m" + str(m.get("created", ""))))
        d = out_dir / mid
        d.mkdir(exist_ok=True)
        rec = {k: v for k, v in m.items() if k not in ("snap", "pre")}
        (d / "record.json").write_text(json.dumps(rec, ensure_ascii=False, indent=1), encoding="utf-8")
        if m.get("snap"):
            (d / "snap.json").write_text(decode_snapshot(m["snap"]), encoding="utf-8")
        if m.get("pre"):
            (d / "pre.json").write_text(decode_snapshot(m["pre"]), encoding="utf-8")
    return marks


def main():
    ap = argparse.ArgumentParser(description="Забрать отметки из localStorage страницы")
    ap.add_argument("--profile", help="каталог профиля браузера (User Data); нужен закрытый браузер")
    ap.add_argument("--cdp", help="подключиться к запущенному браузеру, например http://127.0.0.1:9222")
    ap.add_argument("--url", help="адрес страницы (по умолчанию file://<repo>/sim.html)")
    ap.add_argument("--out", default="tools/marks/inbox", help="куда сложить (по умолчанию tools/marks/inbox)")
    ap.add_argument("--headed", action="store_true", help="открыть окно браузера (видно, что происходит)")
    ap.add_argument("--timeout", type=float, default=30.0, help="ожидание загрузки страницы, секунды")
    ap.add_argument("--clear", action="store_true",
                    help="после выгрузки убрать забранные отметки из localStorage (место в браузере не копится)")
    a = ap.parse_args()

    repo = Path(__file__).resolve().parents[2]
    url = a.url or (Path(repo) / "sim.html").as_uri()
    out = Path(a.out)
    if not out.is_absolute():
        out = Path(repo) / out

    with sync_playwright() as p:
        browser = None
        if a.cdp:
            browser = p.chromium.connect_over_cdp(a.cdp)
            ctx = browser.contexts[0] if browser.contexts else browser.new_context()
            page = None
            for pg in ctx.pages:
                if pg.url.split("#")[0] == url.split("#")[0]:
                    page = pg
                    break
            if page is None:
                page = ctx.new_page()
        else:
            prof = a.profile or default_profile()
            if not prof:
                raise SystemExit("не нашёл профиль браузера — укажите --profile или запустите браузер с --cdp")
            try:
                ctx = p.chromium.launch_persistent_context(prof, headless=not a.headed,
                                                           args=["--allow-file-access-from-files"])
            except Exception as e:
                raise SystemExit("не открылся профиль %s: %s\nСкорее всего браузер запущен — закройте его "
                                 "или используйте --cdp." % (prof, e))
            page = ctx.pages[0] if ctx.pages else ctx.new_page()

        page.goto(url, wait_until="domcontentloaded")
        try:
            page.wait_for_function("typeof __ev === 'function'", timeout=a.timeout * 1000)
        except Exception:
            print("внимание: страница не поднялась за отведённое время — читаю localStorage как есть")
        raw = page.evaluate("localStorage.getItem('sim_marks')")
        marks = write_marks(raw, out)
        print("страница: %s" % url)
        print("записей: %d -> %s" % (len(marks), out))
        for m in marks:
            text = (m.get("text") or "").replace("\n", " ")
            has = ("snap" if m.get("snap") else "-") + ("/pre" if m.get("pre") else "")
            print("  %-16s m%s r%s tick %s | %s | %s | %s" % (
                m.get("id", "?"), m.get("match", "?"), m.get("round", "?"), m.get("tick", "?"),
                m.get("category", "?"), has, text[:70]))
        if not marks:
            print("отметок нет: владелец ещё не ставил их на этой странице в этом браузере "
                  "(отметки привязаны к адресу страницы)")
        if a.clear and marks:
            page.evaluate("localStorage.setItem('sim_marks','[]')")
            print("localStorage очищен от забранных отметок (файлы в %s остались)" % out)
        if not a.cdp:
            ctx.close()
        elif browser is not None:
            browser.close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
