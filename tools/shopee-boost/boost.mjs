// กด "โปรโมทตอนนี้" (ดันสินค้า) ใน Shopee Seller Centre ให้อัตโนมัติ ใช้ Google Chrome ในเครื่อง Mac
//   node boost.mjs --login      เปิด Chrome ให้ล็อกอินร้านครั้งแรก (หรือเมื่อหลุด) แล้วปิดหน้าต่างเอง
//   node boost.mjs --dry        ลองหาเมนูของทุกชิ้นแต่ไม่กดโปรโมทจริง (ไว้เช็กก่อนตั้งเวลา)
//   node boost.mjs              ดันจริงตามรายชื่อใน products.txt (launchd เรียกทุก 4 ชม.)
// เก็บโปรไฟล์ Chrome / log / ภาพหน้าจอไว้ที่ ~/.shopee-boost
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const HERE = path.dirname(new URL(import.meta.url).pathname);
const HOME = path.join(os.homedir(), '.shopee-boost');
const PROFILE = path.join(HOME, 'chrome-profile');
const SHOTS = path.join(HOME, 'shots');
const LOG = path.join(HOME, 'log.txt');
const LIST_URL = process.env.BOOST_URL || 'https://seller.shopee.co.th/portal/product/list/live/all'; // BOOST_URL ไว้ทดสอบกับหน้าจำลอง
const MENU_TEXT = /โปรโมทตอนนี้|Boost Now/;
const args = new Set(process.argv.slice(2));
const DRY = args.has('--dry');
const HEADLESS = process.env.HEADLESS === '1'; // ค่าเริ่มเปิดหน้าต่างจริง Shopee บล็อกโหมดซ่อนบ่อยกว่า

fs.mkdirSync(SHOTS, { recursive: true });
const log = (...a) => { const line = `[${new Date().toLocaleString('th-TH')}] ${a.join(' ')}`; console.log(line); fs.appendFileSync(LOG, line + '\n'); };
const notify = (msg) => { if (process.platform !== 'darwin') return; try { execFileSync('osascript', ['-e', `display notification ${JSON.stringify(msg)} with title "Shopee Boost"`]); } catch {} };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const products = fs.readFileSync(path.join(HERE, 'products.txt'), 'utf8').split('\n').map((x) => x.trim()).filter((x) => x && !x.startsWith('#'));
if (products.length > 5) log(`เตือน: products.txt มี ${products.length} ชิ้น Shopee ดันพร้อมกันได้แค่ 5 ชิ้น ชิ้นที่เกินจะกดไม่ได้`);

const ctx = await chromium.launchPersistentContext(PROFILE, {
  ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : { channel: 'chrome' }), headless: HEADLESS && !args.has('--login'), viewport: { width: 1440, height: 1000 }, locale: 'th-TH',
});
const page = ctx.pages()[0] || await ctx.newPage();
const isLoginPage = () => /signin|login|verify/i.test(page.url());

if (args.has('--login')) {
  await page.goto(LIST_URL);
  console.log('ล็อกอินร้านในหน้าต่าง Chrome ที่เปิดขึ้น (ติ๊ก "จดจำฉัน" ถ้ามี) เห็นหน้า "สินค้าของฉัน" แล้วปิดหน้าต่างได้เลย');
  await new Promise((r) => ctx.on('close', r));
  process.exit(0);
}

// หาปุ่ม "..." ของการ์ดสินค้าที่มีชื่อนี้: ใช้ตำแหน่งบนจอ (อยู่ใต้ชื่อ ในคอลัมน์เดียวกัน) เพราะชื่อ class ของ Shopee เปลี่ยนบ่อย
async function moreButtons(title) {
  const box = await title.boundingBox();
  if (!box) return [];
  return page.evaluate(({ x, y, w }) => {
    const out = [];
    for (const el of document.querySelectorAll('body *')) {
      const r = el.getBoundingClientRect();
      if (!r.width || !r.height || r.width > 60 || r.height > 60) continue;
      const cx = r.x + r.width / 2, cy = r.y + r.height / 2;
      if (cx < x - 20 || cx > x + Math.max(w, 200) + 20 || cy < y || cy > y + 260) continue;
      const cls = `${el.className?.baseVal ?? el.className ?? ''} ${el.getAttribute('aria-label') || ''}`;
      const txt = (el.innerText || '').trim();
      const score = /more|ellipsis|dropdown/i.test(cls) ? 2 : ['...', '…', '⋯', '•••'].includes(txt) ? 1 : 0;
      if (score) out.push({ cx, cy, score });
    }
    // คะแนนสูงก่อน แล้วเอาตัวขวาสุดในแถวล่างสุดก่อน (ตำแหน่งปุ่ม ... ในการ์ด)
    return out.sort((a, b) => b.score - a.score || b.cy - a.cy || b.cx - a.cx).slice(0, 6);
  }, { x: box.x, y: box.y, w: box.width });
}

