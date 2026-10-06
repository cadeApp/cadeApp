# Evidencia y comandos — PR #251

## Ronda 5 — SHA `1b23706d743664851fe7bf44e7a4c81d67577e55`

### Diff desde ronda 4
Solo:
- `e2e/specs/merchant-registration.spec.ts`
- `docs/tasks/log/T-313.md`
- body de PR

### CI
Run `37375915213`: GREEN.

### e2e-preview
Run `37376151360`:
- `resolve-preview`: success
- `e2e-preview`: cancelled antes de ejecutar pasos
- `report-preview-status`: publica `error` al SHA
- Resultado funcional: ninguno

### H05
Implementación:
```text
perPage = 50
maxPages = 5
for page 1..5:
  listUsers(...)
  exact email match
  track user if found
return null
```
Se llama inmediatamente después de `click()`, antes de asserts.

Residual:
- una sola observación temporal;
- máximo 250 usuarios;
- si retorna null, no hay reconciliación posterior en finally/teardown.

### H06
La aserción `role === merchant` está presente.
La bitácora declara mutación temporal a courier, pero la corrida murió en `E2E Fail-Closed` antes de llegar a la aserción.
No cuenta como RED de H06.

### H07
Chequeo determinista sobre toda la bitácora:
```text
categorical_unqualified = []
PASS
```

### H08
Chequeo determinista del body:
```text
Qué cambia                 present
DoD                        present
Evidencia de checks        present
Informe revisión agy       present
Rutas de otra zona         present
Dependencias nuevas        present
Rollback                   present
checkbox RED               present
checkbox bitácora          present
PASS
```
`approval-policy` `37375911376`: GREEN.

### Sincronización
`develop...rama`: 16 ahead / 4 behind.
Los 4 commits faltantes agregan contratos/skills/fichas T-338–T-341; no cambian runtime T-313.

### P3
No hay visto bueno explícito P3 registrado sobre el spec.
La aprobación de Lautaro073 existe y satisface approval-policy, pero es un requisito distinto.
