// 🔀 ย้ายงาน AI ทั้งหมดไป fal.ai บัญชีเดียว (คุณแดน 12 ต.ค. 69: "ย้ายทั้งหมด จะได้ง่ายแก่การจัดการ" · Gemini เครดิตหมด · OpenAI ติดวงเงิน · เลิก ElevenLabs)
// มี FAL_KEY = คำขอเดิมที่ยิงไป Google Gemini / OpenAI / ElevenLabs / Google TTS ถูกส่งไป fal แทน แล้วแปลงคำตอบกลับเป็นรูปแบบเดิม
// โค้ดเดิมทุกจุดจึงไม่ต้องแก้ · ไม่มี FAL_KEY = ยิงไปเจ้าเดิมเหมือนก่อน
//   ข้อความ (Gemini generateContent · OpenAI chat) → OpenRouter บน fal (AI_TEXT_MODEL ค่าเริ่ม google/gemini-2.5-flash)
//   รูป Gemini (gemini-*-image) → nano-banana(-pro)[/edit] · รูป OpenAI (images/generations · images/edits) → openai/gpt-image-2[/edit]
//   เสียง ElevenLabs text-to-speech → ElevenLabs บน fal (เสียงเดิมใช้ไม่ได้ → เสียง Gemini TTS) · Google TTS → Gemini TTS บน fal (ชื่อเสียง Chirp 3 HD ชุดเดียวกัน)
const FAL_RUN = 'https://fal.run/';
const falKey = () => process.env.FAL_KEY || '';
const TEXT_MODEL = () => process.env.AI_TEXT_MODEL || 'google/gemini-2.5-flash';
const GEMINI_VOICES = new Set(['Achernar', 'Achird', 'Algenib', 'Algieba', 'Alnilam', 'Aoede', 'Autonoe', 'Callirrhoe', 'Charon', 'Despina', 'Enceladus', 'Erinome', 'Fenrir', 'Gacrux', 'Iapetus', 'Kore', 'Laomedeia', 'Leda', 'Orus', 'Pulcherrima', 'Puck', 'Rasalgethi', 'Sadachbia', 'Sadaltager', 'Schedar', 'Sulafat', 'Umbriel', 'Vindemiatrix', 'Zephyr', 'Zubenelgenubi']);

const json = (obj, status = 200) => new Response(JSON.stringify(obj), { status, headers: { 'Content-Type': 'application/json' } });
const errJson = (msg, status) => json({ error: { message: `fal: ${msg}`, code: status } }, status);

