# PR #251 — T-313 · E2E de registro de comercio y consentimientos

> ❌ Ronda 2 · CON BLOQUEANTES (1) · 3 de 4 hallazgos cerrados

| Campo | Valor |
|---|---|
| PR | #251 · `feat/T-313-merchant-registration-e2e` → `develop` |
| Tarea | T-313 · Issue #45 |
| Autor | KiraK72 |
| SHA de cierre de ronda | `604d028b5573aa6addf7514e20eb5d7b6686a030` |
| SHA funcional revalidado | `79c6985e8c9717cf00f28c1baa6e7e4fbd38e726` |
| `develop` observado | `1cd3da01b3af9619e4a19107ba5e8354a18c2159` |
| Divergencia | 6 ahead / 3 behind |
| Preview T-313 | run `37350595553` · RED |

## Rondas

| Ronda | SHA | Resultado |
|---|---|---|
| 1 | `afdb326` | ❌ 4 bloqueantes |
| 2 | `604d028` | ❌ 1 bloqueante · H01/H02/H03 cerrados |

## Hallazgos

- ✅ **PR251-H01** — la clase actual de rutas `(merchant)` quedó completamente enumerada.
- ✅ **PR251-H02** — el fixture ya preserva error principal + error de cleanup.
- ✅ **PR251-H03** — desapareció la declaración falsa de checks; CI integrado del SHA funcional quedó verde.
- ❌ **PR251-H04** — falta completar una secuencia válida baseline GREEN → mutación RED → revert → GREEN final.

## Decisiones de Lautaro073

- **D01:** Develop/Preview no depende de SMTP real. Staging conserva SMTP/sender.
- **D02:** opción **A**. Se autoriza una mutación temporal y controlada de código productivo fuera del alcance normal de T-313, exclusivamente para demostrar el RED. Debe ir en commit separado y revertirse con `git revert`.

## Condiciones antes de D02

La mutación no se ejecuta sobre un baseline ya rojo. Primero:
1. sincronizar la rama con `develop`;
2. conseguir que Auth de **Supabase Develop** no dependa del envío de correo;
3. obtener `e2e-preview` GREEN normal.

Después se ejecuta el probe autorizado, se registra el RED, se revierte y se exige GREEN final.

## P3

La solicitud existe, pero no hay visto bueno explícito registrado.

## Estado

No apruebo ni mergeo.
