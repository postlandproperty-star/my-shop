// ทดสอบหน้าเว็บอัตโนมัติก่อนขึ้นเว็บ (รันเองทุกครั้งที่ git push ผ่าน .githooks/pre-push · รันเอง: npm test)
// เปิดหน้าจริงด้วย Chrome ในเครื่อง (ไม่แสดงหน้าต่าง) ทั้งขนาดมือถือและคอม ใช้ข้อมูลร้านชุดทดสอบ (tests/fixture-shop.json)
// และตอบ /api ปลอม ไม่แตะ Stripe/Supabase/เงินจริง · ตรวจ: error ในหน้า, หน้าล้นจอ, ปุ่มทับกัน, ตะกร้าคิดเงิน, โค้ดส่วนลด, หลังบ้านเปิดได้
// ผลลัพธ์ + ภาพหน้าจอทุกหน้าอยู่ใน tests/out/
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.join(ROOT, '..', 'src');
const OUT = path.join(ROOT, 'out');
const SHOP = JSON.parse(fs.readFileSync(path.join(ROOT, 'fixture-shop.json'), 'utf8'));
const CHROME = process.env.CHROME_PATH || ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/usr/bin/google-chrome', '/usr/bin/chromium'].find((p) => fs.existsSync(p));
const CODE = 'TYTEST01';
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');

fs.rmSync(OUT, { recursive: true, force: true }); fs.mkdirSync(OUT, { recursive: true });

// เซิร์ฟเวอร์หน้าเว็บในเครื่อง: ไฟล์ใน src/ ทุกเส้นทางที่ไม่ใช่ไฟล์ = index.html (เหมือน /p/slug บนเว็บจริง)
// หน้ารวมหัวข้อ SEO (เซิร์ฟเวอร์สร้าง): สร้างจาก lib/topics.js + ข้อมูลชุดทดสอบ ให้ตรวจหน้าตาเหมือนหน้าอื่น
const { TOPICS, topicItems, topicPage } = await import(path.join(ROOT, '..', 'lib/topics.js'));
const { vipPage } = await import(path.join(ROOT, '..', 'lib/vipPage.js'));
const T_ART = [{ slug: 'toeic-tense-guide', title: 'สรุป Tense ภาษาอังกฤษที่ออกสอบ TOEIC บ่อย พร้อมตัวอย่าง', desc: 'เจาะลึก Tense ที่ใช้บ่อยในข้อสอบ TOEIC Part 5 พร้อมตัวอย่าง', cat: 'grammar', body: 'x' }, { slug: 'toeic-mistakes', title: 'จับผิดไวยากรณ์ภาษาอังกฤษที่พบบ่อยในข้อสอบ TOEIC', desc: 'รวมจุดที่คนไทยเขียนผิดบ่อย', cat: 'grammar', body: 'x' }];
const T_QZ = [{ slug: 'toeic-level-test', title: 'วัดระดับ TOEIC ฟรี 20 ข้อ', cat: 'grammar', mode: 'level', questions: [1] }, { slug: 'toeic-tense-quiz', title: 'ข้อสอบ TOEIC Tense 10 ข้อ พร้อมเฉลย', desc: 'ลองทำข้อสอบ TOEIC Part 5 เรื่อง Tense 10 ข้อ พร้อมเฉลยและคำอธิบายภาษาไทยครบทุกข้อ', cat: 'grammar', questions: Array(10).fill(1) }, { slug: 'toeic-ctm', title: 'จับผิดประโยค TOEIC 10 ข้อ พิมพ์แก้เอง ตรวจใจดี', desc: 'แบบฝึกจับผิดประโยคภาษาอังกฤษแนว TOEIC 10 ข้อ พิมพ์ประโยคที่ถูกเอง', cat: 'grammar', questions: Array(10).fill(1) }];
const server = http.createServer((req, res) => {
  const u = decodeURIComponent(req.url.split('?')[0]);
  const vm = u.match(/^\/__vip\/(open|closed)$/); if (vm) { res.setHeader('Content-Type', 'text/html; charset=utf-8'); return res.end(vipPage(vm[1] === 'open' ? { open: true, monthly: 149, yearly: 1290, packs: { 1: 159, 3: 399, 12: 0 } } : { open: false, monthly: 0, yearly: 0, packs: { 1: 0, 3: 0, 12: 0 } }, { site: BASE })); }
  const tm = u.match(/^\/__topic\/([a-z-]+)$/); const tp = tm && TOPICS.find((x) => x.slug === tm[1]);
  if (tp) { res.setHeader('Content-Type', 'text/html; charset=utf-8'); return res.end(topicPage(tp, topicItems(tp, { articles: T_ART, quizzes: T_QZ, products: SHOP.products }), { site: BASE, all: TOPICS })); }
  const ti = u.match(/^\/topic-img\/([a-z-]+)\.jpg$/); if (ti) { const f = path.join(SRC, 'topics', ti[1] + '.jpg'); if (fs.existsSync(f)) { res.setHeader('Content-Type', 'image/jpeg'); return res.end(fs.readFileSync(f)); } res.statusCode = 404; return res.end(); }
  const f = path.join(SRC, u);
  if (u !== '/' && fs.existsSync(f) && fs.statSync(f).isFile()) return res.end(fs.readFileSync(f));
  res.setHeader('Content-Type', 'text/html; charset=utf-8'); res.end(fs.readFileSync(path.join(SRC, 'index.html')));
});
await new Promise((r) => server.listen(0, r));
const BASE = `http://127.0.0.1:${server.address().port}`;

