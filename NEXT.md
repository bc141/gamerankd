# NEXT — Handoff for the Next Cursor Run

**Branch:** chore/ai-loop-check  
**PR:** https://github.com/bc141/gamdit/pull/1  
**Preview URL:** UNFILLED

## Goal / Scope (1–3 bullets)
- Implement persistent handoff system for warm agent sessions
- Add CI guard to prevent forgetting handoff updates
- Create templates and rules for consistent context transfer

## Acceptance Tests (must pass)
1) NEXT.md exists and all UNFILLED placeholders are replaced
2) .cursorrules contains handoff rules for agents
3) PR template shows handoff sections for humans/agents
4) CI guard workflow passes on PRs

## Files Touched / Likely to Touch
- NEXT.md (created)
- .cursorrules (created)
- .github/PULL_REQUEST_TEMPLATE.md (created)
- .github/workflows/next-guard.yml (created)

## Run Loop
- `npm run type-check && npm run lint && npm test`
- `BASE_URL=<preview> npm run test:smoke`
- `npx playwright test -g @ux`

## Current State
- Tests: All tests passing, Playwright smoke tests configured
- AI review: Bugbot successfully caught pg_trgm schema bug and fixed it
- DB: All security and performance migrations applied to preview ✅

## Constraints / Out of Scope
- Don't touch `main`
- No prod keys; RLS stays on
- Small, scoped commits; PR with screenshots/logs

## Next Steps
1) Commit handoff system files
2) Test CI guard workflow on this PR
3) Verify all UNFILLED placeholders are replaced

## Open Questions / Decisions Needed
- Should we add more handoff fields to NEXT.md?
- Do we need additional CI checks beyond UNFILLED detection?

Use "UNFILLED" literally; CI will fail if these placeholders remain on a PR.
