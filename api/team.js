// ข้อมูล (อ่านอย่างเดียว) สำหรับแผนกอื่นๆ ของทีมเพจ — รูทีนอัตโนมัติเรียกด้วย header x-content-key
// ทุกแผนก "ร่าง" ให้เจ้าของกดส่งเอง ไม่มี action ที่ส่งข้อความหาลูกค้าหรือโพสต์ตอบใครโดยอัตโนมัติ
//   ?action=comments   (GET, ?days=3)  โพสต์ที่ขึ้นเพจล่าสุด + คอมเมนต์ + เฉลยควิซจาก notes   → ทีมดูแลคอมเมนต์ (ร่างคำตอบ)
//   ?action=ads        (GET, ?days=7)  ผลแอดจาก Marketing API (ต้องมี ads_read)               → นักวิเคราะห์แอด
//   ?action=followups  (GET)           ลูกค้าที่จ่ายแล้ว ≥3 วัน ยังไม่ได้อีเมลติดตามผล            → ฝ่ายดูแลลูกค้า (ร่างอีเมล)
//   ?action=sync-adspend (GET) ดึงค่าแอดสะสมจริงจาก Facebook แปลงเป็นบาท บันทึกลง campaigns ของร้าน   → นักวิเคราะห์แอดทำทุกเช้า
//   ?action=finance    (GET, ?days=7)  ยอดเงินเข้า ค่าธรรมเนียม เงินโอนออกจาก Stripe + ค่าแอด     → ฝ่ายบัญชี
import { loadShop, stripe, configured, SB_URL } from '../lib/shop.js';
import { loadFb, fbGet } from '../lib/fb.js';

const SECRET = process.env.SUPABASE_SECRET_KEY || '';
const CONTENT_KEY = process.env.CONTENT_API_KEY || '';
const AD_ACCOUNT = process.env.FB_AD_ACCOUNT || 'act_1273219618240288';
const keyOk = (req) => CONTENT_KEY.length >= 16 && req.headers['x-content-key'] === CONTENT_KEY;
const isTestOrder = (o) => Number(o.amount) < 30 || /ทดสอบ|แคลคูลัส/.test(o.product_name || '');

