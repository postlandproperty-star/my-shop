// Webhook ของ Messenger (URL /api/messenger → rewrite ไป /api/stripe-webhook?mx=1) (เพจ Facebook): GET = Meta ยืนยัน URL · POST = ข้อความเข้า → lib/chatbot.js ตอบ
// ตั้งใน developers.facebook.com → แอป → Messenger → Webhooks: URL https://sheetlabth.com/api/messenger · Verify token ดูได้ในหลังบ้าน แท็บแชทบอท
import { createHmac, timingSafeEqual } from 'node:crypto';
import { verifyToken, handleEvent } from './chatbot.js';
import { loadFb } from './fb.js';


const raw = (req) => new Promise((ok) => { let b = ''; req.on('data', (c) => { b += c; if (b.length > 1e6) req.destroy(); }); req.on('end', () => ok(b)); });

export async function messengerHook(req, res) { // เรียกผ่าน api/stripe-webhook.js (?mx=1) เพราะ Vercel แผนฟรีจำกัด 12 ฟังก์ชัน
  if (req.method === 'GET') {
    const q = req.query || {};
    if (q['hub.mode'] === 'subscribe' && q['hub.verify_token'] === verifyToken()) return res.status(200).send(String(q['hub.challenge'] || ''));
    return res.status(403).send('forbidden');
  }
  if (req.method !== 'POST') return res.status(405).end();
  const body = await raw(req);
  const secret = process.env.FB_APP_SECRET || '';
  if (secret) { // ตรวจลายเซ็นจาก Meta (กันคนอื่นยิงปลอม)
    const sig = String(req.headers['x-hub-signature-256'] || '').replace(/^sha256=/, '');
    const exp = createHmac('sha256', secret).update(body).digest('hex');
    if (!sig || sig.length !== exp.length || !timingSafeEqual(Buffer.from(sig), Buffer.from(exp))) return res.status(401).send('bad signature');
  }
  let j = {}; try { j = JSON.parse(body || '{}'); } catch (e) { return res.status(400).end(); }
  if (j.object !== 'page') return res.status(200).send('ignored');
  const fb = await loadFb().catch(() => null); const site = `https://${req.headers.host || 'sheetlabth.com'}`;
  for (const entry of j.entry || []) for (const ev of entry.messaging || []) {
    if (!ev.message) continue;
    try { await handleEvent(ev, { site, pageId: fb?.pageId || entry.id }); } catch (e) { console.error('chatbot', e.message); }
  }
  res.status(200).send('EVENT_RECEIVED');
}
