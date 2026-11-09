## What and why

<!-- Short description. Link the issue if there is one. -->

## Checklist

- [ ] `npm run typecheck`, `npm test` and `npm run test:e2e` pass
- [ ] `cargo fmt --check`, `cargo clippy --all-targets -- -D warnings` and `cargo test` pass (if Rust changed)
- [ ] No network access, telemetry or new permissions added (or this PR explains exactly why)
- [ ] Missing data stays `Unavailable`, never zero or a guess
- [ ] New user-facing text uses the i18n catalog (`src/i18n/en.ts`), and layouts use logical (start/end) classes
- [ ] Tests added or updated; new UI passes the axe audit
- [ ] Docs / CHANGELOG updated if behaviour changed
