// ชีทแจกฟรี (/free): กรอกอีเมล → ได้ไฟล์ทันทีบนหน้า + ส่งลิงก์เข้าอีเมล + ชวนติดตามเพจ (ไม่บังคับไลก์ ตามกฎ Facebook)
// ไฟล์อยู่ใน src/free (ของแจกฟรี) · รายชื่อคนรับเก็บใน shop_state id=free_leads ใช้ส่งข่าวเล่มใหม่/ชวน VIP
import nodemailer from 'nodemailer';
import { SB_URL } from './shop.js';
import { shell } from './quiz.js';

const SECRET = process.env.SUPABASE_SECRET_KEY || '';
const H = { apikey: SECRET, Authorization: `Bearer ${SECRET}`, 'Content-Type': 'application/json' };
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
export const FB_PAGE = 'https://www.facebook.com/1264839566720049';

export const FREEBIES = [{
  slug: 'toeic-confusing-50', title: 'TOEIC 50 คำศัพท์ที่คนไทยสับสนบ่อยที่สุด', short: 'TOEIC 50 คำศัพท์ที่คนไทยสับสน',
  sub: 'borrow / lend · affect / effect · raise / rise และอีก 47 คู่ พร้อมตัวอย่างประโยคสไตล์ TOEIC',
  points: ['50 คู่คำที่คนไทยใช้สลับกันบ่อย แยกหมวด เงิน ตัวเลข งาน การเดินทาง', 'ความหมายไทย + ตัวอย่างประโยคบริบทที่ทำงาน', 'ช่อง "จุดที่สับสน" สรุปวิธีจำในบรรทัดเดียว', 'แบบฝึกท้ายหมวด และควิซท้ายเล่ม 10 ข้อ'],
  pages: 12, file: 'toeic-confusing-50.pdf', cover: 'toeic-confusing-50.jpg', previews: ['toeic-confusing-50-p3.jpg', 'toeic-confusing-50-p4.jpg'],
  upsell: 'sheet-20c72853', topic: '/topic/toeic-vocabulary', topicName: 'คำศัพท์ TOEIC ทั้งหมด', more: 'อยากได้ศัพท์ครบกว่านี้',
}, { // 🎁 ชีทฟรีเพิ่ม (คุณแดน 22 ต.ค. 69 "ถ้า google ชอบแบบไหนให้ทำแบบนั้น"): ตัดตัวอย่างจากหนังสือจริง ไฟล์อยู่บน R2 (ไม่กินโควตา Vercel)
  slug: 'toeic-listening-free', title: 'ข้อสอบ TOEIC Listening พร้อมเฉลย ชุดที่ 1 (Part 1–4)', short: 'ข้อสอบ TOEIC Listening ชุดที่ 1',
  sub: 'ตัวอย่างฟรีจากหนังสือ TOEIC Listening 10 ชุด: ชุดที่ 1 ครบ Part 1–4 สคริปต์เต็ม เฉลย และคำแปลไทยทุกข้อ',
  points: ['ข้อสอบชุดที่ 1 ครบ Part 1–4 เหมือนสอบจริง', 'สคริปต์เต็มทุกข้อ ใช้ฝึกฟังซ้ำหรือ shadowing', 'เฉลยพร้อมคำแปลไทย บอกจุดที่ผิดบ่อย', 'คู่มือกลยุทธ์ก่อนเริ่มทำข้อสอบ'],
  pages: 28, file: 'https://pub-fdfc380c67f149de994eac621d6b147c.r2.dev/free/toeic-listening-free-set1.pdf', cover: 'https://pub-fdfc380c67f149de994eac621d6b147c.r2.dev/free/toeic-listening-free-set1.jpg', previews: ['https://pub-fdfc380c67f149de994eac621d6b147c.r2.dev/free/toeic-listening-free-set1-p8.jpg', 'https://pub-fdfc380c67f149de994eac621d6b147c.r2.dev/free/toeic-listening-free-set1-p12.jpg'],
  upsell: 'bmupjeg54', topic: '/topic/toeic-listening', topicName: 'TOEIC Listening ทั้งหมด', more: 'อยากได้ครบ 10 ชุดพร้อมไฟล์เสียง',
}, {
  slug: 'ielts-speaking-free', title: 'IELTS Speaking Part 1 & 3 ตัวอย่างคำตอบ 20 ข้อ', short: 'IELTS Speaking ตัวอย่างคำตอบ 20 ข้อ',
  sub: 'ตัวอย่างฟรีจากหนังสือ IELTS Speaking 200 ข้อ: หัวข้อ Home & Hometown 20 คำถาม พร้อมคำตอบ Band 7+ คำแปล และแบบฝึก',
  points: ['20 คำถาม Part 1 และ Part 3 ที่ออกบ่อย', 'คำตอบตัวอย่างระดับ Band 7+ พร้อมคำแปลไทย', 'ไฮไลต์วลีที่ใช้ยกระดับคำตอบ', 'จุดที่คนไทยพูดผิดบ่อย + แบบฝึกท้ายบท'],
  pages: 14, file: 'https://pub-fdfc380c67f149de994eac621d6b147c.r2.dev/free/ielts-speaking-free-20.pdf', cover: 'https://pub-fdfc380c67f149de994eac621d6b147c.r2.dev/free/ielts-speaking-free-20.jpg', previews: ['https://pub-fdfc380c67f149de994eac621d6b147c.r2.dev/free/ielts-speaking-free-20-p6.jpg', 'https://pub-fdfc380c67f149de994eac621d6b147c.r2.dev/free/ielts-speaking-free-20-p8.jpg'],
  upsell: 'pmutotzva26', topic: '/topic/ielts', topicName: 'IELTS ทั้งหมด', more: 'อยากได้ครบ 200 ข้อพร้อมเสียงอ่าน',
}, {
  slug: 'toeic-grammar-free', title: 'สรุป TOEIC Grammar 10 จุดที่คนไทยพลาดบ่อย พร้อมแบบฝึก', short: 'สรุป TOEIC Grammar 10 จุด',
  sub: 'ชีทสรุปแกรมมาร์ TOEIC Part 5–6 จุดละ 1 หน้า ตาราง + ตัวอย่างประโยคสั้น พร้อมคำแปลไทย และเช็กตัวเอง 40 ข้อพร้อมเฉลย',
  points: ['10 จุดแกรมมาร์ที่ออกบ่อยใน Part 5–6', 'กล่อง "คนไทยใช้ผิดบ่อย" ✗ → ✓ ทุกจุด', 'เทคนิคดูช่องว่างแล้วตอบได้ในไม่กี่วินาที', 'แบบฝึกเช็กตัวเอง 40 ข้อ เฉลยทุกข้อ'],
  pages: 16, file: 'https://pub-fdfc380c67f149de994eac621d6b147c.r2.dev/free/toeic-grammar-free-10.pdf', cover: 'https://pub-fdfc380c67f149de994eac621d6b147c.r2.dev/free/toeic-grammar-free-10.jpg', previews: ['https://pub-fdfc380c67f149de994eac621d6b147c.r2.dev/free/toeic-grammar-free-10-p3.jpg', 'https://pub-fdfc380c67f149de994eac621d6b147c.r2.dev/free/toeic-grammar-free-10-p5.jpg'],
  upsell: 'pmuh1nwlq', topic: '/topic/toeic-grammar', topicName: 'แกรมมาร์ TOEIC ทั้งหมด', more: 'อยากได้แบบฝึกครบ 500 ข้อ',
}];
export const freeBySlug = (s) => FREEBIES.find((f) => f.slug === s) || null;
// ไฟล์/รูปของชีทฟรี: ลิงก์เต็ม (R2) ใช้ตรง · ชื่อไฟล์เฉยๆ = ไฟล์ใน src/free เสิร์ฟผ่าน /free-file /free-img
export const freeFileUrl = (f, origin = '') => /^https:\/\//.test(f.file) ? f.file : `${origin}/free-file/${f.file}`;
const freeImg = (n, origin = '') => /^https:\/\//.test(n) ? n : `${origin}/free-img/${n}`;
export const okEmail = (e) => typeof e === 'string' && e.length <= 120 && /^[^\s@,()<>|]+@[^\s@,()<>|]+\.[a-z]{2,}$/i.test(e);

