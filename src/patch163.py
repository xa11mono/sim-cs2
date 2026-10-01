# v161: кружки ботов меньше — меньше перекрывают мелкие укрытия
rep("""    var r = (bot.crouching ? 7 : 8)/view.scale; // сидя — чуть меньше""","""    var r = (bot.crouching ? 6.2 : 7)/view.scale; // сидя — чуть меньше (v161: кружки меньше, не закрывают мелкие укрытия)""")
rep("""      var br = r + (3 + 1.6*Math.sin(nowTs/520 + (bot._idlePhase||0)))/view.scale;""","""      var br = r + (2.5 + 1.3*Math.sin(nowTs/520 + (bot._idlePhase||0)))/view.scale;""")
rep("версия 160 · 01.10","версия 161 · 01.10")
