// ตรวจโค้ดพิมพ์ผิดก่อนขึ้นเว็บ: ทุกไฟล์ใน api/ lib/ และสคริปต์หลักใน src/index.html ต้องอ่านออก (node --check)
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
const root = path.join(path.dirname(new URL(import.meta.url).pathname), '..');
let bad = 0;
const check = (file, label) => { try { execFileSync(process.execPath, ['--check', file], { stdio: 'pipe' }); } catch (e) { bad++; console.log(`✗ ${label}\n${String(e.stderr || e.message).split('\n').slice(0, 6).join('\n')}`); } };
for (const dir of ['api', 'lib', 'tests']) for (const f of fs.readdirSync(path.join(root, dir)).filter((x) => /\.m?js$/.test(x))) check(path.join(root, dir, f), `${dir}/${f}`);
const html = fs.readFileSync(path.join(root, 'src/index.html'), 'utf8');
const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
const tmp = path.join(os.tmpdir(), `sheetlab-main-${process.pid}.js`);
fs.writeFileSync(tmp, scripts.sort((a, b) => b.length - a.length)[0] || ''); check(tmp, 'src/index.html (สคริปต์หลัก)'); fs.rmSync(tmp, { force: true });
// หน้าลูกค้าแบบแยกโค้ดหลังบ้าน (lib/split.js) ต้องอ่านออกทั้ง 2 ส่วน และต้องแยกได้จริง (ไม่งั้นเว็บเสิร์ฟไฟล์เต็ม หน้าช้าลง)
{ const { splitHtml } = await import(path.join(root, 'lib/split.js')); let sp = null; try { sp = splitHtml(html); } catch (e) { bad++; console.log(`✗ แยกโค้ดหลังบ้านไม่ได้: ${e.message}`); }
  if (sp) { const core = sp.html.slice(sp.html.indexOf('<script>') + 8, sp.html.lastIndexOf('</script>'));
    fs.writeFileSync(tmp, core); check(tmp, 'หน้าลูกค้า (แยกโค้ดหลังบ้านแล้ว)'); fs.writeFileSync(tmp, sp.chunk); check(tmp, '/adm.js (โค้ดหลังบ้าน)'); fs.rmSync(tmp, { force: true });
    if (!(sp.moved > 100 && core.length < sp.chunk.length)) { bad++; console.log(`✗ แยกโค้ดหลังบ้านได้น้อยผิดปกติ (ย้าย ${sp.moved} ฟังก์ชัน)`); } } }
// Vercel แผนฟรีมีได้ไม่เกิน 12 ฟังก์ชัน (ไฟล์ใน api/) เกินแล้วขึ้นเว็บไม่ได้ทั้งเว็บ
const fnN = fs.readdirSync(path.join(root, 'api')).filter((x) => /\.m?js$/.test(x)).length;
if (fnN > 12) { bad++; console.log(`✗ api/ มี ${fnN} ไฟล์ เกิน 12 ฟังก์ชันของ Vercel แผนฟรี (ย้ายไปเป็นทางย่อยของไฟล์เดิมแทน)`); }
console.log(bad ? `✗ โค้ดมีที่ผิด ${bad} ไฟล์` : '✓ โค้ดทุกไฟล์อ่านออก');
process.exit(bad ? 1 : 0);
