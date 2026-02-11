# Test Report: Mobile Route Pack From Deployments

Date: 2026-02-11  
Branch: `feat/mobile-route-pack-from-deployments`

## Scope

Validated mobile/deployed route planning + PDF generation flow, plus mobile-web shortcut to route-pack builder.

## Documentation Checklist (Before Update)

- Route/PDF-from-phone path documented: FAIL
- Extension-only boundaries documented: FAIL
- QR/mobile URL fallback documented: FAIL

## Verification Round 1 (Pre-Docs)

### Command
```bash
npm run test --workspace=packages/cloud-server -- tests/mobile-route-plan.contract.test.ts
```
Result: PASS (11 tests)

### Command
```bash
npm run test --workspace=packages/mobile-web
```
Result: PASS (3 tests across 2 files)

### Command
```bash
npm run build --workspace=packages/webapp
```
Result: PASS

## Verification Round 2 (Post-Docs)

### Command
```bash
npm run test --workspace=packages/cloud-server
```
Result: PASS

### Command
```bash
npm run test --workspace=packages/mobile-web
```
Result: PASS

### Command
```bash
npm run build --workspace=packages/webapp
```
Result: PASS

### Command
```bash
curl -sS https://sce2-cloud-server.onrender.com/api/health
```
Result: PASS (`{"success":true,"message":"SCE2 API is running",...}`)

## Final Gate Verification

### Command
```bash
npm run test --workspace=packages/cloud-server -- tests/mobile-route-plan.contract.test.ts tests/submit-requeue.contract.test.ts
```
Result: PASS

### Command
```bash
npm run test --workspace=packages/mobile-web
```
Result: PASS

### Command
```bash
npm run build --workspace=packages/webapp
```
Result: PASS

### Command
```bash
npm run build --workspace=packages/cloud-server
```
Result: PASS

## Notes

- `webapp` build reports an existing circular chunk warning (`leaflet-vendor -> react-vendor -> leaflet-vendor`) but build succeeds.
- Mobile route planning endpoint persists `orderedPropertyIdsJson` and returns ordered IDs for PDF generation.
- During verification, `cloud-server` build surfaced two TypeScript blockers (documents route validator import, route start-coordinate typing). Both were fixed and all verification commands now pass.
