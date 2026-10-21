-- ฐานข้อมูลร้านบน Cloudflare D1 (sheetlab-db) · ตารางเดียวกับ Supabase เดิม (ย้าย 21 ต.ค. 69)
-- jsonb → TEXT (JSON) · timestamptz → TEXT (ISO 8601 UTC) · uuid → TEXT · boolean → INTEGER 0/1
CREATE TABLE IF NOT EXISTS shop_state (id TEXT PRIMARY KEY, data TEXT NOT NULL DEFAULT '{}', updated_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')));
CREATE TABLE IF NOT EXISTS orders (session_id TEXT PRIMARY KEY, created_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')), paid_at TEXT, product_id TEXT, product_name TEXT, slug TEXT, email TEXT, name TEXT, amount REAL, currency TEXT, status TEXT, campaign TEXT, payment_intent TEXT, emailed_at TEXT);
CREATE INDEX IF NOT EXISTS orders_created ON orders (created_at);
CREATE INDEX IF NOT EXISTS orders_email ON orders (email);
CREATE INDEX IF NOT EXISTS orders_pi ON orders (payment_intent);
CREATE TABLE IF NOT EXISTS posts (id TEXT PRIMARY KEY, created_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')), status TEXT DEFAULT 'draft', source TEXT, kind TEXT, week TEXT, notes TEXT, text TEXT, image_url TEXT, link_url TEXT, scheduled_at TEXT, published_at TEXT, fb_post_id TEXT, error TEXT, channel TEXT DEFAULT 'facebook', th_post_id TEXT);
CREATE INDEX IF NOT EXISTS posts_status ON posts (status, scheduled_at);
CREATE TABLE IF NOT EXISTS web_events (id INTEGER PRIMARY KEY AUTOINCREMENT, at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')), sid TEXT, path TEXT, ev TEXT, k TEXT, v REAL, src TEXT, dev TEXT);
CREATE INDEX IF NOT EXISTS web_events_at ON web_events (at);
CREATE TABLE IF NOT EXISTS members (email TEXT PRIMARY KEY, status TEXT DEFAULT 'none', plan TEXT, paid_until TEXT, stripe_customer TEXT, stripe_sub TEXT, cancel_at TEXT, login_sent_at TEXT, created_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')), updated_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')), marketing INTEGER, marketing_at TEXT, last_login_at TEXT);
CREATE TABLE IF NOT EXISTS member_vocab (email TEXT PRIMARY KEY, data TEXT DEFAULT '{}', updated_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')));
CREATE TABLE IF NOT EXISTS member_mistakes (email TEXT NOT NULL, quiz_slug TEXT NOT NULL, q INTEGER NOT NULL, wrong INTEGER DEFAULT 1, last_wrong_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')), fixed_at TEXT, PRIMARY KEY (email, quiz_slug, q));
CREATE TABLE IF NOT EXISTS member_writing (id TEXT PRIMARY KEY, email TEXT NOT NULL, task TEXT, prompt TEXT, essay TEXT, result TEXT, band REAL, via TEXT, created_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')));
