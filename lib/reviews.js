// รีวิวจากผู้ซื้อจริง: อีเมลขอรีวิว 1 วันหลังจ่าย (cron วันละครั้ง) → หน้า /review (ลิงก์มีลายเซ็นต่อออเดอร์ ไม่ต้องล็อกอิน)
// → ขึ้นหน้าขาย/หน้าร้านทันที คุณแดนซ่อนรีวิวไหนก็ได้ในแท็บสินค้า · เก็บใน shop_state reviews {list, sent}
import nodemailer from 'nodemailer';
import { createHmac } from 'node:crypto';
import { SB_URL, loadShop, loadTestEmails, sbSelect, stripe, piToSession } from './shop.js';
import { mailConfigured } from './mail.js';
import { siteUrl } from './site.js';

const SECRET = process.env.SUPABASE_SECRET_KEY || '';
const hdr = { apikey: SECRET, Authorization: `Bearer ${SECRET}`, 'Content-Type': 'application/json' };
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export const reviewToken = (sessionId) => createHmac('sha256', `review:${SECRET}`).update(String(sessionId)).digest('hex').slice(0, 24);
export const previewToken = (sessionId) => 'pv' + createHmac('sha256', `review-preview:${SECRET}`).update(String(sessionId)).digest('hex').slice(0, 22);
export const previewOk = (sessionId, t) => !!sessionId && !!SECRET && previewToken(sessionId) === String(t || '');
export const tokenOk = (sessionId, t) => !!sessionId && !!SECRET && reviewToken(sessionId) === String(t || '');

export async function loadReviews() {
  const r = await fetch(`${SB_URL}/rest/v1/shop_state?id=eq.reviews&select=data`, { headers: hdr });
  const j = r.ok ? await r.json() : [];
  const d = j?.[0]?.data || {}; return { list: d.list || [], sent: d.sent || {} };
}
export async function saveReviews(d) {
  await fetch(`${SB_URL}/rest/v1/shop_state?on_conflict=id`, { method: 'POST', headers: { ...hdr, Prefer: 'resolution=merge-duplicates,return=minimal' }, body: JSON.stringify([{ id: 'reviews', data: { list: d.list.slice(-2000), sent: d.sent }, updated_at: '2000-01-01T00:00:00Z' }]) });
}
// สรุปต่อสินค้า (เฉพาะรีวิวที่ไม่ได้ซ่อน) สำหรับหน้าเว็บ
export function reviewSummary(list, perProduct = 20) {
  const out = {};
  for (const r of list.filter((x) => x.status !== 'hidden').sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))) {
    const o = out[r.product_id] || (out[r.product_id] = { sum: 0, count: 0, items: [] });
    o.sum += r.stars; o.count++;
    if (o.items.length < perProduct) o.items.push({ name: r.name, stars: r.stars, text: r.text, em: r.email_mask || '', at: String(r.created_at).slice(0, 10) });
  }
  for (const k of Object.keys(out)) { out[k].avg = Math.round((out[k].sum / out[k].count) * 10) / 10; delete out[k].sum; }
  return out;
}
// อีเมลแบบปิดบังครึ่งหนึ่ง (ไม่เกิน 4 ตัวแรก) ไว้แสดงคู่รีวิวยืนยันว่าเป็นผู้ซื้อจริง โดเมนบริษัท/โรงเรียนปิดด้วย เหลือแค่นามสกุลโดเมน
const FREE_MAIL = /^(gmail|googlemail|hotmail|outlook|live|yahoo|icloud|me|msn|proton|protonmail)\./i;
export const maskEmail = (e) => { const m = String(e || '').trim().toLowerCase().match(/^([^@\s]+)@([^@\s]+\.[^@\s]+)$/); if (!m) return ''; const u = m[1], d = m[2]; const k = Math.max(1, Math.min(4, Math.floor(u.length / 2))); return u.slice(0, k) + '•••@' + (FREE_MAIL.test(d) ? d : '•••' + d.slice(d.lastIndexOf('.'))); };
export const displayName = (n) => { const p = String(n || '').trim().split(/\s+/).filter(Boolean); if (!p.length || /ไม่ระบุ/.test(p[0])) return 'ผู้ซื้อ'; return p[0].slice(0, 20) + (p[1] ? ' ' + p[1][0] + '.' : ''); };

