# Cloud Extraction Test Report

Date: 2026-02-11  
Branch: `feat/cloud-extraction-without-extension`

## Documentation Coverage Checklist

- [x] `SCE_AUTOMATION_ENABLED` documented in operations/deploy docs
- [x] `SCE_SESSION_ENCRYPTION_KEY` documented in operations/deploy docs
- [x] Cloud extraction operator flow documented (session -> run -> monitor)
- [x] Extension fallback / rollback path documented

## Commands Used For Docs Verification

```bash
rg -n "SCE_AUTOMATION_ENABLED|SCE_SESSION_ENCRYPTION_KEY|cloud extraction|extension fallback" docs
```

## Verification Results

- `npm run test --workspace=packages/cloud-server -- tests/cloud-extraction-runs.contract.test.ts tests/cloud-extraction-worker.unit.test.ts tests/sce-automation-selectors.unit.test.ts`
  - PASS (3 files, 9 tests)
- `npx tsx packages/webapp/tests/cloud-extraction.integration.ts`
  - PASS
- `npm run build --workspace=packages/cloud-server`
  - PASS
- `npm run build --workspace=packages/webapp`
  - PASS (existing circular chunk warning remains)

## Rollout Guidance

1. Deploy with `SCE_AUTOMATION_ENABLED=false`.
2. Create one short-lived session and run cloud extraction for 2-3 properties.
3. Confirm status transition from `PENDING_SCRAPE` to `READY_FOR_FIELD` for successful rows.
4. If failures occur, keep failed items in `PENDING_SCRAPE` and retry after selector/session fixes.
5. If cloud runtime is unstable, disable flag and continue extension fallback flow.