async function sb(path, { method = 'GET', body, prefer } = {}) {
  const headers = { apikey: SECRET, Authorization: `Bearer ${SECRET}`, 'Content-Type': 'application/json' };
  if (prefer) headers.Prefer = prefer;
  const r = await fetch(`${SB_URL}/rest/v1/${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
  const text = await r.text();
  if (!r.ok) throw new Error(`supabase ${path}: ${r.status} ${text.slice(0, 200)}`);
  return text ? JSON.parse(text) : null;
}
const days = (req, def) => Math.min(60, Math.max(1, Number(req.query.days) || def));

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (!keyOk(req)) return res.status(401).json({ ok: false, error: 'bad key' });
  const action = String(req.query.action || '');
  try {
    if (action === 'comments') {
      const fb = await loadFb();
      if (!fb) return res.status(200).json({ ok: false, error: 'ยังไม่ได้เชื่อมเพจ Facebook' });
      const since = new Date(Date.now() - days(req, 3) * 864e5).toISOString();
      const posts = await sb(`posts?status=eq.published&fb_post_id=not.is.null&published_at=gte.${since}&select=id,kind,text,notes,fb_post_id,published_at&order=published_at.desc&limit=20`);
      const out = [];
      for (const p of posts) {
        try {
          const c = await fbGet(`${p.fb_post_id}/comments`, { access_token: fb.token, fields: 'id,message,from{id,name},created_time,comment_count,like_count', filter: 'toplevel', order: 'chronological', limit: 100 });
          const byPage = (x) => String(x.from?.id || '') === String(fb.pageId);
          const items = [];
          for (const cm of c.data || []) {
            let replies = [];
            if (cm.comment_count > 0) {
              try { const r = await fbGet(`${cm.id}/comments`, { access_token: fb.token, fields: 'id,message,from{id,name},created_time', limit: 20 }); replies = r.data || []; } catch {}
            }
            items.push({ id: cm.id, message: cm.message, from: cm.from?.name || '', fromPage: byPage(cm), created_time: cm.created_time, pageReplied: replies.some(byPage), replies: replies.map((r) => ({ from: r.from?.name || '', fromPage: byPage(r), message: r.message })) });
          }
          out.push({ post: p, permalink: `https://www.facebook.com/${p.fb_post_id}`, comments: items });
        } catch (e) { out.push({ post: p, error: String(e.message || e) }); }
      }
      return res.status(200).json({ ok: true, pageId: fb.pageId, pageName: fb.pageName, posts: out });
    }
    if (action === 'ads') {
      const fb = await loadFb();
      if (!fb?.userToken) return res.status(200).json({ ok: false, error: 'ต้องเชื่อมเพจใหม่พร้อมสิทธิ์ ads_read (โทเค็นผู้ใช้)' });
      const n = days(req, 7);
      const range = JSON.stringify({ since: new Date(Date.now() - n * 864e5).toISOString().slice(0, 10), until: new Date().toISOString().slice(0, 10) });
      const fields = 'campaign_name,adset_name,ad_name,spend,impressions,reach,clicks,ctr,cpc,actions,cost_per_action_type,purchase_roas';
      const ins = await fbGet(`${AD_ACCOUNT}/insights`, { access_token: fb.userToken, level: 'ad', fields, time_range: range, limit: 50 });
      const daily = await fbGet(`${AD_ACCOUNT}/insights`, { access_token: fb.userToken, level: 'account', fields: 'spend,impressions,clicks,actions', time_range: range, time_increment: 1, limit: 60 });
      const acct = await fbGet(AD_ACCOUNT, { access_token: fb.userToken, fields: 'name,currency,account_status,balance,amount_spent' });
      const campaigns = await fbGet(`${AD_ACCOUNT}/campaigns`, { access_token: fb.userToken, fields: 'id,name,status,effective_status,daily_budget,lifetime_budget,objective', limit: 50 });
      const adsets = await fbGet(`${AD_ACCOUNT}/adsets`, { access_token: fb.userToken, fields: 'id,name,status,effective_status,daily_budget,campaign_id,end_time', limit: 50 });
      const since = new Date(Date.now() - n * 864e5).toISOString();
      const orders = await sb(`orders?status=eq.paid&paid_at=gte.${since}&select=paid_at,amount,campaign,product_name`);
      return res.status(200).json({ ok: true, account: acct, campaigns: campaigns.data || [], adsets: adsets.data || [], insights: ins.data || [], daily: daily.data || [], shopOrders: orders.filter((o) => !isTestOrder(o)) });
    }
    if (action === 'sync-adspend') {
      const fb = await loadFb();
      if (!fb?.userToken) return res.status(200).json({ ok: false, error: 'ต้องเชื่อมเพจใหม่พร้อมสิทธิ์ ads_read' });
      // อัตราแลกเปลี่ยน AUD→THB (ถ้าดึงไม่ได้ใช้ค่าประมาณ 23)
      let rate = 23, rateSource = 'ค่าประมาณ';
      try { const r = await fetch('https://open.er-api.com/v6/latest/AUD'); const j = await r.json(); if (j?.rates?.THB) { rate = Number(j.rates.THB); rateSource = 'open.er-api.com'; } } catch {}
      const camps = await fbGet(`${AD_ACCOUNT}/campaigns`, { access_token: fb.userToken, fields: 'id,name,effective_status,insights.date_preset(maximum){spend}', limit: 50 });
      const fbList = (camps.data || []).map((c) => ({ id: c.id, name: c.name, status: c.effective_status, spendAUD: Number(c.insights?.data?.[0]?.spend || 0) }));
      const norm = (x) => String(x || '').toLowerCase().replace(/^fb[-_ ]?/, '').replace(/[^a-z0-9ก-๙]/g, '');
      const rows = await sb('shop_state?id=eq.private&select=data');
      const data = rows?.[0]?.data || {};
      const shopCamps = Array.isArray(data.campaigns) ? data.campaigns : [];
      const mapping = [];
      for (const sc of shopCamps) {
        let m = fbList.find((f) => norm(f.name) && (norm(f.name) === norm(sc.name) || norm(sc.name).includes(norm(f.name)) || norm(f.name).includes(norm(sc.name))));
        if (!m && shopCamps.length === 1 && fbList.length === 1) m = fbList[0];
        if (m) { sc.spend = Math.round(m.spendAUD * rate); sc.spendAUD = m.spendAUD; sc.spendSyncedAt = new Date().toISOString(); sc.fbCampaign = m.name; mapping.push({ shop: sc.name, facebook: m.name, spendAUD: m.spendAUD, spendTHB: sc.spend }); }
        else mapping.push({ shop: sc.name, facebook: null });
      }
      if (mapping.some((x) => x.facebook)) {
        data.campaigns = shopCamps;
        await sb('shop_state?id=eq.private', { method: 'PATCH', body: { data, updated_at: new Date().toISOString() }, prefer: 'return=minimal' });
      }
      return res.status(200).json({ ok: true, rate, rateSource, facebookCampaigns: fbList, mapping, unmatchedFacebook: fbList.filter((f) => !mapping.some((x) => x.facebook === f.name)).map((f) => f.name) });
    }
    if (action === 'followups') {
      const cutoff = new Date(Date.now() - 3 * 864e5).toISOString();
      const floor = new Date(Date.now() - 30 * 864e5).toISOString();
      const orders = await sb(`orders?status=eq.paid&paid_at=lte.${cutoff}&paid_at=gte.${floor}&email=not.is.null&select=session_id,email,customer_name,product_name,amount,paid_at,campaign&order=paid_at.desc&limit=100`);
      const shop = await loadShop();
      const list = orders.filter((o) => !isTestOrder(o)).map((o) => ({ ...o, email: o.email.replace(/^(.).*(@.*)$/, '$1***$2') }));
      return res.status(200).json({ ok: true, pending: list, products: shop.products.filter((p) => p.status === 'published').map((p) => ({ name: p.name, price: p.price, url: `https://my-shop-lake-ten.vercel.app/p/${p.slug}` })), shop: { name: shop.settings.shopName || 'SheetLab', chatLink: shop.settings.chatLink || '' } });
    }
    if (action === 'finance') {
      if (!configured().stripe) return res.status(200).json({ ok: false, error: 'ยังไม่ได้ตั้งค่า Stripe' });
      const n = days(req, 7);
      const gte = Math.floor((Date.now() - n * 864e5) / 1000), prevGte = Math.floor((Date.now() - 2 * n * 864e5) / 1000);
      const tx = await stripe('GET', `balance_transactions?limit=100&created[gte]=${prevGte}`);
      const isSale = (t) => t.type === 'charge' || t.type === 'payment';
      const sum = (list) => list.reduce((a, t) => ({ gross: a.gross + (isSale(t) ? t.amount : 0), fees: a.fees + t.fee, net: a.net + t.net, refunds: a.refunds + (t.type.startsWith('refund') ? -t.amount : 0), count: a.count + (isSale(t) ? 1 : 0) }), { gross: 0, fees: 0, net: 0, refunds: 0, count: 0 });
      const cur = tx.data.filter((t) => t.created >= gte && t.type !== 'payout'), prev = tx.data.filter((t) => t.created < gte && t.type !== 'payout');
      const payouts = await stripe('GET', 'payouts?limit=10');
      const bal = await stripe('GET', 'balance');
      const priv = await sb('shop_state?id=eq.private&select=data');
      const campaigns = priv?.[0]?.data?.campaigns || [];
      const toBaht = (x) => ({ gross: x.gross / 100, fees: x.fees / 100, net: x.net / 100, refunds: x.refunds / 100, count: x.count });
      return res.status(200).json({ ok: true, currency: 'thb', days: n, thisPeriod: toBaht(sum(cur)), prevPeriod: toBaht(sum(prev)),
        balance: { available: (bal.available || []).map((b) => ({ amount: b.amount / 100, currency: b.currency })), pending: (bal.pending || []).map((b) => ({ amount: b.amount / 100, currency: b.currency })) },
        payouts: (payouts.data || []).map((p) => ({ amount: p.amount / 100, currency: p.currency, status: p.status, arrival: new Date(p.arrival_date * 1000).toISOString().slice(0, 10) })),
        adSpendTHB: campaigns.map((c) => ({ name: c.name, spend: Number(c.spend) || 0 })) });
    }
    res.status(400).json({ ok: false, error: 'unknown action' });
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok: false, error: String(e.message || e) });
  }
}
