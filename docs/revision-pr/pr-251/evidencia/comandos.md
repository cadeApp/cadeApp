# Evidencia y comandos — PR #251

## Ronda 2

SHA funcional revalidado: `79c6985e8c9717cf00f28c1baa6e7e4fbd38e726`  
SHA de cierre: `604d028b5573aa6addf7514e20eb5d7b6686a030`

`604d028` solo agrega bitácora; no toca el spec.

### Sincronización
`develop...rama`: 6 ahead / 3 behind.

### CI funcional
Run `37350422473`:
- lint ✅
- typecheck ✅
- unit ✅
- db-tests ✅
- audit ✅
- build ✅
- bundle-budget ✅

Unit:
```text
Test Files 119 passed (119)
Tests 1899 passed (1899)
tools/verify-fichas.test.ts: 7 passed
```

### Preview T-313
Run `37350595553`, job `111900261949`:

```text
3 failed
T-313 Alta completa...
T-313 Un courier no entra a (merchant)
T-313 Sin consentimiento guardado...
```

Alta:
```text
merchant-registration.spec.ts:145
Expected alert count 0
Received 2
```
El snapshot muestra error de registro y luego rate-limit.

Courier:
```text
Expected /\/courier\/feed/
Received .../merchant/onboarding
```

Sin consentimiento:
```text
Expected /\/login\?consentRequired=1/
Received .../merchant/onboarding
```

### Causa de guards
La rama no contiene todavía los 3 commits nuevos de develop; T-336 está entre ellos y mueve el entrypoint a `src/middleware.ts`.

### D02-A
Baseline GREEN primero.

Probe temporal:
`src/features/auth/guards.ts` → `evaluateRouteGuard` → merchant route guard.

Reemplazar temporalmente la redirección del actor no merchant por:
```ts
return { action: 'allow' };
```

No tocar el spec.

Después del RED:
```bash
git revert --no-edit <sha-probe>
git push
```

y exigir GREEN final.
