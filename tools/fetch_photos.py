#!/usr/bin/env python3
"""Фото игроков с Liquipedia (запускать у себя на компьютере: из облачной среды Claude сайт недоступен).

python fetch_photos.py            → папка photos/ рядом со скриптом, с файлами <ник>.png (квадрат 256×256, голова и плечи)

Как работает: MediaWiki API Liquipedia (action=query, prop=pageimages, piprop=original) отдаёт главную картинку
страницы игрока — это и есть портрет в джерси на прозрачном/студийном фоне. Правила Liquipedia API: свой
User-Agent с контактом, не чаще 1 запроса в 2 с (https://liquipedia.net/api-terms-of-use). Права на фото — у
авторов, указанных на Liquipedia; страница с ними должна оставаться приватной.
Нужно: pip install requests pillow
"""
import io, os, re, sys, time
import requests
from PIL import Image

# ник в игре → название страницы на Liquipedia
PLAYERS = {"donk": "Donk", "sh1ro": "Sh1ro", "TN1R": "TN1R", "magixx": "Magixx", "zont1x": "Zont1x",
           "kyousuke": "Kyousuke", "m0NESY": "M0NESY", "TeSeS": "TeSeS", "karrigan": "Karrigan", "NiKo": "NiKo"}
API = "https://liquipedia.net/counterstrike/api.php"
UA = {"User-Agent": "sim-cs2-photos/1.0 (personal project; contact: your_email@example.com)", "Accept-Encoding": "gzip"}   # только латиница
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "photos")   # рядом со скриптом


def image_url(page, nick):
    """фото игрока на Liquipedia называется по нику: «Donk at IEM Cologne 2024.jpg» и т. п. Главная картинка страницы
    (pageimages) часто оказывается логотипом команды или флагом — поэтому берём из картинок страницы ту, в имени которой
    есть ник (не логотип и не флаг), самую свежую по году в названии"""
    r = requests.get(API, params={"action": "query", "titles": page, "prop": "images", "imlimit": 500,
                                  "format": "json", "redirects": 1}, headers=UA, timeout=20)
    r.raise_for_status()
    key = re.sub(r"[^a-z0-9]", "", nick.lower()); best = None
    for p in r.json().get("query", {}).get("pages", {}).values():
        for im in p.get("images", []):
            t = im.get("title", ""); tl = t.lower(); flat = re.sub(r"[^a-z0-9]", "", tl)
            if not tl.endswith((".png", ".jpg", ".jpeg", ".webp")): continue
            if any(w in tl for w in ("flag", "logo", "icon", "lightmode", "darkmode", "allmode", "trophy", "medal")): continue
            if key not in flat: continue
            years = [int(y) for y in re.findall(r"(20\d\d)", t)]; yr = max(years) if years else 0
            if not best or yr > best[0]: best = (yr, t)
    if not best: return None
    time.sleep(2)
    r = requests.get(API, params={"action": "query", "titles": best[1], "prop": "imageinfo", "iiprop": "url", "format": "json"},
                     headers=UA, timeout=20)
    for p in r.json().get("query", {}).get("pages", {}).values():
        ii = p.get("imageinfo") or []
        if ii: return ii[0]["url"]
    return None


def square_portrait(raw):
    """квадрат сверху по центру: голова и плечи, как на карточках HLTV/Liquipedia"""
    im = Image.open(io.BytesIO(raw)).convert("RGBA")
    bb = im.getbbox() or (0, 0, im.width, im.height)          # прозрачные поля — прочь
    im = im.crop(bb); w, h = im.size; s = min(w, h)
    im = im.crop(((w - s) // 2, 0, (w - s) // 2 + s, s))       # верх картинки — голова
    return im.resize((256, 256), Image.LANCZOS)


def main():
    os.makedirs(OUT, exist_ok=True)
    for nick, page in PLAYERS.items():
        try:
            url = image_url(page, nick); time.sleep(2)
            if not url: print(f"{nick}: на странице «{page}» нет фото с ником в названии"); continue
            raw = requests.get(url, headers=UA, timeout=30).content; time.sleep(2)
            square_portrait(raw).save(os.path.join(OUT, nick + ".png"), optimize=True)
            print(f"{nick}: ok ({url})")
        except Exception as e:
            print(f"{nick}: ошибка — {e}", file=sys.stderr)
    print("готово:", OUT)


if __name__ == "__main__":
    main()
