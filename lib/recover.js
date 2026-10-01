// ตามลูกค้าที่กดสั่งซื้อแต่ยังจ่ายไม่เสร็จ: อีเมลเตือน 1 ฉบับต่อคำสั่งซื้อ (เฉพาะคนที่กรอกอีเมลในหน้าร้านก่อนไป Stripe)
// เรียกจาก cron วันละ 2 รอบ (10:00 และ 19:05 กทม.) ไม่ใส่ส่วนลด (เรื่องเงินคุณแดนตัดสิน)
import nodemailer from 'nodemailer';
import { stripe, configured, loadShop, SB_URL, loadTestEmails } from './shop.js';
import { mailConfigured } from './mail.js';
import { siteUrl } from './site.js';

const SECRET = process.env.SUPABASE_SECRET_KEY || '';
const hdr = { apikey: SECRET, Authorization: `Bearer ${SECRET}`, 'Content-Type': 'application/json' };
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const baht = (n) => '฿' + Number(n || 0).toLocaleString('th-TH');

async function loadState() { const r = await fetch(`${SB_URL}/rest/v1/shop_state?id=eq.recovery&select=data`, { headers: hdr }); const j = r.ok ? await r.json() : []; return j?.[0]?.data || { sent: {}, byEmail: {} }; }
async function saveState(d) { await fetch(`${SB_URL}/rest/v1/shop_state?on_conflict=id`, { method: 'POST', headers: { ...hdr, Prefer: 'resolution=merge-duplicates,return=minimal' }, body: JSON.stringify([{ id: 'recovery', data: d, updated_at: '2000-01-01T00:00:00Z' }]) }); }

export function buildRecoveryEmail({ shop, product, amount, url, settings }) {
  const subject = `คำสั่งซื้อ ${product} ยังไม่เสร็จ กดชำระต่อได้เลย`;
  const btn = `<a href="${esc(url)}" style="display:inline-block;background:#EE4D2D;color:#fff;font-weight:700;text-decoration:none;padding:14px 24px;border-radius:12px;margin:8px 0">ชำระเงินต่อ ${baht(amount)}</a>`;
  const html = `<!doctype html><html lang="th"><body style="margin:0;background:#EDF1F7;font-family:-apple-system,'IBM Plex Sans Thai','Noto Sans Thai',Segoe UI,Roboto,sans-serif;color:#0F1B33">
  <div style="max-width:560px;margin:0 auto;padding:24px 16px"><div style="background:#fff;border-radius:16px;padding:28px 24px">
    <p style="font-size:13px;color:#56637D;margin:0 0 6px">${esc(shop)}</p>
    <h1 style="font-size:21px;margin:0 0 12px">คำสั่งซื้อของคุณยังไม่เสร็จ</h1>
    <p style="margin:0 0 6px">คุณกดสั่งซื้อ <b>${esc(product)}</b> ราคา <b>${baht(amount)}</b> ไว้ แต่การชำระเงินยังไม่สำเร็จ กดปุ่มด้านล่างเพื่อกลับไปชำระต่อ ได้ไฟล์ทันทีหลังจ่าย</p>
    <p style="margin:0">${btn}</p>
    <hr style="border:0;border-top:1px solid #D3DBE8;margin:18px 0">
    <p style="margin:0 0 6px;font-weight:600">จ่ายพร้อมเพย์บนมือถือเครื่องเดียวกัน</p>
    <p style="margin:0;font-size:14px;color:#334">กดค้างที่ QR หรือแคปหน้าจอ แล้วเปิดแอปธนาคาร เลือกสแกนจากรูปภาพ ยอดเงินขึ้นให้อัตโนมัติ</p>
    ${settings.chatLink ? `<p style="font-size:14px;margin:14px 0 0">ติดปัญหาตรงไหน <a href="${esc(settings.chatLink)}" style="color:#2440E8">ทักแชทหาร้าน</a> ตอบเร็วครับ</p>` : ''}
    <p style="font-size:12px;color:#56637D;margin:18px 0 0">อีเมลนี้ส่งครั้งเดียว เกี่ยวกับคำสั่งซื้อที่คุณเริ่มไว้เท่านั้น ถ้าไม่ต้องการแล้ว ไม่ต้องทำอะไร</p>
  </div></div></body></html>`;
  const text = `${shop}\nคำสั่งซื้อของคุณยังไม่เสร็จ\n${product} ราคา ${baht(amount)}\nชำระเงินต่อ: ${url}\n\nจ่ายพร้อมเพย์บนมือถือ: แคปหน้าจอ QR แล้วเปิดแอปธนาคาร เลือกสแกนจากรูปภาพ\n${settings.chatLink ? `ติดปัญหา ทักแชท: ${settings.chatLink}\n` : ''}\nอีเมลนี้ส่งครั้งเดียว เกี่ยวกับคำสั่งซื้อที่คุณเริ่มไว้เท่านั้น`;
  return { subject, html, text };
}

