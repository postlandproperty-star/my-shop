// เสิร์ฟหน้าเซลเพจ /p/:slug พร้อมแท็ก Open Graph ของสินค้านั้น
// (Facebook/LINE อ่านพรีวิวจาก HTML ดิบ ไม่รอ JavaScript จึงต้องใส่ฝั่งเซิร์ฟเวอร์)
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const SB_URL = 'https://lpeqaorswhwzlplsaqpe.supabase.co';
const SB_KEY = 'sb_publishable_q4qdE3WFYdH15Klf7TToSQ_Tbh87eNs';
const html = readFileSync(join(process.cwd(), 'src', 'index.html'), 'utf8');

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

async function loadShop() {
  const r = await fetch(`${SB_URL}/rest/v1/shop_state?id=eq.main&select=data`, {
    headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}` },
  });
  if (!r.ok) return { products: [], settings: {} };
  const rows = await r.json();
  const data = rows?.[0]?.data || {};
  return { products: data.products || [], settings: data.settings || {} };
}

export default async function handler(req, res) {
  const slug = String(req.query.slug || '');
  let out = html;
  try {
    const shop = await loadShop();
    // แท็กยืนยันโดเมนกับ Meta (Facebook) ต้องอยู่ใน HTML ดิบของทุกหน้า รวมหน้าแรก
    const verify = String(shop.settings.fbDomainVerify || '').trim();
    if (/^[A-Za-z0-9_-]{5,100}$/.test(verify)) {
      out = out.replace('<!--OG-START-->', `<meta name="facebook-domain-verification" content="${verify}"><!--OG-START-->`);
    }
    // ฝังข้อมูลร้าน (สาธารณะ) ลงหน้าเลย ลูกค้าไม่ต้องรอโหลดไลบรารี+ดึงข้อมูลอีกรอบ
    const inline = JSON.stringify({ products: shop.products, settings: shop.settings, coupons: shop.coupons || [] }).replace(/<\//g, '<\\/');
    out = out.replace('<!--SHOP-DATA-->', `<script>window.__SHOP__=${inline};</script>`);
    const p = /^[a-z0-9-]+$/.test(slug) ? shop.products.find((x) => x.slug === slug && x.status === 'published') : null;
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
