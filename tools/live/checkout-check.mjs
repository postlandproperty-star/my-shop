// เช็กหน้าจ่ายเงินบนเว็บจริงหลัง deploy (ตาม CLAUDE.md): เปิดหน้าสินค้า → กรอกอีเมล → กด "ชำระเงิน" → ต้องมีคำขอ QR ออกไป
// ดัก /api/checkout?m=qr ไว้ ไม่ให้ถึงเซิร์ฟเวอร์ จึงไม่สร้างการจ่ายเงินจริง · ใช้อีเมล @example.com (ระบบไม่นับเป็นลูกค้า)
// ใช้: CHROME_PATH=... node tools/live/checkout-check.mjs [https://sheetlabth.com] [slug]
import { chromium } from 'playwright-core';
const SITE = process.argv[2] || 'https://sheetlabth.com';
let slug = process.argv[3] || '';
if (!slug) { const xml = await (await fetch(`${SITE}/sitemap.xml`)).text(); slug = (xml.match(/\/p\/([a-z0-9-]+)</) || [])[1]; }
if (!slug) { console.error('หาหน้าสินค้าใน sitemap ไม่เจอ'); process.exit(1); }
const CASES = [
  { name: 'คอม', ctx: { viewport: { width: 1280, height: 900 } } },
  { name: 'iPhone', ctx: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1' } },
  { name: 'Android Facebook in-app', ctx: { viewport: { width: 412, height: 915 }, isMobile: true, hasTouch: true, userAgent: 'Mozilla/5.0 (Linux; Android 14; SM-A546E) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/129.0.0.0 Mobile Safari/537.36 [FB_IAB/FB4A;FBAV/480.0.0.0;]' } },
];
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH, headless: true });
let failed = 0;
for (const c of CASES) {
  const ctx = await browser.newContext(c.ctx), page = await ctx.newPage(), hits = [], errs = [];
  page.on('pageerror', (e) => errs.push(String(e.message || e).slice(0, 160)));
  await page.route(/\/api\/checkout\?m=qr/, (route) => { hits.push(route.request().postData() || route.request().url()); route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, pi: 'pi_livecheck', k: 'pi_livecheck_secret', png: `${SITE}/icon-192.png`, amount: 1 }) }); });
  let ok = false, why = '';
  try {
    await page.goto(`${SITE}/p/${slug}?utm_source=livecheck`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    const email = page.locator('#checkout #qr-email').first(); await email.waitFor({ state: 'attached', timeout: 20000 }); await email.scrollIntoViewIfNeeded();
    await email.fill('live-check@example.com');
    await page.locator('#checkout [data-a="qrMake"]').first().click({ timeout: 10000 });
    for (let i = 0; i < 40 && !hits.length; i++) await page.waitForTimeout(250);
    ok = hits.length > 0; why = ok ? `คำขอ QR ออกไป ${hits.length} ครั้ง` : 'กดชำระเงินแล้วไม่มีคำขอ QR';
  } catch (e) { why = String(e.message || e).split('\n')[0].slice(0, 200); }
  if (!ok) failed++;
  console.log(`${ok ? '✓' : '✗'} ${c.name} /p/${slug}: ${why}${errs.length ? ' · error ในหน้า: ' + errs.join(' | ') : ''}`);
  await ctx.close();
}
await browser.close();
console.log(failed ? `✗ ไม่ผ่าน ${failed} จาก ${CASES.length}` : `✓ หน้าจ่ายเงินบนเว็บจริงผ่านทั้ง ${CASES.length} แบบ`);
process.exit(failed ? 1 : 0);