async function loadLeads() { const r = await fetch(`${SB_URL}/rest/v1/shop_state?id=eq.free_leads&select=data`, { headers: H }); const j = r.ok ? await r.json() : []; return j?.[0]?.data?.list || []; }
async function saveLeads(list) { await fetch(`${SB_URL}/rest/v1/shop_state?on_conflict=id`, { method: 'POST', headers: { ...H, Prefer: 'resolution=merge-duplicates,return=minimal' }, body: JSON.stringify([{ id: 'free_leads', data: { list: list.slice(-5000) }, updated_at: new Date().toISOString() }]) }); }
export async function freeStats(days = 7) { const L = await loadLeads(); const cut = Date.now() - days * 864e5; return { total: L.length, recent: L.filter((x) => Date.parse(x.at) > cut).length, bySrc: Object.entries(L.filter((x) => Date.parse(x.at) > cut).reduce((m, x) => { m[x.src || 'direct'] = (m[x.src || 'direct'] || 0) + 1; return m; }, {})).map(([k, n]) => ({ k, n })) }; }

// คนขอไฟล์: บันทึก (คนเดิมขอซ้ำใน 10 นาทีไม่ส่งอีเมลซ้ำ) แล้วส่งอีเมล
export async function claimFree(f, email, { src = '', origin = 'https://sheetlabth.com', force = false } = {}) {
  const L = await loadLeads(); const now = Date.now();
  const old = L.find((x) => x.email === email && x.slug === f.slug);
  if (old && !force && now - Date.parse(old.at) < 10 * 60e3) return { ok: true, again: true };
  if (old) old.at = new Date(now).toISOString(); else L.push({ email, slug: f.slug, src: String(src).slice(0, 40), at: new Date(now).toISOString() });
  await saveLeads(L);
  const file = freeFileUrl(f, origin);
  const html = `<!doctype html><html lang="th"><body style="margin:0;background:#EDF1F7;font-family:-apple-system,'IBM Plex Sans Thai','Noto Sans Thai',Segoe UI,Roboto,sans-serif;color:#0F1B33"><div style="max-width:520px;margin:0 auto;padding:24px 16px"><div style="background:#fff;border-radius:16px;padding:26px 22px">
<p style="font-size:13px;color:#56637D;margin:0 0 6px">SheetLab · ชีทแจกฟรี</p><h1 style="font-size:21px;margin:0 0 12px">${esc(f.title)} 🎁</h1>
<p style="margin:0 0 14px">ไฟล์ PDF ${f.pages} หน้า เปิดได้ทั้งมือถือและคอม หรือพิมพ์ออกมาใช้ได้</p>
<p style="margin:0 0 18px"><a href="${file}" style="display:inline-block;background:#FFD23F;color:#0F1B33;font-weight:700;text-decoration:none;padding:13px 22px;border-radius:12px">⬇ ดาวน์โหลดชีท</a></p>
<p style="margin:0 0 8px">ถ้าชอบชีทนี้ ฝากกดติดตามเพจ SheetLab ไว้นะคะ จะได้เห็นชีทฟรีเล่มใหม่และข้อสอบประจำวันก่อนใคร</p>
<p style="margin:0 0 18px"><a href="${FB_PAGE}" style="display:inline-block;background:#1877F2;color:#fff;font-weight:700;text-decoration:none;padding:11px 18px;border-radius:12px">👍 ติดตามเพจ SheetLab</a></p>
<p style="margin:0;font-size:14px">ฝึกต่อฟรี: <a href="${origin}${f.topic}">${esc(f.topicName || 'บทความทั้งหมด')}</a> · <a href="${origin}/quiz">คลังข้อสอบพร้อมเฉลย</a></p>
</div><p style="font-size:12px;color:#56637D;text-align:center">ได้รับอีเมลนี้เพราะขอรับชีทฟรีที่ sheetlabth.com ไม่ต้องการรับข่าวสาร ตอบกลับอีเมลนี้ได้เลย</p></div></body></html>`;
  await nodemailer.createTransport({ service: 'gmail', auth: { user: process.env.GMAIL_USER, pass: (process.env.GMAIL_APP_PASSWORD || '').replace(/\s+/g, '') } })
    .sendMail({ from: `"SheetLab" <${process.env.GMAIL_USER}>`, to: email, subject: `🎁 ชีทฟรี: ${f.short}`, text: `ดาวน์โหลด: ${file}\nติดตามเพจ SheetLab: ${FB_PAGE}`, html });
  return { ok: true };
}

