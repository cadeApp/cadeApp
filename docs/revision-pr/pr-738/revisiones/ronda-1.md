# Ronda 1 — T-436 / PR #738

**Fecha local:** 2026-11-12 · **Resultado:** CON BLOQUEANTES (2) y MEJORAS A TOMAR (2)  
**SHA de contenido revisado:** `5dce13a4d632fbb32dd79c66a7907ca4693c82eb` · **Base:** `develop@3c4d26b6f34bc7a909b328bddcbd37f4fc0993bc`  
**PR:** https://github.com/cadeApp/cadeApp/pull/738  
**Alcance:** ficha T-436 y su fila en `docs/implementation-plan.md`, sin cambios de producción. **Sin CC**, conforme al issue #669.

## Protocolo y contraste

Leídos `docs/revision-pr/COMO-ENTREGAR.md`, `docs/revision-pr/README.md`, `.agents/skills/revisar-pr/SKILL.md`, T-391 y su bitácora, el issue #669, y el diff de PR #738. Confrontados `src/security/headers.ts`, `src/security/headers.test.ts`, `next.config.ts`, `e2e/specs/security-headers.spec.ts`, `public/sw.js` y antecedentes de T-312/T-409. Rama un commit por delante de develop y sin divergencia al consultar; PR abierta y sin comentario humano previo. No existía `pr-738/` ni `docs/tasks/log/T-436.md` en la rama.

### Qué funciona por inspección

- `buildSecurityHeaders` fuerza actualmente **solo** `frame-ancestors`, `object-src`, `base-uri` y `form-action`; la política completa está en `Content-Security-Policy-Report-Only` (`headers.ts:26,51-79`). La ficha describe correctamente la situación inicial.
- `next.config.ts:7-17` registra `headers()` para `/(.*)`; el E2E de T-391 usa `maxRedirects: 0` para no ocultar la cabecera de una redirección (`security-headers.spec.ts:103-119`).
- El mapa real se abre mediante botón y se comprueban respuesta de Maps y región accesible (`security-headers.spec.ts:153-161`); no se debe reemplazar por un mock.
- La prueba de bypass **puede dar RED legítimo** sobre la política actual: las directivas `script-src`, `connect-src` e `img-src` todavía no bloquean, por estar solo en Report-Only. Pero la evidencia de un RED real **no se ha ejecutado** en esta revisión.

## PR738-H01 · BLOQUEANTE · ALTO · P08 (control no cubre invariante)

**Ubicación:** `docs/tasks/T-436.md:71-73,89-93`.  
**Estado:** abierto; **detección: análisis**, no se afirma ejecución.

**Problema:** el DoD promete no romper Supabase **REST, Storage y Realtime**, pero el E2E descrito exige feed, nueva solicitud con Maps y admin MFA, sin comprobar las tres operaciones **desde el navegador**. Las consultas server-side que renderizan el feed no prueban `connect-src` del browser. Una política que quite el `wss://` de Supabase o su origen HTTPS podría pasar esos E2E y romper una conexión Realtime o una carga/descarga Storage.

**Corrección documental exigida:** sumar prueba browser de REST autenticado, transferencia Storage y Realtime con conexión y evento/confirmación real, usando usuarios sembrados y flujos existentes del proyecto. Afirmar que cada operación ocurrió, con su respuesta/handshake y sin eventos CSP `enforce`. No aceptar como sustituto una llamada Node (`createAuthenticatedClient`, `createAdminClient`) que evade la CSP; el mapa Google permanece real. La ficha debe nombrar las señales concretas y el origen `https`/`wss` esperado. **Mutaciones RED independientes sugeridas:** quitar solo el HTTPS de Supabase en `connect-src` (REST/Storage) y quitar solo el `wss` (Realtime); con las operaciones bajo prueba, ambos deberían quedar RED y el original GREEN. No subir esas mutaciones a un Preview público; seguir la política T-347 de seguridad.

## PR738-H02 · BLOQUEANTE · MEDIO · P08 (evidencia no prueba el requisito)

**Ubicación:** `docs/tasks/T-436.md:74-81`.  
**Estado:** abierto; detección: análisis.

**Problema:** pedir «una línea de violación Report-Only» para **cada origen retirado** es lógicamente inviable: un host ya autorizado y no usado no genera violación. Una reducción sin inventario puede romper casos no ejercitados.

**Corrección:** documentar cada **alta** con una violación real (directiva y host). Cada **baja** requiere inventario de peticiones observadas, justificación de ausencia o reemplazo, comparación de CSP candidata en Report-Only y E2E positivos sobre las rutas/roles afectados. Separar ausencia de reporte de ausencia de uso. No permitir comodines nuevos ni `'unsafe-eval'` en producción.

## PR738-H03 · MEJORA A TOMAR · MEDIO · P08 (negativo sin control positivo)

**Ubicación:** `docs/tasks/T-436.md:94-105,120-128`.  
**Estado:** abierto; detección: análisis.

**Problema:** `onerror` y un `fetch` rechazado no distinguen por sí mismos un rechazo CSP de fallas DNS, CORS o contenido inválido de `.invalid`/`example.com`. El RED contra Report-Only **es conceptualmente correcto**, pero su mecanismo debe aislar el motivo.

