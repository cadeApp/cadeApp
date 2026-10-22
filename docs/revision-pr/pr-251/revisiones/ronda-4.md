# PR #251 · T-313 — Ronda 4

- **SHA revisado:** `c175443f2b7eb76f99a1185a4a1f28f0ea703808`
- **Fecha:** 2026-10-05
- **Resultado:** CON BLOQUEANTES (5)
- **Nuevos:** H05, H06, H07, H08
- **Decisiones nuevas:** ninguna

## Qué sí quedó bien

La rama está al día con `develop` (behind 0). T-337 ya está incorporada.

El trusted Preview `37365402672` vuelve a confirmar:
- ✅ courier no entra a `(merchant)`
- ✅ merchant sin consentimiento no llega al panel
- ❌ alta completa: falla en `merchant-registration.spec.ts:145`

Resumen del run:
```text
33 passed
1 failed
```

El artifact muestra:
- primer intento: mensaje genérico “No pudimos completar el registro con esos datos…”
- reintentos: “Hiciste muchos intentos seguidos…”

Eso demuestra fallo de registro + rate-limit posterior, **no demuestra por sí solo que SMTP sea la causa raíz**.

## H04 · sigue abierto

No hay baseline GREEN, por lo que D02-A sigue bloqueada.

## H05 · ALTO · cleanup incompleto

En el alta positiva:
1. click en “Crear cuenta” — línea 143;
2. dos aserciones UI — líneas 145-146;
3. recién después se resuelve el profile y se llama `trackEntityForCleanup` — líneas 149-150.

`cleanupStagingData` elimina usuarios desde `createdUserIds`; el `registrationContext` no define `merchantUser` ni otra identidad recuperable para descubrir ese usuario si el test cae antes de la línea 150.

Enumeración de creación de usuarios del spec:
- alta UI: **gap**
- createUser del caso sin consentimiento: track inmediato ✅
- courier: fixture compartido ✅

Si Auth llega a crear identidad/profile y luego falla una aserción UI, puede quedar basura E2E en Develop.

## H06 · MEDIO · falso positivo de precondición

El caso “Sin consentimiento guardado el comercio…” crea metadata `role: 'merchant'`, pero después solo afirma:
- `consent_status === 'pending'`
- consents vacíos
- redirección/bloqueo

Un profile erróneamente creado como courier pending también podría satisfacer esas aserciones. Falta:
```ts
expect(state.profile?.role).toBe('merchant');
```

## H07 · MEDIO · diagnóstico no demostrado

La bitácora afirma repetidamente “sin SMTP” / “falta de SMTP” como causa.

La evidencia disponible solo demuestra:
- error genérico de registro;
- luego rate-limit.

No aparece un error concreto de Auth que identifique SMTP. La causa debe escribirse como hipótesis hasta capturar evidencia concreta, sin credenciales ni emails.

Esta corrección también aplica a una afirmación que la propia revisión reforzó en rondas anteriores.

## H08 · MEDIO · body fuera de template

El template exige:
- “Qué cambia”
- DoD copiado
- Evidencia de checks
- checkbox de RED
- bitácora
- informe de revisión de agy
- rutas de otra zona
- dependencias
- rollback

El body actual usa otro formato y omite varias secciones obligatorias.

Patrón: `P19-cuerpo-de-pr-fuera-de-template`.

## CI / policy

El CI del SHA revisado no es evidencia final: run `37365268821` concluyó failure; lint y audit pasaron, mientras build/unit/typecheck/db-tests fueron cancelados.

`approval-policy` también falla porque requiere aprobación vigente de Lautaro073. Eso se resuelve al final, no durante esta ronda.

## P3

Sigue sin existir visto bueno explícito P3 sobre el spec.

## Veredicto

**CON BLOQUEANTES (5): H04, H05, H06, H07, H08.**

No apruebo ni mergeo.
