"""Шрифты страницы — внутри HTML (v430). Без Google Fonts: страница выглядит одинаково и в артефакте, и открытая
файлом с диска, и без интернета (раньше шрифты грузились с fonts.googleapis.com — без сети или при блокировке
подставлялся системный шрифт, и надписи «съезжали»).

Исходники — src/fonts/*.woff (подмножество: латиница, кириллица, знаки HUD; лицензия OFL — рядом).
Как их получили: google/fonts (ofl/golostext, robotocondensed, ibmplexmono, ibmplexsans) →
fontTools.varLib.instancer (оси wght 400–700, wdth 100) → pyftsubset --flavor=woff (набор знаков — UNICODES ниже).

  python3 tools/embed_fonts.py   → src/game/001_fonts.html
"""
import base64, os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FONTS = os.path.join(ROOT, 'src', 'fonts')
OUT = os.path.join(ROOT, 'src', 'game', '001_fonts.html')
UNICODES = ('U+0020-007E,U+00A0-00FF,U+0400-045F,U+0490-0491,U+2010-2027,U+2030-203A,U+2116,U+2190-2199,'
            'U+2212,U+2022,U+25A0-25FF,U+2713-2716,U+2726,U+2605,U+2668,U+20BD,U+00D7')

# (семейство, файл, вес) — имена семейств те же, что в стилях и на холсте
FACES = [
    ('Golos Text', 'GolosText-var.woff', '400 700'),
    ('Roboto Condensed', 'RobotoCondensed-var.woff', '400 700'),
    ('IBM Plex Sans', 'IBMPlexSans-var.woff', '400 700'),
    ('IBM Plex Mono', 'IBMPlexMono-Regular.woff', '400'),
    ('IBM Plex Mono', 'IBMPlexMono-Medium.woff', '500'),
    ('IBM Plex Mono', 'IBMPlexMono-SemiBold.woff', '600'),
    ('IBM Plex Mono', 'IBMPlexMono-Bold.woff', '700'),
]
# холст сам шрифт не запрашивает — грузим заранее те, что рисует радар
PRELOAD = ['400 12px "IBM Plex Mono"', '600 12px "IBM Plex Mono"', '700 12px "IBM Plex Mono"',
           '600 12px "IBM Plex Sans"', '700 12px "IBM Plex Sans"', '400 12px "Golos Text"', '500 12px "Roboto Condensed"']


def main():
    css = []
    for fam, fn, w in FACES:
        b64 = base64.b64encode(open(os.path.join(FONTS, fn), 'rb').read()).decode('ascii')
        css.append("@font-face{font-family:'%s';font-style:normal;font-weight:%s;font-display:block;"
                   "src:url(data:font/woff;base64,%s) format('woff');unicode-range:%s;}" % (fam, w, b64, UNICODES))
    js = 'try{if(document.fonts)[%s].forEach(function(f){document.fonts.load(f);});}catch(e){}' % ','.join("'%s'" % p for p in PRELOAD)
    html = ('<!-- (v430) шрифты внутри страницы — собирает tools/embed_fonts.py из src/fonts, руками не править -->\n'
            '<style>' + '\n'.join(css) + '</style>\n<script>' + js + '</script>\n')
    open(OUT, 'w', encoding='utf-8', newline='\n').write(html)
    print('ok', OUT, round(len(html) / 1024), 'КБ')


if __name__ == '__main__':
    main()
