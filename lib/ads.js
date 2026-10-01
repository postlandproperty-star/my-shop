// แอดสินค้าใหม่อัตโนมัติ (Marketing API): ระบบร่างแอดให้ → คุณแดนกด "ตกลง" ในหลังบ้าน → สร้างแคมเปญยอดขายแล้วเริ่มวิ่ง
// เงินออกเฉพาะตอนคุณแดนกดตกลงเท่านั้น (action ads_auto_launch รับเฉพาะแอดมิน ไม่รับ content key ของทีม)
// ต้องมีโทเค็นผู้ใช้ (fb.userToken) ที่มีสิทธิ์ ads_management บนบัญชีโฆษณา FB_AD_ACCOUNT
import { fbGet, FB_API } from './fb.js';

export const AD_ACCOUNT = process.env.FB_AD_ACCOUNT || 'act_1273219618240288';

async function fbPost(path, params, token) {
  const body = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null) body.set(k, typeof v === 'object' ? JSON.stringify(v) : String(v));
  body.set('access_token', token);
  const r = await fetch(`${FB_API}/${path}`, { method: 'POST', body });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || j.error) throw new Error(j.error?.error_user_msg || j.error?.error_user_title || j.error?.message || `facebook ${r.status}`);
  return j;
}

// สิทธิ์ + ข้อมูลบัญชีโฆษณา (ไว้โชว์ในหลังบ้านว่าพร้อมยิงแอดไหม)
export async function adsAccess(fb) {
  if (!fb || !fb.userToken) return { ok: false, reason: 'token', error: 'ยังไม่มีโทเค็นผู้ใช้ (เชื่อมเพจใหม่ในแท็บคอนเทนต์)' };
  let perms = {};
  try { const p = await fbGet('me/permissions', { access_token: fb.userToken }); for (const x of p.data || []) perms[x.permission] = x.status === 'granted'; }
  catch (e) { return { ok: false, reason: 'token', error: String(e.message || e) }; }
  if (!perms.ads_management) return { ok: false, reason: 'perm', error: 'โทเค็นยังไม่มีสิทธิ์ ads_management', perms };
  try {
    const a = await fbGet(AD_ACCOUNT, { access_token: fb.userToken, fields: 'name,currency,account_status,disable_reason,funding_source_details' });
    const active = a.account_status === 1;
    return { ok: active, reason: active ? '' : 'account', error: active ? '' : `บัญชีโฆษณาใช้งานไม่ได้ (สถานะ ${a.account_status})`, account: { id: AD_ACCOUNT, name: a.name, currency: a.currency, payment: a.funding_source_details?.display_string || '' }, perms };
  } catch (e) { return { ok: false, reason: 'account', error: String(e.message || e), perms }; }
}

// บาท → สกุลเงินบัญชีโฆษณา (บัญชีนี้เป็น AUD) ดึงเรทจริง ถ้าไม่ได้ใช้ค่าประมาณ
const FALLBACK = { AUD: 1 / 23, USD: 1 / 36, EUR: 1 / 39, SGD: 1 / 27, THB: 1 };
export async function thbRate(currency) {
  if (currency === 'THB') return 1;
  try { const r = await fetch('https://open.er-api.com/v6/latest/THB'); const j = await r.json(); if (j?.rates?.[currency]) return Number(j.rates[currency]); } catch {}
  return FALLBACK[currency] || 1 / 30;
}

