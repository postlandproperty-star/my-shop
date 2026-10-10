// โพสต์ขายของ (คุณแดน 10 ต.ค. 69): ใช้ปกจริง + หน้าตัวอย่างจริง 2-3 หน้า + ลิงก์สินค้าเสมอ ไม่ใช้รูปที่ AI วาดเอง (ปก/เนื้อหาไม่ตรงของจริง)
// หาสินค้าจากลิงก์ในโพสต์ (/p/slug) ก่อน ไม่เจอ + เป็นโพสต์ขาย (kind sale) → เทียบคำสำคัญในชื่อสินค้ากับข้อความ
const slugOf = (s) => (String(s || '').match(/\/p\/([a-z0-9-]+)/i) || [])[1] || '';
const toks = (name) => [...new Set(String(name || '').replace(/\([^)]*\)/g, ' ').match(/[A-Za-z][A-Za-z&+-]{2,}|\d[\d,]*/g) || [])].map((t) => t.toLowerCase().replace(/,/g, ''));
export function findSaleProduct(post, products) {
  const live = (products || []).filter((p) => p.status === 'published');
  const sl = slugOf(post.link_url) || slugOf(post.text);
  if (sl) { const p = live.find((x) => x.slug === sl); if (p) return p; }
  if (post.kind !== 'sale') return null;
  const t = String(post.text || '').toLowerCase().replace(/,/g, '');
  const sku = live.find((x) => x.sku && t.includes(String(x.sku).toLowerCase())); if (sku) return sku;
  const sc = live.map((p) => { const k = toks(p.name); const hit = k.filter((w) => t.includes(w)).length; return { p, hit, ratio: k.length ? hit / k.length : 0 }; })
    .filter((x) => x.hit >= 2).sort((a, b) => b.hit - a.hit || b.ratio - a.ratio);
  if (!sc.length || (sc[1] && sc[1].hit === sc[0].hit && sc[1].ratio === sc[0].ratio)) return null; // ไม่แน่ใจ = ไม่เดา
  return sc[0].p;
}
export function saleKit(post, products, site) {
  const p = findSaleProduct(post, products); if (!p) return null;
  const isSet = p.type === 'bundle';
  const cover = isSet ? (p.cover || (p.images || [])[0]) : (p.bookCover || (p.images || [])[0]);
  const books = isSet ? (p.items || []).map((id) => (products || []).find((x) => x.id === id)).filter(Boolean) : [];
  const more = isSet ? books.map((b) => b.bookCover || (b.images || [])[0]) : (p.previews || []);
  const gallery = [cover, ...more.filter((u) => u && u !== cover).slice(0, 3)].filter((u) => /^https:\/\//.test(String(u || '')));
  const url = `${String(site || 'https://sheetlabth.com').replace(/\/$/, '')}/p/${p.slug}`;
  const text = String(post.text || '').includes(`/p/${p.slug}`) ? String(post.text) : `${String(post.text || '').trim()}\n\n👉 ดูตัวอย่างและสั่งซื้อ: ${url}`;
  return { product: p, gallery, text, url };
}
