// แอดมินเชื่อมเพจ Facebook จากหลังบ้าน (วางโทเค็นจาก Graph API Explorer ครั้งเดียว)
//   ?action=status              สถานะการเชื่อม
//   ?action=connect  POST {token, pageId?}  แลกโทเค็น เลือกเพจ บันทึก
//   ?action=test                ลองอ่านข้อมูลเพจด้วยโทเค็นที่เก็บไว้
//   ?action=disconnect POST     ลบโทเค็น
import { verifyAdmin } from '../lib/shop.js';
import { loadFb, saveFb, clearFb, fbGet, exchangeForPages, appConfigured } from '../lib/fb.js';

async function readBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  return new Promise((resolve) => { let d = ''; req.on('data', (c) => (d += c)); req.on('end', () => { try { resolve(JSON.parse(d || '{}')); } catch { resolve({}); } }); });
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  const admin = await verifyAdmin(req.headers.authorization);
  if (!admin) return res.status(401).json({ ok: false, error: 'ต้องล็อกอินแอดมิน' });
  const action = String(req.query.action || 'status');
  try {
    if (action === 'status') {
      const fb = await loadFb();
      return res.status(200).json({ ok: true, app: appConfigured(), connected: !!fb, page: fb ? { id: fb.pageId, name: fb.pageName || '', connectedAt: fb.connectedAt || null, by: fb.userName || '' } : null });
    }
    if (action === 'connect') {
      if (req.method !== 'POST') return res.status(405).json({ ok: false });
      const body = await readBody(req);
      const token = String(body.token || '').trim();
      if (token.length < 30) return res.status(400).json({ ok: false, error: 'วางโทเค็นก่อน' });
      const { user, pages, userToken } = await exchangeForPages(token, String(body.pageId || ''));
      if (!pages.length) return res.status(400).json({ ok: false, error: 'ไม่พบเพจจากโทเค็นนี้ ลองใส่เลข Page ID ในช่องด้านล่างแล้วกดเชื่อมอีกครั้ง' });
      const want = String(body.pageId || '');
      const page = want ? pages.find((p) => p.id === want) : pages.length === 1 ? pages[0] : null;
      if (!page) return res.status(200).json({ ok: true, choose: pages.map((p) => ({ id: p.id, name: p.name, followers: p.followers_count || 0 })) });
      const info = await fbGet(page.id, { access_token: page.access_token, fields: 'id,name,followers_count,link' });
      await saveFb({ pageId: page.id, pageName: info.name, token: page.access_token, userToken, userName: user.name, connectedAt: new Date().toISOString() });
      return res.status(200).json({ ok: true, page: { id: page.id, name: info.name, followers: info.followers_count || 0, link: info.link } });
    }
    if (action === 'test') {
      const fb = await loadFb();
      if (!fb) return res.status(200).json({ ok: false, error: 'ยังไม่ได้เชื่อมเพจ' });
      const info = await fbGet(fb.pageId, { access_token: fb.token, fields: 'id,name,followers_count,link' });
      return res.status(200).json({ ok: true, page: { id: info.id, name: info.name, followers: info.followers_count || 0, link: info.link } });
    }
    if (action === 'disconnect') {
      if (req.method !== 'POST') return res.status(405).json({ ok: false });
      await clearFb();
      return res.status(200).json({ ok: true });
    }
    res.status(400).json({ ok: false, error: 'unknown action' });
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok: false, error: String(e.message || e) });
  }
}
