# Device notifications

Open the notification bell, select **تفعيل إشعارات هذا الجهاز**, allow notifications,
then use **اختبار الإشعارات**. Enable separately on each device/account.

- **Android / Windows browser:** open the site over HTTPS in a browser with Web Push support.
  Push can arrive while the app page is closed, subject to browser and OS background settings.
- **iPhone / iPad (iOS 16.4+):** add the site to the Home Screen from Safari, open that
  installed web app and enable notifications there.
- **Windows:** use the HTTPS website or the browser-installed web app. Electron packaging
  is archived under `scripts/archive/desktop/` and is not part of the active web project.
  Windows notifications and Focus Assist / Do Not Disturb can suppress banners.
- **Local office network over HTTP:** the web notification UI explains the HTTPS requirement;
  in-app notifications still work.

The server creates persistent VAPID keys in its SQLite `push_config` table automatically.
Preserve the database across updates. Optionally configure both `VAPID_PUBLIC_KEY` and
`VAPID_PRIVATE_KEY`, plus `VAPID_SUBJECT` with your contact address or HTTPS site.
Never publish the private key. Changing the key pair requires enabling devices again.
The server needs outbound HTTPS access to browser push providers.
Install the updated server dependencies before restarting it. This checkout's existing
Babel peer dependency conflict requires `npm install --legacy-peer-deps` in `server`.

Subscriptions belong to authenticated office staff. Signing out unsubscribes this device;
other devices remain subscribed. Expired provider subscriptions are removed automatically.
Messages use encrypted Web Push and can appear on the device lock screen.

Verification: `node tests/notifications.mjs` and `npm run test:permissions` in `server`;
`npm run build` in `client`. Provider delivery is mocked in automated tests; validate
actual delivery with the test button on each target device after deploying/rebuilding.

## Verification result (2026-10-14)

- Isolated notification suite: **14 checks passed**, using an in-memory database and
  mocked provider sends. No production subscriptions or data were modified.
- Recovery now recreates a missing/rotated subscription only for the account that
  already enabled this device and still has browser permission. It does not prompt
  automatically or enable notifications for a different signed-in account.
- A malformed stored subscription no longer prevents delivery to other devices.
- JavaScript syntax and scoped diff whitespace checks: PASS.
- Chrome inspection found only an empty tab; no authenticated physical phone or
  Windows notification banner was available for testing. Actual provider delivery
  and visible banners remain **unverified**.
- The archived Electron bridge test is compatibility evidence only. The current
  Windows delivery path is the HTTPS browser/PWA.

## Earlier recorded verification

- Web build and Windows NSIS installer build: PASS.
- JavaScript syntax and scoped diff whitespace checks: PASS.
- Automated tests: 12 notification checks, 69 permissions checks and 10 regression checks passed.
- Type checking / lint: no configured scripts in this JavaScript project.
- Security review: staff ownership enforced, internal push destinations rejected,
  private VAPID key excluded from API responses, inactive accounts excluded from delivery.
- Coverage percentage and physical-device banner delivery: not measured.
