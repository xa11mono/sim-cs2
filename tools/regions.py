import json
REG={
 'A сайт':['A Site','Back Site','Temple','Plat','Single','Box','Boost','Def','Triple Box','Triple / Window / Cat'],
 'A вперёд':['Short','Donut','Long','A Main','A Hall','A Stairs','Main Hall / Candle'],
 'мид':['Mid','Top Mid','Connector / Red Room / Red','Sniper Nest','Jungle / Pit','Chamber Lane','Xbox','Lower Mid / Start Mid'],
 'B сайт':['B Site','Site B','90','First Lane','Second Lane','Bonger / Wood / Ninja','Dark Box'],
 'B вперёд':['Cave / House','Lamp Room / Excavation','Dark','Ramp','Tunnel','T Upper / Heaven','Water'],
 'сзади':['CT Spawn','Alley','Back Halls / Back Alley','CT Lane'],
}
Z2R={z:r for r,zs in REG.items() for z in zs}
json.dump(Z2R,open('z2r.json','w'),ensure_ascii=False)
