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
  const re = /\|\s*(\d{1,2})\.\s+([^|\n]+?)\s*\|\s*\n((?:\|[^\n]*\n){0,6})/g;
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
