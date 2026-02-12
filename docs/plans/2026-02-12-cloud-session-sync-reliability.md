# Cloud Session Sync Reliability Plan

> **For Codex:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make cloud extraction reliably reuse a valid SCE session by aligning automation with the real SSO path and blocking runs when session access is not valid.

**Architecture:** Keep the existing login-bridge/session model, but harden browser automation in `PlaywrightSCEAutomationClient`, add run-start preflight validation in cloud routes, and improve webapp run UX to validate before execution.

**Tech Stack:** Express + Prisma + Vitest, React + TypeScript, Playwright automation

---

## Task 1: Align SSO Bridge With Real Customer-Search Entry

**Files:**
- Modify: `packages/cloud-server/src/lib/sce-automation/playwright-client.ts`
- Test: `packages/cloud-server/tests/cloud-extraction-runs.contract.test.ts`

**Steps:**
1. Update SSO bridge URL generation to redirect to the target customer-search path (not generic `/onsite`).
2. Strengthen customer-search readiness checks when automation lands on `/onsite*` by retrying navigation and waiting for actual form fields.
3. Keep failure messages actionable but avoid false "no access" on slow page transitions.

**Verification:**
- `npm run test --workspace=packages/cloud-server -- tests/cloud-extraction-runs.contract.test.ts`

---

## Task 2: Add Session Preflight Validation On Run Start

**Files:**
- Modify: `packages/cloud-server/src/routes/cloud-extraction.ts`
- Test: `packages/cloud-server/tests/cloud-extraction-runs.contract.test.ts`

**Steps:**
1. Before changing run status to `RUNNING`, validate session state (active, not expired, customer-search accessible).
2. If invalid, return a `400` with clear remediation message and do not start the run.
3. Reuse the same validator/error semantics used by `/sessions/:id/validate`.

**Verification:**
- `npm run test --workspace=packages/cloud-server -- tests/cloud-extraction-runs.contract.test.ts`

---

## Task 3: Auto-Validate In Webapp Before Starting Cloud Extraction

**Files:**
- Modify: `packages/webapp/src/components/CloudExtractionPanel.tsx`
- Test/Build: `packages/webapp`

**Steps:**
1. In `handleRun`, validate selected session first.
2. If validation fails, surface the exact message and stop before creating a run.
3. Preserve explicit "Validate Session" action, but make run start safer by default.

**Verification:**
- `npm run build --workspace=packages/webapp`

---

## Task 4: Update Operator Runbook For Reliable Session Flow

**Files:**
- Modify: `docs/RUNBOOK.md`
- Modify: `docs/RENDER_DEPLOYMENT.md` (if env notes need sync)

**Steps:**
1. Document the validated sequence: Trade Ally login → SSO bridge → customer-search verification.
2. Document run-start preflight behavior and expected error states.
3. Add quick troubleshooting checklist for "landed on `/onsite`" and session-expired cases.

**Verification:**
- Manual doc review (`rg` spot checks for updated guidance)

---

## Task 5: Full Verification Sweep

**Verification Commands:**
1. `npm run test --workspace=packages/cloud-server -- tests/cloud-extraction-runs.contract.test.ts`
2. `npm run test --workspace=packages/cloud-server -- tests/cloud-extraction-worker.unit.test.ts`
3. `npm run test --workspace=packages/cloud-server -- tests/queue-addresses.contract.test.ts`
4. `npm run build --workspace=packages/webapp`

