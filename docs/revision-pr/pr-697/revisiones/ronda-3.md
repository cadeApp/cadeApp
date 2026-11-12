# Informe independiente — PR #697 / T-432 / CC-049 — Ronda 3

**Fecha:** 2026-11-12 · **SHA de contenido auditado:** `1052fbed3150c0589835c50b446791a4eaa3ab4f` · **Base:** `develop@9dafedab103cdfdd7eca0fa88cc38f2e319dc831`.  
**Resultado:** **CON BLOQUEANTES (1)**. La PR sigue siendo exclusivamente documental. No aprobar ni mergear.

## Revalidación

| ID | Estado | Evidencia sobre 1052fbed |
|---|---|---|
| **H01** | Cerrado documentalmente | Dos pruebas independientes de grants/RLS y sus mutaciones siguen definidas en CC-049 y T-432, sin retrocesos. |
| **H02** | **PARCIAL — ÚNICO BLOQUEANTE** | El test de **primera** aplicación sí está diseñado con reset anterior a CC-049, preseed E01/E08, `migration up`, RED de DELETE y reset final; **pero** su comparación ignora `created_at` y `last_seen_at`. |
| **H03** | Cerrado documentalmente | Deadline absoluto 5000 ms, `request.destroy()`, no seguir 3xx, goteo, limpieza de timer intactos. |
| **H04** | Cerrado documentalmente | Unión discriminada `sent/blocked` y ausencia real de `endpoint` en bloqueados intactas. |
| **H05** | **CORREGIDO Y VERIFICADO documentalmente** | `CC-049.md:210-236` define E01–E19 con 19 endpoints literales, expected fijo y réplica declarada en pgTAP/TS; 19/19 pasan con clasificador independiente, mutaciones de E09, E19, E14, E11, E12 dan rojo en el arnés. |
| **M02** | Aplicada | La bitácora atribuye D4-B y D5-C a la elección expresa de Lautaro073. |

## H02 residual — dos columnas históricas sin cobertura

**Archivo:** `docs/contracts/CC-049.md`, §Impacto exacto / “Preservación de filas históricas en la primera aplicación”, especialmente lista de campos en el punto 4; y `docs/tasks/T-432.md`, DoD `cc035_concurrency.mjs`.  
**Severidad:** alta por control incompleto de preservación. **Detección: ANÁLISIS + CONTRAEJEMPLO NODE, no SQL.**

**Qué ya está correcto:** reset local `--version 20261111120000 --no-seed` apunta a la migración realmente anterior (CC-048); seed E01 y E08 **antes** de la primera aplicación; `pnpm supabase migration up`; restauración de base; mutación aislada con DELETE. Esa corrección soluciona el agujero temporal de la ronda 2. La nota de hosts desconocidos también está reconciliada con D5-C.

**Qué falta:** el esquema real `supabase/migrations/20260922031435_schema_v1.sql:165-174` declara ocho columnas: `id, user_id, endpoint, p256dh, auth, platform, created_at, last_seen_at`. CC-049 exige comparar exactamente las primeras seis; excluye las dos temporales. Un cambio accidental de `last_seen_at` (que gobierna recencia) o de `created_at` durante la migración de seguridad no se detecta aunque se verifique la primera aplicación. El usuario pidió preservar datos históricos, no solo evitar DELETE.

**RED independiente:** `node /tmp/pr697_r3_h02.mjs` (código completo y salida en [evidencia](../evidencia/comandos.md)): cambiar solo `last_seen_at` o `created_at` deja la proyección de seis campos idéntica y el control en GREEN falso; comparar la fila integral produce RED. Esta sonda **no** ejecutó PostgreSQL y no equivale a una falla CI del repositorio.

**Arreglo mínimo (sin tocar implementación):**
1. Modificar en `CC-049.md` la enumeración del punto 4 para incluir **`created_at` y `last_seen_at`**. En `T-432.md` DoD exigir igualdad **de las ocho columnas** por `IS NOT DISTINCT FROM` o comparación estable de valores/JSON incluyendo los dos timestamps.
2. En el preseed del escenario describir timestamps deliberadamente distintos a `now()`, por ejemplo `created_at='2025-01-01T00:00:00Z'` y `last_seen_at='2025-02-01T00:00:00Z'`, para que la mutación no sea tautológica con el default de base y el tiempo fijo de transacción.
3. Además de la mutación DELETE ya exigida, documentar **mutación temporal RED-TIMESTAMP** en copia de migración: `UPDATE public.push_subscriptions SET last_seen_at = now();`, después de crear el helper/función y antes de la verificación, bajo la misma precondición de primera aplicación. Con ella la aserción sobre `last_seen_at` debe fallar; restaurar SQL original y comprobar GREEN. No ejecutar esa operación en ambientes reales.
4. Corregir bitácora con alcance de arreglo y pruebas **efectivamente** corridas. No llamar “RED ejecutado” a la mutación todavía hipotética para la PR futura.

No requiere decisión de producto ni ampliar archivos permitidos. La primera prueba propuesta se vuelve completa con una corrección mínima.

## H05 — verificación independiente de E01–E19

- 19 IDs consecutivos y únicos, 19 URLs únicas y resultados explícitos correctos frente a las reglas de host/puerto del contrato.
- Matriz: seis aceptados (FCM, Mozilla, Apple, WNS, uppercase, puerto 443) y trece rechazados (HTTP, host arbitrario, sufijo engañoso, userinfo, puerto distinto, barra invertida, punto final, percent-encoding, IPv6, sin slash, WNS 0/2 niveles y prefijo fraudulento).
- Cinco mutaciones **independientes del autor** dejan los casos afectados en rojo (E09/E19/E14/E11/E12). Véase arnés reproducible en evidencia.
- La fuente normativa es Markdown y los valores se copian explícitamente a pgTAP/TS, de modo que la expectativa no depende del validador bajo prueba. No se permite convertir esto en afirmación de que pgTAP o Vitest de T-432 ya se ejecutaron.

## Alcance, checks y falsos positivos

**Delta `cca35cf2..1052fbed`:** tres documentos del autor (CC, ficha, bitácora), ninguna migración ni TS, sin tocar revisiones previas. `docs/implementation-plan.md` sin cambio y el primer DoD coincide con su fila T-432. No aparece conflicto de CC-049 en `develop`; la PR figura `mergeable:true` (no equivale a un merge-tree local).

**CI realmente inspeccionado en GitHub**, corrida del SHA 1052fbed: build, typecheck, lint, audit, unit y bundle-budget `success`; unit con **202 Test Files / 3775 Tests passed**, según log del job. `db-tests` seguía `in_progress` en la consulta final. **No se corrió** localmente `pnpm exec vitest run tools` ni `test:db`/Docker ni E2E. El 123/123 es salida declarada por el autor. No atribuir CI de la futura implementación a esta ronda.

**No reportar como defectos:** ausencia de migración/TS (PR documental), H01/H03/H04 ya ajustados, E19 rechazado correctamente por no tener punto antes de `notify.windows.com`, ni decisiones D1–D5.

**Veredicto:** H02 parcial (un bloqueante de control), H05 cerrado documentalmente, M02 aplicada. No hay decisiones que preguntar. La corrección de la ficha y CC queda en manos de agy; prompt en el comentario de GitHub. Volver con SHA nuevo para ronda 4. No aprobar ni mergear.
