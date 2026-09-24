// เสิร์ฟหน้าเซลเพจ /p/:slug พร้อมแท็ก Open Graph ของสินค้านั้น
// (Facebook/LINE อ่านพรีวิวจาก HTML ดิบ ไม่รอ JavaScript จึงต้องใส่ฝั่งเซิร์ฟเวอร์)
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const SB_URL = 'https://lpeqaorswhwzlplsaqpe.supabase.co';
const SB_KEY = 'sb_publishable_q4qdE3WFYdH15Klf7TToSQ_Tbh87eNs';
const html = readFileSync(join(process.cwd(), 'index.html'), 'utf8');

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

async function findProduct(slug) {
  const r = await fetch(`${SB_URL}/rest/v1/shop_state?id=eq.main&select=data`, {
    headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}` },
  });
  if (!r.ok) return null;
  const rows = await r.json();
  const products = rows?.[0]?.data?.products || [];
  return products.find((p) => p.slug === slug && p.status === 'published') || null;
}

export default async function handler(req, res) {
  const slug = String(req.query.slug || '');
  let out = html;
  try {
    const p = /^[a-z0-9-]+$/.test(slug) ? await findProduct(slug) : null;
    if (p) {
      const proto = req.headers['x-forwarded-proto'] || 'https';
      const url = `${proto}://${req.headers.host}/p/${p.slug}`;
      const title = p.headline || p.name;
      const desc = p.desc || `${p.name} ราคา ฿${Number(p.price).toLocaleString('th-TH')}`;
      const img = (p.images || [])[0] || '';
      const tags = [
        `<meta property="og:type" content="website">`,
        `<meta property="og:url" content="${esc(url)}">`,
        `<meta property="og:title" content="${esc(title)}">`,
        `<meta property="og:description" content="${esc(desc)}">`,
        `<meta property="og:site_name" content="${esc(p.name)}">`,
        img ? `<meta property="og:image" content="${esc(img)}"><meta property="og:image:width" content="1200"><meta property="og:image:height" content="1200">` : '',
        `<meta name="twitter:card" content="${img ? 'summary_large_image' : 'summary'}">`,
        `<meta name="description" content="${esc(desc)}">`,
      ].join('');
      out = out
        .replace(/<title>[^<]*<\/title>/, `<title>${esc(p.name)}</title>`)
        .replace(/<!--OG-START-->[\s\S]*?<!--OG-END-->/, tags);
    }
  } catch (e) {
    console.error(e); // ถ้าดึงข้อมูลไม่ได้ ก็เสิร์ฟหน้าปกติไปก่อน
  }
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=600');
  res.status(200).send(out);
}
