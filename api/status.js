// แอดมินกด "ตรวจสอบการเชื่อมต่อ": บอกว่าคีย์บน Vercel ครบไหม และเชื่อม Stripe ได้ไหม
import { stripe, verifyAdmin, configured } from '../lib/shop.js';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  const admin = await verifyAdmin(req.headers.authorization);
  if (!admin) return res.status(401).json({ ok: false, error: 'ต้องล็อกอินแอดมิน' });
  const cfg = configured();
  let account = null, stripeError = null, promptpay = null;
  if (cfg.stripe) {
    try {
      const a = await stripe('GET', 'account');
      account = { name: a.settings?.dashboard?.display_name || a.business_profile?.name || a.id, country: a.country, livemode: !!a.charges_enabled };
      promptpay = a.capabilities?.promptpay_payments || 'unknown';
    } catch (e) { stripeError = String(e.message || e); }
  }
  res.status(200).json({ ok: true, stripeKey: cfg.stripe, supabaseKey: cfg.supabase, account, promptpay, stripeError });
}
