// ---------- параметры движка (правила CS2 и модель стрельбы; решений ботов тут нет) ----------
// v197: мозг ботов удалён — вместе с ним удалены все переключатели BAL мозга.
// Остались только числа движка; переключателей вкл/выкл нет.
var BAL = {
  // реакция стрелка (модель стрельбы): множитель реакции того, кто уже смотрит туда,
  // откуда вышел враг, — стоя и на ходу; преимущество пикающего в тиках (≈60 мс);
  // множитель реакции того, кто бежит
  holdReact: 0.70,
  preaimReact: 0.80,
  peekAdv: 4,
  moveReact: 1.0,
  trackK: 0.02,       // насколько сложно вести движущуюся цель (ошибка на 1 рад/с поперёк линии)
  hbK: 0.7,           // множитель ошибки прицела для хитбоксов (калибровка)
  fov: 110,           // угол обзора, градусов
  smokeR: 70,         // радиус дыма, px
  lobErr: 90,         // разброс навесного броска (лайнапа), px
  flashMax: 1.8,      // макс. ослепление флешкой, сек
  smokeLife: 18,      // сек
  mollyLife: 7,       // сек
  freeze: 15          // freeze-тайм в начале раунда, сек (как в CS2)
};
// Профили ролей (docs/BRAIN.md, раздел 6) — модификаторы систем мозга.
// Шаг 4: данные; читают шаги 5–9 (preferredAngle — 11_position.js, waitK — 12_script_runner.js).
// waitK (шаг 7) — во сколько раз роль терпеливее/нетерпеливее ждёт сигнала сценария (maxDelayTicks):
// entry ждёт меньше, support больше, остальные ×1. Проектная константа, не из демок — заплатка.
var RoleProfile = {
  entry:   { aggression:0.85, tradeReliance:'high_but_commits_anyway', infoIndependence:0.2, preferredAngle:'standard_or_deepest', waitK:0.6 },
  support: { aggression:0.45, tradeReliance:'high', infoIndependence:0.3, preferredAngle:'standard', clearsOffAngles:true, waitK:1.4 },
  awp:     { aggression:0.3,  tradeReliance:'medium', infoIndependence:0.4, preferredAngle:'long_sightline', repositionAfterShot:true },
  lurker:  { aggression:0.5,  tradeReliance:'none', infoIndependence:0.9, actsOnOwnKnowledgeOnly:true },
  anchor:  { aggression:0.2,  tradeReliance:'needs_partner', infoIndependence:0.3, delaysRatherThanWins:true },
  igl:     { aggression:0.35, tradeReliance:'high', callsSetupSwitches:true, sacrificesForInfo:true }
};
try{ if(window.BAL_OVERRIDE) for(var bk in window.BAL_OVERRIDE) BAL[bk] = window.BAL_OVERRIDE[bk]; }catch(e){}
