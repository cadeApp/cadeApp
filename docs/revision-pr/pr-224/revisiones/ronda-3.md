# Informe de revisión — PR #224 / T-308 — Ronda 3

**SHA revisado:** `cc3813f05d110c9248f5186decf0fe941f39880a`  
**develop:** `59d9d1783a936c9c7d5331cc5b2c07b4ed7d05b3`  
**Sincronización:** behind=0  
**Fecha:** 2026-10-04

## Resultado

**CON 3 BLOQUEANTES DE VERIFICACIÓN: H03, H04 y H05.**

No apareció un hallazgo funcional nuevo.

No hay decisiones 🔵 para P1 en esta ronda.

---

## Sincronización y alcance

El autor trajo la revisión R2 y luego hizo merge de develop:

```text
d4c7a665 Merge remote-tracking branch 'origin/develop' into feat/T-308-incidents-e2e
```

Después hizo:

```text
72f95c8 fix(incidents): fix selectors for report dialog and inbox [T-308]
cc3813f docs(tasks): update bitacora T-308 for round 2 fixes and vercel status [T-308]
```

Comparado con el commit de revisión R2, los cambios manuales propios de T-308 siguen limitados a:

```text
e2e/specs/incidents.spec.ts
docs/tasks/log/T-308.md
```

`docs/revision-pr/pr-224/**` no fue modificado por el autor.

---

## H05 — ARREGLADO-SIN-VERIFICAR

Los cuatro selectors pedidos en R2 fueron corregidos:

```text
/problema con el cobro/i
/¿qué pasó\?/i
/recibimos tu reporte/i
/problema con el cobro/i
```

También se alineó el texto de la descripción E2E a «cobro».

Por inspección coinciden con `src/features/incidents/copy.ts` y no se tocó el copy productivo.

No puede pasar a `arreglado-verificado`: desde `72f95c8` Vercel rechaza el deployment antes de que exista Preview y, por lo tanto, el spec corregido nunca corrió.

---

## H03 — ARREGLADO-SIN-VERIFICAR

El flujo sigue sin usar `LoginPage.login()`; completa usuario/contraseña manualmente, espera `/login/mfa`, genera TOTP, verifica y espera una ruta `/admin`.

La rama ya contiene T-334 y sus cambios de auth/guards. El CI ejecuta los tests de auth/guards y no apareció una regresión propia de T-308.

Eso elimina la objeción estática de R1, pero no reemplaza el requisito de ejecutar el camino browser completo. El último E2E real de DoD 1 se detuvo antes de MFA.

**Sigue bloqueante hasta que un gate real alcance MFA y la bandeja admin.**

---

## H04 — PARCIAL

La bitácora R3 mejora respecto de R2: ya no inventa RED ni GREEN. Registra explícitamente:

- que las sondas M1–M4 no pudieron ejecutarse;
- que el motivo es el límite de despliegues de Vercel;
- qué mutación queda preparada para cada test;
- que DoD 2/3/4 ya habían pasado en gates anteriores.

Esto es correcto documentalmente, pero no satisface todavía el DoD de prueba de mutación.

### Bloqueo externo confirmado

El bot de Vercel publicó en la PR:

```text
Deployment failed
Resource is limited - try again in 24 hours
(more than 100, code: "api-deployments-free-per-day")
```

Los commits `72f95c8` y `cc3813f0` tienen status Vercel failure por ese rate limit y no recibieron `e2e-preview`.

El workflow confiable no puede ejecutarse sin evento de deployment porque resuelve URL y SHA desde `repository_dispatch vercel.deployment.ready/success`.

No corresponde inventar resultados ni degradar el gate.

---

## CI

Sobre `cc3813f0`:

```text
audit           success
lint            success
typecheck       success
build           success
bundle-budget   success
unit            failure
db-tests        in_progress al corte
```

El único fallo de unit es:

```text
tools/verify-fichas.test.ts
Desincronizadas: T-336
1834 passed / 1 failed
```

T-336 viene del mismo `develop` actual y está fuera de los archivos de T-308. No genera hallazgo contra esta PR.

---

## Qué falta

No hace falta otra modificación funcional ahora.

Cuando Vercel vuelva a aceptar deployments:

1. obtener Preview del árbol final;
2. ejecutar M1, M2, M3 y M4 con commit temporal + run RED + revert normal;
3. restaurar el árbol final;
4. obtener `e2e-preview: success`;
5. comprobar DoD 1 completo, incluyendo MFA y bandeja admin;
6. actualizar la bitácora con SHA/run reales;
7. volver a Ronda 4.

**NO MERGEAR hasta completar esas ejecuciones.**
