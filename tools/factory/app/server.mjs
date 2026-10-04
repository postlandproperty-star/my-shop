// แอปโรงงาน SheetLab บน Mac: เซิร์ฟเวอร์เล็กๆ ในเครื่อง (127.0.0.1 เท่านั้น) ให้หน้าต่างแอปเห็นทั้ง
//   - คิวโรงงานบนเว็บ (สด ผ่าน /api/content?action=factory ด้วยคีย์ร้านใน ~/.config/sheetlab/content-key · คีย์ไม่ถูกส่งไปที่หน้าแอป)
//   - คลังหนังสือที่ผลิตแล้วบน SSD + โฟลเดอร์เดิม (tools/factory/catalog.py --json)
// สั่งเล่มใหม่ / ยกเลิกใบสั่ง จากแอป = เขียนลงคิวบนเว็บที่เดียวกับหลังบ้าน (sync กันเสมอ) · การอนุมัติลงขายยังทำในหลังบ้าน
//   node tools/factory/app/server.mjs        (แอป .app เรียกให้เอง)
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const PORT = 7788, HOST = '127.0.0.1';
const DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(DIR, '..', '..', '..');
const SSD = '/Volumes/PortableSSD/Sheetlab';
const ROOTS = [SSD, path.join(os.homedir(), 'Documents', 'Academic')];
const THUMBS = path.join(SSD, '_factory', 'thumbs');
const API = 'https://sheetlabth.com/api/content';
const key = () => { try { return fs.readFileSync(path.join(os.homedir(), '.config', 'sheetlab', 'content-key'), 'utf8').match(/[0-9a-f]{48}/)?.[0] || ''; } catch { return ''; } };

async function web(action, body) {
  const k = key(); if (!k) return { ok: false, error: 'ยังไม่มีไฟล์คีย์ร้าน (~/.config/sheetlab/content-key)' };
  const r = await fetch(`${API}?action=${action}`, { method: body ? 'POST' : 'GET', headers: { 'x-content-key': k, 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  return r.json().catch(() => ({ ok: false, error: `เว็บตอบ ${r.status}` }));
}
const run = (cmd, args, timeout = 120000) => new Promise((ok) => execFile(cmd, args, { timeout, maxBuffer: 20e6 }, (e, out) => ok(e ? null : out)));
let lib = { at: 0, data: null };
async function library(force) {
  if (!force && lib.data && Date.now() - lib.at < 30e3) return lib.data;
  const out = await run('/usr/bin/python3', [path.join(REPO, 'tools', 'factory', 'catalog.py'), '--json']);
  try { lib = { at: Date.now(), data: JSON.parse(out) }; } catch { lib = { at: Date.now(), data: { ok: false, ssd: fs.existsSync(SSD), books: [], sets: [], error: 'อ่านคลังหนังสือไม่ได้' } }; }
  return lib.data;
}
const inRoots = (p) => { const r = path.resolve(String(p || '')); return ROOTS.some((x) => r.startsWith(x + path.sep)) && fs.existsSync(r) ? r : null; };
function running() { try { const f = path.join(SSD, '_factory', '.running'); const st = fs.statSync(f); return Date.now() - st.mtimeMs < 4 * 3600e3 ? { since: st.mtime.toISOString(), note: fs.readFileSync(f, 'utf8').slice(0, 300) } : null; } catch { return null; } }

const send = (res, code, body, type = 'application/json; charset=utf-8') => { res.writeHead(code, { 'Content-Type': type, 'Cache-Control': 'no-store' }); res.end(typeof body === 'string' || Buffer.isBuffer(body) ? body : JSON.stringify(body)); };
const readBody = (req) => new Promise((ok) => { let s = ''; req.on('data', (c) => { s += c; if (s.length > 1e5) req.destroy(); }); req.on('end', () => { try { ok(JSON.parse(s || '{}')); } catch { ok({}); } }); });

http.createServer(async (req, res) => {
  try {
    const u = new URL(req.url, `http://${HOST}`);
    if (req.headers.host && !/^(127\.0\.0\.1|localhost)(:\d+)?$/.test(req.headers.host)) return send(res, 403, { ok: false }); // กันเว็บอื่นเรียกเข้ามา
    if (u.pathname === '/') return send(res, 200, fs.readFileSync(path.join(DIR, 'index.html')), 'text/html; charset=utf-8');
    if (u.pathname === '/icon.png') return send(res, 200, fs.readFileSync(path.join(REPO, 'src', 'brand', 'icon-192.png')), 'image/png');
    const t = u.pathname.match(/^\/thumb\/(\d{3})\.jpg$/);
    if (t) { const f = path.join(THUMBS, `${t[1]}.jpg`); return fs.existsSync(f) ? send(res, 200, fs.readFileSync(f), 'image/jpeg') : send(res, 404, ''); }
    if (u.pathname === '/api/status') { const j = await web('factory'); return send(res, 200, { ok: !!j.ok, error: j.error || null, jobs: (j.jobs || []).map((x) => ({ id: x.id, title: x.title, status: x.status, listing: x.listing || '', price: x.price, pages: x.pages, category: x.category || '', created_at: x.created_at, done_at: x.done_at || null, file_url: x.file_url || x.notion_url || '', cover: (x.images || [])[0] || '', summary: x.summary || '', ordered_by: x.ordered_by || '', notes: x.notes || '' })), worker: j.worker || null, paused: !!j.paused, ssd: fs.existsSync(SSD), running: running(), at: new Date().toISOString() }); }
    if (u.pathname === '/api/library') return send(res, 200, await library(u.searchParams.has('fresh')));
    if (req.method !== 'POST') return send(res, 404, { ok: false });
    const b = await readBody(req);
    if (u.pathname === '/api/order') { // สั่งเล่มใหม่เข้าคิวบนเว็บ (คิวเดียวกับหลังบ้าน)
      const title = String(b.title || '').trim(); if (!title) return send(res, 400, { ok: false, error: 'ใส่ชื่อเล่ม' });
      return send(res, 200, await web('factory_order', { title, price: Number(b.price) || 0, pages: Number(b.pages) || undefined, category: String(b.category || ''), notes: String(b.notes || ''), audience: String(b.audience || ''), ordered_by: 'owner' }));
    }
    if (u.pathname === '/api/cancel') return send(res, 200, await web('factory_cancel', { id: String(b.id || ''), note: 'คุณแดนยกเลิกจากแอปโรงงานบน Mac' }));
    if (u.pathname === '/api/open' || u.pathname === '/api/reveal') { const f = inRoots(b.path); if (!f) return send(res, 400, { ok: false, error: 'ไม่พบไฟล์' }); await run('/usr/bin/open', u.pathname === '/api/reveal' ? ['-R', f] : [f], 15000); return send(res, 200, { ok: true }); }
    if (u.pathname === '/api/refresh') { await run('/usr/bin/python3', [path.join(REPO, 'tools', 'factory', 'catalog.py')]); return send(res, 200, await library(true)); }
    send(res, 404, { ok: false });
  } catch (e) { send(res, 500, { ok: false, error: String(e.message || e) }); }
}).listen(PORT, HOST, () => console.log(`โรงงาน SheetLab: http://${HOST}:${PORT}`));
