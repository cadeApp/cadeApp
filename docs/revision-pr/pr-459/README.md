# PR #459 — T-382 · Errores claros al activar avisos y estado real en Configurar

| Campo | Valor |
|---|---|
| PR | https://github.com/cadeApp/cadeApp/pull/459 |
| Tarea | T-382 / issue #444 · fase 3 |
| Autor | @Lautaro073 |
| Rama | `feat/T-382-push-errors-status` → `develop` |
| SHA funcional revisado | `1b24455f37b845b6b1e53ba672b459b62853ae06` |
| Base | `develop@cf2fbe13ab7ee8348b4805dadccef5416abb9265` |
| Diff | 14 archivos, +1100/-60, todos permitidos |
| Ronda 1 | **CON BLOQUEANTES (3)** · decisiones 1-C / 2-B confirmadas por Lautaro073 |

## Rondas

| Ronda | SHA examinado | Hallazgos | Informe |
|---|---|---|---|
| 1 | `1b24455f37b845b6b1e53ba672b459b62853ae06` | H01, H02, H03 abiertos | [ronda-1.md](revisiones/ronda-1.md) |

Datos estructurados: [hallazgos.jsonl](hallazgos.jsonl) · [evidencia/comandos.md](evidencia/comandos.md) · [lecciones.md](lecciones.md).

## Pendiente para el autor

1. `git pull` de esta rama antes de corregir; **nunca rebase, force ni amend**.
2. Corregir H01 (baja pendiente y reintento real, incluido remonte), H02 (fallas del navegador anteriores a `subscribe()`), H03 (diagnóstico sanitizado). Pruebas de comportamiento RED→GREEN y mutaciones nuevas para cada arreglo.
3. Actualizar solamente la bitácora del autor; no modificar `docs/revision-pr/**`.
4. Push y solicitar ronda 2. E2E de rondas: Playwright local contra Preview de la rama + Supabase Develop, `--workers=1`, `CI=true`, proyectos Chromium y global-settings. El job `e2e-preview` oficial se reserva para el último push funcional sin bloqueantes.
5. Condición de merge: revisión independiente sin bloqueantes y checks del SHA final, incluido `e2e-preview`; **no** exigir otro CI verde por un commit puramente documental de revisión.

**No se aprobó ni mergeó.** La PR continúa en Draft. Hallazgos detectados por **inspección y sondas estáticas**, no certificados por Vitest/Playwright del revisor.
