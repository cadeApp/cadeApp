# Revisión PR #122 — T-205

> La revisión descartada original sigue fuera de vigencia. **Ronda 7** registra la decisión explícita de P1 sobre H03 y revisa CI final del HEAD actual.

- **PR:** #122 — `[T-205] Pasada de accesibilidad y rendimiento en las pantallas de comercio y repartidor`
- **Rama:** `feat/T-205-accesibilidad-rendimiento`
- **Base:** `develop@ae514947a467de4bd2f4e8deb96aff542a3e79c3`
- **HEAD revisado:** `014f82f2c0fbf5c418964f07ef8189b4a0d77d14`
- **Ronda vigente:** 7
- **Resultado:** **CON BLOQUEANTE (1)**
- **CI:** revisado porque H03 dejó de bloquear por decisión explícita de P1.

## Decisión P1 — H03

Lautaro073 eligió la opción B: la verificación que requiere entorno real se completa **post-merge en staging**.

La decisión está respaldada por el plan actual:

- **T-300 / #96:** checkpoint obligatorio `develop → staging`, migraciones, deployment y `/api/health`.
- **T-301:** arnés E2E en staging, bloqueado por T-300.
- **T-309 / #41:** E2E de accesibilidad en staging; su DoD incluye **axe AA en login, crear solicitud, lista del repartidor, viaje y onboarding**.

Lighthouse no está asignado expresamente en T-309, así que queda como residual explícito de H03 para ejecutarse en staging antes del release; no se afirma como verificado.

Estado de H03: **aceptado por decisión P1**, no `arreglado-verificado`.

## Estado vigente

- H01 — arreglado-sin-verificar.
- H02 — arreglado-sin-verificar.
- H03 — **aceptado**: runtime diferido a staging por decisión P1.
- H04 — arreglado-sin-verificar.
- R01 — arreglado-sin-verificar.
- R02 — arreglado-sin-verificar.
- R03 — arreglado-sin-verificar.
- R04–R07 anteriores — retirados por corrección del reviewer.
- **R08 — abierto y bloqueante:** CI unit falla por el harness versionado que entró a la rama debido a una instrucción incorrecta del reviewer.

Detalle: `revisiones/ronda-7.md`.
