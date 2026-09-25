// แอดมินกด "ตรวจลิงก์": เซิร์ฟเวอร์ลองเปิดลิงก์ไฟล์แบบเดียวกับลูกค้า แล้วบอกว่าเปิดได้จริงไหม
// GET /api/link-check?url=...  (ต้องล็อกอินแอดมิน)
import { verifyAdmin } from '../lib/shop.js';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  const admin = await verifyAdmin(req.headers.authorization);
  if (!admin) return res.status(401).json({ ok: false, error: 'ต้องล็อกอินแอดมิน' });
  const url = String(req.query.url || '').trim();
  if (!/^https?:\/\//.test(url)) return res.status(400).json({ ok: false, status: 'bad', text: 'ลิงก์ต้องขึ้นต้นด้วย https://' });
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 8000);
    const r = await fetch(url, { redirect: 'follow', signal: ctrl.signal, headers: { 'User-Agent': 'Mozilla/5.0 (link check)', 'Accept-Language': 'th,en' } });
    clearTimeout(t);
    const finalUrl = r.url || url;
    const ctype = r.headers.get('content-type') || '';
    let title = '';
    if (/text\/html/.test(ctype)) {
      const html = (await r.text()).slice(0, 200000);
      title = (html.match(/<title[^>]*>([^<]*)<\/title>/i) || [, ''])[1].trim();
    }
    const needsLogin = /accounts\.google\.com|\/signin|login/i.test(finalUrl) || /^Sign in|ลงชื่อเข้าใช้/i.test(title);
    if (r.status === 404 || /Page Not Found|ไม่พบ/i.test(title)) return res.status(200).json({ ok: false, status: 'notfound', text: 'ไม่พบไฟล์ (404) ลิงก์อาจผิดหรือไฟล์ถูกลบ' });
    if (needsLogin) return res.status(200).json({ ok: false, status: 'private', text: 'เปิดไม่ได้ ต้องล็อกอิน — ไปที่ Google Drive → แชร์ → เปลี่ยนเป็น "ทุกคนที่มีลิงก์"' });
    if (!r.ok) return res.status(200).json({ ok: false, status: 'error', text: `เปิดไม่ได้ (HTTP ${r.status})` });
    const name = title.replace(/\s*-\s*Google (Drive|Docs|Sheets|Slides)\s*$/i, '');
    const isDrive = /drive\.google\.com|docs\.google\.com/.test(finalUrl);
    res.status(200).json({ ok: true, status: 'public', text: `เปิดได้สาธารณะ ✓${name ? ' — ' + name : ''}${isDrive ? '' : ' (ไม่ใช่ Google Drive แต่เปิดได้)'}`, title: name });
  } catch (e) {
    res.status(200).json({ ok: false, status: 'error', text: e.name === 'AbortError' ? 'เปิดลิงก์ช้าเกินไป (หมดเวลา 8 วินาที)' : 'เปิดลิงก์ไม่ได้: ' + String(e.message || e) });
  }
}
