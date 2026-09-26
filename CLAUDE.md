# Project Touchline / fifa_10-3

Read README.md, COLLABORATION.md and the assigned collaboration/01-players.md through 05-ui-online.md before editing. The five work branches have distinct file owners listed in collaboration/ownership.json. Keep changes within the assigned part; coordinate cross-owner contracts before changing shared files. The map is a workflow convention, not access control.

Use the full checkout to run the game. Work on your assigned work/ branch, commit and push changed files, then submit a PR to main. Do not manually replace the whole project, force-push, delete another person's changes or deploy production. Person 05 integrates PRs; person 04 owns match.js and duel.js, person 05 owns main.js and shared HTML/CSS, person 01 owns player.js and squads.js.

This ES module JavaScript game vendors Three.js and Cannon-es. Browser and Cloudflare server share simulation code. Run node --test --experimental-test-isolation=none tests/*.test.mjs and node tools/build-web.mjs for gameplay changes. Baseline: 183 passing tests. Report measurements and limitations, not claims of FC-identical behavior.

Preserve legacy player saves, network sanitization, both team directions, physics-based pass flight and legacy assistance save keys. Use fictional face fixtures and a separate browser origin for UI tests. Never clear the user's saved players or photographs. Never commit credentials or user photo exports.
