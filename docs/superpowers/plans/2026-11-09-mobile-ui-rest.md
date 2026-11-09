# Remaining mobile UI — implementation and validation

- [x] Extend the Phun Party palette, typography, outlined inputs/cards/buttons, bottom tabs and toast presentation across the app.
- [x] Redesign sign-in, signup, email verification and password recovery; preserve endpoints and validation rules, add pending-request guards and recovery feedback.
- [x] Redesign Friends, friend-code/QR discovery, requests and friend profiles.
- [x] Redesign Profile, settings, privacy/notification controls, edit/password dialogs and photo selection/viewing.
- [x] Redesign Buzzer and Beat the Clock without changing their gameplay/network/timer/fair-play blocks. Preserve immediate submission for Buzzer and explicit confirmation for Beat the Clock.
- [x] Verify and remove isolated preview routes from the production app.

Validation completed:
- TypeScript passes.
- Production Expo web export passes with 14 normal routes; preview routes excluded.
- Focused lint passes for auth, social, shared controls, theme and navigation. Existing gameplay lint findings unchanged (Buzzer 3 errors/6 warnings; Beat the Clock 1 error).
- Nine utility tests pass.
- Nine mocked auth behaviour groups passed, including duplicate-request protection and verification-token reuse protection.
- Seventeen headless scenario groups passed across join/trivia/results, auth/game modes and social/settings, with no runtime errors. Checks include 320px layouts, long answers, scrolling dialogs, selected states, QR enlargement, saved profile/privacy/notification actions and toast dismissal.
- Visual screenshots are retained in ignored .expo/ui-rest-review. Test fixtures use mocked services; no real account or game actions were sent.

Limits:
- Native device camera/keyboard/large-text rendering and live multiplayer remain unverified.
- Native light appearance configuration requires a rebuilt native app.
- Existing notification test actions remain placeholder alerts. Several notification preferences remain local-only; friend-request and privacy settings retain their existing service-backed persistence.
- The temporary app/ui-review.tsx and app/ui-rest-review.tsx routes were captured by an external commit during verification. They have been removed from the working tree and their deletions must be retained.