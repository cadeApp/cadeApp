# Revisión independiente — PR #326 / T-340 Paso 3

- **PR:** https://github.com/cadeApp/cadeApp/pull/326
- **Rama:** `feat/T-340-limpieza-legacy`
- **Base:** `develop` SHA `4eefd119b19792e179e46b1243d07ab957137649`
- **HEAD auditado R4:** `384b2eb1d994efb17eeb7c51fc9a8f6ae898adc0`
- **Ronda más reciente:** [Ronda 4](revisiones/ronda-4.md) (2026-10-13)
- **Resultado R4:** **SIN BLOQUEANTES TÉCNICOS**. H01/H02/H03 arreglados y comprobados por inspección + ejecución de GitHub Actions; A01 aceptado por decisión del dueño.
- **Archivos de evidencia:** [hallazgos.jsonl](hallazgos.jsonl), [evidencia/comandos.md](evidencia/comandos.md), [lecciones.md](lecciones.md).
- **Decisión de Lautaro073:** **C: protección diferenciada**, autorizó a KiraK72 modificar exclusivamente SQL/migración/RPC en zona P1 bajo T-340 Paso 3 y conservar `src/server/e2e/staging-seed.test.ts` como archivo adicional de tests de alcance. No autoriza Paso 4 ni limpieza manual en Supabase remoto.
- **E2E:** `BLOCKED / REQUIRES DEVELOP MIGRATION` no es GREEN ni fallo funcional. Aplicar excepcionalidad de orden posmerge únicamente cuando el código esté seguro, con revisión y autorización humana explícita.
- **Independencia:** la revisión registra la evidencia que inspeccionó; no se ejecutó DB/Docker local, no se modificó código ni se aprobó/mergeó.

- **Ronda 2:** [Ronda 2](revisiones/ronda-2.md) (HEAD funcional `57b50977`, 2026-10-13). Cambio de SQL/test, no de negocio ni seguridad ajena.

- **Ronda 3:** [Ronda 3](revisiones/ronda-3.md) — HEAD funcional `23360faf`: nuevo pgTAP 136 aserciones pero db-tests FALLÓ en test #133 por expectativa distinta del fixture; mutantes H01/H02 aún NO corrieron. Desvío autorizado solo Paso 1 del runner → A01 requiere decisión.

- **Decisión posterior a R3 (2026-10-13):** Lautaro073 eligió la **opción A**; `PR326-A01` queda `aceptado` (autorización de alcance, **no verificación funcional**). La ficha T-340 registra que `t340_concurrency.mjs` se puede extender **solo** para mutaciones H01/H02 de Paso 3, sin nuevos workflows ni dependencias. Los hallazgos H01/H02 siguen `arreglado-sin-verificar` y H03 sigue abierto hasta `db-tests` GREEN y RED→GREEN real.

- **Cierre ronda 4:** [Informe](revisiones/ronda-4.md) · [evidencia](evidencia/comandos.md), CI [38479185315](https://github.com/cadeApp/cadeApp/actions/runs/38479185315) HEAD `384b2eb1d994efb17eeb7c51fc9a8f6ae898adc0` con 21 archivos/2039 pgTAP PASS, 2136 unit PASS, RED real H01/H02 (aserciones correctas) y restauración GREEN. **E2E: BLOCKED / REQUIRES DEVELOP MIGRATION**, pendiente de decisión de orden de rollout y checkpoint real posmerge (nunca llamarlo PASS). PR no aprobada ni mergeada.
