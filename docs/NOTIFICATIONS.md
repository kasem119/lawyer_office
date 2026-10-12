# Device notifications

Open the notification bell, select **تفعيل إشعارات هذا الجهاز**, allow notifications,
then use **اختبار الإشعارات**. Enable separately on each device/account.

- **Android / Windows browser:** open the site over HTTPS in a browser with Web Push support.
  Push can arrive while the app page is closed, subject to browser and OS background settings.
- **iPhone / iPad (iOS 16.4+):** add the site to the Home Screen from Safari, open that
  installed web app and enable notifications there.
- **Windows desktop app:** install the NSIS build (`npm run dist:win` in `client`).
  Native alerts work while the app runs, including when minimized. Closing the desktop
  app exits it; use the installed web app for background push when the desktop app is closed.
  Windows notifications and Focus Assist / Do Not Disturb can suppress banners.
- **Local office network over HTTP:** the web notification UI explains the HTTPS requirement;
  in-app notifications still work. Native Windows notifications work without browser HTTPS.

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

## Verification result

- Web build and Windows NSIS installer build: PASS.
- JavaScript syntax and scoped diff whitespace checks: PASS.
- Automated tests: 12 notification checks, 69 permissions checks and 10 regression checks passed.
- Type checking / lint: no configured scripts in this JavaScript project.
- Security review: staff ownership enforced, internal push destinations rejected,
  private VAPID key excluded from API responses, inactive accounts excluded from delivery.
- Coverage percentage and physical-device banner delivery: not measured.
