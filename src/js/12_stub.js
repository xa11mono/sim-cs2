// ======================= ЗАГЛУШКА ВМЕСТО МОЗГА (v197) =======================
// Мозг ботов удалён (07.10.2026, docs/tasks/restart.md). Здесь — минимум, чтобы
// игра шла; это не решения, а умолчания. Новый мозг заменит этот файл целиком.
//  • закуп оружия — с v217 решение команды в 12_buy.js (buyTeam);
//  • гранаты «себе» — stubSelfNades (шаг 10, заплатка): после сценарных гранат на остаток денег —
//    флешка, молотов; смок — носителю бомбы и CT (под дефуз). Что и когда кидать — 13_nades.js;
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
function stubSelfNades(){
  bots.forEach(function(b){
    if(!b.alive || !b.nades) return;
    var N = b._selfN = {flash: 0, molly: 0, smoke: 0};   // купленные себе (не под сценарий) — 13_nades.js selfLeft
    if(buyNade(b, "flash")) N.flash++;
    if(buyNade(b, "molly")) N.molly++;
    if((b.team === "CT" || (bomb && bomb.carrier === b)) && b.nades.smoke === 0 && buyNade(b, "smoke")) N.smoke++;
  });
}
