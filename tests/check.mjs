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
console.log(bad ? `✗ โค้ดมีที่ผิด ${bad} ไฟล์` : '✓ โค้ดทุกไฟล์อ่านออก');
process.exit(bad ? 1 : 0);
