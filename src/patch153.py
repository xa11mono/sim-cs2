# ===== v151: роли как у про =====
rep("  smoothPeek: true,", "  smoothPeek: true,\n  proRoles: true,     // v151: роли игроков как у про (энтри, второй, саппорт/IGL, лёркер, снайпер), гранаты по роли\n  utilRoleK: 260,     // насколько роль влияет на выбор, кто кинет лайнап (px \"стоимости\" на 1 гранату/раунд)\n  infoFallback: true, // v151: выдвинутый CT берёт инфу и откатывается (2+ врага, минус рядом, ранен)")
rep('    var cost = function(b){ return Math.hypot(b.x-L.from.x, b.y-L.from.y) + (b.tRole === "entry" ? 300 : 0); };',
    '    var cost = function(b){ return Math.hypot(b.x-L.from.x, b.y-L.from.y) + (b.tRole === "entry" ? 300 : 0) + nadeRoleCost(b); };')
rep('var ROLE_LABEL = {anchorA:"опорник A", anchorB:"опорник B", mid:"мидер", rotator:"ротатор", roamer:"роумер",\n                  entry:"энтри", awp:"AWP", support:"поддержка", igl:"IGL", lurker:"лёркер"};',
    'var ROLE_LABEL = {anchorA:"опорник A", anchorB:"опорник B", mid:"мидер", rotator:"ротатор", roamer:"роумер",\n                  entry:"энтри", awp:"снайпер", support:"второй (размен)", igl:"саппорт · IGL", lurker:"лёркер"};')
rep("  if(BAL.smokeSpam) smokeSpamTick(); else smokeShots();", "  if(BAL.smokeSpam) smokeSpamTick(); else smokeShots();\n  infoFallbackTick();")
rep("  infoFallback: true,", "  infoFallback: true,\n  proNades: true,     // v151: закуп гранат как у про — на фулле 3–4 у каждого, набор по роли")
rep("function buyNades(b, type){\n  var wish = NADE_WISH[b.tRole] || [];", """// (v151) у про на полном закупе почти каждый берёт 3–4 гранаты (за раунд CT
// кидают ~10, T ~9.4); набор по роли игрока (демки): саппорт/снайпер — больше утилиты
var NADE_WISH_PRO = {
  entry:["flash","flash","smoke","molly"], support:["flash","smoke","molly","he"], igl:["smoke","molly","flash","flash"],
  lurker:["smoke","flash","molly","he"], awp:["smoke","flash","molly","he"],
  anchorA:["molly","smoke","flash","he"], anchorB:["molly","smoke","flash","he"], rotator:["smoke","flash","he","molly"],
  mid:["flash","smoke","he","molly"], roamer:["flash","smoke","he","molly"]
};
function buyNades(b, type){
  var wish = (BAL.proNades ? NADE_WISH_PRO[b.tRole] : null) || NADE_WISH[b.tRole] || [];""")
