// 🖼 วาดการ์ดความรู้ลงเพจ (lib/cards.js · content.js action=card) บน Mac แล้วเข้าคิวโพสต์เป็นฉบับร่าง (พี่ต้นตรวจก่อนขึ้นเพจ)
// node tools/content/card.mjs auto            เติมคิวให้มีการ์ดรอโพสต์ 4 ใบ (วันละ 2 โพสต์ 12:00 / 20:00 เวลาไทย) · worker.py start เรียกทุกชั่วโมง
// node tools/content/card.mjs 3 [--series phrasal] [--dry]   ทำ 3 ใบ · --dry = ทำรูปไว้ดูในเครื่อง ไม่อัป ไม่เข้าคิว
// รูปถ่ายฟรี: Openverse เฉพาะ CC0 / Public Domain (ใช้ได้โดยไม่ต้องให้เครดิต) · ภาพประกอบ: อีโมจิ Noto (Apache 2.0)
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path'; import { chromium } from 'playwright-core'; import { termRe, oneEmoji } from '../../lib/cards.js';

const args = process.argv.slice(2), dry = args.includes('--dry'), si = args.indexOf('--series'), series = si >= 0 ? args[si + 1] : '';
const ji = args.indexOf('--json'), given = ji >= 0 ? JSON.parse(fs.readFileSync(args[ji + 1], 'utf8')) : null; // --json cards.json = เนื้อหาการ์ดที่เขียนไว้แล้ว [{series, ...card}] ไม่ต้องใช้ AI ร้าน
const KEY = process.env.CONTENT_KEY || fs.readFileSync(path.join(os.homedir(), '.config/sheetlab/content-key'), 'utf8').slice(0, 48).trim();
const API = 'https://sheetlabth.com/api/content?action=card';
const call = async (body) => { const r = await fetch(API, { method: 'POST', headers: { 'x-content-key': KEY, 'Content-Type': 'application/json' }, body: JSON.stringify(body) }); const j = await r.json(); if (!j.ok) throw new Error(j.error || r.status); return j; };
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const HL = ['#b9f2df', '#dccbff', '#ffe08a', '#c4e6ff'];
const FONTS = `<link href="https://fonts.googleapis.com/css2?family=Baloo+2:wght@600;800&family=Sarabun:wght@400;600;700&family=Noto+Color+Emoji&display=swap" rel="stylesheet">`;
const BASE = `*{box-sizing:border-box;margin:0}body{width:1080px;height:1350px;overflow:hidden;font-family:'Sarabun',sans-serif}.emo{font-family:'Noto Color Emoji'}.brand{font-family:'Baloo 2';font-weight:800;letter-spacing:.5px}`;

async function photo(q) { // Openverse CC0/PDM → data URL (ไม่มีก็ใช้อีโมจิแทน)
  try {
    const r = await fetch(`https://api.openverse.org/v1/images/?q=${encodeURIComponent(q)}&license=cc0,pdm&page_size=12&mature=false`, { headers: { 'User-Agent': 'SheetLab-cards/1.0' }, signal: AbortSignal.timeout(20e3) });
    const L = ((await r.json()).results || []).filter((x) => (x.width || 0) >= 700 && (x.height || 0) >= 500);
    for (const x of L.sort(() => Math.random() - 0.5).slice(0, 4)) { try { const i = await fetch(x.url, { signal: AbortSignal.timeout(20e3) }); const ct = i.headers.get('content-type') || ''; if (!i.ok || !/image\/(jpeg|png|webp)/.test(ct)) continue; const buf = Buffer.from(await i.arrayBuffer()); if (buf.length > 6e6 || buf.length < 2e4) continue; return { src: `data:${ct.split(';')[0]};base64,${buf.toString('base64')}`, credit: x.license }; } catch (e) {} }
  } catch (e) {}
  return null;
}

