# Phun Party mobile UI — remaining screens

Extend the accepted mobile direction across all existing mobile routes: authentication and recovery, Friends, Profile, settings and profile/photo modals, Buzzer and Beat the Clock. Use Phun Party naming, cream backgrounds, Archivo Black display headings, ink outlines, lime actions and purple/pink/lavender accents.

Preserve account/API flows, privacy controls and destructive-action confirmations. Preserve game networking, fair-play enforcement, server timing, and mode-specific submission semantics. Buzzer answers submit on tap; Beat the Clock requires confirmation. No new endpoints, invented stats, timers or social content. Desktop remains a shared display and must never expose player selections.

Reuse the existing Expo stack and bundled assets. Migrate shared typography, fields, cards, buttons, tabs and toast surfaces. Keep camera overlays dark with appropriate status-bar contrast; use light surfaces and dark status-bar content elsewhere. Native appearance setting changes take effect with a rebuilt app.

Validate with TypeScript, focused lint compared with baseline, production web export, and isolated headless component interaction/layout checks. Test fixtures and sample data must be excluded from production routes. Live multiplayer and native device camera/keyboard behavior require separate device testing.