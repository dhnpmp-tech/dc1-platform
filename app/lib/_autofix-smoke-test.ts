// Deliberate-fail smoke test for the Claude Code Autofix feature
// (claude.ai → Settings → Claude Code → "Autofix pull requests").
//
// This file contains an intentional TypeScript error designed to fail
// the Next.js build CI gate. When Autofix is working, Claude (cloud-side,
// authed via Peter's Max subscription) should:
//   1. Notice the CI failure on this PR within ~minutes
//   2. Post a comment explaining what's wrong
//   3. Either propose a fix (commit + push) or ask Peter for direction
//
// If nothing happens within 10–15 min, the wiring isn't right and we
// need to revisit. Either way, delete this file before merging.
//
// Smoke set up by Claude (this terminal session) on 2026-05-10.

export const smokeTestValue: number = "this is a string, not a number";
