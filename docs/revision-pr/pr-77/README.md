# PR #77 — T-121 · Onboarding del repartidor

> ❌ **Con bloqueantes (5) · 4 mejoras · 0 decisiones pendientes**  
> Ronda 1 estática y de análisis de contratos/pruebas sobre el árbol en fase roja de TDD.

| | |
|---|---|
| **PR** | [#77](https://github.com/cadeApp/cadeApp/pull/77) · `feat/T-121-courier-onboarding` → `develop` |
| **Tarea / issue** | [`T-121`](../../tasks/T-121.md) · Issue #24 |
| **Autor** | asako669 (P3 / agy) |
| **Revisión** | independiente — no es el agy que implementó |
| **SHA revisado** | `29f7a1deaf07afbcf81d4d8be94e0239a7a9bd1c` · base `origin/develop` = `b6b5f39` |
| **Alcance** | 4 archivos en el diff · **0 fuera** de «Archivos permitidos» |

## Rondas

| Ronda | SHA | Resultado | Informe |
|---|---|---|---|
| 1 | `29f7a1d` | ❌ 5 bloqueantes · 4 mejoras · 0 decisiones | [`ronda-1.md`](revisiones/ronda-1.md) |

## Estado por hallazgo

| ID | Título | Sev. | Cat. | Patrón | Estado |
|---|---|---|---|---|---|
| `PR77-H01` | Trabajo principal declarado en la descripción del PR no está commiteado ni en la rama | crítico | test-coverage | `P15-entregable-declarado-pero-no-ejecutable` | abierto |
| `PR77-H02` | `pnpm typecheck` falla con 7 errores por módulos no creados y casteo incorrecto de mockResolvedValue en funciones async | alto | correctness | `P01-contrato-de-framework-no-verificado` | abierto |
| `PR77-H03` | Test de persistencia de onboarding no afirma la inserción de consentimientos ni documentos (`mockInsertConsents` y `mockUpsertDocuments` huérfanos) | alto | test-coverage | `P08-control-no-cubre-lo-que-dice` | abierto |
| `PR77-H04` | Test de compresión de imágenes omite entorno jsdom y asume APIs de navegador no disponibles en Node.js | alto | test-coverage | `P01-contrato-de-framework-no-verificado` | abierto |
| `PR77-H05` | La suite de pruebas de la tarea está en rojo (`pnpm test` falla con 3 suites rotas) | alto | test-coverage | `P15-entregable-declarado-pero-no-ejecutable` | abierto |
| `PR77-H06` | Test de detección de DNI en `actions.test.ts` no afirma la columna consultada (`dni_hmac`) y omite repartidores suspendidos | medio | test-coverage | `P08-control-no-cubre-lo-que-dice` | abierto |
| `PR77-H07` | Test de resiliencia de subidas prueba un state machine en memoria pero es ciego a la integración real con Supabase Storage (`courier-docs`) | medio | test-coverage | `P08-control-no-cubre-lo-que-dice` | abierto |
| `PR77-H08` | Ausencia de pruebas para las vistas y componentes de onboarding R01, R02, R03 | medio | test-coverage | `P06-enumeracion-incompleta` | abierto |
| `PR77-H09` | Plantilla del PR incompleta: sección de informe agy sin reporte y checklist del DoD sin tildar | medio | test-coverage | `P19-cuerpo-de-pr-fuera-de-template` | abierto |

Datos estructurados: [`hallazgos.jsonl`](hallazgos.jsonl) · Comandos: [`evidencia/comandos.md`](evidencia/comandos.md)

## Estado de la PR en esta ronda

La PR fue abierta en estado **Draft** tras redactar preliminarmente tres suites de pruebas en la fase roja de TDD. La rama no contiene los entregables productivos descritos en el cuerpo del PR: no existen los módulos `src/lib/image-compression.ts`, `src/features/courier-onboarding/actions.ts`, `src/features/courier-onboarding/upload-manager.ts`, ni las vistas `src/app/(courier)/onboarding/**` (especificaciones Stitch R01, R02, R03).

Asimismo, los tests preliminares contienen errores de compilación de TypeScript al mockear la función asíncrona `createClient`, tests de persistencia ciegos que no asertan la inserción de consentimientos ni documentos en la base de datos, y un test de compresión que asume APIs de navegador ejecutándose en entorno Node sin `jsdom`.

## Qué queda por hacer

1. Implementar la utilidad de compresión de imágenes en `src/lib/image-compression.ts` (< 500 KB) con APIs nativas (Canvas/OffscreenCanvas) sin dependencias externas.
2. Implementar el administrador de subidas resilientes en `src/features/courier-onboarding/upload-manager.ts` integrando el Storage privado `courier-docs` con path `courier/${auth.uid()}/...`.
3. Implementar la Server Action `courierOnboardingAction` en `src/features/courier-onboarding/actions.ts` validando Zod, calculando `dni_hmac` con clave secreta y `createAdminClient` para actualizar `couriers`, registrando consentimientos en `consents` y documentos en `courier_documents`.
4. Corregir los tipos en `actions.test.ts` (`Awaited<ReturnType<typeof createClient>>`) y agregar aserciones explícitas para `mockInsertConsents` y `mockUpsertDocuments`.
5. Agregar directiva `// @vitest-environment jsdom` y mocks de Canvas en `image-compression.test.ts`.
6. Implementar las pantallas y componentes de onboarding R01, R02 y R03 en `src/app/(courier)/onboarding/**`.
7. Dejar `pnpm typecheck`, `pnpm lint` y `pnpm test` en verde.
8. Ejecutar la auto-revisión con la skill `revisar-pr`, actualizar la bitácora y pegar el informe en el PR.

## Lo mejor de la PR

- **Cero dependencias externas nuevas:** Cumplimiento riguroso de la regla 25 y de la ficha ("Dependencias nuevas permitidas: ninguna"), diseñando la compresión con Canvas nativo en lugar de incorporar paquetes pesados de npm.
- **Alcance estricto de archivos:** Todos los archivos creados y previstos se encuentran 100% dentro de "Archivos permitidos" de la ficha T-121.
- **Diseño de seguridad de `dni_hmac`:** El enfoque documentado en la bitácora respeta el congelamiento de RLS en `couriers_update_self`, delegando la escritura de `dni_hmac` exclusivamente al servidor vía `createAdminClient`.

## Para el análisis posterior

Ver [`lecciones.md`](lecciones.md) (lecciones AG-64 y AG-65).