// ทุกเล่มในออเดอร์ (ตะกร้า / สินค้าคู่ / ชุด) จากข้อมูลที่ Stripe เก็บไว้ · ดึงไม่ได้ใช้สินค้าหลักของออเดอร์
export async function orderProducts(sessionId, fallbackId = '') {
  try {
    const id = String(sessionId || '');
    const s = id.startsWith('pi_') ? piToSession(await stripe('GET', `payment_intents/${id}`)) : await stripe('GET', `checkout/sessions/${id}`);
    const m = s.metadata || {};
    const ids = m.cart ? String(m.cart).split(',').filter(Boolean) : [m.productId, m.bumpProductId].filter(Boolean);
    if (ids.length) return [...new Set(ids)];
  } catch (e) { console.error('orderProducts', e.message); }
  return fallbackId ? [fallbackId] : [];
}

// products = [{id, name, existing}] ทุกเล่มในออเดอร์ ให้ดาว/ความเห็นแยกเล่ม (เล่มที่ไม่กดดาวไม่ส่ง)
export function reviewPage({ products, order, token, stars, site, mask = '', preview = false }) {
  if (preview) products = products.map((p) => ({ ...p, existing: null })); // ตัวอย่าง: ไม่โชว์รีวิวจริงของลูกค้า
  const ex = products.map((p) => p.existing).filter(Boolean);
  const showEm = ex.length ? ex.some((x) => !!x.email_mask) : true;
  const s0 = Math.min(5, Math.max(0, Number(stars) || 0));
  const nm = ex.length ? ex[0].name : displayName(order.name);
  const many = products.length > 1;
  const title = many ? `${products.length} เล่มที่คุณซื้อ` : (products[0] || {}).name || 'สินค้า';
  return `<!doctype html><html lang="th"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="icon" href="/favicon.ico" sizes="any"><link rel="icon" type="image/png" sizes="32x32" href="/icon-32.png"><link rel="icon" type="image/png" sizes="192x192" href="/icon-192.png"><link rel="apple-touch-icon" href="/apple-touch-icon.png"><meta name="theme-color" content="#2440E8"><meta name="robots" content="noindex">
<title>รีวิว ${esc(title)} · SheetLab</title>
<link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Thai:wght@400;600&display=swap" rel="stylesheet">
<style>body{margin:0;background:#EDF1F7;font-family:'IBM Plex Sans Thai',-apple-system,sans-serif;color:#0F1B33}.w{max-width:520px;margin:0 auto;padding:24px 16px}.c{background:#fff;border-radius:16px;padding:22px}h1{font-size:21px;margin:0 0 6px}p{margin:0 0 10px;line-height:1.6}
.it{border:1.5px solid #D3DBE8;border-radius:14px;padding:14px;margin:12px 0}.it h2{font-size:16px;margin:0;line-height:1.45}
.st{display:flex;gap:6px;margin:8px 0 10px}.st button{font-size:36px;line-height:1;background:none;border:0;cursor:pointer;color:#D3DBE8;padding:2px}.st button.on{color:#F5B301}
label{display:block;font-weight:600;font-size:14px;margin:10px 0 4px}.ck{display:flex;gap:8px;align-items:flex-start;font-weight:400;font-size:14px;line-height:1.5;margin-top:12px}.ck input{width:auto;margin-top:4px}textarea,input:not([type=checkbox]){width:100%;box-sizing:border-box;font:inherit;border:1.5px solid #D3DBE8;border-radius:12px;padding:10px 12px}textarea{min-height:${many ? 80 : 110}px}
.btn{display:block;width:100%;margin-top:14px;background:#FFD23F;color:#0F1B33;font:inherit;font-weight:700;border:0;border-radius:12px;padding:13px;cursor:pointer}.f{font-size:13px;color:#56637D}.ok{background:#E7F7EE;border-radius:12px;padding:14px;margin-top:12px;display:none}</style></head>
<body><div class="w">${preview ? '<p style="background:#FCEBC8;color:#8A5300;border-radius:12px;padding:10px 14px;margin:0 0 12px;font-size:14px">หน้าตัวอย่างสำหรับคุณแดน · กดส่งไม่ได้ ลูกค้าจะเห็นหน้าแบบนี้จากลิงก์ในอีเมล</p>' : ''}<div class="c">
<p class="f">SheetLab · รีวิวจากผู้ซื้อจริง</p>
<h1>${esc(title)} เป็นยังไงบ้าง</h1>
<p>ให้คะแนนและเล่าสั้นๆ ช่วยให้คนที่กำลังตัดสินใจรู้ว่าเหมาะกับเขาไหม${many ? ' ให้ดาวเฉพาะเล่มที่ได้ลองแล้วก็ได้' : ''}${ex.length ? ' (คุณรีวิวไว้แล้ว แก้ไขได้)' : ''}</p>
${products.map((p, i) => { const e = p.existing, s = e ? e.stars : s0; return `<div class="it" data-pid="${esc(p.id)}" data-s="${s}">${many ? `<h2>${esc(p.name)}</h2>` : ''}
<div class="st" role="radiogroup" aria-label="ให้คะแนน ${esc(p.name)}">${[1, 2, 3, 4, 5].map((n) => `<button type="button" data-s="${n}" aria-label="${n} ดาว" class="${n <= s ? 'on' : ''}">★</button>`).join('')}</div>
<label for="tx${i}">ความเห็น (ไม่บังคับ)</label><textarea id="tx${i}" maxlength="500" placeholder="เช่น อ่านง่าย เฉลยละเอียด ช่วยให้ทำ Part 5 เร็วขึ้น">${esc(e ? e.text : '')}</textarea></div>`; }).join('')}
<label for="nm">ชื่อที่แสดง</label><input id="nm" maxlength="30" value="${esc(nm)}">
${mask ? `<label class="ck"><input type="checkbox" id="se" ${showEm ? 'checked' : ''}><span>แสดงอีเมลแบบปิดบังบางส่วน <b>${esc(mask)}</b> คู่กับรีวิว ให้คนอื่นรู้ว่ามาจากผู้ซื้อจริง</span></label>` : ''}
<p class="f" style="margin-top:6px">รีวิวจะแสดงบนหน้าร้านพร้อมป้าย "ผู้ซื้อจริง" ไม่มีการแสดงอีเมลเต็ม</p>
<p class="f" style="background:#FFF7D6;border-radius:10px;padding:8px 10px;color:#0F1B33">🎁 รีวิวแล้วรับโค้ดลด 20% สำหรับเล่มถัดไป เป็นการขอบคุณ ให้กี่ดาวก็ได้ตามจริง</p>
<button class="btn" id="go" ${preview ? 'disabled style="opacity:.5;cursor:not-allowed"' : ''}>${preview ? 'ส่งรีวิว (ตัวอย่าง กดไม่ได้)' : 'ส่งรีวิว'}</button>
<div class="ok" id="ok">ขอบคุณมากครับ รีวิวของคุณขึ้นหน้าร้านแล้ว 🙏<div id="rw"></div><a href="${esc(site)}">เลือกเล่มถัดไปที่หน้าร้าน →</a></div>
<p class="f" id="er" style="color:#B42318;margin-top:8px"></p>
</div></div>
<script>(function(){var its=document.querySelectorAll('.it');
its.forEach(function(it){var b=it.querySelectorAll('.st button');b.forEach(function(x){x.addEventListener('click',function(){it.dataset.s=x.dataset.s;b.forEach(function(y){y.className=Number(y.dataset.s)<=Number(it.dataset.s)?'on':'';});});});});
document.getElementById('go').addEventListener('click',function(){var er=document.getElementById('er'),items=[];
its.forEach(function(it){var s=Number(it.dataset.s)||0;if(s)items.push({pid:it.dataset.pid,stars:s,text:it.querySelector('textarea').value});});
if(!items.length){er.textContent='กดเลือกดาวก่อนนะครับ';return;}this.disabled=true;
fetch('/api/content?action=review_submit',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({o:${JSON.stringify(order.session_id)},t:${JSON.stringify(token)},items:items,name:document.getElementById('nm').value,showEmail:!!(document.getElementById('se')&&document.getElementById('se').checked)})})
.then(function(r){return r.json();}).then(function(j){if(j.ok){if(j.reward){var rw=document.getElementById('rw');rw.innerHTML='<p style="margin:10px 0;background:#fff;border:2px dashed #F5B301;border-radius:12px;padding:12px;text-align:center">🎁 โค้ดขอบคุณ ลด '+j.reward.pct+'% เล่มถัดไป<br><b style="font-size:24px;letter-spacing:2px">'+j.reward.code+'</b><br><span style="font-size:13px;color:#56637D">ใช้ได้ 1 ครั้ง ภายใน 30 วัน · ตอนจ่ายกด "มีโค้ดส่วนลด" แล้วใส่โค้ดนี้ · ส่งไปที่อีเมลของคุณด้วยแล้ว</span></p>';}document.getElementById('ok').style.display='block';document.getElementById('go').style.display='none';er.textContent='';}else{er.textContent=j.error||'ส่งไม่สำเร็จ';document.getElementById('go').disabled=false;}})
.catch(function(){er.textContent='เชื่อมต่อไม่ได้ ลองใหม่อีกครั้ง';document.getElementById('go').disabled=false;});});})();</script>
</body></html>`;
}

