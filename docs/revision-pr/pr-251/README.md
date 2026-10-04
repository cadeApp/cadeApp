# PR #251 — T-313 · E2E de registro de comercio y consentimientos

> ❌ Ronda 1 · CON BLOQUEANTES (4) · 0 cerrados · 4 abiertos

| Campo | Valor |
|---|---|
| PR | #251 · feat/T-313-merchant-registration-e2e → develop |
| Tarea | T-313 · Issue #45 |
| Autor | KiraK72 |
| SHA revisado | afdb326128cef1972b42bb3822a43cbd468fbd61 |
| Base develop | e2ff65cd29aee3292f280afc268b1c406fddc18c |
| Alcance previo a esta revisión | 2 archivos, 0 fuera de Archivos permitidos |

## Rondas

| Ronda | SHA | Resultado |
|---|---|---|
| 1 | afdb326 | ❌ 4 bloqueantes |

## Decisión resuelta por Lautaro073

D01 — opción A: el E2E de Develop/Preview no debe depender de SMTP real. Staging conserva su SMTP/sender configurado.
Si Auth de Develop falla por correo, no se adultera el spec, no se usa una cuenta real y no se debilitan aserciones:
se reporta el error y se corrige únicamente el entorno Develop.

## Bloqueantes

1. PR251-H01 — cobertura incompleta de las rutas del route group (merchant).
2. PR251-H02 — el fixture local puede ocultar una falla de cleanup.
3. PR251-H03 — PR body marca lint/test como cumplidos, pero la bitácora dice que no se ejecutaron.
4. PR251-H04 — falta RED comportamental y GREEN real de e2e-preview; Vercel no llegó a desplegar.

## Condiciones de cierre adicionales

- Falta el visto bueno de P3 sobre e2e/specs/merchant-registration.spec.ts.
- Debe existir un Preview de Develop ejecutable y e2e-preview verde sobre el SHA revalidado.
- La decisión D01 no autoriza cambios de Staging.

## Estado

No apruebo ni mergeo. Esta ronda es estática porque tiene bloqueantes abiertos.

## Archivos

- revisiones/ronda-1.md
- hallazgos.jsonl
- evidencia/comandos.md
- lecciones.md
