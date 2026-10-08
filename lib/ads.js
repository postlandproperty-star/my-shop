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
    const a = await fbGet(AD_ACCOUNT, { access_token: fb.userToken, fields: 'name,currency,account_status,disable_reason,funding_source_details,spend_cap,amount_spent,balance' });
    // วงเงินใช้จ่ายสูงสุดของบัญชี (Account spending limit) Facebook ส่งเป็นหน่วยย่อย (เซนต์) · 0 = ไม่ได้ตั้ง
    const rate = await thbRate(a.currency);
    const limit = { cap: Number(a.spend_cap || 0) / 100, spent: Number(a.amount_spent || 0) / 100, currency: a.currency, rate, page: `https://business.facebook.com/billing_hub/payment_settings/?asset_id=${AD_ACCOUNT.replace('act_', '')}` };
    limit.capTHB = limit.cap ? Math.round(limit.cap / rate) : 0; limit.spentTHB = Math.round(limit.spent / rate); limit.leftTHB = limit.cap ? Math.max(0, Math.round((limit.cap - limit.spent) / rate)) : null;
    const active = a.account_status === 1 || a.account_status === 9; // 9 = ช่วงผ่อนผัน ยังยิงได้
    const ST = { 2: 'บัญชีโฆษณาถูกปิดใช้งาน (Disabled) ต้องยื่นขอทบทวนกับ Facebook', 3: 'มียอดค่าโฆษณาค้างชำระ (Unsettled) จ่ายยอดค้างในหน้าการชำระเงินก่อน แอดทุกตัวจะหยุดจนกว่าจะจ่าย', 7: 'บัญชีอยู่ระหว่าง Facebook ตรวจสอบความเสี่ยง รอผลตรวจ', 8: 'รอการชำระเงิน (Pending settlement) จ่ายยอดค้างก่อน', 100: 'บัญชีกำลังถูกปิด', 101: 'บัญชีถูกปิดแล้ว' };
    return { ok: active, reason: active ? '' : 'account', error: active ? '' : `${ST[a.account_status] || 'บัญชีโฆษณาใช้งานไม่ได้'} (สถานะ ${a.account_status})`, billing: `https://business.facebook.com/billing_hub/accounts/details?asset_id=${AD_ACCOUNT.replace('act_', '')}`, account: { id: AD_ACCOUNT, name: a.name, currency: a.currency, payment: a.funding_source_details?.display_string || '' }, limit, perms };
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
      targeting: { geo_locations: { countries: ['TH'] }, age_min: 20, age_max: 65, targeting_automation: { advantage_audience: 1 }, ...(pl.length ? { publisher_platforms: pl } : {}) }, // Meta: ในไทยถ้าเลือกช่องทาง/ตั้งค่าอื่นนอกจากประเทศและอายุ ต้องอายุ 20+ ไม่งั้นยิงไม่ผ่าน
      start_time: start.toISOString(), end_time: end.toISOString(),
    }, t);
    try { made.adset = (await adset(plats)).id; }
    catch (e) { // Threads ยังเปิดผ่าน API ไม่ได้ในบางบัญชี → ยิงช่องที่เหลือแทน แล้วแจ้งคุณแดน
      if (!plats.includes('threads')) throw e;
      plats = plats.filter((x) => x !== 'threads'); made.adset = (await adset(plats)).id; note = `Threads ยังลงแอดผ่านระบบไม่ได้ (${String(e.message || e).slice(0, 120)}) จึงยิง ${plats.join(' + ')} แทน`;
    }
    const story = (ig, img) => ({ page_id: fb.pageId, ...(ig ? { instagram_user_id: fb.igUserId } : {}), link_data: { link: d.link, message: d.text, name: d.headline, description: d.description, ...img, call_to_action: { type: 'SHOP_NOW', value: { link: d.link } } } });
    // หลายรูป (สูงสุด 4): อัปรูปขึ้นบัญชีโฆษณา (image_hash แสดงแนวตั้ง 4:5 ได้เต็ม) แล้วทำ 1 แอดต่อรูปในชุดโฆษณาเดียวกัน Facebook จะส่งงบให้รูปที่ได้ผลดีกว่าเอง
    const imgs = [...new Set([...(d.multi || []), d.image].filter(Boolean))].slice(0, 4);
    made.ads = []; made.creatives = [];
    for (const [k, url] of imgs.entries()) {
      let img = { picture: url };
      try { const r = await fetch(url); if (r.ok) { const b64 = Buffer.from(await r.arrayBuffer()).toString('base64'); const up = await fbPost(`${AD_ACCOUNT}/adimages`, { bytes: b64 }, t); const h = Object.values(up.images || {})[0]?.hash; if (h) img = { image_hash: h }; } } catch (e) {}
      const nm = `${d.campaign}${imgs.length > 1 ? ` · รูป ${k + 1}` : ''}`;
      let cr;
      try { cr = (await fbPost(`${AD_ACCOUNT}/adcreatives`, { name: nm, object_story_spec: story(!!fb.igUserId, img) }, t)).id; }
      catch (e) { if (!fb.igUserId) throw e; cr = (await fbPost(`${AD_ACCOUNT}/adcreatives`, { name: nm, object_story_spec: story(false, img) }, t)).id; }
      made.creatives.push(cr); made.ads.push((await fbPost(`${AD_ACCOUNT}/ads`, { name: nm, adset_id: made.adset, creative: { creative_id: cr }, status: 'ACTIVE' }, t)).id);
    }
    made.creative = made.creatives[0]; made.ad = made.ads[0];
    await fbPost(made.adset, { status: 'ACTIVE' }, t);
    await fbPost(made.campaign, { status: 'ACTIVE' }, t);
    return { ...made, images: imgs, dailyMinor, currency, rate, start: start.toISOString(), end: end.toISOString(), objective: sales ? 'sales' : 'traffic', platforms: plats, note };
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

