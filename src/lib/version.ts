/**
 * The app version, injected at build time from package.json (see vite.config.ts `define`).
 * One source of truth: exported reports and the About panel can never drift from the release.
 */
declare const __APP_VERSION__: string;

export const APP_VERSION: string = typeof __APP_VERSION__ === "string" ? __APP_VERSION__ : "0.0.0-dev";
