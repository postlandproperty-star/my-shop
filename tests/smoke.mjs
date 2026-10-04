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
const { vipPage, accountPage, vipMockPage, appPage } = await import(path.join(ROOT, '..', 'lib/vipPage.js'));
const { SITE_NAV } = await import(path.join(ROOT, '..', 'lib/quiz.js'));
const MOCK_Q = [0, 1, 2].map((i) => ({ quiz: 'toeic-tense-quiz', cat: 'grammar', title: 'Tense', i, q: `She ___ here since ${2020 + i}.`, choices: ['has worked', 'work', 'working', 'works'], answer: 0, explain: 'since → Present Perfect' }));
const MARKS = [];
const { freePage, FREEBIES } = await import(path.join(ROOT, '..', 'lib/free.js'));
const T_ART = [{ slug: 'toeic-tense-guide', title: 'สรุป Tense ภาษาอังกฤษที่ออกสอบ TOEIC บ่อย พร้อมตัวอย่าง', desc: 'เจาะลึก Tense ที่ใช้บ่อยในข้อสอบ TOEIC Part 5 พร้อมตัวอย่าง', cat: 'grammar', body: 'x' }, { slug: 'toeic-mistakes', title: 'จับผิดไวยากรณ์ภาษาอังกฤษที่พบบ่อยในข้อสอบ TOEIC', desc: 'รวมจุดที่คนไทยเขียนผิดบ่อย', cat: 'grammar', body: 'x' }];
const T_QZ = [{ slug: 'toeic-level-test', title: 'วัดระดับ TOEIC ฟรี 20 ข้อ', cat: 'grammar', mode: 'level', questions: [1] }, { slug: 'toeic-tense-quiz', title: 'ข้อสอบ TOEIC Tense 10 ข้อ พร้อมเฉลย', desc: 'ลองทำข้อสอบ TOEIC Part 5 เรื่อง Tense 10 ข้อ พร้อมเฉลยและคำอธิบายภาษาไทยครบทุกข้อ', cat: 'grammar', questions: Array(10).fill(1) }, { slug: 'toeic-ctm', title: 'จับผิดประโยค TOEIC 10 ข้อ พิมพ์แก้เอง ตรวจใจดี', desc: 'แบบฝึกจับผิดประโยคภาษาอังกฤษแนว TOEIC 10 ข้อ พิมพ์ประโยคที่ถูกเอง', cat: 'grammar', questions: Array(10).fill(1) }];
const server = http.createServer((req, res) => {
  const u = decodeURIComponent(req.url.split('?')[0]);
  if (u === '/__free') { res.setHeader('Content-Type', 'text/html; charset=utf-8'); return res.end(freePage(FREEBIES[0], { site: BASE, upsell: SHOP.products.find((p) => p.status === 'published' && p.type !== 'bundle') })); }
  const fi = u.match(/^\/free-(img|file)\/([\w.-]+)$/); if (fi) { const f = path.join(SRC, 'free', fi[2]); if (fs.existsSync(f)) return res.end(fs.readFileSync(f)); res.statusCode = 404; return res.end(); }
  if (u === '/__app') { res.setHeader('Content-Type', 'text/html; charset=utf-8'); return res.end(appPage({ site: BASE })); }
  if (u === '/__account' || u === '/__mock') { res.setHeader('Content-Type', 'text/html; charset=utf-8'); return res.end(u === '/__account' ? accountPage({ site: BASE }) : vipMockPage({ site: BASE })); }
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

const COVER_CALLS = [];
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
    if (/action=cover/.test(url)) { try { COVER_CALLS.push(JSON.parse(route.request().postData() || '{}')); } catch (e) {} return route.fulfill({ json: { ok: true, image: 'data:image/png;base64,' + PNG.toString('base64') } }); }
    if (/\/api\/order\?m=free/.test(url)) return route.fulfill({ json: { ok: true, file: `${BASE}/free-file/toeic-confusing-50.pdf` } });
    if (/action=insights/.test(url)) return route.fulfill({ json: { ok: true, ready: true, events: 120, totals: { sessions: 40, views: 90, bounce: 55, perSession: 2.3, mobile: 80 }, daily: [{ d: '2026-10-01', n: 12 }, { d: '2026-10-02', n: 28 }], funnel: { product: 30, add: 8, buy: 6, pay: 4, paid: 2 }, pages: [{ p: '/learn/toeic-tense-guide', views: 20, avg: 140, pct75: 40, pct100: 25, exitRate: 50, exits: 10 }], articles: [{ p: '/learn/toeic-tense-guide', views: 20, avg: 140, pct100: 25 }], exits: [{ p: '/p/x', exits: 6, exitRate: 60 }], clicks: [{ k: 'cartAdd', n: 9 }, { k: 'link:/p/toeic-750', n: 5 }, { k: 'out:m.me', n: 2 }], sources: [{ k: 'google', n: 20 }, { k: 'ad:toeic-checkout', n: 10 }], orderSources: [{ k: 'fb-toeic-test', n: 2 }], quizzes: [{ slug: 'toeic-tense-quiz', starts: 10, done: 6, avg: 70 }], hardest: [{ slug: 'toeic-tense-quiz', i: 3, rate: 20, n: 10 }] } });
    if (/action=vip_admin/.test(url)) return route.fulfill({ json: { ok: true, ready: false, sql: 'create table members (...);', settings: { open: false, monthly: 0, yearly: 0, packs: { 1: 0, 3: 0, 12: 0 }, page: { title: 'SheetLab VIP', sub: 'ฝึกต่อเนื่อง', perks: [{ t: 'คลังข้อสอบ', free: true, vip: 'yes' }, { t: 'สมุดจุดพลาด', free: false, vip: 'yes' }], faq: [{ q: 'ต้องตั้งรหัสไหม', a: 'ไม่ต้อง' }] } }, stats: null } });
    if (/action=idea(&|$)/.test(url)) return route.fulfill({ json: { ok: true, want: 3, ideas: [{ title: 'IELTS Listening 10 ชุด', price: 199 }, { title: 'IELTS Reading 10 ชุด' }, { title: 'IELTS Writing 50 หัวข้อ', price: 179 }] } });
    if (/action=shopee_copy/.test(url)) return route.fulfill({ json: { ok: true, ai: true, text: '📘 หนังสือเล่มพิมพ์ A4 ทดสอบ' } });
    if (/action=factory_library/.test(url)) return route.fulfill({ json: { ok: true, at: new Date().toISOString(), ssd: true, running: { note: 'TOEIC Part 7 อ่านเร็ว\nabc', since: new Date().toISOString() }, books: [{ no: '046', day: '2026-10-04', title: 'HOME & DAILY LIFE VOCABULARY 600', cat: 'คลังคำศัพท์', pages: 91, mb: 2, where: 'SSD', audio: false, thumb: '' }, { no: '044', sku: 'SL-044', day: '2026-10-04', title: 'HEALTH & DOCTOR ENGLISH 400', cat: 'ฝึกพูด - สนทนา', pages: 80, mb: 3, where: 'Mac', audio: true, audio_path: '/Users/x/Documents/Academic/ฝึกพูด/HEALTH/audio', audio_drive: '', audio_target: 'https://drive.google.com/drive/folders/1BJ5' , thumb: '' }], sets: [{ name: 'TOEIC 750+ ครบชุด', n: 9, where: 'SSD' }] } });
    if (/m=vip_acct/.test(url)) return route.fulfill({ json: { ok: true, email: 'buyer@test.co', orders: [{ at: '2026-10-01T03:00:00Z', name: 'ชุด TOEIC 750+', amount: 390, items: [{ name: 'TOEIC Grammar', link: 'https://x.supabase.co/storage/v1/object/public/files/a.pdf' }, { name: 'Study Planner', link: 'https://www.notion.so/x' }] }], more: false, vip: { active: true, until: '2026-11-04T00:00:00Z', card: false }, review: 3, settings: { open: true } } });
    if (/m=vip_mock/.test(url)) return route.fulfill({ json: route.request().method() === 'POST' ? { ok: true, k: 'mini', name: 'ฝึกเร็ว ทุกหมวด', n: 3, mins: 1, questions: MOCK_Q } : { ok: true, email: 'buyer@test.co', active: true, open: true, kinds: [{ k: 'mini', name: 'ฝึกเร็ว ทุกหมวด', desc: 'สุ่มจากคลัง', n: 3, mins: 1 }, { k: 'toeic', name: 'TOEIC แนว Part 5–7', desc: 'ไวยากรณ์', n: 30, mins: 18 }] } });
    if (/m=vip_marks/.test(url)) { try { MARKS.push(...JSON.parse(route.request().postData() || '{}').items); } catch (e) {} return route.fulfill({ json: { ok: true, saved: 3 } }); }
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
    { const b = await page.evaluate(() => { const el0 = document.querySelector('.st-hcta a'); render(true); const same = el0 === document.querySelector('.st-hcta a');
        window.hasAdminAccess = () => true; sbSession = { user: { email: 't@e.st' } }; render(false); const bar = document.getElementById('bar'); const shown = getComputedStyle(bar).display !== 'none' && !!bar.querySelector('[data-a="toVip"]');
        PTR = 1; const before = document.querySelector('.st-hcta a'); S.tick = (S.tick || 0) + 1; render(true); const kept = before === document.querySelector('.st-hcta a'); PTR = 0;
        window.hasAdminAccess = () => false; sbSession = null; render(false); return { same, shown, kept }; });
      pass(`[${kind}] วาดหน้าใหม่ไม่แย่งคลิก (หน้าเหมือนเดิมไม่แตะปุ่ม · กดค้างอยู่ไม่วาดทับ) + แถบหลังบ้านตามแอดมินทุกหน้า`, b.same && b.shown && b.kept, JSON.stringify(b)); }
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
      await layout(page, `[${kind}] หัวข้อ ${slug}`);
      if (slug === 'toeic') { await page.evaluate(() => localStorage.setItem('sb-lpeqaorswhwzlplsaqpe-auth-token', JSON.stringify({ user: { email: 'owner@test.co' } }))); await page.reload({ waitUntil: 'domcontentloaded' }); await page.waitForTimeout(300);
        const ab = await page.evaluate(() => { const b = document.querySelector('.adm-bar'); return b ? [...b.querySelectorAll('a')].map((a) => a.getAttribute('href')).join(' ') : ''; });
        pass(`[${kind}] หน้าหัวข้อ: แอดมินเห็นแถบหลังบ้าน (ลูกค้าไม่เห็น)`, /#admin/.test(ab) && /#factory/.test(ab) && /#vip/.test(ab), ab);
        await page.evaluate(() => localStorage.removeItem('sb-lpeqaorswhwzlplsaqpe-auth-token')); } await page.screenshot({ path: path.join(OUT, `topic-${slug}-${kind}.png`), fullPage: true });
      await page.context().close();
    } catch (e) { pass(`[${kind}] หัวข้อ ${slug}: ทดสอบจนจบ`, false, String(e.message || e).split('\n')[0].slice(0, 160)); }

    // 3.55) ชีทแจกฟรี: กรอกอีเมล → ปุ่มดาวน์โหลด + ชวนติดตามเพจ (ไม่บังคับไลก์)
    try { page = await newPage(kind); page.setDefaultTimeout(8000);
      await page.goto(`${BASE}/__free`, { waitUntil: 'domcontentloaded' }); await page.waitForTimeout(300);
      await page.fill('#fr-email', 'tester@example.com'); await page.click('#fr-form button'); await page.waitForSelector('#fr-done:not([hidden])', { timeout: 4000 });
      const fr = await page.evaluate(() => ({ dl: !!document.querySelector('#fr-done a[download]'), fb: /facebook\.com/.test((document.querySelector('#fr-done .fr-fb') || {}).href || ''), cover: (document.querySelector('.fr-cover') || {}).naturalWidth || 0 }));
      pass(`[${kind}] ชีทแจกฟรี: กรอกอีเมลแล้วได้ปุ่มดาวน์โหลด + ปุ่มติดตามเพจ`, fr.dl && fr.fb && fr.cover > 0, JSON.stringify(fr));
      await layout(page, `[${kind}] ชีทแจกฟรี`); if (kind === 'mobile') await page.screenshot({ path: path.join(OUT, 'free-mobile.png'), fullPage: true });
      await page.context().close();
    } catch (e) { pass(`[${kind}] ชีทแจกฟรี: ทดสอบจนจบ`, false, String(e.message || e).split('\n')[0].slice(0, 160)); }

    // 3.58) บัญชีของฉัน + ข้อสอบเสมือนจริง + เมนูเดียวกันทุกหน้า
    try { page = await newPage(kind); page.setDefaultTimeout(8000);
      await page.goto(`${BASE}/__account`, { waitUntil: 'domcontentloaded' }); await page.waitForSelector('.ac-ord', { timeout: 4000 });
      const ac = await page.evaluate(() => ({ dl: document.querySelectorAll('.ac-dl').length, mock: !!document.querySelector('a[href="/vip/mock"]'), review: /สมุดจุดพลาด \(3 ข้อ\)/.test(document.body.innerText), nav: [...document.querySelectorAll('.nav a')].map((a) => a.getAttribute('href')), acc: !!document.querySelector('.hd-acc.on') }));
      pass(`[${kind}] บัญชีของฉัน: ชีทที่ซื้อ (ปุ่มโหลดทุกไฟล์) + สถานะ VIP + ทางไปข้อสอบเสมือนจริง/สมุดจุดพลาด`, ac.dl === 2 && ac.mock && ac.review && ac.acc, JSON.stringify(ac));
      pass(`[${kind}] เมนูหลักหน้าเซิร์ฟเวอร์ตรงกับชุดกลาง (หน้าแรก ร้านชีท ข้อสอบฟรี ความรู้ VIP)`, JSON.stringify(ac.nav) === JSON.stringify(SITE_NAV.map((x) => x[1])), ac.nav.join(' '));
      await layout(page, `[${kind}] บัญชีของฉัน`); if (kind === 'mobile') await page.screenshot({ path: path.join(OUT, 'account-mobile.png'), fullPage: true });
      MARKS.length = 0; page.on('dialog', (d) => d.accept());
      await page.goto(`${BASE}/__mock`, { waitUntil: 'domcontentloaded' }); await page.waitForSelector('.mk-go', { timeout: 4000 });
      await layout(page, `[${kind}] ข้อสอบเสมือนจริง (เลือกชุด)`);
      await page.click('.mk-go[data-k="mini"]'); await page.waitForSelector('.mk-q', { timeout: 4000 });
      await page.click('.mk-q[data-n="0"] .ch button[data-k="0"]'); await page.click('.mk-q[data-n="1"] .ch button[data-k="2"]');
      const during = await page.evaluate(() => ({ n: document.querySelectorAll('.mk-q').length, t: (document.getElementById('mk-t') || {}).textContent, cnt: (document.getElementById('mk-n') || {}).textContent }));
      await layout(page, `[${kind}] ข้อสอบเสมือนจริง (กำลังทำ)`);
      await page.click('#mk-send'); await page.waitForSelector('.mk-res', { timeout: 4000 }); await page.waitForTimeout(300);
      const res = await page.evaluate(() => ({ score: (document.querySelector('.mk-score') || {}).textContent, right: document.querySelectorAll('.ch button.right').length, wrong: document.querySelectorAll('.ch button.wrong').length, saved: (document.getElementById('mk-saved') || {}).textContent, hist: JSON.parse(localStorage.getItem('sl_mock_hist') || '[]').length }));
      pass(`[${kind}] ข้อสอบเสมือนจริง: จับเวลา ตอบ ส่ง → คะแนน 1/3 เฉลยทุกข้อ ข้อผิด/ไม่ตอบเข้าสมุดจุดพลาด`, during.n === 3 && /^\d+:\d\d$/.test(during.t) && /2\/3/.test(during.cnt) && res.score === '1/3' && res.right === 3 && res.wrong === 1 && /เข้าสมุดจุดพลาดแล้ว/.test(res.saved) && res.hist === 1 && JSON.stringify(MARKS.map((x) => x.ok)) === '[true,false,false]', JSON.stringify({ during, res, marks: MARKS.length }));
      await layout(page, `[${kind}] ข้อสอบเสมือนจริง (ผลคะแนน)`); if (kind === 'mobile') await page.screenshot({ path: path.join(OUT, 'mock-mobile.png'), fullPage: true });
      await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' }); await page.waitForSelector('.st-grid, .st-svc', { timeout: 6000 }).catch(() => {});
      const home = await page.evaluate(() => ({ nav: [...document.querySelectorAll('.st-nav a')].map((a) => a.getAttribute('href')), svc: document.querySelectorAll('.st-svcc').length, acc: !!document.querySelector('.st-top a[href="/account"]') }));
      pass(`[${kind}] หน้าแรก: เมนูเดียวกับหน้าอื่น + การ์ด 3 บริการ + ปุ่มบัญชีของฉัน`, JSON.stringify(home.nav) === JSON.stringify(SITE_NAV.map((x) => x[1])) && home.svc === 3 && home.acc, JSON.stringify(home));
      await page.context().close();
    } catch (e) { pass(`[${kind}] บัญชี/ข้อสอบเสมือนจริง: ทดสอบจนจบ`, false, String(e.message || e).split('\n')[0].slice(0, 160)); }

    // 3.59) แอปบนหน้าจอ (/app): ทางลัดทุกบริการ + เข้าระบบด้วยรหัส 6 หลักจากอีเมล
    try { page = await newPage(kind); page.setDefaultTimeout(8000);
      await page.goto(`${BASE}/__app`, { waitUntil: 'domcontentloaded' }); await page.waitForSelector('#app-in', { timeout: 4000 });
      const ap = await page.evaluate(() => ({ tiles: document.querySelectorAll('.app-t').length, lock: document.querySelectorAll('.app-t.lock').length, vipHref: (document.querySelector('.app-vip') || {}).getAttribute?.('href'), manifest: !!document.querySelector('link[rel="manifest"]'), ios: !!document.querySelector('meta[name="apple-mobile-web-app-capable"]') }));
      await page.click('#app-in'); await page.fill('#sl-le', 'buyer@test.co'); await page.click('#sl-lf button'); await page.waitForSelector('#sl-cf:not([hidden])', { timeout: 4000 });
      const codeShown = await page.evaluate(() => /ใส่รหัส 6 หลัก/.test(document.getElementById('sl-ls').textContent) && document.activeElement && document.activeElement.id === 'sl-lc');
      await layout(page, `[${kind}] แอป SheetLab (/app)`); if (kind === 'mobile') await page.screenshot({ path: path.join(OUT, 'app-mobile.png'), fullPage: true });
      pass(`[${kind}] แอป SheetLab: 8 ทางลัด · ยังไม่เป็น VIP = ล็อกและพาไปหน้า VIP · ใส่อีเมลแล้วได้ช่องรหัส 6 หลัก · มี manifest ให้เพิ่มลงหน้าจอ`, ap.tiles === 8 && ap.lock === 2 && ap.vipHref === '/vip' && ap.manifest && ap.ios && codeShown, JSON.stringify({ ...ap, codeShown }));
      await page.context().close();
    } catch (e) { pass(`[${kind}] แอป SheetLab: ทดสอบจนจบ`, false, String(e.message || e).split('\n')[0].slice(0, 160)); }

    // 3.6) หน้าสมาชิก VIP: ยังไม่เปิด = "เร็วๆ นี้" · เปิดแล้ว = ราคาจากหลังบ้าน + ปุ่มสมัคร + ฟอร์มเข้าระบบด้วยอีเมล
    for (const mode of ['closed', 'open']) try {
      page = await newPage(kind); page.setDefaultTimeout(8000);
      await page.goto(`${BASE}/__vip/${mode}`, { waitUntil: 'domcontentloaded' }); await page.waitForTimeout(500);
      const v = await page.evaluate(() => ({ soon: document.body.innerText.includes('เร็วๆ นี้'), buy: document.querySelectorAll('.vp-buy').length, packs: document.querySelectorAll('.vp-pack').length, login: !!document.querySelector('#sl-lf') }));
      pass(`[${kind}] VIP ${mode === 'open' ? 'เปิดรับ: ราคา 2 แบบบัตร + PromptPay 2 แบบ + ฟอร์มเข้าระบบ' : 'ยังไม่เปิด: ขึ้นเร็วๆ นี้ ไม่มีปุ่มสมัคร'}`, mode === 'open' ? v.buy === 2 && v.packs === 2 && v.login && !v.soon : v.soon && !v.buy && !v.packs, JSON.stringify(v));
      await layout(page, `[${kind}] หน้า VIP ${mode}`);
      if (mode === 'open') await page.screenshot({ path: path.join(OUT, `vip-${kind}.png`), fullPage: true });
      await page.context().close();
    } catch (e) { pass(`[${kind}] หน้า VIP ${mode}: ทดสอบจนจบ`, false, String(e.message || e).split('\n')[0].slice(0, 160)); }

    // 4) หลังบ้าน (จำลองล็อกอิน ข้อมูลจาก /api ปลอม): ทุกแท็บหลัก + โรงงาน + ตัวแก้ชุด ต้องเปิดได้ไม่พัง
    page = await newPage(kind);
    await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' }); await page.waitForSelector('.st-grid');
    const views = [['home', 'ภาพรวม'], ['todo', 'เช็คลิสต์'], ['orders', 'ออเดอร์'], ['products', 'สินค้า'], ['ads', 'โฆษณา'], ['seo', 'SEO'], ['factory', 'โรงงาน'], ['vip', 'สมาชิก VIP'], ['insights', 'พฤติกรรม'], ['bundle', 'แก้ไขชุด']];
    for (const [v, name] of views) {
      const err = await page.evaluate(([v, bid]) => {
        try {
          // ล็อกอินปลอม: Supabase จำลอง (ทุกคำสั่งคืนค่าว่าง) · เรียก /api จริงของหน้า แต่ถูกตอบด้วยข้อมูลปลอมจาก route ด้านบน
          const chain = new Proxy(function () {}, { get: (t, k) => k === 'then' ? (res) => res({ data: [], error: null }) : chain, apply: () => chain });
          sbSession = { user: { email: 'test@example.com' }, access_token: 'test' };
          sb = { auth: { getSession: async () => ({ data: { session: sbSession } }), refreshSession: async () => ({ data: { session: null } }), onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }) }, from: () => chain, storage: { from: () => chain } };
          window.hasAdminAccess = () => true;
          if (v === 'factory') { S.view = 'factory'; FJOBS = null; }
          else if (v === 'vip') { S.view = 'vip'; VIPA.d = null; }
          else if (v === 'bundle') { S.view = 'admin'; S.tab = 'products'; const b = getProduct(bid); S.draft = bundleDraft(b); S.edit = bid; }
          else { S.view = 'admin'; S.tab = v; S.edit = null; S.draft = null; }
          render(false); return '';
        } catch (e) { return String(e && e.stack || e).slice(0, 300); }
      }, [v, bundle && bundle.id]);
      await page.waitForTimeout(400);
      pass(`[${kind}] หลังบ้าน ${name}: เปิดได้`, !err, err);
      if (v !== 'bundle') { const sv = await page.evaluate(() => ({ svc: document.querySelectorAll('.svc-main button').length, on: (document.querySelector('.svc-main button[aria-pressed="true"]') || {}).dataset?.v || '', four: document.querySelectorAll('.svf-row .svf').length }));
        const want = { home: 'all', todo: 'all', orders: 'shop', products: 'shop', ads: 'shop', seo: 'learn', insights: 'learn', factory: 'factory', vip: 'vip' }[v];
        pass(`[${kind}] หลังบ้าน ${name}: เมนูแบ่งตามบริการ (อยู่ในบริการ ${want})${['all'].includes(want) ? '' : ' + แถบ 4 ช่อง'}`, sv.svc === 6 && sv.on === want && (want === 'all' ? sv.four === 0 : sv.four === 4), JSON.stringify(sv)); }
      if (v === 'seo') { await page.locator('.svc-main [data-v="shop"]').click({ timeout: 4000 }).catch(() => {}); await page.waitForTimeout(200); const t1 = await page.evaluate(() => S.tab);
        await page.locator('.tabs-more [data-v="ads"]').click({ timeout: 4000 }).catch(() => {}); await page.locator('.svc-main [data-v="learn"]').click({ timeout: 4000 }).catch(() => {}); await page.locator('.svc-main [data-v="shop"]').click({ timeout: 4000 }).catch(() => {}); await page.waitForTimeout(200);
        const t2 = await page.evaluate(() => S.tab); await page.evaluate(() => { S.tab = 'seo'; render(false); });
        pass(`[${kind}] หลังบ้าน: กดบริการ "ร้านชีท" ไปหน้าแรกของบริการ และจำหน้าย่อยล่าสุดไว้`, t1 === 'orders' && t2 === 'ads', `${t1} → ${t2}`); }
      if (v === 'insights') { await page.waitForTimeout(300); const x = await page.evaluate(() => ({ fun: document.querySelectorAll('.ins-fun > div').length, rows: document.querySelectorAll('.ins-tbl > div').length, label: document.body.innerText.includes('+ เพิ่ม (หน้าขาย)') && document.body.innerText.includes('ทักแชท Messenger') }));
        pass(`[${kind}] แท็บพฤติกรรม: ขั้นการซื้อ 5 ขั้น + ตาราง + ชื่อปุ่มภาษาไทย`, x.fun === 5 && x.rows >= 8 && x.label, JSON.stringify(x)); }
      if (v === 'vip') { await page.waitForTimeout(400); pass(`[${kind}] แท็บสมาชิก VIP แยก: SQL ให้คัดลอก + ช่องราคา + ปุ่มบนแถบ`, await page.locator('.vipa .vipsql').count() === 1 && await page.locator('#vip-m').count() === 1 && await page.locator('#seg [data-a="toVip"]').count() === 1);
        await page.locator('[data-a="vpAdd"][data-v="perks"]').click({ timeout: 4000 }).catch(() => {}); await page.waitForTimeout(150);
        await page.locator('[data-vp="perks.2.t"]').fill('ข้อสอบจับเวลา').catch(() => {});
        const vp = await page.evaluate(() => ({ title: !!document.querySelector('[data-vp="title"]'), rows: document.querySelectorAll('.vp-row').length, faq: document.querySelectorAll('.vp-faq').length, typed: (VIPA.pg.perks[2] || {}).t, frame: (document.querySelector('.vipv a[href^="/vip?preview=1"]') || {}).getAttribute?.('href') || '', iframe: document.querySelectorAll('.vipv iframe').length, grant: !!document.querySelector('[data-a="vipGrant"]') }));
        pass(`[${kind}] แท็บสมาชิก: แก้ข้อความหน้า (เพิ่มสิทธิ์ได้ พิมพ์แล้วจำไว้) + ปุ่มเปิดหน้าลูกค้า (ไม่ฝังหน้าในแท็บ) · ยังไม่สร้างตารางไม่โชว์ให้สิทธิ์`, vp.title && vp.rows === 3 && vp.faq === 1 && vp.typed === 'ข้อสอบจับเวลา' && /\/vip\?preview=1/.test(vp.frame) && vp.iframe === 0 && !vp.grant, JSON.stringify(vp)); }
      if (v === 'factory') { await page.waitForTimeout(500); // หน้าโรงงานแบบใหม่: กล่อง "ตอนนี้" + 5 แท็บ แต่ละแท็บเรื่องเดียว
        const tab = async (k) => { await page.locator(`.fqt [data-v="${k}"]`).click({ timeout: 4000 }).catch(() => {}); await page.waitForTimeout(150); };
        const h = await page.evaluate(() => ({ now: (document.querySelector('.fqh-main b') || {}).textContent || '', tabs: document.querySelectorAll('.fqt button').length, nums: document.querySelectorAll('.fqh-nums button').length, flow: document.querySelectorAll('.ffl-steps li').length }));
        await tab('order'); const o = await page.evaluate(() => ({ title: !!document.getElementById('fq-title'), idea: (document.querySelector('[data-a="fqIdea"]') || {}).textContent || '' }));
        await page.locator('[data-a="ordMode"][data-v="set"]').click({ timeout: 4000 }).catch(() => {}); await page.waitForTimeout(150);
        await page.fill('#so-name', 'IELTS 6.5').catch(() => {}); await page.fill('#so-books', 'IELTS Listening 10 ชุด | 199\nIELTS Reading 10 ชุด\n\nIELTS Writing 50 หัวข้อ | 179').catch(() => {});
        const so = await page.evaluate(() => ({ lines: setOrderLines(), rush: !!document.querySelector('[data-a="soRush"]'), btn: (document.querySelector('[data-a="soOrder"]') || {}).textContent || '' }));
        pass(`[${kind}] โรงงาน: สั่งทั้งชุดหลายเล่มในครั้งเดียว (อ่านบรรทัดละเล่ม + ราคา) + ตัวเลือกเร่งผลิต`, so.lines.length === 3 && so.lines[0].price === 199 && so.lines[1].price === 0 && so.lines[2].title === 'IELTS Writing 50 หัวข้อ' && so.rush && /3 เล่ม/.test(so.btn), JSON.stringify(so));
        await page.evaluate(() => { S.form.setBooks = ''; S.form.setName = ''; render(true); });
        await page.locator('[data-a="soIdea"]').click({ timeout: 4000 }).catch(() => {}); await page.waitForTimeout(400);
        const si = await page.evaluate(() => ({ books: (document.getElementById('so-books') || {}).value || '', name: (document.getElementById('so-name') || {}).value || '' }));
        pass(`[${kind}] โรงงาน: ปุ่ม 💡 สุ่มชุดให้ (เลือกหมวด + จำนวนเล่ม) เติมรายชื่อเล่มและชื่อชุดให้`, si.books.split('\n').length === 3 && /\| 199/.test(si.books) && /ครบชุด 3 เล่ม/.test(si.name), JSON.stringify(si));
        await page.evaluate(() => { S.ordMode = 'one'; S.form.setBooks = ''; S.form.setName = ''; });
        await tab('lib'); await page.fill('[data-flq]', 'health').catch(() => {}); await page.waitForTimeout(100);
        const fl = await page.evaluate(() => ({ books: document.querySelectorAll('.flib-b').length, shown: document.querySelectorAll('.flib-b:not([hidden])').length, now: (document.querySelector('.fqh-main') || {}).textContent || '', sku: [...document.querySelectorAll('.flib-b em')].map((x) => x.textContent).join(','), audio: (document.querySelector('.flib-b:not([hidden]) .fl-au') || {}).textContent || '', exp: document.querySelectorAll('[data-a="libExport"]').length, help: /SL-SET/.test((document.querySelector('.fl-help') || {}).textContent || '') }));
        const sk = await page.evaluate(() => { ensureSkus(); const ps = D.products; return { all: ps.every((p) => /^SL-/.test(p.sku || '')), set: (ps.find((p) => p.type === 'bundle') || {}).sku || '', uniq: new Set(ps.map((p) => p.sku)).size === ps.length }; });
        pass(`[${kind}] โรงงาน: คลังมีเลข SKU + บอกที่เก็บไฟล์เสียงใน Mac/Drive + ปุ่มลงร้าน (มาใหม่) · สินค้าทุกชิ้นได้ SKU ไม่ซ้ำ`, /SL-046/.test(fl.sku) && /SL-044/.test(fl.sku) && fl.help && /เสียงใน Mac/.test(fl.audio) && /Academic Audio/.test(fl.audio) && fl.exp >= 1 && sk.all && /^SL-SET\d\d$/.test(sk.set) && sk.uniq, JSON.stringify({ sku: fl.sku, audio: fl.audio.slice(0, 60), exp: fl.exp, sk }));
        await page.locator('.fqt-body').screenshot({ path: path.join(OUT, `factory-lib-${kind}.png`) }).catch(() => {});
        const fb = await page.evaluate(async () => { const bulk = !!document.querySelector('[data-a="libExportAll"]');
          const p = D.products.find((x) => x.type !== 'bundle'), keep = { headline: p.headline, faq: p.faq, status: p.status, price: p.price, previews: p.previews };
          p.faq = ''; p.previews = [];
          FAC.exports = [{ id: 'f1', status: 'done', listing: 'pending', fill_id: p.id, fill_need: 'faq,previews,headline', listing_copy: { headline: 'ใหม่', faq: 'Q|A' }, previews: ['https://x/pv3.jpg'] }]; SETI.exp = {}; facExportImport(); await new Promise((r) => setTimeout(r, 400));
          const dr = initDraft(p); const r = { bulk, untouched: p.faq === '' && !(p.previews || []).length, faq: dr.faq, pv: (dr.previews || []).length, head: dr.headline === keep.headline, st: p.status === keep.status, pr: p.price === keep.price, made: D.products.some((x) => x.fromJob === 'f1') };
          Object.assign(p, keep); delete p.fillPending; FAC.exports = []; return r; });
        pass(`[${kind}] โรงงาน: ปุ่มลงร้านทุกเล่มที่ยังไม่มี + งานเติมรายละเอียด: ไม่แก้สินค้าจนกว่าจะกดบันทึก เติมเฉพาะช่องที่ว่างในหน้าแก้`, fb.bulk && fb.untouched && fb.faq === 'Q|A' && fb.pv === 1 && fb.head && fb.st && fb.pr && !fb.made, JSON.stringify(fb));
        const ai = await page.evaluate(async () => { const mk = (id, no, price) => ({ id, status: 'done', listing: 'pending', title: 'Book ' + no, price, set_name: 'ชุดทดสอบ', set_no: no, images: ['https://x/' + id + '.jpg'], previews: ['https://x/p3.jpg', 'https://x/p4.jpg'], listing_copy: { name: 'Book ' + no, headline: 'H', desc: 'D', features: 'F' }, sku: 'SL-10' + no });
          FAC.all = [mk('j1', 1, 199), mk('j2', 2, 149)]; FAC.exports = FAC.all.slice(); SETI.exp = {}; SETI.bun = {}; facExportImport(); await new Promise((r) => setTimeout(r, 600));
          const a = D.products.find((p) => p.fromJob === 'j1'), bun = D.products.find((p) => p.fromSetName === 'ชุดทดสอบ');
          const r = { fresh: !!(a && a.fresh && a.status === 'draft'), prev: a ? (a.previews || []).length : 0, sku: a && a.sku, price: a && a.price, feat: a && a.features, bItems: bun ? bun.items.length : 0, bPrice: bun && bun.price, bFull: bun && bun.fullPrice, bSku: bun && bun.sku, bFresh: !!(bun && bun.fresh) };
          D.products = D.products.filter((p) => !['j1', 'j2'].includes(p.fromJob) && p.fromSetName !== 'ชุดทดสอบ'); FAC.all = []; FAC.exports = []; return r; });
        pass(`[${kind}] โรงงาน: เล่มที่เสร็จเข้า ✨ มาใหม่ เป็นฉบับร่างกรอกครบ (ข้อความ ปก หน้าตัวอย่าง SKU ราคา) · ชุดครบแล้วได้ฉบับร่างชุดขายราคาตามสูตร`, ai.fresh && ai.prev === 2 && ai.sku === 'SL-101' && ai.price === 199 && ai.feat === 'F' && ai.bItems === 2 && ai.bPrice === 190 && ai.bFull === 348 && /^SL-SET\d\d$/.test(ai.bSku || '') && ai.bFresh, JSON.stringify(ai));
        await tab('more'); const m = await page.evaluate(() => ({ global: !!document.querySelector('.fqt-body details.fac-global'), guide: document.querySelectorAll('.fqt-body .ffl-steps li').length }));
        await tab('queue'); await page.evaluate(() => { S.facTab = null; S.flq = ''; render(true); });
        await page.locator('.fqh').screenshot({ path: path.join(OUT, `factory-top-${kind}.png`) }).catch(() => {});
        pass(`[${kind}] โรงงาน: กล่องสถานะ "ตอนนี้" + 5 แท็บ (สั่งผลิต · คลังหนังสือค้นหาได้ · อื่นๆ มีขายต่างประเทศ/คู่มือ) ไม่มีแผนภาพยาวในหน้าแรก`, h.tabs === 5 && h.nums === 3 && h.now.length > 3 && h.flow === 0 && o.title && /แนะนำเล่มถัดไป/.test(o.idea) && fl.books === 2 && fl.shown === 1 && /กำลังผลิต/.test(fl.now) && m.global && m.guide === 5, JSON.stringify({ h, o, fl: { ...fl, now: fl.now.slice(0, 40) }, m })); }
      if (v === 'home' && kind === 'desktop') { COVER_CALLS.length = 0; const g = await page.evaluate(async () => { const REF = 'https://x.supabase.co/storage/v1/object/public/product-images/t.png'; window.uploadImage = async () => REF; S.draft = { name: 'TOEIC Mock Test', price: 249, cat: 'mock', type: '', images: [] }; S.imgFirst = 'ai'; await imgSetGen(); const r = { made: (S.draft.images || []).length, applied: S.imgSet === null, errs: (S.imgSet || []).map((x) => x.err).filter(Boolean) }; S.draft = null; S.imgSet = null; return r; });
        const refsOk = COVER_CALLS.length === 5 && !(COVER_CALLS[0].refs || []).length && COVER_CALLS.slice(1).every((c) => (c.refs || [])[0] === 'https://x.supabase.co/storage/v1/object/public/product-images/t.png');
        pass('ปุ่ม ✨ สร้างชุดภาพสินค้า 5 รูป: สร้างได้ครบ 5 รูป รูป 2-5 ใช้รูปแรกเป็นต้นแบบ · เสร็จแล้วแทนรูปเดิมเอง (ไม่ต้องกดใช้รูป)', g.made === 5 && g.applied && refsOk, JSON.stringify({ ...g, calls: COVER_CALLS.length })); }
      if (v === 'home') { const cp = await page.evaluate(() => { const d = { name: 'TOEIC Mock Test', price: 149, cat: 'mock', type: '' }, p = coverPrompt(d), set = imgSetPrompts(d); return { alone: /ไม่มีของประกอบ/.test(p) && !/โต๊ะไม้/.test(p), same: set[0] === p, follow: set.slice(1).every((x) => /เหมือนรูปอ้างอิง/.test(x)) }; });
        pass(`[${kind}] ปกสินค้า: คำสั่งทำปก = สินค้าเดี่ยวๆ (ตรงกับรูปแรกของชุด) รูป 2-5 ตามรูปแรก`, cp.alone && cp.same && cp.follow, JSON.stringify(cp)); }
      if (v === 'home') { const lv = await page.evaluate(() => ({ n: LIVE.length, ok: LIVE.every((L) => typeof L.run === 'function' && L.every > 0 && (L.tabs || L.views)), pill: !!document.getElementById('live-pill') })); pass(`[${kind}] ข้อมูลสด: ทุกแหล่งข้อมูลลงทะเบียนรอบรีเฟรช + ป้ายอัปเดตอัตโนมัติ`, lv.n >= 10 && lv.ok, JSON.stringify(lv)); }

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
        { const chip = page.locator('[data-a="adsFilter"][data-v="run"]').first(); await chip.click({ timeout: 4000 }).catch(() => {}); const on = await chip.getAttribute('aria-pressed'); await page.locator('[data-a="adsFilter"][data-v="all"]').first().click({ timeout: 4000 }).catch(() => {});
          pass(`[${kind}] โฆษณา: กดตัวกรอง "กำลังวิ่ง" ได้จริง (คลิกด้วยเมาส์)`, on === 'true', String(on)); }
        const d = page.locator('.adq-wrap').first(); if (await d.count()) await d.screenshot({ path: path.join(OUT, `adflow-${kind}.png`) }); }
      if (v === 'products') { // ปุ่มบันทึก: ฉบับร่าง / เผยแพร่แล้วไปเซลเพจ · สร้างชุดใหม่โดยรวมชุดเดิมเข้ามา
        const ed = await page.evaluate(() => { const p = D.products.find((x) => !isBundle(x)); S.draft = initDraft(p); S.edit = p.id; render(false);
          const b = (q) => (document.querySelector(q) || {}).textContent || ''; return { id: p.id, draft: b('[data-a="saveProduct"][data-status="draft"]'), pub: b('[data-a="saveProduct"][data-status="published"]'), sel: !!document.getElementById('e-status') }; });
        await page.locator('[data-a="saveProduct"][data-status="published"]').click({ timeout: 4000 }).catch(() => {}); await page.waitForTimeout(300);
        const after = await page.evaluate((id) => ({ view: S.view, sel: S.productId, st: getProduct(id).status }), ed.id);
        const fn = await page.evaluate(() => { const p = Object.assign(blankProduct(), { id: 'pnote', name: 'Note test', slug: 'note-test', sku: 'SL-044', status: 'draft', fresh: true, freshNote: 'จากคลังบน Mac (SL-044) · ตั้งราคาก่อนเผยแพร่ · 🎧 ไฟล์เสียงอยู่ใน Mac: /Users/x/Documents/Academic/a b/audio · เสียงอยู่ใน Google Drive แล้ว: https://drive.google.com/drive/folders/abc' }); D.products.push(p);
          S.view = 'admin'; S.tab = 'products'; S.edit = null; S.draft = null; S.pstat = 'all'; render(false); const row = [...document.querySelectorAll('.pt-hint')].map((x) => x.textContent).find((x) => /มาใหม่/.test(x) && /SL-044/.test(x)) || '';
          S.draft = initDraft(p); S.edit = 'pnote'; render(false); const box = document.querySelector('.fnote'); const r = { row, box: !!box, link: !!(box && box.querySelector('a[href*="drive.google.com"]')), code: !!(box && box.querySelector('code')) };
          D.products = D.products.filter((x) => x.id !== 'pnote'); S.edit = null; S.draft = null; render(false); return r; });
        { await page.evaluate(() => { S.edit = null; S.draft = null; S.view = 'admin'; S.tab = 'products'; render(false); });
          const n0 = await page.evaluate(() => D.products.filter((x) => isBundle(x)).length);
          await page.locator('[data-a="newBundle"]').first().click({ timeout: 4000 }).catch(() => {}); await page.waitForTimeout(200);
          await page.fill('#b-name', 'ชุดทดสอบเอง').catch(() => {}); await page.fill('#b-slug', 'set-test-own').catch(() => {});
          for (let i = 0; i < 3; i++) { await page.locator('details [data-a="bxItem"]').first().click({ timeout: 3000 }).catch(() => {}); await page.waitForTimeout(120); }
          const items = await page.evaluate(() => S.draft && S.draft.items.length);
          await page.locator('[data-a="saveBundle"]').first().click({ timeout: 4000 }).catch(() => {}); await page.waitForTimeout(300);
          const priced = await page.evaluate(() => S.draft && S.draft.plans.some((x) => x.on && x.price >= 1));
          await page.locator('[data-a="saveBundle"]').first().click({ timeout: 4000 }).catch(() => {}); await page.waitForTimeout(1500);
          const r = await page.evaluate((n0) => { const nb = D.products.find((x) => isBundle(x) && x.slug === 'set-test-own'); const o = { n: D.products.filter((x) => isBundle(x)).length - n0, items: nb ? nb.items.length : 0, err: S.err, closed: !S.edit }; D.products = D.products.filter((x) => x !== nb); S.edit = null; S.draft = null; render(false); return o; }, n0);
          pass(`[${kind}] สร้างชุดขายเอง: กดเพิ่มเล่มได้ต่อเนื่อง (รายการไม่หุบ) · ไม่ใส่ราคา ระบบคำนวณให้ตรวจก่อน · กดบันทึกแล้วได้ชุดใหม่`, items === 3 && priced && r.n === 1 && r.items === 3 && r.closed, JSON.stringify({ items, priced, ...r })); }
        { const prep = await page.evaluate(() => { const b = D.products.find((x) => isBundle(x)); window.__bk = JSON.parse(JSON.stringify(b)); const n = bundleBooks(b).length;
            b.audioOk = true; b.name = `ชุดซิงก์ ${n} เล่ม`; b.headline = `ครบ ${n} เล่ม`; b.plans.forEach((p) => { if (p.key === 'basic') { p.on = true; p.price = 500; p.fullPrice = 0; } });
            S.view = 'admin'; S.tab = 'products'; S.draft = bundleDraft(b); S.edit = b.id; S.bxSynced = ''; render(false); return { id: b.id, n }; });
          await page.locator('details [data-a="bxItem"]').first().click({ timeout: 3000 }).catch(() => {}); await page.waitForTimeout(150);
          await page.locator('[data-a="saveBundle"]').first().click({ timeout: 4000 }).catch(() => {}); await page.waitForTimeout(800);
          const msg = await page.evaluate(() => S.err);
          await page.locator('[data-a="saveBundle"]').first().click({ timeout: 4000 }).catch(() => {}); await page.waitForTimeout(1500);
          const r = await page.evaluate((id) => { const b = getProduct(id); const o = { name: b.name, head: b.headline, price: bxPrice(b), items: b.items.length, closed: !S.edit, err: S.err }; const i = D.products.findIndex((x) => x.id === id); D.products[i] = window.__bk; S.edit = null; S.draft = null; render(false); return o; }, prep.id);
          const n1 = prep.n + 1;
          pass(`[${kind}] เพิ่มเล่มเข้าชุดเอง: ชื่อ/ข้อความ/ราคาเปลี่ยนตาม (หยุดให้ตรวจก่อน) แล้วบันทึกได้`, /จำนวนเล่ม/.test(msg) && /ราคา/.test(msg) && r.name === `ชุดซิงก์ ${n1} เล่ม` && r.head === `ครบ ${n1} เล่ม` && r.price > 500 && r.items === n1 && r.closed, JSON.stringify({ msg: msg.slice(0, 160), ...r })); }
        { const prep = await page.evaluate(() => { const p = D.products.find((x) => !isBundle(x)); window.__ap = JSON.parse(JSON.stringify(p)); p.status = 'draft'; p.audio = true; p.audioOk = false; p.audioDrive = 'https://drive.google.com/drive/folders/abc';
            S.view = 'admin'; S.tab = 'products'; S.draft = initDraft(p); S.edit = p.id; S.err = ''; render(false); return { id: p.id, box: !!document.querySelector('.aud'), link: !!document.querySelector('.aud a[href*="drive.google.com"]') }; });
          await page.locator('[data-a="saveProduct"][data-status="published"]').click({ timeout: 4000 }).catch(() => {}); await page.waitForTimeout(300);
          const blocked = await page.evaluate((id) => ({ err: S.err, st: getProduct(id).status }), prep.id);
          await page.locator('.aud input[data-a="audioOk"]').click({ timeout: 3000 }).catch(() => {}); await page.waitForTimeout(150);
          await page.locator('[data-a="saveProduct"][data-status="published"]').click({ timeout: 4000 }).catch(() => {}); await page.waitForTimeout(500);
          const r = await page.evaluate((id) => { const p = getProduct(id), o = { st: p.status, ok: !!p.audioOk }; const i = D.products.findIndex((x) => x.id === id); D.products[i] = window.__ap; S.edit = null; S.draft = null; S.view = 'admin'; S.tab = 'products'; render(false); return o; }, prep.id);
          pass(`[${kind}] เล่มมีไฟล์เสียง: มีช่องติ๊กยืนยัน Drive เป็นสาธารณะ ไม่ติ๊กกดเผยแพร่ไม่ได้ · ติ๊กแล้วเผยแพร่ได้`, prep.box && prep.link && /Google Drive/.test(blocked.err) && blocked.st === 'draft' && r.st === 'published' && r.ok, JSON.stringify({ ...prep, blocked, r })); }
        { const r = await page.evaluate(() => { const b = D.products.find((x) => isBundle(x)); S.view = 'admin'; S.tab = 'products'; act('editProduct', { dataset: { id: b.id } }); const m = getProduct(b.items[0]), before = JSON.stringify(m);
            m.bookCover = 'https://x/new.jpg'; bxUseCover(m, true); S.bxImg = 'all'; render(true); const stop = !!document.querySelector('[data-a="aiStop"]'); S.bxImg = '';
            const dirty = bxDirty(); act('cancelEdit', { dataset: {} }); return { stop, dirty, undone: JSON.stringify(getProduct(m.id)) === before, snap: S.bxSnap === null }; });
          pass(`[${kind}] หน้าแก้ชุด: มีปุ่มหยุดทำปก AI · ปก/รูปที่ทำไว้ไม่บันทึกจนกดบันทึก กดยกเลิกแล้วกลับเป็นแบบเดิม`, r.stop && r.dirty && r.undone && r.snap, JSON.stringify(r)); }
        { await page.evaluate(() => { const b = D.products.find((x) => isBundle(x)); S.view = 'admin'; S.tab = 'products'; act('editProduct', { dataset: { id: b.id } }); });
          const boxes = page.locator('.bxi-b input[data-a="bxSel"]'); await boxes.nth(0).click({ timeout: 3000 }).catch(() => {}); await boxes.nth(2).click({ timeout: 3000 }).catch(() => {}); await page.waitForTimeout(150);
          const lab = await page.evaluate(() => (document.querySelector('[data-a="bxAiBooks"]') || {}).textContent || '');
          const made = await page.evaluate(async () => { const got = []; const keep = window.bxMakeBook, kc = window.confirm; window.confirm = () => true; bxMakeBook = async (id) => { got.push(id); };
            act('bxAiBooks', { dataset: {} }); await new Promise((r) => setTimeout(r, 400)); bxMakeBook = keep; window.confirm = kc; const want = S.draft.items.filter((i) => getProduct(i) && !isBundle(getProduct(i))); S.bxImg = ''; act('cancelEdit', { dataset: {} });
            return { got: got.length, ok: got[0] === want[0] && got[1] === want[2] }; });
          pass(`[${kind}] หน้าแก้ชุด: ติ๊กเลือกเล่มที่จะให้ AI ทำปก แล้วทำเฉพาะเล่มที่เลือก`, /เล่มที่เลือก \(2 รูป\)/.test(lab) && made.got === 2 && made.ok, JSON.stringify({ lab, ...made })); }
        { const r = await page.evaluate(() => { const p = D.products.find((x) => !isBundle(x)); const keep = JSON.parse(JSON.stringify(p)); p.fromJob = 'jr1'; p.faq = '[object Object],[object Object]'; p.features = 'ก,ข';
            FAC.all = [{ id: 'jr1', listing_copy: { faq: 'ถาม | ตอบ', features: 'ก\nข', specs: 'จำนวนหน้า | 119 หน้า' } }]; facRepair(); const o = { faq: p.faq, feat: p.features }; Object.keys(p).forEach((k) => delete p[k]); Object.assign(p, keep); FAC.all = []; return o; });
          pass(`[${kind}] ซ่อมช่องที่เสีย ([object Object] / คั่นด้วยจุลภาค) จากข้อความโรงงาน`, r.faq === 'ถาม | ตอบ' && r.feat === 'ก\nข', JSON.stringify(r)); }
        { const r = await page.evaluate(() => { const b = D.products.find((x) => isBundle(x)); S.view = 'admin'; S.tab = 'products'; act('editProduct', { dataset: { id: b.id } }); const up = document.querySelectorAll('.bxi-b input[data-bxbook]').length; act('cancelEdit', { dataset: {} });
            const p = D.products.find((x) => !isBundle(x) && x.price > 0); const rec = adBudgetRec({ productId: p.id }); return { up, n: bundleBooks(b).length, daily: rec.daily, days: rec.days, why: rec.why.length }; });
          pass(`[${kind}] หน้าแก้ชุด: ปุ่ม ⬆ ใส่ปกเองทุกเล่ม · แอด: น้องบูสต์แนะนำงบต่อวันพร้อมเหตุผล`, r.up === r.n && r.daily >= 100 && r.days === 7 && r.why >= 3, JSON.stringify(r)); }
        const gp = await page.evaluate(() => { const bks = D.products.filter((x) => !isBundle(x)).slice(0, 2); const keep = bks.map((x) => ({ x, st: x.status, fj: x.fromJob }));
          bks.forEach((x) => { x.status = 'draft'; x.fromJob = 'jx' + x.id; }); const b = Object.assign(blankBundle(), { id: 'bgrp', name: 'ชุดกลุ่ม', slug: 'set-grp', items: bks.map((x) => x.id), fromSetName: 'ชุดกลุ่ม', fresh: true, status: 'draft' }); D.products.push(b);
          S.edit = null; S.draft = null; S.view = 'admin'; S.tab = 'products'; S.pstat = 'all'; S.pq = ''; render(false);
          const ids = [...document.querySelectorAll('[data-a="editProduct"]')].map((e) => e.dataset.id); const r = { set: ids.includes('bgrp'), hidden: !bks.some((x) => ids.includes(x.id)) };
          D.products = D.products.filter((x) => x.id !== 'bgrp'); keep.forEach((k) => { k.x.status = k.st; k.x.fromJob = k.fj; }); render(false);
          SOLD = { [(D.products.find((x) => isBundle(x) && x.status === 'published') || {}).id]: 2 }; S.view = 'catalog'; S.scat = 'all'; S.edit = null; render(false); r.sold = ((document.querySelector('.st-bsold') || {}).textContent || ''); S.view = 'admin'; render(false); return r; });
        pass(`[${kind}] ชุดจากโรงงาน: รวมเป็น listing เดียว (เล่มในชุดไม่แยกแถว) · การ์ดชุดหน้าร้านบอกจำนวนที่ขายแล้ว`, gp.set && gp.hidden && /ขายแล้ว 2 ชุด/.test(gp.sold), JSON.stringify(gp));
        const sh = await page.evaluate(async () => { const p = D.products.find((x) => !isBundle(x)); S.draft = initDraft(p); S.edit = p.id; S.shopee = null; render(false);
          const btn = !!document.querySelector('.shp [data-a="shopeeCopy"]'); await shopeeCopy(); const t = (document.getElementById('shp-t') || {}).value || '';
          const bp = D.products.find((x) => isBundle(x)); let bun = false; if (bp) { S.draft = initDraft(bp); S.edit = bp.id; render(false); bun = !!document.querySelector('.shp [data-a="shopeeCopy"]'); }
          S.edit = null; S.draft = null; S.shopee = null; render(false); return { btn, t, bun }; });
        pass(`[${kind}] แก้สินค้า/ชุด: ปุ่ม 🛒 สร้างรายละเอียด Shopee ได้ข้อความในกล่องพร้อมปุ่มคัดลอก`, sh.btn && /เล่มพิมพ์/.test(sh.t) && sh.bun, JSON.stringify(sh));
        pass(`[${kind}] สินค้ามาใหม่: รายการแสดงโน้ตสั้นไม่มีลิงก์ยาว · หน้าแก้สินค้ามีกล่องโน้ตจากโรงงานตัวเต็ม (ลิงก์ Drive กดได้ ที่อยู่ไฟล์ใน Mac)`, fn.row && !/https|\/Users\//.test(fn.row) && /ไฟล์เสียง/.test(fn.row) && fn.box && fn.link && fn.code, JSON.stringify(fn));
        pass(`[${kind}] แก้สินค้า: ปุ่ม "บันทึกฉบับร่าง" + "บันทึกและเผยแพร่" (กดแล้วเผยแพร่และไปเซลเพจ)`, /ฉบับร่าง/.test(ed.draft) && ed.pub === 'บันทึกและเผยแพร่' && !ed.sel && after.view === 'shop' && after.sel === ed.id && after.st === 'published', JSON.stringify({ ed, after }));
        if (bundle) { const bx = await page.evaluate((bid) => { S.view = 'admin'; S.tab = 'products'; S.draft = bundleDraft(null); S.edit = 'new'; render(false);
            const row = document.querySelector(`[data-a="bxAddSet"][data-id="${bid}"]`); if (row) row.click(); return { row: !!row, n: S.draft.items.length, want: bundleBooks(getProduct(bid)).length, pub: !!document.querySelector('[data-a="saveBundle"][data-status="published"]') }; }, bundle.id);
          const dz = await page.evaluate((bid) => { S.draft = bundleDraft(getProduct(bid)); S.edit = bid; render(false); return { pdfs: !!document.querySelector('[data-a="dlSetPdfs"]'), imgs: !!document.querySelector('[data-a="dlSetImgs"]') }; }, bundle.id);
          const dl = page.waitForEvent('download', { timeout: 8000 }).catch(() => null); await page.locator('[data-a="dlSetImgs"]').click({ timeout: 4000 }).catch(() => {}); const got = await dl;
          pass(`[${kind}] ชุดขาย: ปุ่มโหลดไฟล์ทุกเล่ม + โหลดรูปทั้งหมดของชุด เป็น ZIP (กดแล้วได้ไฟล์ .zip)`, dz.pdfs && dz.imgs && !!got && /\.zip$/.test(got.suggestedFilename()), JSON.stringify({ ...dz, file: got && got.suggestedFilename() }));
          pass(`[${kind}] สร้างชุดขาย: รวมชุดที่มีอยู่เข้ามาได้ทั้งชุด + ปุ่มเผยแพร่`, bx.row && bx.n === bx.want && bx.n >= 2 && bx.pub, JSON.stringify(bx));
          await page.evaluate(() => { S.edit = null; S.draft = null; S.view = 'admin'; S.tab = 'products'; render(false); }); }
      }
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
