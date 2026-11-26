import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const replayRegression = readFileSync(new URL('../tests/replay_rewind.js', import.meta.url), 'utf8');
const ev = (page, source) => page.evaluate(code => window.__ev(code), source);
const visible = (page, selector) => page.locator(selector).waitFor({ state: 'visible' });
const hidden = (page, selector) => page.locator(selector).waitFor({ state: 'hidden' });
const tools = page => page.getByText('Инструменты', { exact: true });

async function toggleTool(page, selector, checked) {
  const input = page.locator(selector);
  if (!(await input.isVisible())) await tools(page).click();
  await input.setChecked(checked);
}

async function fixRadarCamera(page) {
  await page.waitForFunction(() => window.__ev('imgReady'));
  await ev(page, `view.scale = Math.min(cv.width, cv.height) / 2048;
    view.panX = (cv.width - 2048 * view.scale) / 2;
    view.panY = (cv.height - 2048 * view.scale) / 2;
    draw();`);
}

export const scenarios = {
  async interface(page, { map }) {
    await visible(page, '#scoreboard');
    await page.waitForFunction(name => typeof window.__ev === 'function' && window.__ev('MAP.id') === name, map);
    const start = page.locator('#btnWarmSkip');
    if (await start.isVisible()) await start.click();
    await page.waitForFunction(() => window.__ev('tick') > 0);
    if (!(await ev(page, 'paused'))) await page.locator('#btnPause').click();
    assert.equal(await ev(page, 'paused'), true);
    const tick = await ev(page, 'tick');
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    assert.equal(await ev(page, 'tick'), tick, 'Pause must stop simulation');
    await page.locator('#inpMatchNum').fill('3');
    await page.locator('#btnFreshMatch').click();
    assert.equal(await ev(page, 'matchNum'), 3);
    if (!(await ev(page, 'paused'))) await page.locator('#btnPause').click();
    await ev(page, 'freshMatch(3); clockPause(true); draw();');
  },
  async hud(page, { snapshot }) {
    await page.waitForFunction(() => document.querySelectorAll('#plT .pl-card').length === 5 &&
      document.querySelectorAll('#plCT .pl-card').length === 5);
    for (const team of ['T', 'CT']) {
      assert((await page.locator('#sbName' + team).textContent()).trim());
      assert.match((await page.locator('#sbScore' + team).textContent()).trim(), /^\d+$/);
    }
    const card = page.locator('#plT .pl-card').first();
    await card.click();
    await page.waitForFunction(() => Boolean(document.querySelector('#plT .pl-card.sel')));
    // A mouse click on a player is exercised above. For visual baselines,
    // remove the previous camera easing and use a fixed paused match frame.
    await ev(page, 'OBS.on = false; OBS.lock = null; OBS.tr = null; document.activeElement?.blur();');
    await page.mouse.move(2, 2);
    await fixRadarCamera(page);
    await snapshot('hud', page.locator('#scoreboard'));
  },
  async radar2d(page, { snapshot }) {
    await visible(page, '#cv');
    await fixRadarCamera(page);
    await page.waitForFunction(() => {
      const cv = document.getElementById('cv');
      const ctx = cv.getContext('2d');
      if (!ctx || cv.width < 80 || cv.height < 80) return false;
      const pixels = ctx.getImageData(0, 0, cv.width, cv.height).data;
      const colors = new Set();
      for (let i = 0; i < pixels.length; i += 4 * 73) {
        if (pixels[i + 3]) colors.add((pixels[i] << 16) | (pixels[i + 1] << 8) | pixels[i + 2]);
        if (colors.size >= 8) return true;
      }
      return false;
    });
    await snapshot('radar', page.locator('#cv'));
  },
  async view3d(page, { snapshot }) {
    await page.locator('#btn3d').click();
    const state = await ev(page, '({ active: D3.on, failure: D3.failed || null })');
    if (!state.active) {
      assert.equal(state.failure, 'браузер не даёт WebGL2', 'Unexpected 3D initialization failure');
      await visible(page, '#cv');
      await hidden(page, '#cv3');
      return { status: 'fallback', reason: state.failure };
    }
    await visible(page, '#cv3');
    await page.waitForFunction(() => window.__ev('!!(D3.gl && D3.pM && D3.VP && D3.gl.drawingBufferWidth > 0)'));
    await visible(page, '#v3In');
    await page.locator('#v3In').click();
    await ev(page, 'D3.cam = "view"; D3.cs = null; D3.yaw = D3.yawT; D3.pitch = D3.pitchT; d3Frame();');
    await snapshot('webgl', page.locator('#cv3'));
    await page.locator('#btn3d').click();
    await hidden(page, '#cv3');
    await visible(page, '#cv');
  },
  async sound(page) {
    const mute = page.locator('#btnSnd');
    await mute.click();
    assert.equal(await ev(page, 'SND.on'), false);
    await mute.click();
    assert.equal(await ev(page, 'SND.on'), true);
    try {
      await page.waitForFunction(() => window.__ev('SND.ctx?.state === "running"'));
    } catch (error) {
      const state = await ev(page, 'SND.ctx?.state ?? "unavailable"');
      throw new Error('AudioContext after user gesture: ' + state, { cause: error });
    }
    const volume = page.locator('#sndVol');
    await volume.focus();
    await volume.press('Home');
    await volume.press('ArrowRight');
    const gain = await ev(page, '({ volume: SND.vol, actual: SND.master.gain.value })');
    assert(gain.volume > 0 && gain.volume < 0.2 && Math.abs(gain.volume - gain.actual) < 1e-6);
    assert.equal(await page.evaluate(() => +localStorage.getItem('sndVol')), gain.volume);
  },
  async marks(page) {
    await page.locator('#btnMark').click();
    await visible(page, '#mkPanel');
    await page.locator('#mkGo').click();
    assert.match(await page.locator('#mkErr').textContent(), /Напиши/);
    await page.locator('#mkText').fill('Проверка браузера <метка>');
    await page.locator('#mkWant').fill('Проверка сохранения поля');
    await page.locator('#mkGo').click();
    await hidden(page, '#mkPanel');
    await page.locator('#btnMarks').click();
    await visible(page, '#mkItems .mk-item');
    assert.match(await page.locator('#mkItems').textContent(), /Проверка браузера <метка>/);
    assert.match(await page.locator('#mkItems').textContent(), /Проверка сохранения поля/);
    assert.match(await page.locator('#mkToast').textContent(), /отметка только до перезагрузки/);
    await page.locator('#mkLX').click();
    return { status: 'fallback', reason: 'Standalone marks use the session-local list' };
  },
  async markSnapshot(page) {
    // Emulate the artifact data transport in the isolated test tab. Saving,
    // packing, unwrapping and restoring still use the game's own handlers.
    await ev(page, `(() => {
      const assets = new Map(), originalFetch = window.fetch;
      window.fetch = (url, ...args) => {
        if (typeof url === 'string' && url.startsWith('/_blob/')) {
          const blob = assets.get(url.slice(7));
          return Promise.resolve(blob ? new Response(blob) : new Response(null, {status:404}));
        }
        return originalFetch(url, ...args);
      };
      MK.assets = {upload: async blob => {
        const id = 'test-asset-' + assets.size;
        assets.set(id, blob);
        return {id};
      }};
      MK.db = {collection: () => ({doc: id => ({set: async doc => {
        MK.list.push({...doc, id});
        mkRenderList();
      }})})};
      MK.browserTestCleanup = () => {
        MK.db = null;
        MK.assets = null;
        MK.list = [];
        window.fetch = originalFetch;
      };
    })()`);
    try {
      const state = 'JSON.stringify({matchNum, roundNum, tick, bots: bots.map(b => [b.id, b.x, b.y, b.hp])})';
      const atMark = await ev(page, state);
      await page.locator('#btnMark').click();
      await page.locator('#mkText').fill('Проверка снимка в браузере');
      await page.locator('#mkGo').click();
      await page.waitForFunction(() => window.__ev('MK.list.some(doc => !!doc.snapAsset)'));
      await ev(page, 'for (let n = 0; n < 8; n++) stepTick();');
      assert.notEqual(await ev(page, state), atMark);
      await page.locator('#btnMarks').click();
      await page.locator('#mkItems .mk-item').filter({ hasText: 'Проверка снимка в браузере' }).click();
      await page.waitForFunction(() => document.getElementById('mkToast').textContent.includes('открыта из снимка момента'));
      assert.equal(await ev(page, state), atMark, 'Restored state differs from the saved mark');
    } finally {
      await ev(page, 'MK.browserTestCleanup(); delete MK.browserTestCleanup;');
    }
  },
  async editors(page) {
    await toggleTool(page, '#chkMapEdit', true);
    await visible(page, '#mapEdPanel');
    const tabs = page.locator('#mapEdTabs button');
    assert.equal(await tabs.count(), 4);
    for (let i = 0; i < await tabs.count(); i++) {
      await tabs.nth(i).click();
      assert.match(await tabs.nth(i).getAttribute('class'), /\bon\b/);
      assert((await page.locator('#mapEdBody').textContent()).trim());
    }
    await toggleTool(page, '#chkLineups', true);
    await visible(page, '#lineupPanel');
    await toggleTool(page, '#chkLineups', false);
    await hidden(page, '#lineupPanel');
    await toggleTool(page, '#chkZoneEdit', true);
    await hidden(page, '#mapEdPanel');
    await visible(page, '#zoneEditPanel');
    await toggleTool(page, '#chkAlign', true);
    await visible(page, '#alignPanel');
    await hidden(page, '#zoneEditPanel');
    await toggleTool(page, '#chkAlign', false);
    await hidden(page, '#alignPanel');
  },
  async sandbox(page) {
    await page.locator('#btnSandbox').click();
    await visible(page, '.sb-panel');
    assert.equal(await page.locator('.sb-panel [data-sb="ai"]').count(), 10);
    await page.locator('.sb-panel [data-sb="allOff"]').click();
    assert.equal(await ev(page, 'bots.every(b => b._sbOff)'), true);
    await page.locator('.sb-panel [data-sb="allOn"]').click();
    assert.equal(await ev(page, 'bots.every(b => !b._sbOff)'), true);
    await page.locator('#btnSandbox').click();
    await hidden(page, '.sb-panel');
  },
  async replay(page) {
    const regression = JSON.parse(await ev(page, replayRegression.replace(/JSON.stringify\(out\)\s*$/, 'RP.last = Rf; JSON.stringify(out)')));
    assert.equal(regression.ok, true, JSON.stringify(regression));
    // Reopen the same replay through the real menu control, then skip it.
    if (!(await page.locator('#btnRpLast').isVisible())) await tools(page).click();
    await page.locator('#btnRpLast').click();
    await visible(page, '#rp.on');
    assert.equal(await ev(page, 'RP.P.mode'), 'clip');
    await page.locator('#rp .rp-skip').click();
    await hidden(page, '#rp.on');
  },
};
