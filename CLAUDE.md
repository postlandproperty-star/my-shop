# SheetLab (sheetlabth.com)

## ⚠️ Top priority: customers can always pay and check out
คุณแดน (8 Oct 2026): this comes before every feature, speed fix or redesign.

- Any change that touches checkout must test the edge cases before pushing: empty or invalid email, cart, bundle plan, course, Android FB in-app and iPhone. Checkout code includes `qrInner`/`qrMake`/cart in `src/index.html`, `api/checkout.js`, `lib/fulfill.js`, and `lib/split.js` KEEP.
- After every deploy, check the live product page: type an email and press "ชำระเงิน", and confirm a QR request goes out. Intercept `/api/checkout?m=qr` in Playwright so no real payment is created.
- The payment watchdog (`payWatch` in `api/content.js`) emails the owner when customers tap pay but no QR is created. Keep it working. Status: `/api/content?action=paywatch&h=3` with the shop key.
- If orders look low, check checkout first: Stripe PaymentIntents vs `qrMake` clicks in `?action=insights&days=1`.
- `npm test` must pass before pushing (pre-push hook).
