// Vercel Cron เรียกวันละครั้ง (ดู vercel.json) เพื่อให้โปรเจกต์ Supabase แพ็กฟรีไม่ถูกพักเพราะไม่มีการใช้งาน 7 วัน
const SB_URL = 'https://lpeqaorswhwzlplsaqpe.supabase.co';
const SB_KEY = 'sb_publishable_q4qdE3WFYdH15Klf7TToSQ_Tbh87eNs';

export default async function handler(req, res) {
  try {
    const r = await fetch(`${SB_URL}/rest/v1/shop_state?select=id&limit=1`, {
      headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}` },
    });
    res.status(r.ok ? 200 : 502).json({ ok: r.ok, status: r.status, at: new Date().toISOString() });
  } catch (e) {
    res.status(502).json({ ok: false, error: String(e) });
  }
}
