# v166 шаг 9: фулл-бай как у про = винтовка + броня + гранаты (CT ещё кит у части).
# Раньше фулл объявлялся, когда хватало ровно на винтовку и броню, — у CT после
# закупа оставалось ~$250, гранат ~2 на игрока против ~3 у про.
rep("var BAL = {", """var BAL = {
  ecoUtil: true,      // v166: решение о фулле учитывает гранаты (+$600 T, +$800 CT), иначе — хаф/эко с запасом""")
rep("""function fullNeed(b){
  var need = 0;""","""function fullNeedU(b){ return fullNeed(b) + (BAL.ecoUtil ? (b.team === "CT" ? 500 : 300) : 0); }
function fullNeed(b){
  var need = 0;""")
rep("""  var canFull = mates.filter(function(b){ return b.money >= fullNeed(b); }).length;
  // проиграли пистолетку""","""  var canFull = mates.filter(function(b){ return b.money >= fullNeedU(b); }).length;
  // проиграли пистолетку""")
rep("""  var teamNeed = mates.reduce(function(a,b){ return a+fullNeed(b); }, 0);
  if(canFull >= 4 || (canFull >= 3 && teamMoney >= teamNeed)) return "full";""","""  var teamNeed = mates.reduce(function(a,b){ return a+fullNeedU(b); }, 0);
  if(canFull >= 4 || (canFull >= 3 && teamMoney >= teamNeed)) return "full";
  // (v166) на винтовки и броню хватает всем, но без гранат: про всё равно
  // заходят в фулл, если следующий раунд при поражении будет опять бедным
  var canBare = mates.filter(function(b){ return b.money >= fullNeed(b); }).length;""")
rep("""  if(canFullNext >= 4) return canFull >= 2 ? "half" : "eco";""","""  if(BAL.ecoUtil){ var canFullNextU = mates.filter(function(b){ return b.money + nextInc >= fullNeedU(b); }).length;
    if(canFullNextU >= 4) return canFull >= 2 ? "half" : "eco";
    if(canBare >= 4) return "full"; }
  if(canFullNext >= 4) return canFull >= 2 ? "half" : "eco";""")
rep("версия 165 · 01.10","версия 166 · 01.10")
