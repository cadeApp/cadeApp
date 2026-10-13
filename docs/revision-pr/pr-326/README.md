# Revisión independiente — PR #326 / T-340 Paso 3

- **PR:** https://github.com/cadeApp/cadeApp/pull/326
- **Rama:** `feat/T-340-limpieza-legacy`
- **Base:** `develop` SHA `4eefd119b19792e179e46b1243d07ab957137649`
- **HEAD auditado:** `7866da28973da6b45746ff000c11cef3d8cbb772`
- **Ronda:** [Ronda 1](revisiones/ronda-1.md) (2026-10-13)
- **Resultado:** **CON BLOQUEANTES (1 técnico H03 + 1 decisión pendiente A01)**. H01/H02 corregidos por inspección + CI, pero pendientes de mutación independiente; H03 parcial.
- **Archivos de evidencia:** [hallazgos.jsonl](hallazgos.jsonl), [evidencia/comandos.md](evidencia/comandos.md), [lecciones.md](lecciones.md).
- **Decisión de Lautaro073:** **C: protección diferenciada**, autorizó a KiraK72 modificar exclusivamente SQL/migración/RPC en zona P1 bajo T-340 Paso 3 y conservar `src/server/e2e/staging-seed.test.ts` como archivo adicional de tests de alcance. No autoriza Paso 4 ni limpieza manual en Supabase remoto.
- **E2E:** `BLOCKED / REQUIRES DEVELOP MIGRATION` no es GREEN ni fallo funcional. Aplicar excepcionalidad de orden posmerge únicamente cuando el código esté seguro, con revisión y autorización humana explícita.
- **Independencia:** la revisión registra la evidencia que inspeccionó; no se ejecutó DB/Docker local, no se modificó código ni se aprobó/mergeó.

- **Ronda 2:** [Ronda 2](revisiones/ronda-2.md) (HEAD funcional `57b50977`, 2026-10-13). Cambio de SQL/test, no de negocio ni seguridad ajena.

- **Ronda 3:** [Ronda 3](revisiones/ronda-3.md) — HEAD funcional `23360faf`: nuevo pgTAP 136 aserciones pero db-tests FALLÓ en test #133 por expectativa distinta del fixture; mutantes H01/H02 aún NO corrieron. Desvío autorizado solo Paso 1 del runner → A01 requiere decisión.