export async function sendRecoveries({ dry = false } = {}) {
  if (!configured().stripe) return { ok: false, skipped: 'no stripe' };
  if (!mailConfigured() && !dry) return { ok: false, skipped: 'mail not configured' };
  const since = Math.floor((Date.now() - 3 * 864e5) / 1000);
  const [expired, done] = await Promise.all([
    stripe('GET', `checkout/sessions?status=expired&created[gte]=${since}&limit=100`),
    stripe('GET', `checkout/sessions?status=complete&created[gte]=${Math.floor((Date.now() - 7 * 864e5) / 1000)}&limit=100`),
  ]);
  const ownerTest = await loadTestEmails().catch(() => new Set());
  const paid = new Set((done.data || []).map((s) => String(s.customer_details?.email || s.customer_email || '').toLowerCase()).filter(Boolean));
  const st = await loadState(); st.sent = st.sent || {}; st.byEmail = st.byEmail || {};
  const shop = await loadShop(); const site = await siteUrl();
  const out = [];
  for (const s of expired.data || []) {
    const email = String(s.customer_email || s.customer_details?.email || '').toLowerCase();
    if (!email || s.metadata?.remind !== '1' || st.sent[s.id]) continue;
    if (/@example\.(com|org|net)$/.test(email) || /^(test|ทดสอบ)([-_ ]|$)/i.test(s.metadata?.campaign || '') || ownerTest.has(email)) continue; // ทดสอบระบบ / เจ้าของทดลองซื้อ
    if (paid.has(email)) continue;
    if (st.byEmail[email] && Date.now() - Date.parse(st.byEmail[email]) < 7 * 864e5) continue;
    const amount = (s.amount_total || 0) / 100; if (amount < 30) continue;
    const product = s.metadata?.productName || 'สินค้า';
    const url = s.after_expiration?.recovery?.url || `${site}/p/${s.metadata?.slug || ''}#checkout`;
    if (!dry) {
      const { subject, html, text } = buildRecoveryEmail({ shop: shop.settings.shopName || 'SheetLab', product, amount, url, settings: shop.settings });
      const transport = nodemailer.createTransport({ service: 'gmail', auth: { user: process.env.GMAIL_USER, pass: (process.env.GMAIL_APP_PASSWORD || '').replace(/\s+/g, '') } });
      try { await transport.sendMail({ from: `"${(shop.settings.shopName || 'SheetLab').replace(/"/g, '')}" <${process.env.GMAIL_USER}>`, to: email, subject, text, html }); }
      catch (e) { out.push({ id: s.id, ok: false, error: String(e.message || e).slice(0, 120) }); continue; }
      const now = new Date().toISOString(); st.sent[s.id] = now; st.byEmail[email] = now;
    }
    out.push({ id: s.id, ok: true, product, amount, email: email.replace(/^(.).*(@.*)$/, '$1***$2') });
  }
  // เก็บประวัติไม่เกิน 30 วัน
  const cut = Date.now() - 30 * 864e5;
  for (const k of Object.keys(st.sent)) if (Date.parse(st.sent[k]) < cut) delete st.sent[k];
  for (const k of Object.keys(st.byEmail)) if (Date.parse(st.byEmail[k]) < cut) delete st.byEmail[k];
  if (!dry && out.some((x) => x.ok)) await saveState(st);
  let waiting;
  if (dry) { const open = await stripe('GET', `checkout/sessions?status=open&created[gte]=${since}&limit=100`); waiting = (open.data || []).filter((x) => x.metadata?.remind === '1').map((x) => ({ id: x.id.slice(0, 16), expires_at: new Date(x.expires_at * 1000).toISOString(), recovery: !!x.after_expiration?.recovery?.enabled, email: String(x.customer_email || '').replace(/^(.).*(@.*)$/, '$1***$2') })); }
  return { ok: true, checked: (expired.data || []).length, sent: out.filter((x) => x.ok).length, results: out, waiting };
}
