const {chromium}=require('playwright');(async()=>{const b=await chromium.launch();const pg=await b.newPage();pg.on('pageerror',e=>console.log('ERR',e.message));
await pg.goto('file://'+process.argv[2]);await pg.waitForFunction(()=>typeof window.__ev==='function',null,{timeout:60000});
console.log(await pg.evaluate(c=>window.__ev(c),process.argv[3]));await b.close()})();
