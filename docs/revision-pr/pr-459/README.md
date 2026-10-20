# PR #459 — T-382 · Errores claros al activar avisos y estado real en Configurar

| Campo | Valor |
|---|---|
| PR | https://github.com/cadeApp/cadeApp/pull/459 |
| Tarea | T-382 / issue #444 · fase 3 |
| Autor | @Lautaro073 |
| Rama | `feat/T-382-push-errors-status` → `develop` |
| SHA funcional revisado | `0c534f8cccaca9c281a3b29b71c2cde349ee0d0d` |
| Base | `develop@cf2fbe13ab7ee8348b4805dadccef5416abb9265` |
| Diff | 19 archivos en la PR, todos permitidos |
| Ronda 1 | **CON BLOQUEANTES (3)** · decisiones 1-C / 2-B confirmadas por Lautaro073 |

## Rondas

| Ronda | SHA examinado | Hallazgos | Informe |
|---|---|---|---|
| 1 | `1b24455f37b845b6b1e53ba672b459b62853ae06` | 3 abiertos en R1 | [ronda-1.md](revisiones/ronda-1.md) |
| 2 | `dc5f78cbf3ea7ec92f8b2a06464cac885d73389e` | H01/H02 arreglado-sin-verificar; H03 parcial, H04 nuevo | [ronda-2.md](revisiones/ronda-2.md) |
| 3 | `0c534f8cccaca9c281a3b29b71c2cde349ee0d0d` | H01/H02/H04 arreglado-sin-verificar; H03 parcial, H05 nuevo | [ronda-3.md](revisiones/ronda-3.md) |

Datos estructurados: [hallazgos.jsonl](hallazgos.jsonl) · [evidencia/comandos.md](evidencia/comandos.md) · [lecciones.md](lecciones.md).

## Estado ronda 3

**CON BLOQUEANTES (2):** H03 residual (regex amplia en name) y H05 nuevo (baja pendiente compartida entre cuentas). **No hay decisiones abiertas.** develop avanzó 15 commits; integrar con merge antes del gate final, no rebase.

## Estado ronda 2

**CON BLOQUEANTES (2)**: H03 residual (nombre de error no sanitizado); H04 nuevo (sin soporte push se pierde reintento de baja pendiente). Decisiones nuevas: ninguna. No mergear.

## Pendiente para el autor

1. `git pull` de esta rama antes de corregir; **nunca rebase, force ni amend**.
2. Completar H03 usando lista de nombres de error explícitos y corregir H05 vinculando baja pendiente con la sesión original; pruebas nuevas RED→GREEN y mutaciones de los dos casos.
3. Actualizar solamente la bitácora del autor; no modificar `docs/revision-pr/**`.
4. Push y solicitar ronda 4. E2E de rondas: Playwright local contra Preview de la rama + Supabase Develop, `--workers=1`, `CI=true`, proyectos Chromium y global-settings. El job `e2e-preview` oficial se reserva para el último push funcional sin bloqueantes.
5. Condición de merge: revisión independiente sin bloqueantes y checks del SHA final, incluido `e2e-preview`; **no** exigir otro CI verde por un commit puramente documental de revisión.

**No se aprobó ni mergeó.** Ronda 3 con dos bloqueantes; pruebas completas no reproducidas por revisor.
