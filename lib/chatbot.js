// แชทบอทเพจ Facebook (Messenger): ตอบลูกค้าเองจากข้อมูลสินค้าจริง · ถามส่วนลด → ลิงก์ /deal (โค้ดส่วนตัว 24 ชม.)
// ปัญหาออเดอร์/ไฟล์/โอนเงิน → ขออีเมลแล้วส่งต่อคุณแดน · คุณแดนตอบเองจากกล่องข้อความเพจ → บอทเงียบกับคนนั้น 12 ชม.
// ตั้งค่าใน shop_state id=chatbot · บทสนทนาล่าสุด id=chatbot_threads (เก็บ 10 ข้อความล่าสุดต่อคน สูงสุด 300 คน)
import { createHmac } from 'node:crypto';
import { SB_URL, loadShop } from './shop.js';
import { loadFb, FB_API } from './fb.js';

const SECRET = process.env.SUPABASE_SECRET_KEY || '';
const hdr = { apikey: SECRET, Authorization: `Bearer ${SECRET}`, 'Content-Type': 'application/json' };
export const verifyToken = () => 'sl-' + createHmac('sha256', `messenger:${SECRET}`).update('verify').digest('hex').slice(0, 20);

export const BOT_DEFAULT = {
  on: false, mode: 'ai', pauseHours: 12,
  keywords: 'ส่วนลด, โค้ด, ลดราคา, โปร, ลดได้ไหม, discount, code',
  dealReply: '🎁 โค้ดลด {pct}% สำหรับคุณ ใช้ได้ภายใน 24 ชม. เท่านั้น กดรับเลยค่ะ 👉 {deal}',
  greet: 'สวัสดีค่ะ ขอบคุณที่ทักมานะคะ 😊 สนใจเตรียมสอบอะไรอยู่คะ TOEIC, IELTS, ก.พ. หรือ TGAT บอกได้เลย จะแนะนำเล่มที่เหมาะให้ค่ะ\n🎁 ชีทฟรี: {free}\n📚 ดูทั้งหมด: {store}',
  handoff: 'ขอบคุณค่ะ รบกวนแจ้งอีเมลที่ใช้สั่งซื้อไว้ในแชทนี้ แอดมินจะตรวจสอบและตอบกลับโดยเร็วที่สุดค่ะ 🙏',
};
async function getRow(id) { const r = await fetch(`${SB_URL}/rest/v1/shop_state?id=eq.${id}&select=data`, { headers: hdr }); const j = r.ok ? await r.json() : []; return j?.[0]?.data || null; }
async function putRow(id, data) { await fetch(`${SB_URL}/rest/v1/shop_state?on_conflict=id`, { method: 'POST', headers: { ...hdr, Prefer: 'resolution=merge-duplicates,return=minimal' }, body: JSON.stringify([{ id, data, updated_at: '2000-01-01T00:00:00Z' }]) }); }
export async function loadBot() { return { ...BOT_DEFAULT, ...((await getRow('chatbot')) || {}) }; }
export async function saveBot(cfg) { const c = { ...BOT_DEFAULT, ...cfg }; await putRow('chatbot', c); return c; }
export async function loadThreads() { return (await getRow('chatbot_threads')) || { t: {} }; }
async function saveThreads(d) { const ks = Object.keys(d.t).sort((a, b) => String(d.t[b].at).localeCompare(String(d.t[a].at))); for (const k of ks.slice(300)) delete d.t[k]; await putRow('chatbot_threads', d); }

const ISSUE = /ไม่ได้รับ|ยังไม่ได้|หาไม่เจอ|โหลดไม่ได้|เปิดไม่ได้|ไฟล์เสีย|โอนแล้ว|จ่ายแล้ว|ชำระแล้ว|คืนเงิน|เปลี่ยนอีเมล|ส่งไปอีเมล|ลิงก์ไม่|refund/i;
const fill = (t, v) => String(t || '').replace(/\{(\w+)\}/g, (m, k) => (v[k] != null ? v[k] : m));