**Corrección:** en `security-headers.spec.ts` interceptar **solo** el host de prueba con `page.route` y responder JS válido, PNG válido y respuesta CORS válida sin credenciales/datos personales. Sobre la política actual (Report-Only) verificar **control positivo**: script ejecutado, imagen cargada y fetch resuelto; los intentos alcanzan la ruta interceptada. Luego, con enforce, para cada intento exigir evento `securitypolicyviolation` con `disposition='enforce'`, directiva efectiva y origen bloqueado correctos, script/imagen `onerror`, fetch rechazado y, cuando aplica, ninguna petición al host. No rebajar expectativas; si hay divergencia de directiva reportada por Chromium, registrarla explícitamente.

**RED real:** antes de cambiar producción, introducir solo el E2E en un commit de prueba o en build local (sin mutación de código de seguridad); sobre T-391 el test debe fallar por ausencia de bloqueo CSP, **no** por DNS/CORS. Registrar salida RED y GREEN con SHA y sin retries.

## PR738-H04 · MEJORA A TOMAR · MEDIO · P08 (observación incompleta)

**Ubicación:** `docs/tasks/T-436.md:74-78,89-93`; `e2e/specs/security-headers.spec.ts:49-64,132-173` (contraste).

**Problema:** el helper `collectCspMessages` separa texto de consola `report-only` y `enforced`, pero **no observa** `securitypolicyviolation`. La ficha pide ambos canales después de enforce sin prescribir instrumentación previa a navegación ni espera de recursos relevantes. El adjunto de Playwright no garantiza que evidencia de un test verde llegue a stdout.

**Corrección:** en el mismo spec registrar eventos `securitypolicyviolation` antes de navegar, leer `disposition`, `effectiveDirective` y `blockedURI` normalizando a **origen sin path/query ni PII**, correlacionar con consola, publicar resumen acotado a stdout para Report-Only en etapa de inventario, y comprobar **cero eventos enforce** en los flujos positivos una vez completadas las cargas observadas (Maps real, feed, admin MFA, operaciones Supabase). No sumar endpoints ni `report-uri`.

## Decisiones del usuario — registrar exactamente esta procedencia

En el mensaje de confirmación se eligieron las opciones recomendadas **como selección automática del agente, por ausencia de Lautaro; no constituyen su aprobación personal explícita**:

- **D1-C:** enforce ahora con `'unsafe-inline'` temporal; **CSP estricta de scripts en tarea aparte de prioridad alta [#739](https://github.com/cadeApp/cadeApp/issues/739)**. No confundir «cerrar Report-Only» con «resolver XSS inline»; documentar ese riesgo residual en objetivo, decisiones, fuera de alcance y DoD; futura tarea independiente podrá valorar nonce+`strict-dynamic` o hashes/SRI con sus efectos en render/cache.
- **D2-A:** no endpoint de reportes; consola + eventos del navegador y E2E.
- **D3-A:** solo `Content-Security-Policy` forzada, sin cabecera Report-Only simultánea. Para reversión, referenciar explícitamente el cambio de implementación que se revierta, **no** «revertir la PR documental» que no contiene código.

**No corresponde que el revisor altere ficha ni bitácora:** el autor actualizará `docs/tasks/T-436.md`, `docs/tasks/log/T-436.md`, fila del plan si el DoD cambia, y cuerpo de la PR, bajo el prompt de cierre. Esta carpeta no puede ser modificada por el autor.

## Checks y límites de evidencia

| Verificación | Resultado |
|---|---|
| Diff de PR | 2 docs permitidos, sin código; SHA arriba |
| PR/comments y issue #669 | consultados; sin CC; sin feedback humano anterior |
| Revisión de fuentes T-391 | inspección de HEAD de develop |
| CI oficial, typecheck, lint, Vitest, Playwright | **NO ejecutados por revisor**; no afirmar GREEN |
| RED de bypass | deducible de política, **no reproducido** |
| Control documental de `evidencia/comandos.md` | su **selftest sintético** se ejecutó; no sustituye CI/E2E |

La máquina disponible no pudo resolver `github.com` para clonar; la consulta se hizo con la conexión GitHub. Sin checkout completo no se prueba merge-tree ni tests de repositorio. CI de la implementación se revisará solo cuando no queden bloqueantes; **no pedir otro CI verde solo por actualizar documentación de revisión**.

## NO TOCAR (falsos positivos descartados)

- No exigir CC: el issue #669 marca «Necesita CC: no» y no se toca esquema/RPC.
- No exigir E2E de código en **esta PR documental**.
- No exigir nonces en **T-436** bajo D1-C; sí issue independiente #739 y riesgo residual explícito.
- No eliminar mapa real ni sustituirlo por stub.
- No pedir cambios en `AGENTS.md`, `.github/**`, `supabase/**`, `src/domain/**` ni dependencias.

## Cierre

**CON BLOQUEANTES (2)**. Dos mejoras H03/H04 se toman expresamente en la próxima corrección. El comentario de la PR contiene el prompt completo para el agy. **No aprobar ni mergear**. El commit de esta ronda modifica el HEAD, pero el SHA de evidencia sigue siendo `5dce13a4d632fbb32dd79c66a7907ca4693c82eb`; ejecutar `git pull` antes de arreglar.
