// ทำคลิป YouTube "TOEIC Listening Part 2 ฝึกฟัง 10 ข้อ" จากไฟล์โจทย์ JSON: เสียง Google TTS (Chirp 3 HD) + สไลด์ (Chrome) + ffmpeg → MP4 1080p
//   node tools/video/part2.mjs tools/video/part2-01.json
// คีย์ Google TTS อ่านจาก ~/Documents/Academic/.google_tts_key (ไม่พิมพ์ออกมา) · ผลงานเก็บที่ /Volumes/PortableSSD/Sheetlab/Videos/<id>/
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { chromium } from 'playwright-core';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..', '..');
const FFMPEG = path.join(ROOT, 'node_modules/ffmpeg-static/ffmpeg');
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const SITE = 'sheetlabth.com';
const spec = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const OUT = path.join('/Volumes/PortableSSD/Sheetlab/Videos', spec.id);
const W = path.join(OUT, 'work'); fs.mkdirSync(W, { recursive: true });
const KEY = fs.readFileSync(path.join(os.homedir(), 'Documents/Academic/.google_tts_key'), 'utf8').trim();
const V = { q: ['en-US', 'en-US-Chirp3-HD-Kore'], r: ['en-AU', 'en-AU-Chirp3-HD-Puck'], n: ['en-US', 'en-US-Chirp3-HD-Charon'] };
let chars = 0;
const ff = (...a) => execFileSync(FFMPEG, ['-y', '-loglevel', 'error', ...a]);
function probe(f) { try { execFileSync(FFMPEG, ['-i', f], { stdio: 'pipe' }); } catch (e) { const m = String(e.stderr).match(/Duration: (\d+):(\d+):([\d.]+)/); if (m) return +m[1] * 3600 + +m[2] * 60 + +m[3]; } return 0; }

