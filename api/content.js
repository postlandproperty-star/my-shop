// ระบบคอนเทนต์ของเพจ: คิวโพสต์ในตาราง posts
//   ?action=shop     (key)   ข้อมูลร้าน + โพสต์ล่าสุด สำหรับ "นักเขียน" ใช้ร่างโพสต์
//   ?action=drafts   (key, POST) นักเขียนส่งร่างเข้า [{text,image_url,link_url,scheduled_at,kind}] → status draft
//   ?action=report   (key)   ตัวเลขสัปดาห์ (ยอดขาย/ออเดอร์/แคมเปญ) สำหรับ "ผู้จัดการ"
//   ?action=note     (key, POST) ผู้จัดการ/นักวิเคราะห์ส่งรายงาน {text,kind:'report'|'ads'}
//   ?action=images   (key)   โพสต์ที่ยังไม่ขึ้นเพจพร้อมรูป สำหรับ "นักออกแบบ" ตรวจรูป
//   ?action=setimage (key, POST {id, image_url, note}) เปลี่ยนรูปโพสต์ (เก็บสำเนาถาวร) + บันทึกหมายเหตุ
//   ?action=review   (key)   ร่างที่รอตรวจ (เต็ม) สำหรับ "ผู้จัดการ"
//   ?action=decide   (key, POST) ผู้จัดการตัดสิน {id, decision:'approve'|'reject'|'owner', reason, text?}
//                    owner = เรื่องสำคัญ ส่งให้เจ้าของกดอนุมัติเอง (status needs_owner)
//   ?action=publish  (cron หรือแอดมิน) โพสต์ที่อนุมัติแล้วและถึงเวลา → ขึ้นเพจ Facebook
//   ?action=publish&id=<uuid> (แอดมิน) โพสต์รายการเดียวทันที
// key = header x-content-key ตรงกับ CONTENT_API_KEY บน Vercel (ใช้เฉพาะรูทีนอัตโนมัติ)
import { loadShop, verifyAdmin, sbPatch } from '../lib/shop.js';
import { loadFb, publishToPage } from '../lib/fb.js';

const SB_URL = 'https://lpeqaorswhwzlplsaqpe.supabase.co';
const SECRET = process.env.SUPABASE_SECRET_KEY || '';
const CONTENT_KEY = process.env.CONTENT_API_KEY || '';

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