// สถานะแอดทุกตัวในบัญชี (ไม่นับที่ลบ/เก็บถาวร) จัดกลุ่มเป็นภาษาไทย: run วิ่งอยู่ · review รอ Facebook รีวิว · fix ต้องแก้ · paused หยุดไว้ · ended จบแล้ว
const EFF = ['ACTIVE', 'PAUSED', 'PENDING_REVIEW', 'DISAPPROVED', 'PREAPPROVED', 'PENDING_BILLING_INFO', 'CAMPAIGN_PAUSED', 'ADSET_PAUSED', 'IN_PROCESS', 'WITH_ISSUES'];
// priceOf(name) = ราคาสินค้าที่แอดนั้นขาย (บาท) ใช้ตัดสินว่า "ใช้เงินเกิน 2 เท่าของราคาแล้วยังขายไม่ได้"
export async function adsStatus(fb, { currency = 'AUD', priceOf = () => 179 } = {}) {
  const j = await fbGet(`${AD_ACCOUNT}/ads`, {
    access_token: fb.userToken, limit: 100, effective_status: JSON.stringify(EFF),
    fields: 'id,name,effective_status,created_time,campaign{id,name,effective_status,daily_budget,lifetime_budget},adset{id,name,effective_status,end_time,daily_budget},creative{thumbnail_url,image_url,title,object_story_spec{link_data{link},video_data{call_to_action}},asset_feed_spec{link_urls{website_url}}},issues_info,ad_review_feedback,insights.date_preset(last_7d){spend,impressions,clicks,actions,action_values}',
  });
  const rate = await thbRate(currency); const now = Date.now();
  const out = (j.data || []).map((a) => {
    const i = a.insights?.data?.[0] || {}, st = a.effective_status;
    const buy = (i.actions || []).find((x) => /purchase/.test(x.action_type));
    const end = a.adset?.end_time ? Date.parse(a.adset.end_time) : 0;
    const budgetMinor = Number(a.adset?.daily_budget || a.campaign?.daily_budget || 0);
    const fb7 = { spend: Number(i.spend || 0), impressions: Number(i.impressions || 0), clicks: Number(i.clicks || 0), purchases: Number(buy?.value || 0) };
    const val = (i.action_values || []).find((x) => /purchase/.test(x.action_type)); fb7.value = Number(val?.value || 0); // มูลค่ายอดซื้อที่ Facebook นับ (สกุลบัญชี)
    const reasons = [];
    for (const x of a.issues_info || []) reasons.push(x.error_summary || x.error_message || 'มีปัญหาในการแสดงแอด');
    const fbk = a.ad_review_feedback?.global || {}; for (const k of Object.keys(fbk)) reasons.push(fbk[k] || k);
    let group, label, todo = '';
    if (end && end < now && !['DISAPPROVED', 'WITH_ISSUES'].includes(st)) { group = 'ended'; label = 'จบแล้ว (ครบวันที่ตั้งไว้)'; }
    else if (st === 'ACTIVE') {
      const age = now - Date.parse(a.created_time || 0);
      if (age > 2 * 864e5 && fb7.impressions === 0) { group = 'fix'; label = 'เปิดอยู่แต่ไม่มีคนเห็นเลย 7 วัน'; todo = 'เช็คบัญชีโฆษณา/การชำระเงิน หรืองบต่ำเกินไป'; }
      else { group = 'run'; label = 'กำลังวิ่ง'; }
    }
    else if (['PENDING_REVIEW', 'IN_PROCESS', 'PREAPPROVED'].includes(st)) { group = 'review'; label = 'รอ Facebook รีวิว (ปกติไม่เกิน 1 วัน)'; }
    else if (st === 'DISAPPROVED') { group = 'fix'; label = 'Facebook ไม่อนุมัติแอดนี้'; todo = 'แก้ข้อความ/รูปตามเหตุผล แล้วทำแอดใหม่'; }
    else if (st === 'WITH_ISSUES') { group = 'fix'; label = 'แอดมีปัญหา ไม่แสดงผล'; todo = 'ดูเหตุผลด้านล่าง'; }
    else if (st === 'PENDING_BILLING_INFO') { group = 'fix'; label = 'รอข้อมูลการชำระเงิน'; todo = 'เพิ่ม/แก้วิธีชำระเงินในบัญชีโฆษณา'; }
    else { group = 'paused'; label = st === 'CAMPAIGN_PAUSED' ? 'หยุดไว้ (ทั้งแคมเปญ)' : st === 'ADSET_PAUSED' ? 'หยุดไว้ (ชุดโฆษณา)' : 'หยุดไว้'; }
    // เฝ้าเงิน: วิ่งอยู่ ใช้เงิน 7 วันเกิน 2 เท่าของราคาสินค้า แต่ยังไม่มีคนซื้อ → แนะนำหยุด (คุณแดนกดเอง)
    const price = Number(priceOf(a.campaign?.name || a.name)) || 179, spendTHB = fb7.spend / rate;
    let burn = false;
    if (group === 'run' && fb7.purchases === 0 && spendTHB >= 2 * price) { burn = true; group = 'fix'; label = `ใช้ไป ฿${Math.round(spendTHB)} ยังไม่มีคนซื้อ`; todo = 'แนะนำกด ⏸ หยุด แล้วเปลี่ยนรูป/ข้อความ หรือใช้แอดแบบยอดขาย'; }
    // ลิงก์ปลายทางของแอด → ชื่อที่ออเดอร์ในร้านจะถูกติดไว้ (utm_campaign หรือ c=) ใช้จับคู่ยอดขายจริงกับแอด แม้ชื่อแคมเปญใน Facebook จะต่างกัน
    const link = a.creative?.object_story_spec?.link_data?.link || a.creative?.object_story_spec?.video_data?.call_to_action?.value?.link || a.creative?.asset_feed_spec?.link_urls?.[0]?.website_url || '';
    let tag = ''; try { const u = new URL(link); tag = u.searchParams.get('utm_campaign') || u.searchParams.get('c') || ''; } catch (e) {}
    return { id: a.id, name: a.name, link, tag, campaign: a.campaign?.name || '', campaignId: a.campaign?.id || '', status: st, group, label, todo, reasons: reasons.slice(0, 3),
      image: a.creative?.thumbnail_url || a.creative?.image_url || '', end: a.adset?.end_time || null, created: a.created_time,
      dailyTHB: budgetMinor ? Math.round(budgetMinor / 100 / rate) : null, burn, price, week: { ...fb7, spendTHB: Math.round(fb7.spend / rate), valueTHB: Math.round(fb7.value / rate), profitTHB: Math.round((fb7.value - fb7.spend) / rate) } };
  });
  const order = { fix: 0, review: 1, run: 2, paused: 3, ended: 4 };
  out.sort((a, b) => order[a.group] - order[b.group] || String(b.created).localeCompare(String(a.created)));
  return { ads: out, currency, rate };
}
// ประวัติแอดทั้งหมดรายแคมเปญ (ตั้งแต่เริ่ม) ใช้ประเมินรายได้จากงบ: ค่าแอด การซื้อ ยอดขาย วันที่วิ่ง · อ่านอย่างเดียว
export async function adsHistory(fb, rate) {
  const j = await fbGet(`${AD_ACCOUNT}/insights`, { access_token: fb.userToken, level: 'campaign', date_preset: 'maximum', limit: 100,
    fields: 'campaign_id,campaign_name,objective,spend,impressions,clicks,actions,action_values,date_start,date_stop' });
  // วันที่แคมเปญวิ่งจริง: จาก start_time ของแคมเปญ ถึงวันหยุด/วันนี้ (date_start ของ insights = ต้นช่วงที่ขอ ไม่ใช่วันเริ่มแคมเปญ)
  const cj = await fbGet(`${AD_ACCOUNT}/campaigns`, { access_token: fb.userToken, limit: 100, fields: 'id,start_time,stop_time,effective_status,updated_time' }).catch(() => ({}));
  const camp = Object.fromEntries((cj.data || []).map((c) => [c.id, c]));
  return (j.data || []).map((i) => {
    const buy = (i.actions || []).find((x) => /purchase/.test(x.action_type)), val = (i.action_values || []).find((x) => /purchase/.test(x.action_type));
    const c = camp[i.campaign_id] || {}, t0 = Date.parse(c.start_time || i.date_start), on = c.effective_status === 'ACTIVE';
    const t1 = Math.min(Date.now(), Date.parse(c.stop_time || '') || Infinity, on ? Infinity : (Date.parse(c.updated_time || '') || Infinity), Date.parse(i.date_stop) + 864e5);
    const days = Math.max(1, Math.round((t1 - t0) / 864e5));
    return { id: i.campaign_id, name: i.campaign_name || '', objective: i.objective || '', sales: /SALES|CONVERSIONS|PRODUCT_CATALOG/.test(i.objective || ''),
      spendTHB: Math.round(Number(i.spend || 0) / rate), valueTHB: Math.round(Number(val?.value || 0) / rate), purchases: Number(buy?.value || 0),
      clicks: Number(i.clicks || 0), impressions: Number(i.impressions || 0), start: c.start_time || i.date_start, stop: i.date_stop, active: on, days };
  }).filter((x) => x.spendTHB > 0);
}
// ตัวเลขรายวันรายแคมเปญ (กราฟหน้าโฆษณาแบบ Shopee Ads) ย้อนหลัง days วัน · วันที่ตามเขตเวลาของบัญชีโฆษณา (tz = ชั่วโมงจาก UTC)
export async function adsDaily(fb, rate, days = 60) {
  const acc = await fbGet(AD_ACCOUNT, { access_token: fb.userToken, fields: 'timezone_offset_hours_utc' }).catch(() => ({}));
  const tz = Number(acc.timezone_offset_hours_utc) || 0, day = (t) => new Date(t + tz * 36e5).toISOString().slice(0, 10);
  let j = await fbGet(`${AD_ACCOUNT}/insights`, { access_token: fb.userToken, level: 'campaign', time_increment: 1, limit: 500,
    time_range: JSON.stringify({ since: day(Date.now() - (days - 1) * 864e5), until: day(Date.now()) }), fields: 'campaign_id,spend,impressions,clicks,actions,action_values,date_start' });
  const rows = [...(j.data || [])];
  for (let k = 0; k < 6 && j.paging?.next; k++) { const r = await fetch(j.paging.next); j = await r.json(); if (j.error) break; rows.push(...(j.data || [])); }
  return { tz, rows: rows.map((i) => { const buy = (i.actions || []).find((x) => /purchase/.test(x.action_type)), val = (i.action_values || []).find((x) => /purchase/.test(x.action_type));
    return { d: i.date_start, c: i.campaign_id, s: Math.round(Number(i.spend || 0) / rate), i: Number(i.impressions || 0), k: Number(i.clicks || 0), p: Number(buy?.value || 0), v: Math.round(Number(val?.value || 0) / rate) }; }) };
}
export async function setAdStatus(fb, adId, status) { return fbPost(adId, { status }, fb.userToken); }
