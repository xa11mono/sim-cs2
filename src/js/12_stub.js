// ======================= ЗАГЛУШКА ВМЕСТО МОЗГА (v197) =======================
// Мозг ботов удалён (07.10.2026, docs/tasks/restart.md). Здесь — минимум, чтобы
// игра шла; это не решения, а умолчания. Новый мозг заменит этот файл целиком.
//  • закуп — stubBuy: пистолетный раунд — кевлар (не хватает — P250); дальше —
//    винтовка + кевлар со шлемом, если хватает на всё, иначе ничего;
//  • позиция — нет: боты стоят на своём спавне (пути не задаются);
//  • взгляд — stubLook: вперёд, по направлению от своего спавна к центру карты.
//    Видимый враг в поле зрения — поворот и выстрел (это реакция движка,
//    15_combat.js), бомба остаётся у носителя, раунд кончается по времени.
function stubBuy(b){
  var pistolRound = roundNum === 1 || roundNum === HALF_ROUNDS+1;
  if(pistolRound){
    if(!b.armor && b.money >= ARMOR_PRICE) buyArmor(b, false);
    else if(b.secondary !== "P250") buyItem(b, "P250");
    return;
  }
  if(b.primary && WEAPONS[b.primary].tier >= 6) return;   // винтовка с прошлого раунда
  var rifle = b.team === "CT" ? "M4" : "AK";
  var armorCost = b.armor ? (b.helmet ? 0 : HELMET_UPGRADE) : ARMOR_PRICE + HELMET_UPGRADE;
  if(b.money < WEAPONS[rifle].price + armorCost) return;
  buyItem(b, rifle);
  buyArmor(b, true);
}
function stubLook(b){
  var sp = b.spawnPt || (b.team === "CT" ? CT_SPAWN : T_SPAWN);
  var a = Math.atan2(1024 - sp.y, 1024 - sp.x);
  return {x: b.x + Math.cos(a)*400, y: b.y + Math.sin(a)*400};
}
