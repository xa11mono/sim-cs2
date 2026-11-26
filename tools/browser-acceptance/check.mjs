import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { scenarios as legacy } from './legacy.mjs';

const require = createRequire(import.meta.url);
const pw = require('playwright');
const [manifestFile, out, baselineFile] = process.argv.slice(2);
if (!manifestFile || !out) {
  throw new Error('Usage: node tools/browser-acceptance/check.mjs BUILDS.json REPORT_DIR [BASELINE_REPORT.json]');
}
const manifest = JSON.parse(readFileSync(manifestFile, 'utf8'));
const baseline = baselineFile ? JSON.parse(readFileSync(baselineFile, 'utf8')) : null;
const engines = (process.env.SIM_BROWSERS || 'chromium,firefox,webkit').split(',');
assert(engines.every(name => ['chromium', 'firefox', 'webkit'].includes(name)));
assert(Array.isArray(manifest.builds) && manifest.builds.length);
const report = { playwright: require('playwright/package.json').version, results: [] };
mkdirSync(out, { recursive: true });

for (const engine of engines) {
  let browser;
  try {
    const options = engine === 'chromium' && process.env.CHROMIUM_PATH
      ? { executablePath: process.env.CHROMIUM_PATH, args: ['--enable-unsafe-swiftshader'] } : {};
    browser = await pw[engine].launch(options);
  } catch (error) {
    report.results.push({ engine, launch: String(error), failed: true });
    continue;
  }
  try {
    for (const build of manifest.builds) {
      assert(/^[a-z\d_-]+$/i.test(build.id) && /^[a-z\d_-]+$/i.test(build.map));
      const result = { engine, version: browser.version(), build: build.id, map: build.map, checks: {}, screenshots: {}, pageErrors: [], blockedOrigins: [] };
      report.results.push(result);
      const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1, reducedMotion: 'reduce', acceptDownloads: true });
      const page = await context.newPage();
      page.setDefaultTimeout(12000);
      page.on('pageerror', error => result.pageErrors.push(error.message));
      const url = /^https?:\/\//.test(build.entry)
        ? new URL(build.entry) : pathToFileURL(resolve(dirname(manifestFile), build.entry));
      const safeOrigins = new Set([url.origin, ...(build.assetOrigins || [])]);
      // Keep test sessions out of the owner's databases. Self-hosted build assets
      // and explicitly listed asset origins remain reachable.
      await page.route(/^https?:/, route => {
        const origin = new URL(route.request().url()).origin;
        if (safeOrigins.has(origin)) return route.continue();
        if (!result.blockedOrigins.includes(origin)) result.blockedOrigins.push(origin);
        return route.abort();
      });
      try {
        await page.goto(url.href, { waitUntil: 'load', timeout: 60000 });
        const adapter = build.adapter
          ? (await import(pathToFileURL(resolve(dirname(manifestFile), build.adapter)).href)).scenarios : legacy;
        const snapshot = async (name, locator) => {
          const filename = [engine, build.id, build.map, name].join('-') + '.png';
          const bytes = await locator.screenshot({ path: resolve(out, filename), animations: 'disabled' });
          const hash = createHash('sha256').update(bytes).digest('hex');
          result.screenshots[name] = { filename, sha256: hash };
          if (baseline) {
            const old = baseline.results.find(row => row.engine === engine && row.build === build.id && row.map === build.map);
            assert.equal(old?.version, result.version, 'Screenshot baseline must use the same browser version');
            assert.equal(hash, old.screenshots[name]?.sha256, 'Screenshot differs from its engine baseline: ' + name);
          }
        };
        for (const name of Object.keys(legacy)) {
          if (name !== 'interface' && result.checks.interface.status === 'failed') break;
          try {
            assert.equal(typeof adapter[name], 'function', 'Missing scenario ' + name);
            result.checks[name] = await adapter[name](page, { ...build, snapshot }) || { status: 'passed' };
          } catch (error) {
            result.checks[name] = { status: 'failed', reason: String(error) };
          }
        }
      } catch (error) {
        result.navigation = String(error);
      } finally {
        await context.close();
        result.failed = Boolean(result.navigation || result.pageErrors.length ||
          Object.values(result.checks).some(check => check.status === 'failed'));
      }
      console.log(engine, build.id, build.map, Object.fromEntries(Object.entries(result.checks).map(([key, check]) => [key, check.status])), result.pageErrors);
    }
  } finally {
    await browser.close();
  }
}
writeFileSync(resolve(out, 'report.json'), JSON.stringify(report, null, 2) + '\n');
if (report.results.some(row => row.failed)) process.exitCode = 1;
