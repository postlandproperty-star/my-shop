// Threads: ตั้งค่า/เชื่อมบัญชีจากหลังบ้าน และข้อมูลให้ทีม
//   ?action=status               (แอดมิน) สถานะ
//   ?action=setup    POST {appId, appSecret} (แอดมิน) บันทึก Threads App
//   ?action=authurl              (แอดมิน) ลิงก์ไปหน้าอนุญาตของ threads.net
//   ?action=test                 (แอดมิน) ลองอ่านโปรไฟล์
//   ?action=disconnect POST      (แอดมิน) ลบโทเค็น (เก็บ App ID/Secret ไว้)
//   ?action=insights&days=14     (key/แอดมิน) ยอดต่อโพสต์ Threads + ผู้ติดตาม สำหรับน้องบูสต์/พี่ต้น
//   ?action=replies&days=7       (key/แอดมิน) รีพลายใต้โพสต์ Threads สำหรับน้องคอม
import { verifyAdmin } from '../lib/shop.js';
import { loadThreads, saveThreads, thGet, threadsConnected, refreshIfNeeded, TH_REDIRECT, TH_SCOPES } from '../lib/threads.js';

const SB_URL = 'https://lpeqaorswhwzlplsaqpe.supabase.co';
const SECRET = process.env.SUPABASE_SECRET_KEY || '';
const CONTENT_KEY = process.env.CONTENT_API_KEY || '';
const keyOk = (req) => CONTENT_KEY.length >= 16 && req.headers['x-content-key'] === CONTENT_KEY;
async function sb(path) {
  const r = await fetch(`${SB_URL}/rest/v1/${path}`, { headers: { apikey: SECRET, Authorization: `Bearer ${SECRET}` } });
  if (!r.ok) throw new Error(`supabase ${path}: ${r.status}`);
  return r.json();
}
async function readBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  return new Promise((resolve) => { let d = ''; req.on('data', (c) => (d += c)); req.on('end', () => { try { resolve(JSON.parse(d || '{}')); } catch { resolve({}); } }); });
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  const action = String(req.query.action || 'status');
  const admin = req.headers.authorization ? await verifyAdmin(req.headers.authorization) : null;
  const teamOk = admin || keyOk(req);
  try {
    if (['insights', 'replies'].includes(action)) {
      if (!teamOk) return res.status(401).json({ ok: false, error: 'bad key' });
      let th = await loadThreads();
      if (!threadsConnected(th)) return res.status(200).json({ ok: false, error: 'ยังไม่ได้เชื่อม Threads' });
      th = await refreshIfNeeded(th);
      const days = Math.min(60, Math.max(1, Number(req.query.days || (action === 'replies' ? 7 : 14))));
      const since = new Date(Date.now() - days * 864e5).toISOString();
      const posts = await sb(`posts?status=eq.published&channel=eq.threads&th_post_id=not.is.null&published_at=gte.${since}&select=id,kind,text,notes,th_post_id,published_at&order=published_at.desc&limit=40`);
      if (action === 'insights') {
        const out = [];
        for (const p of posts) {
          const m = { id: p.id, kind: p.kind, published_at: p.published_at, text: String(p.text || '').slice(0, 120), th_post_id: p.th_post_id, experiment: (String(p.notes || '').match(/ทดลอง:\s*([^\n|]+)/) || [])[1]?.trim() || null };
          try {
            const ins = await thGet(`${p.th_post_id}/insights`, { metric: 'views,likes,replies,reposts,quotes,shares', access_token: th.token });
            for (const d of ins.data || []) m[d.name] = d.values?.[0]?.value ?? d.total_value?.value ?? null;
          } catch (e) { m.error = e.message; }
          try { const info = await thGet(p.th_post_id, { fields: 'permalink', access_token: th.token }); m.permalink = info.permalink; } catch {}
          m.engagement = (m.likes || 0) + (m.replies || 0) + (m.reposts || 0) + (m.quotes || 0);
          out.push(m);
        }
        let followers = null;
        try { const u = await thGet(`${th.userId}/threads_insights`, { metric: 'followers_count', access_token: th.token }); followers = u.data?.[0]?.total_value?.value ?? u.data?.[0]?.values?.[0]?.value ?? null; } catch {}
        const avg = (arr, k) => arr.length ? Math.round(arr.reduce((s, x) => s + (x[k] || 0), 0) / arr.length) : 0;
        const ex = out.filter((x) => x.experiment), nm = out.filter((x) => !x.experiment);
        return res.status(200).json({ ok: true, username: th.username, followers, days, posts: out, summary: { experiments: { count: ex.length, avgEngagement: avg(ex, 'engagement'), avgViews: avg(ex, 'views') }, normal: { count: nm.length, avgEngagement: avg(nm, 'engagement'), avgViews: avg(nm, 'views') } } });
      }
      const out = [];
      for (const p of posts) {
        try {
          const r = await thGet(`${p.th_post_id}/replies`, { fields: 'id,text,username,timestamp,has_replies', reverse: 'false', access_token: th.token });
          for (const c of r.data || []) out.push({ post_id: p.id, kind: p.kind, post_text: String(p.text || '').slice(0, 80), reply_id: c.id, username: c.username, text: c.text, timestamp: c.timestamp });
        } catch (e) { out.push({ post_id: p.id, error: e.message }); }
      }
      return res.status(200).json({ ok: true, username: th.username, days, replies: out });
    }
    if (!admin) return res.status(401).json({ ok: false, error: 'ต้องล็อกอินแอดมิน' });
    if (action === 'status') {
      const th = await loadThreads();
      return res.status(200).json({ ok: true, app: !!(th.appId && th.appSecret), connected: threadsConnected(th), user: threadsConnected(th) ? { id: th.userId, username: th.username, picture: th.picture || '', connectedAt: th.connectedAt, expiresAt: th.expiresAt } : null, redirect: TH_REDIRECT });
    }
    if (action === 'setup') {
      if (req.method !== 'POST') return res.status(405).json({ ok: false });
      const body = await readBody(req);
      const appId = String(body.appId || '').trim(), appSecret = String(body.appSecret || '').trim();
      if (!/^\d{5,}$/.test(appId) || appSecret.length < 16) return res.status(400).json({ ok: false, error: 'ใส่ Threads App ID (ตัวเลข) และ App Secret ให้ครบ' });
      const th = await loadThreads();
      await saveThreads({ ...th, appId, appSecret });
      return res.status(200).json({ ok: true });
    }
    if (action === 'authurl') {
      const th = await loadThreads();
      if (!th.appId || !th.appSecret) return res.status(400).json({ ok: false, error: 'ใส่ Threads App ID / Secret ก่อน' });
      const { randomBytes } = await import('node:crypto');
      const state = randomBytes(12).toString('hex');
      await saveThreads({ ...th, state });
      const url = `https://threads.net/oauth/authorize?${new URLSearchParams({ client_id: th.appId, redirect_uri: TH_REDIRECT, scope: TH_SCOPES, response_type: 'code', state }).toString()}`;
      return res.status(200).json({ ok: true, url, redirect: TH_REDIRECT });
    }
    if (action === 'test') {
      const th = await loadThreads();
      if (!threadsConnected(th)) return res.status(200).json({ ok: false, error: 'ยังไม่ได้เชื่อม Threads' });
      const me = await thGet('me', { fields: 'id,username,threads_profile_picture_url', access_token: th.token });
      return res.status(200).json({ ok: true, user: { id: me.id, username: me.username } });
    }
    if (action === 'disconnect') {
      if (req.method !== 'POST') return res.status(405).json({ ok: false });
      const th = await loadThreads();
      await saveThreads({ appId: th.appId || '', appSecret: th.appSecret || '' });
      return res.status(200).json({ ok: true });
    }
    res.status(400).json({ ok: false, error: 'unknown action' });
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok: false, error: String(e.message || e) });
  }
}
