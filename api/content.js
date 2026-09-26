// ระบบคอนเทนต์ของเพจ: คิวโพสต์ในตาราง posts
//   ?action=shop     (key)   ข้อมูลร้าน + โพสต์ล่าสุด สำหรับ "นักเขียน" ใช้ร่างโพสต์
//   ?action=drafts   (key, POST) นักเขียนส่งร่างเข้า [{text,image_url,link_url,scheduled_at,kind}] → status draft
//   ?action=report   (key)   ตัวเลขสัปดาห์ (ยอดขาย/ออเดอร์/แคมเปญ) สำหรับ "ผู้จัดการ"
//   ?action=note     (key, POST) ผู้จัดการ/นักวิเคราะห์ส่งรายงาน {text,kind:'report'|'ads'}
//   ?action=publish  (cron หรือแอดมิน) โพสต์ที่อนุมัติแล้วและถึงเวลา → ขึ้นเพจ Facebook
//   ?action=publish&id=<uuid> (แอดมิน) โพสต์รายการเดียวทันที
// key = header x-content-key ตรงกับ CONTENT_API_KEY บน Vercel (ใช้เฉพาะรูทีนอัตโนมัติ)
import { loadShop, verifyAdmin, sbPatch } from '../lib/shop.js';

const SB_URL = 'https://lpeqaorswhwzlplsaqpe.supabase.co';
const SECRET = process.env.SUPABASE_SECRET_KEY || '';
const CONTENT_KEY = process.env.CONTENT_API_KEY || '';
const FB_PAGE_ID = process.env.FB_PAGE_ID || '';
const FB_PAGE_TOKEN = process.env.FB_PAGE_TOKEN || '';
const FB_API = 'https://graph.facebook.com/v21.0';

