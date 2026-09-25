// ส่งอีเมลขอบคุณ + ลิงก์ดาวน์โหลด ผ่าน Gmail (App password ใน Vercel: GMAIL_USER, GMAIL_APP_PASSWORD)
import nodemailer from 'nodemailer';

const USER = process.env.GMAIL_USER || '';
const PASS = (process.env.GMAIL_APP_PASSWORD || '').replace(/\s+/g, '');
export const mailConfigured = () => !!(USER && PASS);

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const baht = (n) => '฿' + Number(n || 0).toLocaleString('th-TH');

export function buildOrderEmail({ orderId, items, amount, settings, origin }) {
  const shop = settings.shopName || 'ร้านของเรา';
  const names = items.map((i) => i.name).join(' + ');
  const subject = `ขอบคุณที่สั่งซื้อ ${names} — ลิงก์ดาวน์โหลดของคุณ`;
  const btn = (href, label) => `<a href="${esc(href)}" style="display:inline-block;background:#FFD23F;color:#0F1B33;font-weight:700;text-decoration:none;padding:14px 22px;border-radius:12px;margin:6px 0">${esc(label)}</a>`;
  const files = items.map((i) => i.link
    ? `<p style="margin:10px 0">${btn(i.link, 'ดาวน์โหลด ' + i.name)}<br><span style="color:#56637D;font-size:13px">${esc(i.link)}</span></p>`
    : `<p style="margin:10px 0;color:#B42318">ไฟล์ "${esc(i.name)}" ทางร้านจะส่งให้ทางแชทโดยตรง กรุณาแจ้งเลขออเดอร์ ${esc(orderId)}</p>`).join('');
  const html = `<!doctype html><html lang="th"><body style="margin:0;background:#EDF1F7;font-family:-apple-system,'IBM Plex Sans Thai','Noto Sans Thai',Segoe UI,Roboto,sans-serif;color:#0F1B33">
  <div style="max-width:560px;margin:0 auto;padding:24px 16px">
    <div style="background:#fff;border-radius:16px;padding:28px 24px">
      <p style="font-size:13px;color:#56637D;margin:0 0 6px">${esc(shop)}</p>
      <h1 style="font-size:22px;margin:0 0 12px">ชำระเงินสำเร็จ ขอบคุณครับ 🎉</h1>
      <p style="margin:0 0 4px">รายการ: <b>${esc(names)}</b></p>
      <p style="margin:0 0 4px">ยอดชำระ: <b>${baht(amount)}</b> · เลขออเดอร์ <b>${esc(orderId)}</b></p>
      <hr style="border:0;border-top:1px solid #D3DBE8;margin:18px 0">
      <p style="margin:0 0 6px;font-weight:600">ไฟล์ของคุณ</p>
      ${files}
      <p style="font-size:13px;color:#56637D;margin:14px 0 0">เก็บอีเมลนี้ไว้ กดลิงก์ดาวน์โหลดซ้ำได้ตลอด${origin ? ` · <a href="${esc(origin)}" style="color:#2440E8">เปิดร้าน</a>` : ''}</p>
      ${settings.chatLink ? `<p style="font-size:13px;color:#56637D;margin:6px 0 0">มีปัญหาเปิดไฟล์? <a href="${esc(settings.chatLink)}" style="color:#2440E8">ทักแชทหาร้าน</a></p>` : ''}
      ${settings.contactInfo ? `<p style="font-size:13px;color:#56637D;margin:6px 0 0">ติดต่อ: ${esc(settings.contactInfo)}</p>` : ''}
    </div>
    ${settings.refundPolicy ? `<p style="font-size:12px;color:#56637D;margin:14px 8px 0;white-space:pre-line">${esc(settings.refundPolicy)}</p>` : ''}
  </div></body></html>`;
  const text = `${shop}\nชำระเงินสำเร็จ ขอบคุณครับ\nรายการ: ${names}\nยอดชำระ: ${baht(amount)} · เลขออเดอร์ ${orderId}\n\nไฟล์ของคุณ:\n${items.map((i) => `- ${i.name}: ${i.link || 'ทางร้านจะส่งให้ทางแชท'}`).join('\n')}\n${settings.chatLink ? `\nมีปัญหา? ทักแชท: ${settings.chatLink}` : ''}`;
  return { subject, html, text };
}

export async function sendOrderEmail(to, opts) {
  if (!mailConfigured()) throw new Error('ยังไม่ได้ตั้งค่า GMAIL_USER / GMAIL_APP_PASSWORD บน Vercel');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(to || ''))) throw new Error('ไม่มีอีเมลลูกค้า');
  const { subject, html, text } = buildOrderEmail(opts);
  const transport = nodemailer.createTransport({ service: 'gmail', auth: { user: USER, pass: PASS } });
  const fromName = opts.settings.shopName || 'SheetLab';
  await transport.sendMail({ from: `"${fromName.replace(/"/g, '')}" <${USER}>`, to, subject, text, html });
}
