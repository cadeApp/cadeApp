# PR #459 — T-382 · Errores claros al activar avisos y estado real en Configurar

| Campo | Valor |
|---|---|
| PR | https://github.com/cadeApp/cadeApp/pull/459 |
| Tarea | T-382 / issue #444 · fase 3 |
| Autor | @Lautaro073 |
| Rama | `feat/T-382-push-errors-status` → `develop` |
| SHA funcional revisado | `f8f2fc2501aad66a2bfd5ea52913f1d5195b2e5e` |
| Base | `develop@04f11839c659e67dbf32e8a80fa5da37819ce8d0` (merge integrada) |
| Diff | 21 archivos en la PR frente a develop, todos permitidos |
| Ronda 1 | **CON BLOQUEANTES (3)** · decisiones 1-C / 2-B confirmadas por Lautaro073 |

## Rondas

| Ronda | SHA examinado | Hallazgos | Informe |
|---|---|---|---|
| 1 | `1b24455f37b845b6b1e53ba672b459b62853ae06` | 3 abiertos en R1 | [ronda-1.md](revisiones/ronda-1.md) |
| 2 | `dc5f78cbf3ea7ec92f8b2a06464cac885d73389e` | H01/H02 arreglado-sin-verificar; H03 parcial, H04 nuevo | [ronda-2.md](revisiones/ronda-2.md) |
| 3 | `0c534f8cccaca9c281a3b29b71c2cde349ee0d0d` | H01/H02/H04 arreglado-sin-verificar; H03 parcial, H05 nuevo | [ronda-3.md](revisiones/ronda-3.md) |
| 4 | `da930eff32283c09d81b33c7f13c88451dd569a3` | H01–H04 arreglado-sin-verificar; H05 parcial, H06 nuevo | [ronda-4.md](revisiones/ronda-4.md) |
| 5 | `f8f2fc2501aad66a2bfd5ea52913f1d5195b2e5e` | Sin bloqueantes por inspección; H01–H06 arreglado-sin-verificar | [ronda-5.md](revisiones/ronda-5.md) |

Datos estructurados: [hallazgos.jsonl](hallazgos.jsonl) · [evidencia/comandos.md](evidencia/comandos.md) · [lecciones.md](lecciones.md).

## Estado ronda 5

**SIN BLOQUEANTES FUNCIONALES DETECTADOS POR INSPECCIÓN.** H01–H06 corregidos según el código y tests observados, pero sin reproducción Vitest/Playwright del revisor. **Merge NO autorizado hasta gate final:** `audit` rojo, `approval-policy` anterior al cierre rojo, `unit`/`db-tests` y `e2e-preview` no certificados GREEN al consultar. Decisiones técnicas nuevas: ninguna.

## Estado ronda 4

**CON BLOQUEANTES (2)**: H05 parcial (cambio de sesión mientras corre DELETE) y H06 nuevo (sin identidad se pierde la recuperación de baja fallida). 0 decisiones nuevas. develop ya integrado. CI audit rojo requiere resolución antes del merge final.

## Estado ronda 3

**CON BLOQUEANTES (2):** H03 residual (regex amplia en name) y H05 nuevo (baja pendiente compartida entre cuentas). **No hay decisiones abiertas.** develop avanzó 15 commits; integrar con merge antes del gate final, no rebase.

## Estado ronda 2

**CON BLOQUEANTES (2)**: H03 residual (nombre de error no sanitizado); H04 nuevo (sin soporte push se pierde reintento de baja pendiente). Decisiones nuevas: ninguna. No mergear.

## Pendiente para el autor

1. `git pull` de esta rama antes de corregir; **nunca rebase, force ni amend**.
2. Sin nuevas correcciones de T-382 por la inspección R5. Completar gate final (`e2e-preview`, `audit`, unit, db-tests y `approval-policy`) y registrar sus resultados por SHA; escalar cualquier fallo genuino, sin adulterar tests ni workflows.
3. Actualizar solamente la bitácora del autor; no modificar `docs/revision-pr/**`.
4. No hacer otro push funcional si no hay correcciones; completar gate final y solicitar verificación de checks. E2E de rondas: Playwright local contra Preview de la rama + Supabase Develop, `--workers=1`, `CI=true`, proyectos Chromium y global-settings. El job `e2e-preview` oficial se reserva para el último push funcional sin bloqueantes.
5. Condición de merge: revisión independiente sin bloqueantes y checks del SHA final, incluido `e2e-preview`; **no** exigir otro CI verde por un commit puramente documental de revisión.

**No se aprobó ni mergeó.** Ronda 5 sin bloqueantes funcionales detectados por inspección, pero sin CI final verde ni ejecución funcional independiente; H01–H06 no se marcaron `arreglado-verificado`.
