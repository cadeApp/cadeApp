# PR #83 — T-115 · Vista de viaje

> ❌ **Auditoría completa: CON BLOQUEANTES · 11 bloqueantes · 1 mejora · 1 decisión resuelta**
> Ronda 2 fue solicitada “como si fuera ronda 1”: se rehizo la revisión desde cero sobre `4c2aded`.

| | |
|---|---|
| **PR** | https://github.com/cadeApp/cadeApp/pull/83 |
| **Tarea / issue** | `T-115` · #21 |
| **Autor** | @asako669 · P2 |
| **Rama** | `feat/T-115-vista-de-viaje` → `develop` |
| **Merge-base** | `720e2d4f39ab5b4d5d09a55016072eb8fe940855` |
| **develop al auditar** | `b6bdac6cfe4c5ac9227e87692b8572e1f6bc2121` |
| **SHA producto revisado** | `4b4f18b0676cd5c5afb8ab5bb7f4328e28050621` |
| **SHA head auditado** | `4c2adedbcae27d3b3cb754325a12769cda5e1749` |
| **Estado de rama** | diverged · ahead 3 · behind 6 |
| **Estado PR** | Draft · fase roja |

## Rondas

| Ronda | SHA | Método | Resultado | Informe |
|---|---|---|---|---|
| 1 | `4b4f18b` | revisión inicial | ❌ 5 bloqueantes · 1 mejora · D01 | [ronda-1.md](revisiones/ronda-1.md) |
| 2 | `4c2aded` | **auditoría completa desde cero** | ❌ **11 bloqueantes · 1 mejora · D01** | [ronda-2.md](revisiones/ronda-2.md) |

## Estado por hallazgo

| ID | Resumen | Sev. | Estado |
|---|---|---:|---|
| H01 | RPC/input exactos no observados | alto | abierto |
| H02 | matriz auth incompleta | alto | abierto |
| H03 | default de no-show no ejercido | alto | abierto |
| H04 | privacidad por blacklist | alto | abierto |
| H05 | rojo de import usado como mutación | medio | abierto |
| H06 | bitácora contradictoria | bajo | abierto |
| H07 | ficha vigente no incorporada | alto | abierto |
| H08 | 5/6 transiciones inválidas sin test | alto | abierto |
| H09 | sin test de query/datos del viaje | alto | abierto |
| H10 | sin TDD de C06/R07/T05/estados | alto | abierto |
| H11 | revalidación de caché ciega | alto | abierto |
| H12 | borde de teléfono demasiado laxo | medio | abierto |
| D01 | `wa.me/<recipient_phone>` post-RLS | decisión | aceptado |

Datos: [hallazgos.jsonl](hallazgos.jsonl) · Evidencia: [comandos.md](evidencia/comandos.md) · Lecciones: [lecciones.md](lecciones.md)

## Qué cambió entre las dos revisiones

No cambió código de producto: `4c2aded` solo agregó la carpeta de la ronda 1.

Sí cambió **develop**:

- la rama quedó 6 commits atrás;
- la ficha T-115 pasó de 4 a 8 ítems de DoD;
- ahora son vinculantes C06, R07, T05 y la directiva visual;
- los “Archivos permitidos” **no cambiaron**.

Por eso H07 nació después de abrir la rama. H08–H12, en cambio, ya estaban latentes en el primer diff y son
agujeros de mi propia ronda 1.

## Lo verificado como correcto

- Scope actual: 0 archivos fuera de la ficha.
- El mapa queda reservado a T-117.
- El commit rojo inicial `93ee171` está separado de implementación.
- La lista de actions corresponde a las transiciones previstas.
- D01 sigue resuelta: `wa.me` puede usar el teléfono cuando el actor ya tiene autorización RLS.

## Bloqueo previo de UI

T05 pide AlertDialog; `src/ui/alert-dialog.tsx` no existe en develop y `src/ui/**` no está permitido por T-115.
La propia ficha ordena abrir `contract-change` si falta la primitiva. No debe sustituirse silenciosamente.

## Ejecución

- CI: no consultado por tener bloqueantes.
- `pnpm typecheck/lint/test`: no ejecutados independientemente; el entorno no puede resolver `github.com`
  para obtener el checkout completo.
- `test:db`: n.a.
- H12: reproducido con el algoritmo exacto de `extractNationalTenDigits/whatsappLink`.
- JSONL: 13 registros parseables; 12 abiertos, 11 bloqueantes, 1 decisión aceptada.

## Próximo orden

1. Rebase sobre develop.
2. Actualizar PR/bitácora a la ficha vigente.
3. Resolver la primitiva T05 vía contract-change si corresponde.
4. Completar toda la fase roja.
5. Implementar.
6. Browser 390/360 + capturas.
7. Checks completos.
8. Nueva revisión.
