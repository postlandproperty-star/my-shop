// เสิร์ฟหน้าเซลเพจ /p/:slug พร้อมแท็ก Open Graph ของสินค้านั้น
// (Facebook/LINE อ่านพรีวิวจาก HTML ดิบ ไม่รอ JavaScript จึงต้องใส่ฝั่งเซิร์ฟเวอร์)
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { newSiteLive, NEW_SITE } from '../lib/site.js';
import { policyPage, POLICY_DOCS } from '../lib/policies.js';

const SB_URL = 'https://lpeqaorswhwzlplsaqpe.supabase.co';
const SB_KEY = 'sb_publishable_q4qdE3WFYdH15Klf7TToSQ_Tbh87eNs';
const html = readFileSync(join(process.cwd(), 'src', 'index.html'), 'utf8');

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// ข้อมูลสินค้าแบบที่ Google อ่านได้ (ผลค้นหาแสดงราคา/มีของ) ชุดหนังสือใช้ช่วงราคาของแพ็กเกจ
function productLd(p, url, desc, img) {
  const plans = p.type === 'bundle' ? (p.plans || []).filter((x) => x.on !== false && Number(x.price) >= 1).map((x) => Number(x.price)) : [];
  const offers = plans.length > 1
    ? { '@type': 'AggregateOffer', priceCurrency: 'THB', lowPrice: Math.min(...plans), highPrice: Math.max(...plans), offerCount: plans.length, availability: 'https://schema.org/InStock', url }
    : { '@type': 'Offer', priceCurrency: 'THB', price: plans[0] || Number(p.price) || 0, availability: 'https://schema.org/InStock', url };
  const ld = { '@context': 'https://schema.org', '@type': 'Product', name: p.name, description: desc, brand: { '@type': 'Brand', name: 'SheetLab' }, url, ...(img ? { image: [img] } : {}), offers };
  return `<script type="application/ld+json">${JSON.stringify(ld).replace(/</g, '\\u003c')}</script>`;
}

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
  // ย้ายไปโดเมนใหม่: เปิดจากที่อยู่เดิม (.vercel.app) หลังโดเมนใหม่พร้อม → ส่งไปหน้าเดียวกันบน sheetlabth.com
  if (String(req.headers.host || '').endsWith('.vercel.app') && await newSiteLive()) {
    const q = new URLSearchParams(); for (const [k, v] of Object.entries(req.query || {})) if (k !== 'slug' && k !== 'doc') q.append(k, String(v));
    const doc = String(req.query.doc || '');
    const path = POLICY_DOCS.includes(doc) ? `/${doc}` : /^[a-z0-9-]+$/.test(slug) ? `/p/${slug}` : '/';
    res.statusCode = 301; res.setHeader('Location', `${NEW_SITE}${path}${q.toString() ? '?' + q : ''}`); res.setHeader('Cache-Control', 'no-store'); return res.end();
  }
  const doc = String(req.query.doc || '');
  const seo = String(req.query.seo || '');
  if (seo === 'robots') { // ให้ Google เก็บหน้าร้าน ไม่เก็บ API และหน้าร่าง
    res.setHeader('Content-Type', 'text/plain; charset=utf-8'); res.setHeader('Cache-Control', 'public, s-maxage=3600');
    return res.status(200).send(`User-agent: *\nAllow: /\nDisallow: /api/\nDisallow: /draft/\n\nSitemap: ${NEW_SITE}/sitemap.xml\n`);
  }
  if (seo === 'sitemap') { // รายการหน้าที่ลูกค้าเปิดได้ (เฉพาะสินค้าที่เผยแพร่แล้ว)
    const shop = await loadShop().catch(() => ({ products: [] }));
    const today = new Date().toISOString().slice(0, 10);
    const urls = ['/', ...shop.products.filter((x) => x.status === 'published' && /^[a-z0-9-]+$/.test(x.slug || '')).map((x) => `/p/${x.slug}`), '/privacy', '/refund'];
    res.setHeader('Content-Type', 'application/xml; charset=utf-8'); res.setHeader('Cache-Control', 'public, s-maxage=3600');
    return res.status(200).send(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map((u) => `  <url><loc>${NEW_SITE}${u}</loc><lastmod>${today}</lastmod>${u.startsWith('/p/') || u === '/' ? '<changefreq>weekly</changefreq>' : ''}</url>`).join('\n')}\n</urlset>\n`);
  }
  const draft = String(req.query.draft || '');
  if (/^[a-z0-9-]{3,60}$/.test(draft)) { // หน้าร่าง /draft/<ชื่อ>: ไม่มีลิงก์จากหน้าร้าน และบอกเครื่องมือค้นหาไม่ให้เก็บ
    let page = null;
    try { page = readFileSync(join(process.cwd(), 'src', 'drafts', `${draft}.html`), 'utf8'); } catch (e) {}
    if (!page) { res.statusCode = 404; return res.end('not found'); }
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('X-Robots-Tag', 'noindex, nofollow');
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).send(page);
  }
  if (POLICY_DOCS.includes(doc)) { // หน้านโยบาย /privacy และ /refund
    const shop = await loadShop().catch(() => ({ settings: {} }));
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=3600');
    return res.status(200).send(policyPage(doc, shop.settings));
  }
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
    // ชื่อร้านจากหลังบ้าน (ถ้ายังไม่ตั้ง ใช้ชื่อแบรนด์) → ชื่อแท็บ/ผลค้นหา Google/พรีวิวของหน้าแรก
    const shopName = String(shop.settings.shopName || '').trim() || 'SheetLab ชีทสรุป TOEIC และแบบฝึกหัด';
    out = out.replace(/<title>[^<]*<\/title>/, `<title>${esc(shopName)}</title>`)
      .replace('<meta property="og:title" content="ร้านหนังสือ/ชีทเรียน">', `<meta property="og:title" content="${esc(shopName)}"><meta name="description" content="ชีทสรุป Grammar และคำศัพท์ TOEIC ภาษาไทย พร้อมแบบฝึกหัดและเฉลยละเอียด สแกนจ่ายแล้วดาวน์โหลดได้ทันที"><link rel="canonical" href="${NEW_SITE}/">`);
    const view = String(req.query.view || '');
    if (view === 'order') { // หน้าหาออเดอร์: ไม่ต้องให้ Google เก็บ
      out = out.replace(/<title>[^<]*<\/title>/, '<title>หาออเดอร์ของฉัน · SheetLab</title>')
        .replace(/<!--OG-START-->[\s\S]*?<!--OG-END-->/, '<meta name="robots" content="noindex">');
    }
    const live = shop.products.filter((x) => x.status === 'published' && /^[a-z0-9-]+$/.test(x.slug || ''));
    if (!slug && !view && live.length >= 2) { // หน้าแรกเป็นหน้าร้าน: บอก Google ว่ามีสินค้าอะไรบ้าง
      const ld = { '@context': 'https://schema.org', '@type': 'ItemList', name: shopName, itemListElement: live.map((x, i) => ({ '@type': 'ListItem', position: i + 1, url: `${NEW_SITE}/p/${x.slug}`, name: x.name })) };
      out = out.replace('<!--OG-END-->', `<script type="application/ld+json">${JSON.stringify(ld).replace(/</g, '\\u003c')}</script><!--OG-END-->`);
    }
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
        `<link rel="canonical" href="${NEW_SITE}/p/${esc(p.slug)}">`,
        productLd(p, `${NEW_SITE}/p/${p.slug}`, desc, img),
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
