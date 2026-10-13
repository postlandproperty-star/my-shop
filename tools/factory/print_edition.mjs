// 📄 ฉบับพิมพ์กระชับ (คุณแดน 11 ต.ค. 69: เล่มพิมพ์ไม่เกินประมาณ 100 หน้า · ลูกค้าแบบไฟล์ยังได้ไฟล์เต็ม)
// ตัดจากไฟล์เต็มด้วยเครื่องหมายซ่อนในเล่มจากโรงงาน: @@COPY@@ @@HOW@@ @@GUIDE@@ · ชุดที่ n = @@CHn@@ (โจทย์) → @@CHnS@@ (สคริปต์) → @@CHnA@@ (เฉลย)
// เก็บ: ปก + ลิขสิทธิ์ + วิธีใช้ (+ คู่มือกลยุทธ์ ถ้าไม่เกิน 2 หน้า) + โจทย์ทุกชุด + หน้าแรกของเฉลยแต่ละชุด (เฉลยฉบับย่อ) + หน้า QR ไปไฟล์เต็ม (สคริปต์ คำแปล เฉลยละเอียด)
// ใช้บน Mac: node tools/factory/print_edition.mjs <product_id> [--dry]   (ต้องมี pdftotext จาก poppler · Chrome)
// --trim = ไม่ตัดเนื้อหา แค่ลบหน้าปกเก่าที่ซ้อนอยู่ก่อนหน้าลิขสิทธิ์/วิธีใช้/สารบัญ (บางเล่มมีปก 2 หน้า · คุณแดน 11 ต.ค. 69 "ปกเก่ายังอยู่") · ไม่มีปกซ้อน = ไม่ทำอะไร
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path'; import { execFileSync } from 'node:child_process';
import { PDFDocument } from 'pdf-lib'; import { chromium } from 'playwright-core';

const id = process.argv[2], dry = process.argv.includes('--dry'), trim = process.argv.includes('--trim');
// --target 50 = เล่มพิมพ์ Shopee ไม่เกิน 50 หน้า (25 แผ่นพิมพ์ 2 หน้า · คุณแดน 13 ต.ค. 69 "ต้นทุนพิมพ์สูง") · เก็บหน้าแรกของทุกบท + หน้าเฉลยแรกของบท + หน้า QR ไปไฟล์เต็ม
const ti = process.argv.indexOf('--target'), target = ti > 0 ? Math.max(20, Number(process.argv[ti + 1]) || 50) : 0;
if (!id) { console.error('ใช้: node tools/factory/print_edition.mjs <product_id> [--dry]'); process.exit(1); }
const KEY = process.env.CONTENT_KEY || fs.readFileSync(path.join(os.homedir(), '.config/sheetlab/content-key'), 'utf8').slice(0, 48).trim();
const API = 'https://sheetlabth.com/api/content?action=print_edition', H = { 'x-content-key': KEY, 'Content-Type': 'application/json' };
const call = async (body) => { const r = await fetch(API, { method: 'POST', headers: H, body: JSON.stringify({ id, ...body }) }); const j = await r.json(); if (!j.ok) throw new Error(j.error || r.status); return j; };
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sl-ed-'));

