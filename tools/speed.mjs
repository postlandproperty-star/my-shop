// วัดความเร็วหน้าขายแบบมือถือ 4G (คุณแดน 17 ต.ค. 69 "เปิดหน้า salepage ช้ามาก")
// ใช้: node tools/speed.mjs [url] [--slow] [--real]  → เวลาเห็นราคา/ปุ่มซื้อ, LCP, ไฟล์ใหญ่สุด (ไม่ยิง Facebook/GA)
import { chromium } from 'playwright-core';
import fs from 'node:fs';
const CHROME = process.env.CHROME_PATH || ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/usr/bin/google-chrome', '/usr/bin/chromium'].find((p) => fs.existsSync(p));
const url = process.argv.find((a) => a.startsWith('http')) || 'https://sheetlabth.com/p/ielts-9';
const slow = process.argv.includes('--slow');
const b = await chromium.launch({ executablePath: CHROME, headless: true });
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 3,
  userAgent: 'Mozilla/5.0 (Linux; Android 13; SM-A536E) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Mobile Safari/537.36 [FB_IAB/FB4A;FBAV/450.0.0.0;]' });
const p = await ctx.newPage(), cdp = await ctx.newCDPSession(p);
// มือถือทั่วไปบน 4G (หรือ --slow = 4G สัญญาณไม่ดี) + CPU มือถือกลางๆ ช้ากว่าคอม 4 เท่า
await cdp.send('Network.enable');
await cdp.send('Network.emulateNetworkConditions', slow ? { offline: false, latency: 300, downloadThroughput: 400 * 1024 / 8, uploadThroughput: 200 * 1024 / 8 } : { offline: false, latency: 150, downloadThroughput: 1.6 * 1024 * 1024 / 8, uploadThroughput: 750 * 1024 / 8 });
await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
if (!process.argv.includes('--real')) await p.route(/facebook\.net|fbevents|google-analytics|googletagmanager|clarity\.ms/, (r) => r.abort()); // --real = โหลดตัวนับ Facebook/Clarity เหมือนลูกค้าจริง
const reqs = new Map();
p.on('response', async (r) => { try { const h = await r.headerValue('content-length'); reqs.set(r.url(), { type: r.request().resourceType(), bytes: Number(h) || (await r.body().catch(() => Buffer.alloc(0))).length }); } catch {} });
await p.addInitScript(() => { window.__lcp = 0; new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__lcp = e.startTime; }).observe({ type: 'largest-contentful-paint', buffered: true }); });
const t0 = Date.now();
const nav = p.goto(url + (url.includes('?') ? '&' : '?') + 'utm_campaign=speedcheck', { waitUntil: 'domcontentloaded', timeout: 90000 }); // ไม่รอ DOMContentLoaded ก่อนเริ่มจับเวลาเห็นราคา (ส่วนบนจากเซิร์ฟเวอร์ขึ้นก่อน)
let seen = null; try { await p.waitForFunction(() => { const h = document.querySelector('#app h1'); return h && h.getBoundingClientRect().height > 0; }, null, { timeout: 90000, polling: 50 }); seen = Date.now() - t0; } catch {}
await nav; const dcl = Date.now() - t0;
let buy = null; try { await p.locator('[data-a="qrOpen"], #qr-email').first().waitFor({ state: 'visible', timeout: 60000 }); buy = Date.now() - t0; } catch {}
await p.waitForLoadState('load', { timeout: 90000 }).catch(() => {});
const load = Date.now() - t0;
await p.waitForTimeout(1500);
const lcp = await p.evaluate(() => Math.round(window.__lcp)), fcp = await p.evaluate(() => Math.round((performance.getEntriesByName('first-contentful-paint')[0] || {}).startTime || 0));
const all = [...reqs.entries()].map(([u, x]) => ({ u: u.replace(/\?.*$/, '').slice(0, 110), ...x }));
const sum = (f) => all.filter(f).reduce((s, x) => s + x.bytes, 0);
console.log(JSON.stringify({ url, net: slow ? '4G สัญญาณไม่ดี' : '4G', domReadyMs: dcl, priceSeenMs: seen, fcpMs: fcp, buyButtonMs: buy, loadMs: load, lcpMs: lcp, requests: all.length,
  kb: { total: Math.round(sum(() => true) / 1024), images: Math.round(sum((x) => x.type === 'image') / 1024), fonts: Math.round(sum((x) => x.type === 'font') / 1024), scripts: Math.round(sum((x) => x.type === 'script') / 1024), media: Math.round(sum((x) => x.type === 'media') / 1024) },
  biggest: all.sort((a, b2) => b2.bytes - a.bytes).slice(0, 8).map((x) => `${Math.round(x.bytes / 1024)}KB ${x.type} ${x.u}`) }, null, 1));
await b.close();
