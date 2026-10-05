# PR #254 — T-302 · E2E de onboarding del repartidor, aprobación con MFA y DNI duplicado

| | |
|---|---|
| **PR** | https://github.com/cadeApp/cadeApp/pull/254 |
| **Tarea** | T-302 (Fase 3) |
| **Autor** | @asako669 |
| **Rama** | `feat/T-302-courier-onboarding-e2e` → `develop` |
| **Base revisada (R2)** | `f1ae16106e61bbb6707b4adf17f7572bafbbd23b` |
| **Head revisado (R2)** | `13caf3f68c5c28613487290a0797852c8a161b7c` |
| **Estado** | bloqueada |

## Rondas

| Ronda | SHA revisado | Hallazgos | Informe |
|---|---|---|---|
| 1 | `32477a05841ca669ac9ac7a36f929f2261e4c926` | 4 bloqueantes | [`revisiones/ronda-1.md`](revisiones/ronda-1.md) |
| 2 | `13caf3f68c5c28613487290a0797852c8a161b7c` | 2 bloqueantes nuevos; H01–H04 arreglados sin verificar | [`revisiones/ronda-2.md`](revisiones/ronda-2.md) |

## Estado por hallazgo

| ID | Título | Sev. | Estado |
|---|---|---|---|
| PR254-H01 | La prueba DoD de DNI no ejecuta la deduplicación de producción | alta | arreglado-sin-verificar |
| PR254-H02 | Los flujos UI tienen escapes que permiten verde sin interacción obligatoria | alta | arreglado-sin-verificar |
| PR254-H03 | El courier del fixture ya llega aprobado y con onboarding completo | alta | arreglado-sin-verificar |
| PR254-H04 | El MFA se eleva en otra sesión y la RPC directa oculta el fallo del navegador | alta | arreglado-sin-verificar |
| PR254-H05 | No hay ejecución GREEN del E2E corregido ni mutaciones RED de Ronda 1 | alta | abierto |
| PR254-H06 | El spec inventa un DNI_HMAC_SECRET alternativo | alta | abierto |

Datos estructurados: [`hallazgos.jsonl`](hallazgos.jsonl) · Comandos: [`evidencia/comandos.md`](evidencia/comandos.md)

## Qué queda por hacer

1. Ejecutar el spec T-302 completo en GREEN después de los arreglos.
2. Ejecutar y documentar las cuatro mutaciones RED pedidas en Ronda 1, restaurando todo antes del commit.
3. Eliminar el secreto HMAC de fallback y fallar explícitamente si `DNI_HMAC_SECRET` no existe.
4. Devolver el primer checkbox del DoD a pendiente hasta que exista la evidencia RED/GREEN; no reescribir sesiones anteriores de la bitácora.
5. Pedir Ronda 3. La aprobación de Lautaro073 se hace recién cuando la revisión quede sin bloqueantes.

## Para el análisis posterior

Ronda 2 no agrega una AG nueva: H05 refuerza P08/AG-70 (evidencia que no prueba la propiedad) y H06 es otra instancia de una precondición de test que puede divergir de producción.