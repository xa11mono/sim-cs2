(function(){ function sig(o){ try{ return JSON.stringify(o); }catch(e){ return "ERR"; } }
 function h(s){ var x=2166136261>>>0; for(var i=0;i<s.length;i++) x=Math.imul(x^s.charCodeAt(i),16777619)>>>0; return x+":"+s.length; }
 var R={};
 var zd0=sig(ZONE_DANGER); computeZoneDanger(); var zd1=sig(ZONE_DANGER); R.ZONE_DANGER=[h(zd0),h(zd1),zd0===zd1];
 var s0=sig(SITES)+sig(GEO); buildSites(); var s1=sig(SITES)+sig(GEO); R.SITES_GEO=[h(s0),h(s1),s0===s1];
 var r0=sig(ROAM_ROUTES); if(typeof buildRoamRoutes==="function") buildRoamRoutes(); var r1=sig(ROAM_ROUTES); R.ROAM=[h(r0),h(r1),r0===r1];
 if(!(zd0===zd1)){ var a=JSON.parse(zd0), b=JSON.parse(zd1), n=0, tot=0; for(var k in b){ tot++; if(JSON.stringify(a[k])!==JSON.stringify(b[k])) n++; } R.zdDiffKeys=[n,tot]; }
 return JSON.stringify(R); })()