function buildReviewEmail({ shop, product, link, settings, items = [] }) {
  const subject = `${product} เป็นยังไงบ้าง ช่วยรีวิวสั้นๆ ได้ไหม (30 วินาที)`;
  const star = (n) => `<a href="${esc(link)}&s=${n}" style="font-size:30px;color:#F5B301;text-decoration:none;padding:0 2px">${'★'.repeat(n)}</a>`;
  const html = `<!doctype html><html lang="th"><body style="margin:0;background:#EDF1F7;font-family:-apple-system,'IBM Plex Sans Thai','Noto Sans Thai',Segoe UI,Roboto,sans-serif;color:#0F1B33">
  <div style="max-width:560px;margin:0 auto;padding:24px 16px"><div style="background:#fff;border-radius:16px;padding:28px 24px">
    <p style="font-size:13px;color:#56637D;margin:0 0 6px">${esc(shop)}</p>
    <h1 style="font-size:21px;margin:0 0 12px">${esc(product)} เป็นยังไงบ้าง</h1>
    <p style="margin:0 0 10px">ขอบคุณที่อุดหนุนนะครับ ถ้าได้ลองอ่านแล้ว ช่วยกดให้ดาวสั้นๆ หน่อยได้ไหม รีวิวของคุณช่วยให้คนที่กำลังเตรียมสอบตัดสินใจได้ง่ายขึ้นมาก</p>
    ${items.length > 1 ? `<ul style="margin:0 0 12px;padding-left:20px">${items.map((n) => `<li>${esc(n)}</li>`).join('')}</ul><p style="margin:0 0 10px;font-size:14px;color:#56637D">ในหน้ารีวิวให้ดาวแยกได้ทีละเล่ม</p>` : ''}
    <p style="margin:0 0 4px;font-weight:600">กดดาวที่ตรงกับความรู้สึกได้เลย</p>
    <p style="margin:0 0 4px">${star(5)}</p><p style="margin:0 0 4px">${star(4)}</p><p style="margin:0 0 4px">${star(3)}</p><p style="margin:0 0 4px">${star(2)}</p><p style="margin:0 0 10px">${star(1)}</p>
    <p style="margin:0 0 12px;background:#FFF7D6;border-radius:10px;padding:10px 12px;font-size:14px">🎁 รีวิวแล้วรับโค้ดลด 20% สำหรับเล่มถัดไป เป็นการขอบคุณ ให้กี่ดาวก็ได้ตามจริง</p>
    <p style="margin:0"><a href="${esc(link)}" style="display:inline-block;background:#FFD23F;color:#0F1B33;font-weight:700;text-decoration:none;padding:12px 20px;border-radius:12px">เขียนรีวิว</a></p>
    ${settings.chatLink ? `<p style="font-size:14px;margin:14px 0 0">มีตรงไหนไม่ตรงใจหรือเปิดไฟล์ไม่ได้ <a href="${esc(settings.chatLink)}" style="color:#2440E8">ทักแชทหาร้าน</a> ช่วยแก้ให้ก่อนครับ</p>` : ''}
    <p style="font-size:12px;color:#56637D;margin:18px 0 0">อีเมลนี้ส่งครั้งเดียวต่อคำสั่งซื้อ ถ้าไม่สะดวกรีวิว ไม่ต้องทำอะไร</p>
  </div></div></body></html>`;
  const text = `${shop}\n${product} เป็นยังไงบ้าง\nขอบคุณที่อุดหนุนครับ ช่วยให้ดาวและรีวิวสั้นๆ ได้ที่: ${link}\n\nอีเมลนี้ส่งครั้งเดียวต่อคำสั่งซื้อ`;
  return { subject, html, text };
}