async function boostOne(name, i) {
  await page.goto(LIST_URL, { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
  if (isLoginPage()) throw Object.assign(new Error('หลุดล็อกอิน'), { login: true });
  const search = page.getByPlaceholder(/ค้นหาด้วย|Search/).first();
  if (await search.isVisible().catch(() => false)) {
    await search.fill(name); await search.press('Enter');
    await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
    await sleep(1500);
  }
  const title = page.getByText(name, { exact: false }).filter({ visible: true }).last();
  try { await title.waitFor({ timeout: 15000 }); } catch { return 'ไม่เจอสินค้าชื่อนี้ในหน้ารายการ'; }
  await title.scrollIntoViewIfNeeded();
  for (const b of await moreButtons(title)) {
    await page.mouse.click(b.cx, b.cy);
    const item = page.getByText(MENU_TEXT).filter({ visible: true }).first();
    if (!(await item.waitFor({ timeout: 4000 }).then(() => true, () => false))) { await page.keyboard.press('Escape'); continue; }
    const disabled = await item.evaluate((el) => !!el.closest('[disabled],[class*="disabled"],[aria-disabled="true"]')).catch(() => false);
    if (disabled) { await page.screenshot({ path: path.join(SHOTS, `${i + 1}-กดไม่ได้.png`) }); await page.keyboard.press('Escape'); return 'เมนูโปรโมทกดไม่ได้ (น่าจะยังดันอยู่ หรือครบ 5 ชิ้นแล้ว)'; }
    if (DRY) { await page.screenshot({ path: path.join(SHOTS, `${i + 1}-เจอเมนู.png`) }); await page.keyboard.press('Escape'); return 'เจอเมนูโปรโมทตอนนี้ (โหมดลอง ไม่ได้กด)'; }
    await item.click();
    await sleep(1500);
    // บางครั้งมีกล่องยืนยัน
    const ok = page.getByRole('button', { name: /^(ยืนยัน|ตกลง|โปรโมท|Confirm|OK)$/ }).filter({ visible: true }).first();
    if (await ok.isVisible().catch(() => false)) { await ok.click(); await sleep(1500); }
    await page.screenshot({ path: path.join(SHOTS, `${i + 1}-หลังกด.png`) });
    const toast = await page.locator('[class*="toast"],[class*="message"],[role="alert"]').filter({ visible: true }).allInnerTexts().catch(() => []);
    return `กดโปรโมทแล้ว${toast.length ? ` · Shopee ตอบ: ${toast.join(' / ').replace(/\s+/g, ' ').slice(0, 120)}` : ''}`;
  }
  await page.screenshot({ path: path.join(SHOTS, `${i + 1}-หาเมนูไม่เจอ.png`) });
  return 'หาปุ่ม ... / เมนูโปรโมทไม่เจอ (ดูภาพใน ~/.shopee-boost/shots)';
}

let failed = 0;
for (const f of fs.readdirSync(SHOTS)) fs.rmSync(path.join(SHOTS, f));
log(`เริ่ม${DRY ? ' (โหมดลอง)' : ''} ${products.length} ชิ้น`);
for (const [i, name] of products.entries()) {
  try {
    const res = await boostOne(name, i);
    if (!/^(กดโปรโมทแล้ว|เจอเมนู|เมนูโปรโมทกดไม่ได้)/.test(res)) failed++;
    log(`${i + 1}. ${name} → ${res}`);
  } catch (e) {
    failed++;
    if (e.login) { log('หลุดล็อกอิน: รัน  node boost.mjs --login  แล้วล็อกอินใหม่'); notify('หลุดล็อกอิน Shopee ต้องล็อกอินใหม่'); break; }
    await page.screenshot({ path: path.join(SHOTS, `${i + 1}-error.png`) }).catch(() => {});
    log(`${i + 1}. ${name} → ผิดพลาด: ${e.message.split('\n')[0]}`);
  }
}
await ctx.close();
log(failed ? `จบ มีปัญหา ${failed} ชิ้น` : 'จบ ทุกชิ้นเรียบร้อย');
if (failed) notify(`ดันไม่สำเร็จ ${failed} ชิ้น ดู ~/.shopee-boost/log.txt`);
process.exit(failed ? 1 : 0);