async function sb(path, { method = 'GET', body, prefer } = {}) {
  const headers = { apikey: SECRET, Authorization: `Bearer ${SECRET}`, 'Content-Type': 'application/json' };
  if (prefer) headers.Prefer = prefer;
  const r = await fetch(`${SB_URL}/rest/v1/${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
  const text = await r.text();
  if (!r.ok) throw new Error(`supabase ${path}: ${r.status} ${text.slice(0, 200)}`);
  return text ? JSON.parse(text) : null;
}

const keyOk = (req) => CONTENT_KEY.length >= 16 && req.headers['x-content-key'] === CONTENT_KEY;
const cronOk = (req) => !!req.headers['x-vercel-cron'] || (process.env.CRON_SECRET && req.headers.authorization === `Bearer ${process.env.CRON_SECRET}`);

async function readBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  return new Promise((resolve) => { let d = ''; req.on('data', (c) => (d += c)); req.on('end', () => { try { resolve(JSON.parse(d || '{}')); } catch { resolve({}); } }); });
}

export const fbConfigured = () => /^\d{5,}$/.test(FB_PAGE_ID) && FB_PAGE_TOKEN.length > 20;

// โพสต์ 1 รายการขึ้นเพจ: มีรูป → /photos (caption), ไม่มีรูป → /feed (message + link)
async function publishOne(p) {
  const params = new URLSearchParams({ access_token: FB_PAGE_TOKEN });
  let url;
  if (p.image_url) {
    params.set('url', p.image_url);
    params.set('caption', p.text || '');
    url = `${FB_API}/${FB_PAGE_ID}/photos`;
  } else {
    params.set('message', p.text || '');
    if (p.link_url) params.set('link', p.link_url);
    url = `${FB_API}/${FB_PAGE_ID}/feed`;
  }
  const r = await fetch(url, { method: 'POST', body: params });
  const j = await r.json();
  if (!r.ok || j.error) throw new Error(j.error?.message || `facebook ${r.status}`);
  return j.post_id || j.id;
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  const action = String(req.query.action || '');
  try {
    if (action === 'shop') {
      if (!keyOk(req)) return res.status(401).json({ ok: false, error: 'bad key' });
      const shop = await loadShop();
      const recent = await sb('posts?select=id,status,kind,text,scheduled_at,published_at&order=created_at.desc&limit=30');
      const products = shop.products.filter((p) => p.status === 'published').map((p) => ({
        id: p.id, slug: p.slug, name: p.name, headline: p.headline, desc: p.desc, price: p.price, fullPrice: p.fullPrice,
        features: p.features, specs: p.specs, toc: p.toc, forwho: p.forwho, pains: p.pains, faq: p.faq, images: p.images || [],
        url: `https://my-shop-lake-ten.vercel.app/p/${p.slug}`,
      }));
      return res.status(200).json({ ok: true, shop: { name: shop.settings.shopName || 'SheetLab', chatLink: shop.settings.chatLink || '', products }, recentPosts: recent });
    }
    if (action === 'drafts') {
      if (!keyOk(req)) return res.status(401).json({ ok: false, error: 'bad key' });
      if (req.method !== 'POST') return res.status(405).json({ ok: false });
      const body = await readBody(req);
      const list = Array.isArray(body.posts) ? body.posts : Array.isArray(body) ? body : [];
      const rows = list.filter((p) => p && String(p.text || '').trim()).slice(0, 10).map((p) => ({
        status: 'draft', source: 'writer', kind: String(p.kind || 'tip').slice(0, 20),
        text: String(p.text).slice(0, 4000), image_url: p.image_url ? String(p.image_url).slice(0, 500) : null,
        link_url: p.link_url ? String(p.link_url).slice(0, 500) : null,
        scheduled_at: p.scheduled_at && !isNaN(Date.parse(p.scheduled_at)) ? new Date(p.scheduled_at).toISOString() : null,
        week: p.week ? String(p.week).slice(0, 12) : null, notes: p.notes ? String(p.notes).slice(0, 1000) : null,
      }));
      if (!rows.length) return res.status(400).json({ ok: false, error: 'no posts' });
      const inserted = await sb('posts', { method: 'POST', body: rows, prefer: 'return=representation' });
      return res.status(200).json({ ok: true, inserted: inserted.length, ids: inserted.map((r) => r.id) });
    }
    if (action === 'report') {
      if (!keyOk(req)) return res.status(401).json({ ok: false, error: 'bad key' });
      const since = new Date(Date.now() - 7 * 864e5).toISOString();
      const prev = new Date(Date.now() - 14 * 864e5).toISOString();
      const orders = await sb(`orders?select=created_at,paid_at,product_name,amount,status,campaign&created_at=gte.${prev}&order=created_at.desc`);
      const posts = await sb(`posts?select=id,status,kind,text,scheduled_at,published_at,fb_post_id&created_at=gte.${prev}&order=created_at.desc`);
      const shop = await loadShop();
      const priv = await sb('shop_state?id=eq.private&select=data');
      const campaigns = priv?.[0]?.data?.campaigns || [];
      const sum = (list) => list.reduce((a, o) => a + (Number(o.amount) || 0), 0);
      const paid = orders.filter((o) => o.status === 'paid');
      const thisWeek = paid.filter((o) => o.paid_at >= since), lastWeek = paid.filter((o) => o.paid_at < since);
      return res.status(200).json({ ok: true, generatedAt: new Date().toISOString(),
        thisWeek: { orders: thisWeek.length, revenue: sum(thisWeek) }, lastWeek: { orders: lastWeek.length, revenue: sum(lastWeek) },
        byProduct: Object.entries(thisWeek.reduce((m, o) => { m[o.product_name] = (m[o.product_name] || 0) + Number(o.amount); return m; }, {})),
        byCampaign: Object.entries(thisWeek.reduce((m, o) => { const k = o.campaign || '(ไม่ได้มาจากแอด)'; m[k] = m[k] || { orders: 0, revenue: 0 }; m[k].orders++; m[k].revenue += Number(o.amount); return m; }, {})),
        campaigns, unpaidCheckouts: orders.filter((o) => o.status !== 'paid' && o.created_at >= since).length,
        posts, products: shop.products.map((p) => ({ name: p.name, status: p.status, price: p.price })) });
    }
    if (action === 'note') {
      if (!keyOk(req)) return res.status(401).json({ ok: false, error: 'bad key' });
      const body = await readBody(req);
      if (!String(body.text || '').trim()) return res.status(400).json({ ok: false, error: 'no text' });
      const row = { status: 'note', source: String(body.source || 'manager').slice(0, 20), kind: String(body.kind || 'report').slice(0, 20), text: String(body.text).slice(0, 8000), week: body.week ? String(body.week).slice(0, 12) : null };
      const inserted = await sb('posts', { method: 'POST', body: [row], prefer: 'return=representation' });
      return res.status(200).json({ ok: true, id: inserted[0]?.id });
    }
    if (action === 'publish') {
      const admin = req.headers.authorization ? await verifyAdmin(req.headers.authorization) : null;
      if (!admin && !cronOk(req) && !keyOk(req)) return res.status(401).json({ ok: false, error: 'ต้องล็อกอินแอดมิน' });
      if (!fbConfigured()) return res.status(200).json({ ok: false, skipped: true, error: 'ยังไม่ได้ตั้งค่า FB_PAGE_ID / FB_PAGE_TOKEN บน Vercel' });
      const id = String(req.query.id || '');
      const due = id
        ? await sb(`posts?id=eq.${encodeURIComponent(id)}&status=in.(approved,draft,failed)&select=*`)
        : await sb(`posts?status=eq.approved&scheduled_at=lte.${new Date().toISOString()}&select=*&order=scheduled_at.asc&limit=5`);
      const results = [];
      for (const p of due) {
        // จองสิทธิ์ก่อนโพสต์ กันโพสต์ซ้ำเมื่อ cron กับแอดมินชนกัน
        const claimed = await sbPatch(`posts?id=eq.${p.id}&status=neq.publishing&status=neq.published`, { status: 'publishing' });
        if (!claimed.length) continue;
        try {
          const fbId = await publishOne(p);
          await sbPatch(`posts?id=eq.${p.id}`, { status: 'published', published_at: new Date().toISOString(), fb_post_id: String(fbId), error: null });
          results.push({ id: p.id, ok: true, fb_post_id: fbId });
        } catch (e) {
          await sbPatch(`posts?id=eq.${p.id}`, { status: 'failed', error: String(e.message || e).slice(0, 500) });
          results.push({ id: p.id, ok: false, error: String(e.message || e) });
        }
      }
      return res.status(200).json({ ok: true, published: results.filter((r) => r.ok).length, results });
    }
    res.status(400).json({ ok: false, error: 'unknown action' });
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok: false, error: String(e.message || e) });
  }
}