// คุณแดนกดส่งเองจากแท็บออเดอร์: ถึงลูกค้า (บันทึกว่าส่งแล้ว รอบอัตโนมัติจะไม่ส่งซ้ำ) หรือถึงอีเมลตัวเองเพื่อดูหน้าตา
export async function sendReviewTo(sessionId, to, { mark = false } = {}) {
  if (!mailConfigured()) throw new Error('ยังไม่ได้ตั้งค่า GMAIL_USER / GMAIL_APP_PASSWORD บน Vercel');
  const [rows, shop, site, rv] = await Promise.all([sbSelect(`orders?session_id=eq.${encodeURIComponent(sessionId)}&status=eq.paid&select=session_id,email,product_id,product_name`), loadShop(), siteUrl(), loadReviews()]);
  const o = rows?.[0]; if (!o) throw new Error('ไม่พบออเดอร์ที่จ่ายแล้ว');
  const email = String(to || o.email || '').trim(); if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('ไม่มีอีเมลปลายทาง');
  const names = (await orderProducts(o.session_id, o.product_id)).map((id) => shop.products.find((x) => x.id === id)?.name).filter(Boolean);
  const link = `${site}/review?o=${encodeURIComponent(o.session_id)}&t=${reviewToken(o.session_id)}`;
  const { subject, html, text } = buildReviewEmail({ shop: shop.settings.shopName || 'SheetLab', product: names.length > 1 ? `${names.length} เล่มที่คุณซื้อ` : names[0] || o.product_name, items: names, link, settings: shop.settings });
  const transport = nodemailer.createTransport({ service: 'gmail', auth: { user: process.env.GMAIL_USER, pass: (process.env.GMAIL_APP_PASSWORD || '').replace(/\s+/g, '') } });
  await transport.sendMail({ from: `"${(shop.settings.shopName || 'SheetLab').replace(/"/g, '')}" <${process.env.GMAIL_USER}>`, to: email, subject: mark ? subject : `[ทดสอบ] ${subject}`, text, html });
  if (mark) { rv.sent[o.session_id] = new Date().toISOString(); await saveReviews(rv); }
  return { ok: true, to: email.replace(/^(.).*(@.*)$/, '$1***$2') };
}

