// ทำวิดีโอบทเรียนคอร์ส (ไม่โชว์หน้า): สไลด์ค่อยๆ เผยทีละข้อ + ครูเสียงไทย (Google TTS Chirp 3 HD) + ตัวอย่างเสียงอังกฤษ → MP4 1080p
//   node tools/video/lesson.mjs tools/video/lessons/toeic-L01.json
// JSON: {id, course, n, section, title, slides:[...]}
//   {type:'cover', h, sub, say}                                   หน้าเปิดบท
//   {type:'list', h, say, img?, items:[{x, sub?, say?, en?, v?, mark?:'ok'|'no'}]}   เผยทีละข้อ (en = เปิดเสียงอังกฤษก่อน แล้วครูอธิบาย)
//   {type:'photo', h, img, say, s:[4 ประโยค], a, why, no:[เหตุผลข้อผิด]}               ฝึก Part 1: ฟัง 4 ประโยค เวลาคิด แล้วเฉลย
//   {type:'qa', h, say, q, o:[3], a, why, no:[...]}                                     ฝึก Part 2
//   {type:'read', h, say?, q:'ประโยคมีช่อง ___', o:[4], a, why, no:[...]}               ฝึก Reading (โจทย์และตัวเลือกขึ้นจอ ไม่อ่านออกเสียง) เวลาคิด 5 วินาที
//   {type:'end', h, pts:[...], say}                                                     สรุปบท
// คีย์ Google TTS อ่านจาก ~/Documents/Academic/.google_tts_key (ไม่พิมพ์ออกมา) · ผลงานเก็บที่ /Volumes/PortableSSD/Sheetlab/Courses/<course>/<id>/
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { chromium } from 'playwright-core';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..', '..');
const FFMPEG = path.join(ROOT, 'node_modules/ffmpeg-static/ffmpeg');
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const SITE = 'sheetlabth.com';
const spec = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const OUT = path.join('/Volumes/PortableSSD/Sheetlab/Courses', spec.course, spec.id);
const W = path.join(OUT, 'work'); fs.mkdirSync(W, { recursive: true });
fs.writeFileSync(path.join(OUT, 'spec.json'), JSON.stringify(spec, null, 1)); // worker.py done-lesson อ่านเลขบท/ชื่อบท/คอร์สจากไฟล์นี้
// แถบความคืบหน้าในหลังบ้าน: ตั้ง JOB_ID + CONTENT_KEY แล้วสคริปต์บอกเว็บเอง (ไม่สำเร็จก็ทำต่อ)
const JOB = process.env.JOB_ID || '', CK = process.env.CONTENT_KEY || ''; let lastP = -1;
async function progress(pct, note) { if (!JOB || !CK || pct === lastP) return; lastP = pct; try { await fetch('https://sheetlabth.com/api/content?action=factory_progress', { method: 'POST', headers: { 'x-content-key': CK, 'Content-Type': 'application/json' }, body: JSON.stringify({ id: JOB, pct, note }) }); } catch (e) {} }
const KEY = fs.readFileSync(path.join(os.homedir(), 'Documents/Academic/.google_tts_key'), 'utf8').trim();
const V = { th: ['th-TH', 'th-TH-Chirp3-HD-Kore'], q: ['en-US', 'en-US-Chirp3-HD-Kore'], r: ['en-AU', 'en-AU-Chirp3-HD-Puck'], n: ['en-US', 'en-US-Chirp3-HD-Charon'], m: ['en-GB', 'en-GB-Chirp3-HD-Fenrir'] };
let chars = 0;
const ff = (...a) => execFileSync(FFMPEG, ['-y', '-loglevel', 'error', ...a]);
function probe(f) { try { execFileSync(FFMPEG, ['-i', f], { stdio: 'pipe' }); } catch (e) { const m = String(e.stderr).match(/Duration: (\d+):(\d+):([\d.]+)/); if (m) return +m[1] * 3600 + +m[2] * 60 + +m[3]; } return 0; }
const h8 = (s) => crypto.createHash('md5').update(s).digest('hex').slice(0, 10);

