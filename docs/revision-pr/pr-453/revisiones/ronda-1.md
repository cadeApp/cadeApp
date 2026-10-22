# Ronda 1 — PR #453 / T-377

**Fecha:** 2026-10-20 · **HEAD revisado:** `253fee23692be3e43c22927d87e055c9f15d6d9b` · **base:** `develop` (`03dec5b074e634d6f3895c282e58f7d7e6eb4456`).

> **Registro retrospectivo:** el cierre de esta ronda fue publicado originalmente en el comentario https://github.com/cadeApp/cadeApp/pull/453#issuecomment-6286485830. Esta carpeta no pudo escribirse al cierre original; se conserva el diagnóstico del SHA antiguo, sin trasladar verificaciones del SHA posterior.

**Resultado:** CON 2 BLOQUEANTES (PR453-H01 y PR453-H02), más 1 MEJORA A IMPLEMENTAR (PR453-H03). Decisiones de Lautaro073 (20/10/2026): **D1-B y D2-B**. Routes API ya habilitada.

## Hallazgos

### PR453-H01 — BLOQUEANTE
**`src/features/trips/components/trip-route-map.tsx:471-479` · [ANÁLISIS]**

El pie C06 se mostraba si `!showExternalNavigation` y decidía entre «Recorrido orientativo por calles» y «Línea recta orientativa» únicamente con `streetRouteStatus`, aun si `!isMapAvailable` y la vista no dibujaba mapa. El texto prometía una recta inexistente al faltar coordenadas, no haber key o fallar Google Maps.

**Corrección:** distinguir primero `!isMapAvailable` con «Mapa no disponible»; conservar `text-primary-dark`, el fallback sin mapa T-363 y los enlaces. Test C06 para retiro/entrega/intermedia sin pin, sin key, offline y SDK fallido. Mutación independiente prevista: quitar la guarda de mapa disponible.

### PR453-H02 — BLOQUEANTE
**`src/features/trips/components/trip-route-map.tsx:134` · [ANÁLISIS + INSPECCIÓN DE DEPENDENCIA]**

`useMapsLibrary('routes')` de `@vis.gl/react-google-maps@1.10.1` llama `void ctx.importLibrary(name)` sin capturar el rechazo; el timeout visual del componente no absorbe `unhandledrejection`. El mock anterior rechazaba `computeRoutes`, no `importLibrary('routes')`. Fuente: https://github.com/visgl/react-google-maps/blob/v1.10.1/src/hooks/use-maps-library.ts#L11-L21.

**D1-B autorizada:** usar importación explícita con captura de error, limpia por timeout/cambio de puntos/desmontaje; test con rechazo real de `google.maps.importLibrary('routes')`, incluido E2E que compruebe mapa montado, recta, texto, enlace y ausencia de `unhandledrejection`. Corregir solo la decisión técnica de T-377, sin CC nuevo.

### PR453-H03 — MEJORA A IMPLEMENTAR
**`src/features/trips/components/trip-route-map.tsx:145-176` · [ANÁLISIS]**

`computeRoutes` no tenía timeout, distinto del existente para carga de biblioteca. Una promesa eternamente pendiente dejaba recta provisional sin texto.

**D2-B autorizada:** timeout independiente de 10.000 ms al calcular, fallback visible, ignorar resolución o rechazo tardío y limpiar timers, sin reintentos. Test con fake timers a 9999/10000 ms y mutaciones que eliminen timer y guarda de resultado único.

## Evidencia de ronda 1

- Comparación de 5 archivos dentro de alcance, sin dependencias, contratos ni migraciones nuevas.
- CI del SHA `253fee23692be3e43c22927d87e055c9f15d6d9b`: 148 archivos/2909 tests unitarios PASS; db-tests 31 archivos/2868 pgTAP PASS; typecheck, lint, build, audit y bundle-budget success. E2E explícito en `253fee23692be3e43c22927d87e055c9f15d6d9b`: 91 principales + 6 global-settings PASS.
- No se ejecutaron mutaciones ni tests locales por el revisor. Las mutaciones M1–M6 en bitácora del autor **no equivalen** a verificación independiente.
- Se señalaron huecos no cubiertos por CI, no fallas observadas en producción.

## Condiciones de cierre

Nuevo SHA con H01–H03 implementados, pruebas RED→GREEN auténticas, mutaciones que maten los controles y revisión independiente posterior. No aprobar/mergear por el color de CI.