async function aiReply(history, catalog, site, cfg) {
  const sys = `คุณคือแอดมินร้าน SheetLab (${site}) ขายหนังสือ/ชีทเตรียมสอบภาษาอังกฤษแบบไฟล์ PDF สำหรับคนไทย (TOEIC, IELTS, ก.พ., TGAT) ตอบแชทเพจ Facebook
กฎ: ตอบภาษาไทยสุภาพ ลงท้าย "ค่ะ" สั้น 1-4 ประโยค ไม่ใช้ markdown · แนะนำเฉพาะสินค้าในรายการด้านล่าง พร้อมราคาและลิงก์ตามรายการ ห้ามแต่งสินค้า ราคา หรือโปรขึ้นเอง
· ถ้าถามส่วนลด/โค้ด ให้ส่งลิงก์ ${site}/deal (โค้ดส่วนตัว ลด ${cfg.pct}% ใช้ได้ภายใน 24 ชม.) · ชีทฟรี: ${site}/free · ดูทั้งหมด: ${site}/store
· วิธีซื้อ: กดสั่งซื้อในหน้าสินค้า สแกนจ่าย QR พร้อมเพย์หรือบัตร ได้ลิงก์ดาวน์โหลดทันทีและส่งเข้าอีเมล
· ถ้าเป็นปัญหาออเดอร์ การจ่ายเงิน หรือไม่ได้รับไฟล์ ให้ขออีเมลที่ใช้สั่งซื้อ แล้วบอกว่าแอดมินจะตรวจสอบให้ ห้ามสัญญาคืนเงินเอง
· ห้ามรับประกันคะแนนสอบ ห้ามขอข้อมูลบัตรหรือรหัสผ่าน ถ้าไม่แน่ใจให้บอกว่าแอดมินจะตอบกลับ
สินค้า:
${catalog}`;
  const msgs = history.slice(-8).map((m) => ({ role: m.r === 'u' ? 'user' : 'assistant', content: String(m.t).slice(0, 800) }));
  if (process.env.OPENAI_API_KEY) {
    const r = await fetch('https://api.openai.com/v1/chat/completions', { method: 'POST', headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ model: 'gpt-4o-mini', temperature: 0.4, max_tokens: 350, messages: [{ role: 'system', content: sys }, ...msgs] }) });
    const j = await r.json().catch(() => ({})); const t = j?.choices?.[0]?.message?.content; if (t) return t.trim();
  }
  if (process.env.GEMINI_API_KEY) {
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${encodeURIComponent(process.env.GEMINI_API_KEY)}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ systemInstruction: { parts: [{ text: sys }] }, contents: msgs.map((m) => ({ role: m.role === 'user' ? 'user' : 'model', parts: [{ text: m.content }] })), generationConfig: { temperature: 0.4, maxOutputTokens: 600 } }) });
    const j = await r.json().catch(() => ({})); const t = (j?.candidates?.[0]?.content?.parts || []).map((x) => x.text || '').join(''); if (t) return t.replace(/\*\*/g, '').trim();
  }
  return '';
}

