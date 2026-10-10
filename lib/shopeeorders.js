// 📦 ออเดอร์ Shopee จากอีเมล "ถึงเวลาจัดส่งสินค้าหมายเลข #…" ใน Gmail ของร้าน (postland.property) → หน้าพิมพ์ของแม่ (คุณแดน 10 ต.ค. 69)
// ผู้ช่วยอัตโนมัติ (routine) อ่านอีเมลแล้วส่งข้อความดิบมาที่ action=shopee_mail · เซิร์ฟเวอร์แยกเลขออเดอร์ / สินค้า / ตัวเลือก (ร้านปริ้นให้ · ลูกค้าปริ้นเอง) / จำนวน
// สินค้า Shopee ↔ สินค้าในร้าน: จับจากรหัสสินค้า Shopee ที่เคยจับคู่ (map) → ชื่อบน Shopee → ชื่อคล้ายกัน · จับไม่ได้ให้แม่/คุณแดนเลือกครั้งเดียวในหน้าพิมพ์

const clean = (t) => String(t || '').replace(/\s+/g, ' ').trim();
const norm = (t) => clean(t).toLowerCase().replace(/[^\p{L}\p{N}+]+/gu, ' ').trim();

// ข้อความอีเมล (plain text แบบตาราง | … |) → { sn, date, items:[{ name, variation, qty, price, itemId }] }
export function parseShopeeMail(text, subject = '') {
  const t = String(text || '');
  const sn = ((t.match(/หมายเลขคำสั่งซื้อ:?\s*\|?\s*#?([A-Z0-9]{8,24})/) || String(subject).match(/#([A-Z0-9]{8,24})/) || [])[1]) || '';
  const date = clean((t.match(/วันที่สั่งซื้อ:?\s*\|\s*([^|\n]+)/) || [])[1]);
  let dec = t; try { dec = decodeURIComponent(t.replace(/%(?![0-9A-F]{2})/gi, '%25')); } catch (e) {}
  const ids = [...dec.matchAll(/-i\.(\d+)\.(\d+)/g)].map((m) => m[2]);
  const items = [];
  const re = /\|\s*(\d{1,2})\.\s+([^|\n]+?)\s*\|\s*\n((?:\|[^\n]*\n){0,8})/g;
  let m;
  while ((m = re.exec(t))) {
    const block = m[3], f = (k) => clean((block.match(new RegExp(k + ':?\\s*\\|\\s*([^|\\n]+)')) || [])[1]);
    const qty = Number(f('จำนวน').replace(/[^\d]/g, '')) || 1, price = Number(f('ราคา').replace(/[^\d.]/g, '')) || 0;
    if (!f('จำนวน') && !f('ราคา')) continue;
    items.push({ name: clean(m[2]), variation: f('ตัวเลือกสินค้า'), qty, price, itemId: ids[items.length] || '' });
  }
  return { sn, date, items };
}

// ร้านปริ้นให้ = เล่มพิมพ์ · ลูกค้าปริ้นเอง / ไฟล์ = บัตร QR
export const isPrint = (variation) => /ร้าน\s*ปริ้น|ร้าน\s*พิมพ์|เล่มพิมพ์|print/i.test(String(variation || '')) && !/ลูกค้า/.test(String(variation || ''));

export function matchItem(item, products, map = {}) {
  const P = (products || []).filter((p) => p && p.status === 'published');
  if (item.itemId && map[item.itemId] && P.some((p) => p.id === map[item.itemId])) return map[item.itemId];
  const n = norm(item.name);
  const exact = P.find((p) => norm(p.shopeeName) === n) || P.find((p) => norm(p.name) === n);
  if (exact) return exact.id;
  // ชื่อคล้าย: คะแนนจากคำที่ตรงกัน (ชุดได้คะแนนเพิ่มถ้าเป็นชุดทั้งคู่) · ต้องห่างอันดับสองชัดเจน ไม่เดาถ้าก้ำกึ่ง
  const words = new Set(n.split(' ').filter((w) => w.length > 1));
  const setLike = /ชุด|ครบชุด|\d+\s*เล่ม/.test(item.name);
  // ชื่อบน Shopee เป็นชุด → เทียบเฉพาะสินค้าแบบชุด (เคยจับ "ชุดเตรียมสอบ TOEIC 750+ … MP3" ไปเป็นเล่มเดี่ยว Shadowing เพราะคำ MP3/แทร็กซ้ำ 10 ต.ค. 69)
  const pool = P.filter((p) => setLike === (p.type === 'bundle'));
  const sc = pool.map((p) => { const w = norm((p.shopeeName || '') + ' ' + p.name).split(' '); let s = 0; for (const x of new Set(w)) if (words.has(x)) s += /\d/.test(x) ? 2 : 1; return { id: p.id, s }; }).sort((a, b) => b.s - a.s);
  return sc[0] && sc[0].s >= 3 && sc[0].s - ((sc[1] || {}).s || 0) >= 2 ? sc[0].id : '';
}

// ---- รับอีเมลตรงจาก Cloudflare Email Routing (ไม่ใช้ AI · คุณแดน 10 ต.ค. 69) ----
// Gmail (postland) ตัวกรองส่งต่ออีเมลออเดอร์ Shopee → orders@sheetlabth.com → Cloudflare Email Worker ส่งอีเมลดิบ (MIME) มาที่ action=shopee_inbound
const decQP = (s) => { const b = []; s = s.replace(/=\r?\n/g, ''); for (let i = 0; i < s.length; i++) { if (s[i] === '=' && /^[0-9A-F]{2}$/i.test(s.slice(i + 1, i + 3))) { b.push(parseInt(s.slice(i + 1, i + 3), 16)); i += 2; } else { const c = Buffer.from(s[i], 'utf8'); for (const x of c) b.push(x); } } return Buffer.from(b); };
const decBody = (body, enc, charset) => { const e = String(enc || '').toLowerCase(), buf = e === 'base64' ? Buffer.from(body.replace(/\s+/g, ''), 'base64') : e === 'quoted-printable' ? decQP(body) : Buffer.from(body, 'utf8'); try { return new TextDecoder(charset || 'utf-8').decode(buf); } catch (x) { return buf.toString('utf8'); } };
const decWord = (s) => String(s || '').replace(/=\?([^?]+)\?([BQ])\?([^?]*)\?=/gi, (m, cs, e, t) => decBody(e.toUpperCase() === 'B' ? t : t.replace(/_/g, ' '), e.toUpperCase() === 'B' ? 'base64' : 'quoted-printable', cs)).replace(/\?=\s+=\?/g, '');
function headers(h) { const o = {}; for (const line of h.replace(/\r?\n[ \t]+/g, ' ').split(/\r?\n/)) { const i = line.indexOf(':'); if (i > 0) o[line.slice(0, i).trim().toLowerCase()] = line.slice(i + 1).trim(); } return o; }
// อีเมลดิบ → { from, subject, html, text } (multipart ซ้อนกันได้ · base64 / quoted-printable · หัวเรื่องภาษาไทยแบบ =?UTF-8?B?…?=)
export function parseMime(raw) {
  const out = { from: '', subject: '', html: '', text: '' }, r = String(raw || '');
  const walk = (part, top) => { const k = part.search(/\r?\n\r?\n/); if (k < 0) return; const h = headers(part.slice(0, k)), body = part.slice(k).replace(/^\r?\n\r?\n/, '');
    if (top) { out.from = decWord(h.from || ''); out.subject = decWord(h.subject || ''); }
    const ct = h['content-type'] || 'text/plain', bd = (ct.match(/boundary="?([^";]+)"?/i) || [])[1], cs = (ct.match(/charset="?([^";]+)"?/i) || [])[1];
    if (/^multipart\//i.test(ct) && bd) { for (const p of body.split('--' + bd).slice(1)) { if (/^--/.test(p)) break; walk(p.replace(/^\r?\n/, ''), false); } return; }
    if (/^text\/html/i.test(ct) && !out.html) out.html = decBody(body, h['content-transfer-encoding'], cs);
    else if (/^text\/plain/i.test(ct) && !out.text) out.text = decBody(body, h['content-transfer-encoding'], cs); };
  walk(r, true); return out;
}
// HTML ตาราง → ข้อความแบบ "| ช่อง | ช่อง |" (รูปแบบเดียวกับที่ Gmail แปลง จึงใช้ parseShopeeMail ตัวเดิมได้) + เก็บลิงก์ไว้หารหัสสินค้า
export function htmlToRows(html) {
  const ent = { amp: '&', lt: '<', gt: '>', quot: '"', nbsp: ' ', '#39': "'" };
  const links = [...String(html).matchAll(/href="([^"]+)"/gi)].map((m) => m[1].replace(/&amp;/g, '&')).join('\n');
  const t = String(html).replace(/<(style|script|head)[\s\S]*?<\/\1>/gi, '').replace(/<tr[^>]*>/gi, '\n|').replace(/<\/td>/gi, ' |').replace(/<br\s*\/?>/gi, ' ').replace(/<[^>]+>/g, ' ')
    .replace(/&(amp|lt|gt|quot|nbsp|#39);/g, (m, k) => ent[k]).replace(/[ \t]+/g, ' ').split('\n').map((l) => l.trim()).filter((l) => l && l !== '|').join('\n');
  return t + '\n' + links;
}
export const isForwardConfirm = (m) => /forwarding-noreply@google\.com/i.test(m.from || '') || /Gmail Forwarding Confirmation|ยืนยันการส่งต่อ/i.test(m.subject || '');
export function forwardCode(m) { const s = (m.text || '') + ' ' + (m.html || '').replace(/<[^>]+>/g, ' '); return { code: ((s.match(/(?:Confirmation code|รหัสยืนยัน)[^0-9]{0,30}(\d{6,12})/i) || String(m.subject).match(/\(#(\d{6,12})\)/) || [])[1]) || '', link: ((s.match(/https:\/\/mail(?:-settings)?\.google\.com\/mail\/[^\s"<>]+/) || [])[0] || '').replace(/&amp;/g, '&') }; }

// รหัสลับของจุดรับอีเมล (ใส่ในโค้ด Cloudflare Worker) · โค้ด Worker ที่คุณแดนวางใน Cloudflare
import { createHmac } from 'node:crypto';
export const mailKey = (token) => createHmac('sha256', String(token)).update('mail-inbound').digest('hex').slice(0, 32);
export const workerCode = (url) => `// SheetLab: รับอีเมลออเดอร์ Shopee ที่ส่งต่อจาก Gmail แล้วส่งเข้าเว็บร้าน (Cloudflare Email Worker)
export default {
  async email(message, env, ctx) {
    const raw = await new Response(message.raw).text();
    const r = await fetch(${JSON.stringify(url)}, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ from: message.from, raw }) });
    if (!r.ok) message.setReject("SheetLab " + r.status);
  },
};
`;
