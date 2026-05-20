# Project Bootstrap — Superpowers & Docs Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans or subagent-driven-development per task.

**Goal:** Establish Superpowers governance, restore project README, wire verification npm scripts, run checks, commit docs as first atomic change.

**Architecture:** Documentation-only bootstrap; no runtime refactor in this plan.

**Tech Stack:** Node 22, Express, Jest, existing smoke scripts.

---

### Task 1: Governance docs

**Files:**
- Create: `AGENTS.md`
- Create: `docs/DEVELOPMENT_WORKFLOW.md`
- Create: `docs/superpowers/specs/2026-05-20-superpowers-workflow-design.md`
- Create: `docs/superpowers/plans/2026-05-20-project-bootstrap.md`

- [x] Write design spec
- [x] Write this plan
- [ ] Add AGENTS.md + DEVELOPMENT_WORKFLOW.md

### Task 2: README & verify scripts

**Files:**
- Create: `README.md`
- Modify: `package.json` (scripts verify:*)

- [ ] Restore README with 功能/部署/开发/验证
- [ ] Add `verify:agent`, `verify:evolution`, `verify:all`

### Task 3: Verification (evidence)

- [ ] `npm run test:unit`
- [ ] `node server/scripts/evolutionVerify.mjs`
- [ ] `node server/scripts/agentSmokeTest.mjs`

### Task 4: Git commit (docs only)

- [ ] `git add` docs + AGENTS.md + README.md + package.json scripts
- [ ] Commit: `docs: establish superpowers workflow and project readme`

---

## 后续计划（不在本 plan 范围）

- `feat(admin): AI floating agent` — adminAgent + routes + AdminAIFab
- `refactor(server): production app layout` — createApp + registerRoutes split
- `docs: AI evolution operator guide` — 已有 `docs/AI_EVOLUTION.md`
