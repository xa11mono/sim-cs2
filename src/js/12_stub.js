// ======================= ЗАГЛУШКА ВМЕСТО МОЗГА (v197) =======================
// Мозг ботов удалён (07.10.2026, docs/tasks/restart.md). Здесь — минимум, чтобы
// игра шла; это не решения, а умолчания. Новый мозг заменит этот файл целиком.
//  • закуп оружия — с v217 решение команды в 12_buy.js (buyTeam);
//  • гранаты «себе» — с v237 в 12_buy.js (buySelfNades, из v166);
//  • позиция и взгляд — с шага 5 в 11_position.js (одно место);
//  • присесть — stubCrouch (v201): стоит, видит врага, и присев всё ещё его видит,
//    а враг тело присевшего — нет (укрытие по грудь/низкое): приседает. Врага нет
//    2 с — встаёт. Идёт — стоя (присев — 34 % скорости, решать это будет мозг).
function stubCrouch(b){
  var moving = b.path.length > 0 && b.pathIdx < b.path.length;
  if(moving) return false;
  if(tick % 8 !== 0) return b.crouching;          // решает 8 раз в секунду, без дрожи
  var E = b._sawEnemy ? b._nearestEnemyBot : null;
  if(!E) return (tick - (b._lastSawT || -1e9) < 128) ? b.crouching : false;
  var me = visParts(b.x, b.y, true, E.x, E.y, E.crouching);
  if(!me.head && !me.body) return false;           // присев врага не видно — стоять
  return !visParts(E.x, E.y, E.crouching, b.x, b.y, true).body;
}
