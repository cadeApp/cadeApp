# Lecciones — PR #738 / T-436

1. **P08 — Probar el camino afectado:** un E2E que carga páginas o un mapa no verifica automáticamente el canal de WebSocket o Storage del navegador. Contar operaciones browser reales para `connect-src` y `img-src`; nunca sustituirlas por consultas Node.
2. **P08 — El silencio no demuestra ausencia:** Report-Only no genera reportes por orígenes permitidos. Para retirar entradas de la allowlist hacen falta inventario de tráfico y pruebas con CSP candidata, no un reporte imposible.
3. **P08 — Control positivo en bypass:** `onerror` de script/imagen y un rechazo `fetch` pueden deberse a DNS/CORS. Interceptar el host y entregar payload válido en ambos modos; atribuir el bloqueo a `securitypolicyviolation` con `disposition='enforce'`.
4. **P08 — Observabilidad de política:** observación de consola ≠ escucha de eventos DOM CSP. Los dos canales se capturan antes de navegar y se minimiza lo que llega al log.
5. **D1-C / #739:** declarar explícitamente qué hallazgo se cierra (paso a enforce) y cuál no (mitigación estricta de XSS inline). `'unsafe-inline'` temporal no es equivalente a CSP estricta.

No se crea número AG nuevo sin comprobar primero el máximo de todas las ramas remotas; esta sesión no tuvo clon con acceso a refs remotas completo. Las referencias permanentes son `pr-738/PR738-H01` a `H04`. No modificar `AGENTS.md` por un caso aislado.

## Ronda 2 — T-347 / frontera trusted de mutaciones

**PR738-H05 (P15):** escribir «mutaciones con `RED_CONFIRMED`» en el DoD no lo hace ejecutable. Antes de aceptar un requisito de pruebas hay que cruzarlo con los inputs del workflow real, su rama target, catálogo de patches y los «Archivos permitidos». `e2e-mutation` solo prueba `develop` mergeado y lee patches trusted versionados; no puede validar un SHA de PR abierto. Hay que **separar pre-merge de post-merge** y autorizar el catálogo si se decide usarlo, sin modificar la frontera de secretos ni fingir evidencia.

**Revisión estática independiente:** los cuatro ajustes de H01–H04 están ahora especificados; se ejecutaron comparaciones y mutaciones sobre el contenido documental, no el navegador. No equiparar «DoD bien redactado» con «E2E RED→GREEN real». El defecto de ejecución H05 fue invisible para los 123 unit tests declarados por el autor.

La carpeta `pr-738/` no fue tocada por el autor entre rondas. No numerar un AG sin inspección de todas las ramas remotas; referencia estable `pr-738/PR738-H05`.

## Ronda 3 — cierre de H05 (sin bloqueantes documentales)

El DoD puede exigir **RED real antes del merge** y **RED_CONFIRMED trusted después del merge** si la ficha enumera los patches y el manifest autorizados sin ejecutar la PR como target del workflow. En T-436.md:56-75,129-146,179-181 ya se distingue pre-merge de post-merge y se conserva la frontera trusted. La revisión verifica la **factibilidad de la especificación**, no los E2E futuros.

En el manifest de e2e-mutation cada mutación selecciona **un solo grep**. Si el patch HTTPS debe demostrar fallos de REST y Storage, el test seleccionado tiene que observar ambas operaciones o indicar qué prueba realmente cubre. El expectedFailure exige RED observado, no una cadena inventada. No proponer nueva regla AG por un único caso.

**Detalle editorial no bloqueante:** T-436.md:39 dice «Las tres» después de agregar D4-A. Bitácora y PR sí registran la procedencia de D4 como automática. Se puede cambiar por «Las cuatro» cuando se vuelva a editar la ficha, sin otra ronda por este detalle.