function passageHtml(c, ph) {
  let n = 0; const para = esc(c.paragraph).replace(/\[\[([^\]]+)\]\]/g, (m, w) => `<span class="hl" style="background:${HL[n++ % 4]}">${w}</span>`);
  return `<!doctype html><html><head><meta charset="utf-8">${FONTS}<style>${BASE}
body{background:#1e2b53;padding:34px}.top{display:flex;justify-content:space-between;align-items:center;height:70px;color:#fff}.brand{font-size:44px}.brand b{color:#f0b400}.chip{background:#f0b400;color:#1e2b53;border-radius:99px;padding:6px 20px;font-weight:700;font-size:24px}
.card{position:relative;background:#fff;border-radius:44px;padding:44px 48px 40px;margin-top:18px}.ph{position:absolute;right:28px;top:-20px;width:390px;height:300px;border-radius:30px;overflow:hidden;border:8px solid #fff;box-shadow:0 8px 24px rgba(0,0,0,.25);background:#fff4d6;display:flex;align-items:center;justify-content:center;font-size:150px}.ph img{width:100%;height:100%;object-fit:cover}
h1{font-family:'Baloo 2';font-weight:800;color:#1e2b53;font-size:68px;line-height:1.02;max-width:560px}.sub{color:#5b6478;font-size:30px;margin:8px 0 18px;max-width:560px;font-weight:600}.p{font-size:var(--fs,36px);line-height:1.5;color:#1b1f2a;margin-top:${ph ? 46 : 10}px}.hl{border-radius:12px;padding:0 10px;font-weight:700}
.tips{background:#f0b400;border-radius:40px;margin-top:24px;padding:30px 44px;color:#1e2b53}.tips h2{font-family:'Baloo 2';font-style:italic;font-size:46px;line-height:1}.tips h3{font-size:30px;margin:6px 0 14px}.row{display:flex;align-items:center;gap:16px;font-size:var(--ts,31px);margin:8px 0;font-weight:600}.row .hl{font-family:'Baloo 2';font-weight:800;font-size:1.1em;padding:2px 16px;white-space:nowrap}
.foot{color:#fff;text-align:center;font-size:24px;margin-top:16px;opacity:.9}</style></head><body><div class="top"><div class="brand">Sheet<b>Lab</b></div><div class="chip">ฝึกอ่าน · ฝึกเขียน</div></div>
<div class="card"><div class="ph">${ph ? `<img src="${ph.src}">` : `<span class="emo">📖</span>`}</div><h1>${esc(c.title)}</h1><div class="sub">${esc(c.title_th)}</div><div class="p" id="p">${para}</div></div>
<div class="tips" id="tips"><h2>Top Tips</h2><h3>${esc(c.tips_title)}</h3>${c.tips.map((t, i) => `<div class="row"><span class="hl" style="background:${HL[i % 4]}">${esc(t.word)}</span><span>= ${esc(t.th)}</span></div>`).join('')}</div>
<div class="foot">sheetlabth.com · ฝึก TOEIC / IELTS ฟรี อธิบายภาษาไทย</div></body></html>`;
}
function listHtml(c) {
  const words = c.title.split(' '), last = words.pop();
  const hi = (ex, term) => { const m = termRe(term) && ex.match(termRe(term)); if (!m) return esc(ex); const i = m.index; return esc(ex.slice(0, i)) + `<span class="y">${esc(m[0])}</span>` + esc(ex.slice(i + m[0].length)); };
  return `<!doctype html><html><head><meta charset="utf-8">${FONTS}<style>${BASE}
body{background:#fff8ec;padding:36px 44px;color:#1e2b53;position:relative}.d1{position:absolute;left:30px;top:26px;font-size:60px;color:#1e2b53;opacity:.8}.d2{position:absolute;right:40px;top:40px;width:70px;height:70px;border-radius:50%;border:6px dotted #6c4cd6}
.head{text-align:center}.t1{font-family:'Baloo 2';font-weight:800;font-size:58px;line-height:1}.t2{display:inline-block;font-family:'Baloo 2';font-weight:800;color:#fff;background:#4b2bb5;font-size:82px;line-height:1.05;padding:4px 44px;border-radius:24px;transform:rotate(-1.5deg);margin-top:8px}.sub{font-size:30px;font-weight:600;color:#5b6478;margin-top:10px}
.it{display:flex;align-items:center;gap:18px;padding:var(--pad,13px) 0;border-bottom:3px solid #eadfcf}.n{flex:0 0 58px;height:58px;border-radius:50%;border:5px solid #1e2b53;font-family:'Baloo 2';font-weight:800;font-size:34px;display:flex;align-items:center;justify-content:center}.b{flex:1;min-width:0}
.term{display:inline-block;font-family:'Baloo 2';font-weight:800;font-size:var(--tf,40px);background:#ffc2cf;border-radius:12px;padding:0 16px;line-height:1.25}.m{font-size:var(--mf,26px);color:#3a3fa0;font-weight:600;line-height:1.3}.th{font-size:var(--mf,26px);color:#5b6478;line-height:1.3}.ex{font-size:var(--mf,26px);line-height:1.35;margin-top:2px}.ex:before{content:'• '}.y{background:#ffe08a;border-radius:8px;padding:0 6px;font-weight:700}
.pic{flex:0 0 140px;height:140px;border-radius:30px;background:#fff;box-shadow:0 4px 14px rgba(0,0,0,.08);display:flex;align-items:center;justify-content:center;font-size:92px}.foot{position:absolute;left:0;right:0;bottom:26px;text-align:center}.foot span{background:#dfe8ff;color:#1e2b53;border-radius:99px;padding:8px 30px;font-family:'Baloo 2';font-weight:800;font-size:30px}</style></head><body><div class="d1">#</div><div class="d2"></div>
<div class="head"><div class="t1">${esc(words.join(' '))}</div><div class="t2">${esc(last)}</div><div class="sub">${esc(c.title_th)}</div></div><div id="L">
${c.items.map((x, i) => `<div class="it"><div class="n">${i + 1}</div><div class="b"><span class="term">${esc(x.term)}</span><div class="m">${esc(x.meaning)}</div><div class="th">${esc(x.th)}</div><div class="ex">${hi(x.example, x.term)}</div></div><div class="pic"><span class="emo">${esc(oneEmoji(x.emoji))}</span></div></div>`).join('')}
</div><div class="foot"><span>SheetLab · sheetlabth.com</span></div></body></html>`;
}

