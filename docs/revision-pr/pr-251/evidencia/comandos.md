# Evidencia y comandos — PR #251

## Ronda 6 — SHA `bce333fede77737a66d3afae8b43a19ce6dc8747`

### Alcance
Diff actual contra `develop`:
- `e2e/specs/merchant-registration.spec.ts`
- `docs/tasks/log/T-313.md`
- `docs/revision-pr/pr-251/**`

La ficha T-313 no fue ampliada.

### H05
Símbolos verificados:
```text
LocalRegistrationContext.pendingCleanupEmails
registrationContext.pendingCleanupEmails.add(email)  # antes del click
fixture finally -> listUsers(page, perPage)
match exacto u.email === targetEmail
while hasta !data.nextPage
trackEntityForCleanup(...)
cleanupStagingData(context)
```

### H06 RED
Run `37425374360`, job `112148952569`:
```text
Expected: "merchant"
Received: "courier"
at merchant-registration.spec.ts:306:33
34 passed
2 failed
```
El otro fallo fue H04/alta UI.

### H06 revert
Run `37428952648`, job `112162454301`:
```text
DoD: Sin consentimiento guardado el comercio no llega al panel  GREEN
35 passed
1 failed
```
Único fallo: H04/alta UI.

### HEAD actual
Run `37433304282`, job `112169072675`:
```text
DoD courier                               GREEN
DoD sin consentimiento                   GREEN
DoD alta completa                        RED
35 passed
1 failed
```
Fallo:
```text
line 184
getByRole('alert')
Expected: 0
Received: 2
```

### CI
Run `37433113069`:
- unit: 121 files / 1921 tests passed
- db-tests: Files=18, Tests=1811, Result: PASS
- typecheck: success
- lint: ESLint 0 warnings/errors
- build: success
- bundle-budget: success
- audit: success

### Sincronización
`develop...rama`: 22 ahead / 33 behind.

Desde `80f0b56` hasta develop actual, los 33 commits solo cambian T-308/incidents y documentación; no tocan auth ni merchant-registration.

### Approval / P3
- approval-policy `37433110341`: GREEN
- Lautaro073: APPROVED
- P3: sin visto bueno explícito registrado
