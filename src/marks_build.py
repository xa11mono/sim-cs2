"""«Отметить момент» (v255, перенос из ветки rebuild-v238): сборка вставляет в игру на место метки @@BUILD@@
  - __SNAP — список переменных симулятора для снимка/перемотки (все `var` верхнего уровня, кроме статичных данных,
    настроек и интерфейса) — новые переменные игры попадают в снимок сами;
  - сам модуль src/marks.js.
Вызывают src/build.py (sim.html) и src/mkpub.py (публикуемая страница) — обе страницы одинаковые."""
import os, re
HERE = os.path.dirname(os.path.abspath(__file__))
MARK = "/*@@BUILD: здесь build.py вставляет __SNAP и marks.js@@*/\n"


# ---------- перечень переменных симулятора для снимков ----------
def top_vars(src):
    names = []
    for mm in re.finditer(r'(?m)^var ', src):
        i = mm.end(); depth = 0; q = None; n = len(src); start = True
        while i < n:
            c = src[i]
            if start:
                mi = re.match(r'\s*([A-Za-z_$][\w$]*)', src[i:i+80])
                if mi: names.append(mi.group(1))
                start = False
            if q:
                if c == '\\': i += 2; continue
                if c == q or (q != '`' and c == '\n'): q = None
            elif c in '"\'`': q = c
            elif c in '([{': depth += 1
            elif c in ')]}': depth -= 1
            elif depth == 0 and c == ';':
                # (v343) вторая `var` в той же строке (`var events = []; var killfeed = [];`) — раньше не попадала в снимок, и при
                # перемотке киллфид оставался «из будущего»: убийства повторялись
                mv = re.match(r'[ \t]*var[ \t]+', src[i+1:i+40])
                if mv: i += 1 + mv.end(); start = True; continue
                break
            elif depth == 0 and c == '\n' and re.match(r'[A-Za-z_$/(]', src[i+1:i+2] or ' '): break
            elif depth == 0 and c == ',': start = True
            i += 1
    out = []
    for x in names:
        if x not in out: out.append(x)
    return out

# не в снимок: неизменные данные карты/про (большие), настройки владельца, интерфейс
STATIC = set("""MAP NADE_LANE_IDX ZONEMAP ZONEMAP_RAW NAVAREAS NAVAREAS_RAW NAV_BOUNDARY_SEGS_RAW NAV_BOUNDARY_VERTS_RAW zonesById zoneGraph ZONE_SAMPLES
ZONE_DANGER_LINE PRO_LINEUPS_RAW BOT_INIT WALL_POLYS_CODE WALL_SOLID_POLYS WALLS_SIG NAV_BLOCKED navBlockedCount navCutPortals
navNarrowPortals ZONE_DANGER ZONE_DANGER_W ZONE_DANGER_DIRTY _WB _WBn VIS VIS_GEN VIS_EYE VIS_HEAD VIS_BODY VIS_CEIL_H VIS_CELL
VIS_FLOOR_EPS ZONES_GEN VIS_SHOULDER VIS_STACK VIS_SLAB MAP3D M3 M3_SOLID ZI_LB ZI_LE ZI_DB ZI_DE ZI_ORD NADE_ARC_SEG CROUCH_SPEED_FRAC KF_ICON LOOK SL BZ_WALK PATHQ PATHQ_N NAV_ZONE LADDERS OBS_BOUNDS NADE_FAIL""".split())   # (А5) MAP3D/M3/M3_SOLID — геометрия карты и её сетки (десятки МБ); v260: LOOK/SL — таблицы чисел, BZ_WALK — кэш
SETTINGS = set("""BAL MANUAL_WALLS WALL_POLYS wallSegs USER_ZONES USER_LINEUPS ZONE_NAMES ZONE_SHAPES navAnchors navTransform zoneLayer""".split())
UI = set("""view paused lastFrame accumulator nowTs MAPED MED_W MED_W_HINTS HEIGHTS HGT_AUTO HGT_OWN_CODE HGT_OWN HGT_STOPS HGT_C
HGT_LEDGE_TXT chkHeights hgtTip MED_H MED_H_HINTS chkVis VT WALLBANG WB_MAT WB_RULES WB_AUTO WB_OWN_CODE WB_OWN WB_C chkWallbang
wbTip MED_B MED_B_HINTS COVER COV_HIGH COV_CHEST COV_CAT COV_ORDER COV_AUTO COV_OWN_CODE COV_OWN COV_C chkCover covTip MED_C
MED_C_HINTS KF_IMG OBS OBS_K OBC RP RP_K RP_SNAPS RP_BF TS TS_K MINI WARM img imgReady imgFailed FRAME_CATCHUP_MS frameWrapR""".split())   # v344: img/imgReady/imgFailed — картинка радара (в снимке с v343 флаг «не загружен» гасил карту)   # v295: KF_IMG — картинки иконок радара (Image не клонируется — снимок падал, игра вставала)
EXTRA_STATIC = set("PRO_PRIOR PRO_LOOK PRO_SPOTS ZDJ KPC".split())   # (v458) ZDJ / KPC — кэши поиска пути одного тика (в ZDJ — куча с функциями: снимок падал «could not be cloned», разминка не стартовала)   # v255: по замеру — за 2 матча не меняются, ~400 КБ снимка


def inject(s):
    assert s.count(MARK) == 1, "нет метки @@BUILD@@ в игре"
    V = [v for v in top_vars(s) if v not in STATIC | SETTINGS | UI | EXTRA_STATIC and not v.startswith('__') and not v.startswith('MK') and not v.startswith('mk')]
    for must in ['tick', 'bots', 'bomb', 'roundNum', 'matchNum', 'smokes', 'score', 'roundState']:
        assert must in V, must
    snap = "var __SNAP = [\n" + ",\n".join('["%s", function(){ return %s; }, function(v){ try{ %s = v; }catch(e){} }]' % (v, v, v) for v in V) + "\n];\n"
    mod = open(os.path.join(HERE, 'marks.js'), encoding='utf-8').read()
    return s.replace(MARK, snap + mod)
