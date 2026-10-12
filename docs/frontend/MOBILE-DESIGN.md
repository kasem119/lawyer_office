# Mobile clarity update

The mobile layout keeps the Arabic RTL interface, Cairo typeface, and existing gold/navy themes. The header separates search from the toolbar; quick actions use two columns; dashboard metrics use readable labels; recent cases and tasks precede charts on phones. Case records show the full title with labeled actions. The bottom navigation follows light/dark mode, and dialogs render above the application rather than inside a transformed page.

The mobile drawer always shows labels, including when the desktop sidebar was collapsed. It supports Escape, keyboard focus containment, and focus return. Resizing from a desktop table back to a phone restores card view.

Editable dashboard and case-list design references: [Muhami — Mobile clarity](https://www.figma.com/design/rzOce92N1nPmHyzMz7tmkB). These are editable text, vectors and component instances with Cairo text styles and source color variables; no complete-screen raster is embedded.

Validated locally on 2026-10-10 with mocked API data:

- Production build passed.
- Mobile smoke checks passed at 320, 390 and 768 pixels: header/card fit, 44px case actions, drawer navigation/Escape, upload dialog, and desktop/mobile resizing.
- No JavaScript runtime errors were observed in those flows.
- Bundle check passed: initial JavaScript remains approximately 210 kB; dashboard with dependencies is approximately 282 kB.

From `client`, run `npm run build`, `npm run test:mobile`, and `npm run test:bundle`. The mobile test uses the repository's existing server Puppeteer dependency and local sample data, and saves previews under the ignored `deploy/.server-review/mobile` directory. No production records are changed by the test.
