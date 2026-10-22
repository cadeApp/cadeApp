# Informe de revisión — PR #101 / CC-007 — Ronda 3

**SHA revisado:** `a99bbf4f40f6ca8f6ec08b122acccbdcbf9e6a51`  
**Fecha:** 2026-09-25  
**Resultado:** **SIN BLOQUEANTES PROPIOS DE CC-007 · BLOQUEO EXTERNO DE CI**

## Decisiones P1

### A04 / D09 — Ventana temporal de develop: ACEPTADA

P1 informa que:
- aún no existen cuentas reales;
- todo permanece en `develop`;
- nada fue promovido a `staging`.

Se acepta que, entre el merge de CC-007 y la integración posterior de T-311, `develop` pueda tener el gate activo sin un flujo de activación/regularización completo.

Condición operativa: **no promover/deployar develop a staging hasta que T-311 integre `activate_account_consents` y el flujo de regularización**.

### A05 / D10 — P1 aprueba sin P2: ACEPTADA

Lautaro073 declara explícitamente que no requiere aprobación de `@KiraK72` para CC-007 y asume la aprobación del cambio.

H07 se cierra por decisión P1. Esta excepción queda limitada a CC-007 y no se convierte en regla general.

## Hallazgos cerrados

### H02 — CERRADO
`app_private.request_cycle()` ahora obtiene `role, consent_status` y rechaza actores no admin distintos de `active`. El gate cubre centralmente las acciones del ciclo y pgTAP prueba pending/reconsent para merchant/courier y preservación admin.

### H03 — CERRADO
`activate_account_consents` tiene:
- `SECURITY DEFINER`;
- revoke a public/anon/authenticated;
- `GRANT EXECUTE ... TO service_role` explícito;
- tests de privilegios y ejecución efectiva como `service_role`.

### H06 — CERRADO
- `AuthSession.consentStatus` es obligatorio.
- `getServerSession` y `loginAction` seleccionan/validan `consent_status`.
- fixtures históricos fueron actualizados.
- `executeMutation` modifica fuente real, ejecuta una suite dirigida, exige exit != 0 y restaura en `finally`.
- el job unit confirma que las cuatro mutaciones de CC-007 pasan como pruebas de mutation-kill.

### H07 — CERRADO POR D10
No se requiere review P2 para este CC por decisión expresa de P1.

### H08 — CERRADO
`consents_insert_self` se elimina en la migración y pgTAP demuestra que authenticated recibe 42501 al intentar INSERT directo. La activación service-role sí persiste TOS+Privacy.

### H10 — CERRADO
`docs/implementation-plan.md` en la rama CC-007 es idéntico a `develop`. Los cambios ajenos de Ronda 2 fueron revertidos.

---

## H11 · 🔴 CI global rojo por deuda preexistente de develop

Run final inspeccionado: **36188410458**.

### Jobs

- `lint`: success — ESLint sin warnings/errors. Prettier reporta 52 archivos con formato pendiente, configurado como warning no bloqueante.
- `typecheck`: success.
- `build`: success — Next compila correctamente.
- `bundle-budget`: success — emite warning de presupuesto, no bloqueante por configuración actual.
- `audit`: success.
- `db-tests`: success — migraciones aplicadas, **Files=9, Tests=1472, Result: PASS**, tipos DB regenerados.
- `unit`: **failure**.

El único fallo del job unit es:

```text
tools/verify-fichas.test.ts
Desincronizadas: T-300, T-311
Test Files: 1 failed | 51 passed
Tests: 1 failed | 560 passed
```

### Prueba de que no lo introduce CC-007

`docs/implementation-plan.md` en:
- `cc/CC-007-consent-enforcement`
- `develop@7edcfe0`

es idéntico.

En develop:
- T-300 ficha comienza su DoD con: `develop está verde y se promueve mediante PR develop → staging...`
- la fila T-300 del plan todavía dice: `T-301 no se desbloquea hasta cerrar #96...`
- T-311 ficha comienza: `Pruebas en rojo antes de implementar...`
- la fila T-311 del plan todavía conserva el gate de abogado anterior.

Por eso `verify-fichas` ya tiene una inconsistencia latente en el base.

### Resolución

No volver a meter esos cambios en PR #101.

Crear un PR docs separado desde `develop` que sincronice las filas T-300/T-311 del plan con sus fichas canónicas. Para T-311, aprovechar para eliminar la redacción obsoleta de “contenido revisado por abogado” según la decisión ya mergeada en #99; no introducir cambios funcionales.

Después:
1. mergear ese PR docs a `develop`;
2. mergear `origin/develop` en `cc/CC-007-consent-enforcement` sin rebase;
3. rerun CI;
4. si todos los jobs quedan verdes, CC-007 queda apta para merge bajo el protocolo.

## Veredicto de Ronda 3

**Código/contrato de CC-007: sin bloqueantes propios.**

No se marca todavía como aprobable únicamente porque el protocolo exige CI final sin rojo y el run actual falla por H11 preexistente.

T-311 sigue bloqueada hasta el merge efectivo de CC-007.
