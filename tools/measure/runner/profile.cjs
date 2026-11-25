#!/usr/bin/env node
'use strict';

const { statSync } = require('node:fs');
const { launch, prepare, readCode } = require('../../../src/q.js');
const { captureSource } = require('./record.cjs');

// Run separately from PSS/timing measurements. This introspection can allocate and triggers GC.
const INPUTS = `(function() {
  function bufferBytes(root) {
    const objects = new Set(), buffers = new Set(), pending = [root];
    while (pending.length) {
      const value = pending.pop();
      if (!value || typeof value !== 'object' || objects.has(value)) continue;
      objects.add(value);
      if (ArrayBuffer.isView(value)) buffers.add(value.buffer);
      else if (value instanceof ArrayBuffer) buffers.add(value);
      else for (const key of Object.keys(value)) pending.push(value[key]);
    }
    return [...buffers].reduce((sum, buffer) => sum + buffer.byteLength, 0);
  }
  const keys = object => Object.keys(object || {}).length;
  const jsonBytes = value => new TextEncoder().encode(JSON.stringify(value)).length;
  return {
    isMap3dAlias: MAP.map3d === MAP3D, isNavmeshAlias: MAP.navmesh.areas === NAVAREAS,
    hasRawNavmeshCopy: NAVAREAS_RAW !== NAVAREAS,
    geometryBackingBytes: bufferBytes(M3), navBackingBytes: bufferBytes([NAV_GRID, NAV_ZONE, zoneGraph]),
    navAreas: NAVAREAS.length, rawNavAreas: NAVAREAS_RAW.length, navGraphNodes: keys(zoneGraph),
    navJsonBytes: { input: jsonBytes(MAP.navmesh), rawAreas: jsonBytes(NAVAREAS_RAW), areas: jsonBytes(NAVAREAS), graph: jsonBytes(zoneGraph) },
    caches: { WPM: WPM.n, ZDJ: keys(ZDJ.s), KPC: keys(KPC) },
    cacheJsonBytes: { WPM: jsonBytes(WPM.s), ZDJ: jsonBytes(ZDJ.s), KPC: jsonBytes(KPC) }
  };
})()`;

async function main(pageFile, recFile) {
  if (!pageFile || !recFile) throw new Error('node profile.cjs sim.html <_rec_MATCH.js|--control=match,ticks>');
  const control = /^--control=([0-9]+),([0-9]+)$/.exec(recFile);
  const source = control
    ? `freshMatch(${Number(control[1])}); for (let i = 0; i < ${Number(control[2])} && matchNum === ${Number(control[1])}; i++) stepTick(); 1`
    : captureSource(readCode('@' + recFile));
  const browser = await launch('chromium');
  try {
    const context = await browser.newContext();
    const page = await prepare(context, pageFile);
    const cdp = await context.newCDPSession(page);
    async function heap() {
      await cdp.send('HeapProfiler.collectGarbage');
      return cdp.send('Runtime.getHeapUsage');
    }
    const before = await heap();
    const inputsBefore = await page.evaluate(src => __ev(src), INPUTS);
    await page.evaluate(src => __ev(src), source);
    const after = await heap();
    const inputsAfter = await page.evaluate(src => __ev(src), INPUTS);
    const rows = await page.evaluate(() => Object.fromEntries(
      Object.entries(globalThis.__measureRecord ?? {}).filter(([, value]) => Array.isArray(value)).map(([key, value]) => [key, value.length])
    ));
    await page.evaluate(() => { delete globalThis.__measureRecord; });
    const afterRelease = await heap();
    console.log(JSON.stringify({
      browser: browser.version(), htmlBytes: statSync(pageFile).size,
      heap: { before, after, afterRelease }, inputsBefore, inputsAfter, rows
    }, null, 2));
  } finally {
    await browser.close();
  }
}

main(...process.argv.slice(2)).catch(error => {
  console.error(error);
  process.exitCode = 1;
});