export async function sendText(fb, psid, text) {
  const r = await fetch(`${FB_API}/me/messages?access_token=${encodeURIComponent(fb.token)}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ recipient: { id: psid }, messaging_type: 'RESPONSE', message: { text: String(text).slice(0, 1900), metadata: 'slbot' } }) });
  const j = await r.json().catch(() => ({})); if (!r.ok || j.error) throw new Error(j.error?.message || `messenger ${r.status}`); return j;
}

// เหตุการณ์จาก webhook ทีละข้อความ
export async function handleEvent(ev, { site = 'https://sheetlabth.com', pageId = '' } = {}) {
  const cfg = await loadBot(); const th = await loadThreads(); const now = new Date();
  const msg = ev.message || {}; const text = String(msg.text || '').trim();
  // ข้อความที่เพจส่งเอง (คุณแดนตอบจากกล่องข้อความ) → บอทหยุดตอบคนนี้ชั่วคราว
  if (msg.is_echo) {
    const psid = ev.recipient?.id; if (!psid) return { skip: 'echo' };
    if (msg.metadata === 'slbot' || (process.env.FB_APP_ID && String(msg.app_id || '') === String(process.env.FB_APP_ID))) return { skip: 'own echo' }; // ข้อความที่บอทส่งเอง
    const t = th.t[psid] || (th.t[psid] = { msgs: [] }); t.paused_until = new Date(now.getTime() + (Number(cfg.pauseHours) || 12) * 3600e3).toISOString(); t.at = now.toISOString(); t.msgs.push({ r: 'h', t: text.slice(0, 500), at: now.toISOString() }); t.msgs = t.msgs.slice(-10);
    await saveThreads(th); return { paused: psid };
  }
  const psid = ev.sender?.id; if (!psid || psid === pageId) return { skip: 'no sender' };
  const t = th.t[psid] || (th.t[psid] = { msgs: [] }); const first = !t.msgs.length;
  t.msgs.push({ r: 'u', t: (text || (msg.attachments ? '[รูป/ไฟล์]' : '')).slice(0, 500), at: now.toISOString() }); t.at = now.toISOString();
  let reply = '', why = '';
  const shop = await loadShop().catch(() => ({ products: [], settings: {} }));
  const pct = Number(shop.settings?.dealPct) || 10, vars = { pct, deal: `${site}/deal`, free: `${site}/free`, store: `${site}/store` };
  if (!cfg.on) why = 'off';
  else if (t.paused_until && Date.parse(t.paused_until) > now.getTime()) why = 'paused';
  else if (!text) { reply = first ? fill(cfg.greet, vars) : ''; why = 'attachment'; }
  else {
    const kw = String(cfg.keywords || '').split(/[,\n]/).map((x) => x.trim().toLowerCase()).filter(Boolean);
    if (!shop.settings?.dealOff && kw.some((k) => text.toLowerCase().includes(k))) { reply = fill(cfg.dealReply, vars); why = 'deal'; }
    else if (ISSUE.test(text)) { reply = fill(cfg.handoff, vars); t.needsHuman = true; why = 'handoff'; }
    else if (cfg.mode === 'ai') {
      const cat = (shop.products || []).filter((p) => p.status === 'published' && !/ทดสอบ/.test(p.name)).slice(0, 60).map((p) => `- ${p.name} · ${p.type === 'bundle' ? 'ชุด ' : ''}฿${p.type === 'bundle' ? ((p.plans || []).find((x) => x.on !== false) || {}).price || p.price : p.price} · ${site}/p/${p.slug}`).join('\n');
      try { reply = await aiReply(t.msgs, cat, site, { pct }); why = 'ai'; } catch (e) { why = 'ai error'; }
      if (!reply && first) { reply = fill(cfg.greet, vars); why = 'greet'; }
    } else if (first) { reply = fill(cfg.greet, vars); why = 'greet'; }
  }
  if (reply) {
    try { const fb = await loadFb(); if (!fb) throw new Error('ยังไม่ได้เชื่อมเพจ'); await sendText(fb, psid, reply); t.msgs.push({ r: 'b', t: reply.slice(0, 800), at: new Date().toISOString(), why }); }
    catch (e) { t.err = String(e.message || e).slice(0, 200); why = 'send error'; }
  }
  t.msgs = t.msgs.slice(-10); th.last = now.toISOString(); await saveThreads(th);
  return { psid, why, replied: !!reply };
}

// ทดลองถามบอทในหลังบ้าน (ไม่ส่งจริง ไม่บันทึก)
export async function previewReply(text, site = 'https://sheetlabth.com') {
  const cfg = await loadBot(); const shop = await loadShop().catch(() => ({ products: [], settings: {} }));
  const pct = Number(shop.settings?.dealPct) || 10, vars = { pct, deal: `${site}/deal`, free: `${site}/free`, store: `${site}/store` };
  const kw = String(cfg.keywords || '').split(/[,\n]/).map((x) => x.trim().toLowerCase()).filter(Boolean);
  if (!text) return { why: 'greet', reply: fill(cfg.greet, vars) };
  if (!shop.settings?.dealOff && kw.some((k) => text.toLowerCase().includes(k))) return { why: 'deal', reply: fill(cfg.dealReply, vars) };
  if (ISSUE.test(text)) return { why: 'handoff', reply: fill(cfg.handoff, vars) };
  if (cfg.mode !== 'ai') return { why: 'keywords only', reply: '(โหมดคำสำคัญ: ข้อความนี้บอทไม่ตอบ รอแอดมิน)' };
  const cat = (shop.products || []).filter((p) => p.status === 'published' && !/ทดสอบ/.test(p.name)).slice(0, 60).map((p) => `- ${p.name} · ${p.type === 'bundle' ? 'ชุด ' : ''}฿${p.type === 'bundle' ? ((p.plans || []).find((x) => x.on !== false) || {}).price || p.price : p.price} · ${site}/p/${p.slug}`).join('\n');
  return { why: 'ai', reply: (await aiReply([{ r: 'u', t: text }], cat, site, { pct })) || '(AI ตอบไม่ได้ตอนนี้ ตรวจเงิน OpenAI/Google)' };
}
