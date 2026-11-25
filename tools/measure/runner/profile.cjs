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
  const byteLength = text => new TextEncoder().encode(text).length;
  const jsonBytes = value => byteLength(JSON.stringify(value));
  const state = {
    bots, score, roundState, bomb, teamEco, teamIntel, teamTac, nadesInAir, smokes, fires,
    groundWeapons, groundItems, PLAYER_MEM, OPP, MEM_BOX, tacticalMemory: memSnapshot()
  };
  return {
    cursor: { match: matchNum, round: roundNum, tick },
    statePackBytes: byteLength(mkPack(state)),
    isMap3dAlias: MAP.map3d === MAP3D, isNavmeshAlias: MAP.navmesh.areas === NAVAREAS,
    hasRawNavmeshCopy: NAVAREAS_RAW !== NAVAREAS,
    geometryBackingBytes: bufferBytes(M3), navBackingBytes: bufferBytes([NAV_GRID, NAV_ZONE, zoneGraph]),
    geometryDetails: {
      triangles: M3?.triFlag.length ?? 0,
      hulls: M3?.hullFlag.length ?? 0,
      sweepWorkspaceBytes: bufferBytes([M3?.nTriSeen, M3?.nHullSeen, M3?.nTriXY]),
      grenadeColumnsBytes: bufferBytes(M3?.nade), skyColumnsBytes: bufferBytes([M3?.sky, M3?.skyZ]),
      solidGridBytes: bufferBytes(M3_SOLID),
      trianglePlanes: M3?.nTriPl?.size ?? 0, hullPlanes: keys(M3?.nHullPl)
    },
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
    const diagnostic = await page.evaluate(() => {
      const record = globalThis.__measureRecord;
      if (!record) return null;
      const rows = Object.fromEntries(
        Object.entries(record).filter(([, value]) => Array.isArray(value)).map(([key, value]) => [key, value.length])
      );
      return { rows, jsonBytes: new TextEncoder().encode(JSON.stringify(record)).length };
    });
    await page.evaluate(() => { delete globalThis.__measureRecord; });
    const afterRelease = await heap();
    console.log(JSON.stringify({
      browser: browser.version(), htmlBytes: statSync(pageFile).size,
      heap: { before, after, afterRelease }, inputsBefore, inputsAfter, diagnostic
    }, null, 2));
  } finally {
    await browser.close();
  }
}

main(...process.argv.slice(2)).catch(error => {
  console.error(error);
  process.exitCode = 1;
});