// ส่งอีเมลขอรีวิวให้ออเดอร์ที่จ่ายแล้ว 1-10 วันก่อน (ครั้งเดียวต่อออเดอร์ ข้ามอีเมลทดสอบของคุณแดน) รอบละไม่เกิน 30 ฉบับ
export async function sendReviewRequests({ dry = false } = {}) {
  if (!mailConfigured() && !dry) return { ok: false, skipped: 'mail not configured' };
  const from = new Date(Date.now() - 10 * 864e5).toISOString(), to = new Date(Date.now() - 1 * 864e5).toISOString(); // ขอรีวิว 1 วันหลังจ่าย (ลูกค้ายังจำได้ดี)
  const [orders, test, rv, shop, site] = await Promise.all([
    sbSelect(`orders?status=eq.paid&paid_at=gte.${from}&paid_at=lte.${to}&email=not.is.null&select=session_id,email,name,product_id,product_name,paid_at,campaign&order=paid_at.asc&limit=200`),
    loadTestEmails().catch(() => new Set()), loadReviews(), loadShop(), siteUrl(),
  ]);
  const reviewed = new Set(rv.list.map((r) => r.order));
  const out = [];
  for (const o of orders) {
    const email = String(o.email || '').toLowerCase();
    if (!email || rv.sent[o.session_id] || reviewed.has(o.session_id)) continue;
    if (test.has(email) || /@example\.(com|org|net)$/.test(email) || /^(test|ทดสอบ)([-_ ]|$)/i.test(o.campaign || '')) continue;
    if (out.length >= 30) break;
    const names = (await orderProducts(o.session_id, o.product_id)).map((id) => shop.products.find((x) => x.id === id)?.name).filter(Boolean);
    if (!names.length) continue;
    const p = { name: names.length > 1 ? `${names.length} เล่มที่คุณซื้อ` : names[0] };
    const link = `${site}/review?o=${encodeURIComponent(o.session_id)}&t=${reviewToken(o.session_id)}`;
    if (!dry) {
      const { subject, html, text } = buildReviewEmail({ shop: shop.settings.shopName || 'SheetLab', product: p.name, items: names, link, settings: shop.settings });
      const transport = nodemailer.createTransport({ service: 'gmail', auth: { user: process.env.GMAIL_USER, pass: (process.env.GMAIL_APP_PASSWORD || '').replace(/\s+/g, '') } });
      try { await transport.sendMail({ from: `"${(shop.settings.shopName || 'SheetLab').replace(/"/g, '')}" <${process.env.GMAIL_USER}>`, to: email, subject, text, html }); }
      catch (e) { out.push({ ok: false, error: String(e.message || e).slice(0, 120) }); continue; }
      rv.sent[o.session_id] = new Date().toISOString();
    }
    out.push({ ok: true, product: p.name, email: email.replace(/^(.).*(@.*)$/, '$1***$2') });
  }
  const cut = Date.now() - 60 * 864e5; for (const k of Object.keys(rv.sent)) if (Date.parse(rv.sent[k]) < cut) delete rv.sent[k];
  if (!dry && out.some((x) => x.ok)) await saveReviews(rv);
  return { ok: true, eligible: orders.length, sent: out.filter((x) => x.ok).length, results: out };
}
