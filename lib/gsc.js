// รายงานคำค้นจาก Google Search Console: คนค้นคำไหนแล้วเห็น/คลิกเว็บเรา อันดับเท่าไหร่ · อ่านอย่างเดียว
// ต้องมี env GSC_SA = JSON ของ service account (คุณแดนสร้างเองใน Google Cloud แล้วเพิ่มอีเมลของมันเป็นผู้ใช้ใน Search Console)
import { createSign } from 'node:crypto';

function sa() { try { const j = JSON.parse(process.env.GSC_SA || ''); return j.client_email && j.private_key ? j : null; } catch (e) { return null; } }
export const gscConnected = () => !!sa();
export const gscEmail = () => sa()?.client_email || '';
const b64u = (x) => Buffer.from(typeof x === 'string' ? x : JSON.stringify(x)).toString('base64').replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');

async function token() {
  const k = sa(); if (!k) throw new Error('ยังไม่ได้เชื่อม Search Console');
  const now = Math.floor(Date.now() / 1000);
  const head = b64u({ alg: 'RS256', typ: 'JWT' }), body = b64u({ iss: k.client_email, scope: 'https://www.googleapis.com/auth/webmasters.readonly', aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600 });
  const sig = createSign('RSA-SHA256').update(`${head}.${body}`).sign(k.private_key).toString('base64').replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
  const r = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: `${head}.${body}.${sig}` }) });
  const j = await r.json(); if (!j.access_token) throw new Error('Google ไม่ให้สิทธิ์: ' + (j.error_description || j.error || r.status)); return j.access_token;
}
const day = (d) => new Date(Date.now() - d * 864e5).toISOString().slice(0, 10);

// ใช้ property ที่ service account เข้าถึงได้ (domain ก่อน แล้ว URL)
export async function gscReport({ days = 28 } = {}) {
  const tok = await token(), H = { Authorization: `Bearer ${tok}`, 'Content-Type': 'application/json' };
  const sites = (await (await fetch('https://www.googleapis.com/webmasters/v3/sites', { headers: H })).json()).siteEntry || [];
  const site = (sites.find((s) => s.siteUrl === 'sc-domain:sheetlabth.com') || sites.find((s) => /sheetlabth\.com/.test(s.siteUrl)) || {}).siteUrl;
  if (!site) throw new Error(`service account ยังไม่ได้รับสิทธิ์ใน Search Console (เพิ่ม ${gscEmail()} เป็นผู้ใช้)`);
  const q = async (dimensions, start, end, rowLimit = 50) => { const r = await fetch(`https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(site)}/searchAnalytics/query`, { method: 'POST', headers: H, body: JSON.stringify({ startDate: start, endDate: end, dimensions, rowLimit }) }); const j = await r.json(); if (j.error) throw new Error(j.error.message); return j.rows || []; };
  const end = day(2), start = day(days + 1), pStart = day(days * 2 + 1), pEnd = day(days + 2); // ข้อมูล Google ช้า ~2 วัน
  const [tot, prev, queries, pages] = await Promise.all([q([], start, end), q([], pStart, pEnd), q(['query'], start, end, 100), q(['page'], start, end, 30)]);
  const sum = (r) => ({ clicks: Math.round(r?.[0]?.clicks || 0), impressions: Math.round(r?.[0]?.impressions || 0), ctr: r?.[0]?.ctr || 0, position: Math.round((r?.[0]?.position || 0) * 10) / 10 });
  const row = (r) => ({ key: r.keys[0], clicks: r.clicks, impressions: r.impressions, ctr: Math.round(r.ctr * 1000) / 10, position: Math.round(r.position * 10) / 10 });
  const qs = queries.map(row);
  // โอกาส: คนเห็นเยอะแต่ยังอยู่อันดับ 5-20 → เขียนเพิ่ม/ปรับหน้าให้ขึ้นหน้าแรก
  const opportunities = qs.filter((x) => x.position >= 5 && x.position <= 20 && x.impressions >= 10).sort((a, b) => b.impressions - a.impressions).slice(0, 15);
  return { ok: true, site, start, end, total: sum(tot), prev: sum(prev), queries: qs.slice(0, 40), pages: pages.map(row).map((p) => ({ ...p, key: p.key.replace(/^https?:\/\/[^/]+/, '') || '/' })), opportunities, at: new Date().toISOString() };
}
