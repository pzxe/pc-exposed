# Accessibility

Target: WCAG 2.1 Level AA.

## Automated gates (run on every change)

- **axe-core** (`tests/e2e/quality.spec.ts`) audits all 10 screens and the Wrapped dialog
  against WCAG 2.0/2.1 A and AA: **0 violations required**. It also ran once against the real
  desktop app with real scan data.
- **Contrast** (`quality.test.tsx`) computes WCAG contrast ratios from the design tokens
  in `src/styles/index.css`: every text/background pair used must be ≥ 4.5:1.
- **Layout:** no horizontal overflow at 1000×680 (minimum), 1280×800 and 1920×1080.
- **Static guards:** every scrollable region must be keyboard-focusable.

## Implemented

- Skip link ("Skip to content") is the first Tab stop.
- On navigation, focus moves to the new screen's `<h1>` and the window title updates.
- `<main>` is keyboard-reachable and labelled; scrollable lists are focusable and labelled.
- Template/format selectors are WAI-ARIA radio groups (one tab stop; arrows, Home, End).
- PC Wrapped is a modal dialog: Tab is trapped, Escape closes, focus returns to the opener.
- Charts expose a text equivalent; the score ring is an image with a numeric label.
- Status and error messages use `role="status"` / `role="alert"`.
- Animations respect both the in-app setting and `prefers-reduced-motion`.
- Window controls have 24 px hit targets and text labels.
- Visible focus indicators on all interactive elements.

## Found and fixed by the audits

- Radar chart: focusable SVG inside an `aria-hidden` region → now one labelled image.
- Personality button: accessible name did not contain its visible text (voice control).
- Scrollable `<main>` and the Hardware startup list had no keyboard access.

## Not yet verified

- **Real screen-reader testing** (NVDA/Narrator) has not been done; automated tools find
  roughly a third of issues. Do this before a stable release.
- Windows **High Contrast** mode has not been tested.
- Share-card PNGs have no alt text (they are exports, not on-screen content).
- Zoom/DPI scaling beyond 100% has not been systematically tested.
