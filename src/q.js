// (Р2.6) движок — SIM_BROWSER = chromium (по умолчанию) | firefox | webkit.
const fs = require('node:fs');
const { resolve } = require('node:path');
const { pathToFileURL } = require('node:url');
const { stopFrames } = require('../tools/measure/dv_state.js');

function launch(engine = process.env.SIM_BROWSER || 'chromium') {
  return require('playwright')[engine].launch();
}

async function prepare(context, html) {
  const page = await context.newPage();
  await page.route(/^https?:/, route => route.abort());
  await page.goto(pathToFileURL(resolve(html)).href);
  await page.waitForTimeout(1200);
  if (!process.env.SIM_LIVE_FRAMES) await stopFrames(page);
  return page;
}

function readCode(code) {
  return code.startsWith('@') ? fs.readFileSync(code.slice(1), 'utf8') : code;
}

async function main() {
  const browser = await launch();
  try {
    const context = await browser.newContext();
    const page = await prepare(context, process.argv[2]);
    console.log(await page.evaluate(src => __ev(src), readCode(process.argv[3])));
  } finally {
    await browser.close();
  }
}

module.exports = { launch, prepare, readCode };
if (require.main === module) main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