async function render(b, html, type) {
  const pg = await b.newPage({ viewport: { width: 1080, height: 1350 }, deviceScaleFactor: 1 });
  await pg.setContent(html, { waitUntil: 'networkidle' }); await pg.evaluate(() => document.fonts.ready);
  // ย่อตัวหนังสือจนพอดี 1350px (ไม่ล้น)
  const ok = await pg.evaluate((type) => { const r = document.documentElement.style, over = () => document.body.scrollHeight > 1352 || (type === 'list' && document.getElementById('L').getBoundingClientRect().bottom > 1270);
    const steps = type === 'list' ? [[40, 26, 13], [38, 25, 10], [36, 24, 8], [34, 22, 6], [32, 21, 5]] : [[36, 31], [34, 30], [32, 29], [30, 28], [29, 27]];
    for (const s of steps) { if (type === 'list') { r.setProperty('--tf', s[0] + 'px'); r.setProperty('--mf', s[1] + 'px'); r.setProperty('--pad', s[2] + 'px'); } else { r.setProperty('--fs', s[0] + 'px'); r.setProperty('--ts', s[1] + 'px'); } if (!over()) return true; } return !over(); }, type);
  const png = await pg.screenshot({ type: 'png' }); await pg.close(); return { png, ok };
}

export { passageHtml, listHtml, render, photo };
if (import.meta.url === 'file://' + path.resolve(process.argv[1] || '')) await main();
async function main() {
const mode = args.find((a) => /^(auto|\d+)$/.test(a)) || '1';
let n = given ? given.length : Number(mode) || 0;
if (mode === 'auto') { const st = await call({ op: 'status' }); n = Math.max(0, Math.min(2, 4 - st.upcoming)); if (!n) { console.log(JSON.stringify({ ok: true, upcoming: st.upcoming, made: 0 })); process.exit(0); } }
const b = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true }), out = [];
try {
  for (let i = 0; i < n; i++) {
    try {
      const gc = given && given[i], g = await call({ op: 'gen', ...(gc ? { series: gc.series, card: gc } : series ? { series } : {}) }), c = g.card;
      const ph = c.type === 'passage' ? await photo(c.photo || c.title) : null;
      const { png, ok } = await render(b, c.type === 'list' ? listHtml(c) : passageHtml(c, ph), c.type);
      if (!ok) { out.push({ skip: 'ข้อความยาวเกินการ์ด', title: c.title }); continue; }
      if (dry) { const f = path.join(os.tmpdir(), `card-${c.series}-${Date.now()}.png`); fs.writeFileSync(f, png); out.push({ dry: f, title: c.title, series: c.series, photo: ph ? ph.credit : 'emoji' }); continue; }
      const up = await fetch(g.upload_url, { method: 'PUT', headers: { 'Content-Type': 'image/png', 'x-upsert': 'true' }, body: png }); if (!up.ok) throw new Error('อัปโหลดรูปไม่ได้ ' + up.status);
      const p = await call({ op: 'post', card: c, image_url: g.file_url, slot: g.slot }); out.push({ title: c.title, series: c.series, at: p.scheduled_at, status: p.status, policy: p.policy });
    } catch (e) { out.push({ error: String(e.message || e).slice(0, 160) }); }
  }
} finally { await b.close(); }
console.log(JSON.stringify({ ok: true, made: out }, null, 1));
}
