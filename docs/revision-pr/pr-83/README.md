# PR #83 — T-115 · Vista de viaje

> ❌ **Ronda 3: CON BLOQUEANTES · 11 bloqueantes actuales · 1 mejora residual · 5 decisiones aceptadas**

| | |
|---|---|
| **PR** | https://github.com/cadeApp/cadeApp/pull/83 |
| **Tarea / issue** | `T-115` · #21 |
| **Autor** | @asako669 · P2 |
| **Rama** | `feat/T-115-vista-de-viaje` → `develop` |
| **SHA revisado R3** | `8bc4ee282c11f193c117885404fc2652b8ae820f` |
| **Estado PR** | Draft |
| **Rama al iniciar R3** | diverged · ahead 13 · behind 13 |
| **CI R3** | no consultado por bloqueantes |

## Rondas

| Ronda | SHA | Resultado | Informe |
|---|---|---|---|
| 1 | `4b4f18b` | ❌ 5 bloqueantes · 1 mejora · D01 | [ronda-1.md](revisiones/ronda-1.md) |
| 2 | `4c2aded` | ❌ auditoría completa · 11 bloqueantes | [ronda-2.md](revisiones/ronda-2.md) |
| 3 | `8bc4ee2` | ❌ **11 bloqueantes actuales** · D02–D05 resueltas | [ronda-3.md](revisiones/ronda-3.md) |

## Estado actual

**Arreglados según código pero sin ejecución independiente:** H01, H02, H03, H04, H07, H08, H09, H11, H12.

**Abiertos/parciales y bloqueantes:** H05, H10, H13, H14, H15, H16, H17, H18, H19, H20, H21.

**Mejora residual:** H06 (SHA de bitácora).

**Decisiones aceptadas:** D01–D05.

## Decisiones de Lautaro073 en Ronda 3

- D02: `/trips/[id]` compartida y autorización de `src/app/trips/**` en T-115.
- D03: contract-change de datos con proyección mínima post-match de identidad/contactos/avatar.
- D04: código visual derivado del UUID; sin columna `code`.
- D05: contract-change de UI para `AlertDialog` + token semántico WhatsApp.

## Puntos críticos nuevos

1. `getTripDetails()` usa columnas y relaciones inexistentes; el mock de query no observa la proyección.
2. C06 usa `recipientPhone` como teléfono del repartidor.
3. Google Maps/coordenadas pertenecen a T-117.
4. Las dos páginas en route groups colisionan en `/trips/[id]`.
5. Enums visuales no coinciden con dominio (`moto` termina como “Bicicleta”; `to_agree` como “Transferencia”).
6. Hay 18 `text-xs`, más colores WhatsApp arbitrarios.
7. No hay evidencia de navegador/capturas pese al DoD marcado.
8. Un monto aceptado ausente se convierte en `$0`.

## Nota de proceso

El rebase previo fue pedido por la propia revisión en Ronda 2 y esa instrucción fue incorrecta. **No se atribuye a P2.** Desde esta ronda, sincronizar con `merge origin/develop`, nunca rebase/force/amend sobre la rama ajena.

## Verificación

La revisión pudo inspeccionar blobs exactos y ejecutar harnesses aislados, pero no un checkout completo; por eso los arreglos anteriores no se promovieron a `arreglado-verificado`. Los checks verdes declarados por el autor siguen siendo evidencia del autor hasta Ronda 4.

Datos: [hallazgos.jsonl](hallazgos.jsonl) · Evidencia: [comandos.md](evidencia/comandos.md) · Lecciones: [lecciones.md](lecciones.md)
