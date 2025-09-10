# NEXT — Handoff for the Next Cursor Run

**Branch:** chore/ai-loop-check  
**PR:** https://github.com/bc141/gamdit/pull/1  
**Preview URL:** http://localhost:3001 (local dev)

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
- Tests: Database testing complete, core functionality verified ✅
- AI review: Bugbot successfully caught pg_trgm schema bug and fixed it
- DB: Clean database setup with consolidated migrations ✅
- Security: RLS enabled, proper policies, no schema errors ✅
- Performance: Essential indexes created, optimized queries ✅
- App: Environment variables configured, application running on port 3001 ✅
- CI: NEXT guard workflow created and tested ✅

## Recent Changes Log
- 2025-09-10: Database upgrade testing completed successfully
- 2025-09-10: Removed old migration files, consolidated into clean setup
- 2025-09-10: Fixed environment variable configuration for local development
- 2025-09-10: Verified RLS policies and database security hardening
- 2025-09-10: Application integration tested and working

## Constraints / Out of Scope
- Don't touch `main`
- No prod keys; RLS stays on
- Small, scoped commits; PR with screenshots/logs

## Next Steps
1) ✅ Database upgrade testing completed successfully
2) ✅ CI guard workflow tested and working
3) Ready for production deployment or feature development

## Open Questions / Decisions Needed
- Should we add more handoff fields to NEXT.md?
- Do we need additional CI checks beyond UNFILLED detection?

Use "UNFILLED" literally; CI will fail if these placeholders remain on a PR.
