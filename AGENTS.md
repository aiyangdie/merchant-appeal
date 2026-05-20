# Agent Instructions — merchant-appeal

## Mandatory: Cursor Superpowers

All feature work, bugfixes, and refactors **must** follow Superpowers skills in order:

1. `using-superpowers` — check applicable skills first
2. `brainstorming` — new features / behavior changes (design approval before code)
3. `writing-plans` — save plan to `docs/superpowers/plans/YYYY-MM-DD-<name>.md`
4. `test-driven-development` — failing test → implement → pass
5. `executing-plans` or `subagent-driven-development` — staged delivery
6. `systematic-debugging` — any bug or test failure
7. `verification-before-completion` — run commands, cite output before claiming done
8. `requesting-code-review` / `receiving-code-review` — after each module
9. `finishing-a-development-branch` — merge/cleanup when feature complete

Use `using-git-worktrees` for large or risky features.

## Git commits

- **One logical change per commit** (feat / fix / docs / refactor / test)
- Message: Conventional Commits + short Chinese summary in body
- Flow: local verify → `git add` (scoped) → `commit` → `pull` → `push`
- Do not batch unrelated changes

## Verification commands

```bash
npm run test:unit
npm run verify:evolution
npm run verify:agent
npm run verify:all
```

## Key modules

| Area | Path |
|------|------|
| User chat AI | `server/ai.js` |
| AI evolution | `server/evolution.js`, `docs/AI_EVOLUTION.md` |
| Admin AI agent | `server/ai/adminAgent.js`, `src/components/admin/AdminAIFab.jsx` |
| Routes | `server/app/registerRoutes.js` |
| Admin UI | `src/pages/AdminPage.jsx` |

Full workflow: [docs/DEVELOPMENT_WORKFLOW.md](docs/DEVELOPMENT_WORKFLOW.md)