export function freePage(f, { settings = {}, site = '', upsell = null } = {}) {
  const img = (n) => freeImg(n);
  const body = `<section class="card fr-hero"><img class="fr-cover" src="${img(f.cover)}" alt="ปก ${esc(f.title)}" width="600" height="848" fetchpriority="high"><div><span class="chip">🎁 ชีทแจกฟรี</span><h1>${esc(f.title)}</h1><p>${esc(f.sub)}</p>
<ul class="fr-pts">${f.points.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>
<form class="vp-form fr-form" id="fr-form"><input type="email" required placeholder="อีเมลของคุณ (เช่น name@gmail.com)" aria-label="อีเมล" id="fr-email"><button>รับชีทฟรี</button></form>
<p class="fine" style="margin:6px 0 0">ได้ไฟล์ทันทีบนหน้านี้ และส่งลิงก์เข้าอีเมลให้เก็บไว้ ฟรี ไม่ต้องสมัครสมาชิก</p><div id="fr-done" hidden></div></div></section>
<section class="card"><h2>ตัวอย่างข้างใน</h2><div class="fr-pv">${f.previews.map((p) => `<img src="${img(p)}" alt="ตัวอย่างหน้าในชีท" loading="lazy">`).join('')}</div></section>
${upsell ? `<a class="card cta" href="/p/${esc(upsell.slug)}?utm_campaign=free-${esc(f.slug)}">${(upsell.images || [])[0] ? `<img src="${esc(upsell.images[0])}" alt="" loading="lazy">` : '<span></span>'}<span><span class="fine">${esc(f.more || 'อยากได้ฉบับเต็ม')}</span><br><b>${esc(upsell.name)}</b><br>${Number(upsell.price) >= 1 ? `<strong>฿${Number(upsell.price).toLocaleString('th-TH')}</strong> ` : ''}<span class="btn">ดูตัวอย่างก่อนซื้อ</span></span></a>` : ''}
<section class="card"><h2>ฝึกต่อฟรี</h2><p><a href="/free">ชีทแจกฟรีทั้งหมด</a> · <a href="${f.topic}">${esc(f.topicName || 'บทความทั้งหมด')}</a> · <a href="/quiz">คลังข้อสอบพร้อมเฉลย</a> · <a href="/learn">คลังความรู้</a></p></section>
<script>(function(){var f=document.getElementById('fr-form'),d=document.getElementById('fr-done');f.onsubmit=function(e){e.preventDefault();var b=f.querySelector('button'),em=document.getElementById('fr-email').value.trim();b.disabled=true;b.textContent='กำลังส่ง...';
fetch('/api/order?m=free',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({slug:${JSON.stringify(f.slug)},email:em,src:(function(){try{return sessionStorage.getItem('sl_src0')||''}catch(x){return ''}})()})}).then(function(r){return r.json();}).then(function(j){
if(!j.ok){b.disabled=false;b.textContent='รับชีทฟรี';alert(j.error||'ส่งไม่สำเร็จ ลองใหม่');return;}if(window.slTrack)slTrack('click','free-claim');
f.hidden=true;d.hidden=false;d.innerHTML='<p class="vp-ok">ส่งลิงก์ไปที่ '+em.replace(/[<>&"]/g,'')+' แล้ว 🎉 (ถ้าไม่เห็น ดูในจดหมายขยะ)</p><div class="vp-act"><a class="btn" href="'+j.file+'" download data-ev="free-download">⬇ ดาวน์โหลดเลย</a><a class="btn fr-fb" href="${FB_PAGE}" target="_blank" rel="noopener" data-ev="free-follow">👍 ติดตามเพจ SheetLab</a></div><p class="fine" style="margin:6px 0 0">ติดตามเพจไว้ จะได้เห็นชีทฟรีเล่มใหม่ก่อนใคร</p>';}).catch(function(){b.disabled=false;b.textContent='รับชีทฟรี';alert('เชื่อมต่อไม่ได้ ลองใหม่');});};})();</script>`;
  return shell({ title: `แจกฟรี ${f.title} PDF · SheetLab`, desc: `ดาวน์โหลดฟรี ${f.title} ${f.sub}`, canonical: `${site}/free/${f.slug}`, body, pixelId: settings.pixelId, tab: 'free', image: freeImg(f.cover, site) });
}
// หน้ารวมชีทแจกฟรี /free (คนค้น "…pdf ฟรี") · แต่ละเล่มมีหน้าของตัวเอง /free/<slug>
export function freeListPage({ settings = {}, site = '' } = {}) {
  const body = `<section class="card"><span class="chip">🎁 ชีทแจกฟรี</span><h1>ชีทสรุป TOEIC IELTS PDF แจกฟรี</h1><p>ดาวน์โหลดฟรี ${FREEBIES.length} ชุด ข้อสอบพร้อมเฉลย สรุปแกรมมาร์ คำศัพท์ และตัวอย่างคำตอบ IELTS Speaking กรอกอีเมลแล้วได้ไฟล์ทันที ไม่ต้องสมัครสมาชิก</p></section>
${FREEBIES.map((f) => `<a class="card fr-hero" href="/free/${esc(f.slug)}" style="text-decoration:none;color:inherit"><img class="fr-cover" src="${freeImg(f.cover)}" alt="ปก ${esc(f.title)}" width="600" height="848" loading="lazy"><div><h2 style="margin:0 0 6px">${esc(f.title)}</h2><p>${esc(f.sub)}</p><p class="fine">PDF ${f.pages} หน้า</p><span class="btn">รับฟรี</span></div></a>`).join('')}
<section class="card"><h2>ฝึกต่อฟรี</h2><p><a href="/quiz">คลังข้อสอบพร้อมเฉลย</a> · <a href="/learn">คลังความรู้</a> · <a href="/store">ร้านชีทฉบับเต็ม</a></p></section>`;
  return shell({ title: 'ชีทสรุป TOEIC IELTS PDF แจกฟรี ข้อสอบพร้อมเฉลย · SheetLab', desc: `ดาวน์โหลดฟรี ${FREEBIES.map((f) => f.short).join(' · ')} ไฟล์ PDF กรอกอีเมลได้ไฟล์ทันที`, canonical: `${site}/free`, body, pixelId: settings.pixelId, tab: 'free', image: freeImg(FREEBIES[0].cover, site) });
}
