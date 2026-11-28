"""(28.11, вопрос 17 — два отката Р3.6) Сводка записей ПК по вариантам отката: эпизоды стояния (walk_watch: один эпизод = бот + пост),
разделённые на «не может идти» (want ≥ 0,5 и пост старше 320 тиков — на этой задаче хотел и пытался) и «стоит по задаче» (want < 0,5) /
«хвост прошлой задачи» (пост моложе 320 тиков); причина у «не может идти»; старый счётчик watch.n.stall и его сохранённые строки
«залип: «держит» … не пускает «хочет»» (какая задача кого не пускает); nav (снапы / стены) по местам (сетка 80 px); всё — на 100 раундов,
и отдельно в раундах, где у T эко / пистолетка (там был прежний рост эко-плана). Игру не меняет; читает rec_<m>.json(.gz).
Запуск: python3 tools/measure/audit/q17_review.py <папка с метками> <метка> [<метка> …]  → Markdown"""
import collections, gzip, json, os, re, sys

def load(p):
    return json.load(gzip.open(p, 'rt', encoding='utf-8') if p.endswith('.gz') else open(p, encoding='utf-8'))

ECO = {'eco', 'pistol'}

def summarize(folder):
    S = collections.Counter(); causes = collections.Counter(); holds = collections.Counter(); places = collections.Counter(); navk = collections.Counter()
    for f in sorted(os.listdir(folder)):
        if not re.match(r'rec_\d+\.json(\.gz)?$', f): continue
        d = load(os.path.join(folder, f)); R = d.get('rounds') or []
        S['matches'] += 1; S['rounds'] += len(R); S['eco_rounds'] += sum(1 for r in R if r.get('tType') in ECO)
        def rnd(t):
            for r in R:
                if r.get('t0', 0) <= t <= (r.get('t1') or 1 << 30): return r
            return None
        w = d.get('walk') or {}
        for e in w.get('stall') or []:
            t, want, since, why = e[0], e[9], e[17] if len(e) > 17 else -1, e[10]
            r = rnd(t); eco = bool(r and r.get('tType') in ECO)
            kind = 'tail' if 0 <= since < 320 else ('stuck' if want >= 0.5 else 'task')
            S['ep_' + kind] += 1; S['ep_all'] += 1
            if eco: S['eco_ep_' + kind] += 1
            if kind == 'stuck': causes[why or '?'] += 1
        for e in w.get('nav') or []:
            S['nav'] += 1; navk[e[1]] += 1; places[(e[4] // 80 * 80, e[5] // 80 * 80)] += 1
            r = rnd(e[0]);
            if r and r.get('tType') in ECO: S['eco_nav'] += 1
        W = d.get('watch') or {}
        S['old_stall'] += (W.get('n') or {}).get('stall', 0)
        for e in (W.get('ev') or {}).get('stall') or []:
            S['old_rows'] += 1; txt = e[2] if len(e) > 2 else ''
            m = re.search(r'«([^»]+)».*?не пускает «([^»]+)»', txt)
            k = ('залип', m.group(1).split(':')[0], m.group(2).split(':')[0]) if m else (txt.split(':')[0][:20],)
            holds[k] += 1
            r = rnd(e[0])
            if r and r.get('tType') in ECO: S['eco_old_rows'] += 1
    return S, causes, holds, places, navk

def main():
    folder, labels = sys.argv[1], sys.argv[2:]
    res = {l: summarize(os.path.join(folder, l)) for l in labels}
    per = lambda S, k: round(100.0 * S[k] / max(1, S['rounds']), 1)
    peco = lambda S, k: round(100.0 * S[k] / max(1, S['eco_rounds']), 1)
    print('| метка | матчей · раундов (эко/пист. T) | эпизоды: все · **не может идти** · стоит по задаче · хвост (на 100 р.) | старый stall (на 100 р.) | nav (на 100 р.) | в эко-раундах T: не может идти · строки старого stall · nav (на 100 эко-р.) |')
    print('|---|---|---|---|---|---|')
    for l in labels:
        S = res[l][0]
        print('| %s | %d · %d (%d) | %s · **%s** · %s · %s | %s | %s | %s · %s · %s |' % (l, S['matches'], S['rounds'], S['eco_rounds'], per(S, 'ep_all'), per(S, 'ep_stuck'), per(S, 'ep_task'), per(S, 'ep_tail'),
              per(S, 'old_stall'), per(S, 'nav'), peco(S, 'eco_ep_stuck'), peco(S, 'eco_old_rows'), peco(S, 'eco_nav')))
    for l in labels:
        S, causes, holds, places, navk = res[l]
        print('\n**%s** — «не может идти» по причинам: %s; старый «залип» (держит → не пускает, сохранено строк %d): %s; nav: %s; места nav: %s' % (
            l, ', '.join('%s %d' % kv for kv in causes.most_common(5)), S['old_rows'],
            ', '.join('%s %d' % ('→'.join(k[1:]) if k[0] == 'залип' else k[0], v) for k, v in holds.most_common(6)),
            ', '.join('%s %d' % kv for kv in navk.most_common()), ', '.join('(%d, %d) %d' % (k[0], k[1], v) for k, v in places.most_common(5))))

if __name__ == '__main__':
    main()