async function tts(text, voice) {
  const [lang, name] = V[voice] || V.th, file = path.join(W, `t-${voice}-${h8(text)}.mp3`);
  if (fs.existsSync(file)) return file;
  for (let k = 0; k < 3; k++) {
    const r = await fetch(`https://texttospeech.googleapis.com/v1/text:synthesize?key=${KEY}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ input: { text }, voice: { languageCode: lang, name }, audioConfig: { audioEncoding: 'MP3', sampleRateHertz: 24000 } }) });
    const j = await r.json(); if (j.audioContent) { fs.writeFileSync(file, Buffer.from(j.audioContent, 'base64')); chars += text.length; return file; }
    if (k === 2) throw new Error('TTS: ' + JSON.stringify(j.error || j).slice(0, 200)); await new Promise((r) => setTimeout(r, 2000));
  }
}
const sil = (sec) => { const file = path.join(W, `s${sec}.mp3`); if (!fs.existsSync(file)) ff('-f', 'lavfi', '-i', 'anullsrc=r=24000:cl=mono', '-t', String(sec), '-c:a', 'libmp3lame', '-q:a', '6', file); return file; };
async function audio(parts, name) {
  const files = [];
  for (const p of parts) { if (p.sil) files.push(sil(p.sil)); else if (p.en) files.push(await tts(p.en, p.v || 'n')); else if (p.th) files.push(await tts(p.th, 'th')); }
  files.push(sil(0.6));
  const out = path.join(W, name + '.mp3'), l = out + '.txt'; fs.writeFileSync(l, files.map((f) => `file '${f}'`).join('\n'));
  ff('-f', 'concat', '-safe', '0', '-i', l, '-ar', '24000', '-ac', '1', '-c:a', 'libmp3lame', '-b:a', '96k', out); return out;
}

// ---------- สไลด์ ----------
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const md = (s) => esc(s).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/\n/g, '<br>');
const css = `*{box-sizing:border-box;margin:0}body{width:1920px;height:1080px;font-family:'Sukhumvit Set','Thonburi',sans-serif;background:#F4F6FB;color:#1e2b53;overflow:hidden;position:relative}
.top{position:absolute;left:0;right:0;top:0;height:88px;background:#1e2b53;color:#fff;display:flex;align-items:center;justify-content:space-between;padding:0 64px;font-size:30px;font-weight:700}.top b{color:#f0b400}
.bar{position:absolute;left:0;right:0;bottom:0;height:10px;background:#dfe4ef}.bar i{display:block;height:100%;background:#f0b400}
.foot{position:absolute;left:64px;right:64px;bottom:26px;display:flex;justify-content:space-between;font-size:22px;color:#8590a8}
.c{position:absolute;inset:88px 0 70px;display:flex;flex-direction:column;justify-content:flex-start;padding:70px 110px 0}.c.cov{justify-content:center;padding-top:0}
.cov{align-items:flex-start}.kick{display:inline-block;background:#f0b400;color:#1e2b53;font-size:34px;font-weight:800;border-radius:16px;padding:10px 24px;margin-bottom:30px}
.cov h1{font-size:104px;line-height:1.12;max-width:1500px}.cov p{font-size:44px;color:#56637D;margin-top:28px;max-width:1500px;line-height:1.4}
h2{font-size:64px;line-height:1.2;margin-bottom:34px}
.wrap{display:grid;grid-template-columns:1fr;gap:56px;align-items:start}.wrap.im{grid-template-columns:1fr 760px}.wrap img{width:760px;max-height:720px;object-fit:cover;border-radius:28px;box-shadow:0 12px 40px rgba(15,27,51,.18)}
.it{display:flex;gap:26px;align-items:flex-start;background:#fff;border:4px solid #e3e8f2;border-radius:24px;padding:20px 30px;margin:12px 0;font-size:42px;line-height:1.35;transition:none}
.it .k{flex:none;width:62px;height:62px;border-radius:16px;background:#e3e8f2;display:grid;place-items:center;font-weight:800;font-size:34px}
.it.cur{border-color:#f0b400;background:#FFFBEE}.it.cur .k{background:#f0b400}.it.old{opacity:.55}
.it.ok{border-color:#16a34a;background:#E9F8EF}.it.ok .k{background:#16a34a;color:#fff}.it.no{border-color:#e5484d;background:#FDEEEE}.it.no .k{background:#e5484d;color:#fff}
.it small{display:block;font-size:32px;color:#56637D;margin-top:6px}.it .en{font-family:'Helvetica Neue',Arial,sans-serif;font-weight:600}
.dense .it{font-size:36px;padding:14px 24px;margin:9px 0}.dense .it small{font-size:28px}.dense .it .k{width:54px;height:54px;font-size:30px}
.ear{display:flex;align-items:center;gap:30px;font-size:52px;font-weight:700;margin:6px 0 30px}.ear span{font-size:90px}
.abc{display:flex;gap:34px;flex-wrap:wrap}.abc div{width:170px;height:170px;border-radius:36px;background:#fff;border:6px solid #d5dbea;display:grid;place-items:center;font-size:96px;font-weight:800}
.tm{display:flex;align-items:center;gap:28px;margin-top:40px;font-size:44px;color:#56637D}.tm b{width:150px;height:150px;border-radius:50%;background:#f0b400;color:#1e2b53;display:grid;place-items:center;font-size:90px}
.why{margin-top:22px;font-size:36px;background:#FFF6DB;border-left:10px solid #f0b400;padding:16px 26px;border-radius:14px;line-height:1.45}
.qq{font-size:46px;font-weight:700;margin-bottom:14px;font-family:'Helvetica Neue',Arial,sans-serif}
.sum .it{font-size:40px}.cta{margin-top:34px;background:#1e2b53;color:#fff;border-radius:26px;padding:28px 40px;font-size:38px;line-height:1.4}.cta b{color:#f0b400}`;
let TOTAL = 1, IDX = 0;
const page = (inner, cls = '') => `<!doctype html><html><head><meta charset="utf-8"><style>${css}</style></head><body><div class="top"><span>${esc(spec.section)} · <b>บทที่ ${spec.n}</b></span><span>SheetLab คอร์ส TOEIC</span></div><div class="c ${cls}">${inner}</div><div class="foot"><span>${IDX === 0 || IDX === TOTAL - 1 ? 'เนื้อหาและแบบฝึกแต่งขึ้นใหม่ · TOEIC เป็นเครื่องหมายการค้าของ ETS' : ''}</span><span>${SITE}</span></div><div class="bar"><i style="width:${Math.round((IDX + 1) / TOTAL * 100)}%"></i></div></body></html>`;
const L = ['A', 'B', 'C', 'D'];
const imgData = (f) => f ? 'data:image/jpeg;base64,' + fs.readFileSync(f).toString('base64') : '';

// แตกสไลด์เป็นขั้น (แต่ละขั้น = ภาพ 1 ภาพ + เสียง 1 ช่วง)
function steps(sl) {
  const S = [];
  if (sl.type === 'cover') S.push({ html: () => page(`<span class="kick">บทที่ ${spec.n}</span><h1>${md(sl.h)}</h1>${sl.sub ? `<p>${md(sl.sub)}</p>` : ''}`, 'cov'), au: [{ th: sl.say }] });
  if (sl.type === 'list' || sl.type === 'end') {
    const its = sl.type === 'end' ? (sl.items || (sl.pts || []).map((x) => ({ x }))).map((x) => ({ ...x, mark: 'ok' })) : sl.items || [];
    const box = (upto, all) => `<h2>${md(sl.h)}</h2><div class="wrap${sl.img ? ' im' : ''}"><div class="${its.length > 4 ? 'dense' : ''}">${its.map((it, i) => i > upto ? '' : `<div class="it ${it.mark && (all || i < upto) ? it.mark : i === upto && !all ? 'cur' : all ? '' : 'old'}"><span class="k">${it.mark === 'ok' && (all || i < upto) ? '✓' : it.mark === 'no' && (all || i < upto) ? '✗' : i + 1}</span><span><span class="${it.en && it.en === it.x ? 'en' : ''}">${md(it.x)}</span>${it.sub ? `<small>${md(it.sub)}</small>` : ''}</span></div>`).join('')}${sl.type === 'end' && all ? `<div class="cta">ฝึกต่อด้วยข้อสอบเสมือนจริงในชุดหนังสือ · ทำเครื่องหมาย <b>✓ เรียนจบ</b> แล้วไปบทถัดไปได้เลย</div>` : ''}</div>${sl.img ? `<img src="${imgData(sl.img)}">` : ''}</div>`;
    if (sl.say) S.push({ html: () => page(box(-1, false)), au: [{ th: sl.say }] });
    its.forEach((it, i) => { const au = []; if (it.en) au.push({ en: it.en, v: it.v || 'n' }, { sil: 0.5 }); if (it.say) au.push({ th: it.say }); if (!au.length) au.push({ sil: 1.5 }); S.push({ html: () => page(box(i, false)), au }); });
    if (sl.type === 'end') S.push({ html: () => page(box(its.length, true)), au: [{ th: sl.outro || 'จบบทนี้แล้ว เก่งมาก กดทำเครื่องหมายว่าเรียนจบ แล้วไปบทถัดไปกันเลย' }, { sil: 1.5 }] });
  }
  if (sl.type === 'photo' || sl.type === 'qa') {
    const P1 = sl.type === 'photo', opts = P1 ? sl.s : sl.o;
    const tHtml = (n) => `<h2>${md(sl.h || 'ลองทำ')}</h2><div class="wrap${P1 ? ' im' : ''}"><div><div class="ear"><span>🎧</span>${P1 ? 'ดูรูป แล้วฟัง 4 ประโยค' : 'ฟังคำถาม แล้วฟัง 3 คำตอบ'}</div><div class="abc">${opts.map((_, i) => `<div>${L[i]}</div>`).join('')}</div>${n ? `<div class="tm"><b>${n}</b>เลือกคำตอบในใจ</div>` : ''}</div>${P1 ? `<img src="${imgData(sl.img)}">` : ''}</div>`, qHtml = tHtml(0);
    const ans = `<h2>เฉลย: ${L[sl.a]}</h2><div class="wrap${P1 ? ' im' : ''}"><div class="dense">${P1 ? '' : `<p class="qq">${esc(sl.q)}</p>`}${opts.map((o, i) => `<div class="it ${i === sl.a ? 'ok' : 'no'}"><span class="k">${L[i]}</span><span><span class="en">${esc(o)}</span>${i !== sl.a && sl.no?.[i] ? `<small>${md(sl.no[i])}</small>` : ''}</span></div>`).join('')}<div class="why">${md(sl.why)}</div></div>${P1 ? `<img src="${imgData(sl.img)}">` : ''}</div>`;
    const au = []; if (sl.say) au.push({ th: sl.say }, { sil: 0.6 });
    if (!P1) au.push({ en: sl.q, v: 'q' }, { sil: 0.8 });
    opts.forEach((o, i) => au.push({ en: `${L[i]}. ${o}`, v: P1 ? 'n' : 'r' }, { sil: 0.7 }));
    S.push({ html: () => page(qHtml), au });
    for (const n of [3, 2, 1]) S.push({ html: () => page(tHtml(n)), au: [{ sil: 1 }], short: true });
    S.push({ html: () => page(ans), au: [{ th: `เฉลยข้อ ${L[sl.a]}` }, { sil: 0.3 }, { en: opts[sl.a], v: P1 ? 'n' : 'r' }, { sil: 0.5 }, { th: sl.whySay || sl.why.replace(/\*\*/g, '') }, { sil: 1 }] });
  }
  if (sl.type === 'read') {
    const opts = sl.o, full = String(sl.q).replace(/_{2,}/, opts[sl.a]);
    const body = (n, ans) => `<h2>${md(ans ? `เฉลย: ${L[sl.a]}` : sl.h || 'ลองทำ')}</h2><div class="dense"><p class="qq">${esc(sl.q).replace(/_{2,}/, ans ? `<u>${esc(opts[sl.a])}</u>` : '________')}</p>${opts.map((o, i) => `<div class="it ${ans ? (i === sl.a ? 'ok' : 'no') : ''}"><span class="k">${L[i]}</span><span><span class="en">${esc(o)}</span>${ans && i !== sl.a && sl.no?.[i] ? `<small>${md(sl.no[i])}</small>` : ''}</span></div>`).join('')}${ans ? `<div class="why">${md(sl.why)}</div>` : n ? `<div class="tm"><b>${n}</b>เลือกคำตอบในใจ</div>` : ''}</div>`;
    S.push({ html: () => page(body(0)), au: [{ th: sl.say || 'อ่านประโยค แล้วเลือกคำที่เหมาะที่สุด' }, { sil: 1 }] });
    for (const n of [5, 4, 3, 2, 1]) S.push({ html: () => page(body(n)), au: [{ sil: 1 }], short: true });
    S.push({ html: () => page(body(0, true)), au: [{ th: `เฉลยข้อ ${L[sl.a]}` }, { sil: 0.3 }, { en: full, v: 'n' }, { sil: 0.5 }, { th: sl.whySay || String(sl.why).replace(/\*\*/g, '') }, { sil: 1 }] });
  }
  return S;
}

async function main() {
  const all = spec.slides.flatMap((sl) => steps(sl)); TOTAL = all.length;
  const br = await chromium.launch({ executablePath: CHROME }); const pg = await br.newPage({ viewport: { width: 1920, height: 1080 } });
  const segs = [];
  for (let i = 0; i < all.length; i++) {
    IDX = i; const st = all[i], html = st.html(), img = path.join(W, `v-${h8(html)}.png`);
    if (!fs.existsSync(img)) { await pg.setContent(html, { waitUntil: 'load' }); await pg.screenshot({ path: img }); }
    const aud = st.short ? sil(1) : await audio(st.au, `a${String(i).padStart(3, '0')}`);
    const out = path.join(W, `g${String(i).padStart(3, '0')}-${h8(img + aud + probe(aud))}.mp4`);
    if (!fs.existsSync(out)) { const d = probe(aud).toFixed(2); ff('-loop', '1', '-framerate', '25', '-t', d, '-i', img, '-i', aud, '-t', d, '-c:v', 'libx264', '-tune', 'stillimage', '-preset', 'veryfast', '-pix_fmt', 'yuv420p', '-r', '25', '-c:a', 'aac', '-b:a', '128k', '-ar', '48000', out); }
    segs.push(out); process.stdout.write(`\r${i + 1}/${all.length}`); await progress(15 + Math.floor((i + 1) / all.length * 70), `เสียง+สไลด์ ${i + 1}/${all.length}`);
  }
  // ปกบท (16:9) ใช้เป็นรูปตัวอย่าง
  IDX = 0; await pg.setContent(steps(spec.slides[0])[0].html(), { waitUntil: 'load' }); await pg.screenshot({ path: path.join(OUT, 'cover.png') });
  await br.close();
  await progress(88, 'รวมเป็นวิดีโอ');
  const list = path.join(W, 'all.txt'); fs.writeFileSync(list, segs.map((f) => `file '${f}'`).join('\n'));
  const mp4 = path.join(OUT, `${spec.id}.mp4`); ff('-f', 'concat', '-safe', '0', '-i', list, '-c', 'copy', '-movflags', '+faststart', mp4);
  try { const u = '/Volumes/PortableSSD/Sheetlab/_factory/tts_usage.json', m = new Date().toISOString().slice(0, 7); const d = fs.existsSync(u) ? JSON.parse(fs.readFileSync(u, 'utf8')) : {}; const o = d.month === m ? d : { month: m, chars: 0 }; o.chars += chars; fs.writeFileSync(u, JSON.stringify(o)); } catch (e) {}
  const sec = Math.round(probe(mp4));
  console.log('\n' + JSON.stringify({ mp4, seconds: sec, min: Math.max(1, Math.round(sec / 60)), mb: Math.round(fs.statSync(mp4).size / 1e5) / 10, ttsChars: chars }));
}
main().catch((e) => { console.error(e); process.exit(1); });
