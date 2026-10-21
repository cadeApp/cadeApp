# PR #470 — T-387 · Revisión independiente

| Campo | Dato |
|---|---|
| PR | https://github.com/cadeApp/cadeApp/pull/470 |
| Autor | Lautaro073 |
| Rama | `docs/T-387-ficha` → `develop` |
| Base revisada | `c702271f5291aeca62d87d18b4d7f582132765c2` |
| SHA revisado | `dbdc4b322e614adeb4115f35f44678ea9c29989f` |
| Diff original | 2 archivos, +126/-0 líneas |
| Resultado ronda 1 | **CON BLOQUEANTES (3), MEJORA (1)** |
| Resultado ronda 2 | **CON BLOQUEANTES (1 nuevo); H01-H04 cerrados** |

## Rondas
| Ronda | SHA inspeccionado | Estado | Informe |
|---|---|---|---|
| 1 | `dbdc4b3` | CON BLOQUEANTES | [ronda-1.md](revisiones/ronda-1.md) |
| 2 | `f638abb4` | CON BLOQUEANTES (H05) | [ronda-2.md](revisiones/ronda-2.md) |

## Hallazgos
| ID | Problema | Estado |
|---|---|---|
| PR470-H01 | Primer DoD no coincide con fila de plan | arreglado-verificado |
| PR470-H02 | Registro inicial no cubierto / falta VehicleForm | arreglado-verificado |
| PR470-H03 | Archivos permitidos con llaves de expansión | arreglado-verificado |
| PR470-H04 | MB ambiguo para límite de 10 MiB | arreglado-verificado |
| PR470-H05 | E2E inicial y reemplazo aún no verifican carga PDF real | abierto |

[Datos estructurados](hallazgos.jsonl) · [Comandos reproducibles](evidencia/comandos.md) · [Lecciones](lecciones.md)

## Decisiones confirmadas por Lautaro073
- **D01 C:** PDF de licencia y seguro en registro inicial, carga posterior desde perfil y reemplazo. Preparación/validación compartida por tipo; permitir `vehicle-form.tsx` y pruebas unitarias/E2E.
- **D02 C:** DNI, selfie y avatar solo imágenes en UI, contratos inalterados; visor admin capaz de mostrar cualquier PDF permitido por backend, cualquiera sea `kind`.
- **Autor corrige ficha** (primer DoD = texto exacto de aceptación en plan, 10 MiB / 10.485.760 bytes, rutas explícitas); revisión independiente no modifica la ficha.

**Ronda 2:** cuatro correcciones documentales comprobadas por controles estáticos JS independientes y mutaciones textuales en memoria sobre `f638abb4` (sin Vitest/Playwright). H05 bloquea la especificación E2E; el siguiente SHA de autor requiere ronda 3. No se aprobó ni mergeó.