async function falCall(orig, endpoint, body) {
  const r = await orig(FAL_RUN + endpoint, { method: 'POST', headers: { Authorization: `Key ${falKey()}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) { const m = typeof j.detail === 'string' ? j.detail : JSON.stringify(j.detail || j.error || j).slice(0, 300); const e = new Error(m); e.status = r.status; throw e; }
  return j;
}
const b64Of = async (orig, url) => { if (String(url).startsWith('data:')) return String(url).split(',')[1]; const r = await orig(url); return Buffer.from(await r.arrayBuffer()).toString('base64'); };

// ---------- ข้อความ ----------
export function geminiToChat(model, body) {
  const msgs = [];
  const sys = body.systemInstruction || body.system_instruction;
  if (sys) msgs.push({ role: 'system', content: (sys.parts || []).map((p) => p.text || '').join('\n') });
  for (const c of body.contents || []) {
    const parts = [];
    for (const p of c.parts || []) {
      const d = p.inlineData || p.inline_data;
      if (p.text != null) parts.push({ type: 'text', text: String(p.text) });
      else if (d) {
        const mime = d.mimeType || d.mime_type || '';
        if (mime.startsWith('image/')) parts.push({ type: 'image_url', image_url: { url: `data:${mime};base64,${d.data}` } });
        else if (mime.startsWith('audio/') || mime.startsWith('video/')) parts.push({ type: 'input_audio', input_audio: { data: d.data, format: (mime.split('/')[1] || 'wav').split(';')[0].replace('mpeg', 'mp3').replace('x-wav', 'wav') } });
      }
    }
    msgs.push({ role: c.role === 'model' ? 'assistant' : 'user', content: parts.length === 1 && parts[0].type === 'text' ? parts[0].text : parts });
  }
  const g = body.generationConfig || body.generation_config || {};
  const out = { model: mapTextModel(model), messages: msgs };
  if (g.temperature != null) out.temperature = g.temperature;
  if (g.maxOutputTokens) out.max_tokens = g.maxOutputTokens;
  if (/json/.test(g.responseMimeType || g.response_mime_type || '')) out.response_format = { type: 'json_object' };
  return out;
}
export function mapTextModel(m) {
  m = String(m || '');
  if (!m || /flash-latest|^gemini-flash/.test(m)) return TEXT_MODEL();
  if (m.includes('/')) return m;
  if (/^gemini-/.test(m)) return 'google/' + m.replace(/-latest$/, '');
  if (/^(gpt|o\d)/.test(m)) return 'openai/' + m;
  return TEXT_MODEL();
}
export const chatToGemini = (j) => ({ candidates: [{ content: { role: 'model', parts: [{ text: j?.choices?.[0]?.message?.content || '' }] }, finishReason: (j?.choices?.[0]?.finish_reason || 'stop').toUpperCase() }], usageMetadata: j?.usage || {} });
const chat = (orig, body) => falCall(orig, 'openrouter/router/openai/v1/chat/completions', body);

// ---------- รูป ----------
async function geminiImage(orig, model, body) {
  const parts = (body.contents || []).flatMap((c) => c.parts || []);
  const prompt = parts.filter((p) => p.text != null).map((p) => p.text).join('\n');
  const refs = parts.map((p) => p.inlineData || p.inline_data).filter(Boolean).map((d) => `data:${d.mimeType || d.mime_type};base64,${d.data}`);
  const ar = body.generationConfig?.imageConfig?.aspectRatio || '1:1';
  const ep = (/pro|-3/.test(model) ? 'fal-ai/nano-banana-pro' : 'fal-ai/nano-banana') + (refs.length ? '/edit' : '');
  const j = await falCall(orig, ep, { prompt, aspect_ratio: ar, output_format: 'png', ...(refs.length ? { image_urls: refs } : {}) });
  const u = j?.images?.[0]?.url; if (!u) return json({ candidates: [{ content: { parts: [] } }] });
  return json({ candidates: [{ content: { parts: [{ inlineData: { mimeType: j.images[0].content_type || 'image/png', data: await b64Of(orig, u) } }] } }] });
}
const sizeOf = (s) => { const m = String(s || '').match(/^(\d+)x(\d+)$/); return m ? { width: +m[1], height: +m[2] } : 'square_hd'; };
async function openaiImage(orig, url, init) {
  let prompt, size, quality, fmt, refs = [];
  if (/\/edits$/.test(url) && init.body && typeof init.body.getAll === 'function') {
    const fd = init.body; prompt = fd.get('prompt'); size = fd.get('size'); quality = fd.get('quality'); fmt = fd.get('output_format');
    for (const f of [...fd.getAll('image[]'), ...fd.getAll('image')]) if (f && typeof f.arrayBuffer === 'function') refs.push(`data:${f.type || 'image/png'};base64,${Buffer.from(await f.arrayBuffer()).toString('base64')}`);
  } else { const b = JSON.parse(init.body || '{}'); prompt = b.prompt; size = b.size; quality = b.quality; fmt = b.output_format; }
  const q = ['low', 'medium', 'high'].includes(quality) ? quality : 'medium';
  const j = await falCall(orig, refs.length ? 'openai/gpt-image-2/edit' : 'openai/gpt-image-2', { prompt, image_size: sizeOf(size), quality: q, output_format: fmt === 'png' ? 'png' : 'jpeg', ...(refs.length ? { image_urls: refs } : {}) });
  const u = j?.images?.[0]?.url; if (!u) return errJson('ไม่ได้รูปกลับมา', 502);
  return json({ data: [{ b64_json: await b64Of(orig, u) }] });
}

// ---------- เสียง ----------
const stripSsml = (s) => String(s || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
// Gemini TTS บน fal รับชื่อภาษาเต็ม ("Thai (Thailand)") ไม่ใช่รหัส th-TH
const TTS_LANG = { th: 'Thai (Thailand)', 'en-us': 'English (US)', 'en-gb': 'English (UK)', 'en-au': 'English (Australia)', 'en-in': 'English (India)', en: 'English (US)', ja: 'Japanese (Japan)', ko: 'Korean (South Korea)', 'zh-cn': 'Chinese Mandarin (China)', 'zh-tw': 'Chinese Mandarin (Taiwan)', zh: 'Chinese Mandarin (China)', vi: 'Vietnamese (Vietnam)', id: 'Indonesian (Indonesia)', fr: 'French (France)', de: 'German (Germany)', es: 'Spanish (Spain)' };
export const ttsLang = (code) => { const c = String(code || '').toLowerCase(); return TTS_LANG[c] || TTS_LANG[c.split('-')[0]] || ''; };
async function geminiTts(orig, { text, voice, lang, slow }) {
  const v = GEMINI_VOICES.has(voice) ? voice : 'Kore'; lang = ttsLang(lang);
  const j = await falCall(orig, 'fal-ai/gemini-3.1-flash-tts', { prompt: text, voice: v, output_format: 'mp3', ...(lang ? { language_code: lang } : {}), ...(slow ? { style_instructions: 'Speak slowly and clearly.' } : {}) });
  const u = j?.audio?.url; if (!u) throw Object.assign(new Error('ไม่ได้ไฟล์เสียงกลับมา'), { status: 502 });
  return Buffer.from(await (await orig(u)).arrayBuffer());
}
async function googleTts(orig, init) {
  const b = JSON.parse(init.body || '{}');
  const name = String(b.voice?.name || ''), last = name.split('-').pop();
  const buf = await geminiTts(orig, { text: b.input?.text || stripSsml(b.input?.ssml), voice: last, lang: b.voice?.languageCode, slow: Number(b.audioConfig?.speakingRate) > 0 && Number(b.audioConfig?.speakingRate) < 0.95 });
  return json({ audioContent: buf.toString('base64') });
}
async function elevenTts(orig, url, init) {
  const b = JSON.parse(init.body || '{}'), voice = decodeURIComponent((url.match(/text-to-speech\/([^/?]+)/) || [])[1] || '');
  let buf;
  try {
    const j = await falCall(orig, 'fal-ai/elevenlabs/tts/eleven-v3', { text: b.text, voice, ...(b.voice_settings?.stability != null ? { stability: b.voice_settings.stability } : {}) });
    buf = Buffer.from(await (await orig(j.audio.url)).arrayBuffer());
  } catch (e) { // เสียงที่เลือกไว้ในบัญชี ElevenLabs เดิมใช้บน fal ไม่ได้ → เสียงไทยของ Gemini
    buf = await geminiTts(orig, { text: b.text, voice: process.env.AI_TTS_VOICE || 'Kore', lang: /[฀-๿]/.test(b.text || '') ? 'th-TH' : '' });
  }
  return new Response(buf, { status: 200, headers: { 'Content-Type': 'audio/mpeg' } });
}

// ---------- ตัวสลับเส้นทาง ----------
export async function route(orig, url, init = {}) {
  if (!falKey()) return null;
  try {
    let m;
    if ((m = url.match(/^https:\/\/generativelanguage\.googleapis\.com\/v1beta\/models\/([^:?]+):generateContent/))) {
      const body = JSON.parse(init.body || '{}'), model = decodeURIComponent(m[1]);
      if (/image/.test(model) || (body.generationConfig?.responseModalities || []).includes('IMAGE')) return await geminiImage(orig, model, body);
      return json(chatToGemini(await chat(orig, geminiToChat(model, body))));
    }
    if (/^https:\/\/api\.openai\.com\/v1\/chat\/completions/.test(url)) { const b = JSON.parse(init.body || '{}'); return json(await chat(orig, { ...b, model: mapTextModel(b.model) })); }
    if (/^https:\/\/api\.openai\.com\/v1\/images\/(generations|edits)/.test(url)) return await openaiImage(orig, url, init);
    if (/^https:\/\/api\.elevenlabs\.io\/v1\/text-to-speech\//.test(url)) return await elevenTts(orig, url, init);
    // มีคีย์ Google TTS จริงในลิงก์ = ใช้โควตาฟรีรายเดือนของ Google ตรงๆ (คุณแดน 24 ต.ค. 69 "ไฟล์เสียงที่ใช้ทำหนังสือต้องใช้ของฟรี") · ส่ง fal (Gemini TTS เสียเงิน) เฉพาะตอนไม่มีคีย์ Google
    if (/^https:\/\/texttospeech\.googleapis\.com\/v1\/text:synthesize/.test(url)) { const k = new URL(url).searchParams.get('key'); if (k && k !== 'via-fal') return null; return await googleTts(orig, init); }
  } catch (e) { return errJson(e.message || String(e), e.status || 502); }
  return null;
}

export function installAiRouter() {
  if (globalThis.__slAiRouter) return;
  const orig = globalThis.fetch.bind(globalThis); globalThis.__slAiRouter = orig;
  // โค้ดเดิมเช็คว่ามีคีย์เจ้าเดิมก่อนเรียก: มี FAL_KEY ถือว่ามีทุกเจ้า (คำขอถูกส่งไป fal อยู่แล้ว) ลบคีย์เจ้าเดิมออกจาก Vercel ได้
  if (falKey()) for (const k of ['GEMINI_API_KEY', 'OPENAI_API_KEY', 'ELEVEN_KEY', 'GOOGLE_TTS_API_KEY']) if (!process.env[k]) process.env[k] = 'via-fal';
  globalThis.fetch = async (input, init) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input?.url || '';
    const r = await route(orig, url, init || {});
    return r || orig(input, init);
  };
}
installAiRouter();
