// เสิร์ฟหน้าเซลเพจ /p/:slug พร้อมแท็ก Open Graph ของสินค้านั้น
// (Facebook/LINE อ่านพรีวิวจาก HTML ดิบ ไม่รอ JavaScript จึงต้องใส่ฝั่งเซิร์ฟเวอร์)
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { newSiteLive, NEW_SITE } from '../lib/site.js';
import { policyPage, POLICY_DOCS } from '../lib/policies.js';
import { quizPage, quizIndex, articlePage, articleIndex, dailyPick, dailyPage } from '../lib/quiz.js';
import { sbSelect } from '../lib/shop.js';
import { TOPICS, topicItems, topicReady, topicCount, topicPage } from '../lib/topics.js';
import { STORE_FAQ, storeFaqLd } from '../lib/storefaq.js';
import { vipPage, vipReviewPage } from '../lib/vipPage.js';
import { loadVip } from '../lib/members.js';
import { TRACK_JS } from '../lib/insights.js';

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
  if (seo === 'feed') { // ฟีดสินค้า Google Merchant Center: ทุกสินค้าที่เผยแพร่และมีราคา (สินค้าใหม่เข้าเองอัตโนมัติ) Google ดึงวันละครั้ง
    const shop = await loadShop().catch(() => ({ products: [] }));
    const x = (v) => String(v ?? '').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    const live = shop.products.filter((q) => q.status === 'published' && /^[a-z0-9-]+$/.test(q.slug || '') && Number(q.price) >= 1 && (q.images || []).length);
    const notion = (q) => q.cat === 'notion' || /^notion-/.test(q.slug || '') || /Notion Template/i.test(q.specs || '');
    const items = live.map((q) => {
      const price = Number(q.price), full = Number(q.fullPrice) || 0, imgs = (q.images || []).filter((u) => /^https:\/\//.test(u));
      const bundle = q.type === 'bundle';
      const desc = [q.headline, q.desc].filter(Boolean).join(' · ').replace(/\s+/g, ' ').slice(0, 4900) || q.name;
      return `  <item>
    <g:id>${x(q.id)}</g:id>
    <title>${x(String(q.name).slice(0, 150))}</title>
    <description>${x(desc)}</description>
    <link>${NEW_SITE}/p/${x(q.slug)}</link>
    <g:image_link>${x(imgs[0])}</g:image_link>
${imgs.slice(1, 10).map((u) => `    <g:additional_image_link>${x(u)}</g:additional_image_link>\n`).join('')}    <g:availability>in_stock</g:availability>
    <g:price>${(full > price ? full : price).toFixed(2)} THB</g:price>
${full > price ? `    <g:sale_price>${price.toFixed(2)} THB</g:sale_price>\n` : ''}    <g:condition>new</g:condition>
    <g:brand>SheetLab</g:brand>
    <g:identifier_exists>no</g:identifier_exists>
    <g:product_type>${x(notion(q) ? 'Notion Template' : bundle ? 'ชุดชีทสรุป PDF' : 'ชีทสรุป PDF / หนังสือ TOEIC')}</g:product_type>
    <g:google_product_category>${notion(q) ? '5032' : '784'}</g:google_product_category>
${bundle ? '    <g:is_bundle>yes</g:is_bundle>\n' : ''}    <g:shipping><g:country>TH</g:country><g:service>ดาวน์โหลดทันที</g:service><g:price>0.00 THB</g:price></g:shipping>
  </item>`;
    });
    res.setHeader('Content-Type', 'application/xml; charset=utf-8'); res.setHeader('Cache-Control', 'public, s-maxage=600');
    return res.status(200).send(`<?xml version="1.0" encoding="UTF-8"?>\n<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">\n<channel>\n  <title>SheetLab</title>\n  <link>${NEW_SITE}</link>\n  <description>ชีทสรุป TOEIC และ Notion Template</description>\n${items.join('\n')}\n</channel>\n</rss>\n`);
  }
  if (seo === 'sitemap') { // รายการหน้าที่ลูกค้าเปิดได้ (เฉพาะสินค้าที่เผยแพร่แล้ว)
    const shop = await loadShop().catch(() => ({ products: [] }));
    const today = new Date().toISOString().slice(0, 10);
    const [quizzes, articles] = await Promise.all([loadQuizzes(), loadArticles()]);
    const topics = TOPICS.filter((t) => topicReady(topicItems(t, { articles, quizzes, products: shop.products }))).map((t) => `/topic/${t.slug}`);
    const urls = ['/', '/store', ...topics, ...(articles.length ? ['/learn', ...articles.map((a) => `/learn/${a.slug}`)] : []), ...shop.products.filter((x) => x.status === 'published' && /^[a-z0-9-]+$/.test(x.slug || '')).map((x) => `/p/${x.slug}`), ...(quizzes.length ? ['/quiz', ...quizzes.map((q) => `/quiz/${q.slug}`)] : []), '/privacy', '/refund'];
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
  const brand = String(req.query.brand || '');
  if (brand) { // โลโก้ร้าน (ทำจาก Canva) ไอคอนแท็บ/หน้าจอมือถือ ไฟล์อยู่ใน src/brand
    if (!/^(favicon\.ico|apple-touch-icon\.png|icon-(32|48|192|512)\.png)$/.test(brand)) return res.status(404).end();
    let buf = null; try { buf = readFileSync(join(process.cwd(), 'src', 'brand', brand)); } catch (e) {}
    if (!buf) return res.status(404).end();
    res.setHeader('Content-Type', brand.endsWith('.ico') ? 'image/x-icon' : 'image/png'); res.setHeader('Cache-Control', 'public, max-age=604800, s-maxage=2592000');
    return res.status(200).end(buf);
  }
  const vipQ = String(req.query.vip || '');
  if (vipQ === 'home' || vipQ === 'review') { // สมาชิก VIP (/vip) และสมุดจุดพลาด (/vip/review)
    res.setHeader('Content-Type', 'text/html; charset=utf-8'); res.setHeader('Cache-Control', 'no-store');
    const shop = await loadShop().catch(() => ({ settings: {} }));
    if (vipQ === 'review') return res.status(200).send(vipReviewPage({ settings: shop.settings, site: NEW_SITE }));
    return res.status(200).send(vipPage(await loadVip(), { settings: shop.settings, site: NEW_SITE }));
  }
  const timg = String(req.query.timg || '');
  if (timg) { // รูปหัวข้อจาก Canva /topic-img/<slug>.jpg (ไฟล์อยู่ใน src/topics)
    const t = TOPICS.find((x) => x.slug === timg.replace(/\.jpg$/, ''));
    let buf = null; if (t) try { buf = readFileSync(join(process.cwd(), 'src', 'topics', `${t.slug}.jpg`)); } catch (e) {}
    if (!buf) return res.status(404).end();
    res.setHeader('Content-Type', 'image/jpeg'); res.setHeader('Cache-Control', 'public, max-age=86400, s-maxage=2592000');
    return res.status(200).end(buf);
  }
  const topic = String(req.query.topic || '');
  if (topic) { // หน้ารวมตามหัวข้อ /topic/<slug>
    const t = TOPICS.find((x) => x.slug === topic);
    const [shop, articles, quizzes] = await Promise.all([loadShop().catch(() => ({ products: [], settings: {} })), loadArticles(), loadQuizzes()]);
    res.setHeader('Content-Type', 'text/html; charset=utf-8'); res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600');
    const live = TOPICS.filter((x) => topicReady(topicItems(x, { articles, quizzes, products: shop.products })));
    if (!t) { res.statusCode = 404; return res.end(topicPage(TOPICS[0], topicItems(TOPICS[0], { articles, quizzes, products: shop.products }), { settings: shop.settings, site: NEW_SITE, all: live })); }
    return res.status(200).send(topicPage(t, topicItems(t, { articles, quizzes, products: shop.products }), { settings: shop.settings, site: NEW_SITE, all: live }));
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
    const topics = TOPICS.map((t) => { const it = topicItems(t, { articles: ar, quizzes: qz, products: shop.products }); return topicReady(it) ? { slug: t.slug, name: t.name, n: topicCount(it) } : null; }).filter(Boolean); // หน้ารวมหัวข้อที่มีเนื้อหาแล้ว (หน้าร้านโชว์เป็นทางลัด)
    const inline = JSON.stringify({ products: shop.products, settings: shop.settings, coupons: shop.coupons || [], quizzes: quizList, articles: artList, daily, level, reviews: rvAll, topics, faq: STORE_FAQ }).replace(/<\//g, '<\\/');
    out = out.replace('<!--SHOP-DATA-->', `<script>window.__SHOP__=${inline};</script>`);
    // ชื่อร้านจากหลังบ้าน (ถ้ายังไม่ตั้ง ใช้ชื่อแบรนด์) → ชื่อแท็บ/ผลค้นหา Google/พรีวิวของหน้าแรก
    const shopName = String(shop.settings.shopName || '').trim() || 'SheetLab ชีทสรุป TOEIC และแบบฝึกหัด';
    out = out.replace(/<title>[^<]*<\/title>/, `<title>${esc(shopName)}</title>`)
      .replace('<meta property="og:title" content="ร้านหนังสือ/ชีทเรียน">', `<meta property="og:title" content="${esc(shopName)}"><meta name="description" content="ชีทสรุป TOEIC ภาษาไทย Grammar คำศัพท์ Reading Listening และ IELTS พร้อมข้อสอบฟรีมีเฉลย ดูหน้าตัวอย่างก่อนซื้อ สแกนจ่ายแล้วดาวน์โหลดได้ทันที"><link rel="canonical" href="${NEW_SITE}/">`);
    const view = String(req.query.view || '');
    if (view === 'order' || view === 'checkout') { // หน้าหาออเดอร์ / หน้าชำระเงินหลายเล่ม: ไม่ต้องให้ Google เก็บ
      out = out.replace(/<title>[^<]*<\/title>/, view === 'checkout' ? '<title>ชำระเงิน · SheetLab</title>' : '<title>หาออเดอร์ของฉัน · SheetLab</title>')
        .replace(/<!--OG-START-->[\s\S]*?<!--OG-END-->/, '<meta name="robots" content="noindex">');
    }
    const live = shop.products.filter((x) => x.status === 'published' && /^[a-z0-9-]+$/.test(x.slug || ''));
    if (view === 'store') { // ร้านค้าแยก /store: รายการสินค้าล้วน (หน้าแรกเป็นหน้าแนะนำสำหรับคนจาก Google)
      out = out.replace(/<title>[^<]*<\/title>/, '<title>ร้านค้า SheetLab ชีทสรุป TOEIC IELTS และ Notion Template</title>').replace(`<link rel="canonical" href="${NEW_SITE}/">`, `<link rel="canonical" href="${NEW_SITE}/store">`);
      const ld = { '@context': 'https://schema.org', '@type': 'ItemList', name: 'ร้านค้า SheetLab', itemListElement: live.map((x, i) => ({ '@type': 'ListItem', position: i + 1, url: `${NEW_SITE}/p/${x.slug}`, name: x.name })) };
      out = out.replace('<!--OG-END-->', `<script type="application/ld+json">${JSON.stringify(ld).replace(/</g, '\\u003c')}</script><!--OG-END-->`);
    }
    if (!slug && !view && live.length >= 2) { // หน้าแรกเป็นหน้าร้าน: บอก Google ว่ามีสินค้าอะไรบ้าง
      const ld = { '@context': 'https://schema.org', '@type': 'ItemList', name: shopName, itemListElement: live.map((x, i) => ({ '@type': 'ListItem', position: i + 1, url: `${NEW_SITE}/p/${x.slug}`, name: x.name })) };
      out = out.replace('<!--OG-END-->', `<script type="application/ld+json">${JSON.stringify(ld).replace(/</g, '\\u003c')}</script><script type="application/ld+json">${JSON.stringify(storeFaqLd()).replace(/</g, '\\u003c')}</script><!--OG-END-->`);
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
  res.status(200).send(out.replace('</body>', `${TRACK_JS}</body>`)); // เก็บพฤติกรรมคนเข้าเว็บ (ไม่นับเครื่องแอดมิน)
}
