// Render src/index.html frame-by-frame with headless Chromium (Playwright).
//
//   node tools/render.mjs stills out/stills 1.2 6.5 ...   -> PNG stills at given times
//   node tools/render.mjs cues   audio/cues.json          -> sound-design hit points (window.CUES)
//   node tools/render.mjs cover  out/cover.png 7.9        -> one frame without captions or wipe (Reels/TikTok cover)
//   node tools/render.mjs video  out/frames.mp4 [workers]  -> silent H.264 video (all frames)
//
// Playwright is resolved from the global install (NODE_PATH) or a local one.
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const require = createRequire(import.meta.url);
let chromium;
try { ({ chromium } = require('playwright')); }
catch { ({ chromium } = require('/opt/node22/lib/node_modules/playwright')); }

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const PAGE = pathToFileURL(path.join(ROOT, 'src/index.html')).href;
const TL = JSON.parse(readFileSync(path.join(ROOT, 'audio/timeline.json'), 'utf8'));
const [, , mode, out, ...rest] = process.argv;

async function openPage(browser) {
  const page = await browser.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 });
  await page.goto(PAGE);
  await page.evaluate(async () => {
    const loads = [];
    for (const fam of ['Noto Kufi Arabic', 'Roboto'])
      for (const w of [400, 500, 600, 700, 800, 900]) loads.push(document.fonts.load(`${w} 40px "${fam}"`, 'نسبة العائد 0123 $ ×'));
    await Promise.all(loads);
    await window.renderReady;
  });
  return page;
}

async function frameAt(page, t, type = 'png') {
  await page.evaluate(tt => window.render(tt), t);
  return page.screenshot({ type, ...(type === 'jpeg' ? { quality: 95 } : {}) });
}

async function stills() {
  mkdirSync(out, { recursive: true });
  const browser = await chromium.launch();
  const page = await openPage(browser);
  for (const ts of rest) {
    const t = parseFloat(ts);
    writeFileSync(path.join(out, `t${t.toFixed(2).padStart(6, '0')}.png`), await frameAt(page, t));
  }
  await browser.close();
}

// Each worker renders a contiguous chunk to its own lossless-ish H.264 file; chunks are concatenated.
async function renderChunk(browser, from, to, file) {
  const page = await openPage(browser);
  const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(TL.fps), '-c:v', 'mjpeg', '-i', '-',
    '-c:v', 'libx264', '-preset', 'medium', '-crf', '14', '-pix_fmt', 'yuv420p', '-r', String(TL.fps), file], { stdio: ['pipe', 'inherit', 'inherit'] });
  for (let f = from; f < to; f++) {
    const buf = await frameAt(page, f / TL.fps, 'jpeg');
    if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
    if ((f - from) % 150 === 0) console.log(`  [${path.basename(file)}] frame ${f}/${to}`);
  }
  ff.stdin.end();
  await new Promise((res, rej) => ff.on('close', c => (c === 0 ? res() : rej(new Error('ffmpeg ' + c)))));
  await page.close();
}

async function video() {
  const workers = parseInt(rest[0] || '3', 10);
  const tmp = path.join(path.dirname(out), '.chunks');
  rmSync(tmp, { recursive: true, force: true });
  mkdirSync(tmp, { recursive: true });
  const N = TL.frames, per = Math.ceil(N / workers);
  const browser = await chromium.launch();
  const files = [];
  const jobs = [];
  for (let w = 0; w < workers; w++) {
    const from = w * per, to = Math.min(N, from + per);
    if (from >= to) break;
    const file = path.join(tmp, `chunk${w}.mp4`);
    files.push(file);
    jobs.push(renderChunk(browser, from, to, file));
  }
  await Promise.all(jobs);
  await browser.close();
  const list = path.join(tmp, 'list.txt');
  writeFileSync(list, files.map(f => `file '${path.resolve(f)}'`).join('\n'));
  await new Promise((res, rej) => spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', list, '-c', 'copy', out], { stdio: 'inherit' })
    .on('close', c => (c === 0 ? res() : rej(new Error('concat ' + c)))));
  rmSync(tmp, { recursive: true, force: true });
  console.log(`wrote ${out} (${N} frames)`);
}

async function cover() {
  const browser = await chromium.launch();
  const page = await openPage(browser);
  await page.evaluate(t => {
    window.render(t);
    for (const id of ['captions', 'wipe']) document.getElementById(id).style.visibility = 'hidden';
  }, parseFloat(rest[0] || '0'));
  writeFileSync(out, await page.screenshot({ type: 'png' }));
  await browser.close();
  console.log(`wrote ${out}`);
}

async function cues() {
  const browser = await chromium.launch();
  const page = await openPage(browser);
  const list = await page.evaluate(() => window.CUES);
  writeFileSync(out, JSON.stringify(list, null, 1));
  await browser.close();
  console.log(`wrote ${out} (${list.length} cues)`);
}

await ({ stills, cues, cover, video }[mode] || video)();
