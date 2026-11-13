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
