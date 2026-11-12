# Informe revisar-pr — PR #697 / T-432 / CC-049 — Ronda 4

**Fecha:** 2026-11-12  
**Head auditado:** `afa9b40c9bd11b6e4039b53940aea25ed2a97c2e`  
**Base:** `develop@9dafedab103cdfdd7eca0fa88cc38f2e319dc831`  
**Resultado: SIN BLOQUEANTES DOCUMENTALES.** No se aprueba ni mergea.

## Revalidación independiente

| ID | Estado | Evidencia específica del SHA |
|---|---|---|
| PR697-H01 | Arreglado-verificado documentalmente | Dos barreras grants/RLS, controles separados por `has_table_privilege` y probe con grants temporales, mutaciones independientes; CC-049 y T-432 sin regresión. |
| PR697-H02 | **Arreglado-verificado en ronda 4** | CC-049 §Impacto exacto, paso 2: timestamps históricos `2025-01-01`/`2025-02-01`; paso 4: `id,user_id,endpoint,p256dh,auth,platform,created_at,last_seen_at` (8/8); dos mutaciones `RED-DELETE` y `RED-TIMESTAMP`; T-432 DoD y bitácora reconciliados. |
| PR697-H03 | Arreglado-verificado documentalmente | Deadline global 5000 ms, `request.destroy()`, no redirección 3xx y tests de stream goteando siguen exigidos. |
| PR697-H04 | Arreglado-verificado documentalmente | Unión `sent/blocked` con `Object.hasOwn` y ausencia de propiedad `endpoint` en bloqueados. |
| PR697-H05 | Arreglado-verificado documentalmente | Matriz canónica E01–E19 con 19 URLs concretas, resultados fijos y réplica explícita en pgTAP/TS; el oráculo de URL independiente de revisión coincide 19/19. |
| M02 | Aplicada | Bitácora atribuye correctamente D4-B/D5-C a elección explícita de Lautaro073. |

### H02 — Demostración de cierre

**Antes (ronda 3):** la prueba de primera aplicación ya estaba diseñada, pero comparaba solo seis campos de ocho; un cambio accidental de `created_at` o `last_seen_at` pasaba inadvertido.

**Ahora:** `docs/contracts/CC-049.md` contiene:
1. reset de base efímera a la migración anterior real `20261111120000`, preseed de E01/E08 **antes** de aplicar CC-049;
2. sentinels históricos explícitos `created_at='2025-01-01T00:00:00Z'` y `last_seen_at='2025-02-01T00:00:00Z'`;
3. `pnpm supabase migration up` y comparación integral de las ocho columnas (vía `IS NOT DISTINCT FROM` o `to_jsonb`);
4. mutación `RED-DELETE` que debe eliminar E08 en copia aislada y mutación `RED-TIMESTAMP` que debe sobrescribir `last_seen_at` para que la comparación falle; con migración sana, GREEN;
5. reset completo y restricciones para evitar contaminar modos de mutación de `cc035_concurrency.mjs`.

**Verificación propia:** sobre los textos reales de contrato, ficha, plan y esquema del SHA se ejecutó un verificador de invariantes. Resultado: GREEN del texto correcto; 3 mutaciones **en memoria** de la especificación (quitar timestamps del paso 4, quitar `RED-TIMESTAMP`, reemplazar el sentinel por `now()`) fueron detectadas como fallos. El script completo está en [evidencia](../evidencia/comandos.md). **No se ejecutó PostgreSQL, SQL CC-049, RED real de implementación ni Docker.**

### Alcance, contrato y checks

- Desde el commit de revisión `0745dfef`, el autor modificó únicamente `docs/contracts/CC-049.md`, `docs/tasks/T-432.md` y `docs/tasks/log/T-432.md`. No tocó `docs/revision-pr/pr-697/` ni amplió alcance.
- El primer DoD de T-432 sigue coincidiendo literalmente con su fila en `docs/implementation-plan.md`; 19 casos E01–E19 siguen únicos y con expectativas congruentes con las reglas de host.
- La migración CC-049 **aún no existe** en este PR. Es correcto: esta PR solo habilita el contrato. Las pruebas reales, mutaciones de SQL y transporte se exigen en la PR de implementación.
- No hay nuevas decisiones. D1-A, D2-A, D3, D4-B y D5-C mantienen su sentido.
- `develop` seguía en `9dafedab`; GitHub indicó `mergeable:true` (no sustituye `git merge-tree`).
- En la corrida del SHA `afa9b40c` se verificaron en GitHub typecheck/lint/build/audit/bundle-budget `success` y el log de `unit` con **202 archivos / 3775 tests passed**. `db-tests` todavía aparecía `in_progress` al registrar esta evidencia. El 123/123 de vitest tools figura en bitácora del autor y no se ejecutó por separado por el revisor. No se clonó repo: DNS de GitHub inaccesible en el contenedor; no se levantó Supabase ni Docker.

## Cierre y siguiente paso

**Resultado final de revisión documental: SIN BLOQUEANTES, SIN DECISIONES PENDIENTES.** No hay prompt correctivo para agy: no quedó ningún arreglo por aplicar **en esta PR**. La verificación de CI y el merge son acciones de Lautaro073 cuando corresponda; **el revisor no aprueba ni mergea**. El trabajo de implementación de SEC-07 continúa en otra PR tras el merge documental.

**Nota de trazabilidad:** la ronda 3 sí tiene informe en `revisiones/ronda-3.md`, commiteado en `0745dfef`, pero no se publicó su comentario separado por la interrupción. Este comentario de ronda 4 referencia ambas rondas, sin fingir que se publicó antes.
