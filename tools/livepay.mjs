// ตรวจหน้าชำระเงินบนเว็บจริงหลัง deploy (CLAUDE.md: กดชำระเงินแล้วต้องมีคำขอ QR) · ดักคำขอ /api/checkout?m=qr ไว้ ไม่สร้างการจ่ายเงินจริง
// ใช้: node tools/livepay.mjs [https://sheetlabth.com/p/<slug>]  → {"href":..., "qr":1, "errs":[]}  (qr ต้องเป็น 1)
import { chromium } from 'playwright-core';
import fs from 'node:fs';
const CHROME = process.env.CHROME_PATH || ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/usr/bin/google-chrome', '/usr/bin/chromium'].find((p) => fs.existsSync(p));
const url = process.argv[2] || 'https://sheetlabth.com/p/ielts-band-7-10-reading-mock-writing-spe';
const b = await chromium.launch({ executablePath: CHROME, headless: true });
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, userAgent: 'Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Mobile Safari/537.36 sl-livecheck' });
const p = await ctx.newPage(), errs = []; let qr = 0;
p.on('pageerror', (e) => errs.push(String(e.message).slice(0, 160)));
await p.route(/\/api\/checkout\?m=qrimg/, (r) => r.fulfill({ status: 200, contentType: 'image/gif', body: Buffer.from('R0lGODlhAQABAAAAACw=', 'base64') }));
await p.route(/\/api\/checkout\?m=qr(?:&|$)/, (r) => { qr++; if (process.env.DEBUG) console.error('qr', r.request().method(), r.request().url().slice(0, 140), (r.request().postData() || '').slice(0, 160)); return r.fulfill({ json: { ok: true, pi: 'pi_livecheck', k: 'pi_livecheck_secret', png: 'data:image/gif;base64,R0lGODlhAQABAAAAACw=', amount: 1 } }); });
await p.route(/facebook|fbevents|google-analytics|googletagmanager/, (r) => r.abort());
try {
  await p.goto(url + (url.includes('?') ? '&' : '?') + 'utm_campaign=livecheck', { waitUntil: 'domcontentloaded', timeout: 45000 });
  const em = p.locator('#qr-email');
  if (!(await em.isVisible().catch(() => false))) { await p.locator('[data-a="qrOpen"]').first().click({ timeout: 15000 }); }
  await em.waitFor({ state: 'visible', timeout: 15000 });
  await em.fill('livecheck@example.com');
  await p.locator('[data-a="qrMake"]').first().click({ timeout: 10000 });
  await p.waitForTimeout(4000);
} catch (e) { errs.push('flow: ' + String(e.message).split('\n')[0].slice(0, 160)); }
console.log(JSON.stringify({ href: url, qr, errs }));
await b.close();
process.exit(qr === 1 ? 0 : 1);