const results = []; let failed = 0;
const pass = (name, ok, detail = '') => { results.push({ name, ok, detail }); if (!ok) failed++; console.log(`${ok ? '✓' : '✗'} ${name}${detail ? ' — ' + detail : ''}`); };

const browser = await chromium.launch({ executablePath: CHROME, headless: true });
const VIEWS = { mobile: { width: 375, height: 812, isMobile: true, hasTouch: true }, desktop: { width: 1280, height: 900 } };

async function newPage(kind) {
  const ctx = await browser.newContext({ viewport: { width: VIEWS[kind].width, height: VIEWS[kind].height }, isMobile: !!VIEWS[kind].isMobile, hasTouch: !!VIEWS[kind].hasTouch, deviceScaleFactor: 1 });
  await ctx.addInitScript((shop) => { window.__SHOP__ = shop; try { if (!sessionStorage.getItem('__t')) { localStorage.clear(); sessionStorage.setItem('__t', '1'); } } catch (e) {} }, SHOP); // ล้างครั้งแรกครั้งเดียว ตะกร้าอยู่ข้ามหน้าได้
  const page = await ctx.newPage();
  page.errors = [];
  page.on('pageerror', (e) => page.errors.push(String(e.message || e)));
  await page.route('**/*', async (route) => {
    const url = route.request().url();
    if (url.startsWith(BASE) && !/\/api\//.test(url)) return route.continue();
    if (/\/storage\/v1\/object\/public\//.test(url) || /\.(png|jpe?g|webp|gif)(\?|$)/i.test(url)) return route.fulfill({ status: 200, contentType: 'image/png', body: PNG });
    if (/fonts\.(googleapis|gstatic)\.com|connect\.facebook\.net|googletagmanager|facebook\.com\/tr/.test(url)) return route.fulfill({ status: 200, body: '' });
    if (/\/api\/checkout\?m=code/.test(url)) { const c = new URL(url).searchParams.get('code'); return route.fulfill({ json: c === CODE ? { ok: true, code: CODE, pct: 20 } : { ok: false, error: 'ไม่พบโค้ดนี้' } }); }
    if (/\/api\/checkout\?m=qr/.test(url)) return route.fulfill({ json: { ok: true, pi: 'pi_test', k: 'pi_test_secret', png: `${BASE}/qr.png`, amount: 1 } });
    if (/action=ads_auto(&|$)/.test(url) && AD) return route.fulfill({ json: { ok: true, items: [AD, LIVE], access: { ok: true, account: { currency: 'AUD' } } } }); // ร่างแอด 2 รูป + แอดทดสอบ 3 รูปที่วิ่งมา 6 วัน
    if (/action=ads_auto_status/.test(url) && AD) return route.fulfill({ json: { ok: true, access: { ok: true }, currency: 'AUD', rate: 0.04, history: [], ads: LIVE_ADS } });
    if (/action=vip_admin/.test(url)) return route.fulfill({ json: { ok: true, ready: false, sql: 'create table members (...);', settings: { open: false, monthly: 0, yearly: 0, packs: { 1: 0, 3: 0, 12: 0 } }, stats: null } });
    if (/m=vip_me/.test(url)) return route.fulfill({ json: { ok: true, email: null, active: false, settings: { open: true } } });
    if (/action=dash(&|$)/.test(url)) return route.fulfill({ json: { ok: false, error: 'ทดสอบ: โหลดตัวเลขไม่ได้' } }); // หน้าต้องไม่พังตอน API มีปัญหา
    if (/\/api\//.test(url)) return route.fulfill({ json: { ok: true, jobs: [], items: [], list: [], ads: [], checks: [], problems: [], history: [], posts: [], logs: [] } });
    if (/cdn\.jsdelivr\.net|cdnjs\.cloudflare\.com|unpkg\.com/.test(url)) return route.continue();
    return route.fulfill({ status: 200, json: [] });
  });
  return page;
}

// ตรวจหน้าจอทั่วไป: ไม่ล้นจอแนวนอน + ปุ่ม/ลิงก์/ช่องกรอกไม่ทับกัน (ไม่นับแถบที่ลอยติดจอโดยตั้งใจ)
async function layout(page, label) {
  const r = await page.evaluate(() => {
    const vw = innerWidth, sw = document.scrollingElement.scrollWidth;
    const floating = (el) => { for (let x = el; x && x !== document.body; x = x.parentElement) { const p = getComputedStyle(x).position; if (p === 'fixed' || p === 'sticky') return true; } return false; };
    const els = [...document.querySelectorAll('button, a[href], input:not([type=hidden]):not([type=radio]):not([type=checkbox]), select, textarea')]
      .filter((e) => { const b = e.getBoundingClientRect(), s = getComputedStyle(e); if (e.checkVisibility && !e.checkVisibility({ opacityProperty: true, visibilityProperty: true })) return false; return b.width > 4 && b.height > 4 && s.visibility !== 'hidden' && s.display !== 'none' && Number(s.opacity) > 0.05 && !floating(e) && !e.closest('[hidden]'); })
      .map((e) => ({ e, b: e.getBoundingClientRect(), r: [...e.getClientRects()].filter((x) => x.width > 2 && x.height > 2) })); // ลิงก์ที่ขึ้นบรรทัดใหม่: เทียบทีละบรรทัด
    const hits = [];
    for (let i = 0; i < els.length; i++) for (let j = i + 1; j < els.length; j++) {
      const A = els[i], B = els[j]; if (A.e.contains(B.e) || B.e.contains(A.e)) continue;
      // ปุ่มที่วางทับการ์ดของตัวเองโดยตั้งใจ (absolute อยู่ในกล่องเดียวกัน เช่น + เพิ่ม บนการ์ดสินค้า) ไม่นับ
      if (A.e.parentElement === B.e.parentElement && [A.e, B.e].some((x) => getComputedStyle(x).position === 'absolute')) continue;
      const over = A.r.some((a) => B.r.some((b) => { const w = Math.min(a.right, b.right) - Math.max(a.left, b.left), h = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top); return w > 2 && h > 2 && (w * h) / Math.min(a.width * a.height, b.width * b.height) > 0.3; }));
      if (over) hits.push(`${(A.e.textContent || A.e.name || A.e.tagName).trim().slice(0, 24)} ⟂ ${(B.e.textContent || B.e.name || B.e.tagName).trim().slice(0, 24)}`);
    }
    // ข้อความยาวที่ถูกบีบเป็นคอลัมน์แคบมาก (layout พัง)
    const narrow = [...document.querySelectorAll('b, p, h1, h2, h3, a > span, .fine')].filter((e) => { const r = e.getBoundingClientRect(), t = (e.textContent || '').trim(); return t.length > 30 && r.width > 0 && r.width < 110 && r.height > 60 && getComputedStyle(e).visibility !== 'hidden'; }).map((e) => (e.textContent || '').trim().slice(0, 30));
    return { overflow: sw > vw + 2 ? `${sw}px > ${vw}px` : '', hits: hits.slice(0, 5), narrow: narrow.slice(0, 3) };
  });
  pass(`${label}: ไม่ล้นจอ`, !r.overflow, r.overflow);
  pass(`${label}: ปุ่มไม่ทับกัน`, !r.hits.length, r.hits.join(' | '));
  pass(`${label}: ข้อความไม่ถูกบีบแคบ`, !r.narrow.length, r.narrow.join(' | '));
  if (page.errors.length) pass(`${label}: ไม่มี error ในหน้า`, false, page.errors.slice(0, 3).join(' | ')); else pass(`${label}: ไม่มี error ในหน้า`, true);
  page.errors.length = 0;
  await page.screenshot({ path: path.join(OUT, label.replace(/[^\w฀-๿-]+/g, '_') + '.png'), fullPage: false });
}

const pub = SHOP.products.filter((p) => p.status === 'published');
const bundle = pub.find((p) => p.type === 'bundle');
const single = pub.find((p) => p.type !== 'bundle' && Number(p.price) >= 1);
const inBundle = bundle && pub.find((p) => (bundle.items || []).includes(p.id) && p.type !== 'bundle');
const AD = bundle ? { id: 'ad-test', productId: bundle.id, name: bundle.name, status: 'pending', price: 990, image: 'https://x.supabase.co/storage/v1/object/public/product-images/ads/a.jpg', extra: ['https://x.supabase.co/storage/v1/object/public/product-images/ads/a.jpg', 'https://x.supabase.co/storage/v1/object/public/product-images/ads/b.jpg'], multi: ['https://x.supabase.co/storage/v1/object/public/product-images/ads/a.jpg', 'https://x.supabase.co/storage/v1/object/public/product-images/ads/b.jpg'], labels: { 'https://x.supabase.co/storage/v1/object/public/product-images/ads/a.jpg': 'ก ความเจ็บปวด' }, text: 'ข้อความทดสอบแอดยาวพอสมควรสำหรับทดสอบ', headline: 'ทดสอบ', description: 'ชุด 10 เล่ม', link: 'https://sheetlabth.com/p/x', dailyTHB: 100, days: 7, platforms: [] } : null;
const IMG = (n) => `https://x.supabase.co/storage/v1/object/public/product-images/ads/t${n}.jpg`;
const LIVE = bundle ? { id: 'ad-live', productId: bundle.id, name: bundle.name, status: 'live', campaign: 'auto-test', days: 7, launched_at: new Date(Date.now() - 6 * 864e5).toISOString(), fb: { campaign: '111', ads: ['901', '902', '903'] }, launchImages: [IMG(1), IMG(2), IMG(3)], labels: { [IMG(1)]: 'ก ความเจ็บปวด', [IMG(2)]: 'ข เป้าหมาย', [IMG(3)]: 'ค ความคุ้ม' }, text: 'x'.repeat(30), headline: 'h', dailyTHB: 100 } : null;
const wk = (s, c, b) => ({ spend: s / 25, impressions: c * 40, clicks: c, purchases: b, value: 0, spendTHB: s, valueTHB: b * 990, profitTHB: b * 990 - s });
const LIVE_ADS = [{ id: '901', name: 'auto-test · รูป 1', campaign: 'auto-test', campaignId: '111', status: 'ACTIVE', group: 'run', label: 'กำลังวิ่ง', todo: '', reasons: [], image: '', price: 990, week: wk(240, 30, 0) }, { id: '902', name: 'auto-test · รูป 2', campaign: 'auto-test', campaignId: '111', status: 'ACTIVE', group: 'run', label: 'กำลังวิ่ง', todo: '', reasons: [], image: '', price: 990, week: wk(260, 45, 3) }, { id: '903', name: 'auto-test · รูป 3', campaign: 'auto-test', campaignId: '111', status: 'ACTIVE', group: 'run', label: 'กำลังวิ่ง', todo: '', reasons: [], image: '', price: 990, week: wk(200, 20, 1) }];
const outside = bundle && pub.find((p) => p.type !== 'bundle' && Number(p.price) >= 1 && !(bundle.items || []).includes(p.id));

try {
  for (const kind of ['mobile', 'desktop']) {
    // 1) หน้าร้าน
    let page = await newPage(kind);
    await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' }); await page.waitForSelector('.st-grid', { timeout: 15000 });
    const hs = await page.evaluate(async () => { const im = document.querySelector('.st-tcard img'); if (im) { im.loading = 'eager'; await new Promise((r) => { if (im.complete) r(); else { im.onload = r; im.onerror = r; setTimeout(r, 3000); } }); }
      return { tiles: document.querySelectorAll('.st-topics .st-tcard').length, img: im ? im.naturalWidth : 0, faq: document.querySelectorAll('.st-faq details').length, cta: document.querySelector('.st-hcta a[href="/store"]') ? 1 : 0, nav: !!document.querySelector('.st-nav a[href="/store"]'), foot: document.querySelectorAll('.st-ftop a').length, cards: document.querySelectorAll('.st-grid .st-item').length, all: !!document.querySelector('.st-allbtn'), chips: document.querySelectorAll('.st-chips').length, daily: !!document.querySelector('.st-daily') }; });
    pass(`[${kind}] หน้าแรก: โล่ง (หัวข้อพร้อมรูป · ชีทแนะนำ ≤ 4 เล่ม + ปุ่มไปร้านค้า · ฝึกฟรี · FAQ) ไม่มีตัวกรอง/ข้อสอบประจำวัน`, hs.tiles === 3 && hs.img > 0 && hs.faq === 2 && hs.cta && hs.nav && hs.foot === 3 && hs.cards <= 4 && hs.cards > 0 && hs.all && !hs.chips && !hs.daily, JSON.stringify(hs));
    await layout(page, `[${kind}] หน้าแรก`);
    await page.screenshot({ path: path.join(OUT, `home-${kind}.png`), fullPage: true });
    // 1.5) ร้านค้าแยก /store: กดจากหน้าแรกแล้วไปหน้าร้านค้า (ไม่โหลดหน้าใหม่)
    await page.evaluate(() => document.querySelector('.st-hcta a[href="/store"]').click()); await page.waitForSelector('.st-cat', { timeout: 8000 });
    pass(`[${kind}] ร้านค้า /store: เปิดจากปุ่มหน้าแรก มีหัวร้าน แท็บหมวด + สินค้าครบ`, await page.locator('.st-shop h1').count() === 1 && await page.locator('.st-tabs button').count() >= 2 && await page.locator('.st-cat .st-item').count() === pub.filter((p) => p.type !== 'bundle').length && new URL(page.url()).pathname === '/store', `${await page.locator('.st-cat .st-item').count()} เล่ม`);
    if (bundle) {
      const pos = await page.evaluate(() => { const c = document.querySelector('.st-bundle'), b = document.querySelector('.st-badd'); if (!c || !b) return null; return { below: b.getBoundingClientRect().top >= c.getBoundingClientRect().bottom - 1 }; });
      pass(`[${kind}] ร้านค้า: ชุดมีปุ่ม + เพิ่ม อยู่ใต้การ์ด`, !!pos && pos.below);
    }
    { const pr = () => page.evaluate(() => [...document.querySelectorAll('.st-cat .st-grid .st-price strong')].map((e) => Number(e.textContent.replace(/[^\d.]/g, '')) || 0));
      await page.evaluate(() => document.querySelector('[data-a="ssort"][data-v="asc"]')?.click()); await page.waitForTimeout(150); const up = await pr();
      await page.evaluate(() => document.querySelector('[data-a="ssort"][data-v="desc"]')?.click()); await page.waitForTimeout(150); const dn = await pr();
      pass(`[${kind}] ร้านค้า: เรียงราคา ต่ำ→สูง และ สูง→ต่ำ ได้`, up.length > 1 && up.every((v, i) => !i || v >= up[i - 1]) && dn.every((v, i) => !i || v <= dn[i - 1]), `${up.join(',')} | ${dn.join(',')}`);
      await page.evaluate(() => document.querySelector('[data-a="ssort"][data-v="pop"]')?.click()); await page.waitForTimeout(150); }
    { const sticky = await page.evaluate(() => { scrollTo(0, 900); const b = document.querySelector('.st-bar'); return b ? Math.round(b.getBoundingClientRect().top) : -1; }); await page.evaluate(() => scrollTo(0, 0));
      pass(`[${kind}] ร้านค้า: แถบหมวดติดบนจอตอนเลื่อน`, sticky >= 0 && sticky <= 2, `top ${sticky}`); }
    await layout(page, `[${kind}] ร้านค้า /store`);
    await page.screenshot({ path: path.join(OUT, `store-${kind}.png`), fullPage: true });

    // 2) ตะกร้า: เล่มในชุด + เล่มนอกชุด + ชุด → เล่มในชุดถูกเอาออก ยอด = ชุด + เล่มนอกชุด · โค้ดลด 20%
    if (kind === 'mobile' && bundle && inBundle && outside) try {
      page.setDefaultTimeout(6000);
      await page.evaluate(([a, b]) => { for (const id of [a, b]) document.querySelector(`.st-add[data-id="${id}"]`)?.click(); }, [inBundle.id, outside.id]);
      await page.locator('.st-badd').click();
      const st = await page.evaluate(() => ({ cart: CART.slice(), total: cartTotal() }));
      const bp = Number(((bundle.plans || []).find((x) => x.key === bundle.planDefault && x.on !== false) || (bundle.plans || []).find((x) => x.on !== false && Number(x.price) >= 1) || {}).price);
      pass('ตะกร้า: เล่มที่อยู่ในชุดถูกเอาออก', !st.cart.includes(inBundle.id), st.cart.join(','));
      pass('ตะกร้า: ยอดรวม = ชุด + เล่มนอกชุด', st.total === bp + Number(outside.price), `${st.total} vs ${bp + Number(outside.price)}`);
      await page.evaluate(() => act('cartOpen', document.createElement('b')));
      await page.waitForSelector('.ct-sheet');
      await page.locator('.ct-sheet [data-a="codeOpen"]').click();
      await page.locator('#code-in').fill(CODE); await page.locator('.ct-sheet [data-a="codeApply"]').click();
      await page.waitForSelector('.ct-sheet .code-row.ok', { timeout: 5000 }).catch(() => {});
      const payTxt = await page.locator('.ct-pay').textContent();
      const want = Math.max(1, Math.round(st.total * 0.8)).toLocaleString('th-TH');
      pass('ตะกร้า: ใส่โค้ดแล้วยอดลด 20%', payTxt.includes(want), payTxt.trim());
      await layout(page, '[mobile] ตะกร้า');
      await page.goto(BASE + '/checkout', { waitUntil: 'domcontentloaded' }); await page.waitForTimeout(500);
      pass('หน้าชำระเงิน: มีรายการและยอดรวม', await page.locator('.ct-sum').count() === 1);
      await layout(page, '[mobile] หน้าชำระเงิน');
    } catch (e) { pass('ตะกร้าและโค้ดส่วนลด: ทดสอบจนจบ', false, String(e.message || e).split('\n')[0].slice(0, 160)); }
    await page.context().close();

    // 3) หน้าขายเล่มเดี่ยว และหน้าขายชุด
    for (const p of [single, bundle].filter(Boolean)) try {
      page = await newPage(kind); page.setDefaultTimeout(8000);
      await page.goto(`${BASE}/p/${p.slug}`, { waitUntil: 'domcontentloaded' }); await page.waitForTimeout(700);
      await page.screenshot({ path: path.join(OUT, `top-${kind}-${p.type === 'bundle' ? 'bundle' : 'single'}.png`) });
      if (p.type === 'bundle') pass(`[${kind}] หน้าขายชุด: ส่วนบนแบบเดียวกับเล่มเดี่ยว`, await page.locator('.spx .sp-band .now').count() === 1 && await page.locator('.spx [data-a="toCheckout"]').count() === 1);
      pass(`[${kind}] หน้าขาย ${p.type === 'bundle' ? 'ชุด' : 'เล่ม'}: มีปุ่มซื้อ`, await page.locator('[data-a="qrOpen"], [data-a="toCheckout"]').count() > 0);
      pass(`[${kind}] หน้าขาย ${p.type === 'bundle' ? 'ชุด' : 'เล่ม'}: มีปุ่ม + เพิ่ม`, await page.locator('[data-a="cartAdd"]').count() > 0);
      pass(`[${kind}] หน้าขาย ${p.type === 'bundle' ? 'ชุด' : 'เล่ม'}: แถบบนมีปุ่ม "ดูสินค้าทั้งหมด" ไป /store`, await page.locator('.sp-topbar a[href="/store"]').count() === 1);
      await page.locator('#checkout').scrollIntoViewIfNeeded().catch(() => {});
      await layout(page, `[${kind}] หน้าขาย ${p.type === 'bundle' ? 'ชุด' : 'เล่ม'}`);
      await page.context().close();
    } catch (e) { pass(`[${kind}] หน้าขาย ${p.slug}: ทดสอบจนจบ`, false, String(e.message || e).split('\n')[0].slice(0, 160)); }

    // 3.5) หน้ารวมหัวข้อ SEO (ทุกหัวข้อที่ขึ้น Google + 1 หัวข้อที่ยังรอเนื้อหา)
    for (const slug of ['toeic', 'toeic-grammar', 'ielts']) try {
      page = await newPage(kind); page.setDefaultTimeout(8000);
      await page.goto(`${BASE}/__topic/${slug}`, { waitUntil: 'domcontentloaded' }); await page.waitForTimeout(300);
      pass(`[${kind}] หัวข้อ ${slug}: มีส่วนหัวพร้อมภาพหรือข้อความ`, await page.locator('.thero h1').count() === 1);
      await page.waitForLoadState('load').catch(() => {});
      const ti = await page.evaluate(() => { const imgs = [...document.querySelectorAll('.thero-ban img, .tother img')].map((i) => { i.loading = 'eager'; return i; });
        const cards = [...document.querySelectorAll('.alist .acard')]; const c2 = cards[1]?.querySelector('.acov')?.getBoundingClientRect();
        return { ban: document.querySelector('.thero-ban img')?.naturalWidth || 0, others: imgs.length, cards: cards.length, c2w: c2 ? Math.round(c2.width) : 0, vw: innerWidth }; });
      pass(`[${kind}] หัวข้อ ${slug}: รูปหัวข้อจาก Canva ขึ้น`, ti.ban > 0, `naturalWidth ${ti.ban}`);
      if (slug !== 'ielts') pass(`[${kind}] หัวข้อ ${slug}: การ์ดบทความ/แบบทดสอบแบบใหม่ ${kind === 'mobile' ? '(ใบที่ 2 เป็นแถวรูปเล็ก)' : '(รูปบนเต็มการ์ด)'}`, ti.cards >= 2 && (kind === 'mobile' ? ti.c2w > 60 && ti.c2w < 140 : ti.c2w >= 200), `${ti.cards} การ์ด รูปใบ 2 กว้าง ${ti.c2w}px`);
      await layout(page, `[${kind}] หัวข้อ ${slug}`); await page.screenshot({ path: path.join(OUT, `topic-${slug}-${kind}.png`), fullPage: true });
      await page.context().close();
    } catch (e) { pass(`[${kind}] หัวข้อ ${slug}: ทดสอบจนจบ`, false, String(e.message || e).split('\n')[0].slice(0, 160)); }

    // 3.6) หน้าสมาชิก VIP: ยังไม่เปิด = "เร็วๆ นี้" · เปิดแล้ว = ราคาจากหลังบ้าน + ปุ่มสมัคร + ฟอร์มเข้าระบบด้วยอีเมล
    for (const mode of ['closed', 'open']) try {
      page = await newPage(kind); page.setDefaultTimeout(8000);
      await page.goto(`${BASE}/__vip/${mode}`, { waitUntil: 'domcontentloaded' }); await page.waitForTimeout(500);
      const v = await page.evaluate(() => ({ soon: document.body.innerText.includes('เร็วๆ นี้'), buy: document.querySelectorAll('.vp-buy').length, packs: document.querySelectorAll('.vp-pack').length, login: !!document.querySelector('#vp-login') }));
      pass(`[${kind}] VIP ${mode === 'open' ? 'เปิดรับ: ราคา 2 แบบบัตร + PromptPay 2 แบบ + ฟอร์มเข้าระบบ' : 'ยังไม่เปิด: ขึ้นเร็วๆ นี้ ไม่มีปุ่มสมัคร'}`, mode === 'open' ? v.buy === 2 && v.packs === 2 && v.login && !v.soon : v.soon && !v.buy && !v.packs, JSON.stringify(v));
      await layout(page, `[${kind}] หน้า VIP ${mode}`);
      if (mode === 'open') await page.screenshot({ path: path.join(OUT, `vip-${kind}.png`), fullPage: true });
      await page.context().close();
    } catch (e) { pass(`[${kind}] หน้า VIP ${mode}: ทดสอบจนจบ`, false, String(e.message || e).split('\n')[0].slice(0, 160)); }

    // 4) หลังบ้าน (จำลองล็อกอิน ข้อมูลจาก /api ปลอม): ทุกแท็บหลัก + โรงงาน + ตัวแก้ชุด ต้องเปิดได้ไม่พัง
    page = await newPage(kind);
    await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' }); await page.waitForSelector('.st-grid');
    const views = [['home', 'ภาพรวม'], ['todo', 'เช็คลิสต์'], ['orders', 'ออเดอร์'], ['products', 'สินค้า'], ['ads', 'โฆษณา'], ['seo', 'SEO'], ['factory', 'โรงงาน'], ['bundle', 'แก้ไขชุด']];
    for (const [v, name] of views) {
      const err = await page.evaluate(([v, bid]) => {
        try {
          // ล็อกอินปลอม: Supabase จำลอง (ทุกคำสั่งคืนค่าว่าง) · เรียก /api จริงของหน้า แต่ถูกตอบด้วยข้อมูลปลอมจาก route ด้านบน
          const chain = new Proxy(function () {}, { get: (t, k) => k === 'then' ? (res) => res({ data: [], error: null }) : chain, apply: () => chain });
          sbSession = { user: { email: 'test@example.com' }, access_token: 'test' };
          sb = { auth: { getSession: async () => ({ data: { session: sbSession } }), refreshSession: async () => ({ data: { session: null } }), onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }) }, from: () => chain, storage: { from: () => chain } };
          window.hasAdminAccess = () => true;
          if (v === 'factory') { S.view = 'factory'; FJOBS = null; }
          else if (v === 'bundle') { S.view = 'admin'; S.tab = 'products'; const b = getProduct(bid); S.draft = bundleDraft(b); S.edit = bid; }
          else { S.view = 'admin'; S.tab = v; S.edit = null; S.draft = null; }
          render(false); return '';
        } catch (e) { return String(e && e.stack || e).slice(0, 300); }
      }, [v, bundle && bundle.id]);
      await page.waitForTimeout(400);
      pass(`[${kind}] หลังบ้าน ${name}: เปิดได้`, !err, err);
      if (v === 'seo') { await page.waitForTimeout(400); pass(`[${kind}] SEO: การ์ดสมาชิก VIP (ยังไม่มีตาราง → ขึ้น SQL ให้คัดลอก + ช่องราคา)`, await page.locator('.vipa .vipsql').count() === 1 && await page.locator('#vip-m').count() === 1); }
      if (v === 'ads' && AD) { await page.waitForTimeout(400); pass(`[${kind}] โฆษณา: ร่างแอดเลือกไว้ 2 รูป`, await page.locator('.adq-pick.on').count() === 2);
        const t = await page.evaluate(() => { const c = document.querySelector('.adtest'); return c ? { win: (c.querySelector('.adt-cell.win b') || {}).textContent || '', lose: c.querySelectorAll('.adt-cell.lose').length, pause: !!c.querySelector('[data-a="adTestPause"]'), remake: !!c.querySelector('[data-a="adTestRemake"]') } : null; });
        pass(`[${kind}] โฆษณา: ผลทดสอบรูป รูป ข ชนะ + แนะนำหยุด ก และ ค (แพงกว่า 1.5 เท่า)`, !!t && /ข เป้าหมาย/.test(t.win) && t.lose === 2 && t.pause && t.remake, JSON.stringify(t)); if (t) await page.locator('.adtest').first().screenshot({ path: path.join(OUT, `adtest-${kind}.png`) });
        const tap = (sel) => page.evaluate((q) => document.querySelector(q)?.click(), sel);
        await tap('[data-a="adsExtOpen"]'); await page.waitForTimeout(200); await tap('[data-a="adsExtAngle"][data-v="cover"]'); await page.waitForTimeout(200);
        await tap('[data-a="adsExtSize"][data-v="916"]'); await page.waitForTimeout(200);
        const vv = await page.evaluate(() => { const x = ADA.items.find((y) => y.id === 'ad-test'), v = adVariants(getProduct(x.productId)); document.querySelector('[data-a="adsAiOpen"][data-id="ad-test"]')?.click(); return { n: v.length, uniq: new Set(v.map((z) => z.prompt.split('\n')[0])).size, labels: v.map((z) => z.label).join(','), noOne: v.every((z) => !/เล่มเดียว/.test(z.prompt)), btn: !!document.querySelector('[data-a="adsAiVar"]') }; });
        pass(`[${kind}] โฆษณา: ปุ่มสร้าง 3 แบบที่ต่างกัน (ฉาก/ข้อความไม่ซ้ำ)`, vv.n === 3 && vv.uniq === 3 && vv.noOne && vv.btn, JSON.stringify(vv));
        await page.evaluate(() => document.querySelector('[data-a="adsAiOpen"][data-id="ad-test"]')?.click());
        const hk = await page.evaluate(() => (document.querySelector('[id^="adext-hook-"]') || {}).value || '');
        pass(`[${kind}] โฆษณา: ข้อความบนรูปของชุดไม่พูดว่า "เล่มเดียว" และบอกจำนวนเล่ม`, !/เล่มเดียว/.test(hk) && /ครบ \d+ เล่ม/.test(hk), hk.replace(/\n/g, ' / '));
        const ep = await page.evaluate(() => { const t = document.querySelector('.adq-extp'); return t ? t.value : ''; });
        pass(`[${kind}] โฆษณา: ปุ่มสร้าง prompt ไปทำรูปเอง (มีชื่อสินค้า ข้อความไทย แนวปกเด่น ขนาด 9:16)`, /9:16/.test(ep) && /250px/.test(ep) && /SheetLab/.test(ep) && /[\u0E00-\u0E7F]/.test(ep) && /royal-blue/.test(ep), ep.slice(0, 80));
        await tap('[data-a="adsExtOpen"]'); await page.waitForTimeout(150);
        const fl = await page.evaluate(() => [...document.querySelectorAll('.adflow')].map((f) => [...f.children].findIndex((c) => c.classList.contains('cur'))));
        pass(`[${kind}] โฆษณา: แถบขั้นตอน (ร่าง = ขั้น 1, ทดสอบวันที่ 6 = ขั้น 4)`, fl.includes(0) && fl.includes(3), JSON.stringify(fl));
        const d = page.locator('.adq-wrap').first(); if (await d.count()) await d.screenshot({ path: path.join(OUT, `adflow-${kind}.png`) }); }
      if (v === 'products' && bundle) { // เมนู "ดูเพิ่มเติม" ของชุด: มีปุ่มเอาไปโฆษณา และทำหน้าตัวอย่างใหม่
        await page.evaluate((bid) => { S.pmore = bid; render(true); }, bundle.id);
        pass(`[${kind}] สินค้า: ชุดมีปุ่มเอาไปโฆษณา + หน้าตัวอย่างหน้า 3`, await page.locator(`[data-a="adsDraftOne"][data-id="${bundle.id}"]`).count() === 1 && await page.locator(`[data-a="pvRedoSet"][data-id="${bundle.id}"]`).count() === 1);
      }
      await layout(page, `[${kind}] หลังบ้าน ${name}`);
    }
    await page.context().close();
  }
} catch (e) {
  pass('ทดสอบรันจนจบ', false, String(e.message || e).slice(0, 300));
} finally {
  await browser.close(); server.close();
}
fs.writeFileSync(path.join(OUT, 'results.json'), JSON.stringify({ at: new Date().toISOString(), failed, results }, null, 1));
console.log(`\n${failed ? `✗ ไม่ผ่าน ${failed} จาก ${results.length}` : `✓ ผ่านทั้งหมด ${results.length} ข้อ`} · ภาพหน้าจอ: tests/out/`);
process.exit(failed ? 1 : 0);
