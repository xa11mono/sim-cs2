
const MAP_POOL = ["Mirage", "Inferno", "Nuke", "Dust II", "Ancient", "Anubis", "Train"];
const PLAYSTYLES = ["Aggressive", "Discipline", "Tactical", "Chaos"];
const TOURNAMENT_TEMPLATES = {
  major:  { prestige:"major", name:"PGL Major", size:16, format:"swiss", fieldProfile:"major" },
  iem:    { prestige:"elite", name:"IEM Cologne", size:16, format:"double", fieldProfile:"elite" },
  blast:  { prestige:"regular", name:"BLAST Premier", size:16, format:"single", fieldProfile:"open" },
  esl:    { prestige:"elite", name:"ESL Pro League", size:16, format:"gsl", fieldProfile:"elite" },
  cct:    { prestige:"regular", name:"CCT Global Finals", size:16, format:"single", fieldProfile:"open" },
  bounty: { prestige: "elite", name: "BLAST Bounty Hunt", size: 32, format: "bounty", fieldProfile: "elite" }
};
const TOUR_DATABASE = {
  regular: [
    "BLAST Premier Spring Groups", "ESL Challenger Melbourne", "FISSURE Universe Belgrade",
    "BLAST Premier Fall Showdown", "ESL Challenger Katowice", "FiReLEAGUE Buenos Aires",
    "Skyesports Masters Mumbai", "Thunderpick World Championship", "CCT Global Finals Online",
    "Elisa Masters Espoo", "Roobet Cup Invitational", "BetBoom Dacha Dubai",
    "RES European Series Finals", "Pinnacle Cup Championship", "United21 League Season",
    "YaLLa Compass Contenders", "CCT Season Finals Europe", "EPL Challenger Division",
    "Tipsport Cup Prague", "CCT Online Finals America", "RES Regional Series",
    "Exort Series Finals", "European Pro League", "CCT South America Series"
  ],
  elite: [
    "IEM Katowice (Spodek Arena)", "IEM Cologne (Lanxess Arena)", "ESL Pro League Season (Malta)",
    "BLAST Premier World Final", "StarSeries i-League Krakow", "IEM Dallas", "IEM Chengdu",
    "ESL Pro League Playoffs", "BLAST Premier Spring Final", "BLAST Premier Fall Final",
    "IEM Autumn Showdown", "YaLLa Compass Abu Dhabi", "BetBoom Dacha Belgrade S-Tier",
    "Thunderpick World Championship LAN", "Pinnacle Cup Invitational S-Tier"
  ],
  bounty: [
    "BLAST Bounty Hunt Season 1", "BLAST Bounty Hunt: Spring Clash",
    "BLAST Bounty Hunt: Fall Showdown", "BLAST Bounty Masters Europe",
    "BLAST Bounty Hunt: Global Finals", "BLAST Bounty Circuit",
    "BLAST Bounty Arena Clash", "BLAST Bounty Showdown Finals"
  ],
  major: [
    "PGL Major Copenhagen", "Perfect World Major Shanghai", "BLAST.tv Austin Major",
    "StarLadder Major Budapest", "ESL One Rio Major", "BLAST.tv Paris Major",
    "PGL Major Kraków 2026", "BLAST.tv Major Winter", "Perfect World Major Chengdu"
  ],
  weak: [
    "Open Challenger Cup", "Rookie Clash", "Open Series Finals",
    "Rising Open Championship", "Entry League Cup", "Underground Series",
    "Amateur Open Division", "Grassroots CS2 Cup", "Novice Clash"
  ]
};
const HIGHLIGHT_EVENTS = [
  "⚡ Опен-фраг со снайперской винтовки через мид!",
  "💣 Быстрый пуш точки B с полным раскидом гранат!",
  "🔥 Эйс с Desert Eagle на чистом эко-раунде!",
  "🛡️ Скрытый ниндзя-дефьюз в смоку на последних секундах!",
  "🎯 Невероятный клатч 1 в 3 на выбивании точки A!"
];
const RANDOM_EVENTS = [
  { text: "замена в составе из-за болезни (стендин)", stat: "form", val: -18, icon: "🔄" },
  { text: "визовые проблемы у ключевого игрока", stat: "form", val: -22, icon: "🛂" },
  { text: "мощный буткемп на базе организатора", stat: "form", val: 15, icon: "🏕️" },
  { text: "крупный контракт от нового титульного спонсора", stat: "form", val: 12, icon: "💰" },
  { text: "новый амбициозный тренерский штаб", stat: "form", val: 10, icon: "🧠" },
  { text: "скандал внутри организации и токсичность", stat: "form", val: -14, icon: "⚠️" }
];
const DEFAULT_TEAMS = [
  { name: "Team Spirit", pts: 1020, style: "Tactical" },
  { name: "Team Falcons", pts: 980, style: "Discipline" },
  { name: "Team Vitality", pts: 960, style: "Tactical" },
  { name: "MOUZ", pts: 885, style: "Aggressive" },
  { name: "FURIA", pts: 875, style: "Aggressive" },
  { name: "G2", pts: 830, style: "Chaos" },
  { name: "NAVI", pts: 805, style: "Discipline" },
  { name: "FUT", pts: 790, style: "Aggressive" },
  { name: "Legacy", pts: 770, style: "Chaos" },
  { name: "Aurora", pts: 745, style: "Aggressive" },
  { name: "FAZE", pts: 710, style: "Chaos" },
  { name: "The Mongolz", pts: 700, style: "Aggressive" },
  { name: "BETBOOM", pts: 670, style: "Tactical" },
  { name: "Astralis", pts: 640, style: "Discipline" },
  { name: "9z", pts: 630, style: "Aggressive" },
  { name: "3DMAX", pts: 620, style: "Tactical" },
  { name: "Team Liquid", pts: 610, style: "Tactical" },
  { name: "B8", pts: 600, style: "Discipline" },
  { name: "paiN", pts: 600, style: "Aggressive" },
  { name: "BIG", pts: 590, style: "Discipline" },
  { name: "HEROIC", pts: 570, style: "Chaos" },
  { name: "PARIVISION", pts: 560, style: "Tactical" },
  { name: "NIP", pts: 560, style: "Discipline" },
  { name: "HOTU", pts: 550, style: "Aggressive" },
  { name: "GamerLegion", pts: 540, style: "Tactical" },
  { name: "MIBR", pts: 540, style: "Aggressive" },
  { name: "magic", pts: 530, style: "Chaos" },
  { name: "TYLOO", pts: 530, style: "Discipline" },
  { name: "Inner Circle", pts: 520, style: "Tactical" },
  { name: "M80", pts: 510, style: "Aggressive" },
  { name: "Lynn Vision", pts: 500, style: "Chaos" },
  { name: "100 Thieves", pts: 480, style: "Discipline" },
  { name: "OG", pts: 460, style: "Tactical" },
  { name: "Virtus.pro", pts: 450, style: "Discipline" },
  { name: "K27", pts: 420, style: "Chaos" },
  { name: "SAW", pts: 410, style: "Tactical" },
  { name: "Sashi", pts: 400, style: "Aggressive" },
  { name: "BC.GAME", pts: 390, style: "Chaos" },
  { name: "Eternal Fire", pts: 380, style: "Aggressive" },
  { name: "NRG", pts: 370, style: "Tactical" },
  { name: "WW Team", pts: 350, style: "Chaos" },
  { name: "EYEBALLERS", pts: 330, style: "Discipline" },
  { name: "Luminosity", pts: 320, style: "Tactical" },
  { name: "FOKUS", pts: 280, style: "Chaos" }
];
const TEAM_REGION_FLAG = {
  "Team Spirit":"🇷🇺", "Team Falcons":"🇸🇦", "Team Vitality":"🇫🇷", "MOUZ":"🇩🇪", "FURIA":"🇧🇷",
  "G2":"🇩🇪", "NAVI":"🇺🇦", "FUT":"🇹🇷", "Legacy":"🇧🇷", "Aurora":"🇷🇺", "FAZE":"🌍",
  "The Mongolz":"🇲🇳", "BETBOOM":"🇷🇺", "Astralis":"🇩🇰", "9z":"🇦🇷", "3DMAX":"🇫🇷", "Team Liquid":"🇺🇸",
  "B8":"🇺🇦", "paiN":"🇧🇷", "BIG":"🇩🇪", "HEROIC":"🇩🇰", "PARIVISION":"🇺🇦", "NIP":"🇸🇪",
  "HOTU":"🇸🇦", "GamerLegion":"🇪🇺", "MIBR":"🇧🇷", "magic":"🇷🇺", "TYLOO":"🇨🇳", "Inner Circle":"🇪🇺",
  "M80":"🇺🇸", "Lynn Vision":"🇨🇳", "100 Thieves":"🇺🇸", "OG":"🇪🇺", "Virtus.pro":"🇷🇺",
  "K27":"🇷🇺", "SAW":"🇵🇹", "Sashi":"🇧🇷", "BC.GAME":"🌍", "Eternal Fire":"🇹🇷", "NRG":"🇺🇸",
  "WW Team":"🇷🇺", "EYEBALLERS":"🇪🇺", "Luminosity":"🇧🇷", "FOKUS":"🌍"
};
const PLAYER_LAYER_VERSION = 2;
const ROLE_POOL = ["IGL", "AWPer", "Entry-fragger", "Support", "Lurker"];
const ROLE_LABELS = {"IGL":"IGL", "AWPer":"AWPer", "Entry-fragger":"Entry", "Support":"Support", "Lurker":"Lurker"};
const TEAM_ROSTER_2026 = {
  "Team Spirit": ["sh1ro","magixx","tN1R","zont1x","donk"],
  "Team Falcons": ["karrigan","NiKo","TeSeS","m0NESY","kyousuke"],
  "MOUZ": ["torzsi","Spinx","xertioN","PR","xelex"],
  "FURIA": ["FalleN","yuurih","YEKINDAR","KSCERATO","molodoy"],
  "Team Vitality": ["apEX","ropz","ZywOo","flameZ","mezii"],
  "Legacy": ["arT","dumau","latto","n1ssim","try"],
  "FUT": ["xfl0ud","dem0n","Krabeni","cmtry","dziugss"],
  "G2": ["huNter-","NertZ","r1nkle","HeavyGod","MATYS"],
  "Aurora": ["XANTARES","woxic","Jimpphat","kyxsan","Wicadia"],
  "NAVI": ["Aleksib","iM","b1t","w0nderful","makazze"],
  "Astralis": ["HooXi","phzy","jabbi","Staehr","ryu"],
  "BETBOOM": ["Boombl4","zorte","S1ren","d1Ledez","Magnojez"],
  "FAZE": ["frozen","Twistzz","Neityu","jcobbb","JBOEN"],
  "9z": ["max","dgt","meyern","luchov","HUASOPEEK"],
  "The MongolZ": ["bLitz","Techno","910","tikuak","DarkMeister"],
  "B8": ["alex666","npl","kensizor","esenthial","s1zzi"],
  "magic": ["MaSvAl","sFade8","AW","mo0N","tenzy"],
  "MIBR": ["LNZ","nqz","insani","venomzera","tomaszin"],
  "PARIVISION": ["FL1T","Jame","xiELO","she1zzZJEZ","xseveN"],
  "GamerLegion": ["Snax","REZ","Tauson","FL4MUS","hypex"],
  "Alliance": ["twist","era","bobeksde","uP","eZaVid"],
  "Team Liquid": ["NAF","EliGE","malbsMd","JT","Jorko"],
  "Liquid": ["NAF","EliGE","malbsMd","JT","Jorko"],
  "3DMAX": ["Maka","Lucky","misutaaa","Kursy","Graviti"],
  "Inner Circle": ["cptkurtka023","headtr1ck","zeRRoFIX","onic","Dawy"],
  "BIG": ["tabseN","JDC","faveN","blameF","gr1ks"],
  "M80": ["slaxz-","Swisher","s1n","JBa","Lake"],
  "paiN": ["biguzera","saffee","snow","Tatu","Rzinh0"],
  "HOTU": ["n0rb3r7","tadeo","mizu","dwushka","frontales"],
  "NIP": ["stavn","jL","Krimbo","oNte","xKacpersky"],
  "JiJieHao": ["m1N1","sinnopsyy","Bibu","CaNito","OSAMAS"],
  "TYLOO": ["JamYoung","Jee","Mercury","Moseyuh","xZero"],
  "HEROIC": ["Brollan","nilo","susp","MartinezSa","Chr1zN"],
  "5star": ["NEUZ","rate","clouden","aruicle","hoolig4n"],
  "Lynn Vision": ["Westmelon","z4KR","EmiliaQAQ","Starry","C4LLM3SU3"],
  "100 Thieves": ["device","rain","Gizmy","sirah","poiii"],
  "DENDELE": ["gafolo","koala","maxxkor","rdnzao","doc"],
  "Luminosity": ["Rainwaker","afro","lux","yxngstxr","AZUWU"],
  "1win": ["Ax1Le","nafany","BELCHONOKK","fame","ArtFr0st"],
  "Nemiga": ["KaiR0N-","Xant3r","robo","khaN","syph0"],
  "Wildcard": ["nEMANHA","mhl","Cxz","reck","hext"],
  "K27": ["clax","X5G7V","xeedo","kashjld","qw1nk1"],
  "fnatic": ["fear","jambo","jackasmo","cairne","mazzay"],
  "FOKUS": ["ztr","Banjo","podi","jocab","Matheos"],
  "Nemesis": ["SELTER","r3salt","mag1k","ze1xy","Sdaim"],
  "SINNERS": ["beastik","SHOCK","MoDo","k1serek","stressarN"],
  "Virtus.pro": ["mir","b1t","F0R3VER","AquaR85","oRO"],
  "Nuclear TiGeRES": ["flouzer","senka","ayuki","Djon8","tronic"],
  "Betclic": ["Demho","Prism","ex1st","ultimate","Qlocuu"],
  "EYEBALLERS": ["JW","KRIMZ","maxster","r0lf","dex"],
  "NRG": ["nitr0","Sonic","hallzerk","Grim","Jeorge"],
  "Eternal Fire": ["MAJ3R","regali","soulfly","Kvem","jottAAA"],
  "BC.GAME": ["s1mple","electroNic","Magisk","Senzu","mzinho"],
  "Iberian Soul": ["alex","mopoz","sausol","dav1g","MartinezSa"],
  "BBL": ["IceBerg","salazar","leakz","B0ye","NickyB"],
  "Sashi": ["acoR","Cabbi","zHend","Anlele","MistR"],
  "GenOne": ["Keoz","Djoko","Brooxsy","Chucky","bL4SEZ"],
  "Color": ["Qikert","lattykk","reyoz","cronuss","oz1k"],
  "Acend": ["SPELLAN","REDSTAR","KalubeR","Skrimo","h4rn"],
  "INOX Division": ["k0s","FenomeN","k1slll","finW","gooddeph"],
  "Johnny Speeds": ["draken","hampus","Svedjehed","bsover","R3ck"],
  "Fluxo": ["exit","dav1deuS","zevy","kye","Ltz"],
  "Imperial": ["chelo","VINI","decenty","noway","saadzin"],
  "OG": ["cadiaN","bodyy","s0m","adamb","pr1metapz"],
  "INFINITE": ["kreaz","Blytz","volt","sl3nd","Dytor"],
  "9INE": ["raalz","kraghen","flayy","rim3","b1elany"],
  "WW Team": ["StRoGo","deko","ctom","m3wsu","kelieN"],
};
const PLAYER_STATUS_2026 = {
  "tikuak":"BENCH", "DarkMeister":"BENCH",
  "Dytor":"RESERVE", "MartinezSa":"RESERVE", "h4rn":"BENCH",
  "z1k4":"BENCH", "m1QUSE":"BENCH"
};

const PLAYER_META_2026 = {
  "sh1ro": {realName:"Dmitry Sokolov", age:25, country:"RU", language:"Russian", role:"AWPer"},
  "magixx": {realName:"Boris Vorobiev", age:23, country:"RU", language:"Russian", role:"Support"},
  "tN1R": {realName:"Andrey Tatarinovich", age:25, country:"BY", language:"Russian", role:"Rifler"},
  "zont1x": {realName:"Myroslav Plakhotia", age:21, country:"UA", language:"Russian", role:"Lurker"},
  "donk": {realName:"Danil Kryshkovets", age:19, country:"RU", language:"Russian", role:"Entry-fragger"},
  "karrigan": {realName:"Finn Andersen", age:36, country:"DK", language:"English/Danish", role:"IGL"},
  "NiKo": {realName:"Nikola Kovač", age:29, country:"BA", language:"Bosnian/English", role:"Entry-fragger"},
  "TeSeS": {realName:"René Madsen", age:25, country:"DK", language:"Danish/English", role:"Support"},
  "m0NESY": {realName:"Ilya Osipov", age:21, country:"RU", language:"Russian", role:"AWPer"},
  "kyousuke": {realName:"Maksim Lukin", age:18, country:"RU", language:"Russian", role:"Rifler"},
  "torzsi": {realName:"Ádám Torzsás", age:25, country:"HU", language:"Hungarian/English", role:"AWPer"},
  "Spinx": {realName:"Lotan Giladi", age:26, country:"IL", language:"Hebrew/English", role:"Rifler"},
  "xertioN": {realName:"Dorian Berman", age:22, country:"IL", language:"Hebrew/English", role:"Entry-fragger"},
  "FalleN": {realName:"Gabriel Toledo", age:35, country:"BR", language:"Portuguese/English", role:"IGL"},
  "yuurih": {realName:"Yuri Boian", age:26, country:"BR", language:"Portuguese", role:"Rifler"},
  "YEKINDAR": {realName:"Mareks Gaļinskis", age:26, country:"LV", language:"English/Latvian", role:"Entry-fragger"},
  "KSCERATO": {realName:"Kaike Cerato", age:27, country:"BR", language:"Portuguese", role:"Lurker"},
  "molodoy": {realName:"Danil Golubenko", age:20, country:"KZ", language:"Russian", role:"AWPer"},
  "apEX": {realName:"Dan Madesclaire", age:33, country:"FR", language:"French/English", role:"IGL"},
  "ropz": {realName:"Robin Kool", age:26, country:"EE", language:"Estonian/English", role:"Lurker"},
  "ZywOo": {realName:"Mathieu Herbaut", age:25, country:"FR", language:"French/English", role:"AWPer"},
  "flameZ": {realName:"Shahar Shushan", age:22, country:"IL", language:"Hebrew/English", role:"Entry-fragger"},
  "mezii": {realName:"William Merriman", age:22, country:"GB", language:"English", role:"Support"},
  "huNter-": {realName:"Nemanja Kovač", age:30, country:"BA", language:"Bosnian/English", role:"Rifler"},
  "NertZ": {realName:"Guy Iluz", age:26, country:"IL", language:"Hebrew/English", role:"Rifler"},
  "r1nkle": {realName:"Artem Moroz", age:21, country:"UA", language:"Polish/English", role:"AWPer"},
  "HeavyGod": {realName:"Nikita Martynenko", age:24, country:"IL", language:"Hebrew/English", role:"Rifler"},
  "MATYS": {realName:"Matyáš Šimko", age:23, country:"SK", language:"Slovak/English", role:"Rifler"},
  "Aleksib": {realName:"Aleksi Virolainen", age:29, country:"FI", language:"Finnish/English", role:"IGL"},
  "iM": {realName:"Ivan Mihai", age:25, country:"RO", language:"Romanian/English", role:"Rifler"},
  "b1t": {realName:"Valeriy Vakhovskiy", age:22, country:"UA", language:"Ukrainian/Russian", role:"Rifler"},
  "w0nderful": {realName:"Ihor Zhdanov", age:21, country:"UA", language:"Ukrainian/Russian", role:"AWPer"},
  "makazze": {realName:"Drin Bicaku", age:18, country:"XK", language:"Albanian/English", role:"Rifler"},
  "HooXi": {realName:"Rasmus Nielsen", age:30, country:"DK", language:"Danish/English", role:"IGL"},
  "phzy": {realName:"Love Smidebrant", age:23, country:"SE", language:"Swedish/English", role:"AWPer"},
  "jabbi": {realName:"Jakob Nygaard", age:23, country:"DK", language:"Danish/English", role:"Rifler"},
  "Staehr": {realName:"Victor Staehr", age:21, country:"DK", language:"Danish/English", role:"Rifler"},
  "ryu": {realName:"Nikita Chulkov", age:22, country:"RU", language:"Russian/English", role:"Support"},
  "Boombl4": {realName:"Kirill Mikhailov", age:27, country:"RU", language:"Russian", role:"IGL"},
  "zorte": {realName:"Aleksandr Zagodyrenko", age:26, country:"RU", language:"Russian", role:"AWPer"},
  "S1ren": {realName:"Sergey Ivanov", age:24, country:"RU", language:"Russian", role:"Support"},
  "Magnojez": {realName:"Magnojez", age:23, country:"RU", language:"Russian", role:"Entry-fragger"},
  "Twistzz": {realName:"Russel Van Dulken", age:26, country:"CA", language:"English", role:"Rifler"},
  "frozen": {realName:"David Čerňanský", age:23, country:"SK", language:"Slovak/English", role:"Rifler"},
  "Neityu": {realName:"Nicolas Rodier", age:20, country:"FR", language:"French/English", role:"Entry-fragger"},
  "max": {realName:"Maximiliano Gonzalez", age:26, country:"AR", language:"Spanish", role:"IGL"},
  "dgt": {realName:"David Gatica", age:25, country:"AR", language:"Spanish", role:"Rifler"},
  "meyern": {realName:"Lautaro Guzmán", age:22, country:"AR", language:"Spanish", role:"Rifler"},
  "luchov": {realName:"Luciano de Brea", age:22, country:"AR", language:"Spanish", role:"AWPer"},
  "HUASOPEEK": {realName:"Natan Schmitt", age:24, country:"BR", language:"Portuguese/Spanish", role:"Entry-fragger"},
  "npl": {realName:"Volodymyr Zaytsev", age:20, country:"UA", language:"Ukrainian/Russian", role:"Rifler"},
  "alex666": {realName:"Oleksii Yarmoshchuk", age:25, country:"UA", language:"Ukrainian/Russian", role:"IGL"},
  "nqz": {realName:"Andre Caringi", age:19, country:"BR", language:"Portuguese", role:"AWPer"},
  "LNZ": {realName:"Bruno Figueiredo", age:24, country:"BR", language:"Portuguese", role:"IGL"},
  "insani": {realName:"João Mulé", age:20, country:"BR", language:"Portuguese", role:"Entry-fragger"},
  "venomzera": {realName:"Eduardo Vilela", age:22, country:"BR", language:"Portuguese", role:"Rifler"},
  "Rainwaker": {realName:"Teodor Petrov", age:24, country:"BG", language:"Bulgarian/English", role:"Rifler"},
  "afro": {realName:"Dimitri Vandenbosch", age:25, country:"FR", language:"French/English", role:"AWPer"},
  "lux": {realName:"Lucas Rito", age:20, country:"BR", language:"Portuguese", role:"Support"},
  "device": {realName:"Nicolai Reedtz", age:31, country:"DK", language:"Danish/English", role:"AWPer"},
  "rain": {realName:"Håvard Nygaard", age:31, country:"NO", language:"Norwegian/English", role:"Rifler"},
  "Gizmy": {realName:"Adam Liardi", age:21, country:"US", language:"English", role:"Rifler"},
  "sirah": {realName:"Adam H." , age:22, country:"US", language:"English", role:"Support"},
  "poiii": {realName:"Nikita Golubev", age:22, country:"US", language:"English", role:"Entry-fragger"},
  "doc": {realName:"Danilo Barros", age:24, country:"BR", language:"Portuguese", role:"Rifler"},
  "Westmelon": {realName:"Zhe Niu", age:26, country:"CN", language:"Chinese", role:"IGL"},
  "z4KR": {realName:"Zhou Kang", age:27, country:"CN", language:"Chinese", role:"Rifler"},
  "Starry": {realName:"Liu Ziyu", age:20, country:"CN", language:"Chinese", role:"Entry-fragger"},
  "EmiliaQAQ": {realName:"Emilia", age:24, country:"CN", language:"Chinese", role:"Support"},
  "C4LLM3SU3": {realName:"C4LLM3SU3", age:23, country:"CN", language:"Chinese", role:"Rifler"},
  "KaiR0N-": {realName:"Ilya Ulyanov", age:21, country:"RU", language:"Russian", role:"Entry-fragger"},
  "Xant3r": {realName:"Xant3r", age:23, country:"RU", language:"Russian", role:"Rifler"},
  "robo": {realName:"Nikita Timoshkov", age:24, country:"RU", language:"Russian", role:"Support"},
  "khaN": {realName:"Nikita Kravtsov", age:26, country:"RU", language:"Russian", role:"IGL"},
  "syph0": {realName:"Danil Meshcheryakov", age:23, country:"RU", language:"Russian", role:"AWPer"},
  "Brollan": {realName:"Ludvig Brolin", age:23, country:"SE", language:"Swedish/English", role:"Rifler"},
  "MartinezSa": {realName:"Álvaro García", age:22, country:"ES", language:"Spanish/English", role:"AWPer"},
  "cptkurtka023": {realName:"Danylo Dudar", age:22, country:"UA", language:"Ukrainian/Russian", role:"IGL"},
  "headtr1ck": {realName:"Daniil Valitov", age:21, country:"UA", language:"Ukrainian/Russian", role:"AWPer"},
  "zeRRoFIX": {realName:"Eduard Petrovskyi", age:23, country:"UA", language:"Ukrainian/Russian", role:"Rifler"},
  "onic": {realName:"Oleksii Poleshchuk", age:22, country:"UA", language:"Ukrainian/Russian", role:"Support"},
  "Dawy": {realName:"Dawid Dąbrowski", age:24, country:"PL", language:"Polish/English", role:"Rifler"},
  "StRoGo": {realName:"Ivan Shurpatov", age:24, country:"RU", language:"Russian/English", role:"Support"},
  "kelieN": {realName:"Vladimir Boldyrev", age:22, country:"RU", language:"Russian/English", role:"IGL"},
  "deko": {realName:"Denis Zhukov", age:25, country:"RU", language:"Russian/English", role:"AWPer"},
  "m3wsu": {realName:"Timur Korenev", age:22, country:"RU", language:"Russian/English", role:"Rifler"},
  "ctom": {realName:"Artem Maximov", age:23, country:"RU", language:"Russian/English", role:"Entry-fragger"},  
};
// v33: справочные данные о реальных игроках (js/data-real-2026.js): страны, уровень, реальные свободные агенты
(function applyRealData() {
  const R = window.CS2_REAL; if (!R) return;
  Object.entries(R.meta || {}).forEach(([nick, m]) => { PLAYER_META_2026[nick] = Object.assign({}, m, PLAYER_META_2026[nick] || {}); });
  if (TEAM_ROSTER_2026['The MongolZ'] && !TEAM_ROSTER_2026['The Mongolz']) TEAM_ROSTER_2026['The Mongolz'] = TEAM_ROSTER_2026['The MongolZ']; // в пуле команда называется «The Mongolz»
})();

const COACHES_2026 = {
  "Team Spirit": {name:"hally", flag:"🇷🇺"}, "Team Falcons": {name:"zonic", flag:"🇩🇰"}, "MOUZ": {name:"sycrone", flag:"🇩🇰"},
  "FURIA": {name:"sidde", flag:"🇧🇷"}, "Team Vitality": {name:"XTQZZZ", flag:"🇫🇷"}, "G2": {name:"sAw", flag:"🇵🇹"},
  "NAVI": {name:"B1ad3", flag:"🇺🇦"}, "Natus Vincere": {name:"B1ad3", flag:"🇺🇦"}, "Astralis": {name:"NEO", flag:"🇵🇱"},
  "Legacy": {name:"adrrr", flag:"🇧🇷"}, "FUT": {name:"coolio", flag:"🇭🇺"}, "Aurora": {name:"ash", flag:"🇷🇺"},
  "BETBOOM": {name:"Fierce", flag:"🇷🇺"}, "9z": {name:"BIT", flag:"🇺🇦"}, "B8": {name:"maddened", flag:"🇺🇦"},
  "HEROIC": {name:"doto", flag:"🇫🇮"}, "Inner Circle": {name:"jR", flag:"🇺🇦"}, "Lynn Vision": {name:"GUM", flag:"🇨🇳"},
  "Nemiga": {name:"boX", flag:"🇧🇾"}, "100 Thieves": {name:"gla1ve", flag:"🇩🇰"}
};

function hashTeamName(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}
function getTeamFlag(teamName) { return TEAM_REGION_FLAG[teamName] || "🌍"; }
function generateRoster(teamName) {
  const names = TEAM_ROSTER_2026[teamName];
  if (Array.isArray(names) && names.length) {
    return names.slice(0, 5).map((nick, idx) => ({ nick, status: PLAYER_STATUS_2026[nick] || "STARTER", flag: countryFlag((PLAYER_META_2026[nick] || {}).country) }));
  }
  const seed = hashTeamName(teamName);
  const namesFallback = [];
  for (let i = 0; i < 5; i++) namesFallback.push(REGEN_NICK_POOL[(seed + i * 13) % REGEN_NICK_POOL.length]);
  return namesFallback.map(nick => ({ nick, status: "STARTER", flag: getTeamFlag(teamName) }));
}
function generateCoach(teamName) {
  return COACHES_2026[teamName] || { name: REGEN_COACH_POOL[hashTeamName(teamName + "_coach") % REGEN_COACH_POOL.length], flag: getTeamFlag(teamName) };
}

function clampNumber(v, min, max){ return Math.max(min, Math.min(max, Number(v) || 0)); }
function countryFlag(code){
  if (/^[A-Z]{2}$/.test(code || '')) return String.fromCodePoint(...[...code].map(c => 127397 + c.charCodeAt(0))); // флаг любой страны по коду ISO
  const m={RU:"🇷🇺",UA:"🇺🇦",DK:"🇩🇰",FR:"🇫🇷",BR:"🇧🇷",DE:"🇩🇪",IL:"🇮🇱",EE:"🇪🇪",GB:"🇬🇧",CA:"🇨🇦",NO:"🇳🇴",US:"🇺🇸",CN:"🇨🇳",SE:"🇸🇪",PL:"🇵🇱",SK:"🇸🇰",HU:"🇭🇺",RO:"🇷🇴",ES:"🇪🇸",FI:"🇫🇮",BG:"🇧🇬",AR:"🇦🇷",KZ:"🇰🇿",BA:"🇧🇦",XK:"🇽🇰",LV:"🇱🇻",PT:"🇵🇹"};
  return m[code] || "🌍";
}
function defaultPlayerRole(index){ return ROLE_POOL[index % ROLE_POOL.length]; }
function playerBaseSeed(t, p, index){ return (hashTeamName(t.name) + index * 17 + hashTeamName(p.nick || "")) % 1000; }
function createPlayerFromNick(t, nick, index){
  const meta = PLAYER_META_2026[nick] || {};
  const seed = playerBaseSeed(t,{nick},index);
  const role = meta.role || defaultPlayerRole(index);
  const styleBoost = t.style === "Aggressive" ? 3 : t.style === "Tactical" ? 2 : 1;
  const tierBoost = Math.round(((Number(t.pts)||500)-500)/80);
  const roleBias = role === "AWPer" ? 2 : role === "Entry-fragger" ? 3 : role === "IGL" ? -1 : role === "Support" ? -2 : 0;
  const realName = meta.realName || "";
  // v33: если известен уровень игрока (0–100), характеристики тянутся к нему наполовину
  const sk = Number(meta.skill) >= 60 ? Number(meta.skill) : null, mix = (v, d) => sk ? Math.round(v * 0.5 + (sk + d) * 0.5) : v;
  return {
    nick,
    realName,
    age: meta.age || null,
    country: meta.country || "",
    flag: meta.country ? countryFlag(meta.country) : "🌍",
    language: meta.language || "—",
    role,
    status: PLAYER_STATUS_2026[nick] || "STARTER",
    firepower: clampNumber(mix(76 + tierBoost + styleBoost + roleBias + (seed % 15), roleBias), 68, 99),
    tacticalIQ: clampNumber(mix(74 + tierBoost + (seed % 12) + (role === "IGL" ? 9 : 0) + (role === "Support" ? 4 : 0), (role === "IGL" ? 6 : 0) - 2), 65, 99),
    clutch: clampNumber(mix(72 + tierBoost + (seed % 13) + (role === "Lurker" ? 5 : 0), -3), 65, 98),
    utility: clampNumber(mix(72 + tierBoost + (seed % 11) + (role === "Support" ? 11 : 0) + (role === "IGL" ? 5 : 0), (role === "Support" ? 6 : 0) - 3), 64, 99),
    form: clampNumber((Number(t.form)||100) + ((seed % 9)-4), 85, 115),
    morale: clampNumber(88 + ((seed % 15)-7), 60, 100),
    fatigue: clampNumber((Number(t.fatigue)||0) + (seed % 5), 0, 85)
  };
}
function ensurePlayerLayer(t){
  if (!t) return;
  const mappedNames = TEAM_ROSTER_2026[t.name] || [];
  const savedNames = Array.isArray(t.players) ? t.players.map(p=>p.nick).filter(Boolean) : [];
  const names = mappedNames.length ? mappedNames : savedNames;
  const used = [...new Set(names)];
  let i = 0;
  while (used.length < 5) { used.push(`Player${used.length+1}`); i++; if(i>20) break; }
  if (!Array.isArray(t.players) || t.players.length !== 5 || t.playerLayerVersion !== PLAYER_LAYER_VERSION) {
    t.players = used.slice(0,5).map((nick,idx)=>createPlayerFromNick(t,nick,idx));
  } else {
    t.players.forEach((p,idx)=>{
      const meta=PLAYER_META_2026[p.nick]||{};
      if(!p.realName && meta.realName) p.realName=meta.realName;
      if(!p.age) p.age=meta.age || null;
      if(!p.country) p.country=meta.country || "";
      if(!p.flag || (p.flag === "🌍" && p.country)) p.flag=p.country ? countryFlag(p.country) : "🌍";
      if(!p.language) p.language=meta.language || "—";
      if(!p.role) p.role=meta.role || defaultPlayerRole(idx);
      p.status = PLAYER_STATUS_2026[p.nick] || p.status || "STARTER";
      ["firepower","tacticalIQ","clutch","utility"].forEach(k=>{ if(p[k]===undefined) p[k]=createPlayerFromNick(t,p.nick,idx)[k]; });
      if(p.form===undefined) p.form=Number(t.form)||100;
      if(p.morale===undefined) p.morale=90;
      if(p.fatigue===undefined) p.fatigue=Number(t.fatigue)||0;
    });
  }
  const f = t.players.reduce((s,p)=>s+Number(p.form||100),0)/Math.max(1,t.players.length);
  const m = t.players.reduce((s,p)=>s+Number(p.morale||90),0)/Math.max(1,t.players.length);
  const fat = t.players.reduce((s,p)=>s+Number(p.fatigue||0),0)/Math.max(1,t.players.length);
  const cohesion = clampNumber(82 + (t.streak||0)*1.5 - Math.max(0, fat-15)*0.5, 55, 99);
  const chemistry = clampNumber((m*0.35) + (cohesion*0.65), 55, 99);
  const avg = k => t.players.reduce((s,p)=>s+Number(p[k]||0),0)/Math.max(1,t.players.length);
  const effectiveForm = t.players.map(p => clampNumber((Number(p.form)||100) + ((Number(p.morale)||90)-80)*0.10 - (Number(p.fatigue)||0)*0.08, 80, 120));
  const teamForm = effectiveForm.reduce((a,b)=>a+b,0)/effectiveForm.length;
  t.playerLayer = {
    firepower: Math.round(avg('firepower')*10)/10,
    tacticalIQ: Math.round(avg('tacticalIQ')*10)/10,
    clutch: Math.round(avg('clutch')*10)/10,
    utility: Math.round(avg('utility')*10)/10,
    form: Math.round(teamForm),
    morale: Math.round(m),
    fatigue: Math.round(fat),
    chemistry: Math.round(chemistry),
    cohesion: Math.round(cohesion),
    power: Math.round((avg('firepower')*0.40 + avg('tacticalIQ')*0.25 + avg('clutch')*0.20 + avg('utility')*0.15)*10)/10
  };
  t.playerLayerVersion = PLAYER_LAYER_VERSION;
  // Legacy fields remain the authoritative interface for the old simulation formulas.
  t.form = clampNumber(Math.round(t.playerLayer.form), 90, 110);
  t.fatigue = clampNumber(Math.round(t.playerLayer.fatigue), 0, 85);
}
function syncAllPlayerLayers(){ teams.forEach(ensurePlayerLayer); }
function changePlayers(t, delta={}){
  ensurePlayerLayer(t);
  t.players.forEach((p,idx)=>{
    const n = ((idx % 2) ? -1 : 1);
    if(delta.form) p.form = clampNumber(p.form + delta.form + n*0.5, 80, 120);
    if(delta.morale) p.morale = clampNumber(p.morale + delta.morale, 40, 100);
    if(delta.fatigue) p.fatigue = clampNumber(p.fatigue + delta.fatigue, 0, 85);
    if(delta.firepower) p.firepower = clampNumber(p.firepower + delta.firepower, 60, 100);
  });
  ensurePlayerLayer(t);
}
function resetPlayers(t){
  ensurePlayerLayer(t);
  t.players.forEach((p,idx)=>{ p.form=100; p.morale=92; p.fatigue=0; });
  ensurePlayerLayer(t);
}
function renderPlayerLayerHub(t){
  const root=document.getElementById('hltv-player-layer');
  if(!root || !t) return;
  ensurePlayerLayer(t);
  const skill = (label,val) => `<div class="player-skill-row"><span>${label}</span><span class="player-skill-bar"><span class="player-skill-fill" style="width:${Math.round(val)}%"></span></span><b>${Math.round(val)}</b></div>`;
  root.innerHTML = `
    <div class="player-layer-title"><span>👥 Player Layer · состав 2026</span><span>${t.players.length}/5 игроков</span></div>
    <div class="player-layer-grid">
      ${t.players.map(p=>{
        const initials=(p.nick||'?').slice(0,2).toUpperCase();
        const ageText = p.age ? `${p.age} лет` : 'возраст —';
        const statusText = p.status && p.status !== 'STARTER' ? ` · ${p.status}` : '';
        return `<div class="player-layer-card" title="${p.realName ? `${p.realName} · ${ageText} · ${p.language}${statusText}` : `${ageText} · ${p.language}${statusText}`}">
          <div class="player-layer-card-head"><div class="player-layer-avatar">${initials}</div><div class="player-layer-ident"><div class="player-layer-nick">${p.nick}</div><div class="player-layer-real">${p.realName || 'Имя не указано'}</div></div></div>
          <div class="player-layer-role">${ROLE_LABELS[p.role] || p.role}${statusText ? ` <span class="player-status-badge ${p.status==='STAND-IN'?'stand-in':''}">${p.status}</span>` : ''}</div>
          <div class="player-layer-meta"><span>${p.flag} ${p.age ? `${p.age}г.` : '—'}</span><span>${p.language}</span></div>
          ${skill('FIR',p.firepower)}${skill('TQ',p.tacticalIQ)}${skill('CLU',p.clutch)}${skill('UTL',p.utility)}
          <div class="player-dyn-row"><span class="player-dyn-pill form">F ${Math.round(p.form)}%</span><span class="player-dyn-pill morale">M ${Math.round(p.morale)}</span><span class="player-dyn-pill fatigue">FT ${Math.round(p.fatigue)}%</span></div>
        </div>`;
      }).join('')}
    </div>
    <div class="player-layer-summary">
      <div class="player-layer-summary-item form"><span class="k">Form</span><span class="v">${t.playerLayer.form}%</span></div>
      <div class="player-layer-summary-item morale"><span class="k">Morale</span><span class="v">${t.playerLayer.morale}</span></div>
      <div class="player-layer-summary-item fatigue"><span class="k">Fatigue</span><span class="v">${t.playerLayer.fatigue}%</span></div>
      <div class="player-layer-summary-item chem"><span class="k">Chemistry</span><span class="v">${t.playerLayer.chemistry}</span></div>
      <div class="player-layer-summary-item"><span class="k">Cohesion</span><span class="v">${t.playerLayer.cohesion}</span></div>
      <div class="player-layer-summary-item"><span class="k">Power</span><span class="v">${t.playerLayer.power}</span></div>
    </div>`;
}

function updateBroadcastLiveOdds(item) {
  const st = item?.state;
  const m = item?.match;
  if (!st || !m || st.finished) return;
  const baseOdds = calcMatchOdds(m.t1, m.t2, st.mode === 'BO1');
  let p1 = baseOdds ? baseOdds.p1_win : 0.5;
  const seriesDiff = (Number(st.series1) || 0) - (Number(st.series2) || 0);
  p1 += seriesDiff * 0.16;
  const currentMap = st.maps?.[st.mapIndex];
  if (currentMap) {
    const t1 = teams.find(t => t.name === m.t1);
    const t2 = teams.find(t => t.name === m.t2);
    const wr1 = Number(t1?.maps?.[currentMap]) || 50;
    const wr2 = Number(t2?.maps?.[currentMap]) || 50;
    p1 += ((wr1 - wr2) / 100) * 0.08;
  }
  const roundDiff = (Number(st.map1) || 0) - (Number(st.map2) || 0);
  const absDiff = Math.abs(roundDiff);
  const diffSign = Math.sign(roundDiff);
  p1 += roundDiff * 0.032;
  if (absDiff >= 5) p1 += diffSign * (absDiff - 4) * 0.05;
  const recentWinners = (st.mapRoundWinners || []).slice(-5);
  let streakSide = 0, streakCount = 0;
  for (let i = recentWinners.length - 1; i >= 0; i--) {
    if (i === recentWinners.length - 1) {
      streakSide = recentWinners[i];
      streakCount = 1;
    } else if (recentWinners[i] === streakSide) {
      streakCount++;
    } else break;
  }
  if (streakCount >= 3) {
    p1 += (streakSide === 1 ? 0.04 : -0.04);
  }
  p1 = Math.max(0.03, Math.min(0.97, p1));
  const p2 = 1 - p1;
  const margin = 0.94;
  st.lastOddsSnapshot = st.liveOdds ? {...st.liveOdds} : (baseOdds ? {c1:baseOdds.c1,c2:baseOdds.c2} : null);
  st.liveOdds = {
    c1: Math.max(1.03, Math.min(15.0, margin / p1)).toFixed(2),
    c2: Math.max(1.03, Math.min(15.0, margin / p2)).toFixed(2),
    p1: Math.round(p1 * 100),
    p2: Math.round(p2 * 100)
  };
}
function generateMapStats() {
  let stats = {};
  MAP_POOL.forEach(map => { stats[map] = Math.floor(Math.random() * 45) + 45; });
  return stats;
}

/* ---------- Rational Transfer Market ---------- */
const TRANSFER_STATE_KEY = 'cs2_transfer_market_v1';
const TRANSFER_STATE_VERSION = 1;
const HARD_IDENTITY_TEAMS = new Set(['Team Spirit','Virtus.pro','Aurora','BETBOOM','magic','K27','WW Team']);
const PORTUGUESE_IDENTITY_TEAMS = new Set(['FURIA','Legacy','MIBR','paiN','Imperial','Fluxo','Luminosity','Sashi','DENDELE']);
const FRENCH_IDENTITY_TEAMS = new Set(['Team Vitality','3DMAX','FOKUS']);
const DANISH_IDENTITY_TEAMS = new Set(['Astralis','HEROIC']);
const UKRAINIAN_IDENTITY_TEAMS = new Set(['NAVI','B8','PARIVISION']);
const CHINESE_IDENTITY_TEAMS = new Set(['TYLOO','Lynn Vision']);
const MONGOLIAN_IDENTITY_TEAMS = new Set(['The MongolZ']);
const TURKISH_IDENTITY_TEAMS = new Set(['FUT','Eternal Fire']);
const SPANISH_IDENTITY_TEAMS = new Set(['Iberian Soul']);
const SWEDISH_IDENTITY_TEAMS = new Set(['NIP','Johnny Speeds','EYEBALLERS']);
const POLISH_IDENTITY_TEAMS = new Set(['Inner Circle']);
const INTERNATIONAL_TEAMS = new Set(['Team Falcons','G2','MOUZ','FAZE','Team Liquid','Liquid','BIG','GamerLegion','Alliance','100 Thieves','NRG','BC.GAME','OG','OG']);
const TRANSFER_EVENTS = [];

function loadTransferState(){
  try{
    const raw=localStorage.getItem(TRANSFER_STATE_KEY);
    if(raw){
      const st=JSON.parse(raw);
      if(st && st.version===TRANSFER_STATE_VERSION) return st;
    }
  }catch(e){}
  return {version:TRANSFER_STATE_VERSION, marketRuns:0, cooldown:0, history:[], freeAgents:[], lastEvent:null};
}
function saveTransferState(){ try{ localStorage.setItem(TRANSFER_STATE_KEY, JSON.stringify(transferState)); }catch(e){} }
function transferLog(text, type='info'){
  const item={text, type, season:seasonState?.currentSeason||1, tournament:seasonState?.tournamentIndex||1, ts:Date.now()};
  transferState.history.unshift(item);
  transferState.history=transferState.history.slice(0,120);
  transferState.lastEvent=item;
}
function playerLangGroup(p){
  const lang=String(p?.language||'').toLowerCase();
  const c=String(p?.country||'').toUpperCase();
  if(lang.includes('russian')||['RU','BY','KZ'].includes(c)) return 'russian';
  if(lang.includes('portuguese')||c==='BR') return 'portuguese';
  if(lang.includes('french')||c==='FR') return 'french';
  if(lang.includes('danish')||c==='DK') return 'danish';
  if(lang.includes('ukrainian')||c==='UA') return 'ukrainian';
  if(lang.includes('chinese')||c==='CN') return 'chinese';
  if(lang.includes('mongolian')||c==='MN') return 'mongolian';
  if(lang.includes('turkish')||c==='TR') return 'turkish';
  if(lang.includes('spanish')||c==='ES'||c==='AR') return 'spanish';
  if(lang.includes('swedish')||c==='SE') return 'swedish';
  if(lang.includes('polish')||c==='PL') return 'polish';
  return 'english';
}
function teamIdentityGroup(t){
  const n=t?.name||'';
  if(HARD_IDENTITY_TEAMS.has(n)) return 'russian';
  if(PORTUGUESE_IDENTITY_TEAMS.has(n)) return 'portuguese';
  if(FRENCH_IDENTITY_TEAMS.has(n)) return 'french';
  if(DANISH_IDENTITY_TEAMS.has(n)) return 'danish';
  if(UKRAINIAN_IDENTITY_TEAMS.has(n)) return 'ukrainian';
  if(CHINESE_IDENTITY_TEAMS.has(n)) return 'chinese';
  if(MONGOLIAN_IDENTITY_TEAMS.has(n)) return 'mongolian';
  if(TURKISH_IDENTITY_TEAMS.has(n)) return 'turkish';
  if(SPANISH_IDENTITY_TEAMS.has(n)) return 'spanish';
  if(SWEDISH_IDENTITY_TEAMS.has(n)) return 'swedish';
  if(POLISH_IDENTITY_TEAMS.has(n)) return 'polish';
  if(INTERNATIONAL_TEAMS.has(n)) return 'international';
  const flag=getTeamFlag(n);
  const map={'🇷🇺':'russian','🇧🇷':'portuguese','🇫🇷':'french','🇩🇰':'danish','🇺🇦':'ukrainian','🇨🇳':'chinese','🇲🇳':'mongolian','🇹🇷':'turkish','🇪🇸':'spanish','🇵🇹':'portuguese','🇸🇪':'swedish'};
  return map[flag]||'international';
}
function teamIdentityFit(t,p){
  const tg=teamIdentityGroup(t), pg=playerLangGroup(p);
  if(tg==='international') return pg==='english' ? 1 : (['russian','portuguese','french','danish','ukrainian','spanish','swedish'].includes(pg)?0.72:0.55);
  if(tg===pg) return 1;
  const bilingual=String(p?.language||'').toLowerCase().includes('english');
  if(bilingual && ['russian','portuguese','french','danish','ukrainian','spanish','swedish'].includes(tg)) return 0.55;
  return 0.12;
}
function teamRankValue(t){ return Number(t?.pts)||500; }
function isStarPlayer(p){ return (Number(p?.firepower)||0)+(Number(p?.tacticalIQ)||0)+(Number(p?.clutch)||0)+(Number(p?.utility)||0) >= 365; }
function playerPower(p){ return Number(p?.firepower||0)*0.40 + Number(p?.tacticalIQ||0)*0.25 + Number(p?.clutch||0)*0.20 + Number(p?.utility||0)*0.15; }
function teamNeedsTransfer(t){
  ensurePlayerLayer(t);
  const lowForm=t.players.filter(p=>Number(p.form||100)<92).length;
  const losses=Math.abs(Math.min(0, Number(t.streak)||0));
  const majorFail=!!(currentTournament?.isMajor && currentTournament?.placements?.[t.name] && Number(currentTournament.placements[t.name].place)>8);
  const tier1=teamRankValue(t)>=820;
  return {trigger:(majorFail&&tier1)||losses>=4||(tier1&&lowForm>=2)||Number(t.fatigue||0)>=62, majorFail, losses, lowForm, tier1};
}
function playerWillAccept(p, fromTeam, toTeam){
  const fromPts=teamRankValue(fromTeam), toPts=teamRankValue(toTeam);
  const fit=teamIdentityFit(toTeam,p);
  if(fit<0.50) return false;
  if(isStarPlayer(p) && toPts < fromPts-50) return false;
  if(isStarPlayer(p) && toPts < fromPts && (Number(fromTeam.streak||0)>=3) && Number(fromTeam.fatigue||0)<55) return false;
  const career=Number(p.form||100) + Number(p.morale||90)*0.12;
  if(toPts < fromPts-120 && career>108) return false;
  return true;
}
function generateFreeAgent(teamHint, roleHint, seedOffset=0){
  const group=teamIdentityGroup(teamHint);
  const pools={
    russian:['Jerry','k0mplex','n0vice','fak3r','m1nor'], portuguese:['dreampy','n3gro','Kawz','deco','pH'],
    french:['Mistery','bodyz','Lucky7','Razz','neon'], danish:['sik','madsen','JDC2','krux','nova'],
    ukrainian:['r1ver','s0ul','K1rill','nex1','v1ktor'], chinese:['Monk','sk0re','Lazuli','Kaze','Ming'],
    mongolian:['Khosoo','sodbayar','Temu','Batu','Erdene'], turkish:['qw1n','Xerxes','paz2','Mert','cN'],
    spanish:['nixer','Matti','Soto','Raku','l0pez'], swedish:['frosty','Eken','Malm','Kryo','Nils'], polish:['Raven','michu2','Kaczor','Luker','Vex'],
    international:['Nilo','Revv','Meyzo','Karma','Slate']
  };
  const arr=pools[group]||pools.international;
  const nick=arr[(hashTeamName((teamHint?.name||'')+String(seedOffset))+seedOffset)%arr.length];
  const role=roleHint || ROLE_POOL[(hashTeamName(nick)+seedOffset)%ROLE_POOL.length];
  const identityMeta={
    russian:{country:'RU',language:'Russian'}, portuguese:{country:'BR',language:'Portuguese/English'},
    french:{country:'FR',language:'French/English'}, danish:{country:'DK',language:'Danish/English'},
    ukrainian:{country:'UA',language:'Ukrainian/English'}, chinese:{country:'CN',language:'Chinese/English'},
    mongolian:{country:'MN',language:'Mongolian/English'}, turkish:{country:'TR',language:'Turkish/English'},
    spanish:{country:'ES',language:'Spanish/English'}, swedish:{country:'SE',language:'Swedish/English'},
    polish:{country:'PL',language:'Polish/English'}, international:{country:'US',language:'English'}
  }[group] || {country:'US',language:'English'};
  const fake={name:teamHint?.name||'',pts:teamHint?.pts||600,form:100};
  const p=createPlayerFromNick(fake,nick,seedOffset%5);
  p.country=identityMeta.country; p.language=identityMeta.language; p.flag=countryFlag(p.country);
  p.role=role; p.status='FREE AGENT';
  p.firepower=clampNumber(p.firepower-2,65,96); p.tacticalIQ=clampNumber(p.tacticalIQ-1,64,96); p.clutch=clampNumber(p.clutch-1,64,96); p.utility=clampNumber(p.utility-1,64,96);
  p.form=clampNumber(97+((seedOffset%7)-3),85,112); p.morale=clampNumber(83+((seedOffset%11)-5),55,100); p.fatigue=0;
  return p;
}
function ensureFreeAgentPool(){
  if(!Array.isArray(transferState.freeAgents)) transferState.freeAgents=[];
  const groups=['russian','portuguese','french','danish','ukrainian','international'];
  // v33: сначала реальные игроки без клуба, которых нет ни в одном составе
  const taken=new Set([...teams.flatMap(t=>(t.players||[]).map(p=>String(p.nick).toLowerCase())),...transferState.freeAgents.map(p=>String(p.nick).toLowerCase())]);
  for(const nick of ((window.CS2_REAL&&window.CS2_REAL.freeAgents)||[])){
    if(transferState.freeAgents.length>=10) break;
    if(taken.has(nick.toLowerCase()) || (transferState.retired||[]).some(r=>r && (r.nick||r)===nick)) continue;
    const meta=PLAYER_META_2026[nick]||{}, p=createPlayerFromNick({name:'FA',pts:620,form:100},nick,transferState.freeAgents.length%5);
    p.role=meta.role||p.role; p.status='FREE AGENT'; p.fatigue=0; transferState.freeAgents.push(p); taken.add(nick.toLowerCase());
  }
  while(transferState.freeAgents.length<10){
    const fakeTeam={name:`FA-${transferState.freeAgents.length}`,pts:520,style:'Tactical'};
    const p=generateFreeAgent(fakeTeam,null,transferState.freeAgents.length+11);
    p.language=groups[(transferState.freeAgents.length)%groups.length]==='international'?'English':p.language;
    transferState.freeAgents.push(p);
  }
}
function findCompatibleFreeAgent(team, outPlayer){
  ensureFreeAgentPool();
  let best=null, bestScore=-999;
  transferState.freeAgents.forEach((p,idx)=>{
    const fit=teamIdentityFit(team,p);
    const roleFit=p.role===outPlayer?.role?8:0;
    const skill=Math.max(0,playerPower(p)-playerPower(outPlayer||p));
    const score=fit*100+roleFit+skill-idx*0.1;
    if(fit>=0.55 && score>bestScore){best={p,idx};bestScore=score;}
  });
  return best;
}
function applyPlayerTransfer(fromTeam, toTeam, player, reason){
  if(!fromTeam||!toTeam||!player) return false;
  ensurePlayerLayer(fromTeam); ensurePlayerLayer(toTeam);
  const outIdx=fromTeam.players.findIndex(p=>p.nick===player.nick);
  if(outIdx<0) return false;
  const targetOut=[...toTeam.players].filter(p=>p.status==='STARTER').sort((a,b)=>playerPower(a)-playerPower(b))[0];
  if(!targetOut) return false;
  if(!playerWillAccept(player,fromTeam,toTeam)) return false;
  const fa=findCompatibleFreeAgent(fromTeam,targetOut);
  if(!fa) return false;
  const replacement=JSON.parse(JSON.stringify(fa.p));
  replacement.status='STARTER';
  replacement.language=replacement.language||'English';
  replacement.morale=clampNumber(replacement.morale+4,40,100);
  replacement.fatigue=clampNumber(replacement.fatigue,0,25);
  const transferred=JSON.parse(JSON.stringify(player));
  transferred.status='STARTER';
  toTeam.players[toTeam.players.findIndex(p=>p.nick===targetOut.nick)] = transferred;
  fromTeam.players[outIdx] = replacement;
  transferState.freeAgents.splice(fa.idx,1);
  targetOut.status='FREE AGENT';
  transferState.freeAgents.push(targetOut);
  ensurePlayerLayer(fromTeam); ensurePlayerLayer(toTeam);
  fromTeam.rosterLastChange={type:'IN', player:replacement.nick, from:'Free Agent', reason};
  toTeam.rosterLastChange={type:'IN', player:transferred.nick, from:fromTeam.name, reason};
  transferLog(`🔁 ${transferred.nick} перешёл из ${fromTeam.name} в ${toTeam.name}; ${targetOut.nick} ушёл на рынок. Причина: ${reason}.`,'transfer');
  return true;
}
function maybeTransferCoach(t, triggerInfo){
  if(!t||!triggerInfo?.trigger) return false;
  ensurePlayerLayer(t);
  const coach=t.coach||generateCoach(t.name);
  const styleMismatch = (t.style==='Aggressive' && /tactical|defensive|discipline/i.test(String(coach.name))) || (t.style==='Tactical' && /aggressive|aim/i.test(String(coach.name)));
  if(!styleMismatch && triggerInfo.losses<5) return false;
  if(Math.random()>0.12) return false;
  const pool=[
    {name:'mithy',flag:'🇪🇸',fit:['Tactical','Discipline']},{name:'zonic',flag:'🇩🇰',fit:['Discipline','Tactical']},
    {name:'XTQZZZ',flag:'🇫🇷',fit:['Tactical','Aggressive']},{name:'B1ad3',flag:'🇺🇦',fit:['Tactical','Discipline']},
    {name:'hades',flag:'🇵🇱',fit:['Aggressive','Chaos']},{name:'ash',flag:'🇷🇺',fit:['Aggressive','Chaos']}
  ];
  const fit=pool.filter(x=>x.name!==coach.name).filter(x=>x.fit.includes(t.style));
  if(!fit.length) return false;
  const next=fit[(hashTeamName(t.name)+seasonState.currentSeason+seasonState.tournamentIndex)%fit.length];
  t.coach={name:next.name,flag:next.flag,changedAtSeason:seasonState.currentSeason};
  t.rosterLastChange={type:'COACH',player:next.name,from:coach.name,reason:'расхождение в тактическом стиле'};
  transferLog(`🧠 ${t.name} сменили тренера: ${coach.name} → ${next.name} (${triggerInfo.majorFail?'провал турнира':'тактическое расхождение'}).`,'coach');
  return true;
}
function applyTemporaryStandIn(t, reason){
  if(!t || t.tempStandIn) return false;
  ensurePlayerLayer(t);
  const candidate=[...t.players].sort((a,b)=>Number(b.fatigue||0)-Number(a.fatigue||0))[0];
  if(!candidate) return false;
  const free=findCompatibleFreeAgent(t,candidate);
  if(!free) return false;
  const replacement=JSON.parse(JSON.stringify(free.p)); replacement.status='STAND-IN'; replacement.isStandIn=true; replacement.standInReason=reason;
  t.tempStandIn={original:JSON.parse(JSON.stringify(candidate)), reason, returnAfterTournament:true};
  const idx=t.players.findIndex(p=>p.nick===candidate.nick);
  t.players[idx]=replacement;
  transferState.freeAgents.splice(free.idx,1);
  candidate.status='BENCH'; transferState.freeAgents.push(candidate);
  ensurePlayerLayer(t);
  t.rosterLastChange={type:'STAND-IN',player:replacement.nick,from:candidate.nick,reason};
  transferLog(`🛡️ ${t.name}: ${candidate.nick} временно заменён на ${replacement.nick} (${reason}).`,'standin');
  return true;
}
function restoreTemporaryStandIn(t){
  if(!t?.tempStandIn?.original) return;
  const replacement=t.players.find(p=>p.isStandIn);
  const original=JSON.parse(JSON.stringify(t.tempStandIn.original));
  if(replacement){
    const idx=t.players.findIndex(p=>p.nick===replacement.nick);
    t.players[idx]=original;
    t.players[idx].status='STARTER';
    const fa=transferState.freeAgents.findIndex(p=>p.nick===original.nick);
    if(fa>=0) transferState.freeAgents.splice(fa,1);
    if(replacement.status!=='STARTER') { replacement.status='FREE AGENT'; transferState.freeAgents.push(replacement); }
  }
  t.tempStandIn=null;
  ensurePlayerLayer(t);
}
function processTransferMarket(reason='tournament_end'){
  ensureFreeAgentPool();
  if(transferState.cooldown>0){ transferState.cooldown--; saveTransferState(); return; }
  const candidates=[];
  teams.forEach(t=>{
    const info=teamNeedsTransfer(t);
    if(info.trigger) candidates.push({t,info});
  });
  candidates.sort((a,b)=>teamRankValue(b.t)-teamRankValue(a.t));
  let moved=0;
  for(const target of candidates){
    if(moved>=((currentTournament?.isMajor)?2:1)) break;
    const to=target.t;
    ensurePlayerLayer(to);
    const weak=[...to.players].filter(p=>p.status==='STARTER').sort((a,b)=>playerPower(a)-playerPower(b))[0];
    if(!weak) continue;
    let best=null,bestScore=0;
    for(const from of teams){
      if(from===to || teamRankValue(from)>=teamRankValue(to)+10) continue;
      ensurePlayerLayer(from);
      from.players.filter(p=>p.status==='STARTER').forEach(p=>{
        const fit=teamIdentityFit(to,p);
        if(fit<0.6 || !playerWillAccept(p,from,to)) return;
        const improvement=playerPower(p)-playerPower(weak);
        if(improvement<2.5) return;
        const score=improvement + fit*5 + Math.max(0, teamRankValue(to)-teamRankValue(from))/100;
        if(score>bestScore){bestScore=score;best={from,p};}
      });
    }
    if(best && applyPlayerTransfer(best.from,to,best.p, target.info.majorFail?'после провала на Major':(target.info.losses>=4?'серия поражений':'необходимость усиления'))) moved++;
    maybeTransferCoach(to,target.info);
    if(target.info.losses>=5 && !to.tempStandIn && Math.random()<0.25) applyTemporaryStandIn(to,'глубокий кризис результатов');
  }
  teams.forEach(t=>{ ensurePlayerLayer(t); if(t.tempStandIn && !currentTournament?.completed) restoreTemporaryStandIn(t); });
  if(moved===0 && candidates.length){ transferLog(`📋 Трансферный рынок проверен: подходящих переходов не найдено.`,'market'); }
  transferState.cooldown=1;
  transferState.marketRuns++;
  saveTransferState(); saveTeams();
}
function loadSeasonState() {
  const keys = ["cs2_season_state_v61", "cs2_season_state_v60"];
  for (let k of keys) {
    const saved = localStorage.getItem(k);
    if (saved) {
      try {
        let p = JSON.parse(saved);
        p.maxTournaments = Number.isFinite(Number(p.maxTournaments)) && Number(p.maxTournaments) > 10 ? Number(p.maxTournaments) : 9999;
        if (!p.h2h) p.h2h = {};
        if (!p.pickemScore) p.pickemScore = 0;
        if (!p.seasonSchedule) p.seasonSchedule = [];
        if (!p.mapPicksHistory) p.mapPicksHistory = {};
        if (!p.tournamentHistory) p.tournamentHistory = [];
        if (!p.eras) p.eras = {};
        return p;
      } catch(e) {}
    }
  }
  return {
    currentSeason: 1, tournamentIndex: 1, maxTournaments: 9999, hallOfFame: [],
    h2h: {}, pickemScore: 0, seasonSchedule: [], mapPicksHistory: {}, tournamentHistory: [], eras: {}, mapStatsSeason: 1
  };
}
function loadTeams() {
  const keys = ["cs2_season_teams_v61", "cs2_season_teams_v60"];
  let parsed = null;
  for (let k of keys) {
    const saved = localStorage.getItem(k);
    if (saved) {
      try {
        parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) break;
      } catch(e) {}
    }
  }
  if (!parsed || !Array.isArray(parsed) || parsed.length === 0) {
    parsed = JSON.parse(JSON.stringify(DEFAULT_TEAMS));
  }
  parsed.forEach(t => {
    if (t.streak === undefined) t.streak = 0;
    if (!t.maps) t.maps = generateMapStats();
    if (!t.mapPickHistory) t.mapPickHistory = {};
    if (!t.mapStats || t.mapStatsVersion !== 2) {
      t.mapStats = {};
      MAP_POOL.forEach(map => {
        const wr = Math.max(35, Math.min(95, Number(t.maps?.[map]) || 50));
        const games = 20;
        const wins = games * wr / 100;
        t.mapStats[map] = { wins, losses: games - wins };
      });
      t.mapStatsVersion = 2;
    }
    if (!t.mapHistory) t.mapHistory = [];
    if (!t.history) t.history = [];
    if (!t.style) t.style = PLAYSTYLES[Math.floor(Math.random() * PLAYSTYLES.length)];
    if (t.form === undefined) t.form = Math.floor(Math.random() * 7) + 97;
    t.form = Math.round(Math.max(90, Math.min(110, Number(t.form) || 100)));
    if (t.fatigue === undefined) t.fatigue = 0;
    if (t.prevRank === undefined) t.prevRank = null;
    if (t.lastBootcampSeason === undefined) t.lastBootcampSeason = 0;
    if (!t.trophies) t.trophies = { majors: 0, elite: 0, regular: 0, grandFinalsWon: 0 };
    if (!t.activeModifier) t.activeModifier = null;
    if (t.seasonStartRank === undefined) t.seasonStartRank = null;
    if (t.seasonChampionships === undefined) t.seasonChampionships = 0;
    if (t.playerLayerVersion !== PLAYER_LAYER_VERSION) {
      const rosterNames = TEAM_ROSTER_2026[t.name];
      if (rosterNames) t.players = rosterNames.slice(0,5).map((nick,idx)=>createPlayerFromNick(t,nick,idx));
      t.playerLayerVersion = PLAYER_LAYER_VERSION;
    }
    ensurePlayerLayer(t);
    if (!t.coach) t.coach = COACHES_2026[t.name] || { name: 'coach', flag: getTeamFlag(t.name) };
  });
  const ratingMigrationKey = "cs2_rating_balance_v4_applied";
  if (localStorage.getItem(ratingMigrationKey) !== "1") {
    const hasInflatedRatings = parsed.some(t => Number(t.pts) > 1100 || Number(t.pts) < 150);
    if (hasInflatedRatings) {
      parsed.forEach(t => {
        const old = Number(t.pts) || 800;
        t.pts = Math.round(Math.max(450, Math.min(1050, 750 + (old - 750) * 0.55)));
        t.form = Math.round(Math.max(90, Math.min(110, Number(t.form) || 100)));
        t.fatigue = Math.round(Math.max(0, Math.min(30, Number(t.fatigue) || 0)));
      });
    }
    try { localStorage.setItem(ratingMigrationKey, "1"); } catch(e) {}
  }
  parsed.forEach(ensurePlayerLayer);
  return parsed;
}
function resetSeasonMapStatsIfNeeded() {
  if (!seasonState) return;
  if (seasonState.mapStatsSeason === seasonState.currentSeason) return;
  teams.forEach(t => {
    t.maps = generateMapStats();
    t.mapStats = {};
    t.mapHistory = [];
    MAP_POOL.forEach(map => {
      const wr = Math.max(35, Math.min(95, Number(t.maps?.[map]) || 50));
      const games = 20;
      const wins = games * wr / 100;
      t.mapStats[map] = { wins, losses: games - wins };
    });
    t.mapPickHistory = {};
  });
  seasonState.mapStatsSeason = seasonState.currentSeason;
  try {
    localStorage.setItem("cs2_season_state_v61", JSON.stringify(seasonState));
    localStorage.setItem("cs2_season_teams_v61", JSON.stringify(teams));
  } catch(e) {}
}
let seasonState = loadSeasonState();
let teams = loadTeams();
let transferState = loadTransferState();
ensureFreeAgentPool();
resetSeasonMapStatsIfNeeded();
let selectedTeamForDetails = null;
let currentTournament = null;
let currentPickem = {
  major:{stages:{},playoffs:{qf:[],sf:[],champion:null}},
  regular:null
};
let isStepSimRunning = false;
let isTVModeRunning = false;
let tvPlaybackSpeed = 1.2;
let tvPlaybackPaused = false;
let simulationRunToken = 0;
const pendingBroadcastLaunches = new Set();
let activeStepTimeout = null;
let isFastSimRunning = false;
let stopRequested = false;
let activeMatchSimAbort = false;
let broadcastDetailViewing = false;
let manualFieldProfileOverride = null;
let broadcastDetailMatchId = null;
let pendingManualMatch = null;
let activeManualMatch = null;
let activeMatchPauseState = { t1Pauses: 3, t2Pauses: 3, activeTeam: null, turnsLeft: 0, overtimeStage: 0 };
function getH2HKey(t1, t2) { return [t1, t2].sort().join(" vs "); }
function recordH2HWin(winner, loser) {
  if (!seasonState.h2h) seasonState.h2h = {};
  const key = getH2HKey(winner, loser);
  if (!seasonState.h2h[key]) seasonState.h2h[key] = {};
  seasonState.h2h[key][winner] = (seasonState.h2h[key][winner] || 0) + 1;
}
function getTeamH2HSummary(teamName) {
  if (!seasonState.h2h) return { totalWins: 0, totalLosses: 0, list: [] };
  let list = [];
  let totalWins = 0, totalLosses = 0;
  for (let key in seasonState.h2h) {
    if (key.includes(teamName)) {
      const parts = key.split(" vs ");
      const rival = parts[0] === teamName ? parts[1] : parts[0];
      const wins = seasonState.h2h[key][teamName] || 0;
      const rivalWins = seasonState.h2h[key][rival] || 0;
      if (wins > 0 || rivalWins > 0) {
        list.push({ rival, wins, rivalWins, total: wins + rivalWins });
        totalWins += wins;
        totalLosses += rivalWins;
      }
    }
  }
  list.sort((a, b) => b.total - a.total);
  return { totalWins, totalLosses, list };
}
function toggleH2HDetails() {
  const box = document.getElementById("h2h-scroll-details");
  const btn = document.getElementById("h2h-toggle-btn");
  if (!box) return;
  if (box.style.display === "none" || box.style.display === "") {
    box.style.display = "block";
    btn.innerText = "Скрыть список";
  } else {
    box.style.display = "none";
    btn.innerText = "Показать детально";
  }
}
function shuffleArray(arr) {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}
function getTournamentFieldProfile(tourIndex, prestige = "regular", explicitProfile = null) {
  if (explicitProfile && ["open", "elite", "medium", "weak", "major"].includes(explicitProfile)) {
    return explicitProfile;
  }
  if (prestige === "major") return "major";
  if (prestige === "elite") return "elite";
  if (tourIndex === 2 || tourIndex === 5) return "medium";
  if (tourIndex === 7) return "weak";
  return "open";
}
function fieldProfileLabel(profile) {
  switch (profile) {
    case "medium": return "🎯 Турнир средних команд";
    case "weak": return "🟢 Турнир слабых команд";
    case "elite": return "🔥 Сильный состав";
    case "major": return "⭐ Топ-32";
    default: return "🌍 Открытый состав";
  }
}
function getTournamentPointMultiplier(profile = currentTournament?.fieldProfile) {
  if (profile === "medium") return 0.65;
  if (profile === "weak") return 0.45;
  return 1.0;
}
function getFieldStrengthMultiplier() {
  const participants = currentTournament?.participants || [];
  if (!participants.length || !teams.length) return 1.0;
  const fieldAvg = participants.reduce((s, name) => s + (Number(getTeamCurrentPts(name)) || 600), 0) / participants.length;
  const poolAvg = teams.reduce((s, t) => s + (Number(t.pts) || 600), 0) / teams.length;
  if (!poolAvg) return 1.0;
  const ratio = fieldAvg / poolAvg;
  return Math.max(0.7, Math.min(1.5, ratio));
}
function fieldProfilePointsLabel(profile) {
  const mult = getTournamentPointMultiplier(profile);
  return mult < 1 ? `Очки ×${mult.toFixed(2)}` : "Очки ×1.00";
}
function weightedPickNoReplacement(sortedPool, count) {
  const pool = sortedPool.slice();
  const picked = [];
  const n = Math.min(count, pool.length);
  for (let k = 0; k < n; k++) {
    let totalWeight = 0;
    const weights = pool.map((_, idx) => { const w = 1 / (idx + 1); totalWeight += w; return w; });
    let r = Math.random() * totalWeight;
    let chosenIdx = pool.length - 1;
    for (let i = 0; i < weights.length; i++) {
      r -= weights[i];
      if (r <= 0) { chosenIdx = i; break; }
    }
    picked.push(pool.splice(chosenIdx, 1)[0]);
  }
  return picked;
}
function buildTournamentRoster(size, profile = "open") {
  const all = shuffleArray(teams);
  if (all.length <= size) return all;
  const ranked = [...teams].sort((a, b) => (b.pts || 0) - (a.pts || 0));
  const strongCount = Math.max(1, Math.min(20, Math.round(ranked.length * 0.18)));
  const weakCount = Math.max(1, Math.floor(ranked.length * 0.25));
  const strong = ranked.slice(0, strongCount);
  const weak = ranked.slice(ranked.length - weakCount);
  const middle = ranked.slice(strongCount, ranked.length - weakCount);
  const ratios = {
    open:   { strong: 0.45, medium: 0.40, weak: 0.15 },
    elite:  { strong: 0.60, medium: 0.32, weak: 0.08 },
    medium: { strong: 0.05, medium: 0.80, weak: 0.15 },
    weak:   { strong: 0.00, medium: 0.25, weak: 0.75 }
  }[profile] || { strong: 0.45, medium: 0.40, weak: 0.15 };
  const target = {
    strong: Math.round(size * ratios.strong),
    medium: Math.round(size * ratios.medium),
    weak: Math.round(size * ratios.weak)
  };
  let counts = { strong: target.strong, medium: target.medium, weak: target.weak };
  let total = counts.strong + counts.medium + counts.weak;
  while (total > size) {
    const key = ["strong", "medium", "weak"].sort((a,b) => counts[b] - counts[a])[0];
    if (counts[key] > 0) { counts[key]--; total--; } else break;
  }
  while (total < size) {
    const key = ["medium", "strong", "weak"]
      .sort((a,b) => (target[b] - counts[b]) - (target[a] - counts[a]))[0];
    counts[key]++; total++;
  }
  const bandPick = (pool, count) => shuffleArray(pool).slice(0, Math.min(count, pool.length));
  let chosen = [
    ...weightedPickNoReplacement(strong, counts.strong),
    ...bandPick(middle, counts.medium),
    ...bandPick(weak, counts.weak)
  ];
  const chosenNames = new Set(chosen.map(t => t.name));
  if (chosen.length < size) {
    shuffleArray(all).forEach(t => {
      if (chosen.length >= size) return;
      if (!chosenNames.has(t.name)) {
        chosen.push(t);
        chosenNames.add(t.name);
      }
    });
  }
  return shuffleArray(chosen).slice(0, size);
}
function applySeasonFieldProfiles() {
  if (!Array.isArray(seasonState.seasonSchedule)) return false;
  if (seasonState.seasonSchedule.length >= 14) return false; // v23: расписание v21 не переименовываем
  let changed = false;
  const forced = { 2: "medium", 5: "medium", 7: "weak" };
  const mediumNames = [
    "Challenger Circuit: Rising Teams",
    "Contenders Cup",
    "Rising Stars Championship",
    "Challenger League Finals",
    "Mid-Tier Masters",
    "Regional Contenders Clash"
  ];
  const weakNames = [
    "Open Challenger Cup",
    "Rookie Clash",
    "Open Series Finals",
    "Rising Open Championship",
    "Entry League Cup"
  ];
  seasonState.seasonSchedule.forEach((step, idx) => {
    if (!step || idx === 0) return;
    const expected = forced[idx] || (step.type === "major" ? "major" : step.type === "elite" ? "elite" : "open");
    if (step.fieldProfile !== expected) {
      step.fieldProfile = expected;
      changed = true;
    }
    if (idx === 2 && !mediumNames.some(n => String(step.name || "").startsWith(n))) {
      step.name = `${mediumNames[(seasonState.currentSeason + idx) % mediumNames.length]} ${2026 + (seasonState.currentSeason - 1)}`;
      changed = true;
    }
    if (idx === 5 && !mediumNames.some(n => String(step.name || "").startsWith(n))) {
      step.name = `${mediumNames[(seasonState.currentSeason + idx + 1) % mediumNames.length]} ${2026 + (seasonState.currentSeason - 1)}`;
      changed = true;
    }
    if (idx === 7 && !weakNames.some(n => String(step.name || "").startsWith(n))) {
      step.name = `${weakNames[(seasonState.currentSeason + idx) % weakNames.length]} ${2026 + (seasonState.currentSeason - 1)}`;
      changed = true;
    }
  });
  return changed;
}
const MEDIUM_TOURNAMENT_NAMES = [
  "Challenger Circuit: Rising Teams",
  "Contenders Cup",
  "Rising Stars Championship",
  "Challenger League Finals",
  "Mid-Tier Masters",
  "Regional Contenders Clash"
];
const WEAK_TOURNAMENT_NAMES = [
  "Open Challenger Cup",
  "Rookie Clash",
  "Open Series Finals",
  "Rising Open Championship",
  "Entry League Cup"
];
function generateDynamicSeasonSchedule() {
  const currentYear = 2026 + (seasonState.currentSeason - 1);
  const regPool = [...TOUR_DATABASE.regular].sort(() => Math.random() - 0.5);
  const elitePool = [...TOUR_DATABASE.elite].sort(() => Math.random() - 0.5);
  const majorPool = [...TOUR_DATABASE.major].sort(() => Math.random() - 0.5);
  const bountyPool = [...TOUR_DATABASE.bounty].sort(() => Math.random() - 0.5);
  const mediumPool = shuffleArray(MEDIUM_TOURNAMENT_NAMES);
  const weakPool = shuffleArray(TOUR_DATABASE.weak);
  let schedule = [];
  schedule[1]  = { type: "regular", name: `${regPool[0]} ${currentYear}`, min: 250, max: 2000, size: 16, format: "single", fieldProfile: "open" };
  schedule[2]  = { type: "regular", name: `${mediumPool[0]} ${currentYear}`, min: 350, max: 1500, size: 16, format: "gsl", fieldProfile: "medium" };
  schedule[3]  = { type: "elite",   name: `${elitePool[0]} ${currentYear}`, min: 450, max: 2000, size: 16, format: "double", fieldProfile: "elite" };
  schedule[4]  = { type: "elite",   name: `${bountyPool[0]} ${currentYear}`, min: 350, max: 2000, size: 32, format: "bounty", fieldProfile: "elite" };
  schedule[5]  = { type: "regular", name: `${mediumPool[1] || mediumPool[0]} ${currentYear}`, min: 350, max: 1500, size: 16, format: "gsl", fieldProfile: "medium" };
  schedule[6]  = { type: "elite",   name: `${elitePool[1]} ${currentYear}`, min: 500, max: 2000, size: 16, format: "double", fieldProfile: "elite" };
  schedule[7]  = { type: "regular", name: `${weakPool[0]} ${currentYear}`, min: 150, max: 950, size: 8, format: "single", fieldProfile: "weak" };
  schedule[8]  = { type: "elite",   name: `${elitePool[2]} ${currentYear}`, min: 550, max: 2000, size: 16, format: "swiss", fieldProfile: "elite" };
  schedule[9]  = { type: "regular", name: `${regPool[5]} ${currentYear}`, min: 250, max: 2000, size: 16, format: "single", fieldProfile: "open" };
  schedule[10] = { type: "major",   name: `${majorPool[0]} ${currentYear}`, min: 500, max: 2000, size: 16, format: "swiss", fieldProfile: "major" };
  seasonState.seasonSchedule = schedule;
  applySeasonFieldProfiles();
}
function saveSeasonState() {
  seasonState.maxTournaments = 9999;
  localStorage.setItem("cs2_season_state_v61", JSON.stringify(seasonState));
  renderSeasonBanner();
  updateAnalyticsDashboard();
}
function updateAnalyticsDashboard() {
  let sorted = [...teams].sort((a, b) => b.pts - a.pts);
  let dominant = sorted[0];
  document.getElementById("dash-dominant").innerHTML = dominant ?
    `<b>${dominant.name}</b> <span style="color:var(--accent); font-size:10px;">(${dominant.pts} pts)</span>` : "—";
  let activeErasList = [];
  if (seasonState.eras) {
    for (let teamName in seasonState.eras) {
      if (seasonState.eras[teamName].active) activeErasList.push(teamName);
    }
  }
  document.getElementById("dash-era").innerHTML = activeErasList.length > 0 ?
    `<span style="color:var(--era); font-weight:bold;">🔥 ${activeErasList.join(", ")}</span>` : "Нет Эпохи";
  let topMap = "Mirage";
  let maxMapPicks = 0;
  if (seasonState.mapPicksHistory) {
    for (let m in seasonState.mapPicksHistory) {
      if (seasonState.mapPicksHistory[m] > maxMapPicks) {
        maxMapPicks = seasonState.mapPicksHistory[m];
        topMap = m;
      }
    }
  }
  document.getElementById("dash-map").innerHTML = `<b>${topMap}</b> <span style="color:var(--gold); font-size:10px;">(${maxMapPicks} пиков)</span>`;
  const seasonTours = (seasonState.tournamentHistory || []).filter(x => x.season === seasonState.currentSeason);
  const upsetCount = seasonTours.reduce((n, x) => n + (x.upsets || 0), 0);
  document.getElementById("dash-money").innerText = `${upsetCount}`;
}
function renderSeasonBanner() {
  const currentYear = 2026 + (seasonState.currentSeason - 1);
  document.getElementById("season-title").innerText = `Сезон ${seasonState.currentSeason} (${currentYear})`;
  document.getElementById("season-progress").innerText = `Tier-1: ${seasonState.tournamentIndex} / ${Array.isArray(seasonState.seasonSchedule) ? Math.max(0, seasonState.seasonSchedule.length - 1) : "∞"}`;
  const score = seasonState.pickemScore || 0;
  // v33: звания Pick'Em (js/manager/v33-pickem.js) вместо «Бронза / Серебро / Золото»
  const medal = window.V33Pickem ? window.V33Pickem.rankOf(score).name : (score >= 18 ? "Оракул" : score >= 12 ? "Эксперт" : score >= 6 ? "Аналитик" : score >= 3 ? "Знаток" : "Зритель");
  document.getElementById("pickem-trophy-display").innerText = `Pick'Em: ${medal} · ${score}`;
  const hof = document.getElementById("hall-of-fame");
  if (!seasonState.hallOfFame || seasonState.hallOfFame.length === 0) {
    hof.innerHTML = "<div style='font-size:9.5px; color:var(--text-muted);'>Сезоны еще не завершены</div>";
    return;
  }
  hof.innerHTML = "";
  seasonState.hallOfFame.forEach(item => {
    let risingStarHtml = item.risingStar ? `<div style="font-size:9px; color:var(--win);">🚀 Прорыв: <b>${item.risingStar}</b></div>` : '';
    hof.innerHTML += `
      <div class="hof-card-item">
        <div>
          <span class="badge badge-season">Сезон ${item.season} (${item.year || 2026})</span>
          <div class="hof-champ-name">👑 ${item.champion}</div>
        </div>
        <div style="text-align:right;">
          <div style="font-size:10.5px; font-weight:bold; color:#fff;">${item.scorePts} pts</div>
          ${risingStarHtml}
        </div>
      </div>
    `;
  });
}
function renderTournamentArchive() {
  const archiveContainer = document.getElementById("tournament-archive");
  if (!archiveContainer) return;
  if (!seasonState.tournamentHistory || seasonState.tournamentHistory.length === 0) {
    archiveContainer.innerHTML = "<div style='font-size:9.5px; color:var(--text-muted);'>Турниры еще не завершены</div>";
    return;
  }
  archiveContainer.innerHTML = "";
  seasonState.tournamentHistory.forEach(item => {
    archiveContainer.innerHTML += `
      <div style="font-size:9.5px; padding:3px 0; border-bottom:1px solid var(--border);">
        <span style="color:var(--accent);">[Сез. ${item.season}]</span> <b>${item.name}</b><br>
        👑 Чемпион: <span style="color:var(--gold);">${item.champion}</span>
      </div>
    `;
  });
}
function saveTeams() { localStorage.setItem("cs2_season_teams_v61", JSON.stringify(teams)); saveTransferState(); }
function exportData() {
  const fullSave = { seasonState, teams, transferState, hltvArchive: (typeof window.hubArchiveExport === "function" ? window.hubArchiveExport() : {}),
    playerAwards: (typeof window.twAwardsExport === "function" ? window.twAwardsExport() : null), // v27.22: награды игроков (кубки, MVP, топ-20) — тоже в сейве
    news: (typeof window.V29NewsExport === "function" ? window.V29NewsExport() : null), // v29: лента HLTV, прогнозы, опросы, комментарии
    currentTournament: (currentTournament && !currentTournament.completed) ? JSON.parse(JSON.stringify(currentTournament, (k, v) => k === 'broadcast' ? undefined : v)) : null }; // v34: идущий турнир — тоже в сейве
  // v29: Blob вместо data:-ссылки — большие сейвы (несколько МБ) иначе не скачивались
  const blob = new Blob([JSON.stringify(fullSave)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const dlAnchor = document.createElement('a');
  dlAnchor.setAttribute("href", url);
  dlAnchor.setAttribute("download", `cs2_save_s${seasonState.currentSeason}.json`);
  document.body.appendChild(dlAnchor); dlAnchor.click(); dlAnchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}
function importData(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function(e) {
    try {
      const parsed = JSON.parse(e.target.result);
      if (parsed.teams && Array.isArray(parsed.teams)) {
        teams = parsed.teams;
        if (parsed.seasonState) seasonState = parsed.seasonState;
        if (parsed.transferState) transferState = parsed.transferState;
        if (parsed.hltvArchive && typeof window.hubArchiveImport === "function") window.hubArchiveImport(parsed.hltvArchive);
        if (parsed.playerAwards && typeof window.twAwardsImport === "function") window.twAwardsImport(parsed.playerAwards);
        // v34: идущий турнир из сейва (в старых сейвах его нет — тогда турнир текущего слота создаётся календарём заново)
        try { if (parsed.currentTournament && !parsed.currentTournament.completed) { const ct = parsed.currentTournament; ct.broadcast = { running: false, paused: false, queue: [], active: [], finished: [], clock: 0, timerIds: [] }; if (ct.calendar) { ct.calendar.broadcastAutoStartPending = true; ct.calendar.autoBroadcastAt = Number(seasonState.calendar?.currentMs) || Date.now(); } currentTournament = ct; localStorage.setItem('cs2_current_tournament_v34', JSON.stringify(ct)); } else { localStorage.removeItem('cs2_current_tournament_v34'); } } catch (e2) { console.warn('[v34] турнир из сейва', e2); }
        if (typeof window.V29NewsImport === "function") window.V29NewsImport(parsed.news || { store: { items: [], meta: {}, seq: 0 } }); // v30: сейв без ленты не наследует чужие новости
      }
      saveTeams();
      saveSeasonState();
      renderRating();
      renderTournamentArchive();
      updateTournamentSuggestion();
      try { if (typeof renderTournament === "function" && currentTournament) renderTournament(); } catch (e3) {}
      alert(parsed.currentTournament ? "Сейв успешно загружен!" : "Сейв загружен. В этом сейве нет идущего турнира (старые версии его не сохраняли) — турнир текущего слота начнётся заново.");
    } catch (err) { alert("Ошибка чтения файла сейва."); }
  };
  reader.readAsText(file);
}
function clearHistoryOnly() {
  if (confirm("Очистить историю всех турниров?")) {
    teams.forEach(t => {
      t.history = []; t.mapHistory = []; t.streak = 0; t.fatigue = 0; t.prevRank = null; resetPlayers(t);
      t.trophies = { majors: 0, elite: 0, regular: 0, grandFinalsWon: 0 };
      t.seasonChampionships = 0;
    });
    seasonState.h2h = {};
    seasonState.eras = {};
    seasonState.mapPicksHistory = {};
    seasonState.tournamentHistory = [];
    if (typeof window.hubArchiveClear === "function") window.hubArchiveClear();
    // v27.23: титулы игроков, MVP, топ-20, награды года и зал славы — тоже история, стираются вместе с ней
    if (typeof window.twAwardsClear === "function") window.twAwardsClear();
    seasonState.hallOfFame = [];
    if (typeof window.hltvSiteReset === "function") window.hltvSiteReset();
    if (typeof renderSeasonBanner === "function") { try { renderSeasonBanner(); } catch (e) {} }
    saveTeams();
    saveSeasonState();
    showHistory("");
    renderRating();
    renderTournamentArchive();
    alert("История и H2H очищены.");
  }
}
function cleanZeroHistory() {
  teams.forEach(t => {
    if (t.history) t.history = t.history.filter(h => h.delta !== undefined && h.delta !== 0);
  });
  saveTeams();
  showHistory(selectedTeamForDetails);
  alert("История оптимизирована!");
}
function resetToDefault() {
  if (confirm("Сбросить базу данных команд и сезоны к исходным?")) {
    // Полный сброс: раньше здесь вручную пересобиралось только seasonState/teams,
    // но календарь, расписание Tier-1, параллельный слой (Tier-2/3, академии) и
    // служебные флаги миграции жили в тех же localStorage-ключах и не трогались,
    // из-за чего после «Сброса» турниры могли внезапно оказаться в 200+ днях от
    // текущей даты. Теперь чистим все связанные ключи и перезагружаем страницу —
    // это гарантированно прогоняет игру через тот же путь инициализации, что и
    // при самом первом запуске, без риска рассинхронизации.
    // v27.23: сначала отменить отложенные записи наград и архива (иначе они вернутся при перезагрузке)
    try { if (typeof window.twAwardsClear === "function") window.twAwardsClear(); if (typeof window.hubArchiveClear === "function") window.hubArchiveClear(); if (typeof window.V29NewsClear === "function") window.V29NewsClear(); } catch(e) {}
    try {
      ["cs2_season_state_v61", "cs2_season_state_v60", "cs2_season_teams_v61", "cs2_season_teams_v60", "cs2_transfer_market_v1", "cs2_hltv_archive_v1", "cs2_player_awards_v1"]
        .forEach(k => localStorage.removeItem(k));
    } catch(e) {}
    location.reload();
  }
}
function renderRating() {
  syncAllPlayerLayers();
  teams.sort((a, b) => b.pts - a.pts);
  saveTeams();
  document.getElementById("total-count").innerText = teams.length;
  const tbody = document.querySelector("#rating-table tbody");
  tbody.innerHTML = "";
  teams.forEach((t, i) => {
    const curRank = i + 1;
    if (t.seasonStartRank === null) t.seasonStartRank = curRank;
    if (curRank === 1) {
      const sep = document.createElement("tr");
      sep.className = "tier-separator-row tier-separator-legends";
      sep.innerHTML = `<td colspan="4">⭐ Топ-1..4 — GOAT</td>`;
      tbody.appendChild(sep);
    } else if (curRank === 5) {
      const sep = document.createElement("tr");
      sep.className = "tier-separator-row tier-separator-stage3";
      sep.innerHTML = `<td colspan="4">🔷 Посев в Stage 3 Мейджора / Legends</td>`;
      tbody.appendChild(sep);
    } else if (curRank === 9) {
      const sep = document.createElement("tr");
      sep.className = "tier-separator-row tier-separator-challengers";
      sep.innerHTML = `<td colspan="4">🎯 Топ-9..16 — Посев в Stage 2 / Challengers</td>`;
      tbody.appendChild(sep);
    }
    let rankDiffHtml = `<span class="rank-diff-same">—</span>`;
    if (t.prevRank !== null && t.prevRank !== undefined) {
      const diff = t.prevRank - curRank;
      if (diff > 0) rankDiffHtml = `<span class="rank-diff-up">▲${diff}</span>`;
      else if (diff < 0) rankDiffHtml = `<span class="rank-diff-down">▼${Math.abs(diff)}</span>`;
    }
    ensurePlayerLayer(t);
    const rosterLine = t.players.map(p => p.nick).join(' · ');
    const tr = document.createElement("tr");
    tr.onclick = () => showHistory(t.name);
    let streakIndicator = "";
    if (t.streak >= 3) streakIndicator = ` <span style="color:var(--win);">🔥+${t.streak}</span>`;
    else if (t.streak <= -3) streakIndicator = ` <span style="color:var(--loss);">❄️${t.streak}</span>`;
    let eventTag = t.activeModifier ? `<span class="team-event-badge" title="${t.activeModifier.name}">${t.activeModifier.icon}</span>` : '';
    let eraTag = (seasonState.eras && seasonState.eras[t.name]?.active) ? ` <span style="color:var(--era); font-weight:bold;" title="Эпоха!">👑 ERA</span>` : '';
    tr.innerHTML = `
      <td class="rank-cell">
        <span class="rank ${curRank === 1 ? 'rank-top-1' : curRank === 2 ? 'rank-top-2' : curRank === 3 ? 'rank-top-3' : 'rank-other'}">#${curRank}</span>${rankDiffHtml}
      </td>
      <td style="font-weight:500;">
        ${t.name}${eraTag}${streakIndicator}${eventTag}
        <div style="font-size:8.5px; color:var(--text-muted);">${rosterLine}</div>
      </td>
      <td class="pts">${t.pts}</td>
      <td class="actions">
        <button class="icon-btn edit-btn" onclick="event.stopPropagation(); editPts('${t.name}')">✎</button>
        <button class="icon-btn del-btn" onclick="event.stopPropagation(); deleteTeam('${t.name}')">✖</button>
      </td>
    `;
    tbody.appendChild(tr);
  });
  updateAnalyticsDashboard();
}
function addTeam() {
  const nameInput = document.getElementById("new-team-name");
  const ptsInput = document.getElementById("new-team-pts");
  const styleInput = document.getElementById("new-team-style");
  const name = nameInput.value.trim();
  const pts = parseInt(ptsInput.value) || 500;
  if (!name) return alert("Введите имя команды");
  if (teams.some(t => t.name.toLowerCase() === name.toLowerCase())) return alert("Команда уже существует");
  const newMaps = generateMapStats();
  const newMapStats = {};
  MAP_POOL.forEach(map => { const wr = Math.round(newMaps[map]); newMapStats[map] = { wins: Math.round(20 * wr / 100), losses: 20 - Math.round(20 * wr / 100) }; });
  const newTeam = {
    name, pts, streak: 0, maps: newMaps, mapStats: newMapStats, mapStatsVersion: 2, mapHistory: [], history: [],
    style: styleInput.value, form: 100, fatigue: 0, prevRank: null, lastBootcampSeason: 0,
    trophies: { majors: 0, elite: 0, regular: 0, grandFinalsWon: 0 }, activeModifier: null, seasonStartRank: teams.length + 1,
    seasonChampionships: 0, players: [], coach: COACHES_2026[name] || { name: 'coach', flag: getTeamFlag(name) }, playerLayerVersion: PLAYER_LAYER_VERSION, rosterLastChange: null, tempStandIn: null
  };
  const rosterNames = TEAM_ROSTER_2026[name] || [`${name}-1`,`${name}-2`,`${name}-3`,`${name}-4`,`${name}-5`];
  newTeam.players = rosterNames.slice(0,5).map((nick,idx)=>createPlayerFromNick(newTeam,nick,idx));
  ensurePlayerLayer(newTeam);
  teams.push(newTeam);
  nameInput.value = "";
  renderRating();
}
function editPts(teamName) {
  const t = teams.find(x => x.name === teamName);
  const newPts = prompt(`Новый рейтинг для ${t.name}:`, t.pts);
  if (newPts !== null && !isNaN(parseInt(newPts))) {
    t.pts = parseInt(newPts);
    renderRating();
  }
}
function deleteTeam(teamName) {
  if (confirm(`Удалить команду ${teamName}?`)) {
    teams = teams.filter(t => t.name !== teamName);
    renderRating();
  }
}
function showHistory(teamName) {
  selectedTeamForDetails = teamName;
  const hubBackdrop = document.getElementById("hltv-hub-backdrop");
  const hubBox = document.getElementById("hltv-profile-box");
  const extraStats = document.getElementById("team-extra-stats");
  const trophyBox = document.getElementById("trophy-cabinet");
  const list = document.getElementById("history-list");
  if (!teamName) {
    hubBackdrop.style.display = "none";
    return;
  }
  hubBackdrop.style.display = "flex";
  hubBox.style.position = "";
  hubBox.style.left = "";
  hubBox.style.top = "";
  hubBox.style.margin = "";
  document.getElementById("hltv-details-block").style.display = "none";
  document.getElementById("hltv-details-toggle").textContent = "📊 Подробнее";
  const t = teams.find(x => x.name === teamName);
  if (!t) return;
  ensurePlayerLayer(t);
  if (!t.coach) t.coach = COACHES_2026[t.name] || { name: 'coach', flag: getTeamFlag(t.name) };
  ensurePlayerLayer(t);
  const styleNames = {
    "Aggressive": "Агрессивный", "Discipline": "Дисциплинированный",
    "Tactical": "Тактический", "Chaos": "Хаос / Скрим"
  };
  document.getElementById("history-header").innerText = t.name;
  document.getElementById("history-team-name").innerHTML = `<span style="color:var(--accent);">${styleNames[t.style] || t.style}</span>`;
  document.getElementById("hltv-team-flag").textContent = getTeamFlag(t.name);
  const rankIdx = teams.findIndex(x => x.name === t.name) + 1;
  document.getElementById("hltv-rating-line").innerHTML = `#${rankIdx} <span style="color:var(--text-muted); font-weight:500;">(${t.pts} pts)</span>`;
  document.getElementById("hltv-coach-name").textContent = t.coach.name;
  document.getElementById("hltv-coach-flag").textContent = t.coach.flag;
  renderPlayerLayerHub(t);
  document.getElementById("hltv-players-row").innerHTML = t.players.map(p => `
    <div class="player-card-mini">
      <div class="player-avatar">${p.nick.charAt(0).toUpperCase()}</div>
      <div class="player-flag">${p.flag}</div>
      <div class="player-nick">${p.nick}</div>
      <div style="font-size:7px;color:${p.status==='STAND-IN'?'var(--gold)':p.status==='BENCH'?'var(--loss)':'var(--text-muted)'};">${p.status||'STARTER'}</div>
    </div>
  `).join('');
  const tr = t.trophies || { majors: 0, elite: 0, regular: 0, grandFinalsWon: 0 };
  const sc = t.seasonChampionships || 0;
  trophyBox.innerHTML = `
    <div class="trophy-item" style="border-color:var(--major);">⭐ Major: <b>${tr.majors}</b></div>
    <div class="trophy-item" style="border-color:var(--gold);">🏆 Сезонов: <b>${sc}</b></div>
    <div class="trophy-item" style="border-color:var(--elite);">🔥 S-Tier: <b>${tr.elite}</b></div>
    <div class="trophy-item" style="border-color:var(--accent);">🥇 Финалов: <b>${tr.grandFinalsWon}</b></div>
  `;
  let mapStrs = Object.entries(t.maps).map(([m, val]) => `<b>${m}:</b> ${val}%`);
  const recentMapHistory = (t.mapHistory || []).slice(0, 12);
  const mapHistoryHtml = recentMapHistory.length ? `<div style="margin-top:4px;"><b>🗺️ Последние карты:</b> ${recentMapHistory.map(h => `<span style="display:inline-block;margin:2px;padding:2px 4px;border:1px solid ${h.result === 'W' ? 'var(--win)' : 'var(--loss)'};border-radius:3px;color:${h.result === 'W' ? 'var(--win)' : 'var(--loss)'};font-size:8.5px;">${h.map} ${h.result} ${h.score ? h.score : ''}</span>`).join('')}</div>` : '';
  let modStr = t.activeModifier ? `<div style="color:#a29bfe; margin-top:2px;"><b>Событие:</b> ${t.activeModifier.icon} ${t.activeModifier.name} (${t.activeModifier.val > 0 ? '+' : ''}${t.activeModifier.val}% к форме)</div>` : '';
  const h2h = getTeamH2HSummary(teamName);
  let h2hHtml = "";
  if (h2h.list.length > 0) {
    const winrate = Math.round((h2h.totalWins / Math.max(1, h2h.totalWins + h2h.totalLosses)) * 100);
    const topRival = h2h.list[0];
    const detailedBadges = h2h.list.map(item => {
      const c = item.wins > item.rivalWins ? "var(--win)" : (item.wins < item.rivalWins ? "var(--loss)" : "var(--gold)");
      return `<span style="display:inline-block; background:#161c26; border:1px solid #283344; padding:2px 4px; border-radius:3px; margin:2px; font-size:9px;">
        vs <b>${item.rival}</b>: <b style="color:${c};">${item.wins}-${item.rivalWins}</b>
      </span>`;
    }).join("");
    h2hHtml = `
      <div class="h2h-compact-box">
        <div class="h2h-compact-header">
          <span>⚔️ <b>H2H:</b> <b style="color:var(--win);">${h2h.totalWins}W</b> - <b style="color:var(--loss);">${h2h.totalLosses}L</b> (${winrate}%)</span>
          <button class="secondary" id="h2h-toggle-btn" style="padding:1px 5px; font-size:8.5px;" onclick="toggleH2HDetails()">Детали</button>
        </div>
        <div style="color:var(--text-muted); font-size:9px; margin-top:1px;">
          Главный соперник: <b>${topRival.rival}</b> (${topRival.wins}-${topRival.rivalWins})
        </div>
        <div id="h2h-scroll-details" class="h2h-details-scroll">${detailedBadges}</div>
      </div>
    `;
  }
  extraStats.innerHTML = `
    <div>🗺️ <b>Маппул:</b> ${mapStrs.join(" | ")}</div>
    ${mapHistoryHtml}
    <div style="margin-top:2px;">📈 <b>Форма:</b> ${t.form}% | 💤 <b>Усталость:</b> ${t.fatigue}% | 🧪 <b>Химия:</b> ${t.playerLayer?.chemistry ?? '—'} | 🤝 <b>Сыгранность:</b> ${t.playerLayer?.cohesion ?? '—'}</div>
    ${modStr}
    ${h2hHtml}
    ${t.rosterLastChange ? `<div class="transfer-note"><b>🔁 Последнее изменение ростера:</b> ${esc(t.rosterLastChange.type==='COACH' ? `тренер ${t.rosterLastChange.from||'—'} → ${t.rosterLastChange.player}` : `${t.rosterLastChange.from||'—'} → ${t.rosterLastChange.player}`)}${t.rosterLastChange.reason ? ` · ${esc(t.rosterLastChange.reason)}` : ''}</div>` : ''}
    <div class="transfer-note"><b>🧭 Идентичность:</b> ${esc(teamIdentityGroup(t))} · <b>рынок:</b> ${Array.isArray(transferState.freeAgents) ? transferState.freeAgents.length : 0} свободных игроков</div>
    ${Array.isArray(transferState.history) && transferState.history.length ? `<div class="transfer-note"><b>📰 Последнее с рынка:</b> ${esc(transferState.history[0].text)}</div>` : ''}
  `;
  list.innerHTML = "";
  if (!t.history || t.history.length === 0) {
    list.innerHTML = "<li style='color:var(--text-muted);'>Нет сыгранных турниров</li>";
    return;
  }
  t.history.forEach(h => {
    let badgeClass = "badge-def";
    if (h.isBootcamp) badgeClass = "badge-bootcamp";
    else if (h.isSeasonAward) badgeClass = "badge-season";
    else if (h.isMajor && h.place === 1) badgeClass = "badge-major";
    else if (h.isElite && h.place === 1) badgeClass = "badge-elite";
    else if (h.place === 1) badgeClass = "badge-1";
    else if (h.place === 2) badgeClass = "badge-2";
    else if (h.place === 3) badgeClass = "badge-3";
    let deltaStr = h.delta !== undefined && h.delta !== 0 ? `(${h.delta >= 0 ? '+' : ''}${h.delta} pts)` : '';
    list.innerHTML += `
      <li style="margin-bottom: 2px;">
        <span class="badge ${badgeClass}">${h.placeTitle || h.place + ' место'}</span>
        <b>${h.tournament}</b> ${deltaStr}
      </li>`;
  });
}
function closeHltvHub() {
  selectedTeamForDetails = null;
  document.getElementById("hltv-hub-backdrop").style.display = "none";
}
function toggleHltvDetails() {
  const block = document.getElementById('hltv-details-block');
  const btn = document.getElementById('hltv-details-toggle');
  const show = block.style.display === 'none';
  block.style.display = show ? 'block' : 'none';
  btn.textContent = show ? '📊 Свернуть' : '📊 Подробнее';
}
function makeDraggable(boxEl, handleEl) {
  let offsetX = 0, offsetY = 0, dragging = false;
  function onDown(clientX, clientY) {
    const rect = boxEl.getBoundingClientRect();
    boxEl.style.position = 'fixed';
    boxEl.style.left = rect.left + 'px';
    boxEl.style.top = rect.top + 'px';
    boxEl.style.margin = '0';
    offsetX = clientX - rect.left;
    offsetY = clientY - rect.top;
    dragging = true;
  }
  function onMove(clientX, clientY) {
    if (!dragging) return;
    const maxX = window.innerWidth - boxEl.offsetWidth;
    const maxY = window.innerHeight - boxEl.offsetHeight;
    const newX = Math.max(0, Math.min(maxX, clientX - offsetX));
    const newY = Math.max(0, Math.min(maxY, clientY - offsetY));
    boxEl.style.left = newX + 'px';
    boxEl.style.top = newY + 'px';
  }
  function onUp() { dragging = false; }
  handleEl.addEventListener('mousedown', e => { onDown(e.clientX, e.clientY); e.preventDefault(); });
  document.addEventListener('mousemove', e => onMove(e.clientX, e.clientY));
  document.addEventListener('mouseup', onUp);
  handleEl.addEventListener('touchstart', e => { const t = e.touches[0]; onDown(t.clientX, t.clientY); }, {passive:true});
  document.addEventListener('touchmove', e => { if (dragging) { const t = e.touches[0]; onMove(t.clientX, t.clientY); } }, {passive:true});
  document.addEventListener('touchend', onUp);
}
makeDraggable(document.getElementById('hltv-profile-box'), document.getElementById('hltv-drag-handle'));
function maybeAutoBootcamp(t) {
  // Compatibility stub: autobootcamps are intentionally disabled in v15.
  return false;
}
function runAutomaticBootcamps() {
  // Compatibility stub: the manager must explicitly schedule a camp.
  return [];
}
function updateTournamentSuggestion() {
  manualFieldProfileOverride = null;
  if (!seasonState.seasonSchedule || seasonState.seasonSchedule.length === 0) {
    generateDynamicSeasonSchedule();
    saveSeasonState();
  } else if (applySeasonFieldProfiles()) {
    saveSeasonState();
  }
  const prestigeSelect = document.getElementById("tour-prestige");
  const nameInput = document.getElementById("tour-name");
  const minInput = document.getElementById("min-score");
  const maxInput = document.getElementById("max-score");
  const sizeSelect = document.getElementById("tour-size");
  const formatSelect = document.getElementById("tour-format");
  const currentStep = seasonState.seasonSchedule[seasonState.tournamentIndex] || {
    type: "regular", name: `ESL Open Championship 2026`, min: 300, max: 2000, size: 16, format: "single"
  };
  prestigeSelect.value = currentStep.type;
  nameInput.value = currentStep.name;
  minInput.value = currentStep.min;
  maxInput.value = currentStep.max;
  sizeSelect.value = String(currentStep.size || "16");
  formatSelect.value = currentStep.format || (currentStep.type === "major" ? "swiss" : "single");
  onFormatChange();
  onPrestigeChange();
}
function applyTournamentTemplate() {
  const key = document.getElementById("tour-template").value;
  if (key === "custom") {
    manualFieldProfileOverride = null;
    return;
  }
  const tpl = TOURNAMENT_TEMPLATES[key];
  if (!tpl) return;
  document.getElementById("tour-prestige").value = tpl.prestige;
  document.getElementById("tour-name").value = `${tpl.name} ${2026 + (seasonState.currentSeason - 1)}`;
  document.getElementById("tour-size").value = tpl.size;
  document.getElementById("tour-format").value = tpl.format;
  onPrestigeChange();
  manualFieldProfileOverride = tpl.fieldProfile || (tpl.prestige === "major" ? "major" : tpl.prestige === "elite" ? "elite" : "open");
}
function onPrestigeChange() {
  const prestige = document.getElementById("tour-prestige").value;
  const formatSelect = document.getElementById("tour-format");
  const sizeSelect = document.getElementById("tour-size");
  if (prestige === "major") {
    document.getElementById("min-score").value = "500";
    document.getElementById("max-score").value = "2000";
    formatSelect.value = "swiss";
    sizeSelect.value = "16";
  }
}
function onFormatChange() {
  const formatSelect = document.getElementById("tour-format").value;
  const sizeSelect = document.getElementById("tour-size");
  if (formatSelect === "swiss" || formatSelect === "gsl") {
    sizeSelect.value = "16";
  } else if (formatSelect === "bounty") {
    sizeSelect.value = "32";
  }
}
function triggerRandomEvents(roster) {
  roster.forEach(t => { t.activeModifier = null; });
  const banner = document.getElementById("event-alert-box");
  if (Math.random() < 0.22) {
    const target = roster[Math.floor(Math.random() * roster.length)];
    const ev = RANDOM_EVENTS[Math.floor(Math.random() * RANDOM_EVENTS.length)];
    target.activeModifier = { name: ev.text, val: ev.val, icon: ev.icon };
    target.form = Math.round(Math.max(90, Math.min(110, Number(target.form) + ev.val)));
    ensurePlayerLayer(target);
    if (/болезни|виз/i.test(ev.text)) applyTemporaryStandIn(target, ev.text);
    if (/скандал|токсичность/i.test(ev.text)) {
      const troubled=[...target.players].sort((a,b)=>Number(b.fatigue||0)-Number(a.fatigue||0))[0];
      if(troubled) troubled.status='BENCH';
      applyTemporaryStandIn(target,'внутренний конфликт');
      target.form=Math.max(90,target.form-4);
      ensurePlayerLayer(target);
      transferLog(`⚠️ ${target.name}: ${troubled?.nick||'игрок'} посажен на скамейку после внутреннего конфликта.`,'bench');
    }
    if (/новый амбициозный тренер/i.test(ev.text) && Math.random()<0.45) maybeTransferCoach(target,{trigger:true,losses:Math.abs(Math.min(0,target.streak||0)),majorFail:false});
    if (banner) {
      banner.style.display = "block";
      const rosterText = target.rosterLastChange ? ` · ${target.rosterLastChange.type === 'STAND-IN' ? `стенд-ин ${target.rosterLastChange.player}` : target.rosterLastChange.type === 'COACH' ? `тренер ${target.rosterLastChange.player}` : 'изменение ростера'}` : '';
      banner.innerHTML = `📢 <b>Инсайд:</b> у <b>${target.name}</b> ${ev.icon} ${ev.text} (${ev.val > 0 ? '+' : ''}${ev.val}% к форме)${rosterText}`;
    }
  } else {
    if (banner) banner.style.display = "none";
  }
}
function initTournamentCycle() {
  createTournament();
}
function simulateQualificationStage(pool, slotCount = 1) {
  const contenders = [...pool].slice(0, 8);
  let stats = {};
  contenders.forEach(c => { stats[c.name] = { team: c, wins: 0, roundsDiff: 0 }; });
  let rounds = [];
  for (let i = 0; i < contenders.length; i++) {
    for (let j = i + 1; j < contenders.length; j++) {
      const t1 = contenders[i], t2 = contenders[j];
      const odds = calcMatchOdds(t1.name, t2.name, true);
      const winner = Math.random() < odds.p1_win ? t1 : t2;
      const loser = winner === t1 ? t2 : t1;
      recordH2HWin(winner.name, loser.name);
      stats[winner.name].wins++;
      stats[winner.name].roundsDiff += 4;
      stats[loser.name].roundsDiff -= 4;
      rounds.push([{
        t1: t1.name, t2: t2.name, winner: winner.name,
        score: winner === t1 ? "13-9" : "9-13"
      }]);
    }
  }
  let sortedContenders = Object.values(stats).sort((a, b) => b.wins - a.wins || b.roundsDiff - a.roundsDiff);
  let qualifiedWinners = sortedContenders.slice(0, slotCount).map(x => x.team);
  return { contenders, winner: slotCount === 1 ? qualifiedWinners[0] : qualifiedWinners, rounds, slotCount };
}
function makeMajorSwissStage(stageNo, roster){
  const stage={
    number:stageNo,
    teams:roster.map(t=>({name:t.name,wins:0,losses:0,diff:0,playedAgainst:[]})),
    currentRound:1, rounds:[], completed:false, advanced:[], eliminated:[]
  };
  generateMajorSwissRound(stage);
  return stage;
}
function generateMajorSwissRound(stage){
  const active=stage.teams.filter(t=>t.wins<3&&t.losses<3)
    .sort((a,b)=>b.wins-a.wins||a.losses-b.losses||b.diff-a.diff);
  const matches=[], paired=new Set();
  for(let i=0;i<active.length;i++){
    if(paired.has(active[i].name)) continue;
    const t1=active[i];
    let t2=null;
    for(let j=i+1;j<active.length;j++){
      const x=active[j];
      if(!paired.has(x.name)&&x.wins===t1.wins&&!t1.playedAgainst.includes(x.name)){t2=x;break;}
    }
    if(!t2) for(let j=i+1;j<active.length;j++){
      const x=active[j];
      if(!paired.has(x.name)&&x.wins===t1.wins){t2=x;break;}
    }
    if(!t2) for(let j=i+1;j<active.length;j++){
      const x=active[j];
      if(!paired.has(x.name)){t2=x;break;}
    }
    if(t2){
      paired.add(t1.name); paired.add(t2.name);
      t1.playedAgainst.push(t2.name); t2.playedAgainst.push(t1.name);
      const deciding=(t1.wins===2||t1.losses===2);
      matches.push({
        t1:t1.name,t2:t2.name,winner:null,score:"",
        isBO1:!deciding,isSwiss:true,majorStage:stage.number
      });
    }
  }
  stage.rounds.push(matches);
}
function scoreMajorStagePickem(stageNo){
  const p=currentPickem?.major?.stages?.[stageNo];
  const st=currentTournament?.majorStages?.[stageNo-1];
  if(!p||!st||!st.completed||p.scored) return 0;
  const actual30=st.teams.filter(t=>t.wins===3&&t.losses===0).map(t=>t.name);
  const actual03=st.teams.filter(t=>t.wins===0&&t.losses===3).map(t=>t.name);
  const actualAdv=st.teams.filter(t=>t.wins>=3).map(t=>t.name);
  let pts=0;
  p.threeZero.forEach(n=>{if(actual30.includes(n))pts++;});
  p.advance.forEach(n=>{if(actualAdv.includes(n))pts++;});
  p.zeroThree.forEach(n=>{if(actual03.includes(n))pts++;});
  p.points=pts;
  p.passed=pts>=5;
  p.scored=true;
  seasonState.pickemScore=(seasonState.pickemScore||0)+pts;
  saveSeasonState();
  return pts;
}
function scoreMajorPlayoffPickem(kind,name){
  const p=currentPickem?.major?.playoffs;
  if(!p||!name) return;
  if(kind==="qf"&&p.qf.includes(name)) seasonState.pickemScore=(seasonState.pickemScore||0)+1;
  if(kind==="sf"&&p.sf.includes(name)) seasonState.pickemScore=(seasonState.pickemScore||0)+1;
  if(kind==="champion"&&p.champion===name) seasonState.pickemScore=(seasonState.pickemScore||0)+1;
  saveSeasonState();
}
function finalizeMajorStage(stageNo){
  if (currentTournament?.broadcast?.running) stopTournamentBroadcast(false);
  const st=currentTournament.majorStages[stageNo-1];
  const adv=st.teams.filter(t=>t.wins>=3);
  const elim=st.teams.filter(t=>t.losses>=3);
  st.advanced=adv.map(t=>t.name);
  st.eliminated=elim.map(t=>t.name);
  st.completed=true;
  scoreMajorStagePickem(stageNo);
  currentTournament.majorStageCollapsed=currentTournament.majorStageCollapsed||{};
  currentTournament.majorStageCollapsed[stageNo]=true;
  elim.forEach(t=>{
    currentTournament.placements[t.name]={
      place:stageNo===1?25:(stageNo===2?17:9),
      title:`Major Stage ${stageNo} (${t.wins}-${t.losses})`
    };
  });
  if(stageNo===1){
    const seeded=currentTournament.majorPools.stage2.slice();
    const next=adv.map(x=>teams.find(t=>t.name===x.name||t.name===x.name))
      .filter(Boolean).concat(seeded.filter(t=>!adv.some(x=>x.name===t.name))).slice(0,16);
    currentTournament.majorStages[1]=makeMajorSwissStage(2,next);
  }else if(stageNo===2){
    const seeded=currentTournament.majorPools.stage3.slice();
    const next=adv.map(x=>teams.find(t=>t.name===x.name))
      .filter(Boolean).concat(seeded.filter(t=>!adv.some(x=>x.name===t.name))).slice(0,16);
    currentTournament.majorStages[2]=makeMajorSwissStage(3,next);
  }else{
    const playoff=adv.map(x=>teams.find(t=>t.name===x.name)).filter(Boolean);
    currentTournament.formatChoice="single";
    currentTournament.size=8;
    currentTournament.hasLowerBracket=false;
    setupBracketTournament(playoff,"single");
  }
  renderRating();
  renderTournament();
}
function resolveMajorSwissMatch(stageNo,rIdx,mIdx){
  const st=currentTournament.majorStages[stageNo-1];
  const m=st.rounds[rIdx][mIdx];
  if(!m||!m.winner)return;
  const w=m.winner, l=w===m.t1?m.t2:m.t1;
  const wo=st.teams.find(t=>t.name===w), lo=st.teams.find(t=>t.name===l);
  if(wo){wo.wins++;wo.diff+=2;}
  if(lo){lo.losses++;lo.diff-=2;}
  recordH2HWin(w, l);
  updateFatigueAndForm(w, l);
  accumulateMatchRating(w, l, m.isBO1);
  if(st.rounds[rIdx].every(x=>x.winner!==null)){
    if(st.currentRound<5){
      st.currentRound++;
      generateMajorSwissRound(st);
    }else{
      finalizeMajorStage(stageNo);
      return;
    }
  }
  renderTournament();
}
function setupMajorTournament(all32){
  const sorted=[...all32].sort((a,b)=>b.pts-a.pts);
  currentTournament.majorPools={
    stage1:sorted.slice(16,32).map(t=>t.name),
    stage2:sorted.slice(8,16),
    stage3:sorted.slice(0,8)
  };
  currentTournament.majorStages=[
    makeMajorSwissStage(1,sorted.slice(16,32)),
    null,null
  ];
  currentTournament.majorStageCollapsed={1:false,2:false,3:false};
}
function getMajorCurrentMatch(){
  const stages=currentTournament?.majorStages;
  if(!stages)return null;
  for(let si=0;si<3;si++){
    const st=stages[si];
    if(!st||st.completed)continue;
    for(let r=0;r<st.rounds.length;r++){
      for(let m=0;m<st.rounds[r].length;m++){
        const x=st.rounds[r][m];
        if(x.t1&&x.t2&&!x.winner){
          return {
            match:x,
            callback:()=>resolveMajorSwissMatch(si+1,r,m),
            isFinal:false,
            stage:`Major Stage ${si+1} • R${r+1}`
          };
        }
      }
    }
    return null;
  }
  const rounds=currentTournament.upperRounds||[];
  if (currentTournament.isMajor && currentTournament.bronzeMatch) {
    currentTournament.bronzeMatch = null;
  }
  for(let r=0;r<rounds.length-1;r++){
    for(let m=0;m<rounds[r].length;m++){
      const x=rounds[r][m];
      if(x.t1&&x.t2&&!x.winner)
        return {match:x,callback:()=>resolveUpperMatch(r,m),isFinal:false,stage:getPlayoffStageName(r,rounds.length)};
    }
  }
  if(currentTournament.bronzeMatch && currentTournament.bronzeMatch.t1 && currentTournament.bronzeMatch.t2 && !currentTournament.bronzeMatch.winner){
    return {match:currentTournament.bronzeMatch,callback:()=>resolveBronzeMatch(),isFinal:false,stage:"За 3-е место"};
  }
  if(rounds.length){
    const final=rounds[rounds.length-1][0];
    if(final?.t1&&final?.t2&&!final.winner)
      return {match:final,callback:()=>resolveUpperMatch(rounds.length-1,0),isFinal:true,stage:"Гранд-финал"};
  }
  return null;
}
function renderMajorStagePanel(st,no){
  const box=document.createElement("section");
  const explicitState=currentTournament.majorStageCollapsed?.[no];
  const collapsed=explicitState!==undefined?explicitState:!!st?.completed;
  box.className="major-stage-panel"+(collapsed?" collapsed":"")+(st?.completed?" compact":"");
  const status=st?.completed?"✅ Завершён":st?"🟢 Идёт":"🔒 Ожидает";
  box.innerHTML=`<div class="major-stage-title"><span>MAJOR — STAGE ${no}</span><span style="display:flex;align-items:center;gap:6px;"><span>${status}</span><button type="button" class="major-stage-toggle">${collapsed?"▶ Открыть":"▼ Свернуть"}</button></span></div>`;
  const toggle=box.querySelector('.major-stage-toggle');
  toggle.onclick=()=>{currentTournament.majorStageCollapsed=currentTournament.majorStageCollapsed||{};currentTournament.majorStageCollapsed[no]=!collapsed;renderTournament();};
  if(st?.completed){
    const nextLabel=no===3?"Champions Stage":`Stage ${no+1}`;
    const summary=document.createElement("div");
    summary.className="major-stage-summary";
    summary.innerHTML=`<span class="summary-label">➡️ Прошли в ${nextLabel}:</span>`+
      st.advanced.map(n=>`<span class="adv-chip">${n}</span>`).join("");
    box.appendChild(summary);
  }
  const body=document.createElement('div'); body.className='major-stage-body'; box.appendChild(body);
  if(!st){
    const msg=document.createElement("div");
    msg.className="major-stage-locked";
    msg.textContent=no===2?"Ждём 8 команд из Stage 1":"Ждём 8 команд из Stage 2";
    body.appendChild(msg);
    return box;
  }
  const row=document.createElement("div");
  row.className="major-swiss-row";
  st.rounds.forEach((round,ri)=>{
    const col=document.createElement("div");
    col.className="major-swiss-round";
    col.innerHTML=`<div class="round-title">Раунд ${ri+1}</div>`;
    const mb=document.createElement("div");
    mb.className="round-matches-container";
    round.forEach((m,mi)=>mb.appendChild(createMatchElement(m,()=>resolveMajorSwissMatch(no,ri,mi))));
    col.appendChild(mb); row.appendChild(col);
  });
  body.appendChild(row);
  const table=document.createElement("div");
  table.className="major-stage-standings";
  table.innerHTML=[...st.teams].sort((a,b)=>b.wins-a.wins||a.losses-b.losses||b.diff-a.diff)
    .map(t=>`<span class="${t.wins>=3?'advance':t.losses>=3?'elim':''}"><b>${t.name}</b> ${t.wins}-${t.losses}</span>`).join("");
  body.appendChild(table);
  return box;
}
function renderMajorView(root){
  root.className="major-view";
  root.innerHTML="";
  const info=document.createElement("div");
  info.className="major-flow-info";
  info.innerHTML=`<b>🏆 MAJOR</b><span>Stage 1 → Stage 2 → Stage 3 → Champions Stage</span>
    <small>3 Swiss-этапа по 16 команд. Из каждого этапа 8 проходят дальше; Stage 2 и Stage 3 получают по 8 заранее посеянных команд.</small>`;
  root.appendChild(info);
  for(let i=1;i<=3;i++)root.appendChild(renderMajorStagePanel(currentTournament.majorStages?.[i-1],i));
  if(currentTournament.majorStages?.[2]?.completed){
    const wrap=document.createElement("section");
    wrap.className="major-playoff-wrap";
    wrap.innerHTML=`<div class="major-stage-title"><span>🏆 CHAMPIONS STAGE — PLAYOFFS</span><span>8 команд</span></div>`;
    const detached=document.createElement("div");
    renderSingleElimView(detached);
    while(detached.firstChild)wrap.appendChild(detached.firstChild);
    root.appendChild(wrap);
  }
}
function createTournament(customRoster = null) {
  stopAllSimulations();
  stopRequested = false;
  activeMatchSimAbort = false;
  const prestige = document.getElementById("tour-prestige").value;
  const isMajor = (prestige === "major");
  const isElite = (prestige === "elite");
  let defaultTitle = document.getElementById("tour-name").value.trim() || "Tournament";
  let size = parseInt(document.getElementById("tour-size").value);
  let formatChoice = document.getElementById("tour-format").value;
	if (isMajor) {
    size = 32;
    formatChoice = "major";
  } else if (formatChoice === "bounty") {
    size = 32;
  } else if (formatChoice === "swiss" || formatChoice === "gsl") {
    size = 16;
  }
  const savedStep = seasonState.seasonSchedule?.[seasonState.tournamentIndex] || null;
  const explicitProfile = manualFieldProfileOverride || savedStep?.fieldProfile || null;
  const fieldProfile = getTournamentFieldProfile(seasonState.tournamentIndex, prestige, explicitProfile);
  manualFieldProfileOverride = null;
  let roster = [];
  let qualification = null;
  if (customRoster) {
    roster = shuffleArray(customRoster.slice(0, size));
  } else if (isMajor) {
    roster = shuffleArray([...teams].sort((a,b) => (b.pts || 0) - (a.pts || 0)).slice(0, Math.min(32, teams.length)));
    size = roster.length;
} else if (formatChoice === "bounty") {
    const rankedAll = [...teams].sort((a, b) => (b.pts || 0) - (a.pts || 0));
    const directInvites = rankedAll.slice(0, 28);
    const qualifierPool = rankedAll.slice(28);
    roster = [...directInvites];
    if (qualifierPool.length >= 8) {
      qualification = simulateQualificationStage(shuffleArray(qualifierPool), 4);
      const qualified = Array.isArray(qualification.winner)
        ? qualification.winner
        : (qualification.winner ? [qualification.winner] : []);
      roster.push(...qualified);
    }
    if (roster.length < 32) {
      rankedAll.forEach(t => {
        if (roster.length < 32 && !roster.some(x => x.name === t.name)) roster.push(t);
      });
    }
  } else {
    const fieldPoolSize = Math.min(teams.length, size >= 16 ? size + 8 : size);
    const fieldPool = buildTournamentRoster(fieldPoolSize, fieldProfile);
    const directInvitesCount = Math.min(12, size);
    const rankedFieldPool = [...fieldPool].sort((a, b) => (b.pts || 0) - (a.pts || 0));
    const directInvites = rankedFieldPool.slice(0, directInvitesCount);
    const openSlotsNeeded = size - directInvites.length;
    const qualifierPool = rankedFieldPool.filter(t => !directInvites.some(x => x.name === t.name));
    roster = directInvites.slice();
    if (openSlotsNeeded > 0 && qualifierPool.length >= 8) {
      qualification = simulateQualificationStage(shuffleArray(qualifierPool), openSlotsNeeded);
      const qualified = Array.isArray(qualification.winner) ? qualification.winner : (qualification.winner ? [qualification.winner] : []);
      roster.push(...qualified);
    }
    if (roster.length < size) {
      shuffleArray(fieldPool).forEach(t => {
        if (roster.length < size && !roster.some(x => x.name === t.name)) roster.push(t);
      });
    }
  }
  roster = shuffleArray(roster).slice(0, size);
roster.forEach(t => {
    t.fatigue = Math.max(0, Number(t.fatigue) || 0);
    const teamRank = teams.sort((a, b) => b.pts - a.pts).indexOf(t) + 1;
    if (teamRank <= 8) {
      const formVolatility = Math.floor(Math.random() * 15) - 7;
      changePlayers(t, {form: formVolatility, morale: Math.round(formVolatility * 0.5)});
    }
  });
  triggerRandomEvents(roster);
  let initialRatings = {}, pendingDeltas = {}, placements = {}, participantsList = [];
  roster.forEach(t => {
    initialRatings[t.name] = t.pts;
    pendingDeltas[t.name] = 0;
    participantsList.push(t.name);
  });
  const finalFormat = isMajor ? "BO5" : "BO3";
  const prizePool = isMajor ? 1250000 : (isElite ? 500000 : 150000);
  currentTournament = {
    name: defaultTitle,
    prestige, isMajor, isElite, fieldProfile,
    season: seasonState.currentSeason,
    tourIndex: seasonState.tournamentIndex,
    size, formatChoice, finalFormat, prizePool,
    hasLowerBracket: (formatChoice === "double"),
    initialRatings, pendingDeltas, placements,
    participants: participantsList,
    qualification,
    majorStages:null,
    majorPools:null,
    upperRounds: [],
    lowerRounds: [],
    grandFinal: null,
    bronzeMatch: null,
    swiss: null,
    gsl: null,
    gslPlayoff: false,
    gslQualified: [],
    completed: false,
    broadcast: { running:false, paused:false, queue:[], active:[], finished:[], clock:0, timerIds:[] }
  };
  document.getElementById("bronze-section").style.display = "none";
  document.getElementById("bronze-bracket").innerHTML = "";
  currentPickem={major:{stages:{},playoffs:{qf:[],sf:[],champion:null}}};
  if(isMajor) setupMajorTournament(roster);
	else if(formatChoice === "bounty") setupBountyTournament(roster);
  else if(formatChoice === "swiss") setupSwissTournament(roster);
  else if(formatChoice === "gsl") setupGSLTournament(roster);
  else setupBracketTournament(roster,formatChoice);
  let prestigeBadge = `<b style="color:var(--accent);">[🏆 РЕГУЛЯРНЫЙ]</b>`;
  if (isMajor) prestigeBadge = `<b style="color:var(--major);">[⭐ MAJOR (ФИНАЛ BO5)]</b>`;
  else if (isElite) prestigeBadge = `<b style="color:var(--elite);">[🔥 S-TIER ELITE]</b>`;
  document.getElementById("tour-meta-badges").innerHTML = `
    ${prestigeBadge} | ${fieldProfileLabel(fieldProfile)} | <span style="color:var(--gold);font-weight:bold;">${fieldProfilePointsLabel(fieldProfile)}</span> | Формат: <b style="color:#fff;">${formatChoice.toUpperCase()}</b> (${size} команд)
  `;
  document.getElementById("sim-all-btn").style.display = "inline-block";
  document.getElementById("sim-step-btn").style.display = "inline-block";
  document.getElementById("sim-tv-btn").style.display = "inline-block";
  document.getElementById("pickem-open-btn").style.display = isMajor ? "inline-block" : "none";
  document.getElementById("stop-sim-btn").style.display = "none";
  document.getElementById("tour-status").innerText = "Турнир начался";
  renderTournament();
  renderRating();
  setupBroadcastPanel();
}
const PICKEM_STAGE_CATS=[
  {key:"threeZero",label:"🟢 3:0",max:2,cls:"assigned-30"},
  {key:"advance",label:"➡️ ADVANCE",max:6,cls:"assigned-adv"},
  {key:"zeroThree",label:"🔴 0:3",max:2,cls:"assigned-03"}
];
const PICKEM_PLAYOFF_CATS=[
  {key:"qf",label:"¼ финал",max:4,cls:"assigned-30"},
  {key:"sf",label:"½ финал",max:2,cls:"assigned-adv"},
  {key:"champion",label:"🏆 Чемпион",max:1,cls:"champion-pick"}
];
let pickemDraft=null;
let pickemActiveCat=null;
function pickemEsc(s){ return String(s).replace(/"/g,"&quot;"); }
function pickemCloneStage(saved){
  return {
    threeZero:[...(saved?.threeZero||[])],
    advance:[...(saved?.advance||[])],
    zeroThree:[...(saved?.zeroThree||[])]
  };
}
function computePickemStageHints(stTeams){
  if (!Array.isArray(stTeams) || !stTeams.length) return [];
  if (Math.random() > 0.45) return [];
  const active = stTeams.filter(t => t.wins < 3 && t.losses < 3);
  if (!active.length) return [];
  const ranked = [...active].sort((a, b) => {
    const ta = teams.find(x => x.name === a.name);
    const tb = teams.find(x => x.name === b.name);
    const strengthA = (ta?.pts || 0) * ((ta?.form || 100) / 100) + a.wins * 60 - a.losses * 40;
    const strengthB = (tb?.pts || 0) * ((tb?.form || 100) / 100) + b.wins * 60 - b.losses * 40;
    return strengthB - strengthA;
  });
  const count = Math.random() < 0.5 ? 1 : 2;
  return weightedPickNoReplacement(ranked, count).map(t => t.name);
}
function openPickemModal(){
  if(!currentTournament || !currentTournament.isMajor) return alert("Pick'Em доступен только для турниров формата Major!");
  const saved=currentPickem.major||{stages:{},playoffs:{qf:[],sf:[],champion:null}};
  const savedQF=[...new Set(saved.playoffs?.qf||[])].slice(0,4);
  const savedSF=[...new Set(saved.playoffs?.sf||[])].filter(n => savedQF.includes(n)).slice(0,2);
  const savedChampion=(saved.playoffs?.champion && savedSF.includes(saved.playoffs.champion)) ? [saved.playoffs.champion] : [];
  pickemDraft={
    stages:{
      1:pickemCloneStage(saved.stages?.[1]),
      2:pickemCloneStage(saved.stages?.[2]),
      3:pickemCloneStage(saved.stages?.[3])
    },
    playoffs:{
      qf:savedQF,
      sf:savedSF,
      champion:savedChampion
    }
  };
  for(let i=1;i<=3;i++){
    const st=currentTournament.majorStages?.[i-1];
    pickemDraft.stages[i]._hintTeams = (st && !st.completed) ? computePickemStageHints(st.teams) : [];
  }
  pickemActiveCat={1:"threeZero",2:"threeZero",3:"threeZero",playoff:"qf"};
  const content=document.getElementById("pickem-content");
  if(!content.dataset.pickemBound){
    content.addEventListener("click",onPickemContentClick);
    content.dataset.pickemBound="1";
  }
  renderPickemContent();
  document.getElementById("pickem-modal").style.display="flex";
}
function closePickemModal(){document.getElementById("pickem-modal").style.display="none";}
function onPickemContentClick(e){
  const tab=e.target.closest(".pickem-cat-tab");
  if(tab){
    pickemActiveCat[tab.dataset.scope]=tab.dataset.cat;
    renderPickemContent();
    return;
  }
  const chip=e.target.closest(".pickem-chip");
  if(chip && chip.dataset.team) pickemToggleTeam(chip.dataset.scope, chip.dataset.team);
}
function pickemGetCats(scope){ return scope==="playoff"?PICKEM_PLAYOFF_CATS:PICKEM_STAGE_CATS; }
function pickemGetBucket(scope){ return scope==="playoff"?pickemDraft.playoffs:pickemDraft.stages[scope]; }
function pickemFlashTab(scope,catKey){
  const tabEl=document.querySelector(`.pickem-cat-tab[data-scope="${scope}"][data-cat="${catKey}"]`);
  if(tabEl){ tabEl.classList.add("shake"); setTimeout(()=>tabEl.classList.remove("shake"),320); }
}
function pickemToggleTeam(scope,team){
  const bucket=pickemGetBucket(scope);
  const cats=pickemGetCats(scope);
  const activeCatKey=pickemActiveCat[scope];
  const cat=cats.find(c=>c.key===activeCatKey);
  if(!bucket || !cat) return;
  if(scope === "playoff") {
    if(activeCatKey === "qf") {
      if(bucket.qf.includes(team)) {
        bucket.qf=bucket.qf.filter(n=>n!==team);
        bucket.sf=bucket.sf.filter(n=>n!==team);
        bucket.champion=bucket.champion.filter(n=>n!==team);
      } else {
        if(bucket.qf.length>=4){ pickemFlashTab(scope,activeCatKey); return; }
        bucket.qf.push(team);
      }
      renderPickemContent();
      return;
    }
    if(activeCatKey === "sf") {
      if(!bucket.qf.includes(team)) return;
      if(bucket.sf.includes(team)) {
        bucket.sf=bucket.sf.filter(n=>n!==team);
        bucket.champion=bucket.champion.filter(n=>n!==team);
      } else {
        if(bucket.sf.length>=2){ pickemFlashTab(scope,activeCatKey); return; }
        bucket.sf.push(team);
      }
      renderPickemContent();
      return;
    }
    if(activeCatKey === "champion") {
      if(!bucket.sf.includes(team)) return;
      bucket.champion=bucket.champion.includes(team)?[]:[team];
      renderPickemContent();
      return;
    }
  }
  let currentCat=null;
  for(const c of cats){ if(bucket[c.key].includes(team)){currentCat=c.key;break;} }
  if(currentCat===activeCatKey){
    bucket[currentCat]=bucket[currentCat].filter(n=>n!==team);
    renderPickemContent();
    return;
  }
  if(bucket[activeCatKey].length>=cat.max){
    if(cat.max===1){
      bucket[activeCatKey]=[team];
      if(currentCat) bucket[currentCat]=bucket[currentCat].filter(n=>n!==team);
      renderPickemContent();
      return;
    }
    pickemFlashTab(scope,activeCatKey);
    return;
  }
  if(currentCat) bucket[currentCat]=bucket[currentCat].filter(n=>n!==team);
  bucket[activeCatKey].push(team);
  renderPickemContent();
}
function renderPickemContent(){
  const content=document.getElementById("pickem-content");
  if(!content) return;
  const saved=currentPickem.major||{stages:{},playoffs:{}};
  let html="";
  for(let i=1;i<=3;i++){
    const st=currentTournament.majorStages?.[i-1];
    if(st?.completed){
      html+=renderPickemStageReview(i, st, saved.stages?.[i]);
    }else if(st){
      html+=renderPickemStageEditor({
        scope:String(i), title:`STAGE ${i}`, roster:st.teams.map(t=>t.name), cats:PICKEM_STAGE_CATS,
        bucket:pickemDraft.stages[i],
        records:Object.fromEntries(st.teams.map(t=>[t.name,{wins:t.wins,losses:t.losses}])),
        hintTeams:pickemDraft.stages[i]._hintTeams||[],
        footnote:"Нужно набрать минимум 5 очков из 10, чтобы этап считался «пройденным»."
      });
    }else{
      html+=renderPickemLocked(`STAGE ${i}`,"Состав появится после завершения предыдущего этапа.");
    }
  }
  const playoffDone=!!currentTournament.completed;
  const ready=!!currentTournament.majorStages?.[2]?.completed;
  if(playoffDone){
    html+=renderPickemPlayoffReview(saved.playoffs);
  }else if(ready){
    const playoffTeams=[...new Set((currentTournament.upperRounds?.[0]||[]).flatMap(m=>[m.t1,m.t2]).filter(Boolean))];
    const activePlayoffCat=pickemActiveCat.playoff||"qf";
    const playoffRoster = activePlayoffCat === "qf"
      ? playoffTeams
      : activePlayoffCat === "sf"
        ? pickemDraft.playoffs.qf
        : pickemDraft.playoffs.sf;
    const playoffFootnote = activePlayoffCat === "qf"
      ? "Выберите 4 победителей четвертьфиналов. После этого эти четыре команды будут доступны во вкладке ½ финала."
      : activePlayoffCat === "sf"
        ? "Выберите 2 победителей полуфиналов только из выбранных вами победителей ¼. Команду можно выбрать и в ¼, и в ½ — это ожидаемая логика."
        : "Выберите чемпиона только из двух выбранных вами победителей ½ финала.";
    html+=renderPickemStageEditor({
      scope:"playoff", title:"🏆 CHAMPIONS STAGE", roster:playoffRoster, cats:PICKEM_PLAYOFF_CATS,
      bucket:pickemDraft.playoffs,
      footnote:playoffFootnote
    });
  }else{
    html+=renderPickemLocked("🏆 CHAMPIONS STAGE","Плей-офф прогнозируется после определения восьмёрки Champions Stage.");
  }
  content.innerHTML=html;
}
function renderPickemLocked(title,text){
  return `<div class="pickem-stage-card locked">
    <div class="pickem-stage-header"><b>${title}</b><span class="pickem-live-badge">🔒 Ожидает</span></div>
    <div class="pickem-lock-text">${text}</div>
  </div>`;
}
function renderPickemResultBadge(s){
  return `<span class="pickem-stage-result ${s.passed?"passed":"failed"}">${s.passed?"✅":"❌"} ${s.points}/10 pts</span>`;
}
function renderPickemStageEditor(opts){
  const {scope,title,roster,cats,bucket,footnote,records,hintTeams}=opts;
  const activeCat=pickemActiveCat[scope];
  const tabsHtml=cats.map(c=>{
    const n=bucket[c.key].length, full=n>=c.max;
    return `<button type="button" class="pickem-cat-tab${activeCat===c.key?" active":""}${full?" cat-full":""}" data-scope="${scope}" data-cat="${c.key}">${c.label}<b>${n}/${c.max}</b></button>`;
  }).join("");
  const chipsHtml=roster.map(name=>{
    let cls="pickem-chip";
    if(scope === "playoff" && bucket[activeCat]?.includes(name)) {
      const activeMeta=cats.find(c=>c.key===activeCat);
      if(activeMeta) cls+=" "+activeMeta.cls;
    } else {
      for(const c of cats){ if(bucket[c.key].includes(name)){cls+=" "+c.cls;break;} }
    }
    const rec=records?.[name];
    if(rec && (rec.wins>=3||rec.losses>=3)) cls+=" chip-decided";
    if(hintTeams?.includes(name)) cls+=" pickem-hint";
    const recordHtml=rec ? `<span class="pickem-chip-record">${rec.wins}-${rec.losses}</span>` : "";
    return `<button type="button" class="${cls}" data-scope="${scope}" data-team="${pickemEsc(name)}">${name}${recordHtml}</button>`;
  }).join("");
  return `<div class="pickem-stage-card">
    <div class="pickem-stage-header"><b>${title}</b><span class="pickem-live-badge">🟢 Доступен</span></div>
    <div class="pickem-cat-tabs">${tabsHtml}</div>
    <div class="pickem-chip-grid">${chipsHtml}</div>
    <div class="pickem-hint">${footnote}${hintTeams?.length?` <span style="color:var(--accent);">🔮 — по нашей оценке эти команды чаще проходят дальше (не гарантия).</span>`:""}</div>
  </div>`;
}
function renderPickemReviewRows(rows){
  return rows.map(r=>`
    <div class="pickem-review-row">
      <span class="pickem-review-label">${r.label}</span>
      <span class="pickem-review-chips">${r.picks.length?r.picks.map(n=>`<span class="pickem-chip ${r.actual.includes(n)?"review-hit":"review-miss"}">${n}</span>`).join(""):'<span class="pickem-review-empty">— нет прогноза —</span>'}</span>
    </div>`).join("");
}
function renderPickemStageReview(i, st, saved){
  if(!saved){
    return `<div class="pickem-stage-card completed">
      <div class="pickem-stage-header"><b>STAGE ${i}</b><span class="pickem-live-badge">✅ Завершён</span></div>
      <div class="pickem-lock-text">Прогноз на этот этап не был сделан.</div>
    </div>`;
  }
  const actual30=st.teams.filter(t=>t.wins===3&&t.losses===0).map(t=>t.name);
  const actual03=st.teams.filter(t=>t.wins===0&&t.losses===3).map(t=>t.name);
  const actualAdv=st.teams.filter(t=>t.wins>=3).map(t=>t.name);
  const rows=[
    {label:"🟢 3:0",picks:saved.threeZero||[],actual:actual30},
    {label:"➡️ ADVANCE",picks:saved.advance||[],actual:actualAdv},
    {label:"🔴 0:3",picks:saved.zeroThree||[],actual:actual03}
  ];
  const badge=saved.scored?renderPickemResultBadge(saved):'<span class="pickem-live-badge">✅ Завершён</span>';
  return `<div class="pickem-stage-card completed">
    <div class="pickem-stage-header"><b>STAGE ${i}</b>${badge}</div>
    ${renderPickemReviewRows(rows)}
  </div>`;
}
function renderPickemPlayoffReview(saved){
  const rounds=currentTournament.upperRounds||[];
  const qfActual=(rounds[0]||[]).map(m=>m.winner).filter(Boolean);
  const sfActual=(rounds[1]||[]).map(m=>m.winner).filter(Boolean);
  const champActual=rounds.length?rounds[rounds.length-1][0]?.winner:null;
  if(!saved){
    return `<div class="pickem-stage-card completed">
      <div class="pickem-stage-header"><b>🏆 CHAMPIONS STAGE</b><span class="pickem-live-badge">✅ Завершён</span></div>
      <div class="pickem-lock-text">Прогноз на плей-офф не был сделан.</div>
    </div>`;
  }
  const rows=[
    {label:"¼ финал",picks:saved.qf||[],actual:qfActual},
    {label:"½ финал",picks:saved.sf||[],actual:sfActual},
    {label:"🏆 Чемпион",picks:saved.champion?[saved.champion]:[],actual:champActual?[champActual]:[]}
  ];
  const pts=rows.reduce((s,r)=>s+r.picks.filter(n=>r.actual.includes(n)).length,0);
  const max=rows.reduce((s,r)=>s+r.actual.length,0)||7;
  return `<div class="pickem-stage-card completed">
    <div class="pickem-stage-header"><b>🏆 CHAMPIONS STAGE</b><span class="pickem-stage-result ${pts>=Math.ceil(max/2)?"passed":"failed"}">${pts}/${max} pts</span></div>
    ${renderPickemReviewRows(rows)}
  </div>`;
}
function savePickemChoice(){
  if(!currentTournament || !currentTournament.isMajor || !pickemDraft) return;
  const stages={};
  for(let i=1;i<=3;i++){
    const st=currentTournament.majorStages?.[i-1];
    if(!st)continue;
    const prior=currentPickem.major?.stages?.[i];
    if(st.completed){
      if(prior) stages[i]=prior;
      continue;
    }
    const b=pickemDraft.stages[i];
    if(b.threeZero.length!==2||b.advance.length!==6||b.zeroThree.length!==2)
      return alert(`Stage ${i}: выберите 2×3:0, 6×ADVANCE и 2×0:3 (сейчас ${b.threeZero.length}/2, ${b.advance.length}/6, ${b.zeroThree.length}/2).`);
    stages[i]={threeZero:[...b.threeZero], advance:[...b.advance], zeroThree:[...b.zeroThree]};
  }
  const ready=currentTournament.majorStages?.[2]?.completed;
  const qf=pickemDraft.playoffs.qf, sf=pickemDraft.playoffs.sf, champion=pickemDraft.playoffs.champion[0]||null;
  if(ready && !currentTournament.completed) {
    if(qf.length!==4||sf.length!==2||!champion)
      return alert("Плей-офф: выберите 4 победителей четвертьфиналов, затем 2 победителей полуфиналов и чемпиона.");
    if(sf.some(n=>!qf.includes(n)))
      return alert("Плей-офф: победители ½ финала должны выбираться только из ваших 4 победителей ¼.");
    if(!sf.includes(champion))
      return alert("Плей-офф: чемпион должен быть одним из двух выбранных победителей ½ финала.");
  }
  currentPickem.major={stages,playoffs:{qf:[...qf],sf:[...sf],champion}};
  closePickemModal();
  alert("🎯 Major Pick'Em сохранён. Правильные прогнозы будут начислять очки автоматически.");
}
function setupGSLTournament(roster) {
  let groups = [];
  let shuffled = [...roster].sort(() => Math.random() - 0.5);
  for (let g = 0; g < 4; g++) {
    let groupTeams = shuffled.slice(g * 4, (g + 1) * 4);
    groups.push({
      id: g + 1,
      teams: groupTeams,
      matches: {
        opening1: { t1: groupTeams[0].name, t2: groupTeams[1].name, winner: null, score: "", isBO1: true },
        opening2: { t1: groupTeams[2].name, t2: groupTeams[3].name, winner: null, score: "", isBO1: true },
        winners:  { t1: null, t2: null, winner: null, score: "", isBO1: true },
        losers:   { t1: null, t2: null, winner: null, score: "", isBO1: true },
        decider:  { t1: null, t2: null, winner: null, score: "", isBO1: true }
      },
      qualified: [],
      eliminated: []
    });
  }
  currentTournament.gsl = { groups };
}
function renderGSLView(root) {
  root.className = "gsl-container";
  root.innerHTML = "";
  const header = document.createElement("div");
  header.className = "gsl-header";
  header.innerHTML = `<h4>📦 GSL Групповой этап <span>(4 группы по 4 команды, Топ-8 в плей-офф)</span></h4>`;
  root.appendChild(header);
  const grid = document.createElement("div");
  grid.className = "gsl-groups-grid";
  const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, ch => ({
    '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'
  }[ch]));
  const teamLabel = (name) => {
    if (!name) return "TBD";
    const team = teams.find(t => t.name === name);
    const rank = team ? teams.indexOf(team) + 1 : null;
    return `${escapeHtml(name)}${rank ? ` <span class="bracket-team-rank">#${rank}</span>` : ""}`;
  };
const makeGSLMatch = (m, onAction) => {
    const card = document.createElement("div");
    card.className = "match gsl-match";
    if (!m) return card;
    const broadcastItem = getBroadcastItemByMatch(m);
    if (m.broadcastStatus === "live") {
      card.classList.add("live-broadcast");
      const bState = broadcastItem?.state;
      if (bState?.phase === 'tactical-pause') card.classList.add('broadcast-paused');
      if (bState?.overtime) card.classList.add('broadcast-overtime');
    }
    const makeTeam = (name, side) => {
      const btn = document.createElement("button");
      btn.className = `team-btn ${!name ? 'tbd-slot' : ''} ${m.winner === name && name ? "winner" : ""}`;
      btn.innerHTML = `<span>${teamLabel(name)}</span>`;
      btn.disabled = !m.t1 || !m.t2 || m.winner !== null || m.broadcastStatus === 'live' || currentTournament.completed;
      btn.onclick = (e) => { e.stopPropagation(); handleMatchOpen(m, onAction); };
      return btn;
    };
    card.appendChild(makeTeam(m.t1, 1));
    card.appendChild(makeTeam(m.t2, 2));
    if (m.t1 && m.t2) {
      const liveOdds = broadcastItem?.state?.liveOdds;
      const baseOdds = calcMatchOdds(m.t1, m.t2, !!m.isBO1) || {pct1:50, pct2:50, c1:'1.88', c2:'1.88'};
      const odds = liveOdds ? {
        pct1: liveOdds.p1,
        pct2: liveOdds.p2,
        c1: liveOdds.c1,
        c2: liveOdds.c2
      } : baseOdds;
      const betting = document.createElement('div');
      betting.className = 'betting-bar-container';
      betting.innerHTML = `
        <div class="prob-bar">
          <div class="prob-bar-fill" style="width:${odds.pct1 ?? 50}%"></div>
        </div>
        <div class="bet-info-row">
          <span>${odds.pct1 ?? 50}% • ${odds.c1 || '1.88'}x</span>
          <span>${odds.c2 || '1.88'}x • ${odds.pct2 ?? 50}%</span>
        </div>`;
      card.appendChild(betting);
    }
    if (m.broadcastStatus === "live") {
      const liveScore = document.createElement("div");
      liveScore.className = "match-live-score";
      liveScore.innerText = m.broadcastScore || "LIVE • 0:0";
      card.appendChild(liveScore);
      const detailBtn = document.createElement("button");
      detailBtn.className = "secondary broadcast-detail-btn";
      detailBtn.innerText = "📺 Детали матча";
      detailBtn.onclick = (e) => { e.stopPropagation(); openBroadcastMatchDetail(broadcastMatchKey(m)); };
      card.appendChild(detailBtn);
} else if (m.score) {
      if (m.broadcastResult?.maps?.length) {
        card.classList.add('completed-broadcast-result');
        card.style.cursor = 'pointer';
        card.title = 'Нажмите, чтобы открыть результаты карт';
        card.onclick = () => openCompletedMatchResult(m);
      }
      const scoreDiv = document.createElement("div");
      scoreDiv.style.fontSize = "9px";
      scoreDiv.style.textAlign = "center";
      scoreDiv.style.color = "var(--text-muted)";
      scoreDiv.style.padding = "2px";
      scoreDiv.innerText = m.score;
      card.appendChild(scoreDiv);
      if (m.broadcastResult?.maps?.length) {
        const resultBtn = document.createElement('button');
        resultBtn.className = 'secondary broadcast-detail-btn';
        resultBtn.innerText = '📺 Детали матча';
        resultBtn.title = 'Открыть карты, счёт и раунды матча';
        resultBtn.onclick = (e) => { e.stopPropagation(); openCompletedMatchResult(m); };
        card.appendChild(resultBtn);
      }
    }
    return card;
  };
  const groups = Array.isArray(currentTournament?.gsl?.groups) ? currentTournament.gsl.groups : [];
  if (groups.length !== 4) {
    const empty = document.createElement('div');
    empty.className = 'gsl-empty-state';
    empty.textContent = 'Ожидание данных GSL…';
    root.appendChild(empty);
    return;
  }
  groups.forEach((grp, gIdx) => {
    const box = document.createElement("section");
    box.className = "gsl-group-box";
    box.innerHTML = `<div class="gsl-group-title">ГРУППА ${String.fromCharCode(65 + gIdx)}</div>`;
    const flow = document.createElement("div");
    flow.className = "gsl-group-flow";
    const addRow = (label, matches) => {
      const row = document.createElement("div");
      row.className = "gsl-match-row";
      if (label) {
        const labelEl = document.createElement("div");
        labelEl.className = "gsl-match-label";
        labelEl.textContent = label;
        row.appendChild(labelEl);
      }
      const cards = document.createElement("div");
      cards.className = "gsl-match-pair";
      matches.forEach(([key, match]) => {
        cards.appendChild(makeGSLMatch(match, () => resolveGSLMatch(gIdx, key)));
      });
      row.appendChild(cards);
      flow.appendChild(row);
    };
    addRow("СТАРТ", [["opening1", grp.matches.opening1], ["opening2", grp.matches.opening2]]);
    addRow("1–0 / 0–1", [["winners", grp.matches.winners], ["losers", grp.matches.losers]]);
    addRow("РЕШАЮЩИЙ", [["decider", grp.matches.decider]]);
    box.appendChild(flow);
    grid.appendChild(box);
  });
  root.appendChild(grid);
}
function resolveGSLMatch(gIdx, mKey) {
  if (!currentTournament?.gsl?.groups?.[gIdx]) return;
  const grp = currentTournament.gsl.groups[gIdx];
  const m = grp.matches?.[mKey];
  if (!m || !m.t1 || !m.t2 || !m.winner) return;
  if (m.__resolved) return;
  m.__resolved = true;
  const winner = m.winner;
  const loser = (winner === m.t1) ? m.t2 : m.t1;
  recordH2HWin(winner, loser);
  updateFatigueAndForm(winner, loser);
  accumulateMatchRating(winner, loser, m.isBO1);
  if (mKey === 'opening1' || mKey === 'opening2') {
    let wKey = (mKey === 'opening1') ? 't1' : 't2';
    let lKey = (mKey === 'opening1') ? 't1' : 't2';
    if (!grp.matches.winners.t1) grp.matches.winners[wKey] = winner; else grp.matches.winners.t2 = winner;
    if (!grp.matches.losers.t1) grp.matches.losers[lKey] = loser; else grp.matches.losers.t2 = loser;
  } else if (mKey === 'winners') {
    grp.qualified.push(winner);
    grp.matches.decider.t1 = loser;
  } else if (mKey === 'losers') {
    grp.eliminated.push(loser);
    currentTournament.placements[loser] = { place: 12, title: `GSL Вылет (Группа ${String.fromCharCode(65 + gIdx)})` };
    grp.matches.decider.t2 = winner;
  } else if (mKey === 'decider') {
    grp.qualified.push(winner);
    grp.eliminated.push(loser);
    currentTournament.placements[loser] = { place: 12, title: `GSL Вылет (Группа ${String.fromCharCode(65 + gIdx)})` };
  }
  const allDone = currentTournament.gsl.groups.every(g => {
    const q = [...new Set((g.qualified || []).filter(Boolean))];
    return q.length === 2 && !!g.matches?.opening1?.winner && !!g.matches?.opening2?.winner &&
      !!g.matches?.winners?.winner && !!g.matches?.losers?.winner && !!g.matches?.decider?.winner;
  });
  if (allDone) {
    if (finalizeGSLStage()) return;
  }
  renderTournament();
}
function finalizeGSLStage() {
  if (!currentTournament || !currentTournament.gsl) return false;
  const playoffTeamsNames = [];
  currentTournament.gsl.groups.forEach(g => {
    const unique = [...new Set((g.qualified || []).filter(Boolean))].slice(0, 2);
    g.qualified = unique;
    playoffTeamsNames.push(...unique);
  });
  if (playoffTeamsNames.length !== 8) {
    console.error('GSL: переход в плей-офф отменён — квалифицировано не 8 команд', playoffTeamsNames);
    return false;
  }
  const playoffRoster = playoffTeamsNames.map(name => teams.find(t => t.name === name)).filter(Boolean);
  if (playoffRoster.length !== 8) {
    console.error('GSL: не удалось собрать ростер плей-офф', playoffTeamsNames);
    return false;
  }
  const priorGsl = currentTournament.gsl;
  const priorFormat = currentTournament.formatChoice;
  const priorSize = currentTournament.size;
  const priorUpper = currentTournament.upperRounds;
  const priorLower = currentTournament.lowerRounds;
  const priorGrand = currentTournament.grandFinal;
  const priorBronze = currentTournament.bronzeMatch;
  if (typeof window.hubCaptureGroupStages === 'function') window.hubCaptureGroupStages();
  currentTournament.gsl = null;
  currentTournament.formatChoice = 'single';
  currentTournament.size = 8;
  currentTournament.hasLowerBracket = false;
  currentTournament.completed = false;
  currentTournament.upperRounds = [];
  currentTournament.lowerRounds = [];
  currentTournament.grandFinal = null;
  currentTournament.bronzeMatch = null;
  setupBracketTournament(playoffRoster, 'single');
  if (!currentTournament.upperRounds?.length || currentTournament.upperRounds[0]?.length !== 4) {
    console.error('GSL: плей-офф не создался корректно', currentTournament.upperRounds);
    currentTournament.gsl = priorGsl;
    currentTournament.formatChoice = priorFormat;
    currentTournament.size = priorSize;
    currentTournament.upperRounds = priorUpper;
    currentTournament.lowerRounds = priorLower;
    currentTournament.grandFinal = priorGrand;
    currentTournament.bronzeMatch = priorBronze;
    return false;
  }
  currentTournament.gslPlayoff = true;
  currentTournament.gslQualified = [...playoffTeamsNames];
  const status = document.getElementById('tour-status');
  if (status) status.innerText = '📦 GSL завершён • начался плей-офф (Топ-8)';
  renderRating();
  renderTournament();
  return true;
}
function setupSwissTournament(roster) {
  let swissTeams = roster.map(t => ({ name: t.name, wins: 0, losses: 0, diff: 0, status: "active", playedAgainst: [] }));
  currentTournament.swiss = { teams: swissTeams, currentRound: 1, rounds: [] };
  generateSwissRound(1);
}
function setupBountyTournament(roster) {
  const sorted = [...roster].sort((a, b) => (b.pts || 0) - (a.pts || 0));
  const stage1 = [];
  for (let i = 0; i < 16; i++) {
    stage1.push({
      t1: sorted[i].name,
      t2: sorted[31 - i].name,
      winner: null,
      score: "",
      isBO1: true,
      bountyStage: 1
    });
  }
  const stage2 = [];
  for (let i = 0; i < 8; i++) {
    stage2.push({
      t1: null,
      t2: null,
      winner: null,
      score: "",
      isBO1: false,
      bountyStage: 2
    });
  }
  currentTournament.bounty = {
    stage1: shuffleArray(stage1),
    stage2,
    lanStageStarted: false
  };
}
function resolveBountyMatch(stageNum, mIdx) {
  const b = currentTournament.bounty;
  if (!b) return;
  if (stageNum === 1) {
    const m = b.stage1[mIdx];
    if (!m || !m.winner) return;
    const loser = (m.winner === m.t1) ? m.t2 : m.t1;
    currentTournament.placements[loser] = { place: 17, title: "Вылет в Стадии 1 Bounty" };
    recordH2HWin(m.winner, loser);
    updateFatigueAndForm(m.winner, loser);
    accumulateMatchRating(m.winner, loser, stageNum === 1);
    const target = b.stage2[Math.floor(mIdx / 2)];
    if (mIdx % 2 === 0) target.t1 = m.winner;
    else target.t2 = m.winner;
  }
  else if (stageNum === 2) {
    const m = b.stage2[mIdx];
    if (!m || !m.winner) return;
    const loser = (m.winner === m.t1) ? m.t2 : m.t1;
    currentTournament.placements[loser] = { place: 9, title: "Вылет в шаге от LAN-финала" };
    recordH2HWin(m.winner, loser);
    updateFatigueAndForm(m.winner, loser);
    accumulateMatchRating(m.winner, loser, false);
    const allStage2Done = b.stage2.every(x => x.winner !== null);
    if (allStage2Done && !b.lanStageStarted) {
      b.lanStageStarted = true;
      const lanTeams = b.stage2.map(x => teams.find(t => t.name === x.winner)).filter(Boolean);
      alert("🎯 Топ-8 команд вышли на LAN-финал BLAST Bounty!");
      currentTournament.size = 8;
      currentTournament.formatChoice = "single";
      if (typeof window.hubCaptureGroupStages === 'function') window.hubCaptureGroupStages();
      currentTournament.bounty = null;
      setupBracketTournament(lanTeams, "single");
    }
  }
  renderTournament();
}
function generateSwissRound(roundNum) {
  let active = currentTournament.swiss.teams.filter(t => t.wins < 3 && t.losses < 3);
  active.sort((a, b) => b.wins - a.wins || a.losses - b.losses || b.diff - a.diff);
  let roundMatches = [];
  let paired = new Set();
  for (let i = 0; i < active.length; i++) {
    if (paired.has(active[i].name)) continue;
    let t1 = active[i];
    let t2 = null;
    for (let j = i + 1; j < active.length; j++) {
      let cand = active[j];
      if (!paired.has(cand.name) && cand.wins === t1.wins && !t1.playedAgainst.includes(cand.name)) {
        t2 = cand;
        break;
      }
    }
    if (!t2) {
      for (let j = i + 1; j < active.length; j++) {
        let cand2 = active[j];
        if (!paired.has(cand2.name) && cand2.wins === t1.wins) { t2 = cand2; break; }
      }
    }
    if (!t2) {
      for (let j = i + 1; j < active.length; j++) {
        if (!paired.has(active[j].name)) { t2 = active[j]; break; }
      }
    }
    if (t2) {
      paired.add(t1.name);
      paired.add(t2.name);
      t1.playedAgainst.push(t2.name);
      t2.playedAgainst.push(t1.name);
      const isBO3 = (t1.wins === 2 || t1.losses === 2);
      roundMatches.push({ t1: t1.name, t2: t2.name, winner: null, score: "", isBO1: !isBO3, isSwiss: true });
    }
  }
  currentTournament.swiss.rounds.push(roundMatches);
}
function renderSwissView(root) {
  root.className = "swiss-container";
  const s = currentTournament.swiss;
  let header = document.createElement("div");
  header.innerHTML = `<h4>🇨🇭 Швейцарский этап (Раунд ${s.currentRound} из 5)</h4>`;
  root.appendChild(header);
  let roundRow = document.createElement("div");
  roundRow.className = "swiss-round-row";
  s.rounds.forEach((round, rIdx) => {
    let col = document.createElement("div");
    col.className = "round";
    col.innerHTML = `<div class="round-title">Раунд ${rIdx + 1}</div>`;
    let mBox = document.createElement("div");
    mBox.className = "round-matches-container";
    round.forEach((m, mIdx) => {
      mBox.appendChild(createMatchElement(m, () => resolveSwissMatch(rIdx, mIdx)));
    });
    col.appendChild(mBox);
    roundRow.appendChild(col);
  });
  root.appendChild(roundRow);
  let table = document.createElement("div");
  table.className = "swiss-standings-table";
  let sortedTeams = [...s.teams].sort((a, b) => b.wins - a.wins || a.losses - b.losses || b.diff - a.diff);
  let rows = sortedTeams.map((t, idx) => `
    <tr>
      <td>#${idx + 1}</td>
      <td><b>${t.name}</b></td>
      <td><span style="color:var(--win); font-weight:bold;">${t.wins}W</span> - <span style="color:var(--loss); font-weight:bold;">${t.losses}L</span></td>
      <td>${t.diff > 0 ? '+'+t.diff : t.diff}</td>
      <td><b>${t.wins >= 3 ? '✅ Выход в Play-off' : (t.losses >= 3 ? '❌ Вылет' : 'В игре')}</b></td>
    </tr>
  `).join("");
  table.innerHTML = `
    <table>
      <thead><tr><th>#</th><th>Команда</th><th>Счет</th><th>Дифф</th><th>Статус</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
  `;
  root.appendChild(table);
}
function resolveSwissMatch(rIdx, mIdx) {
  const m = currentTournament.swiss.rounds[rIdx][mIdx];
  const winner = m.winner;
  const loser = (winner === m.t1) ? m.t2 : m.t1;
  let wObj = currentTournament.swiss.teams.find(t => t.name === winner);
  let lObj = currentTournament.swiss.teams.find(t => t.name === loser);
  if (wObj) { wObj.wins++; wObj.diff += 2; }
  if (lObj) { lObj.losses++; lObj.diff -= 2; }
  recordH2HWin(winner, loser);
  updateFatigueAndForm(winner, loser);
  accumulateMatchRating(winner, loser, m.isBO1);
  const roundDone = currentTournament.swiss.rounds[rIdx].every(match => match.winner !== null);
  if (roundDone) {
    if (currentTournament.swiss.currentRound < 5) {
      currentTournament.swiss.currentRound++;
      generateSwissRound(currentTournament.swiss.currentRound);
    } else {
      finalizeSwissStage();
      return;
    }
  }
  renderTournament();
}
function finalizeSwissStage() {
  let adv = currentTournament.swiss.teams.filter(t => t.wins >= 3).map(t => teams.find(x => x.name === t.name));
  let elim = currentTournament.swiss.teams.filter(t => t.losses >= 3);
  elim.forEach(t => { currentTournament.placements[t.name] = { place: 12, title: `Swiss Stage (${t.wins}-${t.losses})` }; });
  alert(`🇨🇭 Швейцарский этап завершен! Топ-8 команд вышли в плей-офф!`);
  currentTournament.formatChoice = "single";
  currentTournament.size = 8;
  if (typeof window.hubCaptureGroupStages === 'function') window.hubCaptureGroupStages();
  currentTournament.swiss = null;
  setupBracketTournament(adv, "single");
  renderRating();
  renderTournament();
}
function setupBracketTournament(roster, formatChoice) {
  let size = currentTournament.size;
  let seededNames = shuffleArray([...roster]).map(t => t.name);
  currentTournament.upperRounds = [];
  let firstRound = [];
  for (let i = 0; i < size; i += 2) {
    firstRound.push({ t1: seededNames[i], t2: seededNames[i+1], winner: null, score: "", isBO1: false });
  }
  currentTournament.upperRounds.push(firstRound);
  let curSize = size / 2;
  while (curSize > 1) {
    curSize /= 2;
    let next = [];
    for (let i = 0; i < curSize; i++) {
      const isFinalRound = (curSize === 1 && !currentTournament.hasLowerBracket);
      next.push({
        t1: null, t2: null, winner: null, score: "", isBO1: false,
        isBO5: (isFinalRound && currentTournament.finalFormat === "BO5")
      });
    }
    currentTournament.upperRounds.push(next);
  }
  if (currentTournament.hasLowerBracket) {
    currentTournament.lowerRounds = [];
    let lowerCounts = (size === 8) ? [2, 2, 1, 1] : [4, 4, 2, 2, 1, 1];
    lowerCounts.forEach(count => {
      currentTournament.lowerRounds.push(createEmptyRound(count));
    });
    currentTournament.grandFinal = {
      t1: null, t2: null, winner: null, score: "",
      isBO5: (currentTournament.finalFormat === "BO5")
    };
    currentTournament.bronzeMatch = null;
  } else {
    currentTournament.grandFinal = null;
    currentTournament.bronzeMatch = currentTournament.isMajor
      ? null
      : { t1: null, t2: null, winner: null, score: "", isBO1: false };
  }
}
function createEmptyRound(count) {
  let r = [];
  for (let i = 0; i < count; i++) r.push({ t1: null, t2: null, winner: null, score: "" });
  return r;
}
function drawBracketConnectors(columns, bracketType = "single") {
  try {
    if (!columns) return;
    columns.querySelector(".bracket-connector-layer")?.remove();
    const rounds = [...columns.querySelectorAll(":scope > .round")];
    if (rounds.length < 2) return;
    const base = columns.getBoundingClientRect();
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.classList.add("bracket-connector-layer");
    const width = Math.max(columns.scrollWidth, base.width);
    const height = Math.max(columns.scrollHeight, base.height);
    svg.setAttribute("width", width);
    svg.setAttribute("height", height);
    svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
    const addPath = (from, to) => {
      if (!from || !to) return;
      const a = from.getBoundingClientRect();
      const b = to.getBoundingClientRect();
      if (!a.width || !b.width) return;
      const x1 = a.right - base.left;
      const y1 = a.top + a.height / 2 - base.top;
      const x2 = b.left - base.left;
      const y2 = b.top + b.height / 2 - base.top;
      const mx = x1 + Math.max(10, (x2 - x1) * 0.5);
      const p = document.createElementNS("http://www.w3.org/2000/svg", "path");
      p.setAttribute("d", `M${x1} ${y1}H${mx}V${y2}H${x2}`);
      svg.appendChild(p);
    };
   for (let r = 1; r < rounds.length; r++) {
      const prior = [...rounds[r - 1].querySelectorAll(":scope > .round-matches-container > .bracket-match-slot")];
      const curr = [...rounds[r].querySelectorAll(":scope > .round-matches-container > .bracket-match-slot")];
      if (!prior.length || !curr.length) continue;
      if (bracketType === "double-lower") {
        if (prior.length === curr.length) {
          curr.forEach((slot, i) => {
            if (prior[i]) addPath(prior[i], slot);
          });
        } else if (prior.length === curr.length * 2) {
          curr.forEach((slot, i) => {
            if (prior[i * 2]) addPath(prior[i * 2], slot);
            if (prior[i * 2 + 1]) addPath(prior[i * 2 + 1], slot);
          });
        } else {
          curr.forEach((slot, i) => {
            if (prior[i]) addPath(prior[i], slot);
          });
        }
      } else {
        curr.forEach((slot, i) => {
          if (curr.length === 1 && prior.length === 1) {
            addPath(prior[0], slot);
          } else {
            if (prior[i * 2]) addPath(prior[i * 2], slot);
            if (prior[i * 2 + 1]) addPath(prior[i * 2 + 1], slot);
          }
        });
      }
    }
    columns.insertBefore(svg, columns.firstChild);
  } catch (err) {
    console.warn("Ошибка отрисовки линий сетки:", err);
  }
}
function drawDoubleGrandFinalConnectors(root) {
  try {
    if (!root) return;
    root.querySelectorAll(".double-grand-connector-layer").forEach(el => el.remove());
    const upperMatches = [...root.querySelectorAll(".upper-bracket-wrap .round:not(.grand-final-center-col) .match")];
    const upMatch = upperMatches[upperMatches.length - 1];
    const lowerMatches = [...root.querySelectorAll(".lower-bracket-wrap .round:last-child .match")];
    const loMatch = lowerMatches[lowerMatches.length - 1];
    const grMatch = root.querySelector(".grand-final-center-col .match");
    if (!upMatch || !loMatch || !grMatch) return;
    root.style.position = "relative";
    const base = root.getBoundingClientRect();
    const w = Math.max(root.scrollWidth, root.offsetWidth, 1200);
    const h = Math.max(root.scrollHeight, root.offsetHeight, 800);
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.classList.add("bracket-connector-layer", "double-grand-connector-layer");
    svg.setAttribute("width", w);
    svg.setAttribute("height", h);
    svg.setAttribute("viewBox", `0 0 ${w} ${h}`);
    svg.style.cssText = "position:absolute; inset:0; pointer-events:none; z-index:3; overflow:visible;";
    const gRect = grMatch.getBoundingClientRect();
    const gx = gRect.left - base.left;
    const gy = gRect.top + gRect.height / 2 - base.top;
    const uRect = upMatch.getBoundingClientRect();
    const ux = uRect.right - base.left;
    const uy = uRect.top + uRect.height / 2 - base.top;
    const umx = ux + Math.max(14, (gx - ux) * 0.5);
    const pathUp = document.createElementNS("http://www.w3.org/2000/svg", "path");
    pathUp.setAttribute("d", `M${ux} ${uy} H${umx} V${gy} H${gx}`);
    pathUp.setAttribute("fill", "none");
    pathUp.setAttribute("stroke", "rgba(251,197,49,0.85)");
    pathUp.setAttribute("stroke-width", "1.75");
    pathUp.setAttribute("vector-effect", "non-scaling-stroke");
    svg.appendChild(pathUp);
    const lRect = loMatch.getBoundingClientRect();
    const lx = lRect.right - base.left;
    const ly = lRect.top + lRect.height / 2 - base.top;
    const lmx = lx + Math.max(16, (gx - lx) * 0.5);
    const pathLo = document.createElementNS("http://www.w3.org/2000/svg", "path");
    pathLo.setAttribute("d", `M${lx} ${ly} H${lmx} V${gy} H${gx}`);
    pathLo.setAttribute("fill", "none");
    pathLo.setAttribute("stroke", "#4bcffa");
    pathLo.setAttribute("stroke-width", "1.75");
    pathLo.setAttribute("vector-effect", "non-scaling-stroke");
    svg.appendChild(pathLo);
    root.appendChild(svg);
  } catch (err) {
    console.warn("Ошибка отрисовки линий к гранд-финалу:", err);
  }
}
function renderQualificationView() {
  const host = document.getElementById("qualification-root");
  if (!host) return;
  host.innerHTML = "";
  if (!currentTournament || !currentTournament.qualification) return;
  const q = currentTournament.qualification;
  const box = document.createElement("div");
  box.className = "qualifier-box";
  let winnersText = Array.isArray(q.winner)
    ? q.winner.map(w => w.name || w).join(', ')
    : (q.winner?.name || q.winner || "—");
  box.innerHTML = `
    <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:6px;">
      <div>
        <span class="qualifier-title">🎟️ РЕГИОНАЛЬНЫЕ КВАЛИФИКАЦИИ (Round Robin):</span>
        <span style="font-size:10px; color:var(--text-muted); margin-left:6px;">
          Прошли на турнир: <b style="color:var(--win); font-size:10.5px;">${winnersText}</b>
        </span>
      </div>
      <button class="secondary" id="toggle-qual-matches-btn" style="font-size:9px; padding:2px 7px; color:var(--accent); border-color:var(--accent); border-radius:3px;">
        📋 Таблица RR
      </button>
    </div>
    <div style="display:none; margin-top:5px; max-height:85px; overflow-y:auto;" id="qualifier-matches-details"></div>
  `;
  const grid = box.querySelector("#qualifier-matches-details");
  q.rounds.flat().forEach(m => {
    const el = document.createElement("div");
    el.className = "qualifier-match";
    el.style.margin = "2px 0";
    el.innerHTML = `${m.t1} <b>${m.score}</b> ${m.t2} — <span style="color:var(--win);">Победитель: ${m.winner}</span>`;
    grid.appendChild(el);
  });
  const toggleBtn = box.querySelector("#toggle-qual-matches-btn");
  toggleBtn.onclick = () => {
    const isHidden = grid.style.display === "none";
    grid.style.display = isHidden ? "block" : "none";
    toggleBtn.innerText = isHidden ? "✕ Скрыть" : "📋 Таблица RR";
  };
  host.appendChild(box);
}
function esc(s) { return String(s ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch])); }
function renderTournament() {
  const root = document.getElementById("bracket-root-layout");
  if (!root) return;
  const priorHTML = root.innerHTML;
  const priorClass = root.className;
  const stage = document.createElement("div");
  stage.id = "bracket-root-staging";
  stage.className = priorClass || "";
  try {
    if (currentTournament?.completed) {
      const champ = Object.entries(currentTournament.placements || {}).find(([name, p]) => p?.place === 1)?.[0] || '—';
      const gf = currentTournament.grandFinal || currentTournament.upperRounds?.at(-1)?.[0];
      const result = document.createElement('div');
      result.className = 'tournament-complete-banner';
      result.innerHTML = `<span>🏆 ТУРНИР ЗАВЕРШЕН</span><b>${esc(champ)}</b><em>${gf?.score || 'Финал сыгран'}</em>`;
      stage.appendChild(result);
    }
    renderQualificationView();
    if (currentTournament?.isMajor && currentTournament.majorStages) {
      document.getElementById("bronze-section").style.display = "none";
      renderMajorView(stage);
    } else if (currentTournament?.formatChoice === "swiss") {
      document.getElementById("bronze-section").style.display = "none";
      renderSwissView(stage);
    } else if (currentTournament?.formatChoice === "gsl" && currentTournament?.gsl) {
      document.getElementById("bronze-section").style.display = "none";
      renderGSLView(stage);
    } else if (currentTournament?.gslPlayoff && currentTournament?.formatChoice === "single") {
      document.getElementById("bronze-section").style.display = "none";
      const playoffHead = document.createElement("div");
      playoffHead.className = "gsl-header";
      playoffHead.innerHTML = `<h4>🏆 ПЛЕЙ-ОФФ GSL <span>(Топ-8 • ¼ финала → ½ финала → финал)</span></h4>`;
      stage.appendChild(playoffHead);
      renderSingleElimView(stage);
    } else if (currentTournament?.formatChoice === "bounty" && currentTournament?.bounty) {
      document.getElementById("bronze-section").style.display = "none";
      renderBountyView(stage);
    } else if (currentTournament?.hasLowerBracket) {
      document.getElementById("bronze-section").style.display = "none";
      renderDoubleElimView(stage);
    } else if (currentTournament) {
      renderSingleElimView(stage);
    }
    root.className = stage.className;
    root.replaceChildren(...Array.from(stage.childNodes));
  } catch (err) {
    console.error("Ошибка рендера турнира — старая сетка сохранена:", err);
    root.className = priorClass;
    root.innerHTML = priorHTML;
    const status = document.getElementById("tour-status");
    if (status) status.innerText = "⚠️ Ошибка отображения сетки — данные турнира сохранены";
  }}
function renderBountyView(root) {
  root.className = "bounty-layout-wrap";
  root.innerHTML = "";
  const header = document.createElement("div");
  header.style.cssText = "width:100%; box-sizing:border-box; margin-bottom:12px; padding:10px 14px; background:linear-gradient(90deg, rgba(229,142,38,.14), rgba(15,18,24,.85)); border:1px solid var(--accent); border-radius:8px;";
  header.innerHTML = `
    <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:6px;">
      <b style="color:var(--accent); font-size:13.5px;">🎯 BLAST BOUNTY HUNT (32 команды)</b>
      <span style="font-size:10.5px; color:var(--gold); font-weight:bold;">28 инвайтов по рейтингу + 4 из Квалификаций</span>
    </div>
    <div style="font-size:10px; color:var(--text-muted); margin-top:3px;">
      Стадия 1 (16 пар BO1) ➔ Стадия 2 (8 пар BO3 за выход на арену) ➔ <b>LAN-финал Top-8 (Playoffs Single Elim)</b>
    </div>
  `;
  root.appendChild(header);
  const cols = document.createElement("div");
  cols.className = "bracket-columns";
  const col1A = document.createElement("div");
  col1A.className = "round";
  col1A.innerHTML = `<div class="round-title">Стадия 1: Группа A (8 пар • BO3)</div>`;
  const mBox1A = document.createElement("div");
  mBox1A.className = "round-matches-container bracket-round";
  for (let i = 0; i < 8; i++) {
    mBox1A.appendChild(createMatchElement(currentTournament.bounty.stage1[i], () => resolveBountyMatch(1, i)));
  }
  col1A.appendChild(mBox1A);
  cols.appendChild(col1A);
  const col1B = document.createElement("div");
  col1B.className = "round";
  col1B.innerHTML = `<div class="round-title">Стадия 1: Группа B (8 пар • BO3)</div>`;
  const mBox1B = document.createElement("div");
  mBox1B.className = "round-matches-container bracket-round";
  for (let i = 8; i < 16; i++) {
    mBox1B.appendChild(createMatchElement(currentTournament.bounty.stage1[i], () => resolveBountyMatch(1, i)));
  }
  col1B.appendChild(mBox1B);
  cols.appendChild(col1B);
  const col2 = document.createElement("div");
  col2.className = "round";
  col2.style.marginLeft = "18px";
  col2.innerHTML = `<div class="round-title" style="color:var(--gold); border-bottom-color:var(--gold);">Стадия 2 (Квалификация на LAN • BO3)</div>`;
  const mBox2 = document.createElement("div");
  mBox2.className = "round-matches-container bracket-round";
  mBox2.style.gap = "14px";
  currentTournament.bounty.stage2.forEach((m, idx) => {
    mBox2.appendChild(createMatchElement(m, () => resolveBountyMatch(2, idx)));
  });
  col2.appendChild(mBox2);
  cols.appendChild(col2);
  root.appendChild(cols);
}
function getPlayoffStageName(roundIndex, totalRounds) {
  const fromEnd = totalRounds - 1 - roundIndex;
  if (fromEnd === 0) return "Финал";
  if (fromEnd === 1) return "Полуфинал";
  if (fromEnd === 2) return "Четвертьфинал";
  if (fromEnd === 3) return "1/8 финала";
  return `Раунд ${roundIndex + 1}`;
}
function renderDoubleElimView(root) {
  root.className = "tournament-grid-double";
  root.innerHTML = "";
  const makeBracket = (rounds, lower = false) => {
    const wrap = document.createElement("div");
    wrap.className = lower ? "lower-bracket-wrap" : "upper-bracket-wrap";
    const title = document.createElement("div");
    title.style.cssText = "font-size:11.5px;font-weight:bold;margin-bottom:6px;";
    title.style.color = lower ? "#4bcffa" : "#fbc531";
    title.textContent = lower ? "НИЖНЯЯ СЕТКА" : "ВЕРХНЯЯ СЕТКА";
    wrap.appendChild(title);
    const cols = document.createElement("div");
    cols.className = "bracket-columns";
    const total = rounds.length;
    rounds.forEach((round, rIndex) => {
      const col = document.createElement("div");
      col.className = "round";
      const titleEl = document.createElement("div");
      titleEl.className = "round-title";
      titleEl.textContent = lower ? `Лузера: Р${rIndex + 1}` : getPlayoffStageName(rIndex, total);
      col.appendChild(titleEl);
      const matchesBox = document.createElement("div");
      matchesBox.className = "round-matches-container bracket-round";
      let top = 0;
      let gap = 10;
      if (!lower) {
        const matchHeight = 65;
        gap = Math.max(10, Math.pow(2, rIndex) * (matchHeight + 10) - matchHeight);
        top = rIndex === 0 ? 0 : Math.round((gap - 10) / 2);
      } else {
        top = (rIndex % 2 === 1) ? 18 : 0;
        gap = (rIndex % 2 === 1) ? 24 : 12;
      }
      matchesBox.style.paddingTop = `${top}px`;
      matchesBox.style.gap = `${gap}px`;
      matchesBox.style.paddingTop = `${top}px`;
      matchesBox.style.gap = `${gap}px`;
      round.forEach((m, mIndex) => {
        const slot = document.createElement("div");
        slot.className = "bracket-match-slot";
        slot.appendChild(createMatchElement(
          m,
          () => lower ? resolveLowerMatch(rIndex, mIndex) : resolveUpperMatch(rIndex, mIndex),
          !lower && rIndex === total - 1
        ));
        matchesBox.appendChild(slot);
      });
      col.appendChild(matchesBox);
      cols.appendChild(col);
    });
    wrap.appendChild(cols);
    requestAnimationFrame(() => drawBracketConnectors(cols, lower ? 'double-lower' : 'upper'));
    return wrap;
  };
  const upperWrap = makeBracket(currentTournament.upperRounds, false);
  const grandCol = document.createElement("div");
  grandCol.className = "grand-final-center-col round";
  grandCol.innerHTML = `
    <div class="grand-trophy-badge">🏆 ГРАНД-ФИНАЛ (${currentTournament.finalFormat})</div>
    <div style="font-size:9.5px;color:var(--text-muted);margin-bottom:6px;text-align:center;">Верхняя vs Лузера</div>
  `;
  const grandSlot = document.createElement("div");
  grandSlot.className = "bracket-match-slot";
  grandSlot.appendChild(createMatchElement(currentTournament.grandFinal, () => resolveGrandFinal(), true));
  grandCol.appendChild(grandSlot);
  const upperCols = upperWrap.querySelector(".bracket-columns");
  if (upperCols) {
    upperCols.appendChild(grandCol);
  }
  root.appendChild(upperWrap);
  root.appendChild(makeBracket(currentTournament.lowerRounds, true));
  requestAnimationFrame(() => {
    setTimeout(() => drawDoubleGrandFinalConnectors(root), 30);
  });
}
function renderSingleElimView(root) {
  root.className = "tournament-grid-single";
  root.innerHTML = "";
  const cols = document.createElement("div");
  cols.className = "bracket-columns";
  const total = currentTournament.upperRounds.length;
  currentTournament.upperRounds.forEach((round, rIndex) => {
    const col = document.createElement("div");
    col.className = "round";
    const isFinal = rIndex === total - 1;
    const title = document.createElement("div");
    title.className = "round-title";
    title.innerHTML = isFinal ? `🏆 Финал (${currentTournament.finalFormat})` : getPlayoffStageName(rIndex, total);
    col.appendChild(title);
    const matchesBox = document.createElement("div");
    matchesBox.className = "round-matches-container bracket-round";
    const top = rIndex * 34;
    const gap = 24 + rIndex * 24;
    matchesBox.style.paddingTop = `${top}px`;
    matchesBox.style.gap = `${gap}px`;
    round.forEach((m, mIndex) => {
      const slot = document.createElement("div");
      slot.className = "bracket-match-slot";
      slot.appendChild(createMatchElement(m, () => resolveUpperMatch(rIndex, mIndex), isFinal));
      matchesBox.appendChild(slot);
    });
    col.appendChild(matchesBox);
    cols.appendChild(col);
  });
  root.appendChild(cols);
  requestAnimationFrame(() => drawBracketConnectors(cols));
  const bronzeSection = document.getElementById("bronze-section");
  if (currentTournament.bronzeMatch) {
    bronzeSection.style.display = "block";
    const bronzeContainer = document.getElementById("bronze-bracket");
    bronzeContainer.innerHTML = "";
    bronzeContainer.appendChild(createMatchElement(currentTournament.bronzeMatch, () => resolveBronzeMatch()));
  } else {
    bronzeSection.style.display = "none";
  }
}
function openBroadcastScheduledPreview(match) {
  const b = currentTournament?.broadcast;
  if (!b?.running || !match || match.winner) return;
  const active = (b.active || []).find(x => x.match === match);
  if (active) {
    openBroadcastMatchDetail(active.id);
    return;
  }
  const queued = (b.queue || []).find(x => x.match === match);
  broadcastDetailViewing = false;
  broadcastDetailMatchId = null;
  activeMatchSimAbort = true;
  if (manualMatchSimulationHandle) { clearTimeout(manualMatchSimulationHandle); manualMatchSimulationHandle = null; }
  const mode = getBroadcastMode(match);
  const startText = queued?.time
    ? new Date(queued.time).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})
    : 'после предыдущей пары';
  const substatus = document.getElementById('dice-match-substatus');
  if (substatus) substatus.innerText = '🕒 БУДУЩИЙ МАТЧ • ОЖИДАНИЕ СТАРТА';
  document.getElementById('dice-match-title').innerText = `${match.t1} vs ${match.t2} (${mode}) • ПРЕДМАТЧЕВОЕ`;
  const hype = getMatchHype(match.t1, match.t2);
  document.getElementById('dice-match-hype').innerHTML = hype ? `<b style="color:#ff7675;">${hype.label}</b> • 👁️ ${hype.viewers}` : '';
  document.getElementById('team1-live-name').innerText = match.t1;
  document.getElementById('team2-live-name').innerText = match.t2;
  document.getElementById('team1-live-score').innerText = '0';
  document.getElementById('team2-live-score').innerText = '0';
  document.getElementById('team1-maps-won').innerText = '0 карт';
  document.getElementById('team2-maps-won').innerText = '0 карт';
  document.getElementById('current-map-title').innerText = 'Карта определится при старте';
  document.getElementById('veto-container').innerHTML = `<div style="font-weight:bold;color:var(--accent);">🕒 Предматчевое ожидание</div><div class="veto-step">Veto, карта, закуп и игровые события появятся только после фактического старта матча.</div>`;
  const stateBanner = document.getElementById('live-match-state-banner');
  if (stateBanner) {
    stateBanner.style.display='block';
    stateBanner.className='match-broadcast-state future';
    stateBanner.innerText=`🕒 Старт: ${startText} • счет пока не идет`;
  }
  document.getElementById('tactical-pause-panel').style.display='none';
  document.getElementById('live-detail-stats').style.display='none';
  document.getElementById('round-buy-strip').style.display='none';
  document.getElementById('timeline-first-half').innerHTML='';
  document.getElementById('timeline-second-half').innerHTML='';
  document.querySelectorAll('.map-side-wr').forEach(el => el.remove());
  document.getElementById('completed-result-timelines')?.remove();
  document.getElementById('match-live-ticker').innerHTML = `<div class="broadcast-phase-line">🕒 Матч еще не начался</div><div class="ticker-line">Открыто только предматчевое окно — симуляция не запускается.</div>`;
  document.getElementById('tv-playback-controls').style.display='none';
  const manualStartPanel = document.getElementById('manual-match-start-panel');
  if (manualStartPanel) manualStartPanel.style.display='none';
  document.getElementById('dice-verdict').innerText='';
  document.getElementById('dice-close-btn').innerText='Закрыть';
  document.getElementById('dice-modal').style.display='flex';
}
function openCompletedMatchResult(match) {
  if (!match || !match.t1 || !match.t2 || !match.winner) return;
  const result = match.broadcastResult;
  if (!result?.maps?.length) return;
  activeMatchSimAbort = true;
  if (manualMatchSimulationHandle) { clearTimeout(manualMatchSimulationHandle); manualMatchSimulationHandle = null; }
  broadcastDetailViewing = false;
  broadcastDetailMatchId = null;
  const substatus = document.getElementById('dice-match-substatus');
  if (substatus) substatus.innerText = '✓ МАТЧ ЗАВЕРШЕН • РЕЗУЛЬТАТ';
  document.getElementById('dice-match-title').innerText = `${match.t1} vs ${match.t2} (${result.mode || 'BO3'}) • РЕЗУЛЬТАТ`;
  document.getElementById('dice-match-hype').innerHTML = '';
  document.getElementById('team1-live-name').innerText = match.t1;
  document.getElementById('team2-live-name').innerText = match.t2;
  document.getElementById('team1-live-score').innerText = result.series1;
  document.getElementById('team2-live-score').innerText = result.series2;
  document.getElementById('team1-maps-won').innerText = `${result.series1} карт${result.series1 === 1 ? 'а' : ''}`;
  document.getElementById('team2-maps-won').innerText = `${result.series2} карт`;
  document.getElementById('veto-container').innerHTML = `
    <div class="map-draft-head"><span style="font-weight:bold;color:var(--accent);">🏁 ИТОГИ МАТЧА • ${result.mode || 'BO3'}</span><span style="font-size:8px;color:var(--text-muted);">завершен</span></div>
    <div class="map-draft-progress"><div style="width:100%;"></div></div>
    <div style="display:grid;gap:5px;margin-top:6px;">
      ${result.maps.map((mr,idx)=>`
        <div style="border:1px solid var(--border);border-radius:6px;padding:5px 7px;background:rgba(0,0,0,.16);">
          <div style="display:flex;justify-content:space-between;align-items:center;font-size:8.5px;color:var(--text-muted);">
            <span>Карта ${idx+1} • <b style="color:var(--accent);">${mr.map}</b></span>
            <span>${mr.overtime ? '🔥 OT' : 'завершена'}</span>
          </div>
          <div style="display:grid;grid-template-columns:1fr 46px 1fr;align-items:center;margin-top:3px;font-size:10px;">
            <b style="text-align:left;color:${mr.winner===match.t1?'var(--text)':'var(--text-muted)'};">${match.t1}</b>
            <strong style="text-align:center;font-size:13px;">${mr.t1Score}:${mr.t2Score}</strong>
            <b style="text-align:right;color:${mr.winner===match.t2?'var(--text)':'var(--text-muted)'};">${match.t2}</b>
          </div>
        </div>`).join('')}
    </div>`;
  document.getElementById('current-map-title').innerText = 'Итоги карт';
  const stateBanner = document.getElementById('live-match-state-banner');
  if (stateBanner) {
    stateBanner.style.display = 'block';
    stateBanner.className = 'match-broadcast-state done';
    stateBanner.innerText = `🏆 ${match.winner} выиграли ${result.series1}:${result.series2}`;
  }
  const t1Card = document.getElementById('team1-live-name')?.parentElement;
  const t2Card = document.getElementById('team2-live-name')?.parentElement;
  [t1Card, t2Card].forEach(card => {
    if (card) card.querySelectorAll('.map-live-winrates').forEach(x => x.remove());
  });
  document.querySelectorAll('.map-side-wr').forEach(el => el.remove());
  const h1 = document.getElementById('timeline-first-half'), h2 = document.getElementById('timeline-second-half');
  const timelineBox = h1?.closest('.round-timeline-box');
  if (timelineBox) timelineBox.style.display = 'none';
  if (h1) h1.innerHTML = '';
  if (h2) h2.innerHTML = '';
  const resultTimeline = document.getElementById('completed-result-timelines');
  if (resultTimeline) resultTimeline.remove();
  const wrap = document.createElement('div');
  wrap.id = 'completed-result-timelines';
  wrap.className = 'round-timeline-box match-section';
  wrap.innerHTML = `<div class="match-section-title">🎮 Раунды по картам</div>`;
  result.maps.forEach((mr, mapIndex) => {
    const rounds = Array.isArray(mr.rounds) ? mr.rounds : [];
    const mapBlock = document.createElement('div');
    mapBlock.style.cssText = 'margin-top:6px;padding:6px;border:1px solid var(--border);border-radius:6px;background:rgba(0,0,0,.12);';
    const header = document.createElement('div');
    header.style.cssText = 'display:flex;justify-content:space-between;align-items:center;font-size:9px;margin-bottom:5px;';
    header.innerHTML = `<strong style="color:var(--accent);">Карта ${mapIndex + 1} • ${mr.map}</strong><strong>${mr.t1Score}:${mr.t2Score}${mr.overtime ? ' 🔥 OT' : ''}</strong>`;
    mapBlock.appendChild(header);
    if (!rounds.length) {
      const empty = document.createElement('div');
      empty.style.cssText = 'font-size:8px;color:var(--text-muted);';
      empty.innerText = 'История раундов недоступна';
      mapBlock.appendChild(empty);
    } else {
      const makeRow = (from, to, ot=false) => {
        const row = document.createElement('div');
        row.className = 'timeline-row';
        row.style.cssText = 'justify-content:flex-start;flex-wrap:wrap;gap:2px;margin-top:2px;';
        for (let n = from; n <= Math.min(to, rounds.length); n++) {
          const cell = document.createElement('div');
          cell.className = 'timeline-cell';
          cell.innerText = n;
          const w = rounds[n - 1];
          if (w === 1) cell.classList.add('t1-won');
          if (w === 2) cell.classList.add('t2-won');
          if (ot || n > 24) {
            cell.style.borderColor = 'var(--gold)';
            cell.style.boxShadow = '0 0 0 1px rgba(251,197,49,.12) inset';
          }
          cell.title = `${mr.map} • Раунд ${n} • ${w === 1 ? match.t1 : w === 2 ? match.t2 : '—'}`;
          row.appendChild(cell);
        }
        return row;
      };
      mapBlock.appendChild(makeRow(1, 12));
      if (rounds.length > 12) mapBlock.appendChild(makeRow(13, 24));
      if (rounds.length > 24) {
        const otLabel = document.createElement('div');
        otLabel.style.cssText = 'font-size:8px;color:var(--gold);margin:5px 0 2px;';
        otLabel.innerText = '🔥 Овертайм';
        mapBlock.appendChild(otLabel);
        mapBlock.appendChild(makeRow(25, rounds.length, true));
      }
    }
    wrap.appendChild(mapBlock);
  });
  const tickerEl = document.getElementById('match-live-ticker');
  if (tickerEl?.parentNode) tickerEl.parentNode.insertBefore(wrap, tickerEl);
  const allRounds = result.maps.reduce((acc, mapResult) => acc.concat(mapResult.rounds || []), []);
  const totalRounds = Math.max(1, allRounds.length);
  const t1Rounds = allRounds.filter(x => x === 1 || x?.w === 1).length;
  const t2Rounds = totalRounds - t1Rounds;
  const pct = Math.round((t1Rounds / totalRounds) * 100);
  const fill1 = document.getElementById('mom-fill-t1');
  const fill2 = document.getElementById('mom-fill-t2');
  const label1 = document.getElementById('mom-t1-pct');
  const label2 = document.getElementById('mom-t2-pct');
  if (fill1) fill1.style.width = `${pct}%`;
  if (fill2) fill2.style.width = `${100 - pct}%`;
  if (label1) label1.innerText = `${match.t1}: ${t1Rounds} (${pct}%)`;
  if (label2) label2.innerText = `${match.t2}: ${t2Rounds} (${100 - pct}%)`;
  document.getElementById('tactical-pause-panel').style.display='none';
  document.getElementById('live-detail-stats').style.display='none';
  document.getElementById('round-buy-strip').style.display='none';
  if (tickerEl) {
    tickerEl.innerHTML = `
      <div class="broadcast-phase-line">🏆 ${match.winner} • серия ${result.series1}:${result.series2}</div>
      ${result.maps.map((mr,idx) => `
        <div class="broadcast-economy-line" style="margin-top:4px;">
          <strong>Карта ${idx+1}:${mr.map}</strong> — ${mr.t1Score}:${mr.t2Score}${mr.overtime ? ' 🔥 OT' : ''} • ${mr.winner}
        </div>`).join('')}`;
  }
  document.getElementById('dice-verdict').innerText = `🏆 ${match.winner} • ${result.series1}:${result.series2}`;
  document.getElementById('tv-playback-controls').style.display='none';
  document.getElementById('dice-close-btn').innerText='Закрыть';
  document.getElementById('dice-modal').style.display='flex';
}
function createMatchElement(m, onAction, isFinal = false) {
  const matchDiv = document.createElement("div");
  matchDiv.className = "match";
  if (!m) return matchDiv;
  const broadcastItem = getBroadcastItemByMatch(m);
  if (m.broadcastStatus === "live") {
    matchDiv.classList.add("live-broadcast");
    const bState = broadcastItem?.state;
    if (bState?.phase === 'tactical-pause') matchDiv.classList.add('broadcast-paused');
    if (bState?.overtime) matchDiv.classList.add('broadcast-overtime');
  }
 let odds = (m.t1 && m.t2) ? calcMatchOdds(m.t1, m.t2, m.isBO1) : null;
  if (broadcastItem?.state?.liveOdds) {
    odds = {
      c1: broadcastItem.state.liveOdds.c1,
      c2: broadcastItem.state.liveOdds.c2,
      pct1: broadcastItem.state.liveOdds.p1,
      pct2: broadcastItem.state.liveOdds.p2
    };
  }
  const hype = (m.t1 && m.t2) ? getMatchHype(m.t1, m.t2) : null;
  if (hype && !m.winner) {
    const hypeDiv = document.createElement("div");
    hypeDiv.className = `hype-tag ${hype.level}`;
    hypeDiv.innerHTML = `<span>${hype.label}</span><span>👁️ ${hype.viewers}</span>`;
    matchDiv.appendChild(hypeDiv);
  }
  const t1Fatigue = m.t1 ? (teams.find(t => t.name === m.t1)?.fatigue || 0) : 0;
  const t2Fatigue = m.t2 ? (teams.find(t => t.name === m.t2)?.fatigue || 0) : 0;
  const getBracketTeamLabel = (name) => {
    if (!name) return 'TBD';
    const team = teams.find(t => t.name === name);
    const rank = team ? teams.indexOf(team) + 1 : null;
    return `${esc(name)}${rank ? ` <span class="bracket-team-rank">#${rank}</span>` : ''}`;
  };
const btn1 = document.createElement("button");
  btn1.className = `team-btn ${!m.t1 ? 'tbd-slot' : ''} ${m.winner === m.t1 && m.t1 ? 'winner' : ''}`;
  btn1.innerHTML = `
    <span>${getBracketTeamLabel(m.t1)}${t1Fatigue > 0 ? `<span class="team-fatigue-badge">💤${t1Fatigue}%</span>` : ''}</span>
    ${odds ? `<span class="team-coeff">${odds.c1}x</span>` : ''}
  `;
  btn1.disabled = !m.t1 || !m.t2 || m.winner !== null || m.broadcastStatus === 'live' || currentTournament.completed;
  btn1.onclick = (e) => { e.stopPropagation(); handleMatchOpen(m, onAction); };
const btn2 = document.createElement("button");
  btn2.className = `team-btn ${!m.t2 ? 'tbd-slot' : ''} ${m.winner === m.t2 && m.t2 ? 'winner' : ''}`;
  btn2.innerHTML = `
    <span>${getBracketTeamLabel(m.t2)}${t2Fatigue > 0 ? `<span class="team-fatigue-badge">💤${t2Fatigue}%</span>` : ''}</span>
    ${odds ? `<span class="team-coeff">${odds.c2}x</span>` : ''}
  `;
  btn2.disabled = !m.t1 || !m.t2 || m.winner !== null || m.broadcastStatus === 'live' || currentTournament.completed;
  btn2.onclick = (e) => { e.stopPropagation(); handleMatchOpen(m, onAction); };
  matchDiv.appendChild(btn1);
  matchDiv.appendChild(btn2);
  if (m.broadcastStatus === "live") {
    const liveScore = document.createElement("div");
    liveScore.className = "match-live-score";
    liveScore.innerText = m.broadcastScore || "LIVE • 0:0";
    matchDiv.appendChild(liveScore);
    if (broadcastItem?.state) {
      const stateText = getBroadcastStatusText(broadcastItem);
      const stateDiv = document.createElement('div');
      const stateClass = getBroadcastStateClass(broadcastItem);
      stateDiv.className = `match-broadcast-state ${stateClass === 'pause' ? 'pause' : stateClass === 'overtime' ? 'overtime' : ''}`;
      stateDiv.innerText = stateText;
      matchDiv.appendChild(stateDiv);
    }
    const detailBtn = document.createElement("button");
    detailBtn.className = "secondary broadcast-detail-btn";
    detailBtn.innerText = "📺 Детали матча";
    detailBtn.onclick = (e) => { e.stopPropagation(); openBroadcastMatchDetail(broadcastMatchKey(m)); };
    matchDiv.appendChild(detailBtn);
  }
  if (odds && !m.winner) {
    const barBox = document.createElement("div");
    barBox.className = "betting-bar-container";
    barBox.innerHTML = `
      <div class="prob-bar"><div class="prob-bar-fill" style="width: ${odds.pct1}%;"></div></div>
      <div class="bet-info-row"><span>${odds.pct1}%</span><span>${odds.pct2}%</span></div>
    `;
    matchDiv.appendChild(barBox);
  }
  if (m.score) {
    if (m.broadcastResult?.maps?.length) {
      matchDiv.classList.add('completed-broadcast-result');
      matchDiv.style.cursor = 'pointer';
      matchDiv.title = 'Нажмите, чтобы открыть результаты карт';
      matchDiv.onclick = () => openCompletedMatchResult(m);
    }
    if (m.event) {
      const eventDiv = document.createElement("div");
      eventDiv.className = "tournament-event";
      eventDiv.innerText = m.event;
      matchDiv.appendChild(eventDiv);
    }
    const scoreDiv = document.createElement("div");
    scoreDiv.style.fontSize = "9.5px";
    scoreDiv.style.textAlign = "center";
    scoreDiv.style.color = "var(--text-muted)";
    scoreDiv.style.padding = "2px";
    scoreDiv.innerText = m.score;
    matchDiv.appendChild(scoreDiv);
    // После завершения broadcast-матча из сетки можно открыть scoreboard с
    // результатами всех сыгранных карт. Никаких логотипов — только счет и карты.
    if (m.broadcastResult?.maps?.length) {
      const resultBtn = document.createElement('button');
      resultBtn.className = 'secondary broadcast-detail-btn';
      resultBtn.innerText = '📺 Детали матча';
      resultBtn.title = 'Открыть карты, счёт и раунды матча';
      resultBtn.onclick = (e) => { e.stopPropagation(); openCompletedMatchResult(m); };
      matchDiv.appendChild(resultBtn);
    }
  }
  return matchDiv;
}
// Открытие интерактивного просмотра одиночного матча с тактическими паузами
let manualMatchSimulationHandle = null;
function openManualMatchPreview(match, callback) {
  if (!match || !match.t1 || !match.t2 || match.winner !== null) return;
  pendingManualMatch = { match, callback };
  activeMatchSimAbort = true;
  if (manualMatchSimulationHandle) {
    clearTimeout(manualMatchSimulationHandle);
    manualMatchSimulationHandle = null;
  }
  broadcastDetailViewing = false;
  broadcastDetailMatchId = null;
  const mode = getBroadcastMode(match);
  document.getElementById('dice-match-title').innerText = `${match.t1} vs ${match.t2} (${mode})`;
  const substatus = document.getElementById('dice-match-substatus');
  if (substatus) substatus.innerText = '🕒 МАТЧ СКОРО НАЧНЕТСЯ';
  const hype = getMatchHype(match.t1, match.t2);
  document.getElementById('dice-match-hype').innerHTML = hype ? `<b style="color:#ff7675;">${hype.label}</b> • 👁️ ${hype.viewers}` : '';
  document.getElementById('team1-live-name').innerText = match.t1;
  document.getElementById('team2-live-name').innerText = match.t2;
  document.getElementById('team1-live-score').innerText = '0';
  document.getElementById('team2-live-score').innerText = '0';
  document.getElementById('team1-maps-won').innerText = '0 карт';
  document.getElementById('team2-maps-won').innerText = '0 карт';
  document.getElementById('current-map-title').innerText = 'Ожидание старта матча';
  document.getElementById('veto-container').innerHTML = `<div style="font-weight:bold;color:var(--accent);">🕒 Информация</div><div class="veto-step">Команды готовятся к матчу. Veto и карты будут доступны позже.</div>`;
  const stateBanner = document.getElementById('live-match-state-banner');
  if (stateBanner) {
    stateBanner.style.display = 'block';
    stateBanner.className = 'match-state-pill pause';
    stateBanner.innerText = '⏳ Матч скоро начнется • разминка';
  }
  document.getElementById('tactical-pause-panel').style.display = 'none';
  document.getElementById('live-detail-stats').style.display = 'none';
  document.getElementById('round-buy-strip').style.display = 'none';
  document.getElementById('timeline-first-half').innerHTML = '';
  document.getElementById('timeline-second-half').innerHTML = '';
  document.getElementById('match-live-ticker').innerHTML = `<div class="broadcast-phase-line">Идет разминка команд перед началом матча...</div>`;
  document.getElementById('tv-playback-controls').style.display = 'none';
  document.getElementById('dice-verdict').innerText = '';
  document.getElementById('dice-close-btn').innerText = 'Закрыть';
  const startPanel = document.getElementById('manual-match-start-panel');
  if (startPanel) startPanel.style.display = 'none';
  document.getElementById('dice-modal').style.display = 'flex';
}
function openInteractiveMatchModal(match, callback) {
  if (!match.t1 || !match.t2 || match.winner !== null || match.simInProgress) return;
  match.simInProgress = true;
  activeManualMatch = match;
  activeMatchSimAbort = false;
  broadcastDetailViewing = false;
  activeMatchPauseState = { t1Pauses: 3, t2Pauses: 3, activeTeam: null, turnsLeft: 0, overtimeStage: 0 };
  const mode = getBroadcastMode(match);
  const veto = conductMapVeto(match.t1, match.t2, mode);
  document.getElementById('dice-match-title').innerText = `${match.t1} vs ${match.t2} (${mode})`;
  const substatus = document.getElementById('dice-match-substatus');
  if (substatus) substatus.innerText = '🔴 LIVE • симуляция матча';
  const startPanel = document.getElementById('manual-match-start-panel');
  if (startPanel) startPanel.style.display = 'none';
  document.getElementById('team1-live-name').innerText = match.t1;
  document.getElementById('team2-live-name').innerText = match.t2;
  document.getElementById('team1-live-score').innerText = '0';
  document.getElementById('team2-live-score').innerText = '0';
  document.getElementById('team1-maps-won').innerText = '0 карт';
  document.getElementById('team2-maps-won').innerText = '0 карт';
  document.getElementById('current-map-title').innerText = `Карта 1: ${veto.mapsToPlay[0]}`;
  document.getElementById('veto-container').innerHTML = `<div style="font-weight:bold;color:var(--accent);">📋 Veto:</div>` + veto.vetoLog.map(v => `<div class="veto-step">${v.text}</div>`).join('');
  document.getElementById('live-detail-stats').style.display = 'none';
  document.getElementById('tv-playback-controls').style.display = 'none';
  document.getElementById('dice-verdict').innerText = '';
  const manualStateBanner = document.getElementById('live-match-state-banner');
  if (manualStateBanner) { manualStateBanner.style.display = 'block'; manualStateBanner.className = 'match-broadcast-state'; manualStateBanner.innerText = '▶ Идет игра'; }
  document.getElementById('dice-modal').style.display = 'flex';
  updatePauseButtonsUI();
  let mapIndex = 0, s1 = 0, s2 = 0, m1 = 0, m2 = 0, round = 0, overtime = false;
  let winsRequired = mode === 'BO1' ? 1 : (mode === 'BO5' ? 3 : 2);
  let mapRoundWinners = [];
  const runTick = () => {
    if (activeMatchSimAbort) return;
    if (activeMatchPauseState.turnsLeft > 0) {
      activeMatchPauseState.turnsLeft--;
      updatePauseButtonsUI();
      manualMatchSimulationHandle = setTimeout(runTick, 800);
      return;
    }
    round++;
    const currentMap = veto.mapsToPlay[mapIndex];
    let prob = calcMapWinProbability(match.t1, match.t2, currentMap);
    if (activeMatchPauseState.activeTeam === 1) { prob += 0.08; activeMatchPauseState.activeTeam = null; }
    else if (activeMatchPauseState.activeTeam === 2) { prob -= 0.08; activeMatchPauseState.activeTeam = null; }
    const wSide = Math.random() < prob ? 1 : 2;
    if (wSide === 1) m1++; else m2++;
    mapRoundWinners.push(wSide);
    document.getElementById('team1-live-score').innerText = m1;
    document.getElementById('team2-live-score').innerText = m2;
    if (!overtime && m1 === 12 && m2 === 12) {
      overtime = true;
      activeMatchPauseState.overtimeStage = 1;
      activeMatchPauseState.t1Pauses = 1;
      activeMatchPauseState.t2Pauses = 1;
      const banner = document.getElementById('live-match-state-banner');
      if (banner) { banner.className = 'match-broadcast-state overtime'; banner.innerText = '🔥 ОВЕРТАЙМ 1: игра до 16 • каждой команде +1 таймаут'; }
      updatePauseButtonsUI();
    }
    let target = overtime ? (16 + ((activeMatchPauseState.overtimeStage || 1) - 1) * 3) : 13;
    if (overtime && m1 === target - 1 && m2 === target - 1) {
      activeMatchPauseState.overtimeStage = (activeMatchPauseState.overtimeStage || 1) + 1;
      activeMatchPauseState.t1Pauses = 1;
      activeMatchPauseState.t2Pauses = 1;
      target = 16 + ((activeMatchPauseState.overtimeStage - 1) * 3);
      const banner = document.getElementById('live-match-state-banner');
      if (banner) { banner.className = 'match-broadcast-state overtime'; banner.innerText = `🔥 ОВЕРТАЙМ ${activeMatchPauseState.overtimeStage}: игра до ${target} • каждой команде +1 таймаут`; }
      updatePauseButtonsUI();
    }
    const mapFinished = (m1 >= target || m2 >= target) && (Math.abs(m1 - m2) >= 2 || (overtime && (m1 === target || m2 === target)));
if (mapFinished) {
      if (m1 > m2) s1++; else s2++;
      document.getElementById('team1-maps-won').innerText = `${s1} карт`;
      document.getElementById('team2-maps-won').innerText = `${s2} карт`;
      if (s1 >= winsRequired || s2 >= winsRequired || mapIndex >= veto.mapsToPlay.length - 1) {
        const winner = s1 > s2 ? match.t1 : match.t2;
        const loser = winner === match.t1 ? match.t2 : match.t1;
        match.score = `Счет: ${s1} - ${s2}`;
        match.winner = winner;
        match.simInProgress = false;
        if (activeManualMatch === match) activeManualMatch = null;
        match.event = generateMatchEvent(match.t1, match.t2, winner, match.score);
        recordH2HWin(winner, loser);
        updateFatigueAndForm(winner, loser);
        accumulateMatchRating(winner, loser, match.isBO1);
        document.getElementById('dice-verdict').innerText = `🏆 Победитель матча: ${winner} (${s1}:${s2})`;
        document.getElementById('dice-close-btn').innerText = "Закрыть";
        renderTournament();
        renderRating();
        if (typeof callback === 'function') callback(winner, loser);
        return;
      }
      mapIndex++;
      m1 = 0; m2 = 0; round = 0; mapRoundWinners = [];
      document.getElementById('current-map-title').innerText = `Карта ${mapIndex + 1}: ${veto.mapsToPlay[mapIndex]}`;
    }
    manualMatchSimulationHandle = setTimeout(runTick, 350);
  };
  manualMatchSimulationHandle = setTimeout(runTick, 500);
}
function callTacticalPause(teamNum) {
  const selected = getSelectedBroadcastItem();
  if (selected && broadcastDetailViewing) {
    const st = selected.state, m = selected.match, now = Date.now();
    if (!st || st.finished || st.phase !== 'playing') return;
    if (teamNum === 1 && st.t1Pauses > 0) {
      st.t1Pauses--;
      st.pauseTeam = m.t1;
    } else if (teamNum === 2 && st.t2Pauses > 0) {
      st.t2Pauses--;
      st.pauseTeam = m.t2;
    } else return;
    st.pauseReason = 'Тактический таймаут';
    st.phase = 'tactical-pause';
    st.phaseUntil = now + Math.round(4500 / tvPlaybackSpeed);
    st.pauseHistory = st.pauseHistory || [];
    st.pauseHistory.unshift({team:st.pauseTeam, round:st.round, mapIndex:st.mapIndex, at:now, automatic:false});
    st.phaseText = `⏸ Пауза: ${st.pauseTeam}`;
    addBroadcastEvent(st, `⏸ <strong>${st.pauseTeam}</strong> взяли тактическую паузу.`);
    selected.match.broadcastScore = formatBroadcastScore(selected);
    renderTournament();
    renderBroadcastPanel();
    broadcastRenderDetail(selected);
    return;
  }
  if (teamNum === 1 && activeMatchPauseState.t1Pauses > 0) {
    activeMatchPauseState.t1Pauses--;
    activeMatchPauseState.activeTeam = 1;
    activeMatchPauseState.turnsLeft = 2;
  } else if (teamNum === 2 && activeMatchPauseState.t2Pauses > 0) {
    activeMatchPauseState.t2Pauses--;
    activeMatchPauseState.activeTeam = 2;
    activeMatchPauseState.turnsLeft = 2;
  }
  updatePauseButtonsUI();
  const banner = document.getElementById('live-match-state-banner');
  if (banner && activeMatchPauseState.activeTeam) {
    const teamName = activeMatchPauseState.activeTeam === 1 ? document.getElementById('team1-live-name').innerText : document.getElementById('team2-live-name').innerText;
    banner.className = 'match-broadcast-state pause';
    banner.innerText = `⏸ Пауза: ${teamName}`;
  }
}
function updatePauseButtonsUI() {
  const selected = getSelectedBroadcastItem();
  const b1 = document.getElementById('pause-t1-btn');
  const b2 = document.getElementById('pause-t2-btn');
  if (selected && broadcastDetailViewing) {
    const st = selected.state, m = selected.match;
    if (b1) {
      b1.innerText = `⏱ Таймаут (${m.t1}): ${st.t1Pauses} ост.` + (st.pauseTeam === m.t1 && st.phase === 'tactical-pause' ? ' [АКТИВЕН]' : '');
      b1.disabled = st.t1Pauses <= 0 || st.phase !== 'playing';
    }
    if (b2) {
      b2.innerText = `⏱ Таймаут (${m.t2}): ${st.t2Pauses} ост.` + (st.pauseTeam === m.t2 && st.phase === 'tactical-pause' ? ' [АКТИВЕН]' : '');
      b2.disabled = st.t2Pauses <= 0 || st.phase !== 'playing';
    }
    return;
  }
  if (b1) {
    b1.innerText = `⏱ Таймаут (К1): ${activeMatchPauseState.t1Pauses} ост.` + (activeMatchPauseState.activeTeam === 1 ? ' [АКТИВЕН]' : '');
    b1.disabled = activeMatchPauseState.t1Pauses <= 0 || activeMatchPauseState.turnsLeft > 0;
  }
  if (b2) {
    b2.innerText = `⏱ Таймаут (К2): ${activeMatchPauseState.t2Pauses} ост.` + (activeMatchPauseState.activeTeam === 2 ? ' [АКТИВЕН]' : '');
    b2.disabled = activeMatchPauseState.t2Pauses <= 0 || activeMatchPauseState.turnsLeft > 0;
  }
}
function closeCurrentMatchViewer() {
  const broadcastIsRunning = !!currentTournament?.broadcast?.running;
  if (!broadcastIsRunning) {
    activeMatchSimAbort = true;
    if (pendingManualMatch?.match) pendingManualMatch.match.simInProgress = false;
    if (activeManualMatch) { activeManualMatch.simInProgress = false; activeManualMatch = null; }
    if (manualMatchSimulationHandle) clearTimeout(manualMatchSimulationHandle);
  }
  const modal = document.getElementById("dice-modal");
  if (modal) modal.style.display = "none";
  broadcastDetailViewing = false;
  broadcastDetailMatchId = null;
  pendingManualMatch = null;
  const startPanel = document.getElementById('manual-match-start-panel');
  if (startPanel) startPanel.style.display = 'none';
  const banner = document.getElementById('live-match-state-banner');
  if (banner) banner.style.display = 'none';
}
function updateFatigueAndForm(winnerName, loserName) {
  const w = teams.find(t => t.name === winnerName);
  const l = teams.find(t => t.name === loserName);
  const update = (t, won) => {
    if (!t) return;
    ensurePlayerLayer(t);
    t.players.forEach((p,idx) => {
      const oldForm = Math.round(clampNumber(p.form, 80, 120));
      const meanReversion = (100 - oldForm) * 0.25;
      const resultImpact = won ? 1 : -1;
      p.form = clampNumber(oldForm + meanReversion + resultImpact, 80, 120);
      p.morale = clampNumber(p.morale + (won ? 2 : -2) + ((idx%2)?0.3:-0.2), 40, 100);
    });
    ensurePlayerLayer(t);
  };
  update(w, true);
  update(l, false);
if (w) {
    w.streak = w.streak > 0 ? w.streak + 1 : 1;
    const isTopTeam = (Number(w.pts) || 600) > 850;
    let fatigueIncrement = 2;
    if (isTopTeam) { // v29: было 6/10 — топы «сгорали» и турниры выигрывали случайные команды
      if (w.streak >= 3) fatigueIncrement = 3;
      if (w.streak >= 5) fatigueIncrement = 4;
    } else {
      if (w.streak >= 5) fatigueIncrement = 3;
    }
    changePlayers(w, {fatigue: fatigueIncrement, morale: 0});
  }
  if (l) {
    l.streak = l.streak < 0 ? l.streak - 1 : -1;
    changePlayers(l, {fatigue: 2, morale: -1});
  }
  syncAllPlayerLayers();
  saveTeams();
}
function accumulateMatchRating(wName, lName, isBO1 = false) {
  const w = teams.find(t => t.name === wName);
  const l = teams.find(t => t.name === lName);
  if (!w || !l) return;
  const odds = calcMatchOdds(wName, lName, isBO1);
  const expected = odds ? odds.p1_win : 0.5;
  const k = isBO1 ? 12 : 18;
  const delta = Math.round(k * (1 - expected));
  currentTournament.pendingDeltas[wName] = (currentTournament.pendingDeltas[wName] || 0) + delta;
  currentTournament.pendingDeltas[lName] = (currentTournament.pendingDeltas[lName] || 0) - delta;
}
function resolveUpperMatch(rIndex, mIndex) {
  const m = currentTournament.upperRounds[rIndex][mIndex];
  const nextR = rIndex + 1;
  const loser = (m.winner === m.t1) ? m.t2 : m.t1;
  const totalRounds = currentTournament.upperRounds.length;
  if (currentTournament.isMajor) {
    if (rIndex === 0) scoreMajorPlayoffPickem("qf", m.winner);
    else if (rIndex === 1) scoreMajorPlayoffPickem("sf", m.winner);
    else if (rIndex === totalRounds - 1) scoreMajorPlayoffPickem("champion", m.winner);
  }
  if (nextR < totalRounds) {
    const targetMatch = currentTournament.upperRounds[nextR][Math.floor(mIndex / 2)];
    if (mIndex % 2 === 0) targetMatch.t1 = m.winner; else targetMatch.t2 = m.winner;
    if (currentTournament.hasLowerBracket) {
      if (currentTournament.size === 16) {
        if (rIndex === 0) {
          let lTarget = currentTournament.lowerRounds[0][Math.floor(mIndex / 2)];
          if (mIndex % 2 === 0) lTarget.t1 = loser; else lTarget.t2 = loser;
        } else if (rIndex === 1) currentTournament.lowerRounds[1][mIndex].t2 = loser;
        else if (rIndex === 2) currentTournament.lowerRounds[3][mIndex].t2 = loser;
      } else if (currentTournament.size === 8) {
        if (rIndex === 0) {
          let lTarget = currentTournament.lowerRounds[0][Math.floor(mIndex / 2)];
          if (mIndex % 2 === 0) lTarget.t1 = loser; else lTarget.t2 = loser;
        } else if (rIndex === 1) currentTournament.lowerRounds[1][mIndex].t2 = loser;
      }
    } else {
      const bracketSizeAtRound = Math.pow(2, totalRounds - rIndex);
      const tiedPlace = bracketSizeAtRound / 2 + 1;
      currentTournament.placements[loser] = { place: tiedPlace, title: `${tiedPlace}-${bracketSizeAtRound} место` };
    }
  } else {
    if (currentTournament.hasLowerBracket) {
      currentTournament.grandFinal.t1 = m.winner;
      currentTournament.lowerRounds[currentTournament.lowerRounds.length - 1][0].t2 = loser;
    } else {
      currentTournament.placements[m.winner] = { place: 1, title: "1 место (Чемпион)" };
      currentTournament.placements[loser] = { place: 2, title: "2 место (Финал)" };
      checkTournamentCompletion();
    }
  }
  if (!currentTournament.isMajor && !currentTournament.hasLowerBracket && currentTournament.bronzeMatch && rIndex === currentTournament.upperRounds.length - 2) {
    if (mIndex === 0) currentTournament.bronzeMatch.t1 = loser;
    if (mIndex === 1) currentTournament.bronzeMatch.t2 = loser;
  }
  renderTournament();
}
function resolveLowerMatch(rIndex, mIndex) {
  const m = currentTournament.lowerRounds[rIndex][mIndex];
  const loser = (m.winner === m.t1) ? m.t2 : m.t1;
  const nextR = rIndex + 1;
  const totalLower = currentTournament.lowerRounds.length;
  if (nextR < totalLower) {
    if (currentTournament.size === 16) {
      if (rIndex === 0) currentTournament.lowerRounds[1][mIndex].t1 = m.winner;
      else if (rIndex === 1) {
        let t = currentTournament.lowerRounds[2][Math.floor(mIndex / 2)];
        if (mIndex % 2 === 0) t.t1 = m.winner; else t.t2 = m.winner;
      } else if (rIndex === 2) currentTournament.lowerRounds[3][mIndex].t1 = m.winner;
      else if (rIndex === 3) {
        let t = currentTournament.lowerRounds[4][0];
        if (mIndex === 0) t.t1 = m.winner; else t.t2 = m.winner;
      } else if (rIndex === 4) currentTournament.lowerRounds[5][0].t1 = m.winner;
    } else if (currentTournament.size === 8) {
      if (rIndex === 0) currentTournament.lowerRounds[1][mIndex].t1 = m.winner;
      else if (rIndex === 1) {
        let t = currentTournament.lowerRounds[2][0];
        if (mIndex === 0) t.t1 = m.winner; else t.t2 = m.winner;
      } else if (rIndex === 2) currentTournament.lowerRounds[3][0].t1 = m.winner;
    }
    currentTournament.placements[loser] = { place: 6, title: "Вылет из нижней сетки" };
  } else {
    currentTournament.grandFinal.t2 = m.winner;
    currentTournament.placements[loser] = { place: 3, title: "3 место" };
  }
  renderTournament();
}
function resolveBronzeMatch() {
  const m = currentTournament.bronzeMatch;
  currentTournament.placements[m.winner] = { place: 3, title: "🥉 3 место" };
  currentTournament.placements[m.winner === m.t1 ? m.t2 : m.t1] = { place: 4, title: "4 место" };
  checkTournamentCompletion();
  renderTournament();
}
function resolveGrandFinal() {
  const m = currentTournament.grandFinal;
  const loser = (m.winner === m.t1) ? m.t2 : m.t1;
  currentTournament.placements[m.winner] = { place: 1, title: "⭐ 1 место (Чемпион)" };
  currentTournament.placements[loser] = { place: 2, title: "2 место (Финалист)" };
  checkTournamentCompletion();
  renderTournament();
}
function checkTournamentCompletion() {
  if (currentTournament.hasLowerBracket) {
    if (currentTournament.grandFinal && currentTournament.grandFinal.winner) {
      finalizeTournamentRating();
    }
  } else {
    const finalRound = currentTournament.upperRounds[currentTournament.upperRounds.length - 1][0];
    const bronzeFinished = currentTournament.isMajor
      ? true
      : (currentTournament.bronzeMatch ? (currentTournament.bronzeMatch.winner !== null) : true);
    if (finalRound && finalRound.winner && bronzeFinished) {
      if (currentTournament.isMajor) currentTournament.bronzeMatch = null;
      finalizeTournamentRating();
    }
  }
}
function calcMatchOdds(t1Name, t2Name, isBO1 = false) {
  if (!t1Name || !t2Name) return null;
  const t1 = teams.find(t => t.name === t1Name) || { pts: 750, form: 100, fatigue: 0 };
  const t2 = teams.find(t => t.name === t2Name) || { pts: 750, form: 100, fatigue: 0 };
  const pts1 = Number(getTeamCurrentPts(t1Name)) || 750;
  const pts2 = Number(getTeamCurrentPts(t2Name)) || 750;
  const form1 = Math.max(90, Math.min(110, Number(t1.form) || 100));
  const form2 = Math.max(90, Math.min(110, Number(t2.form) || 100));
  const fatigue1 = Math.max(0, Math.min(85, Number(t1.fatigue) || 0));
  const fatigue2 = Math.max(0, Math.min(85, Number(t2.fatigue) || 0));
  const getFatiguePenalty = (fatigue) => {
    if (fatigue <= 10) return fatigue * 1.5;
    if (fatigue <= 25) return 15 + (fatigue - 10) * 4.0;
    return 75 + (fatigue - 25) * 6.5;
  };
  ensurePlayerLayer(t1); ensurePlayerLayer(t2);
  let eff1 = pts1 + (form1 - 100) * 1.5 - getFatiguePenalty(fatigue1);
  let eff2 = pts2 + (form2 - 100) * 1.5 - getFatiguePenalty(fatigue2);
  // Player Layer adds a small bounded modifier on top of the legacy formula.
  const layerDiff = ((t1.playerLayer?.power || 80) - (t2.playerLayer?.power || 80)) * 1.15;
  const chemistryDiff = ((t1.playerLayer?.chemistry || 80) - (t2.playerLayer?.chemistry || 80)) * 0.55;
  const moraleDiff = ((t1.playerLayer?.morale || 90) - (t2.playerLayer?.morale || 90)) * 0.35;
  eff1 += layerDiff + chemistryDiff + moraleDiff;
  eff2 -= layerDiff + chemistryDiff + moraleDiff;
  if (fatigue1 >= 60) eff1 *= (1 - (fatigue1 - 50) * 0.012);
  if (fatigue2 >= 60) eff2 *= (1 - (fatigue2 - 50) * 0.012);
  const effective1 = eff1;
  const effective2 = eff2;
  const diff = effective1 - effective2;
  const k = isBO1 ? 480 : 540;
  let raw = 1 / (1 + Math.pow(10, -diff / k));
  let p1 = 0.5 + (raw - 0.5) * 0.72;
  p1 = Math.max(0.14, Math.min(0.86, p1));
  const p2 = 1 - p1;
  const pct1 = Math.round(p1 * 100);
  const pct2 = 100 - pct1;
  const bookmakerReturn = 0.94;
  const c1 = Math.max(1.08, Math.min(7.50, bookmakerReturn / p1)).toFixed(2);
  const c2 = Math.max(1.08, Math.min(7.50, bookmakerReturn / p2)).toFixed(2);
  return { pct1, pct2, c1, c2, p1_win: p1 };
}
function finalizeTournamentRating() {
  if (!currentTournament || currentTournament.completed) return;
  currentTournament.completed = true;
  teams.forEach((t, index) => { t.prevRank = index + 1; });
  let champName = "—";
  let participants = currentTournament.participants || [];
  const placementRaw = {};
  for (let teamName in currentTournament.placements) {
    const pl = currentTournament.placements[teamName];
    let baseBonus = 0;
    let stageTitle = "Участник";
    if (pl.place === 1) {
      baseBonus = currentTournament.isMajor ? 30 : (currentTournament.isElite ? 20 : 13);
      stageTitle = "🏆 1 место (Чемпион)";
      champName = teamName;
    } else if (pl.place === 2) {
      baseBonus = currentTournament.isMajor ? 18 : (currentTournament.isElite ? 12 : 8);
      stageTitle = "🥈 2 место (Финалист)";
    } else if (pl.place === 3) {
      baseBonus = currentTournament.isMajor ? 11 : (currentTournament.isElite ? 7 : 5);
      stageTitle = "🥉 3 место";
    } else if (pl.place === 4) {
      baseBonus = currentTournament.isMajor ? 7 : (currentTournament.isElite ? 4 : 3);
      stageTitle = "4 место";
    } else if (pl.place <= 6) {
      baseBonus = currentTournament.isMajor ? 4 : (currentTournament.isElite ? 3 : 2);
      stageTitle = "⚡ Плей-офф (полуфинал)";
    } else if (pl.place <= 8) {
      baseBonus = currentTournament.isMajor ? 2 : 1;
      stageTitle = "⚡ Плей-офф (1/4)";
} else {
      const curPts = Number(getTeamCurrentPts(teamName)) || 600;
      if (curPts >= 850) {
        baseBonus = -10;
      } else if (curPts >= 650) {
        baseBonus = -5;
      } else if (curPts >= 550) {
        baseBonus = -2;
      } else {
        baseBonus = 0;
      }
      stageTitle = currentTournament.formatChoice === "swiss" ? "🇨🇭 Swiss Stage" : "🚪 Групповой этап";
    }
    currentTournament.placements[teamName].title = stageTitle;
    const fieldMult = getTournamentPointMultiplier() * getFieldStrengthMultiplier();
    placementRaw[teamName] = baseBonus >= 0
      ? Math.round(baseBonus * fieldMult)
      : Math.round(baseBonus * Math.min(1, fieldMult));
  }
  participants.forEach(teamName => {
    const pl = currentTournament.placements[teamName];
    const raw = currentTournament.pendingDeltas[teamName];
    if (pl && pl.place > 8 && raw !== undefined && raw > 0) {
      currentTournament.pendingDeltas[teamName] = Math.round(raw * 0.5);
    }
  });
  participants.forEach(teamName => {
    if (currentTournament.pendingDeltas[teamName] !== undefined) {
      currentTournament.pendingDeltas[teamName] += (placementRaw[teamName] || 0);
    }
  });
  participants.forEach(teamName => {
    const t = teams.find(x => x.name === teamName);
    if (t) {
      const delta = currentTournament.pendingDeltas[teamName] || 0;
      const pl = currentTournament.placements[teamName] || { place: 16, title: "Участник" };
      t.pts = Math.max(50, Math.min(2000, t.pts + delta));
      if (pl.place === 1) {
        if (currentTournament.isMajor) t.trophies.majors = (t.trophies.majors || 0) + 1;
        else if (currentTournament.isElite) t.trophies.elite = (t.trophies.elite || 0) + 1;
        else t.trophies.regular = (t.trophies.regular || 0) + 1;
      }
      t.history.unshift({
        tournament: currentTournament.name,
        season: currentTournament.season,
        place: pl.place,
        placeTitle: pl.title,
        isMajor: currentTournament.isMajor,
        isElite: currentTournament.isElite,
        fieldProfile: currentTournament.fieldProfile,
        delta: delta
      });
      t.activeModifier = null;
    }
  });
  if (typeof window.hubArchiveTier1 === 'function') {
    try { window.hubArchiveTier1(currentTournament); } catch (e) { console.warn('[HLTV Hub] Tier-1 archive failed', e); }
  }
  const currentYear = 2026 + (seasonState.currentSeason - 1);
  if ((typeof window.v21ShouldEndSeason === "function" ? window.v21ShouldEndSeason() : (seasonState.tournamentIndex >= seasonState.maxTournaments))) {
  let baseValue = 500;
    teams.forEach(t => {
      if (t.pts > baseValue) {
        let excess = t.pts - baseValue;
        t.pts = Math.round(baseValue + (excess * 0.67));
      }
      t.pts = Math.max(150, t.pts);
    });
const styleChanges = [];
    teams.forEach(t => {
      t.maps = generateMapStats();
      t.mapStats = {};
      t.mapHistory = [];
      MAP_POOL.forEach(map => {
        const wr = Math.round(Math.max(35, Math.min(95, Number(t.maps?.[map]) || 50)));
        const games = 20;
        const wins = Math.round(games * wr / 100);
        t.mapStats[map] = { wins, losses: games - wins };
      });
      t.mapPickHistory = {};
      t.seasonStartRank = t.prevRank;
      if (Math.random() < 0.25) {
        const otherStyles = PLAYSTYLES.filter(s => s !== t.style);
        const oldStyle = t.style;
        t.style = otherStyles[Math.floor(Math.random() * otherStyles.length)];
        styleChanges.push(`${t.name} (${oldStyle} ➔ ${t.style})`);
      }
    });
    let sorted = [...teams].sort((a, b) => b.pts - a.pts);
    let champ = sorted[0];
    champ.seasonChampionships = (champ.seasonChampionships || 0) + 1;
    let bestRisingTeam = null;
    let maxRankDiff = -999;
    teams.forEach(tm => {
      let currentRk = teams.indexOf(tm) + 1;
      let startRk = tm.seasonStartRank || currentRk;
      let diffRk = startRk - currentRk;
      if (diffRk > maxRankDiff) {
        maxRankDiff = diffRk;
        bestRisingTeam = tm.name;
      }
    });
    seasonState.hallOfFame.unshift({
      season: seasonState.currentSeason,
      year: currentYear,
      champion: champ.name,
      scorePts: champ.pts,
      risingStar: bestRisingTeam ? `${bestRisingTeam} (▲${maxRankDiff})` : "—",
      trophies: `Турнирный сезон завершен`
    });
    seasonState.currentSeason += 1;
    seasonState.tournamentIndex = 1;
    teams.forEach(t => {
      t.maps = generateMapStats();
      t.mapStats = {};
      t.mapHistory = [];
	  const styleChanges = [];
    teams.forEach(t => {
      t.maps = generateMapStats();
      t.mapStats = {};
      t.mapHistory = [];
      MAP_POOL.forEach(map => {
        const wr = Math.round(Math.max(35, Math.min(95, Number(t.maps?.[map]) || 50)));
        const games = 20;
        const wins = Math.round(games * wr / 100);
        t.mapStats[map] = { wins, losses: games - wins };
      });
      t.mapPickHistory = {};
      t.seasonStartRank = t.prevRank;
      if (Math.random() < 0.25) {
        const otherStyles = PLAYSTYLES.filter(s => s !== t.style);
        const oldStyle = t.style;
        t.style = otherStyles[Math.floor(Math.random() * otherStyles.length)];
        styleChanges.push(`${t.name} (${oldStyle} ➔ ${t.style})`);
      }
    });
      MAP_POOL.forEach(map => {
        const wr = Math.round(Math.max(35, Math.min(95, Number(t.maps?.[map]) || 50)));
        const games = 20;
        const wins = Math.round(games * wr / 100);
        t.mapStats[map] = { wins, losses: games - wins };
      });
      t.mapPickHistory = {};
      t.seasonStartRank = t.prevRank;
    });
    seasonState.mapStatsSeason = seasonState.currentSeason;
    generateDynamicSeasonSchedule();
    alert(`🎉 СЕЗОН ${seasonState.currentSeason - 1} ЗАВЕРШЕН!\nПобедитель сезона: ${champ.name}!\n🚀 Прорыв сезона: ${bestRisingTeam || '—'}`);
  } else {
    seasonState.tournamentIndex += 1;
    alert(`🏆 Турнир завершен! Чемпион: ${champName}!`);
  }
  processErasAfterTournament(champName);
  teams.forEach(t => restoreTemporaryStandIn(t));
  processTransferMarket('tournament_end');
  saveTournamentToArchive();
  renderTournamentArchive();
  saveSeasonState();
  saveTeams();
  renderRating();
  renderTournament();
  updateTournamentSuggestion();
  if (selectedTeamForDetails) showHistory(selectedTeamForDetails);
}
function getTeamCurrentPts(teamName) {
  if (!teamName) return 600;
  if (currentTournament && currentTournament.initialRatings && currentTournament.initialRatings[teamName] !== undefined) {
    return currentTournament.initialRatings[teamName];
  }
  const found = teams.find(t => t.name === teamName);
  return found ? found.pts : 600;
}
function getMatchHype(t1Name, t2Name) {
  if (!t1Name || !t2Name || !currentTournament) return null;
  const t1 = teams.find(t => t.name === t1Name);
  const t2 = teams.find(t => t.name === t2Name);
  if (!t1 || !t2) return null;
  const rank1 = teams.indexOf(t1) + 1;
  const rank2 = teams.indexOf(t2) + 1;
  const isTopClash = (rank1 <= 6 && rank2 <= 6);
  const isGrandFinal = currentTournament.grandFinal &&
    (currentTournament.grandFinal.t1 === t1Name && currentTournament.grandFinal.t2 === t2Name);
  if (isTopClash || isGrandFinal) {
    let mult = currentTournament.isMajor ? 2.2 : (currentTournament.isElite ? 1.6 : 1.1);
    const baseViewers = 850 + Math.floor(Math.random() * 250);
    const viewersCount = ((baseViewers * mult) / 1000).toFixed(2);
    return {
      level: "super",
      label: isGrandFinal ? "🏆 ГРАНД-ФИНАЛ ГОДА" : "🔥 БИТВА ТИТАНОВ",
      viewers: `${viewersCount}M`
    };
  }
  return null;
}
function recordMapResult(team1Name, team2Name, mapName, winnerName, score = '', tournamentName = '', roundLabel = '') {
  if (!mapName || !winnerName) return;
  const t1 = teams.find(t => t.name === team1Name);
  const t2 = teams.find(t => t.name === team2Name);
  if (!t1 || !t2) return;
  [t1, t2].forEach(t => {
    if (!t.mapStats) t.mapStats = {};
    if (!t.mapStats[mapName]) {
      const wr = Math.round(Math.max(35, Math.min(95, Number(t.maps?.[mapName]) || 50)));
      const games = 20;
      const wins = Math.round(games * wr / 100);
      t.mapStats[mapName] = { wins, losses: games - wins };
    }
    const rec = t.mapStats[mapName];
    if (winnerName === t.name) rec.wins = (rec.wins || 0) + 1;
    else rec.losses = (rec.losses || 0) + 1;
    const total = Math.max(1, (rec.wins || 0) + (rec.losses || 0));
    t.maps[mapName] = Math.round((rec.wins / total) * 1000) / 10;
    t.mapStatsVersion = 2;
    if (!t.mapHistory) t.mapHistory = [];
    t.mapHistory.unshift({
      season: seasonState.currentSeason,
      tournament: tournamentName || currentTournament?.name || 'Матч',
      round: roundLabel || '',
      map: mapName,
      opponent: t.name === team1Name ? team2Name : team1Name,
      result: winnerName === t.name ? 'W' : 'L',
      score: score || ''
    });
    t.mapHistory = t.mapHistory.slice(0, 100);
  });
  try { saveTeams(); } catch(e) {}
}
function recordSeriesMapResults(match, mapResults) {
  if (!match || !Array.isArray(mapResults) || !mapResults.length || match._mapStatsRecorded) return;
  mapResults.forEach((mr, idx) => {
    if (!mr?.map || !mr?.winner) return;
    recordMapResult(
      match.t1, match.t2, mr.map, mr.winner,
      `${mr.t1Score}:${mr.t2Score}`,
      currentTournament?.name || '',
      `Карта ${idx + 1}`
    );
  });
  match._mapStatsRecorded = true;
  saveTeams();
}
function getMapWinrate(teamName, mapName) {
  const team = teams.find(t => t.name === teamName);
  if (!team || !mapName) return 50;
  return Math.round(Math.max(30, Math.min(99, Number(team.maps?.[mapName]) || 50)) * 10) / 10;
}
function conductMapVeto(t1Name, t2Name, mode = "BO3") {
  const t1 = teams.find(t => t.name === t1Name) || { maps: generateMapStats(), mapPickHistory:{} };
  const t2 = teams.find(t => t.name === t2Name) || { maps: generateMapStats(), mapPickHistory:{} };
  t1.mapPickHistory = t1.mapPickHistory || {};
  t2.mapPickHistory = t2.mapPickHistory || {};
  let pool = [...MAP_POOL];
  const vetoLog = [];
  const mapsToPlay = [];
  const draftSteps = [];
  const rating = (team, map) => Math.max(35, Math.min(95, Number(team.maps?.[map]) || 50));
  const pickScore = (team, opp, map) => {
    const own = rating(team, map), enemy = rating(opp, map);
    const comfort = Math.min(3, (team.mapPickHistory?.[map] || 0) * 0.18);
    return own + (own - enemy) * 0.55 + comfort + Math.random() * 1.4;
  };
  const banScore = (team, opp, map) => {
    const own = rating(team, map), enemy = rating(opp, map);
    return (enemy - own) * 0.82 + (55 - own) * 0.24 + Math.random() * 1.2;
  };
  const pickBest = (team, opp) => {
    return pool.slice().sort((a,b) => pickScore(team,opp,b) - pickScore(team,opp,a))[0];
  };
  const banWorst = (team, opp) => {
    return pool.slice().sort((a,b) => banScore(team,opp,b) - banScore(team,opp,a))[0];
  };
  const addStep = (type, teamName, map, reason) => {
    const team = teams.find(t => t.name === teamName);
    const value = team ? rating(team, map) : 50;
    const t1Winrate = getMapWinrate(t1Name, map);
    const t2Winrate = getMapWinrate(t2Name, map);
    let icon = type === 'ban' ? '🚫' : (type === 'pick' ? '✅' : '🎯');
    const text = type === 'ban'
      ? `${icon} <b>${teamName}</b> забанили <b>${map}</b> <span style="opacity:.7">(${value})</span>`
      : type === 'pick'
        ? `${icon} <b>${teamName}</b> пикнули <b>${map}</b> <span style="opacity:.7">(${value})</span>`
        : `${icon} Десайдер: <b>${map}</b>`;
    vetoLog.push({text, type, team:teamName, map, reason, value, t1Winrate, t2Winrate});
    draftSteps.push({text, type, team:teamName, map, reason, value, t1Winrate, t2Winrate});
  };
  const ban = (team, opp, teamName) => {
    const map = banWorst(team, opp);
    pool = pool.filter(x => x !== map);
    addStep('ban', teamName, map, 'слабая карта / сильная карта соперника');
  };
  const pick = (team, opp, teamName) => {
    const map = pickBest(team, opp);
    pool = pool.filter(x => x !== map);
    mapsToPlay.push(map);
    team.mapPickHistory[map] = (team.mapPickHistory[map] || 0) + 1;
    addStep('pick', teamName, map, 'максимальная собственная сила + преимущество над соперником');
  };
  if (mode === 'BO1') {
    for (let i = 0; i < 3; i++) {
      ban(t1, t2, t1Name);
      ban(t2, t1, t2Name);
    }
    const decider = pool.slice().sort((a,b) => {
      const ba = (rating(t1,a)+rating(t2,a))/2 - Math.abs(rating(t1,a)-rating(t2,a))*0.45;
      const bb = (rating(t1,b)+rating(t2,b))/2 - Math.abs(rating(t1,b)-rating(t2,b))*0.45;
      return bb - ba;
    })[0];
    mapsToPlay.push(decider);
    addStep('decider', null, decider, 'наиболее конкурентная оставшаяся карта');
  } else if (mode === 'BO5') {
    ban(t1, t2, t1Name);
    ban(t2, t1, t2Name);
    pick(t1, t2, t1Name);
    pick(t2, t1, t2Name);
    pick(t1, t2, t1Name);
    pick(t2, t1, t2Name);
    const decider = pool.slice().sort((a,b) => {
      const ba = Math.min(rating(t1,a),rating(t2,a)) + ((rating(t1,a)+rating(t2,a))/2)*0.18 - Math.abs(rating(t1,a)-rating(t2,a))*0.38;
      const bb = Math.min(rating(t1,b),rating(t2,b)) + ((rating(t1,b)+rating(t2,b))/2)*0.18 - Math.abs(rating(t1,b)-rating(t2,b))*0.38;
      return bb - ba;
    })[0];
    mapsToPlay.push(decider);
    addStep('decider', null, decider, 'баланс силы двух команд');
  } else {
    ban(t1, t2, t1Name);
    ban(t2, t1, t2Name);
    pick(t1, t2, t1Name);
    pick(t2, t1, t2Name);
    ban(t1, t2, t1Name);
    ban(t2, t1, t2Name);
    const decider = pool.slice().sort((a,b) => {
      const sa = Math.min(rating(t1,a),rating(t2,a)) - Math.abs(rating(t1,a)-rating(t2,a))*0.42 + Math.random()*0.8;
      const sb = Math.min(rating(t1,b),rating(t2,b)) - Math.abs(rating(t1,b)-rating(t2,b))*0.42 + Math.random()*0.8;
      return sb - sa;
    })[0];
    mapsToPlay.push(decider);
    addStep('decider', null, decider, 'последняя сбалансированная карта');
  }
  if (!seasonState.mapPicksHistory) seasonState.mapPicksHistory = {};
  mapsToPlay.forEach(m => { seasonState.mapPicksHistory[m] = (seasonState.mapPicksHistory[m] || 0) + 1; });
  saveSeasonState();
  return { vetoLog, mapsToPlay, draftSteps };
}
function calcMapWinProbability(t1Name, t2Name, mapName) {
  const t1 = teams.find(t => t.name === t1Name);
  const t2 = teams.find(t => t.name === t2Name);
  if (!t1 || !t2) return 0.5;
  const base = calcMatchOdds(t1Name, t2Name, true)?.p1_win || 0.5;
  const mapDiff = ((t1.maps?.[mapName] || 50) - (t2.maps?.[mapName] || 50)) / 100;
  let fatigueDebuff = 0;
  if ((t1.fatigue || 0) >= 50) fatigueDebuff -= ((t1.fatigue - 50) * 0.003);
  if ((t2.fatigue || 0) >= 50) fatigueDebuff += ((t2.fatigue - 50) * 0.003);
  return Math.max(0.10, Math.min(0.90, base + mapDiff * 0.22 + fatigueDebuff));
}
function generateMatchEvent(t1Name, t2Name, winner, score) {
  const odds = calcMatchOdds(t1Name, t2Name, false);
  if (!odds) return null;
  const t1IsUnderdog = odds.p1_win < 0.4;
  const t2IsUnderdog = odds.p1_win > 0.6;
  const winnerIsUnderdog = (winner === t1Name && t1IsUnderdog) || (winner === t2Name && t2IsUnderdog);
  const winnerWinProb = winner === t1Name ? odds.p1_win : (1 - odds.p1_win);
  if (winnerIsUnderdog) {
    if (winnerWinProb < 0.22) return "🔥 ОГРОМНЫЙ АПСЕТ";
    else if (winnerWinProb < 0.35) return "🔥 АПСЕТ";
  }
  if (/2 - 1|1 - 2/.test(score) && Math.random() < 0.65) return "⚔️ БОЕВАЯ СЕРИЯ 2:1";
  return null;
}
function instantMatch(match, callback) {
  let isFinalMatch = false;
  if (currentTournament.hasLowerBracket) {
    isFinalMatch = (match === currentTournament.grandFinal);
  } else if (currentTournament.upperRounds && currentTournament.upperRounds.length > 0) {
    const lastR = currentTournament.upperRounds[currentTournament.upperRounds.length - 1];
    isFinalMatch = (match === lastR[0]);
  }
  const isMatchBO5 = match.isBO5 || (isFinalMatch && currentTournament.finalFormat === "BO5");
  const mode = match.isBO1 ? "BO1" : (isMatchBO5 ? "BO5" : "BO3");
  const winsRequired = mode === "BO1" ? 1 : (mode === "BO5" ? 3 : 2);
  const veto = conductMapVeto(match.t1, match.t2, mode);
  const t1Obj = teams.find(t => t.name === match.t1);
  const t2Obj = teams.find(t => t.name === match.t2);
  let styleAdvantage = 0;
  if (t1Obj?.style && t2Obj?.style) {
    const s1 = t1Obj.style, s2 = t2Obj.style;
    if (
      (s1 === "Tactical" && s2 === "Aggressive") ||
      (s1 === "Aggressive" && s2 === "Discipline") ||
      (s1 === "Discipline" && s2 === "Chaos") ||
      (s1 === "Chaos" && s2 === "Tactical")
    ) styleAdvantage = 0.008; // v29: преимущество стиля — на уровне раунда, поэтому маленькое
    else if (
      (s2 === "Tactical" && s1 === "Aggressive") ||
      (s2 === "Aggressive" && s1 === "Discipline") ||
      (s2 === "Discipline" && s1 === "Chaos") ||
      (s2 === "Chaos" && s1 === "Tactical")
    ) styleAdvantage = -0.008;
  }
  let s1 = 0, s2 = 0;
  let currentMapIdx = 0;
  const mapResults = [];
while (s1 < winsRequired && s2 < winsRequired && currentMapIdx < veto.mapsToPlay.length) {
    const map = veto.mapsToPlay[currentMapIdx];
    const f1 = Number(t1Obj?.fatigue) || 0;
    const f2 = Number(t2Obj?.fatigue) || 0;
    let directFatiguePenalty = 0; // v29: усталость уже учтена в силе команды (calcMatchOdds)
    let pickAdvantage = 0;        // v29: пик карты ≈ +4% к шансу на карту (было +8% к КАЖДОМУ раунду → почти гарантированная победа)
    if (currentMapIdx === 0) pickAdvantage = 0.012;
    else if (currentMapIdx === 1) pickAdvantage = -0.012;
    const baseMapProb = Math.max(0.10, Math.min(0.90, calcMapWinProbability(match.t1, match.t2, map) + styleAdvantage + pickAdvantage));
    let m1 = 0, m2 = 0;
    const roundWinners = [];
    let isOT = false;
    let target = 13;
    let roundNum = 0;
    let money1 = 800, money2 = 800;
    let lossStreak1 = 0, lossStreak2 = 0;
    const buyPower = { full: 1.0, half: 0.82, force: 0.70, eco: 0.40, pistol: 0.75 };
    const getBuyType = (money, roundNo, ot) => {
      if (!ot && (roundNo === 1 || roundNo === 13)) return 'pistol';
      if (money >= 4700) return 'full';
      if (money >= 3400) return 'half';
      if (money >= 2600) return 'force';
      return 'eco';
    };
    while (true) {
      roundNum++;
      if (roundNum === 13 && !isOT) {
        money1 = 800; money2 = 800;
        lossStreak1 = 0; lossStreak2 = 0;
      }
      const buy1 = getBuyType(money1, roundNum, isOT);
      const buy2 = getBuyType(money2, roundNum, isOT);
      const p1Power = buyPower[buy1] || 0.8;
      const p2Power = buyPower[buy2] || 0.8;
const f1 = Number(t1Obj?.fatigue) || 0;
      const f2 = Number(t2Obj?.fatigue) || 0;
      let fatigueAimPenalty = 0; // v29: см. выше — без двойного учёта усталости
      let roundProb = baseMapProb + (p1Power - p2Power) * 0.25 + fatigueAimPenalty;
      roundProb = Math.max(0.10, Math.min(0.90, roundProb));
      const roundWinnerSide = Math.random() < roundProb ? 1 : 2;
      roundWinners.push(roundWinnerSide);
      const costMap = { full: 4700, half: 3400, force: 2700, eco: 700, pistol: 500 };
      money1 = Math.max(0, money1 - (costMap[buy1] || 0));
      money2 = Math.max(0, money2 - (costMap[buy2] || 0));
      if (roundWinnerSide === 1) {
        m1++;
        money1 = Math.min(6500, money1 + 3250);
        lossStreak1 = 0;
        lossStreak2 = Math.min(5, lossStreak2 + 1);
        money2 = Math.min(6500, money2 + (1400 + lossStreak2 * 450));
      } else {
        m2++;
        money2 = Math.min(6500, money2 + 3250);
        lossStreak2 = 0;
        lossStreak1 = Math.min(5, lossStreak1 + 1);
        money1 = Math.min(6500, money1 + (1400 + lossStreak1 * 450));
      }
      if (!isOT && m1 === 12 && m2 === 12) {
        isOT = true;
        target = 16;
        money1 = 4500; money2 = 4500;
      } else if (isOT && m1 === 15 && m2 === 15) {
        target = 19;
        money1 = 4500; money2 = 4500;
      } else if (isOT && m1 === 18 && m2 === 18) {
        target = 22;
        money1 = 4500; money2 = 4500;
      }
      const wonByLead = (m1 >= target || m2 >= target) && Math.abs(m1 - m2) >= 2;
      const wonByMaxOt = isOT && (m1 >= target || m2 >= target);
      if (wonByLead || wonByMaxOt) {
        break;
      }
    }
    const mapWinner = m1 > m2 ? match.t1 : match.t2;
    if (m1 > m2) s1++; else s2++;
    mapResults.push({
      map,
      t1Score: m1,
      t2Score: m2,
      winner: mapWinner,
      overtime: isOT,
      rounds: roundWinners
    });
    currentMapIdx++;
  }
  match.score = `Счет: ${s1} - ${s2}`;
  match.event = generateMatchEvent(match.t1, match.t2, s1 > s2 ? match.t1 : match.t2, match.score);
  const winner = s1 > s2 ? match.t1 : match.t2;
  const loser = s1 > s2 ? match.t2 : match.t1;
  match.winner = winner;
  match.broadcastResult = {
    mode,
    t1: match.t1,
    t2: match.t2,
    series1: s1,
    series2: s2,
    maps: mapResults.map(x => ({
      ...x,
      rounds: Array.isArray(x.rounds) ? [...x.rounds] : []
    })),
    vetoLog: Array.isArray(veto.vetoLog) ? veto.vetoLog.map(x => ({...x})) : []
  };
  recordSeriesMapResults(match, mapResults);
  recordH2HWin(winner, loser);
  updateFatigueAndForm(winner, loser);
  accumulateMatchRating(winner, loser, match.isBO1);
  callback(winner, loser);
}
function getNextPlayableMatch() {
  if(!currentTournament||currentTournament.completed)return null;
  if (currentTournament.formatChoice === "bounty" && currentTournament.bounty && !currentTournament.bounty.lanStageStarted) {
    const b = currentTournament.bounty;
    for (let i = 0; i < b.stage1.length; i++) {
      const m = b.stage1[i];
      if (m.t1 && m.t2 && !m.winner) {
        return { match: m, callback: () => resolveBountyMatch(1, i), isFinal: false, stage: "Bounty: Стадия 1" };
      }
    }
    for (let i = 0; i < b.stage2.length; i++) {
      const m = b.stage2[i];
      if (m.t1 && m.t2 && !m.winner) {
        return { match: m, callback: () => resolveBountyMatch(2, i), isFinal: false, stage: "Bounty: Стадия 2" };
      }
    }
    return null;
  }
  if(currentTournament.isMajor&&currentTournament.majorStages){
    return getMajorCurrentMatch();
  }
  if (currentTournament.formatChoice === "swiss" && currentTournament.swiss) {
    for (let rIdx = 0; rIdx < currentTournament.swiss.rounds.length; rIdx++) {
      const round = currentTournament.swiss.rounds[rIdx];
      const mIdx = round.findIndex(m => m.t1 && m.t2 && !m.winner);
      if (mIdx !== -1) {
        return { match: round[mIdx], callback: () => resolveSwissMatch(rIdx, mIdx), isFinal: false, stage: `Swiss Р${rIdx+1}` };
      }
    }
    return null;
  }
  if (currentTournament.formatChoice === "gsl" && currentTournament.gsl) {
    for (let gIdx = 0; gIdx < currentTournament.gsl.groups.length; gIdx++) {
      let grp = currentTournament.gsl.groups[gIdx];
      for (let k in grp.matches) {
        let m = grp.matches[k];
        if (m.t1 && m.t2 && !m.winner) {
          return { match: m, callback: () => resolveGSLMatch(gIdx, k), isFinal: false, stage: `Группа ${String.fromCharCode(65+gIdx)}` };
        }
      }
    }
    return null;
  }
  if (currentTournament.hasLowerBracket) {
    const uR = currentTournament.upperRounds || [];
    const lR = currentTournament.lowerRounds || [];
    const size = currentTournament.size;
    const findMatchInRound = (roundsList, rIdx, isLower) => {
      if (!roundsList[rIdx]) return null;
      for (let m = 0; m < roundsList[rIdx].length; m++) {
        let match = roundsList[rIdx][m];
        if (match.t1 && match.t2 && !match.winner) {
          return {
            match,
            callback: isLower ? () => resolveLowerMatch(rIdx, m) : () => resolveUpperMatch(rIdx, m),
            isFinal: false,
            stage: isLower ? `Лузера Р${rIdx+1}` : getPlayoffStageName(rIdx, uR.length)
          };
        }
      }
      return null;
    };
    for (let r = 0; r < uR.length; r++) {
      const candidate = findMatchInRound(uR, r, false);
      if (candidate) return candidate;
    }
    for (let r = 0; r < lR.length; r++) {
      const candidate = findMatchInRound(lR, r, true);
      if (candidate) return candidate;
    }
    const upperFinal = uR.length ? uR[uR.length - 1]?.[0] : null;
    const lowerFinal = lR.length ? lR[lR.length - 1]?.[0] : null;
    if (currentTournament.grandFinal) {
      if (upperFinal?.winner) currentTournament.grandFinal.t1 = upperFinal.winner;
      if (lowerFinal?.winner) currentTournament.grandFinal.t2 = lowerFinal.winner;
    }
    if (currentTournament.grandFinal && currentTournament.grandFinal.t1 && currentTournament.grandFinal.t2 && !currentTournament.grandFinal.winner) {
      const isBO5 = currentTournament.isMajor || currentTournament.grandFinal.isBO5;
      return { match: currentTournament.grandFinal, callback: () => resolveGrandFinal(), isFinal: true, stage: `Гранд-финал${isBO5 ? ' (BO5)' : ''}` };
    }
    return null;
  }
  if (currentTournament.upperRounds) {
    const tot = currentTournament.upperRounds.length;
    for (let r = 0; r < tot - 1; r++) {
      for (let m = 0; m < currentTournament.upperRounds[r].length; m++) {
        let match = currentTournament.upperRounds[r][m];
        if (match.t1 && match.t2 && !match.winner) {
          return { match, callback: () => resolveUpperMatch(r, m), isFinal: false, stage: getPlayoffStageName(r, tot) };
        }
      }
    }
    if (currentTournament.bronzeMatch && currentTournament.bronzeMatch.t1 && currentTournament.bronzeMatch.t2 && !currentTournament.bronzeMatch.winner) {
      return { match: currentTournament.bronzeMatch, callback: () => resolveBronzeMatch(), isFinal: false, stage: "За 3-е место" };
    }
    const fIdx = tot - 1;
    if (currentTournament.upperRounds[fIdx]) {
      for (let m = 0; m < currentTournament.upperRounds[fIdx].length; m++) {
        let match = currentTournament.upperRounds[fIdx][m];
        if (match.t1 && match.t2 && !match.winner) {
          const isBO5 = currentTournament.isMajor || match.isBO5;
          return { match, callback: () => resolveUpperMatch(fIdx, m), isFinal: true, stage: `Финал${isBO5 ? ' (BO5)' : ''}` };
        }
      }
    }
  }
  return null;
}
function updateSimControlButtons(isRunning) {
  const stopBtn = document.getElementById("stop-sim-btn");
  const allBtn = document.getElementById("sim-all-btn");
  const stepBtn = document.getElementById("sim-step-btn");
  const tvBtn = document.getElementById("sim-tv-btn");
  if (isRunning) {
    if (stopBtn) stopBtn.style.display = "inline-block";
    if (allBtn) allBtn.disabled = true;
    if (stepBtn) stepBtn.disabled = true;
    if (tvBtn) tvBtn.disabled = true;
  } else {
    if (stopBtn) stopBtn.style.display = "none";
    if (allBtn) allBtn.disabled = false;
    if (stepBtn) stepBtn.disabled = false;
    if (tvBtn) tvBtn.disabled = false;
  }
}
function stopAllSimulations() {
  simulationRunToken++;
  stopRequested = true;
  for (const timeoutId of pendingBroadcastLaunches) {
    clearTimeout(timeoutId);
  }
  pendingBroadcastLaunches.clear();
  if (activeStepTimeout) {
    clearTimeout(activeStepTimeout);
    activeStepTimeout = null;
  }
  activeMatchSimAbort = true;
  isStepSimRunning = false;
  isFastSimRunning = false;
  isTVModeRunning = false;
  const b = currentTournament?.broadcast;
  if (b) {
    (b.timerIds || []).forEach(t => clearTimeout(t));
    b.timerIds = [];
    (b.active || []).forEach(item => {
      if (item.launchTimeout) clearTimeout(item.launchTimeout);
      if (item.vetoTimer) clearTimeout(item.vetoTimer);
      if (item.timer) clearTimeout(item.timer);
      if (item.match) item.match.broadcastStatus = 'none';
      item.launchTimeout = null;
      item.vetoTimer = null;
      item.timer = null;
    });
    b.active = [];
    b.queue = [];
    b.running = false;
    b.paused = false;
  }
  broadcastDetailViewing = false;
  broadcastDetailMatchId = null;
  const modal = document.getElementById('dice-modal');
  if (modal) modal.style.display = 'none';
  updateSimControlButtons(false);
}
function getBroadcastPlayableMatches() {
  const out = [];
  const add = (m, callback, stage) => {
    if (m && m.t1 && m.t2 && !m.winner && !out.some(x => x.match === m)) {
      out.push({ match:m, callback, stage });
    }
  };
  if (!currentTournament || currentTournament.completed) return out;
  if (currentTournament.isMajor && currentTournament.majorStages) {
    for (let si = 0; si < currentTournament.majorStages.length; si++) {
      const st = currentTournament.majorStages[si];
      if (!st || st.completed) continue;
      for (let rIdx = 0; rIdx < st.rounds.length; rIdx++) {
        const ready = [];
        st.rounds[rIdx].forEach((m, mIdx) => {
          if (m.t1 && m.t2 && !m.winner) ready.push({m, mIdx});
        });
        if (ready.length) {
          ready.forEach(({m, mIdx}) => add(m, () => resolveMajorSwissMatch(si + 1, rIdx, mIdx), `Major Stage ${si + 1} • R${rIdx + 1}`));
          return out;
        }
      }
    }
    const rounds = currentTournament.upperRounds || [];
    if (rounds.length) {
      for (let rIdx = 0; rIdx < rounds.length; rIdx++) {
        const ready = [];
        (rounds[rIdx] || []).forEach((m, mIdx) => {
          if (m.t1 && m.t2 && !m.winner) ready.push({m, mIdx});
        });
        if (ready.length) {
          ready.forEach(({m, mIdx}) => add(m, () => resolveUpperMatch(rIdx, mIdx), `Champions Stage • ${getPlayoffStageName(rIdx, rounds.length)}`));
          return out;
        }
      }
    }
    return out;
  }
  if (currentTournament.formatChoice === "swiss" && currentTournament.swiss) {
    const r = currentTournament.swiss.currentRound - 1;
    (currentTournament.swiss.rounds[r] || []).forEach((m, mIdx) => add(m, () => resolveSwissMatch(r, mIdx), `Swiss Р${r + 1}`));
    return out;
  }
  if (currentTournament.formatChoice === "gsl" && currentTournament.gsl) {
    currentTournament.gsl.groups.forEach((grp, gIdx) => Object.entries(grp.matches).forEach(([key, m]) => {
      if (m.t1 && m.t2 && !m.winner) add(m, () => resolveGSLMatch(gIdx, key), `Группа ${String.fromCharCode(65 + gIdx)}`);
    }));
    return out;
  }
  if (currentTournament.hasLowerBracket) {
    const uR = currentTournament.upperRounds || [];
    const lR = currentTournament.lowerRounds || [];
    const size = currentTournament.size;
    const phaseSequence = (size === 16) ? [
      { t:'U', r:0 }, { t:'L', r:0 }, { t:'L', r:1 }, { t:'U', r:1 }, { t:'L', r:2 },
      { t:'L', r:3 }, { t:'U', r:2 }, { t:'L', r:4 }, { t:'U', r:3 }, { t:'L', r:5 }
    ] : [
      { t:'U', r:0 }, { t:'L', r:0 }, { t:'L', r:1 }, { t:'U', r:1 }, { t:'L', r:2 }, { t:'U', r:2 }, { t:'L', r:3 }
    ];
    for (const step of phaseSequence) {
      const rounds = step.t === 'U' ? uR : lR;
      const round = rounds[step.r] || [];
      const ready = [];
      round.forEach((m, mIdx) => {
        if (m.t1 && m.t2 && !m.winner) ready.push({m, mIdx});
      });
      if (ready.length) {
        ready.forEach(({m, mIdx}) => add(
          m,
          step.t === 'U' ? () => resolveUpperMatch(step.r, mIdx) : () => resolveLowerMatch(step.r, mIdx),
          step.t === 'U' ? getPlayoffStageName(step.r, uR.length) : `Лузера Р${step.r + 1}`
        ));
        return out;
      }
    }
    if (currentTournament.grandFinal?.t1 && currentTournament.grandFinal?.t2 && !currentTournament.grandFinal.winner) {
      const m = currentTournament.grandFinal;
      add(m, () => resolveGrandFinal(), `Гранд-финал${m.isBO5 ? ' (BO5)' : ''}`);
    }
    return out;
  }
  if (currentTournament.upperRounds) {
    const rounds = currentTournament.upperRounds;
    for (let rIdx = 0; rIdx < rounds.length - 1; rIdx++) {
      const ready = [];
      (rounds[rIdx] || []).forEach((m, mIdx) => {
        if (m.t1 && m.t2 && !m.winner) ready.push({m, mIdx});
      });
      if (ready.length) {
        ready.forEach(({m, mIdx}) => add(m, () => resolveUpperMatch(rIdx, mIdx), getPlayoffStageName(rIdx, rounds.length)));
        return out;
      }
    }
    if (currentTournament.bronzeMatch?.t1 && currentTournament.bronzeMatch?.t2 && !currentTournament.bronzeMatch.winner) {
      add(currentTournament.bronzeMatch, () => resolveBronzeMatch(), "За 3-е место");
      return out;
    }
    const fIdx = rounds.length - 1;
    const finalReady = [];
    (rounds[fIdx] || []).forEach((m, mIdx) => {
      if (m.t1 && m.t2 && !m.winner) finalReady.push({m, mIdx});
    });
    finalReady.forEach(({m, mIdx}) => add(m, () => resolveUpperMatch(fIdx, mIdx), `Финал${m.isBO5 ? ' (BO5)' : ''}`));
  }
  return out;
}
function broadcastMatchKey(match) {
  if (!match._broadcastId) match._broadcastId = `bm_${Math.random().toString(36).slice(2,10)}`;
  return match._broadcastId;
}
function getBroadcastMode(match) {
  const isFinal = currentTournament?.grandFinal === match || currentTournament?.upperRounds?.at(-1)?.[0] === match;
  return match.isBO1 ? "BO1" : ((match.isBO5 || (isFinal && currentTournament.isMajor)) ? "BO5" : "BO3");
}
function setupBroadcastPanel() {
  const panel = document.getElementById("broadcast-panel");
  if (!panel || !currentTournament) return;
  panel.style.display = "flex";
  if (!currentTournament.broadcast) currentTournament.broadcast = {running:false,paused:false,queue:[],active:[],finished:[],clock:0,timerIds:[],featuredShown:false};
  renderBroadcastPanel();
}
function createBroadcastState(item) {
  const m = item.match;
  const mode = getBroadcastMode(m);
  const veto = conductMapVeto(m.t1, m.t2, mode);
  const maps = veto.mapsToPlay || [];
  return {
    mode, maps, vetoLog: veto.vetoLog || [], draftSteps: veto.draftSteps || [], mapIndex: 0,
    map1: 0, map2: 0, series1: 0, series2: 0,
    phase: 'map-draft', phaseText: '📋 MAP DRAFT • команды выбирают карты',
    round: 0, mapRoundWinners: [],
    mapResults: [],
    startedAt: Date.now(), lastRoundAt: Date.now(),
    phaseUntil: 0,
    overtime: false,
    overtimeStage: 0,
    pauseTeam: null,
    pauseReason: null,
    t1Pauses: 3,
    t2Pauses: 3,
    pauseHistory: [],
    roundHighlights: {}, roundPlus: {1:0,2:0}, clutch: {1:0,2:0},
    lastPauseTactic: null,
    tacticalHistory: {1:[], 2:[]},
    pauseImpact: {1:null, 2:null},
    economy: {
      t1: { money: 800, lossStreak: 0, lastBuy: null, lastResult: null },
      t2: { money: 800, lossStreak: 0, lastBuy: null, lastResult: null }
    },
    roundBuys: {},
    finished: false, events: [], vetoAnimation: {active:false,index:0},
    oddsAnchorRound: 0,
    oddsUpdatedAtRound: 0,
    oddsRefreshInterval: (typeof pickOddsRefreshInterval === 'function') ? pickOddsRefreshInterval() : 2
  };
}
function broadcastStageLabel(item) { return item?.stage || 'Матч'; }
function addBroadcastEvent(st, html, kind = 'normal') {
  st.events = st.events || [];
  st.events.unshift({html, at: Date.now(), kind});
}
const BROADCAST_ROUND_HIGHLIGHTS = [
  { icon:'🎯', label:'Клатч 1v2' },
  { icon:'🔄', label:'Успешный ретейк' },
  { icon:'⚡', label:'Быстрый энтри-фраг' },
  { icon:'💣', label:'Гранаты закрыли выход' },
  { icon:'🛡️', label:'Сухая защита точки' },
  { icon:'💰', label:'Форсбай сработал' },
  { icon:'🧠', label:'Чтение тактики соперника' },
  { icon:'🔪', label:'Агрессивный контакт' }
];
const POST_PAUSE_TACTICS = {
  Aggressive: [
    'Ускоренный выход на A',
    'Ранний контакт через мид',
    'Двойной энтри в B',
    'Ищем первый фраг любой ценой'
  ],
  Discipline: [
    'Медленный default без ранних рисков',
    'Сохраняем utility под ретейк',
    'Играем от разменов',
    'Не отдаём первые контакты'
  ],
  Tactical: [
    'Меняем тайминг выхода',
    'Ложный выход и смена точки',
    'Читаем экономику соперника',
    'Оставляем utility на концовку'
  ],
  Chaos: [
    'Неожиданный раш B',
    'Двойной агро-пуш',
    'Ломаем темп ранним контактом',
    'Смешиваем тайминги и роли'
  ]
};
const BROADCAST_BUY_TYPES = {
  pistol: { label:'ПИСТОЛЕТЫ', short:'PISTOL', icon:'🔫', cls:'pistol', cost:500 },
  full:   { label:'FULL BUY', short:'FULL BUY', icon:'💵', cls:'full', cost:4700 },
  eco:    { label:'ЭКО', short:'ECO', icon:'💸', cls:'eco', cost:700 },
  force:  { label:'FORCE BUY', short:'FORCE', icon:'⚔️', cls:'force', cost:2900 },
  hero:   { label:'HERO AK', short:'HERO AK', icon:'🦸', cls:'hero', cost:3000 },
  deagle: { label:'ДИГЛЫ', short:'DEAGLES', icon:'🎯', cls:'deagle', cost:1900 },
  half:   { label:'HALF BUY', short:'HALF BUY', icon:'🟡', cls:'half', cost:3400 },
  smg:    { label:'SMG / FORCE', short:'SMG', icon:'🧨', cls:'smg', cost:3200 },
  save:   { label:'SAVE', short:'SAVE', icon:'💾', cls:'save', cost:0 }
};
function getBroadcastRecentRounds(st, side, count = 6){
  const rounds = st?.mapRoundWinners || [];
  return rounds.slice(-count).filter(Boolean);
}
function getBroadcastTeamTrend(st, side, count = 6){
  const recent = getBroadcastRecentRounds(st, side, count);
  if (!recent.length) return {wins:0, losses:0, streak:0, winRate:0.5};
  const wins = recent.filter(x => x === side).length;
  const losses = recent.length - wins;
  let streak = 0;
  for (let i = recent.length - 1; i >= 0 && recent[i] === side; i--) streak++;
  return {wins, losses, streak, winRate:wins / recent.length};
}
function chooseBroadcastBuy(st, side, roundNo){
  const m = st.__match;
  const key = side === 1 ? 't1' : 't2';
  const otherKey = side === 1 ? 't2' : 't1';
  const econ = st.economy[key];
  const other = st.economy[otherKey];
  const ownScore = side === 1 ? st.map1 : st.map2;
  const oppScore = side === 1 ? st.map2 : st.map1;
  const deficit = oppScore - ownScore;
  const trend = getBroadcastTeamTrend(st, side, 6);
  const oppTrend = getBroadcastTeamTrend(st, side === 1 ? 2 : 1, 6);
  const priorBuyOther = other?.lastBuy;
  const priorResult = econ.lastResult;
  const priorPlan = st.roundBuys?.[roundNo - 1]?.[key];
  const priorCost = BROADCAST_BUY_TYPES[priorPlan?.type]?.cost || 0;
  if (!st.overtime && (roundNo === 1 || roundNo === 13)) return {type:'pistol', reason:'пистолетный раунд'};
  if (st.overtime) {
    if (econ.money >= 4200) return {type:'full', reason:'OT • полный закуп'};
    if (econ.money >= 2500 && (econ.lossStreak >= 1 || deficit > 0)) return {type:'force', reason:'OT • нельзя отдавать раунд'};
    if (econ.money >= 1800) return {type:'deagle', reason:'OT • игра от диглов'};
    return {type:'eco', reason:'OT • сохраняют экономику'};
  }
  if (deficit >= 4 && (econ.lossStreak >= 2 || trend.streak >= 2) && econ.money >= 2600) {
    if (Math.random() < 0.18 && econ.money >= 3000) return {type:'hero', reason:'отстают и проигрывают серию • рискованный HERO AK'};
    return {type:'force', reason:'отстают и проигрывают серию • вынужденный форс'};
  }
  if (oppTrend.streak >= 3 && econ.money < 4700 && econ.money >= 1800) {
    if (econ.lossStreak >= 2 && econ.money >= 2900 && Math.random() < 0.38) {
      return {type:'force', reason:'соперник на серии • попытка сломать темп форсом'};
    }
    if (econ.money < 3000) return {type:'eco', reason:'соперник на серии • сохраняют на полный закуп'};
  }
  if (priorResult === 'win' && priorBuyOther && ['eco','deagle','pistol'].includes(priorBuyOther) && econ.money >= 3100 && Math.random() < 0.24) {
    return {type:'smg', reason:'соперник на слабом закупе • бонусный SMG-раунд'};
  }
  if (econ.money >= 4700) return {type:'full', reason:'достаточно денег на полный закуп'};
  if (econ.lossStreak >= 2 || trend.streak >= 2) {
    if (econ.money >= 4200) return {type:'full', reason:'две потери подряд • накопили на полный ответ'};
    if (econ.money >= 3000) {
      if (deficit >= 3 && Math.random() < 0.28) return {type:'hero', reason:'отставание + серия потерь • HERO AK'};
      if (Math.random() < 0.58) return {type:'force', reason:'серия потерь • форс для остановки камбэка'};
      return {type:'half', reason:'серия потерь • полу-закуп и сохранение денег'};
    }
  }
  if (econ.lossStreak >= 1) {
    if (econ.money >= 4300 && priorCost < 4000) return {type:'full', reason:'проиграли прошлый раунд • теперь готовы к полному закупу'};
    if (econ.money >= 3600) return {type:'half', reason:'проигрыш прошлого раунда • экономный переход к full buy'};
    if (econ.money >= 2000 && Math.random() < 0.48) return {type:'deagle', reason:'проигрыш прошлого раунда • попытка сыграть от диглов'};
  }
  if (econ.money < 1900) return {type:'eco', reason:'денег мало • сохраняют на следующий'};
  if (econ.money < 2700) {
    if (Math.random() < 0.30) return {type:'deagle', reason:'ограниченный бюджет • диглы'};
    return {type:'eco', reason:'ограниченный бюджет • эко'};
  }
  if (econ.money < 4700) return {type:'half', reason:'не хватает на полный закуп'};
  return {type:'full', reason:'полный закуп'};
}
function prepareBroadcastRoundBuy(item, roundNo){
  const st = item?.state, m = item?.match;
  if (!st || !m || !roundNo) return null;
  st.__match = m;
  st.roundBuys = st.roundBuys || {};
  if (st.roundBuys[roundNo]) return st.roundBuys[roundNo];
  const bank1 = st.economy.t1.money;
  const bank2 = st.economy.t2.money;
  const buy1 = chooseBroadcastBuy(st, 1, roundNo);
  const buy2 = chooseBroadcastBuy(st, 2, roundNo);
  buy1.bank = bank1;
  buy2.bank = bank2;
  const plan = {t1:buy1, t2:buy2, round:roundNo, at:Date.now()};
  st.roundBuys[roundNo] = plan;
  st.economy.t1.lastBuy = buy1.type;
  st.economy.t2.lastBuy = buy2.type;
  return plan;
}
function applyBroadcastEconomyResult(st, winnerSide, roundNo){
  const plan = st.roundBuys?.[roundNo];
  if (!plan) return;
  [1,2].forEach(side=>{
    const key = side === 1 ? 't1' : 't2';
    const econ = st.economy[key];
    const buy = plan[key];
    const cost = BROADCAST_BUY_TYPES[buy.type]?.cost || 0;
    econ.money = Math.max(0, econ.money - cost);
    if (side === winnerSide) {
      econ.money = Math.min(6500, econ.money + 3250);
      econ.lossStreak = 0;
      econ.lastResult = 'win';
    } else {
      econ.lossStreak = Math.min(5, econ.lossStreak + 1);
      const lossBonus = 1400 + Math.min(4, econ.lossStreak) * 450;
      econ.money = Math.min(6500, econ.money + lossBonus);
      econ.lastResult = 'loss';
    }
  });
}
function addBroadcastEconomyEvent(st, m, roundNo){
  if (!st || !m || !roundNo) return;
  const plan = st.roundBuys?.[roundNo];
  if (!plan?.t1 || !plan?.t2) return;
  const t1Meta = BROADCAST_BUY_TYPES[plan.t1.type] || BROADCAST_BUY_TYPES.half;
  const t2Meta = BROADCAST_BUY_TYPES[plan.t2.type] || BROADCAST_BUY_TYPES.half;
  const e1 = st.economy?.t1;
  const e2 = st.economy?.t2;
  const bank1 = Number.isFinite(e1?.money) ? ` $${e1.money}` : '';
  const bank2 = Number.isFinite(e2?.money) ? ` $${e2.money}` : '';
  addBroadcastEvent(
    st,
    `💰 <strong>Раунд ${roundNo}</strong> • ${m.t1}: ${t1Meta.label}${bank1} • ${m.t2}: ${t2Meta.label}${bank2}`,
    'economy'
  );
}
function getBuyDisplay(teamName, buy){
  if (!buy) return '';
  const meta = BROADCAST_BUY_TYPES[buy.type] || BROADCAST_BUY_TYPES.half;
  const bank = Number.isFinite(buy.bank) ? ` • банк $${buy.bank}` : '';
  return `<span class="round-buy-pill ${meta.cls}" title="${buy.reason || ''}${bank}">${meta.icon} ${meta.label}</span>`;
}
function renderCurrentRoundBuy(st, m){
  const wrap = document.getElementById('round-buy-strip');
  const row = document.getElementById('round-buy-row');
  const label = document.getElementById('round-buy-round');
  const note = document.getElementById('round-buy-note');
  if (!wrap || !row || !label || !note) return;
  if (!st || !m) {
    wrap.style.display = 'none';
    return;
  }
  const displayRound = st.round || 1;
  const plan = st.roundBuys?.[displayRound];
  if (!plan) { wrap.style.display = 'none'; return; }
  label.innerText = `Раунд ${displayRound}` + (st.overtime ? ' • OT' : '');
  row.innerHTML = `
    <div class="round-buy-team t1">
      <span style="min-width:0;overflow:hidden;text-overflow:ellipsis;">${m.t1}</span>
      ${getBuyDisplay(m.t1, plan.t1)}
    </div>
    <div style="font-size:8px;color:var(--text-muted);font-weight:900;">VS</div>
    <div class="round-buy-team t2">
      ${getBuyDisplay(m.t2, plan.t2)}
      <span style="min-width:0;overflow:hidden;text-overflow:ellipsis;">${m.t2}</span>
    </div>
  `;
  note.innerText = `${m.t1}: ${plan.t1.reason} • ${m.t2}: ${plan.t2.reason}`;
  if (st.round === 0) note.innerText = `Открытие карты: пистолетный раунд • стартовый банк $800`;
  wrap.style.display = 'flex';
}
function maybeAddBroadcastRoundHighlight(item, winnerSide) {
  const st = item?.state, m = item?.match;
  if (!st || !m || st.finished || st.round < 3) return false;
  if (Math.random() > 0.18) return false;
  const event = BROADCAST_ROUND_HIGHLIGHTS[Math.floor(Math.random() * BROADCAST_ROUND_HIGHLIGHTS.length)];
  const winner = winnerSide === 1 ? m.t1 : m.t2;
  const highlight = { icon:event.icon, label:event.label, team:winner, round:st.round };
  st.roundHighlights = st.roundHighlights || {};
  st.roundHighlights[st.round] = highlight;
  resetOddsAnchor(st, st.round);
  st.roundPlus = st.roundPlus || {1:0,2:0};
  st.clutch = st.clutch || {1:0,2:0};
  st.roundPlus[winnerSide] = (st.roundPlus[winnerSide] || 0) + 1;
  if (Math.random() < 0.22) st.clutch[winnerSide] = (st.clutch[winnerSide] || 0) + 1;
  addBroadcastEvent(
    st,
    `${event.icon} <strong>Раунд ${st.round} • ${event.label}</strong> — ${winner}`,
    'highlight'
  );
  return true;
}
function choosePostPauseTactic(st, side, mapName) {
  const m = st?.__match;
  const teamName = side === 1 ? m?.t1 : m?.t2;
  const opponentName = side === 1 ? m?.t2 : m?.t1;
  const team = teams.find(t => t.name === teamName);
  const style = team?.style || 'Tactical';
  const trend = getBroadcastTeamTrend(st, side, 6);
  const oppTrend = getBroadcastTeamTrend(st, side === 1 ? 2 : 1, 6);
  const scoreDiff = (side === 1 ? st.map1 - st.map2 : st.map2 - st.map1);
  const pool = POST_PAUSE_TACTICS[style] || POST_PAUSE_TACTICS.Tactical;
  let preferred = [];
  if (trend.losses >= 4 || oppTrend.streak >= 3 || scoreDiff <= -3) {
    preferred = style === 'Aggressive'
      ? ['Ранний контакт через мид', 'Двойной энтри в B', 'Ищем первый фраг любой ценой']
      : style === 'Discipline'
        ? ['Играем от разменов', 'Не отдаём первые контакты', 'Сохраняем utility под ретейк']
        : style === 'Chaos'
          ? ['Неожиданный раш B', 'Двойной агро-пуш', 'Смешиваем тайминги и роли']
          : ['Меняем тайминг выхода', 'Ложный выход и смена точки', 'Оставляем utility на концовку'];
  } else if (trend.streak >= 3 || scoreDiff >= 3) {
    preferred = style === 'Discipline'
      ? ['Медленный default без ранних рисков', 'Играем от разменов', 'Не отдаём первые контакты']
      : style === 'Aggressive'
        ? ['Ускоренный выход на A', 'Ранний контакт через мид', 'Двойной энтри в B']
        : ['Сохраняем utility под ретейк', 'Меняем тайминг выхода', 'Ложный выход и смена точки'];
  } else {
    preferred = pool.slice();
  }
  const recentTactics = (st.tacticalHistory?.[side] || []).slice(-3).map(x => x.base);
  const fresh = preferred.filter(x => !recentTactics.includes(x));
  const choices = fresh.length ? fresh : preferred;
  const base = choices[Math.floor(Math.random() * choices.length)] || pool[0];
  const tactic = `${base}${mapName ? ` на ${mapName}` : ''}`;
  const opponent = opponentName ? ` • против ${opponentName}` : '';
  return {base, text:`${tactic}${opponent}`, style, scoreDiff, streak:trend.streak, opponentStreak:oppTrend.streak};
}
function publishPostPauseTactic(st, teamName, mapName) {
  if (!st || !st.__match || !teamName) return null;
  const side = teamName === st.__match.t1 ? 1 : 2;
  const result = choosePostPauseTactic(st, side, mapName);
  const now = Date.now();
  const history = st.tacticalHistory?.[side] || [];
  st.tacticalHistory = st.tacticalHistory || {1:[],2:[]};
  st.tacticalHistory[side] = history.concat([{base:result.base, round:st.round, at:now}]).slice(-8);
  const losing = result.scoreDiff <= -2 || result.opponentStreak >= 2;
  const baseBoost = result.style === 'Tactical' ? 0.045 : (result.style === 'Discipline' ? 0.035 : 0.025);
  const pressureBoost = losing ? 0.018 : 0;
  const styleMultiplier = result.style === 'Aggressive' && /контакт|энтри|раш|агро/i.test(result.base) ? 1.15 : 1;
  st.pauseImpact = st.pauseImpact || {1:null,2:null};
  st.pauseImpact[side] = {
    team:teamName,
    base:result.base,
    startedRound:st.round,
    roundsLeft:2,
    boost:(baseBoost + pressureBoost) * styleMultiplier,
    confidence: losing ? 'high' : 'normal'
  };
  st.lastPauseTactic = {team:teamName, tactic:result.text, at:now, round:st.round};
  st.phaseText = `🧠 ${teamName}: ${result.text}`;
  addBroadcastEvent(st, `🧠 <b>${teamName}</b> после паузы: ${result.text}`, 'tactic');
  return result.text;
}
function getBroadcastTacticalModifier(st, side) {
  const impact = st?.pauseImpact?.[side];
  if (!impact || impact.roundsLeft <= 0) return 0;
  return impact.boost * (impact.roundsLeft === 2 ? 1 : 0.55);
}
function consumeBroadcastTacticalImpact(st) {
  if (!st?.pauseImpact) return;
  [1,2].forEach(side => {
    const impact = st.pauseImpact[side];
    if (!impact || impact.roundsLeft <= 0) return;
    impact.roundsLeft--;
  });
}
function pickOddsRefreshInterval() {
  return 1 + Math.floor(Math.random() * 3);
}
function resetOddsAnchor(st, round) {
  st.oddsAnchorRound = round;
  st.oddsUpdatedAtRound = round;
  st.oddsRefreshInterval = pickOddsRefreshInterval();
}
function maybeRefreshBroadcastOdds(item) {
  const st = item?.state;
  if (!st || st.finished) return false;
  const round = Number(st.round) || 0;
  if (round <= 0) return false;
  const anchor = Number.isFinite(Number(st.oddsAnchorRound))
    ? Number(st.oddsAnchorRound)
    : 0;
  const interval = Number.isFinite(Number(st.oddsRefreshInterval)) && Number(st.oddsRefreshInterval) > 0
    ? Number(st.oddsRefreshInterval)
    : 2;
  if (round - anchor < interval) return false;
  if (typeof updateBroadcastLiveOdds !== 'function') return false;
  updateBroadcastLiveOdds(item);
  resetOddsAnchor(st, round);
  return true;
}
function getMaxParallelMatches() {
  return 2;
}
function getBroadcastItemByMatch(match) {
  const b = currentTournament?.broadcast;
  if (!b || !match) return null;
  return (b.active || []).find(x => x.match === match)
      || (b.queue || []).find(x => x.match === match)
      || (b.finished || []).find(x => x.match === match)
      || null;
}
function getSelectedBroadcastItem() {
  const b = currentTournament?.broadcast;
  if (!b || !broadcastDetailMatchId) return null;
  return (b.active || []).find(x => x.id === broadcastDetailMatchId) || null;
}
function getBroadcastStatusText(item) {
  if (!item) return '';
  if (item.status === 'done') return '✓ Завершен';
  const st = item.state;
  if (!st) return '🕒 Будущий матч';
  const parts = [];
  if (st.phase === 'tactical-pause' && st.pauseTeam) parts.push(`⏸ Пауза: ${st.pauseTeam}`);
  if (st.overtime) parts.push('🔥 ОВЕРТАЙМ');
  if (st.phase === 'halftime') parts.push('⏸ Смена сторон');
  if (st.phase === 'map-draft') parts.push('📋 MAP DRAFT');
  if (!parts.length && item.status === 'live') parts.push('▶ Идет игра');
  return parts.join(' • ') || '▶ Идет игра';
}
function getBroadcastStateClass(item) {
  const st = item?.state;
  if (!st) return 'future';
  if (st.phase === 'tactical-pause') return 'pause';
  if (st.phase === 'map-draft') return 'pause';
  if (st.overtime) return 'overtime';
  return '';
}
function formatBroadcastScore(item) {
  const st = item?.state;
  if (!st) return item?.match?.broadcastScore || item?.match?.score || 'ожидание';
  let text = `${st.map1}:${st.map2} • ${st.series1}:${st.series2}`;
  if (st.overtime) text += ' • 🔥 OT';
  if (st.phase === 'tactical-pause' && st.pauseTeam) text += ` • ⏸ ${st.pauseTeam}`;
  return text;
}
function scheduleNextBroadcastBatch() {
  const b = currentTournament?.broadcast;
  if (!b || !b.running || b.paused || b.active.length) return;
  buildBroadcastQueue();
  if (!b.queue.length) {
    renderBroadcastPanel();
    return;
  }
  const maxSimultaneous = getMaxParallelMatches();
  const nextBatchId = Math.min(...b.queue.map(x => Number.isFinite(x.batchId) ? x.batchId : Number.MAX_SAFE_INTEGER));
  const batch = b.queue
    .filter(x => x.batchId === nextBatchId)
    .sort((a,b) => a.time - b.time)
    .slice(0, maxSimultaneous);
  if (!batch.length) return;
  batch.forEach((candidate, launchIndex) => {
    const idx = b.queue.indexOf(candidate);
    if (idx !== -1) b.queue.splice(idx, 1);
    candidate.status = 'live';
    candidate.state = createBroadcastState(candidate);
    b.active.push(candidate);
    const launchRunToken = simulationRunToken;
    const launchTournament = currentTournament;
    let launchTimeout = null;
    launchTimeout = setTimeout(() => {
      pendingBroadcastLaunches.delete(launchTimeout);
      candidate.launchTimeout = null;
      if (
        launchRunToken !== simulationRunToken ||
        currentTournament !== launchTournament ||
        !currentTournament?.broadcast?.running ||
        !isTVModeRunning ||
        candidate.status !== 'live' ||
        candidate.state?.finished
      ) return;
      launchBroadcastMatch(candidate);
    }, 0);
    candidate.launchTimeout = launchTimeout;
    pendingBroadcastLaunches.add(launchTimeout);
  });
  renderBroadcastPanel();
  renderTournament();
  setTimeout(() => {
    const liveItems = (currentTournament?.broadcast?.active || []).filter(x => x.status === 'live' && !x.state?.finished);
    liveItems.forEach(x => {
      if (!x.timer && !x.vetoTimer && x.launchTimeout == null) launchBroadcastMatch(x);
    });
  }, Math.max(3600, maxSimultaneous * 1900));
}
function renderBroadcastPanel() {
  const b = currentTournament?.broadcast;
  if (!b) return;
  const status = document.getElementById('broadcast-status');
  if (status) {
    status.innerText = b.running
      ? (b.paused ? '⏸ Эфир на паузе' : (b.active.length ? `🔴 LIVE • ${b.active.length} в эфире` : (b.queue.length ? '⏳ Следующая пара матчей' : '⏳ Перерыв между матчами')))
      : 'Эфир остановлен';
  }
  const live = document.getElementById('broadcast-live-list');
  if (live) {
    live.innerHTML = b.active.length ? b.active.map(item => {
      const m = item.match, st = item.state || {};
      const stateText = getBroadcastStatusText(item);
      const stateClass = getBroadcastStateClass(item);
      return `<div class="live-match-row" data-broadcast-id="${item.id}">
        <span class="live-dot"></span>
        <span class="live-match-teams"><b>${m.t1} vs ${m.t2}</b> (${broadcastStageLabel(item)} • ${st.mode || getBroadcastMode(m)})<br><span class="broadcast-live-state ${stateClass}">${stateText}</span></span>
        <span class="live-match-score">${formatBroadcastScore(item)}</span>
      </div>`;
    }).join('') : '<div class="broadcast-empty">Сейчас матчей в эфире нет</div>';
    live.querySelectorAll('.live-match-row').forEach(el => {
      el.classList.toggle('selected', el.dataset.broadcastId === broadcastDetailMatchId);
      el.onclick = () => openBroadcastMatchDetail(el.dataset.broadcastId);
    });
  }
  const schedule = document.getElementById('broadcast-schedule-list');
  if (schedule) {
    const future = [...(b.queue || [])].sort((a,b) => a.time - b.time);
    const active = [...(b.active || [])].sort((a,b) => a.time - b.time);
    const finished = [...(b.finished || [])].sort((a,b) => (b.doneAt || 0) - (a.doneAt || 0)).slice(0, 10);
    const all = [...active, ...future, ...finished].slice(0, 30);
    schedule.innerHTML = all.length ? all.map(item => {
      const m = item.match;
      const isLive = item.status === 'live';
      const isDone = item.status === 'done';
      const tm = item.time ? new Date(item.time).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'}) : '—';
      const stateText = isLive ? getBroadcastStatusText(item) : (isDone ? '✓ Завершен' : '🕒 Будущий матч');
      const stateClass = isLive ? getBroadcastStateClass(item) : (isDone ? 'done' : 'future');
      return `<div class="schedule-row" data-schedule-id="${item.id || ''}" style="cursor:${isDone ? 'default' : 'pointer'}">
        <span class="schedule-time">${isLive ? 'LIVE' : isDone ? '✓' : tm}</span>
        <span class="schedule-stage" title="${item.stage || ''}">${item.stage || 'Матч'}</span>
        <span class="schedule-teams">${m.t1} vs ${m.t2}</span>
        <span class="schedule-status ${stateClass}">${stateText}</span>
      </div>`;
    }).join('') : '<div class="broadcast-empty">Расписание пусто</div>';
    schedule.querySelectorAll('.schedule-row[data-schedule-id]').forEach(el => {
      const item = [...(b.active||[]), ...(b.queue||[])].find(x => x.id === el.dataset.scheduleId);
      if (!item) return;
      el.onclick = () => item.status === 'live' ? openBroadcastMatchDetail(item.id) : openBroadcastScheduledPreview(item.match);
    });
  }
}
function buildBroadcastQueue() {
  const b = currentTournament?.broadcast;
  if (!b) return;
  const playable = getBroadcastPlayableMatches();
  const existing = new Set([...(b.active || []), ...(b.queue || []), ...(b.finished || [])].map(x => x.match));
  let cursor = Math.max(b.scheduleCursor || Date.now(), Date.now());
  if (!Number.isFinite(b.nextBatchId)) b.nextBatchId = 1;
  for (let i = 0; i < playable.length; i += 2) {
    const batch = playable.slice(i, i + 2).filter(x => !existing.has(x.match));
    if (!batch.length) continue;
    const batchId = b.nextBatchId++;
    const windowMs = Math.max(...batch.map(x => {
      const mode = getBroadcastMode(x.match);
      return mode === 'BO1' ? 18 * 60 * 1000 : (mode === 'BO5' ? 100 * 60 * 1000 : 65 * 60 * 1000);
    }));
    batch.forEach(x => {
      const item = { id: broadcastMatchKey(x.match), ...x, status: 'scheduled', time: cursor, batchId };
      b.queue.push(item);
      existing.add(x.match);
    });
    cursor += windowMs;
  }
  b.scheduleCursor = cursor;
}
function renderLiveDetailStats(st) {
  const rounds = st.mapRoundWinners || [];
  const recent = rounds.slice(-8);
  const c1 = recent.filter(x => x === 1).length;
  const c2 = recent.filter(x => x === 2).length;
  const total = Math.max(1, recent.length);
  const streakSide = rounds.length ? rounds[rounds.length - 1] : 0;
  let streak = 0;
  for (let i = rounds.length - 1; i >= 0 && rounds[i] === streakSide; i--) streak++;
  document.getElementById('stat-team1-streak').innerText = streakSide === 1 ? `🔥 ${streak}` : '—';
  document.getElementById('stat-team2-streak').innerText = streakSide === 2 ? `🔥 ${streak}` : '—';
  document.getElementById('stat-team1-last').innerText = recent.length ? `${c1}W / ${c2}L` : '—';
  document.getElementById('stat-team2-last').innerText = recent.length ? `${c2}W / ${c1}L` : '—';
  document.getElementById('stat-team1-roundpct').innerText = `${Math.round(c1 / total * 100)}%`;
  document.getElementById('stat-team2-roundpct').innerText = `${Math.round(c2 / total * 100)}%`;
  const fill1 = document.getElementById('stat-round-fill-1');
  const fill2 = document.getElementById('stat-round-fill-2');
  if (fill1) fill1.style.width = `${Math.round(c1 / total * 100)}%`;
  if (fill2) fill2.style.width = `${Math.round(c2 / total * 100)}%`;
  const plus = st.roundPlus || {1:0,2:0};
  const clutch = st.clutch || {1:0,2:0};
  const e = st.economy || {};
  const set = (id, value) => { const el=document.getElementById(id); if(el) el.innerText=value; };
  set('stat-team1-plus', `${plus[1] || 0} / ${clutch[1] || 0}`);
  set('stat-team2-plus', `${plus[2] || 0} / ${clutch[2] || 0}`);
  set('stat-team1-economy', `$${e.t1?.money ?? 0}`);
  set('stat-team2-economy', `$${e.t2?.money ?? 0}`);
}
function renderBroadcastVetoDetail(item) {
  const st = item?.state, m = item?.match;
  const wrap = document.getElementById('veto-container');
  if (!wrap || !st || !m) return;
  const steps = st.draftSteps || st.vetoLog || [];
  const active = !!st.vetoAnimation?.active;
  const index = Number.isFinite(st.vetoAnimation?.index) ? st.vetoAnimation.index : steps.length;
  const shown = active ? steps.slice(0, Math.max(0, index + 1)) : steps;
  const pct = steps.length ? Math.round(Math.min(steps.length, index + (active ? 0 : 1)) / steps.length * 100) : 100;
  const used = new Map();
  shown.forEach(x => {
    if (!x?.map) return;
    used.set(x.map, x.type === 'ban' ? 'banned' : (x.type === 'pick' ? 'selected' : 'decider'));
  });
  const poolHtml = MAP_POOL.map(map => {
    const cls = used.get(map) || (active && steps[index]?.map === map ? 'active' : '');
    return `<span class="map-draft-chip ${cls}">${map}</span>`;
  }).join('');
  if (active) {
    const current = steps[index];
    const currentText = current
      ? `<div class="map-draft-card"><strong>${current.type === 'ban' ? '🚫 BAN' : current.type === 'pick' ? '✅ PICK' : '🎯 DECIDER'}</strong> • ${current.team || 'Обе команды'} → <b>${current.map}</b></div>`
      : '';
    wrap.innerHTML = `
      <div class="map-draft-head">
        <span style="font-weight:bold;color:var(--accent);">📋 MAP DRAFT • ${st.mode}</span>
        <span style="font-size:8px;color:var(--text-muted);">${Math.min(index + 1, steps.length)}/${steps.length}</span>
      </div>
      <div class="map-draft-progress"><div style="width:${pct}%;"></div></div>
      ${currentText}
      <div class="map-draft-pool" style="justify-content:center;margin-top:6px;">${poolHtml}</div>
    `;
    return;
  }
  wrap.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:5px;">
      <span style="font-size:10px;font-weight:bold;color:var(--accent);">🗺️ Маппул серии (${st.mode}):</span>
      <span style="font-size:9.5px;color:var(--gold);">Играем: <b>${st.maps.join(', ')}</b></span>
    </div>
    <div class="map-draft-pool" style="justify-content:center;gap:6px;margin:2px 0;">${poolHtml}</div>
  `;
}
function animateBroadcastMapDraft(item, done) {
  const b = currentTournament?.broadcast;
  const st = item?.state;
  if (!b || !st || st.finished) return;
  const steps = st.draftSteps || [];
  st.vetoAnimation = {active:true,index:0,startedAt:Date.now()};
  st.phase = 'map-draft';
  st.phaseText = '📋 MAP DRAFT • команды выбирают карты';
  let i = 0;
  if (!steps.length) {
    st.vetoAnimation.active = false;
    st.phase = 'playing';
    st.phaseText = `Карта 1 • ${st.maps?.[0] || ''}`;
    if (typeof done === 'function') done();
    return;
  }
  const stepDelay = () => Math.max(280, Math.round(420 / Math.max(0.1, tvPlaybackSpeed)));
  const run = () => {
    if (!b.running || b.paused || b.broadcastStopRequested || st.finished) {
      if (b.running && !st.finished) item.vetoTimer = setTimeout(run, 250);
      return;
    }
    st.vetoAnimation.index = i;
    if (broadcastDetailViewing && broadcastDetailMatchId === item.id) renderBroadcastVetoDetail(item);
    renderBroadcastPanel();
    if (i >= steps.length - 1) {
      st.vetoAnimation.active = false;
      st.phase = 'playing';
      st.phaseText = `Карта 1 • ${st.maps[0] || ''}`;
      addBroadcastEvent(st, `🗺️ <strong>Драфт завершён.</strong> Серия: ${st.maps.join(' → ')}`);
      if (broadcastDetailViewing && broadcastDetailMatchId === item.id) broadcastRenderDetail(item);
      renderBroadcastPanel();
      if (typeof done === 'function') done();
      return;
    }
    i++;
    item.vetoTimer = setTimeout(run, stepDelay());
  };
  renderBroadcastVetoDetail(item);
  item.vetoTimer = setTimeout(run, stepDelay());
}
function broadcastRenderDetail(item) {
  const st = item?.state, m = item?.match;
  const startPanel = document.getElementById('manual-match-start-panel');
  if (startPanel) startPanel.style.display = 'none';
  if (!st || !m) return;
  const mode = st.mode || getBroadcastMode(m);
  document.getElementById('live-detail-stats').style.display = 'block';
  const staleResultTimelines = document.getElementById('completed-result-timelines');
  if (staleResultTimelines) staleResultTimelines.remove();
  const liveTimelineBox = document.getElementById('timeline-first-half')?.closest('.round-timeline-box');
  if (liveTimelineBox) liveTimelineBox.style.display = 'flex';
  const pausePanel = document.getElementById('tactical-pause-panel');
  if (pausePanel) pausePanel.style.display = st.finished ? 'none' : 'flex';
  const substatus = document.getElementById('dice-match-substatus');
  if (substatus) {
    substatus.innerText = st.finished
      ? 'ЗАВЕРШЕН'
      : (currentTournament.broadcast?.paused ? 'ЭФИР НА ПАУЗЕ' : 'LIVE • трансляция матча');
  }
  document.getElementById('dice-match-title').innerText = `${m.t1} vs ${m.t2} (${mode}) • ДЕТАЛИ LIVE`;
  const hype = getMatchHype(m.t1, m.t2);
  document.getElementById('dice-match-hype').innerHTML = hype
    ? `<b style="color:#ff7675;">${hype.label}</b> • 👁️ ${hype.viewers}`
    : '';
  document.getElementById('team1-live-name').innerText = m.t1;
  document.getElementById('team2-live-name').innerText = m.t2;
  document.getElementById('team1-live-score').innerText = st.map1 ?? 0;
  document.getElementById('team2-live-score').innerText = st.map2 ?? 0;
  document.getElementById('team1-maps-won').innerText = `${st.series1 ?? 0} карт${st.series1 === 1 ? 'а' : ''}`;
  document.getElementById('team2-maps-won').innerText = `${st.series2 ?? 0} карт`;
  const currentMap = st.maps?.[st.mapIndex];
  const t1Card = document.getElementById('team1-live-name')?.parentElement;
  const t2Card = document.getElementById('team2-live-name')?.parentElement;
  if (t1Card && t2Card) {
    t1Card.querySelectorAll('.map-live-winrates').forEach(el => el.remove());
    t2Card.querySelectorAll('.map-live-winrates').forEach(el => el.remove());
    if (currentMap) {
      if (!st.liveOdds && typeof updateBroadcastLiveOdds === 'function') {
        updateBroadcastLiveOdds(item);
      }
      const initOdds = calcMatchOdds(m.t1, m.t2, st.mode === 'BO1');
      const liveOdds = st.liveOdds || {
        c1: initOdds?.c1 || '1.88',
        c2: initOdds?.c2 || '1.88',
        p1: initOdds?.pct1 || 50,
        p2: initOdds?.pct2 || 50
      };
      const row1 = document.createElement('div');
      row1.className = 'map-live-winrates';
      row1.style.cssText = 'display:flex; flex-direction:column; align-items:center; width:100%; margin-top:4px; gap:3px;';
      row1.innerHTML = `
        <span class="map-live-winrate t1">${liveOdds.p1}% шанс</span>
        <span class="live-coeff-badge">${liveOdds.c1}x</span>
      `;
      t1Card.appendChild(row1);
      const row2 = document.createElement('div');
      row2.className = 'map-live-winrates';
      row2.style.cssText = 'display:flex; flex-direction:column; align-items:center; width:100%; margin-top:4px; gap:3px;';
      row2.innerHTML = `
        <span class="map-live-winrate t2">${liveOdds.p2}% шанс</span>
        <span class="live-coeff-badge">${liveOdds.c2}x</span>
      `;
      t2Card.appendChild(row2);
    }
  }
  const mapTitleEl = document.getElementById('current-map-title');
  if (mapTitleEl) {
    mapTitleEl.innerText = currentMap ? `Карта #${st.mapIndex + 1}: ${currentMap}` : 'Матч завершен';
    const mapParent = mapTitleEl.parentElement;
    if (mapParent) {
      mapParent.querySelectorAll('.map-side-wr').forEach(el => el.remove());
      if (currentMap && !st.finished) {
        const wr1 = getMapWinrate(m.t1, currentMap);
        const wr2 = getMapWinrate(m.t2, currentMap);
        const leftBadge = document.createElement('div');
        leftBadge.className = 'map-side-wr';
        leftBadge.style.cssText = 'background:#111721; border:1px solid rgba(79,156,247,0.45); color:var(--blue); font-size:11px; font-weight:700; padding:4px 10px; border-radius:6px; display:inline-flex; align-items:center; gap:4px;';
        leftBadge.innerHTML = `<span>${m.t1}:</span> <b>${wr1}% WR</b>`;
        const rightBadge = document.createElement('div');
        rightBadge.className = 'map-side-wr';
        rightBadge.style.cssText = 'background:#111721; border:1px solid rgba(239,83,100,0.45); color:var(--loss); font-size:11px; font-weight:700; padding:4px 10px; border-radius:6px; display:inline-flex; align-items:center; gap:4px;';
        rightBadge.innerHTML = `<span>${m.t2}:</span> <b>${wr2}% WR</b>`;
        mapParent.insertBefore(leftBadge, mapTitleEl);
        mapParent.appendChild(rightBadge);
      }
    }
  }
  const stateBanner = document.getElementById('live-match-state-banner');
  if (stateBanner) {
    stateBanner.style.display = 'block';
    stateBanner.className = `match-broadcast-state ${getBroadcastStateClass(item)}`;
    stateBanner.innerText = getBroadcastStatusText(item);
  }
  renderBroadcastVetoDetail(item);
  const currentProb = st.liveOdds || { p1: 50, p2: 50, c1: '1.88', c2: '1.88' };
  document.getElementById('mom-fill-t1').style.width = `${currentProb.p1}%`;
  document.getElementById('mom-fill-t2').style.width = `${currentProb.p2}%`;
  document.getElementById('mom-t1-pct').innerText = `${m.t1}: ${currentProb.p1}% (${currentProb.c1}x)`;
  document.getElementById('mom-t2-pct').innerText = `(${currentProb.c2}x) ${currentProb.p2}% :${m.t2}`;
  renderLiveDetailStats(st);
  try {
    renderCurrentRoundBuy(st, m);
  } catch (err) {}
  document.getElementById('dice-verdict').innerText = st.finished ? `🏆 Матч завершен: ${m.score}` : '';
  const pause = document.getElementById('tv-pause-btn');
  if (pause) {
    const paused = !!currentTournament.broadcast.paused;
    pause.innerText = paused ? '▶ Продолжить эфир' : '⏸ Пауза эфира';
    pause.classList.toggle('broadcast-resume-ready', paused);
    pause.disabled = !currentTournament.broadcast.running;
    pause.onclick = (ev) => {
      ev['\x70\x72\x65\x76\x65\x6e\x74Default']();
      ev.stopPropagation();
      if (currentTournament?.broadcast?.running) toggleTournamentBroadcastPause();
    };
  }
  const skip = document.getElementById('tv-skip-btn');
  if (skip) {
    skip.innerText = st.finished ? '✓ Завершен' : '⏭ Скипнуть этот матч';
    skip.onclick = () => nextBroadcastMatch();
  }
  document.getElementById('tv-playback-controls').style.display = 'flex';
  updatePauseButtonsUI();
}
function finishBroadcastSeries(item) {
  const st = item.state, m = item.match;
  const winner = st.series1 > st.series2 ? m.t1 : m.t2;
  const loser = winner === m.t1 ? m.t2 : m.t1;
  m.score = `Счет: ${st.series1} - ${st.series2}`;
  m.winner = winner;
  m.broadcastResult = {
    mode: st.mode,
    t1: m.t1,
    t2: m.t2,
    series1: st.series1,
    series2: st.series2,
    maps: (st.mapResults || []).map(x => ({...x, rounds:[...(x.rounds || [])]})),
    vetoLog: (st.vetoLog || []).map(x => ({...x}))
  };
  m.event = generateMatchEvent(m.t1, m.t2, winner, m.score);
  recordSeriesMapResults(m, st.mapResults || []);
  recordH2HWin(winner, loser);
  updateFatigueAndForm(winner, loser);
  accumulateMatchRating(winner, loser, m.isBO1);
  st.finished = true;
  st.phase = 'finished';
  st.phaseText = `🏆 ${winner} (${st.series1}:${st.series2})`;
  addBroadcastEvent(st, `🏆 <strong>${winner}</strong> выигрывают матч ${st.series1}:${st.series2}`);
  finishBroadcastMatch(item, winner, loser);
}
function broadcastAdvancePhase(item, now) {
  const st = item.state;
  if (!st) return false;
  if (st.phase === 'tactical-pause') {
    if (st.phaseUntil && now < st.phaseUntil && (st.phaseUntil - now) < 6000) return false;
    const team = st.pauseTeam;
    const mapName = st.maps?.[st.mapIndex] || '';
    st.phase = 'playing';
    st.pauseTeam = null;
    st.pauseReason = null;
    st.phaseUntil = 0;
    st.lastRoundAt = now;
    addBroadcastEvent(st, `▶️ <strong>${team || 'Команды'}</strong> завершили тактическую паузу.`);
    if (team) publishPostPauseTactic(st, team, mapName);
    st.phaseText = st.overtime ? `🔥 Овертайм • ${st.map1}:${st.map2}` : `Карта ${st.mapIndex + 1} • ${st.map1}:${st.map2}`;
    return true;
  }
  if (st.phase === 'halftime' || st.phase === 'map-break') {
    if (st.phaseUntil && now < st.phaseUntil && (st.phaseUntil - now) < 8000) return false;
    if (st.phase === 'halftime') {
      st.phase = 'playing';
      st.phaseUntil = 0;
      st.phaseText = st.overtime ? `🔥 Овертайм` : `Карта ${st.mapIndex + 1} • 2-я половина`;
      st.lastRoundAt = now;
      addBroadcastEvent(st, '🔄 <strong>Смена сторон.</strong>');
      return true;
    }
    if (st.phase === 'map-break') {
      st.phase = 'playing';
      st.phaseUntil = 0;
      st.phaseText = `Карта ${st.mapIndex + 1} • ${st.maps[st.mapIndex] || ''}`;
      st.map1 = 0; st.map2 = 0; st.round = 0; st.mapRoundWinners = [];
      st.overtime = false;
      st.overtimeStage = 0;
      st.lastRoundAt = now;
      st.roundBuys = {};
      st.economy = {
        t1: { money:800, lossStreak:0, lastBuy:null, lastResult:null },
        t2: { money:800, lossStreak:0, lastBuy:null, lastResult:null }
      };
      st.oddsAnchorRound = 0;
      st.oddsUpdatedAtRound = 0;
      st.oddsRefreshInterval = pickOddsRefreshInterval();
      if (typeof updateBroadcastLiveOdds === 'function') updateBroadcastLiveOdds(item);
      addBroadcastEvent(st, `🗺️ <strong>Карта ${st.mapIndex + 1}: ${st.maps[st.mapIndex]}</strong>`);
      prepareBroadcastRoundBuy(item, 1);
      return true;
    }
  }
  return false;
}
function maybeTriggerBroadcastTacticalPause(item, now) {
  const st = item?.state, m = item?.match;
  if (!st || !m || st.finished || st.phase !== 'playing') return false;
  if (st.t1Pauses <= 0 && st.t2Pauses <= 0) return false;
  if (st.round < 3) return false;
  const candidates = [1,2].filter(side => side === 1 ? st.t1Pauses > 0 : st.t2Pauses > 0);
  if (!candidates.length) return false;
  if (st.round >= 10 && st.round <= 12) return false;
  const pressure = candidates.map(side => {
    const trend = getBroadcastTeamTrend(st, side, 6);
    const oppTrend = getBroadcastTeamTrend(st, side === 1 ? 2 : 1, 6);
    const scoreDiff = side === 1 ? st.map1 - st.map2 : st.map2 - st.map1;
    const teamName = side === 1 ? m.t1 : m.t2;
    const usedThisMap = (st.pauseHistory || []).some(x => x.team === teamName && x.mapIndex === st.mapIndex);
    if (scoreDiff >= 3) return {side, chance:0};
    let chance = usedThisMap ? 0.035 : 0.08;
    if (trend.losses >= 2) chance += 0.07;
    if (trend.losses >= 4) chance += 0.06;
    if (oppTrend.streak >= 3) chance += 0.04;
    if (scoreDiff <= -2) chance += 0.08;
    if (scoreDiff <= -4) chance += 0.05;
    if (scoreDiff >= -1 && scoreDiff <= 1 && trend.losses >= 2) chance += 0.025;
    return {side, chance:Math.min(0.32, chance)};
  });
  const strongest = pressure.slice().sort((a,b) => b.chance - a.chance)[0];
  if (Math.random() > strongest.chance) return false;
  const side = strongest.side;
  const team = side === 1 ? m.t1 : m.t2;
  if (side === 1) st.t1Pauses--; else st.t2Pauses--;
  st.pauseTeam = team;
  st.pauseReason = 'Технический таймаут команды';
  st.phase = 'tactical-pause';
  st.phaseUntil = now + Math.round(4500 / tvPlaybackSpeed);
  st.phaseText = `⏸ Пауза: ${team}`;
  st.pauseHistory = st.pauseHistory || [];
  st.pauseHistory.unshift({team, round:st.round, mapIndex:st.mapIndex, at:now, automatic:true});
  addBroadcastEvent(st, `⏸ <strong>${team}</strong> взяли тактическую паузу.`);
  return true;
}
function launchBroadcastMatch(item) {
  const b = currentTournament?.broadcast;
  const st = item?.state;
  const m = item?.match;
  if (!b || !item || item.status !== 'live' || !st || st.finished || !m) return;
  item.launchTimeout = null;
  m.broadcastStatus = 'live';
  st.__match = m;
  if (!st.liveOdds && typeof updateBroadcastLiveOdds === 'function') {
    updateBroadcastLiveOdds(item);
  }
  if (item.vetoTimer) {
    clearTimeout(item.vetoTimer);
    item.vetoTimer = null;
  }
  if (item.timer) {
    clearTimeout(item.timer);
    item.timer = null;
  }
  const roundDelay = () => Math.max(250, Math.round(3800 / Math.max(0.1, tvPlaybackSpeed)));
  const syncUI = () => {
    m.broadcastScore = formatBroadcastScore(item);
    renderTournament();
    renderBroadcastPanel();
    if (broadcastDetailViewing && broadcastDetailMatchId === item.id) {
      broadcastRenderDetail(item);
    }
  };
  const scheduleTick = (delay) => {
    if (!b.running || b.paused || b.broadcastStopRequested || st.finished || item.status !== 'live') return;
    if (item.timer) {
      const age = Date.now() - (item.timerCreatedAt || Date.now());
      if (age < 10000) return;
      clearTimeout(item.timer);
      b.timerIds = (b.timerIds || []).filter(x => x !== item.timer);
      item.timer = null;
    }
    item.nextTickDue = Date.now() + Math.max(0, delay);
    const timer = setTimeout(tick, Math.max(0, delay));
    item.timer = timer;
    item.timerCreatedAt = Date.now();
    if (!b.timerIds.includes(timer)) b.timerIds.push(timer);
  };
  item.resumeBroadcast = () => {
    if (!st.finished && item.status === 'live' && b.running && !b.paused) scheduleTick(50);
  };
  if (!b.watchdog) {
    b.watchdog = setInterval(() => {
      if (!b.running || b.paused || b.broadcastStopRequested) return;
      (b.active || []).forEach(activeItem => {
        if (!activeItem?.state || activeItem.state.finished || activeItem.status !== 'live') return;
        if (activeItem.tickInProgress) return;
        const now = Date.now();
        if (activeItem.timer || (activeItem.nextTickDue && activeItem.nextTickDue > now)) return;
        if (typeof activeItem.resumeBroadcast === 'function') activeItem.resumeBroadcast();
      });
    }, 700);
  }
  const tick = () => {
    if (item.tickInProgress) return;
    item.tickInProgress = true;
    const firedTimer = item.timer;
    item.timer = null;
    item.nextTickDue = 0;
    if (firedTimer) {
      b.timerIds = (b.timerIds || []).filter(x => x !== firedTimer);
    }
    if (!b.running || b.paused || b.broadcastStopRequested || st.finished || item.status !== 'live') { item.tickInProgress = false; return; }
    try {
      const now = Date.now();
if (broadcastAdvancePhase(item, now)) {
        syncUI();
        scheduleTick(250);
        item.tickInProgress = false;
        return;
      }
      if (st.phase !== 'playing') {
        if (st.phase === 'tactical-pause' && (!st.phaseUntil || now > st.phaseUntil || (now - st.lastRoundAt) > 6000)) {
          st.phase = 'playing';
          st.pauseTeam = null;
          st.phaseUntil = 0;
        } else {
          scheduleTick(250);
          item.tickInProgress = false;
          return;
        }
      }
      const interval = roundDelay();
      if (now - st.lastRoundAt < interval) {
        scheduleTick(Math.min(250, Math.max(50, interval - (now - st.lastRoundAt))));
        item.tickInProgress = false;
        return;
      }
      st.lastRoundAt = now;
      st.round++;
      prepareBroadcastRoundBuy(item, st.round);
      const map = st.maps?.[st.mapIndex];
      if (!map) {
        throw new Error(`Не выбрана карта для ${m.t1} vs ${m.t2}: mapIndex=${st.mapIndex}`);
      }
      let prob = calcMapWinProbability(m.t1, m.t2, map);
      const t1Tactic = getBroadcastTacticalModifier(st, 1);
      const t2Tactic = getBroadcastTacticalModifier(st, 2);
      prob += t1Tactic - t2Tactic;
      const curBuy = st.roundBuys?.[st.round];
      if (curBuy?.t1 && curBuy?.t2) {
        const buyPower = {
          full: 1.0, half: 0.82, smg: 0.78, hero: 0.74, force: 0.70, deagle: 0.55, eco: 0.40, save: 0.35, pistol: 0.75
        };
        const p1 = buyPower[curBuy.t1.type] ?? 0.8;
        const p2 = buyPower[curBuy.t2.type] ?? 0.8;
        prob += (p1 - p2) * 0.35;
      }
      prob = Math.max(0.06, Math.min(0.94, prob));
      // v34: раунд разыгрывается микросимуляцией (js/manager/v34-round.js); шанс победы — тот же prob
      const winnerSide = window.V34Round ? window.V34Round.play(item, prob) : (Math.random() < prob ? 1 : 2);
      if (winnerSide === 1) st.map1++; else st.map2++;
      st.mapRoundWinners[st.round - 1] = winnerSide;
      applyBroadcastEconomyResult(st, winnerSide, st.round);
      const roundWinner = winnerSide === 1 ? m.t1 : m.t2;
      st.phaseText = st.overtime
        ? `🔥 Овертайм • ${st.map1}:${st.map2}`
        : `Карта ${st.mapIndex + 1} • ${st.map1}:${st.map2}`;
      addBroadcastEvent(st, `Раунд ${st.round}: <strong>${roundWinner}</strong> +1`, 'round');
      const roundResultEvent = st.events[0];
      addBroadcastEconomyEvent(st, m, st.round);
      const highlightCreated = maybeAddBroadcastRoundHighlight(item, winnerSide);
      consumeBroadcastTacticalImpact(st);
      let oddsChanged = false;
      if (highlightCreated && typeof updateBroadcastLiveOdds === 'function') {
        updateBroadcastLiveOdds(item);
        resetOddsAnchor(st, st.round);
        oddsChanged = true;
      } else {
        oddsChanged = maybeRefreshBroadcastOdds(item);
      }
      if (oddsChanged && st.liveOdds) {
        addBroadcastEvent(st, `📊 <strong>Букмекер обновил LIVE-кэфы:</strong> ${m.t1} (${st.liveOdds.c1}x) vs ${m.t2} (${st.liveOdds.c2}x)`);
      }
      if (roundResultEvent && Array.isArray(st.events)) {
        const rIdx = st.events.indexOf(roundResultEvent);
        if (rIdx > 0) {
          st.events.splice(rIdx, 1);
          st.events.unshift(roundResultEvent);
        }
      }
      if (st.round === 12) {
        st.phase = 'halftime';
        st.phaseUntil = now + Math.round(2500 / Math.max(0.1, tvPlaybackSpeed));
        st.phaseText = '⏸ Смена сторон';
        st.economy.t1 = { money: 800, lossStreak: 0, lastBuy: 'pistol', lastResult: null };
        st.economy.t2 = { money: 800, lossStreak: 0, lastBuy: 'pistol', lastResult: null };
      }
      if (!st.overtime && st.map1 === 12 && st.map2 === 12) {
        st.overtime = true;
        st.overtimeStage = 1;
        st.t1Pauses = 1;
        st.t2Pauses = 1;
        st.phaseText = '🔥 ОВЕРТАЙМ 1 • до 16 (12:12)';
        addBroadcastEvent(st, '🔥 <strong>Овертайм 1!</strong> До 16 раундов. Обе команды получили +1 таймаут.');
      }
      if (st.overtime && st.map1 === 15 && st.map2 === 15 && st.overtimeStage === 1) {
        st.overtimeStage = 2;
        st.t1Pauses = 1;
        st.t2Pauses = 1;
        st.phaseText = '🔥 ОВЕРТАЙМ 2 • до 19 (15:15)';
        addBroadcastEvent(st, '🔥 <strong>Овертайм 2!</strong> Счёт 15:15, игра до 19. Обе команды получили +1 таймаут.');
      } else if (st.overtime && st.map1 === 18 && st.map2 === 18 && st.overtimeStage === 2) {
        st.overtimeStage = 3;
        st.t1Pauses = 1;
        st.t2Pauses = 1;
        st.phaseText = '🔥 ОВЕРТАЙМ 3 • до 22 (18:18)';
        addBroadcastEvent(st, '🔥 <strong>Овертайм 3!</strong> Счёт 18:18, игра до 22. Обе команды получили +1 таймаут.');
      }
      let target = st.overtime
        ? ([0, 16, 19, 22][st.overtimeStage] || (st.map1 === st.map2 ? st.map1 + 3 : Math.max(st.map1, st.map2) + 1))
        : 13;
      const mapDone = st.map1 >= target || st.map2 >= target;
      if (!mapDone && st.phase === 'playing') {
        maybeTriggerBroadcastTacticalPause(item, now);
      }
      if (mapDone) {
        const mapWinner = st.map1 > st.map2 ? m.t1 : m.t2;
        if (st.map1 > st.map2) st.series1++; else st.series2++;
        if (!oddsChanged && typeof updateBroadcastLiveOdds === 'function') updateBroadcastLiveOdds(item);
        resetOddsAnchor(st, st.round);
        if (st.liveOdds) {
          addBroadcastEvent(st, `📈 <strong>Котировки после карты:</strong> ${m.t1} (${st.liveOdds.c1}x) — ${m.t2} (${st.liveOdds.c2}x)`);
        }
        st.mapResults = st.mapResults || [];
        st.mapResults.push({
          map: map,
          t1: m.t1,
          t2: m.t2,
          t1Score: st.map1,
          t2Score: st.map2,
          winner: mapWinner,
          overtime: !!st.overtime,
          rounds: [...(st.mapRoundWinners || [])]
        });
        addBroadcastEvent(st, `🏁 <strong>${mapWinner}</strong> забирают карту ${st.map1}:${st.map2}${st.overtime ? ' 🔥 OT' : ''}.`);
        const need = st.mode === 'BO1' ? 1 : (st.mode === 'BO5' ? 3 : 2);
        if (st.series1 >= need || st.series2 >= need || st.mapIndex >= st.maps.length - 1) {
          finishBroadcastSeries(item);
          item.tickInProgress = false;
          return;
        }
        st.mapIndex++;
        st.phase = 'map-break';
        st.phaseUntil = now + Math.round(4500 / Math.max(0.1, tvPlaybackSpeed));
        st.economy = {
          t1: {money:800, lossStreak:0, lastBuy:null, lastResult:null},
          t2: {money:800, lossStreak:0, lastBuy:null, lastResult:null}
        };
        st.t1Pauses = 3;
        st.t2Pauses = 3;
        st.overtimeStage = 0;
        st.overtimePauseStagesGranted = 0;
        st.roundBuys = {};
        st.tacticalHistory = {1:[],2:[]};
        st.pauseImpact = {1:null,2:null};
        st.lastPauseTactic = null;
        st.phaseText = `⏸ Перерыв перед картой ${st.mapIndex + 1}`;
      }
      syncUI();
      scheduleTick(50);
      item.tickInProgress = false;
    } catch (err) {
      console.error('[Broadcast] tick error', err, {item, state: st});
      addBroadcastEvent(st, `⚠️ <strong>Сбой игрового тика:</strong> ${String(err?.message || err)}`, 'normal');
      m.broadcastScore = formatBroadcastScore(item);
      renderTournament();
      renderBroadcastPanel();
      if (broadcastDetailViewing && broadcastDetailMatchId === item.id) { try { broadcastRenderDetail(item); } catch (e2) { console.error('[Broadcast] detail render after tick error', e2); } }
      item.tickInProgress = false;
      scheduleTick(500);
    }
  };
  addBroadcastEvent(st, `🎙️ Эфир: <strong>${m.t1}</strong> vs <strong>${m.t2}</strong> • ${st.mode}`);
  syncUI();
animateBroadcastMapDraft(item, () => {
    if (st.finished || item.status !== 'live') return;
    st.phase = 'playing';
    prepareBroadcastRoundBuy(item, 1);
    st.lastRoundAt = Date.now() - roundDelay();
    syncUI();
    scheduleTick(50);
  });
}
function openBroadcastMatchDetail(id) {
  const b = currentTournament?.broadcast;
  if (!b) return;
  let item = (b.active || []).find(x => x.id === id || broadcastMatchKey(x.match) === id);
  if (!item) item = (b.queue || []).find(x => x.id === id || broadcastMatchKey(x.match) === id);
  if (!item) item = (b.finished || []).find(x => x.id === id || broadcastMatchKey(x.match) === id);
  if (!item) return;
  if (item.status === 'done' || item.match?.winner) {
    openCompletedMatchResult(item.match);
    return;
  }
  broadcastDetailViewing = true;
  broadcastDetailMatchId = item.id;
  activeMatchSimAbort = false;
  try {
    broadcastRenderDetail(item);
  } catch (err) {
    console.error('Ошибка отрисовки деталей матча:', err);
  }
  const modal = document.getElementById('dice-modal');
  if (modal) modal.style.display = 'flex';
}
function nextBroadcastMatch() {
  const b = currentTournament?.broadcast;
  if (!b || !b.running) return;
  const selected = getSelectedBroadcastItem();
  const item = selected || b.active?.[0];
  if (!item) {
    buildBroadcastQueue();
    scheduleNextBroadcastBatch();
    renderTournament();
    renderBroadcastPanel();
    return;
  }
  const st = item.state;
  const m = item.match;
  if (!st || st.finished || !m) return;
  const need = st.mode === 'BO1' ? 1 : (st.mode === 'BO5' ? 3 : 2);
  st.mapResults = st.mapResults || [];
  const makeSkippedMap = (mapName, team1Name, team2Name) => {
    let p = typeof window.v29MapLevelProb === 'function' ? window.v29MapLevelProb(team1Name, team2Name, mapName) : calcMapWinProbability(team1Name, team2Name, mapName);
    p = Math.max(0.12, Math.min(0.88, p));
    const winnerSide = Math.random() < p ? 1 : 2;
    const marginRoll = Math.random();
    let loserScore;
    if (marginRoll < 0.20) loserScore = Math.floor(Math.random() * 5);
    else if (marginRoll < 0.65) loserScore = 5 + Math.floor(Math.random() * 4);
    else loserScore = 9 + Math.floor(Math.random() * 4);
    const winnerScore = 13;
    const t1Score = winnerSide === 1 ? winnerScore : loserScore;
    const t2Score = winnerSide === 2 ? winnerScore : loserScore;
    const rounds = [];
    const totalRounds = t1Score + t2Score;
    let a = 0, c = 0;
    for (let i = 0; i < totalRounds; i++) {
      const needA = t1Score - a, needC = t2Score - c;
      const rw = needA / Math.max(1, needA + needC);
      const w = Math.random() < rw ? 1 : 2;
      if (w === 1 && a < t1Score) a++; else if (c < t2Score) c++; else a++;
      rounds.push(w);
    }
    const winner = winnerSide === 1 ? team1Name : team2Name;
    return { map: mapName, t1: team1Name, t2: team2Name, t1Score, t2Score, winner, overtime:false, rounds };
  };
  while (st.series1 < need && st.series2 < need && st.mapIndex < st.maps.length) {
    const mapName = st.maps[st.mapIndex];
    const already = st.mapResults.find(r => r.map === mapName);
    if (!already) {
      const mr = makeSkippedMap(mapName, m.t1, m.t2);
      st.mapResults.push(mr);
      if (mr.winner === m.t1) st.series1++; else st.series2++;
    }
    st.mapIndex++;
  }
  while (st.series1 < need && st.series2 < need && st.mapIndex < st.maps.length) {
    const mapName = st.maps[st.mapIndex++];
    const mr = makeSkippedMap(mapName, m.t1, m.t2);
    st.mapResults.push(mr);
    if (mr.winner === m.t1) st.series1++; else st.series2++;
  }
  const winner = st.series1 > st.series2 ? m.t1 : m.t2;
  const loser = winner === m.t1 ? m.t2 : m.t1;
  st.finished = true;
  st.phase = 'finished';
  st.phaseText = `⏭️ Матч пропущен • ${winner} ${st.series1}:${st.series2}`;
  finishBroadcastSeries(item);
}
function finishBroadcastMatch(item, winner, loser) {
  const b = currentTournament.broadcast;
  if (!b) return;
  if (item.launchTimeout) {
    clearTimeout(item.launchTimeout);
    pendingBroadcastLaunches.delete(item.launchTimeout);
    item.launchTimeout = null;
  }
  if (item.vetoTimer) {
    clearTimeout(item.vetoTimer);
    item.vetoTimer = null;
  }
  if (item.timer) {
    clearTimeout(item.timer);
    b.timerIds = (b.timerIds || []).filter(x => x !== item.timer);
    item.timer = null;
  }
  const idx = b.active.findIndex(x => x.id === item.id);
  if (idx !== -1) b.active.splice(idx, 1);
  item.status = 'done';
  item.doneAt = Date.now();
  item.match.broadcastStatus = 'done';
  item.match.broadcastScore = item.match.score || `Победа: ${winner}`;
  b.finished.unshift(item);
  const modal = document.getElementById('dice-modal');
  if (modal && broadcastDetailViewing && broadcastDetailMatchId === item.id) {
    modal.style.display = 'none';
    broadcastDetailViewing = false;
    broadcastDetailMatchId = null;
    detailTickerRenderKey = '';
  }
  if (typeof item.callback === 'function') item.callback(winner, loser);
  renderTournament();
  renderBroadcastPanel();
  if (currentTournament.completed) { stopTournamentBroadcast(false); return; }
  if (b.running && !b.paused && b.active.length === 0) scheduleNextBroadcastBatch();
}
function startTVBroadcastMode() {
  if (!currentTournament || currentTournament.completed || currentTournament.broadcast?.running) return;
  stopAllSimulations();
  stopRequested = false;
  isTVModeRunning = true;
  const isModalOpen = document.getElementById('dice-modal').style.display === 'flex';
  const t1Name = document.getElementById('team1-live-name').innerText;
  const t2Name = document.getElementById('team2-live-name').innerText;
  currentTournament.broadcast = {
    running:true, paused:false, broadcastStopRequested:false, queue:[], active:[], finished:[], clock:0,
    timerIds:[], scheduleCursor:Date.now(), nextBatchId:1, pausedAt:0
  };
  broadcastDetailViewing = false;
  broadcastDetailMatchId = null;
  setupBroadcastPanel();
  buildBroadcastQueue();
  scheduleNextBroadcastBatch();
  if (isModalOpen) {
    const b = currentTournament.broadcast;
    const activeItem = b.active.find(item => item.match.t1 === t1Name && item.match.t2 === t2Name) || b.active[0];
    if (activeItem) {
      broadcastDetailMatchId = activeItem.id;
      broadcastDetailViewing = true;
      activeMatchSimAbort = false;
      broadcastRenderDetail(activeItem);
    }
  }
  document.getElementById("tour-status").innerText = "🔴 Турнирный эфир запущен • по 2 матча одновременно";
  updateSimControlButtons(true);
}
function toggleTournamentBroadcastPause() {
  const b = currentTournament?.broadcast;
  if (!b || !b.running) return;
  const now = Date.now();
  if (!b.paused) {
    b.paused = true;
    b.pausedAt = now;
  } else {
    b.paused = false;
    b.pausedAt = 0;
    (b.active || []).forEach(item => {
      const st = item.state;
      if (!st) return;
      st.lastRoundAt = now;
      if (st.phase === 'tactical-pause' || (st.phaseUntil && st.phaseUntil <= now)) {
        st.phase = 'playing';
        st.pauseTeam = null;
        st.phaseUntil = 0;
        st.phaseText = `Карта ${st.mapIndex + 1} • ${st.map1}:${st.map2}`;
      }
      if (item.timer) {
        clearTimeout(item.timer);
        item.timer = null;
      }
      if (typeof item.resumeBroadcast === 'function') {
        item.resumeBroadcast();
      }
    });
    if (b.active.length === 0) scheduleNextBroadcastBatch();
  }
  const btn = document.getElementById('broadcast-pause-btn');
  const modalBtn = document.getElementById('tv-pause-btn');
  if (btn) btn.innerText = b.paused ? '▶ Продолжить эфир' : '⏸ Пауза';
  if (modalBtn) {
    modalBtn.innerText = b.paused ? '▶ Продолжить эфир' : '⏸ Пауза эфира';
    modalBtn.classList.toggle('broadcast-resume-ready', b.paused);
  }
  renderBroadcastPanel();
  renderTournament();
  const selected = getSelectedBroadcastItem();
  if (selected && broadcastDetailViewing) {
    broadcastRenderDetail(selected);
  }
}
function stopTournamentBroadcast(showStatus = true) {
  const b = currentTournament?.broadcast;
  if (!b) return;
  for (const timeoutId of pendingBroadcastLaunches) {
    clearTimeout(timeoutId);
  }
  pendingBroadcastLaunches.clear();
  (b.timerIds || []).forEach(t => clearTimeout(t));
  b.timerIds = [];
  if (b.watchdog) { clearInterval(b.watchdog); b.watchdog = null; }
  const cleanMatch = (m) => {
    if (m) {
      m.broadcastStatus = 'none';
      delete m.broadcastScore;
    }
  };
  (b.active || []).forEach(item => {
    if (item.launchTimeout) clearTimeout(item.launchTimeout);
    if (item.vetoTimer) clearTimeout(item.vetoTimer);
    if (item.timer) clearTimeout(item.timer);
    cleanMatch(item.match);
  });
  (b.queue || []).forEach(item => cleanMatch(item.match));
  const allMatches = collectTournamentMatches(currentTournament);
  allMatches.forEach(m => {
    if (m && !m.winner) {
      m.broadcastStatus = 'none';
      delete m.broadcastScore;
    }
  });
  b.active = [];
  b.broadcastStopRequested = true;
  b.running = false;
  b.paused = false;
  b.queue = [];
  isTVModeRunning = false;
  const modal = document.getElementById('dice-modal');
  if (modal && broadcastDetailViewing) {
    modal.style.display = 'none';
    broadcastDetailViewing = false;
    broadcastDetailMatchId = null;
  }
  if (showStatus) {
    const status = document.getElementById("tour-status");
    if (status) status.innerText = "Эфир остановлен";
  }
  updateSimControlButtons(false);
  renderBroadcastPanel();
  renderTournament();
}
document.getElementById("broadcast-pause-btn")?.addEventListener("click", toggleTournamentBroadcastPause);
document.getElementById("broadcast-stop-btn")?.addEventListener("click", () => stopTournamentBroadcast(true));
document.getElementById("broadcast-next-btn")?.addEventListener("click", nextBroadcastMatch);
document.querySelectorAll(".tv-speed-btn").forEach(btn => {
  btn.addEventListener("click", function() {
    const speed = Number(this.dataset.speed);
    if (!Number.isFinite(speed) || speed <= 0) return;
    tvPlaybackSpeed = speed;
    document.querySelectorAll(".tv-speed-btn").forEach(b => {
      b.style.opacity = b.dataset.speed === String(tvPlaybackSpeed) ? "1" : "0.65";
    });
  });
});
function startStepByStepSim() {
  if (!currentTournament || currentTournament.completed || isStepSimRunning || isTVModeRunning || isFastSimRunning) return;
  if (currentTournament.broadcast?.running) stopTournamentBroadcast(false);
  const runToken = simulationRunToken;
  if (activeStepTimeout) {
    clearTimeout(activeStepTimeout);
    activeStepTimeout = null;
  }
  isStepSimRunning = true;
  stopRequested = false;
  updateSimControlButtons(true);
  function step() {
    if (stopRequested || !isStepSimRunning || !currentTournament || currentTournament.completed) {
      isStepSimRunning = false;
      updateSimControlButtons(false);
      return;
    }
    const next = getNextPlayableMatch();
    if (next) {
      instantMatch(next.match, next.callback);
      renderTournament();
      activeStepTimeout = setTimeout(() => {
        activeStepTimeout = null;
        if (runToken !== simulationRunToken || stopRequested || !isStepSimRunning) {
          if (runToken === simulationRunToken) {
            isStepSimRunning = false;
            updateSimControlButtons(false);
          }
          return;
        }
        step();
      }, 700);
    } else {
      isStepSimRunning = false;
      updateSimControlButtons(false);
    }
  }
  step();
}
function simulateWholeTournament() {
  if (!currentTournament || currentTournament.completed || isFastSimRunning) return;
  if (currentTournament.broadcast?.running) stopTournamentBroadcast(false);
  isFastSimRunning = true;
  stopRequested = false;
  updateSimControlButtons(true);
  let safety = 0;
  let simulationError = null;
  let lastMatch = null;
  try {
    while (!currentTournament.completed && safety < 300 && !stopRequested) {
      safety++;
      const next = getNextPlayableMatch();
      if (!next) break;
      if (!next.match.t1 || !next.match.t2 || next.match.winner) {
        throw new Error('Симуляция получила неготовый матч');
      }
      lastMatch = next.match;
      instantMatch(next.match, next.callback);
    }
    if (!currentTournament.completed && !stopRequested) {
      const next = getNextPlayableMatch();
      if (next?.isFinal && next.match?.t1 && next.match?.t2 && !next.match.winner) {
        instantMatch(next.match, next.callback);
      }
    }
    if (!currentTournament.completed && !stopRequested) {
      simulationError = new Error(`Симуляция остановилась без завершения (шагов: ${safety}, последний: ${lastMatch?.t1 || '—'} vs ${lastMatch?.t2 || '—'})`);
    }
  } catch (err) {
    simulationError = err;
    console.error('Ошибка полной симуляции:', err);
  } finally {
    isFastSimRunning = false;
    stopRequested = false;
    updateSimControlButtons(false);
    renderTournament();
    renderRating();
  }
  if (simulationError) {
    console.error(simulationError);
    if (currentTournament && !currentTournament.completed) {
      document.getElementById('tour-status').innerText = 'Ошибка симуляции — турнир сохранён, можно продолжить вручную';
    }
  } else if (currentTournament?.completed) {
    document.getElementById('tour-status').innerText = '🏆 Турнир завершён • результаты финала сохранены';
  }
}
function processErasAfterTournament(championName) {
  if (!seasonState.eras) seasonState.eras = {};
  let champTeam = teams.find(t => t.name === championName);
  if (!champTeam) return;
  if (!champTeam.trophies.grandFinalsWon) champTeam.trophies.grandFinalsWon = 0;
  champTeam.trophies.grandFinalsWon++;
  let currentEraOwnerName = Object.keys(seasonState.eras).find(k => seasonState.eras[k].active);
  let participants = currentTournament.participants || [];
  let isEraOwnerParticipating = currentEraOwnerName && participants.includes(currentEraOwnerName);
  if (currentEraOwnerName && currentEraOwnerName !== championName && isEraOwnerParticipating) {
    if (seasonState.eras[currentEraOwnerName].strikes === undefined) seasonState.eras[currentEraOwnerName].strikes = 0;
    seasonState.eras[currentEraOwnerName].strikes++;
    if (seasonState.eras[currentEraOwnerName].strikes >= 4) {
      seasonState.eras[currentEraOwnerName].active = false;
    }
  } else if (currentEraOwnerName && currentEraOwnerName === championName && isEraOwnerParticipating) {
    seasonState.eras[currentEraOwnerName].strikes = 0;
  } else if (!currentEraOwnerName && champTeam.trophies.grandFinalsWon >= 3) {
    seasonState.eras[championName] = { active: true, season: seasonState.currentSeason, strikes: 0 };
  }
}
function collectTournamentMatches(t) {
  const out = [];
  if (!t) return out;
  if (t.upperRounds) t.upperRounds.forEach(r => r.forEach(m => { if (m?.winner) out.push(m); }));
  if (t.lowerRounds) t.lowerRounds.forEach(r => r.forEach(m => { if (m?.winner) out.push(m); }));
  if (t.grandFinal?.winner) out.push(t.grandFinal);
  if (t.bronzeMatch?.winner) out.push(t.bronzeMatch);
  if (t.swiss?.rounds) t.swiss.rounds.forEach(r => r.forEach(m => { if (m?.winner) out.push(m); }));
  if (t.gsl?.groups) t.gsl.groups.forEach(g => Object.values(g.matches).forEach(m => { if (m?.winner) out.push(m); }));
  return out;
}
function saveTournamentToArchive() {
  if (!currentTournament || !currentTournament.completed) return;
  const matches = collectTournamentMatches(currentTournament);
  const champ = Object.entries(currentTournament.placements || {}).find(([n,p]) => p.place === 1)?.[0] || "—";
  const upsets = matches.filter(m => {
    const a = teams.find(t => t.name === m.t1), b = teams.find(t => t.name === m.t2);
    if (!a || !b) return false;
    const sorted = [...teams].sort((x,y) => y.pts - x.pts);
    const ra = sorted.indexOf(a) + 1, rb = sorted.indexOf(b) + 1;
    return Math.abs(ra - rb) >= 8 && m.winner === (ra > rb ? m.t1 : m.t2);
  }).length;
  if (!seasonState.tournamentHistory) seasonState.tournamentHistory = [];
  seasonState.tournamentHistory.unshift({
    season: currentTournament.season,
    name: currentTournament.name,
    prestige: currentTournament.prestige,
    format: currentTournament.formatChoice,
    participants: currentTournament.participants.length,
    champion: champ,
    matches: matches.length,
    upsets,
    timestamp: Date.now()
  });
  seasonState.tournamentHistory = seasonState.tournamentHistory.slice(0, 30);
}
renderSeasonBanner();
renderTournamentArchive();
renderRating();
updateTournamentSuggestion();
