// คลิป hook สั้น (~30 วิ) โชว์บนหน้าขายคอร์ส/ใช้ทำแอด: ลองทำ 1 ข้อที่มีกับดัก → เฉลย → คุ้มยังไง → ชวนสมัคร
// ไม่มีเสียงพากย์ไทย (คุณแดน 8 ต.ค. 69: เสียงไทยฟังเป็น AI) ใช้ตัวหนังสือไทยบนจอ + เสียงภาษาอังกฤษของโจทย์ (Chirp 3 HD ฟังธรรมชาติ)
//   node tools/video/hook.mjs tools/video/hooks/toeic-750-hook.json  → /Volumes/PortableSSD/Sheetlab/Courses/<course>/hook/<id>.mp4 + poster.jpg
// JSON: {id, course, title, hook:[2 บรรทัด], q:{q, o:[3], a, why, no:[เหตุผลข้อผิด]}, stats:[[เลข,คำ]×4], parts, chips:[...], cta:[หัว, รอง, ปุ่ม], poster:[ป้าย, หัว, รอง, มุมล่าง]}
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { chromium } from 'playwright-core';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..', '..');
const FFMPEG = path.join(ROOT, 'node_modules/ffmpeg-static/ffmpeg');
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const spec = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const OUT = path.join('/Volumes/PortableSSD/Sheetlab/Courses', spec.course, 'hook'); const W = path.join(OUT, 'work'); fs.mkdirSync(W, { recursive: true });
const KEY = fs.readFileSync(path.join(os.homedir(), 'Documents/Academic/.google_tts_key'), 'utf8').trim();
const V = { q: ['en-US', 'en-US-Chirp3-HD-Kore'], r: ['en-AU', 'en-AU-Chirp3-HD-Puck'], n: ['en-US', 'en-US-Chirp3-HD-Charon'] };
const ff = (...a) => execFileSync(FFMPEG, ['-y', '-loglevel', 'error', ...a]);
function probe(f) { try { execFileSync(FFMPEG, ['-i', f], { stdio: 'pipe' }); } catch (e) { const m = String(e.stderr).match(/Duration: (\d+):(\d+):([\d.]+)/); if (m) return +m[1] * 3600 + +m[2] * 60 + +m[3]; } return 0; }
const h8 = (s) => crypto.createHash('md5').update(s).digest('hex').slice(0, 10);
async function tts(text, v) { const f = path.join(W, `t-${v}-${h8(text)}.mp3`); if (fs.existsSync(f)) return f; const [lang, name] = V[v];
  const r = await fetch(`https://texttospeech.googleapis.com/v1/text:synthesize?key=${KEY}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ input: { text }, voice: { languageCode: lang, name }, audioConfig: { audioEncoding: 'MP3', sampleRateHertz: 24000 } }) });
  const j = await r.json(); if (!j.audioContent) throw new Error('TTS ' + JSON.stringify(j).slice(0, 200)); fs.writeFileSync(f, Buffer.from(j.audioContent, 'base64')); return f; }
const sil = (sec) => { const f = path.join(W, `s${sec}.mp3`); if (!fs.existsSync(f)) ff('-f', 'lavfi', '-i', 'anullsrc=r=24000:cl=mono', '-t', String(sec), '-c:a', 'libmp3lame', '-q:a', '6', f); return f; };
function cat(files, name) { const out = path.join(W, name + '.mp3'), l = out + '.txt'; fs.writeFileSync(l, files.map((f) => `file '${f}'`).join('\n')); ff('-f', 'concat', '-safe', '0', '-i', l, '-ar', '24000', '-ac', '1', '-c:a', 'libmp3lame', '-b:a', '96k', out); return out; }
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const md = (s) => esc(s).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/\n/g, '<br>');
const L = ['A', 'B', 'C', 'D'];
const css = `*{box-sizing:border-box;margin:0}body{width:1920px;height:1080px;font-family:'Sukhumvit Set','Thonburi',sans-serif;background:radial-gradient(1200px 700px at 80% 0%,#2b3b6e,#16203f);color:#fff;overflow:hidden;position:relative}
.c{position:absolute;inset:0;display:flex;flex-direction:column;justify-content:center;padding:0 140px}.brand{position:absolute;left:140px;top:70px;font-size:34px;font-weight:800;color:#f0b400}.site{position:absolute;right:140px;bottom:60px;font-size:30px;color:#c9d2e8}
.big{font-size:118px;line-height:1.08;font-weight:800}.big b{color:#f0b400}.sub{font-size:52px;color:#dfe5f3;margin-top:28px;line-height:1.3}
.ear{font-size:64px;font-weight:800;margin-bottom:46px}.abc{display:flex;gap:44px}.abc div{width:210px;height:210px;border-radius:44px;background:rgba(255,255,255,.08);border:6px solid rgba(255,255,255,.25);display:grid;place-items:center;font-size:120px;font-weight:800}
.tm{margin-top:56px;display:flex;align-items:center;gap:30px;font-size:50px;color:#dfe5f3}.tm b{width:170px;height:170px;border-radius:50%;background:#f0b400;color:#16203f;display:grid;place-items:center;font-size:110px}
.qq{font-family:'Helvetica Neue',Arial,sans-serif;font-size:58px;font-weight:700;margin-bottom:30px}
.it{display:flex;gap:28px;align-items:center;border-radius:26px;padding:22px 30px;margin:14px 0;font-size:46px;background:rgba(255,255,255,.07);border:5px solid rgba(255,255,255,.18)}.it .k{width:74px;height:74px;border-radius:18px;display:grid;place-items:center;font-weight:800;flex:none;background:rgba(255,255,255,.15)}
.it.ok{border-color:#22c55e;background:rgba(34,197,94,.15)}.it.ok .k{background:#22c55e}.it.no{border-color:#ef4444;background:rgba(239,68,68,.12)}.it.no .k{background:#ef4444}.it .en{font-family:'Helvetica Neue',Arial,sans-serif;font-weight:600}.it small{display:block;font-size:34px;color:#fecaca;margin-top:4px}.it.ok small{color:#bbf7d0}
.why{margin-top:22px;font-size:46px;background:#f0b400;color:#16203f;border-radius:20px;padding:20px 30px;font-weight:700}
.stats{display:grid;grid-template-columns:repeat(3,1fr);gap:28px;margin-top:40px}.stats div{background:rgba(255,255,255,.08);border-radius:28px;padding:34px;text-align:center}.stats b{display:block;font-size:96px;color:#f0b400;line-height:1}.stats span{font-size:40px;color:#dfe5f3}
.cta{display:inline-block;margin-top:46px;background:#f0b400;color:#16203f;font-size:62px;font-weight:800;border-radius:28px;padding:26px 56px}.chips{display:flex;gap:18px;flex-wrap:wrap;margin-top:34px}.chips span{font-size:38px;border:3px solid rgba(255,255,255,.35);border-radius:999px;padding:10px 26px}`;
const page = (inner) => `<!doctype html><html><head><meta charset="utf-8"><style>${css}</style></head><body><div class="brand">SheetLab · ${esc(spec.title)}</div><div class="c">${inner}</div><div class="site">sheetlabth.com</div></body></html>`;

async function main() {
  const q = spec.q, steps = [];
  steps.push({ html: page(`<div class="big">${md(spec.hook[0])}</div><div class="sub">${md(spec.hook[1])}</div>`), au: [sil(2.6)] });
  const qAud = [await tts(q.q, 'q'), sil(0.7)];
  for (let i = 0; i < q.o.length; i++) { qAud.push(await tts(`${L[i]}. ${q.o[i]}`, 'r'), sil(0.6)); }
  const ask = `<div class="ear">🎧 ฟังคำถาม แล้วเลือกคำตอบ</div><div class="abc">${q.o.map((_, i) => `<div>${L[i]}</div>`).join('')}</div>`;
  steps.push({ html: page(ask), au: qAud });
  for (const n of [3, 2, 1]) steps.push({ html: page(ask + `<div class="tm"><b>${n}</b>ตอบข้อไหน?</div>`), au: [sil(1)] });
  const ans = `<p class="qq">${esc(q.q)}</p>${q.o.map((o, i) => `<div class="it ${i === q.a ? 'ok' : 'no'}"><span class="k">${L[i]}</span><span><span class="en">${esc(o)}</span>${q.no?.[i] ? `<small>${md(q.no[i])}</small>` : i === q.a ? `<small>${md(q.why)}</small>` : ''}</span></div>`).join('')}`;
  steps.push({ html: page(ans), au: [await tts(`The answer is ${L[q.a]}. ${q.o[q.a]}`, 'n'), sil(4.2)] });
  steps.push({ html: page(`<div class="big">ในคอร์สมีแบบนี้<br><b>${esc(spec.stats[0][0])}</b> ${esc(spec.stats[0][1])}</div><div class="stats">${spec.stats.slice(1).map((s) => `<div><b>${esc(s[0])}</b><span>${esc(s[1])}</span></div>`).join('')}</div>`), au: [sil(3.6)] });
  steps.push({ html: page(`<div class="big" style="font-size:96px">${md(spec.parts)}</div><div class="chips">${spec.chips.map((c) => `<span>${esc(c)}</span>`).join('')}</div>`), au: [sil(3)] });
  steps.push({ html: page(`<div class="big" style="font-size:100px">${md(spec.cta[0])}</div><div class="sub">${md(spec.cta[1])}</div><div><span class="cta">${esc(spec.cta[2])}</span></div>`), au: [sil(4)] });
  const br = await chromium.launch({ executablePath: CHROME }); const pg = await br.newPage({ viewport: { width: 1920, height: 1080 } }); const segs = [];
  for (let i = 0; i < steps.length; i++) { const img = path.join(W, `v${i}.png`); await pg.setContent(steps[i].html, { waitUntil: 'load' }); await pg.screenshot({ path: img });
    const aud = cat(steps[i].au, `a${i}`), d = probe(aud).toFixed(2), out = path.join(W, `g${i}.mp4`);
    ff('-loop', '1', '-framerate', '25', '-t', d, '-i', img, '-i', aud, '-t', d, '-c:v', 'libx264', '-tune', 'stillimage', '-preset', 'veryfast', '-pix_fmt', 'yuv420p', '-r', '25', '-c:a', 'aac', '-b:a', '128k', '-ar', '48000', out); segs.push(out); }
  // ปกคลิป (poster) 1280×720: ชวนกดเล่น
  await pg.setViewportSize({ width: 1280, height: 720 });
  await pg.setContent(`<!doctype html><html><head><meta charset="utf-8"><style>*{margin:0;box-sizing:border-box}body{width:1280px;height:720px;font-family:'Sukhumvit Set',sans-serif;background:radial-gradient(900px 500px at 85% 0%,#2b3b6e,#16203f);color:#fff;position:relative;overflow:hidden;padding:70px 80px}
    .k{display:inline-block;background:#f0b400;color:#16203f;font-weight:800;font-size:34px;border-radius:999px;padding:8px 26px}h1{font-size:92px;line-height:1.05;margin-top:30px;font-weight:800}h1 b{color:#f0b400}p{font-size:40px;color:#dfe5f3;margin-top:22px}
    .play{position:absolute;right:90px;bottom:90px;width:190px;height:190px;border-radius:50%;background:#f0b400;display:grid;place-items:center;box-shadow:0 18px 50px rgba(0,0,0,.35)}.play i{width:0;height:0;border-style:solid;border-width:42px 0 42px 70px;border-color:transparent transparent transparent #16203f;margin-left:14px}
    .t{position:absolute;left:80px;bottom:80px;font-size:34px;color:#c9d2e8}</style></head><body><span class="k">${esc(spec.poster[0])}</span><h1>${md(spec.poster[1])}</h1><p>${md(spec.poster[2])}</p><div class="play"><i></i></div><div class="t">${esc(spec.poster[3])}</div></body></html>`);
  await pg.screenshot({ path: path.join(OUT, 'poster.jpg'), type: 'jpeg', quality: 88 }); await br.close();
  const list = path.join(W, 'all.txt'); fs.writeFileSync(list, segs.map((f) => `file '${f}'`).join('\n'));
  const mp4 = path.join(OUT, `${spec.id}.mp4`); ff('-f', 'concat', '-safe', '0', '-i', list, '-c', 'copy', '-movflags', '+faststart', mp4);
  console.log(JSON.stringify({ mp4, poster: path.join(OUT, 'poster.jpg'), seconds: Math.round(probe(mp4)), mb: Math.round(fs.statSync(mp4).size / 1e5) / 10 }));
}
main().catch((e) => { console.error(e); process.exit(1); });
