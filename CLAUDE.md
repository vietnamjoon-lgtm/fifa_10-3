# Project Touchline

Read README.md and COLLABORATION.md before making changes. Keep the task limited to the assigned issue and report cross-owner file changes in the PR.

This is an ES module JavaScript game with vendored Three.js and Cannon-es. The browser and Cloudflare server share simulation code. Run `node --test --experimental-test-isolation=none tests/*.test.mjs` and `node tools/build-web.mjs` before submitting gameplay changes.

Preserve legacy player saves, online profile sanitization and both team directions. Use fictional test assets and a separate browser origin for UI tests; never clear the user's saved players or photographs. Record measured results and limitations. Submit a branch/PR; production deployment is handled by the integration owner.
