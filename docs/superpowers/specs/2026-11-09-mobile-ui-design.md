# Phun Party mobile UI

Implement the reviewed Figma mobile direction in the existing Expo app: lime joining hero, cream surfaces, purple trivia question panel, bordered answer cards, lime selection/submit actions and pink results celebration. Phun Party is the working title; Quiz Riot is placeholder copy. Desktop is shared and must never expose player selections; this change targets mobile only.

Preserve authentication, nine-character session codes, API/WebSocket calls, fair-play enforcement, timer semantics, reconnect/rejoin and all game-mode routing. Retain QR joining and add manual code entry using the same join path. Camera permission is requested only for scanning. The signed-in name is shown as identity rather than a nonfunctional nickname editor.

Implementation choices: use a scoped palette and bundled Archivo Black for display text, existing native system body fonts and Expo icons. Keep account/friends/profile themes independent for this first pass. Reuse presentation primitives; do not migrate frameworks or add UI dependencies.

Results must contain only validated server data. If no final scores are supplied, direct players to the shared screen. There is no verified rematch endpoint; provide a working join-another-game action instead of a fake ready button. Never invent a countdown, player list, score, room preview or connected status.

Support scrolling, small phones, large text, long answers, text-input questions, keyboard access and selected/submitted/waiting/error states. Validate with TypeScript, targeted lint, focused tests for data normalization and a production web bundle; visual preview must not access the user's screen.
