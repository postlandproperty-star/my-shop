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
  upsell: 'sheet-20c72853', topic: '/topic/toeic-vocabulary',
}];
export const freeBySlug = (s) => FREEBIES.find((f) => f.slug === s) || null;
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
  const file = `${origin}/free-file/${f.file}`;
  const html = `<!doctype html><html lang="th"><body style="margin:0;background:#EDF1F7;font-family:-apple-system,'IBM Plex Sans Thai','Noto Sans Thai',Segoe UI,Roboto,sans-serif;color:#0F1B33"><div style="max-width:520px;margin:0 auto;padding:24px 16px"><div style="background:#fff;border-radius:16px;padding:26px 22px">
<p style="font-size:13px;color:#56637D;margin:0 0 6px">SheetLab · ชีทแจกฟรี</p><h1 style="font-size:21px;margin:0 0 12px">${esc(f.title)} 🎁</h1>
<p style="margin:0 0 14px">ไฟล์ PDF ${f.pages} หน้า เปิดได้ทั้งมือถือและคอม หรือพิมพ์ออกมาใช้ได้</p>
<p style="margin:0 0 18px"><a href="${file}" style="display:inline-block;background:#FFD23F;color:#0F1B33;font-weight:700;text-decoration:none;padding:13px 22px;border-radius:12px">⬇ ดาวน์โหลดชีท</a></p>
<p style="margin:0 0 8px">ถ้าชอบชีทนี้ ฝากกดติดตามเพจ SheetLab ไว้นะคะ จะได้เห็นชีทฟรีเล่มใหม่และข้อสอบประจำวันก่อนใคร</p>
<p style="margin:0 0 18px"><a href="${FB_PAGE}" style="display:inline-block;background:#1877F2;color:#fff;font-weight:700;text-decoration:none;padding:11px 18px;border-radius:12px">👍 ติดตามเพจ SheetLab</a></p>
<p style="margin:0;font-size:14px">ฝึกต่อฟรี: <a href="${origin}${f.topic}">คำศัพท์ TOEIC ทั้งหมด</a> · <a href="${origin}/quiz">คลังข้อสอบพร้อมเฉลย</a></p>
</div><p style="font-size:12px;color:#56637D;text-align:center">ได้รับอีเมลนี้เพราะขอรับชีทฟรีที่ sheetlabth.com ไม่ต้องการรับข่าวสาร ตอบกลับอีเมลนี้ได้เลย</p></div></body></html>`;
  await nodemailer.createTransport({ service: 'gmail', auth: { user: process.env.GMAIL_USER, pass: (process.env.GMAIL_APP_PASSWORD || '').replace(/\s+/g, '') } })
    .sendMail({ from: `"SheetLab" <${process.env.GMAIL_USER}>`, to: email, subject: `🎁 ชีทฟรี: ${f.short}`, text: `ดาวน์โหลด: ${file}\nติดตามเพจ SheetLab: ${FB_PAGE}`, html });
  return { ok: true };
}

export function freePage(f, { settings = {}, site = '', upsell = null } = {}) {
  const img = (n) => `/free-img/${n}`;
  const body = `<section class="card fr-hero"><img class="fr-cover" src="${img(f.cover)}" alt="ปก ${esc(f.title)}" width="600" height="848" fetchpriority="high"><div><span class="chip">🎁 ชีทแจกฟรี</span><h1>${esc(f.title)}</h1><p>${esc(f.sub)}</p>
<ul class="fr-pts">${f.points.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>
<form class="vp-form fr-form" id="fr-form"><input type="email" required placeholder="อีเมลของคุณ (เช่น name@gmail.com)" aria-label="อีเมล" id="fr-email"><button>รับชีทฟรี</button></form>
<p class="fine" style="margin:6px 0 0">ได้ไฟล์ทันทีบนหน้านี้ และส่งลิงก์เข้าอีเมลให้เก็บไว้ ฟรี ไม่ต้องสมัครสมาชิก</p><div id="fr-done" hidden></div></div></section>
<section class="card"><h2>ตัวอย่างข้างใน</h2><div class="fr-pv">${f.previews.map((p) => `<img src="${img(p)}" alt="ตัวอย่างหน้าในชีท" loading="lazy">`).join('')}</div></section>
${upsell ? `<a class="card cta" href="/p/${esc(upsell.slug)}?utm_campaign=free-${esc(f.slug)}">${(upsell.images || [])[0] ? `<img src="${esc(upsell.images[0])}" alt="" loading="lazy">` : '<span></span>'}<span><span class="fine">อยากได้ศัพท์ครบกว่านี้</span><br><b>${esc(upsell.name)}</b><br>${Number(upsell.price) >= 1 ? `<strong>฿${Number(upsell.price).toLocaleString('th-TH')}</strong> ` : ''}<span class="btn">ดูตัวอย่างก่อนซื้อ</span></span></a>` : ''}
<section class="card"><h2>ฝึกต่อฟรี</h2><p><a href="${f.topic}">คำศัพท์ TOEIC ทั้งหมด</a> · <a href="/quiz">คลังข้อสอบพร้อมเฉลย</a> · <a href="/learn">คลังความรู้</a></p></section>
<script>(function(){var f=document.getElementById('fr-form'),d=document.getElementById('fr-done');f.onsubmit=function(e){e.preventDefault();var b=f.querySelector('button'),em=document.getElementById('fr-email').value.trim();b.disabled=true;b.textContent='กำลังส่ง...';
fetch('/api/order?m=free',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({slug:${JSON.stringify(f.slug)},email:em,src:(function(){try{return sessionStorage.getItem('sl_src0')||''}catch(x){return ''}})()})}).then(function(r){return r.json();}).then(function(j){
if(!j.ok){b.disabled=false;b.textContent='รับชีทฟรี';alert(j.error||'ส่งไม่สำเร็จ ลองใหม่');return;}if(window.slTrack)slTrack('click','free-claim');
f.hidden=true;d.hidden=false;d.innerHTML='<p class="vp-ok">ส่งลิงก์ไปที่ '+em.replace(/[<>&"]/g,'')+' แล้ว 🎉 (ถ้าไม่เห็น ดูในจดหมายขยะ)</p><div class="vp-act"><a class="btn" href="'+j.file+'" download data-ev="free-download">⬇ ดาวน์โหลดเลย</a><a class="btn fr-fb" href="${FB_PAGE}" target="_blank" rel="noopener" data-ev="free-follow">👍 ติดตามเพจ SheetLab</a></div><p class="fine" style="margin:6px 0 0">ติดตามเพจไว้ จะได้เห็นชีทฟรีเล่มใหม่ก่อนใคร</p>';}).catch(function(){b.disabled=false;b.textContent='รับชีทฟรี';alert('เชื่อมต่อไม่ได้ ลองใหม่');});};})();</script>`;
  return shell({ title: `แจกฟรี ${f.title} PDF · SheetLab`, desc: `ดาวน์โหลดฟรี ${f.title} ${f.sub}`, canonical: `${site}/free/${f.slug}`, body, pixelId: settings.pixelId, tab: 'free', image: `${site}/free-img/${f.cover}` });
}