let s = await call({ op: 'sign' });
if (s.current && trim) { console.log(JSON.stringify({ skip: 'มีฉบับพิมพ์แล้ว' })); process.exit(0); }
if (target && !process.argv.includes('--force') && s.current && s.current.pages && s.current.pages <= target) { console.log(JSON.stringify({ skip: `ฉบับพิมพ์เดิม ${s.current.pages} หน้า ไม่เกิน ${target} แล้ว` })); process.exit(0); }
if (s.current && !dry) { await call({ op: 'clear' }); s = await call({ op: 'sign' }); } // ดึงไฟล์เต็ม (ไม่ใช่ฉบับเดิมที่ตัดแล้ว)
const get = async (u, f) => { const r = await fetch(u); if (!r.ok) throw new Error('โหลดไม่ได้ ' + r.status); fs.writeFileSync(f, Buffer.from(await r.arrayBuffer())); return f; };
const coverF = await get(s.cover, path.join(dir, 'cover.pdf')), bodyF = await get(s.body, path.join(dir, 'body.pdf'));
const pages = execFileSync('/opt/homebrew/bin/pdftotext', ['-layout', bodyF, '-'], { maxBuffer: 1 << 28 }).toString().split('\f');
const at = (re) => pages.findIndex((t) => re.test(t)), all = (re) => pages.map((t, i) => (re.test(t) ? i : -1)).filter((i) => i >= 0);
const keep = []; let sets = [];
if (target) {
  const full = pages.length + 1; if (full <= target) { console.log(JSON.stringify({ skip: `เล่มนี้ ${full} หน้า ไม่เกิน ${target}` })); process.exit(0); }
  const top = (t) => String(t).trim().slice(0, 260);
  // ปกซ้อน (บางเล่มมีปก 2 หน้า) → เริ่มที่หน้าเนื้อหาแรก
  const f0 = at(/@@(COPY|HOW|TOC)@@|ลิขสิทธิ์|สารบัญ|วิธีใช้|คำนำ|Contents/i), first = f0 > 0 && f0 <= 3 ? f0 : 0;
  const CH = /@@CH\d+@@|^\s*(บทที่|Unit|UNIT|Chapter|CHAPTER|Test|TEST|ชุดที่|Part|PART|Topic|TOPIC|Lesson|LESSON|Day|DAY|Week|WEEK)\s*\d+/m, ANS = /@@CH\d+A@@|เฉลย|Answer Key|ANSWER KEY|Answers/;
  let starts = []; for (let i = first; i < pages.length; i++) if (CH.test(top(pages[i])) && !/@@CH\d+[SA]@@/.test(pages[i])) starts.push(i);
  starts = starts.filter((x, k) => k === 0 || x - starts[k - 1] > 1); // หัวข้อซ้ำหน้าติดกัน (หน้าสารบัญ/หัวบท) นับครั้งเดียว
  const front = []; for (let i = first; i < (starts[0] ?? first + 2) && front.length < 3; i++) front.push(i);
  if (!starts.length) { const n = pages.length - first - front.length, seg = 6; for (let k = 0; k < seg; k++) starts.push(first + front.length + Math.floor((n * k) / seg)); }
  let budget = target - 1 /*ปก*/ - 1 /*หน้า QR*/ - front.length; front.forEach((i) => keep.push(i));
  const f1 = first + front.length; if (starts[0] - f1 > 3) starts.unshift(f1); // เนื้อหายาวก่อนบทแรกที่จับได้ (SL-050 เจอ "Test" แค่ท้ายเล่ม) = นับเป็นบทหนึ่ง ไม่ทิ้ง
  const chs = starts.map((st, k) => ({ st, en: k + 1 < starts.length ? starts[k + 1] : pages.length }));
  const use = chs.slice(0, Math.max(1, Math.min(chs.length, budget)));
  // แบ่งโควตาเท่าๆ กัน บทสั้นใช้ไม่หมด → ยกส่วนที่เหลือให้บทอื่น (เล่มต้องได้ ~target หน้าเสมอ)
  const quota = use.map(() => 0); let left = budget;
  while (left > 0) { const open = use.map((c, k) => k).filter((k) => quota[k] < use[k].en - use[k].st); if (!open.length) break; const each = Math.max(1, Math.floor(left / open.length)); for (const k of open) { if (left <= 0) break; const add = Math.min(each, use[k].en - use[k].st - quota[k], left); quota[k] += add; left -= add; } }
  for (const [k, c] of use.entries()) {
    const q = quota[k]; const range = []; for (let i = c.st; i < c.en; i++) range.push(i);
    const ans = range.find((i) => ANS.test(top(pages[i])));
    const wa = ans != null && q >= 3, body = (wa ? range.filter((i) => i !== ans) : range).slice(0, wa ? q - 1 : q); // โควตาน้อย = เอาหน้าตามลำดับ (ไม่ทิ้งหน้าเฉลย แล้วได้ไม่ครบโควตา · SL-W07 ได้ 41 หน้า)
    body.forEach((i) => keep.push(i)); if (wa) keep.push(ans);
  }
  sets = use.map((_, k) => k + 1);
} else if (trim) { // หน้าแรกที่เป็นเนื้อหาจริง (ลิขสิทธิ์ / วิธีใช้ / สารบัญ / คำนำ) · หน้าก่อนนั้น = ปกซ้อน ตัดออก
  const first = at(/@@(COPY|HOW|TOC)@@|ลิขสิทธิ์|สารบัญ|วิธีใช้|คำนำ|Contents/i);
  if (first <= 0 || first > 3) { console.log(JSON.stringify({ skip: first > 3 ? 'ไม่แน่ใจว่าหน้าไหนเป็นปก ไม่แตะ' : 'ไม่มีปกซ้อน', first })); process.exit(0); }
  for (let i = first; i < pages.length; i++) keep.push(i);
} else {
for (const m of ['COPY', 'HOW']) { const i = at(new RegExp(`@@${m}@@`)); if (i >= 0) keep.push(i); }
const g = at(/@@GUIDE@@/), ch1 = at(/@@CH1@@/); if (g >= 0 && ch1 > g && ch1 - g <= 2) for (let i = g; i < ch1; i++) keep.push(i);
sets = all(/@@CH\d+@@/).map((i) => Number(pages[i].match(/@@CH(\d+)@@/)[1]));
if (!sets.length) throw new Error('ไม่พบเครื่องหมาย @@CHn@@ ในเล่ม (เล่มนี้ไม่ได้มาจากโรงงานแบบใหม่) ตัดอัตโนมัติไม่ได้');
for (const n of sets) {
  const a = at(new RegExp(`@@CH${n}@@`)), sc = at(new RegExp(`@@CH${n}S@@`)), ans = at(new RegExp(`@@CH${n}A@@`)), next = at(new RegExp(`@@CH${n + 1}@@`));
  const end = sc > a ? sc : ans > a ? ans : next > a ? next : pages.length; for (let i = a; i < end; i++) keep.push(i);
  if (ans > a) keep.push(ans);
}
}
const src = await PDFDocument.load(fs.readFileSync(bodyF), { ignoreEncryption: true }), cov = await PDFDocument.load(fs.readFileSync(coverF), { ignoreEncryption: true });
const out = await PDFDocument.create();
for (const pg of await out.copyPages(cov, [0])) out.addPage(pg);
for (const pg of await out.copyPages(src, [...new Set(keep)].filter((i) => i < src.getPageCount()).sort((a, b) => a - b))) out.addPage(pg);
if (!trim) { // หน้า QR ไปไฟล์เต็ม (ภาษาไทยเรนเดอร์ด้วย Chrome)
const b = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true }), pg = await b.newPage();
await pg.setContent(`<!doctype html><html lang="th"><head><meta charset="utf-8"><link href="https://fonts.googleapis.com/css2?family=Sarabun:wght@400;700;800&display=swap" rel="stylesheet"><style>@page{size:A4;margin:0}body{margin:0;font-family:Sarabun,sans-serif;color:#1e2b53}.p{width:210mm;height:297mm;box-sizing:border-box;padding:30mm 22mm;display:flex;flex-direction:column;align-items:center;text-align:center}h1{font-size:28pt;margin:0 0 6mm}p{font-size:15pt;line-height:1.6;margin:0 0 4mm}#q{margin:10mm 0}#q img,#q canvas{width:70mm;height:70mm}.b{background:#f0b400;color:#1e2b53;border-radius:4mm;padding:3mm 8mm;font-weight:800;font-size:14pt}</style></head><body><div class="p">${target ? `<h1>อ่านต่อฉบับเต็ม ${pages.length + 1} หน้า</h1><p>เล่มพิมพ์นี้คัดเนื้อหาหลักของทุกบทมาให้ ${target} หน้า<br>เนื้อหาเต็ม แบบฝึกหัดครบทุกข้อ และเฉลยละเอียด อยู่ในไฟล์ฉบับเต็ม</p>` : `<h1>สคริปต์ คำแปลไทย และเฉลยละเอียดทุกข้อ</h1><p>ฉบับพิมพ์นี้มีโจทย์ครบทุกชุดและเฉลยฉบับย่อท้ายแต่ละชุด<br>สคริปต์เสียง คำแปลไทย และคำอธิบายเฉลยทุกข้อ อยู่ในไฟล์ฉบับเต็ม</p>`}<div id="q"></div><p class="b">สแกน QR เปิดไฟล์ฉบับเต็ม</p><p style="font-size:12pt;margin-top:8mm">ไฟล์เสียง: สแกน QR ในหน้า "วิธีใช้หนังสือเล่มนี้"<br>เก็บหน้านี้ไว้ เปิดซ้ำได้ทุกเมื่อ</p></div><script src="https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js"></script><script>new QRCode(document.getElementById('q'),{text:${JSON.stringify(s.full)},width:700,height:700,correctLevel:QRCode.CorrectLevel.M});</script></body></html>`, { waitUntil: 'networkidle' });
await pg.waitForTimeout(500); const qrPdf = await pg.pdf({ format: 'A4', printBackground: true, preferCSSPageSize: true }); await b.close();
for (const p2 of await out.copyPages(await PDFDocument.load(qrPdf), [0])) out.addPage(p2);
}
const bytes = await out.save(), n = out.getPageCount(), file = path.join(dir, 'edition.pdf'); fs.writeFileSync(file, bytes);
console.log(JSON.stringify({ full: src.getPageCount() + 1, edition: n, sets: trim ? 0 : sets.length, kept: [...new Set(keep)].length, mb: +(bytes.length / 1e6).toFixed(1), file }));
if (dry) process.exit(0);
const up = await fetch(s.upload_url, { method: 'PUT', headers: { 'Content-Type': 'application/pdf', 'x-upsert': 'true' }, body: bytes }); if (!up.ok) throw new Error('อัปโหลดไม่ได้ ' + up.status + ' ' + (await up.text()).slice(0, 120));
const r = await call({ op: 'set', url: s.file_url, pages: n, note: target ? `เล่มพิมพ์ Shopee ไม่เกิน ${target} หน้า (${sets.length} บท)` : trim ? 'ตัดปกเก่าที่ซ้อนออก' : `ฉบับพิมพ์กระชับ ${sets.length} ชุด` }); console.log('ตั้งฉบับพิมพ์แล้ว', JSON.stringify(r.edition));
