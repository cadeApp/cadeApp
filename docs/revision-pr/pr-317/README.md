# PR #317 — T-340 · Paso 1/4 — Esquema, puente legacy y backfill

**PR:** https://github.com/cadeApp/cadeApp/pull/317 · **Autor:** asako669 (P2)  
**Rama:** `feat/T-340-varias-entregas` → `develop`  
**Estado de revisión:** ✅ **SIN BLOQUEANTES TÉCNICOS (ronda 8)**. **Aún NO MERGEADO / sin aprobación vigente.**

## Rondas independientes

| Ronda | SHA de código | Resultado | Informe |
|---|---|---|---|
| 1 | `cf69ffd6` | 5 bloqueantes | [Ronda 1](revisiones/ronda-1.md) |
| 2 | `5bba8319` | 4 bloqueantes | [Ronda 2](revisiones/ronda-2.md) |
| 3 | `5e2a62c6` | 4 bloqueantes | [Ronda 3](revisiones/ronda-3.md) |
| 4 | `d2b3285a` | 2 bloqueantes | [Ronda 4](revisiones/ronda-4.md) |
| 5 | `09d2a920` | 2 bloqueantes | [Ronda 5](revisiones/ronda-5.md) |
| 6 | `00ec6a77` | 2 bloqueantes | [Ronda 6](revisiones/ronda-6.md) |
| 7 | `8b38d1a1` | 1 bloqueante de evidencia | [Ronda 7](revisiones/ronda-7.md) |
| **8** | **`d5d002b5`** | **✅ SIN BLOQUEANTES TÉCNICOS** | **[Ronda 8](revisiones/ronda-8.md)** |

## Estado acumulado

**H01–H15: 15 de 15 arreglados-verificados.** En esta ronda H15 se cerró al comprobar RED→GREEN **funcional** de H13/H14 con dos mutaciones de funciones SQL productivas en la DB efímera de CI, logs reales de fallo objetivo y restauración posterior.

**CI SHA de código R8:** run `38169704109`, `db-tests` job `114559541340`: **1.980 pruebas pgTAP (21 archivos) ✅; 11/11 carreras de dos sesiones ✅; RED→GREEN H13/H14 ✅; regeneración de tipos sin drift ✅**. Unit/typecheck/lint/build/audit/bundle-budget ✅. **`approval-policy` ❌ por «El PR requiere aprobación vigente de Lautaro073».** Ese check no es un hallazgo de código.

[Hallazgos estructurados](hallazgos.jsonl) · [Evidencia](evidencia/comandos.md) · [Lecciones](lecciones.md).

## Acciones manuales para el dueño

1. **Tras este informe y sus commits documentales**, verificar los nuevos checks del HEAD actualizado, ya que la revisión mueve la rama y dispara otro CI.
2. **Lautaro073 debe emitir su aprobación de PR #317 sobre el HEAD vigente.** El job `approval-policy` está configurado expresamente para exigirla; no se debe debilitar la policy.
3. Cuando todos los checks obligatorios estén verdes y la aprobación siga vigente, **Lautaro073 puede mergear la PR** (o pedir expresamente que lo haga la revisión). **No se aprobó ni mergeó durante la ronda 8.**
4. Tras merge a `develop`, completar el **checkpoint obligatorio post-merge de CC-022 §10** y comprobar compatibilidad legacy antes de arrancar el paso 2; luego dar instrucciones al agy para la próxima PR.

Sin nuevas decisiones de producto. No modificar la implementación R8 por cosmética.