// สร้างแคมเปญ → ชุดโฆษณา → ครีเอทีฟ → แอด (สร้างแบบหยุดไว้ก่อน ครบทุกชิ้นแล้วค่อยเปิด ถ้าพังกลางทางลบทิ้ง ไม่ให้เหลือแคมเปญค้าง)
export async function launchAd(fb, d, { pixelId = '', currency = 'THB' } = {}) {
  const t = fb.userToken;
  const rate = await thbRate(currency);
  const dailyMinor = Math.max(100, Math.round(Number(d.dailyTHB) * rate * 100)); // หน่วยย่อยของสกุลเงินบัญชี (เซนต์/สตางค์)
  const start = new Date(Date.now() + 5 * 60e3), end = new Date(start.getTime() + Number(d.days) * 864e5);
  const sales = /^\d{6,20}$/.test(String(pixelId));
  const made = {}; let note = '';
  // ช่องทาง: ว่าง = ให้ Facebook เลือกเอง (Advantage+ placements) · Threads ต้องมี Instagram ด้วย (ข้อกำหนดของ Meta)
  let plats = (d.platforms || []).filter((x) => ['facebook', 'instagram', 'threads'].includes(x));
  if (plats.includes('threads') && !plats.includes('instagram')) plats.push('instagram');
  try {
    made.campaign = (await fbPost(`${AD_ACCOUNT}/campaigns`, { name: d.campaign, objective: sales ? 'OUTCOME_SALES' : 'OUTCOME_TRAFFIC', status: 'PAUSED', special_ad_categories: [], buying_type: 'AUCTION', daily_budget: dailyMinor, bid_strategy: 'LOWEST_COST_WITHOUT_CAP' }, t)).id;
    const adset = (pl) => fbPost(`${AD_ACCOUNT}/adsets`, {
      name: `${d.campaign} · ไทย`, campaign_id: made.campaign, status: 'PAUSED', billing_event: 'IMPRESSIONS',
      optimization_goal: sales ? 'OFFSITE_CONVERSIONS' : 'LINK_CLICKS', ...(sales ? { promoted_object: { pixel_id: String(pixelId), custom_event_type: 'PURCHASE' } } : {}),
      targeting: { geo_locations: { countries: ['TH'] }, age_min: 18, age_max: 65, targeting_automation: { advantage_audience: 1 }, ...(pl.length ? { publisher_platforms: pl } : {}) },
      start_time: start.toISOString(), end_time: end.toISOString(),
    }, t);
    try { made.adset = (await adset(plats)).id; }
    catch (e) { // Threads ยังเปิดผ่าน API ไม่ได้ในบางบัญชี → ยิงช่องที่เหลือแทน แล้วแจ้งคุณแดน
      if (!plats.includes('threads')) throw e;
      plats = plats.filter((x) => x !== 'threads'); made.adset = (await adset(plats)).id; note = `Threads ยังลงแอดผ่านระบบไม่ได้ (${String(e.message || e).slice(0, 120)}) จึงยิง ${plats.join(' + ')} แทน`;
    }
    const story = (ig) => ({ page_id: fb.pageId, ...(ig ? { instagram_user_id: fb.igUserId } : {}), link_data: { link: d.link, message: d.text, name: d.headline, description: d.description, picture: d.image, call_to_action: { type: 'SHOP_NOW', value: { link: d.link } } } });
    try { made.creative = (await fbPost(`${AD_ACCOUNT}/adcreatives`, { name: d.campaign, object_story_spec: story(!!fb.igUserId) }, t)).id; }
    catch (e) { if (!fb.igUserId) throw e; made.creative = (await fbPost(`${AD_ACCOUNT}/adcreatives`, { name: d.campaign, object_story_spec: story(false) }, t)).id; }
    made.ad = (await fbPost(`${AD_ACCOUNT}/ads`, { name: d.campaign, adset_id: made.adset, creative: { creative_id: made.creative }, status: 'ACTIVE' }, t)).id;
    await fbPost(made.adset, { status: 'ACTIVE' }, t);
    await fbPost(made.campaign, { status: 'ACTIVE' }, t);
    return { ...made, dailyMinor, currency, rate, start: start.toISOString(), end: end.toISOString(), objective: sales ? 'sales' : 'traffic', platforms: plats, note };
  } catch (e) {
    if (made.campaign) await fbPost(made.campaign, { status: 'DELETED' }, t).catch(() => {});
    throw e;
  }
}

export async function setCampaignStatus(fb, campaignId, status) { return fbPost(campaignId, { status }, fb.userToken); }

// ผลแอดของแคมเปญ (ยอดใช้ คลิก ซื้อ) ไว้โชว์บนการ์ด
export async function campaignStats(fb, campaignId) {
  const j = await fbGet(campaignId, { access_token: fb.userToken, fields: 'effective_status,insights.date_preset(maximum){spend,impressions,clicks,actions}' });
  const i = j.insights?.data?.[0] || {};
  const buy = (i.actions || []).find((a) => /purchase/.test(a.action_type));
  return { status: j.effective_status, spend: Number(i.spend || 0), impressions: Number(i.impressions || 0), clicks: Number(i.clicks || 0), purchases: Number(buy?.value || 0) };
}
