// เสิร์ฟหน้าเซลเพจ /p/:slug พร้อมแท็ก Open Graph ของสินค้านั้น
// (Facebook/LINE อ่านพรีวิวจาก HTML ดิบ ไม่รอ JavaScript จึงต้องใส่ฝั่งเซิร์ฟเวอร์)
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { newSiteLive, NEW_SITE } from '../lib/site.js';
import { policyPage, POLICY_DOCS } from '../lib/policies.js';
import { quizPage, quizIndex, articlePage, articleIndex, dailyPick, dailyPage } from '../lib/quiz.js';
import { sbSelect } from '../lib/shop.js';

// แบบทดสอบที่เปิดอยู่ (แถว quizzes อ่านด้วยคีย์ลับฝั่งเซิร์ฟเวอร์)
async function loadQuizzes() { try { const r = await sbSelect('shop_state?id=eq.quizzes&select=data'); return (r?.[0]?.data?.list || []).filter((q) => q.status !== 'hidden').sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || ''))); } catch (e) { return []; } }
async function loadArticles() { try { const r = await sbSelect('shop_state?id=eq.articles&select=data'); return (r?.[0]?.data?.list || []).filter((a) => a.status !== 'hidden').sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || ''))); } catch (e) { return []; } }

const SB_URL = 'https://lpeqaorswhwzlplsaqpe.supabase.co';
const SB_KEY = 'sb_publishable_q4qdE3WFYdH15Klf7TToSQ_Tbh87eNs';
const html = readFileSync(join(process.cwd(), 'src', 'index.html'), 'utf8');

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// ข้อมูลสินค้าแบบที่ Google อ่านได้ (ผลค้นหาแสดงราคา/มีของ) ชุดหนังสือใช้ช่วงราคาของแพ็กเกจ
function productLd(p, url, desc, img, rv) {
  const plans = p.type === 'bundle' ? (p.plans || []).filter((x) => x.on !== false && Number(x.price) >= 1).map((x) => Number(x.price)) : [];
  const offers = plans.length > 1
    ? { '@type': 'AggregateOffer', priceCurrency: 'THB', lowPrice: Math.min(...plans), highPrice: Math.max(...plans), offerCount: plans.length, availability: 'https://schema.org/InStock', url }
    : { '@type': 'Offer', priceCurrency: 'THB', price: plans[0] || Number(p.price) || 0, availability: 'https://schema.org/InStock', url };
  const ld = { '@context': 'https://schema.org', '@type': 'Product', name: p.name, description: desc, brand: { '@type': 'Brand', name: 'SheetLab' }, url, ...(img ? { image: [img] } : {}), offers };
  if (rv && rv.count) { ld.aggregateRating = { '@type': 'AggregateRating', ratingValue: rv.avg, reviewCount: rv.count, bestRating: 5, worstRating: 1 }; ld.review = rv.items.slice(0, 5).map((x) => ({ '@type': 'Review', reviewRating: { '@type': 'Rating', ratingValue: x.stars, bestRating: 5 }, author: { '@type': 'Person', name: x.name }, ...(x.text ? { reviewBody: x.text } : {}), datePublished: x.at })); }
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
    const [quizzes, articles] = await Promise.all([loadQuizzes(), loadArticles()]);
    const urls = ['/', ...(articles.length ? ['/learn', ...articles.map((a) => `/learn/${a.slug}`)] : []), ...shop.products.filter((x) => x.status === 'published' && /^[a-z0-9-]+$/.test(x.slug || '')).map((x) => `/p/${x.slug}`), ...(quizzes.length ? ['/quiz', ...quizzes.map((q) => `/quiz/${q.slug}`)] : []), '/privacy', '/refund'];
    res.setHeader('Content-Type', 'application/xml; charset=utf-8'); res.setHeader('Cache-Control', 'public, s-maxage=3600');
    return res.status(200).send(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map((u) => `  <url><loc>${NEW_SITE}${u}</loc><lastmod>${today}</lastmod>${u.startsWith('/p/') || u.startsWith('/quiz') || u.startsWith('/learn') || u === '/' ? '<changefreq>weekly</changefreq>' : ''}</url>`).join('\n')}\n</urlset>\n`);
  }
  if (req.query.review) { // หน้ารีวิวจากลิงก์ในอีเมล (ลายเซ็นต่อออเดอร์) ไม่ให้ Google เก็บ
    const { tokenOk, previewOk, loadReviews, reviewPage, maskEmail } = await import('../lib/reviews.js');
    const o = String(req.query.o || ''), t = String(req.query.t || '');
    res.setHeader('Content-Type', 'text/html; charset=utf-8'); res.setHeader('Cache-Control', 'no-store'); res.setHeader('X-Robots-Tag', 'noindex');
    const bad = (m) => res.status(404).send(`<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><body style="font-family:sans-serif;padding:24px">${m} <a href="${NEW_SITE}">กลับหน้าร้าน</a></body>`);
    const pv = previewOk(o, t);
    if (!/^[A-Za-z0-9_-]{6,200}$/.test(o) || !(tokenOk(o, t) || pv)) return bad('ลิงก์รีวิวไม่ถูกต้องหรือหมดอายุ');
    const rows = await sbSelect(`orders?session_id=eq.${encodeURIComponent(o)}&status=eq.paid&select=session_id,name,email,product_id,product_name`).catch(() => []);
    if (!rows.length) return bad('ไม่พบคำสั่งซื้อนี้');
    const shop = await loadShop().catch(() => ({ products: [] }));
    const { orderProducts } = await import('../lib/reviews.js');
    const ids = await orderProducts(o, rows[0].product_id);
    const rv = await loadReviews();
    const products = ids.map((id) => ({ id, name: shop.products.find((x) => x.id === id)?.name || (id === rows[0].product_id ? rows[0].product_name : ''), existing: rv.list.find((x) => x.order === o && x.product_id === id) })).filter((p) => p.name);
    return res.status(200).send(reviewPage({ products: products.length ? products : [{ id: rows[0].product_id, name: rows[0].product_name, existing: rv.list.find((x) => x.order === o) }], order: rows[0], token: t, stars: req.query.s, site: NEW_SITE, mask: pv ? 'ตัวอย่าง•••@gmail.com' : maskEmail(rows[0].email), preview: pv }));
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
  const learn = String(req.query.learn || '');
  if (learn) { // คลังความรู้ /learn และ /learn/<slug>
    const [shop, articles, quizzes] = await Promise.all([loadShop().catch(() => ({ products: [], settings: {} })), loadArticles(), loadQuizzes()]);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=120');
    if (learn === '_index') return res.status(200).send(articleIndex(articles, { settings: shop.settings, site: NEW_SITE }));
    const a = articles.find((x) => x.slug === learn);
    if (!a) { res.statusCode = 404; return res.end(articleIndex(articles, { settings: shop.settings, site: NEW_SITE })); }
    const quiz = quizzes.find((q) => q.slug === a.quiz_slug) || quizzes.find((q) => q.article_slug === a.slug) || null;
    return res.status(200).send(articlePage(a, { products: shop.products, settings: shop.settings, site: NEW_SITE, quiz, others: articles.filter((x) => x.slug !== a.slug && (x.cat === a.cat)).concat(articles.filter((x) => x.slug !== a.slug && x.cat !== a.cat)) }));
  }
  const quiz = String(req.query.quiz || '');
  if (quiz) { // แบบทดสอบฟรี /quiz และ /quiz/<slug> (หน้าเนื้อหาให้ Google เก็บ)
    const [shop, quizzes, articles] = await Promise.all([loadShop().catch(() => ({ products: [], settings: {} })), loadQuizzes(), loadArticles()]);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=120');
    if (quiz === '_index') return res.status(200).send(quizIndex(quizzes, { settings: shop.settings, site: NEW_SITE }));
    if (quiz === 'daily') { res.setHeader('Cache-Control', 'public, s-maxage=600, stale-while-revalidate=600'); return res.status(200).send(dailyPage(dailyPick(quizzes), { settings: shop.settings, site: NEW_SITE })); }
    const q = quizzes.find((x) => x.slug === quiz);
    if (!q) { res.statusCode = 404; return res.end(quizIndex(quizzes, { settings: shop.settings, site: NEW_SITE })); }
    const article = articles.find((x) => x.slug === q.article_slug) || articles.find((x) => x.quiz_slug === q.slug) || null;
    return res.status(200).send(quizPage(q, { products: shop.products, settings: shop.settings, site: NEW_SITE, article, others: quizzes.filter((x) => x.slug !== q.slug) }));
  }
  if (POLICY_DOCS.includes(doc)) { // หน้านโยบาย /privacy และ /refund
    const shop = await loadShop().catch(() => ({ settings: {} }));
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=120');
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
    const [qz, ar, rvAll] = await Promise.all([loadQuizzes(), loadArticles(), import('../lib/reviews.js').then((m) => m.loadReviews().then((d) => m.reviewSummary(d.list))).catch(() => ({}))]);
    const quizList = qz.map((q) => ({ slug: q.slug, title: q.title, cat: q.cat || '', n: q.questions.length }));
    const dp = dailyPick(qz); const daily = dp ? { q: dp.x.q, choices: dp.x.choices, answer: dp.x.answer, explain: dp.x.explain, slug: dp.quiz.slug, title: dp.quiz.title } : null;
    const levelQ = qz.find((q) => q.mode === 'level'); const level = levelQ ? { slug: levelQ.slug, title: levelQ.title, n: levelQ.questions.length } : null;
    const artList = ar.slice(0, 12).map((a) => ({ slug: a.slug, title: a.title, cat: a.cat || '', desc: a.desc, image: a.image || '', mins: Math.max(2, Math.round(a.body.length / 900)) }));
    const inline = JSON.stringify({ products: shop.products, settings: shop.settings, coupons: shop.coupons || [], quizzes: quizList, articles: artList, daily, level, reviews: rvAll }).replace(/<\//g, '<\\/');
    out = out.replace('<!--SHOP-DATA-->', `<script>window.__SHOP__=${inline};</script>`);
    // ชื่อร้านจากหลังบ้าน (ถ้ายังไม่ตั้ง ใช้ชื่อแบรนด์) → ชื่อแท็บ/ผลค้นหา Google/พรีวิวของหน้าแรก
    const shopName = String(shop.settings.shopName || '').trim() || 'SheetLab ชีทสรุป TOEIC และแบบฝึกหัด';
    out = out.replace(/<title>[^<]*<\/title>/, `<title>${esc(shopName)}</title>`)
      .replace('<meta property="og:title" content="ร้านหนังสือ/ชีทเรียน">', `<meta property="og:title" content="${esc(shopName)}"><meta name="description" content="ชีทสรุป Grammar และคำศัพท์ TOEIC ภาษาไทย พร้อมแบบฝึกหัดและเฉลยละเอียด สแกนจ่ายแล้วดาวน์โหลดได้ทันที"><link rel="canonical" href="${NEW_SITE}/">`);
    const view = String(req.query.view || '');
    if (view === 'order' || view === 'checkout') { // หน้าหาออเดอร์ / หน้าชำระเงินหลายเล่ม: ไม่ต้องให้ Google เก็บ
      out = out.replace(/<title>[^<]*<\/title>/, view === 'checkout' ? '<title>ชำระเงิน · SheetLab</title>' : '<title>หาออเดอร์ของฉัน · SheetLab</title>')
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
        productLd(p, `${NEW_SITE}/p/${p.slug}`, desc, img, rvAll[p.id]),
      ].join('');
      out = out
        .replace(/<title>[^<]*<\/title>/, `<title>${esc(p.name)}</title>`)
        .replace(/<!--OG-START-->[\s\S]*?<!--OG-END-->/, tags);
    }
  } catch (e) {
    console.error(e); // ถ้าดึงข้อมูลไม่ได้ ก็เสิร์ฟหน้าปกติไปก่อน
  }
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  // หน้าร้าน/หน้าขาย: จำไว้แค่ 10 วินาที แก้หลังบ้านแล้วลูกค้าเห็นของใหม่แทบทันที (เดิม 60 วิ + เสิร์ฟของเก่าอีก 10 นาที)
  res.setHeader('Cache-Control', 'public, s-maxage=10, stale-while-revalidate=20');
  res.status(200).send(out);
}
