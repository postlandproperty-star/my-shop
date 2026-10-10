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

// ---- 🎫 การ์ด QR ใบเดียวใช้ได้ทุกออเดอร์ (คุณแดน 11 ต.ค. 69: สั่งโรงพิมพ์ทำการ์ดไว้ทีเดียว ไม่ต้องพิมพ์ทีละออเดอร์) ----
// ลูกค้าสแกน → sheetlabth.com/s → ใส่เลขคำสั่งซื้อ Shopee → เห็นเฉพาะรายการที่ตัวเองซื้อ (จากอีเมลออเดอร์ที่เข้าระบบแล้ว) กดเปิดไฟล์ได้
const escH = (t) => String(t == null ? '' : t).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const normSn = (t) => String(t || '').toUpperCase().replace(/[^0-9A-Z]/g, '').slice(0, 24);
// รายการในออเดอร์ → [{ name, kind: 'file' | 'print' | 'wait', books:[{ name, link }] }] · ร้านปริ้นให้ = เล่มพิมพ์ส่งพัสดุ (ไม่ให้ไฟล์) · ชุด = ทุกเล่มในชุด
export function orderItems(o, products, links) {
  const P = products || [], L = links || {}, get = (id) => P.find((x) => x.id === id);
  return (o.items || []).map((it) => {
    if (isPrint(it.variation)) return { name: it.name, qty: it.qty, kind: 'print', books: [] };
    const p = it.pid && get(it.pid); if (!p) return { name: it.name, qty: it.qty, kind: 'wait', books: [] };
    const books = (p.type === 'bundle' ? (p.items || []) : [p.id]).map((id) => ({ name: (get(id) || {}).name || 'เล่ม', link: String(L[id] || '').trim() })).filter((b) => /^https:\/\//.test(b.link));
    return { name: p.name, qty: it.qty, kind: books.length ? 'file' : 'wait', books };
  });
}
const PAGE_CSS = `body{font-family:system-ui,-apple-system,'Segoe UI',Tahoma,sans-serif;background:#f6f7fb;color:#1b1b1b;margin:0;padding:20px 16px}main{max-width:560px;margin:0 auto;background:#fff;border-radius:16px;padding:20px;box-shadow:0 2px 12px rgba(0,0,0,.06)}
.logo{display:inline-block;font-weight:800;font-size:14px;background:#111;color:#fff;border-radius:99px;padding:3px 12px}h1{font-size:20px;margin:10px 0 4px}p{color:#555;margin:0 0 12px;line-height:1.55}
form{display:flex;gap:8px;flex-wrap:wrap;margin:12px 0}input{flex:1 1 200px;min-width:0;font-size:18px;padding:12px;border:1.5px solid #d0d4dc;border-radius:12px;letter-spacing:.5px;text-transform:uppercase}button{font-size:17px;font-weight:700;padding:12px 18px;border:0;border-radius:12px;background:#ee4d2d;color:#fff;cursor:pointer}
.hint{font-size:13.5px;background:#f3f4f6;border-radius:10px;padding:10px 12px}.err{background:#FEF2F2;color:#991B1B;border-radius:10px;padding:10px 12px}.it{border:1px solid #e5e7eb;border-radius:12px;padding:12px;margin:10px 0}.it b{display:block;margin-bottom:6px}
ol{padding-left:22px;margin:6px 0 0;display:grid;gap:8px}a.dl{display:inline-block;margin-top:4px;background:#ee4d2d;color:#fff;text-decoration:none;padding:8px 14px;border-radius:10px;font-weight:600}.tag{font-size:14px;color:#555}small{color:#777}`;
export function lookupPage({ sn = '', items = null, notFound = false, base = '' } = {}) {
  const head = `<!doctype html><html lang="th"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>รับไฟล์ตามออเดอร์ Shopee · SheetLab</title><style>${PAGE_CSS}</style></head><body><main><span class="logo">SheetLab</span>`;
  const form = `<form method="get" action="${escH(base)}"><input name="sn" value="${escH(sn)}" placeholder="เช่น 2610096ABCDEF" autocomplete="off" autocapitalize="characters" ${items ? '' : 'autofocus'} aria-label="เลขคำสั่งซื้อ Shopee" required><button type="submit">ดูรายการ</button></form>`;
  const hint = `<p class="hint">📍 หาเลขคำสั่งซื้อ: แอป Shopee → <b>ฉัน</b> → <b>การซื้อของฉัน</b> → กดออเดอร์ → <b>หมายเลขคำสั่งซื้อ</b> (กดค้างเพื่อคัดลอก)</p>`;
  if (!items) return `${head}<h1>📲 รับไฟล์เล่มที่คุณสั่งจาก Shopee</h1><p>ใส่เลขคำสั่งซื้อ Shopee ของคุณ แล้วกด "ดูรายการ"</p>${notFound ? `<p class="err">ยังไม่พบออเดอร์ <b>${escH(sn)}</b><br>ระบบรับออเดอร์ภายในไม่กี่ชั่วโมงหลังร้านกดจัดส่ง ลองใหม่อีกครั้งภายหลัง ตรวจเลขให้ครบทุกตัว หรือทักแชทร้านใน Shopee ได้เลย</p>` : ''}${form}${hint}</main></body></html>`;
  const body = items.map((x) => x.kind === 'file' ? `<div class="it"><b>${escH(x.name)}</b>${x.books.length > 1 ? `<span class="tag">${x.books.length} เล่ม · กดเปิดทีละเล่ม</span>` : ''}<ol>${x.books.map((b) => `<li>${escH(b.name)}<br><a class="dl" href="${escH(b.link)}" target="_blank" rel="noopener">📂 เปิดไฟล์</a></li>`).join('')}</ol></div>`
    : x.kind === 'print' ? `<div class="it"><b>${escH(x.name)}</b><span class="tag">📘 เล่มพิมพ์ ร้านจัดส่งทางพัสดุ Shopee</span></div>`
    : `<div class="it"><b>${escH(x.name)}</b><span class="tag">⏳ ร้านกำลังเตรียมไฟล์ของรายการนี้ ทักแชทร้านใน Shopee ได้เลย</span></div>`).join('');
  return `${head}<h1>ออเดอร์ #${escH(sn)}</h1><p>รายการที่คุณสั่ง · บันทึกหน้านี้ไว้ (หรือเก็บการ์ดไว้) เปิดซ้ำได้ทุกเมื่อ</p>${body}<p style="margin-top:16px;font-size:13.5px">ไม่ใช่ออเดอร์ของคุณ? <a href="${escH(base)}">ใส่เลขใหม่</a> · ดูชีทเล่มอื่นที่ <a href="/">sheetlabth.com</a></p></main></body></html>`;
}
// การ์ดสำหรับสั่งโรงพิมพ์: นามบัตร 90×55 มม. + ตัดตก 3 มม. ทุกด้าน (ไฟล์ 96×61 มม.) · บันทึกเป็น PDF จากหน้าพิมพ์
export function universalCard(url) {
  const short = url.replace(/^https?:\/\//, '');
  return `<!doctype html><html lang="th"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>การ์ด QR SheetLab (ใช้ได้ทุกออเดอร์)</title>
<style>@page{size:96mm 61mm;margin:0}*{box-sizing:border-box}body{font-family:system-ui,-apple-system,'Segoe UI',Tahoma,sans-serif;margin:0;background:#e5e7eb;color:#111}
.bar{text-align:center;padding:14px 16px;max-width:640px;margin:0 auto}.bar button{font-size:17px;font-weight:700;padding:12px 20px;border-radius:12px;border:0;background:#111;color:#fff;cursor:pointer}.bar p{color:#444;margin:8px 0 0;font-size:14px;line-height:1.6;text-align:left}
.sheet{width:96mm;height:61mm;margin:6mm auto;background:#fff;position:relative;overflow:hidden}.trim{position:absolute;inset:3mm;border:.2mm dashed #bbb}
.card{position:absolute;inset:3mm;padding:4.5mm 5mm;display:flex;gap:4.5mm;align-items:center}#qr{flex:0 0 33mm;height:33mm}#qr img,#qr canvas{width:33mm!important;height:33mm!important;display:block}
.tx{min-width:0}.logo{display:inline-block;font-weight:800;font-size:9pt;background:#111;color:#fff;border-radius:99px;padding:.6mm 3mm}h1{font-size:11.5pt;line-height:1.25;margin:2mm 0 1.5mm}ol{margin:0;padding-left:4mm;font-size:7.6pt;line-height:1.45}.url{font-size:7.4pt;color:#444;margin-top:1.5mm;font-weight:600}
@media print{body{background:#fff}.bar{display:none}.sheet{margin:0}.trim{display:none}}</style></head>
<body><div class="bar"><button onclick="print()">⬇ บันทึกเป็น PDF ส่งโรงพิมพ์</button><p>กดปุ่ม → ปลายทางเลือก <b>"บันทึกเป็น PDF"</b> → ขอบกระดาษ <b>"ไม่มี"</b> → บันทึก<br>บอกโรงพิมพ์: <b>นามบัตร 9×5.5 ซม.</b> ไฟล์เผื่อตัดตก 3 มม. แล้ว (เส้นประ = เส้นตัด ไม่ติดในไฟล์) · กระดาษอาร์ตการ์ด 260–300 แกรม หน้าเดียว<br>การ์ดใบเดียวใช้ได้ทุกออเดอร์ ลูกค้าสแกนแล้วใส่เลขคำสั่งซื้อ Shopee จะเห็นเฉพาะรายการที่ตัวเองซื้อ</p></div>
<div class="sheet"><div class="trim"></div><div class="card"><div id="qr"></div><div class="tx"><span class="logo">SheetLab</span><h1>สแกนรับไฟล์<br>เล่มที่คุณสั่ง</h1><ol><li>สแกน QR ด้วยกล้องมือถือ</li><li>ใส่เลขคำสั่งซื้อ Shopee</li><li>กดเปิดไฟล์ได้เลย เก็บการ์ดไว้เปิดซ้ำได้</li></ol><div class="url">${escH(short)}</div></div></div></div>
<script src="https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js"></script><script>new QRCode(document.getElementById('qr'),{text:${JSON.stringify(url)},width:1000,height:1000,correctLevel:QRCode.CorrectLevel.Q});</script></body></html>`;
}
