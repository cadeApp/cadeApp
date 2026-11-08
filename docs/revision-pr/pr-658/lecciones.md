# Lecciones — PR #658, ronda 1

**Fuente:** seis hallazgos por inspección de `3a396ee1`, contrastados con RED/GREEN/CI. Sin lecciones AG nuevas numeradas: se refuerzan reglas existentes y se evita atribuir numeración sin enumerar todas las ramas remotas.

## Refuerzo AG-37 — enumerar la clase y demostrar el invariante que realmente se protege

Los casos 13–16 de `cc047_admin_hardening.sql` ya pasaban sin migración: el trigger de T-340 rechazaba escrituras ajenas. No acusar el estado final como defecto funcional; el defecto es de cobertura del control RLS. Cuando hay controles superpuestos (policy y trigger), agregar un test de **catálogo** (`pg_policies`, `cmd <> 'SELECT'`, expresión que referencia `app_private.is_admin()`) con mutación de la policy, sin adulterar el trigger ni la prueba funcional.

## Refuerzo AG-75 — las mutaciones del autor no certifican cobertura independiente

La PR #659 probó seis mutaciones relevantes. No mutó `FOR UPDATE` ni un borrado pre-fixture. No reconstruir sus 18 fallos como propios. Proponer una carrera admin/admin que lea `audit_log.before` tras serialización, más inspección de código fuente de la migración. Las pruebas estáticas propias son evidencia **estática**, no de base.

## Refuerzo P06 y AG-37 — combinaciones de requisitos no equivalen a un solo `AND`

D3 exige actor, nivel de MFA y columna separados. Consolidarlos en una sola aserción puede perder señal diagnóstica o saltarse una combinación. En SEC-11, nota igual, distinta y reescrita son tres historias distintas, no sinónimos.

## Decisiones y no-falsos-positivos

- D01=B es una mejora de minimización de datos: denegar `rate_limits` a clientes incluso al admin con `aal2`, manteniendo al menos una policy para `rls_enabled.sql`.
- D02=A valida las adaptaciones de `cc043` y scripts `cc025`/`cc033` porque las antiguas expectativas dependían de la policy de escritura eliminada.
- Los triggers de T-340 siguen siendo defensa real: no pedir una mutación que los desactive para fabricar rojo en `cc047`.
- No pedir un pgTAP imposible sobre datos anteriores a la migración. La consulta y la revisión manual de notas históricas siguen siendo obligaciones de promoción humana.
- No convertir el `e2e-preview` bloqueado por migración, según runbook, en falso error de código. Registrar el E2E de staging pendiente.

**No cambiar AGENTS.md solo por esta PR.** La ronda 2 deberá contrastar los controles nuevos con mutaciones propias que intenten escapar de cada control.