// รูปจากภายนอก (เช่นลิงก์ export ของ Canva ที่หมดอายุใน 1 ชม.) → ก๊อปเก็บใน Supabase Storage ให้ถาวร
async function cacheImage(url) {
  try {
    if (!url || url.startsWith(`${SB_URL}/storage/`)) return url || null;
    const r = await fetch(url, { redirect: 'follow' });
    const type = r.headers.get('content-type') || '';
    if (!r.ok || !/^image\/(png|jpe?g|webp)/.test(type)) return url;
    const buf = Buffer.from(await r.arrayBuffer());
    if (buf.length > 8 * 1024 * 1024) return url;
    const ext = type.includes('png') ? 'png' : type.includes('webp') ? 'webp' : 'jpg';
    const name = `posts/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const up = await fetch(`${SB_URL}/storage/v1/object/product-images/${name}`, {
      method: 'POST', headers: { apikey: SECRET, Authorization: `Bearer ${SECRET}`, 'Content-Type': type.split(';')[0], 'cache-control': '31536000' }, body: buf,
    });
    return up.ok ? `${SB_URL}/storage/v1/object/public/product-images/${name}` : url;
  } catch { return url; }
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
      const trend = await sb('posts?status=eq.note&kind=eq.trend&select=text,created_at&order=created_at.desc&limit=1');
      return res.status(200).json({ ok: true, shop: { name: shop.settings.shopName || 'SheetLab', chatLink: shop.settings.chatLink || '', products }, recentPosts: recent, trendBrief: trend?.[0] || null });
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
      for (const r of rows) r.image_url = await cacheImage(r.image_url);
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
    if (action === 'images') {
      if (!keyOk(req)) return res.status(401).json({ ok: false, error: 'bad key' });
      const rows = await sb(`posts?status=in.(draft,approved,needs_owner)&image_url=not.is.null&select=id,status,kind,text,image_url,scheduled_at,notes&order=scheduled_at.asc.nullslast&limit=20`);
      return res.status(200).json({ ok: true, posts: rows });
    }
    if (action === 'setimage') {
      if (!keyOk(req)) return res.status(401).json({ ok: false, error: 'bad key' });
      const body = await readBody(req);
      const id = String(body.id || ''), url = String(body.image_url || '').trim();
      if (!/^[0-9a-f-]{36}$/.test(id) || !/^https?:\/\//.test(url)) return res.status(400).json({ ok: false, error: 'bad id/image_url' });
      const cur = await sb(`posts?id=eq.${id}&select=id,status,notes`);
      if (!cur.length || cur[0].status === 'published' || cur[0].status === 'publishing') return res.status(400).json({ ok: false, error: 'เปลี่ยนรูปไม่ได้ (โพสต์ขึ้นเพจแล้ว)' });
      const stored = await cacheImage(url);
      const stamp = `🎨 น้องกราฟิก: ${String(body.note || 'เปลี่ยนรูปใหม่').slice(0, 200)}`;
      const rows = await sbPatch(`posts?id=eq.${id}`, { image_url: stored, notes: [cur[0].notes, stamp].filter(Boolean).join('\n') });
      return res.status(200).json({ ok: true, id, image_url: rows[0]?.image_url });
    }
    if (action === 'review') {
      if (!keyOk(req)) return res.status(401).json({ ok: false, error: 'bad key' });
      const drafts = await sb('posts?status=eq.draft&select=*&order=scheduled_at.asc.nullslast');
      const shop = await loadShop();
      const fb = await loadFb();
      return res.status(200).json({ ok: true, fbConnected: !!fb, drafts, products: shop.products.filter((p) => p.status === 'published').map((p) => ({ id: p.id, slug: p.slug, name: p.name, price: p.price, fullPrice: p.fullPrice, url: `https://my-shop-lake-ten.vercel.app/p/${p.slug}` })) });
    }
    if (action === 'decide') {
      if (!keyOk(req)) return res.status(401).json({ ok: false, error: 'bad key' });
      const body = await readBody(req);
      const id = String(body.id || ''), decision = String(body.decision || '');
      const status = { approve: 'approved', reject: 'rejected', owner: 'needs_owner' }[decision];
      if (!/^[0-9a-f-]{36}$/.test(id) || !status) return res.status(400).json({ ok: false, error: 'bad id/decision' });
      const reason = String(body.reason || '').slice(0, 300);
      const cur = await sb(`posts?id=eq.${id}&select=id,status,notes,scheduled_at`);
      if (!cur.length) return res.status(404).json({ ok: false, error: 'not found' });
      if (cur[0].status !== 'draft') return res.status(200).json({ ok: false, error: `สถานะตอนนี้คือ ${cur[0].status} ไม่ใช่ draft` });
      if (status === 'approved' && !cur[0].scheduled_at && !body.scheduled_at) return res.status(400).json({ ok: false, error: 'โพสต์นี้ยังไม่มีเวลา ต้องส่ง scheduled_at มาด้วย' });
      const stamp = `${decision === 'approve' ? '✅' : decision === 'reject' ? '⛔' : '⚠️'} พี่แผน: ${reason || decision}`;
      const patch = { status, notes: [cur[0].notes, stamp].filter(Boolean).join('\n'), error: null };
      if (body.text && String(body.text).trim()) patch.text = String(body.text).slice(0, 4000);
      if (body.scheduled_at && !isNaN(Date.parse(body.scheduled_at))) patch.scheduled_at = new Date(body.scheduled_at).toISOString();
      const rows = await sbPatch(`posts?id=eq.${id}`, patch);
      return res.status(200).json({ ok: true, id, status: rows[0]?.status });
    }
    if (action === 'publish') {
      const admin = req.headers.authorization ? await verifyAdmin(req.headers.authorization) : null;
      if (!admin && !cronOk(req) && !keyOk(req)) return res.status(401).json({ ok: false, error: 'ต้องล็อกอินแอดมิน' });
      const fb = await loadFb();
      if (!fb) return res.status(200).json({ ok: false, skipped: true, error: 'ยังไม่ได้เชื่อมเพจ Facebook (แท็บคอนเทนต์ → เชื่อมเพจ)' });
      const id = String(req.query.id || '');
      const due = id
        ? await sb(`posts?id=eq.${encodeURIComponent(id)}&status=in.(approved,draft,failed,needs_owner)&select=*`)
        : await sb(`posts?status=eq.approved&scheduled_at=lte.${new Date().toISOString()}&select=*&order=scheduled_at.asc&limit=5`);
      const results = [];
      for (const p of due) {
        // จองสิทธิ์ก่อนโพสต์ กันโพสต์ซ้ำเมื่อ cron กับแอดมินชนกัน
        const claimed = await sbPatch(`posts?id=eq.${p.id}&status=neq.publishing&status=neq.published`, { status: 'publishing' });
        if (!claimed.length) continue;
        try {
          const fbId = await publishToPage(fb, p);
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