async function tts(text, [lang, name], file) {
  if (fs.existsSync(file)) return file;
  const r = await fetch(`https://texttospeech.googleapis.com/v1/text:synthesize?key=${KEY}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ input: { text }, voice: { languageCode: lang, name }, audioConfig: { audioEncoding: 'MP3', sampleRateHertz: 24000 } }) });
  const j = await r.json(); if (!j.audioContent) throw new Error('TTS: ' + JSON.stringify(j.error || j).slice(0, 200));
  fs.writeFileSync(file, Buffer.from(j.audioContent, 'base64')); chars += text.length; return file;
}
const sil = (sec, file) => { if (!fs.existsSync(file)) ff('-f', 'lavfi', '-i', 'anullsrc=r=24000:cl=mono', '-t', String(sec), '-c:a', 'libmp3lame', '-q:a', '6', file); return file; };
const cat = (files, out) => { const l = out + '.txt'; fs.writeFileSync(l, files.map((f) => `file '${f}'`).join('\n')); ff('-f', 'concat', '-safe', '0', '-i', l, '-ar', '24000', '-ac', '1', '-c:a', 'libmp3lame', '-b:a', '96k', out); return out; };

// ---------- สไลด์ ----------
const L = ['A', 'B', 'C'];
const css = `*{box-sizing:border-box;margin:0}body{width:1920px;height:1080px;font-family:'Sukhumvit Set','Thonburi',sans-serif;background:#F4F6FB;color:#1e2b53;overflow:hidden;position:relative}
.top{position:absolute;left:0;right:0;top:0;height:92px;background:#1e2b53;color:#fff;display:flex;align-items:center;justify-content:space-between;padding:0 64px;font-size:34px;font-weight:700}.top b{color:#f0b400}
.foot{position:absolute;left:64px;right:64px;bottom:30px;display:flex;justify-content:space-between;font-size:24px;color:#6b7690}
.c{position:absolute;inset:92px 0 80px;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:0 120px}
h1{font-size:96px;line-height:1.15}h2{font-size:64px}.sub{font-size:40px;color:#56637D;margin-top:22px}
.opts{display:flex;gap:56px;margin-top:60px}.o{width:220px;height:220px;border-radius:40px;background:#fff;border:6px solid #d5dbea;display:grid;place-items:center;font-size:120px;font-weight:800;color:#1e2b53}
.timer{width:260px;height:260px;border-radius:50%;background:#f0b400;color:#1e2b53;display:grid;place-items:center;font-size:150px;font-weight:800;margin-top:40px}
.ans{width:100%;max-width:1500px;text-align:left}.qline{font-size:46px;font-weight:700;margin-bottom:6px}.th{font-size:34px;color:#56637D;margin-bottom:26px}
.row{display:flex;gap:24px;align-items:center;font-size:42px;padding:16px 26px;border-radius:20px;margin:10px 0;background:#fff;border:4px solid #e3e8f2}.row.ok{border-color:#16a34a;background:#E9F8EF}.row .k{width:64px;height:64px;border-radius:16px;background:#e3e8f2;display:grid;place-items:center;font-weight:800;flex:none}.row.ok .k{background:#16a34a;color:#fff}.row .t{flex:1}.row .m{font-size:40px}
.why{margin-top:22px;font-size:34px;background:#FFF6DB;border-left:10px solid #f0b400;padding:16px 24px;border-radius:12px;line-height:1.45}
.cta{background:#1e2b53;color:#fff;border-radius:32px;padding:44px 60px;margin-top:40px;font-size:48px;line-height:1.4}.cta b{color:#f0b400}.url{font-size:56px;font-weight:800;color:#f0b400;margin-top:10px}`;
const page = (inner, n) => `<!doctype html><html><head><meta charset="utf-8"><style>${css}</style></head><body><div class="top"><span>TOEIC Listening <b>Part 2</b> · ฝึกฟัง</span><span>${n || 'SheetLab'}</span></div>${inner}<div class="foot"><span>แบบฝึกแต่งขึ้นใหม่ ไม่ใช่ข้อสอบจริง · TOEIC เป็นเครื่องหมายการค้าของ ETS</span><span>${SITE}</span></div></body></html>`;
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

async function main() {
  const br = await chromium.launch({ executablePath: CHROME }); const pg = await br.newPage({ viewport: { width: 1920, height: 1080 } });
  const shot = async (html, file) => { if (!fs.existsSync(file)) { await pg.setContent(html, { waitUntil: 'load' }); await pg.screenshot({ path: file }); } return file; };
  const N = spec.items.length, segs = [];
  const seg = (img, aud, name) => { const out = path.join(W, name + '.mp4'); if (!fs.existsSync(out)) { const d = probe(aud).toFixed(2); ff('-loop', '1', '-framerate', '25', '-t', d, '-i', img, '-i', aud, '-t', d, '-c:v', 'libx264', '-tune', 'stillimage', '-preset', 'veryfast', '-pix_fmt', 'yuv420p', '-r', '25', '-c:a', 'aac', '-b:a', '128k', '-ar', '48000', out); } /* ความยาวเท่าเสียงพอดี (-shortest กับรูปนิ่งยาวเกินจริง) */ segs.push(out); };
  // บทนำ
  const introA = cat([await tts('TOEIC Listening, Part 2. Question and response. Ten questions. Listen to the question and the three responses, then choose the best answer.', V.n, path.join(W, 'intro.mp3')), sil(1, path.join(W, 's1.mp3'))], path.join(W, 'intro-full.mp3'));
  seg(await shot(page(`<div class="c"><h1>${esc(spec.title.replace(/ พร้อม.*/, ''))}</h1><p class="sub">ฟังคำถาม + ตัวเลือก 3 ข้อ แล้วเลือกคำตอบที่เหมาะที่สุด · มีเวลาคิดข้อละ 5 วินาที · เฉลยพร้อมคำแปลทุกข้อ</p></div>`), path.join(W, 'intro.png')), introA, '00-intro');
  for (let i = 0; i < N; i++) {
    const it = spec.items[i], k = String(i + 1).padStart(2, '0'), tag = `ข้อ ${i + 1} / ${N}`;
    const parts = [await tts(`Number ${i + 1}.`, V.n, path.join(W, `${k}-n.mp3`)), sil(0.5, path.join(W, 's05.mp3')), await tts(it.q, V.q, path.join(W, `${k}-q.mp3`)), sil(0.8, path.join(W, 's08.mp3'))];
    for (let j = 0; j < 3; j++) parts.push(await tts(`${L[j]}. ${it.o[j]}`, V.r, path.join(W, `${k}-${L[j]}.mp3`)), sil(0.7, path.join(W, 's07.mp3')));
    seg(await shot(page(`<div class="c"><h2>${tag}</h2><p class="sub">ฟังแล้วเลือกคำตอบที่เหมาะที่สุด</p><div class="opts">${L.map((x) => `<div class="o">${x}</div>`).join('')}</div></div>`, tag), path.join(W, `${k}-q.png`)), cat(parts, path.join(W, `${k}-qa.mp3`)), `${k}-1q`);
    for (let t = 5; t >= 1; t--) seg(await shot(page(`<div class="c"><h2>${tag}</h2><p class="sub">เลือกคำตอบ A, B หรือ C</p><div class="timer">${t}</div></div>`, tag), path.join(W, `${k}-t${t}.png`)), sil(1, path.join(W, 's1.mp3')), `${k}-2t${t}`);
    const rev = cat([await tts(`The answer is ${L[it.a]}.`, V.n, path.join(W, `${k}-ans.mp3`)), sil(0.5, path.join(W, 's05.mp3')), await tts(it.q, V.q, path.join(W, `${k}-q.mp3`)), sil(0.4, path.join(W, 's04.mp3')), await tts(it.o[it.a], V.r, path.join(W, `${k}-ok.mp3`)), sil(4, path.join(W, 's4.mp3'))], path.join(W, `${k}-rev.mp3`));
    seg(await shot(page(`<div class="c"><div class="ans"><p class="qline">${esc(it.q)}</p><p class="th">${esc(it.qth)}</p>${it.o.map((o, j) => `<div class="row ${j === it.a ? 'ok' : ''}"><span class="k">${L[j]}</span><span class="t">${esc(o)}${j === it.a ? `<br><span style="font-size:32px;color:#3f7a52">${esc(it.ath)}</span>` : ''}</span><span class="m">${j === it.a ? '✓' : ''}</span></div>`).join('')}<div class="why">💡 ${esc(it.why)}</div></div></div>`, tag), path.join(W, `${k}-a.png`)), rev, `${k}-3a`);
  }
  // ท้ายคลิป
  const endA = cat([await tts('Great job! Want more practice? Get one thousand more questions with full audio. Check the link in the description.', V.n, path.join(W, 'end.mp3')), sil(4, path.join(W, 's4.mp3'))], path.join(W, 'end-full.mp3'));
  seg(await shot(page(`<div class="c"><h1>ทำได้กี่ข้อ? 🎯</h1><div class="cta">อยากฝึกต่อ <b>ข้อสอบ Listening 10 ชุด 1,000 ข้อ</b><br>ไฟล์เสียงครบ สคริปต์ + เฉลย + คำแปลไทย<div class="url">${SITE}/p/${esc(spec.product)}</div></div><p class="sub">🎁 รับโค้ดส่วนลดได้ที่ ${SITE}/deal · ลิงก์อยู่ใต้คลิป</p></div>`), path.join(W, 'end.png')), endA, '99-end');
  // ปกคลิป (thumbnail 1280×720)
  await pg.setViewportSize({ width: 1280, height: 720 });
  await pg.setContent(`<!doctype html><html><head><meta charset="utf-8"><style>body{margin:0;width:1280px;height:720px;background:#1e2b53;font-family:'Sukhumvit Set',sans-serif;color:#fff;display:flex;flex-direction:column;justify-content:center;padding:0 80px;box-sizing:border-box}.t{font-size:120px;font-weight:800;line-height:1}.y{color:#f0b400}.s{font-size:58px;font-weight:700;margin-top:18px}.p{position:absolute;right:70px;top:70px;background:#f0b400;color:#1e2b53;font-weight:800;font-size:44px;border-radius:24px;padding:14px 28px}</style></head><body><div class="p">10 ข้อ + เฉลย</div><div class="t">TOEIC<br><span class="y">Listening</span><br>Part 2</div><div class="s">ฝึกฟัง ตอบให้ทันใน 5 วินาที 🎧</div></body></html>`);
  await pg.screenshot({ path: path.join(OUT, 'thumbnail.png') }); await br.close();
  // รวมคลิป
  const list = path.join(W, 'all.txt'); fs.writeFileSync(list, segs.map((f) => `file '${f}'`).join('\n'));
  const mp4 = path.join(OUT, `${spec.id}.mp4`); ff('-f', 'concat', '-safe', '0', '-i', list, '-c', 'copy', '-movflags', '+faststart', mp4);
  const desc = `${spec.title}
ฟังคำถามและตัวเลือก 3 ข้อ แล้วเลือกคำตอบที่เหมาะที่สุด มีเวลาคิดข้อละ 5 วินาที เฉลยพร้อมคำแปลไทยและเหตุผลทุกข้อ

📚 ฝึกต่อ ข้อสอบ TOEIC Listening Part 1–4 10 ชุด 1,000 ข้อ ไฟล์เสียงครบ: https://${SITE}/p/${spec.product}
📦 ชุด TOEIC 750+ ครบทุกพาร์ต: https://${SITE}/p/${spec.set}
🎁 โค้ดส่วนลดส่วนตัว (24 ชม.): https://${SITE}/deal
🆓 ชีทฟรี TOEIC 50 คำศัพท์ที่คนไทยสับสน: https://${SITE}/free

แบบฝึกนี้แต่งขึ้นใหม่เพื่อการฝึก ไม่ใช่ข้อสอบจริง · เสียงอ่านสร้างด้วย AI · TOEIC เป็นเครื่องหมายการค้าจดทะเบียนของ ETS ช่องนี้ไม่เกี่ยวข้องกับ ETS

#TOEIC #TOEICListening #ฝึกฟังภาษาอังกฤษ #เตรียมสอบTOEIC`;
  fs.writeFileSync(path.join(OUT, 'youtube.txt'), `ชื่อคลิป:\n${spec.title} | ตอบให้ทันใน 5 วินาที\n\nคำอธิบาย:\n${desc}\n\nแท็ก: TOEIC, TOEIC Listening, TOEIC Part 2, ฝึกฟังภาษาอังกฤษ, เตรียมสอบ TOEIC\n`);
  // นับโควตา TTS ร่วมกับโรงงาน
  try { const u = '/Volumes/PortableSSD/Sheetlab/_factory/tts_usage.json', m = new Date().toISOString().slice(0, 7); const d = fs.existsSync(u) ? JSON.parse(fs.readFileSync(u, 'utf8')) : {}; const o = d.month === m ? d : { month: m, chars: 0 }; o.chars += chars; fs.writeFileSync(u, JSON.stringify(o)); } catch (e) {}
  console.log(JSON.stringify({ mp4, seconds: Math.round(probe(mp4)), mb: Math.round(fs.statSync(mp4).size / 1e5) / 10, ttsChars: chars }));
}
main().catch((e) => { console.error('ERR', e.message); process.exit(1); });
