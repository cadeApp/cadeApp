# Informe de revisión — PR #584 / T-402 — ronda 2

**Fecha:** 2026-11-03  
**SHA de código revisado:** \`43c4f0d8b54f0a9bff18a6fef4af04460d73a325\`  
**Base:** \`develop\` @ \`2ed5ef14e6b87efbdedb36e4da18ad8bf08f624a\`  
**Resultado:** CON BLOQUEANTE DE ENTREGA (H02). H01 corregido en código, pero aún sin verificación de Playwright independiente. No aprobar ni mergear.

## Delta auditado

Comparación \`44c0927a..43c4f0d8\`: solo \`e2e/specs/admin-nav-mobile.spec.ts\` (+59 líneas) y \`docs/tasks/log/T-402.md\` (+28). El autor no modificó la carpeta de revisión. GitHub informa PR Draft, rama 5 commits delante y 0 detrás de develop, mergeable=true (no sustituye merge-tree ejecutado). Se mantiene la ampliación de ficha autorizada como **D01 opción A**, 7 secciones y \`getAdminOperatorName\`.

## H01 — Arreglado en fuente; aún no verificado de forma independiente

**Archivo:** \`e2e/specs/admin-nav-mobile.spec.ts:101–155\`.  
**Estado estructurado:** \`arreglado-sin-verificar\`, \`verificado_en_sha=null\`.

Se conserva intacto el caso a **390 px** con navegación de 7 secciones y cierre/foco. El test nuevo usa la sesión real por MFA, cambia a 1023, 1024 y 1280 px, visita Comercios y comprueba:

- 1023 px: sidebar oculta, Menú visible, \`main.x≈0\`, \`main.width≈1023\`.
- 1024 y 1280 px: sidebar visible y Menú oculto; 7 links con ícono, texto y href en orden; Comercios con \`aria-current=page\`; operador sembrado y Salir; \`main.x≈256\`, \`main.width≈viewport−256\`.
- Geometría con tolerancia de ±1 px. Rutas del spec y constantes coinciden 7/7. No se encontraron \`.skip\`, \`.only\` ni sleeps fijos.

**Control independiente realmente hecho:** inspección del SHA exacto, 12/12 controles de estructura y aserciones correctos y 5/5 alteraciones textuales de aserción/umbral detectadas por guardas independientes. El harness completo está en \`evidencia/comandos.md\`. **Esto no es Playwright RED, ni un test E2E ejecutado por la revisión.**

**Afirmación del autor, no atribuida al revisor:** 2 passed en Preview, control CSS 1 passed, cuatro inyecciones CSS que representan clases mutadas provocan RED por los asserts previstos. Es una prueba válida de sensibilidad del DOM a estilos equivalentes *si* las inyecciones tienen selector y prioridad correctos; no demuestra que se haya compilado y ejecutado un TSX modificado. El spec temporal no quedó disponible para reproducir sus pasos exactos. El autor explica que build local fue bloqueado por un error preexistente en \`not-found.tsx\` y por política de .env.production.local. No se inventan ejecuciones ni se pide fabricar RED.

**Conclusión H01:** sin bug nuevo observado por inspección y sin necesidad de volver a modificar el test; su cierre como verificado exige corrida independiente contra SHA de código (o evidencia de CI reproducida).

## H02 — Sigue abierto; intervención humana

**Archivo:** \`docs/tasks/log/T-402.md:49–52,78–79\`, DoD de ficha T-402.

En la PR no se encontraron las 15 capturas declaradas: 7 secciones a 1280, 7 a 390 y un Sheet abierto. **Lautaro073 debe examinar que no haya información personal de Supabase Develop y adjuntar las 15 imágenes a la conversación de GitHub**, no al repositorio. Después habrá que comprobar adjuntos, contenido y dimensiones.

## Lo que está bien y no se debe tocar

El arreglo se limita al test E2E y bitácora; la implementación funcional ya revisada no cambió. \`ADMIN_NAV_TABS\` y el listado de rutas son exhaustivos y coinciden. D01 no requiere nuevas decisiones. No hay nuevo hallazgo demostrado ni nuevo cambio funcional pedido.

## Límites, CI y próximos pasos

La revisión se hizo con GitHub API; intento \`curl\` al clon directo falla por DNS (\`Could not resolve host github.com\`). No se ejecutaron \`pnpm typecheck\`, \`pnpm lint\`, \`pnpm test\`, Playwright ni el log de \`e2e-preview\` de forma independiente. La bitácora declara una cancelación por cola compartida, no CI verde. **CI oficial se mirará cuando la ronda esté para aprobar**, después de H02; no se requerirá corrida adicional solo por el commit de documentación de revisión (regla 10).

Resultado: **H01 corregido sin verificar; H02 abierto; no aprobar ni mergear todavía**.
