# PR #58 · Ronda 2 — `ad630b9`

| | |
|---|---|
| **SHA revisado** | `ad630b98ac846a1b667bd4d37fb0d359b4f49deb` |
| **Arreglo principal** | `147ccf7fa1d1580ad578cf026d18d92633fe963c` |
| **Tarea** | T-006 · Contratos de dominio v1 |
| **Tamaño acumulado** | 18 archivos · +4241 / −373 |
| **Fecha** | 2026-09-22 |

## Veredicto

**CON BLOQUEANTES: 4 de los 14 originales siguen abiertos.** Verifiqué de forma independiente 10 correcciones (`H01–H04`, `H06`, `H09–H13`). `H05`, `H07`, `H08` y `H14` mejoraron, pero sus pruebas negativas todavía pasan.

Recorrí otra vez la clase completa antes de agrupar: las 18 RPC, sus actores, recursos relacionados, preestados, outputs y códigos; las ocho guardas protegidas; los cinco settings; los dos modos de distancia; generación de IDs; cobertura y dependencias. No hay migraciones ni RLS nuevas en este PR.

## Lo que quedó bien

- Las ocho transiciones protegidas ahora exigen evidencia positiva. Las cuatro ramas sin motivo devuelven `REASON_REQUIRED`.
- La solución de distancia implementa exactamente la decisión humana: coordenadas completas → Haversine; sin coordenadas → `null` y «De barrio X a barrio Y». Rechaza coordenadas parciales y dos puntos iguales dan 0 m.
- La unión discriminada de settings, los schemas ISO, `ActionResult` exacto y la configuración explícita del fake quedaron bien resueltos.
- El mapa de actores cubre nominalmente las 18 RPC y corrige el fail-open anónimo de la ronda 1.
- El fake ahora mantiene bastante más estado: `NOT_FOUND`, transiciones, ofertas hermanas rechazadas y efectos administrativos. Es una mejora real sobre la primera versión, aunque todavía quedan relaciones inválidas que atraviesan el adapter.
- El umbral de cobertura es real y no decorativo. Mi mutación independiente hizo fallar `pnpm test:coverage`; retirada la mutación, todos los archivos de dominio superan 90 %.
- La fase roja del autor ahora registra ocho fallos conductuales por clúster. Sumada a los probes independientes de ambas rondas, H13 queda cerrada.

Dos residuales son huecos de mi propia ronda 1, no trabajo nuevo del autor: probé varias ofertas creadas, pero no crucé el generador contra IDs ya sembrados; y exigí validar inputs/preestados sin ejecutar cada output contra su schema. Los incorporo ahora dentro de H08 y H07, respectivamente, sin presentarlos como regresiones nuevas.

## Checks

| Control | Resultado | Lectura correcta |
|---|---|---|
| `pnpm install --frozen-lockfile` | ✅ exit 0 | Instalación limpia en el worktree detached |
| `pnpm typecheck` | ✅ exit 0 | No detecta los casts deliberados del fake |
| `pnpm lint` | ✅ exit 0 | La regla raíz que prohíbe `!` no está automatizada |
| `pnpm test` | ✅ 91 Vitest + 19 workflows + 6 ADR | La suite no cubre los siete contracasos de esta ronda |
| `pnpm test:coverage` | ✅ exit 0 | Umbral real; `rpc-fake` 90,08 % branches y `states` 93,75 % |
| Mutación de cobertura | ✅ falló como debía | Módulo exportado sin pruebas: lines/statements 25 %, functions 0 % |
| `pnpm build` | ✅ exit 0 | Build de Next 14 actual |
| `pnpm test:db` local | n. a. | Este entorno no tiene Docker |
| `db-tests` CI | ✅ `Files=3, Tests=98`, `Result: PASS` | Hubo `toomanyrequests`, pero el stack arrancó tras reintentos y pgTAP sí corrió |
| `pnpm audit --audit-level=high` | ⚠️ exit 0 artificial | Imprime 8 altas y 2 críticas **ignoradas**; H14 no está remediado |
| Alcance | ✅ autorizado | Se registró la autorización adicional para actualizar Next.js |

## Hallazgos que siguen bloqueando

### H05 · El tipo público se estrechó, pero el fake todavía fabrica códigos imposibles

`src/domain/testing/rpc-fake.ts:150-165,224,300-309` · alto · `P11-api-publica-inconsistente`

`RpcClientContract` quedó correctamente como `RpcErrorCode<K>`. Sin embargo, `setForcedError` acepta cualquier `DomainErrorCode`; `executeRpc` lo convierte con `as RpcErrorCode<K>`. La prueba concreta llamó `setForcedError('AAL2_REQUIRED')` antes de `publish_request`: la RPC devolvió ese código aunque no pertenece a su catálogo.

**Prueba roja a agregar:** el API de error forzado debe quedar ligado al nombre de RPC —o retirarse a favor de fixtures tipados— y TypeScript debe rechazar `AAL2_REQUIRED` para `publish_request`. No reemplazar el vínculo con otro cast.

### H07 · El fake aún acepta relaciones imposibles, emite outputs inválidos y omite la ventana de incidentes

`src/domain/testing/rpc-fake.ts:561-567,647-742,795-815,905-925` · alto · `P15-entregable-declarado-pero-no-ejecutable`

El arreglo cubrió la mayor parte del camino feliz, pero no cerró la matriz negativa completa:

1. Una oferta `pending` cuyo `courierId` no existe es aceptada porque la elegibilidad solo se comprueba dentro de `if (offerCourier)`.
2. Un documento cuyo courier relacionado no existe produce `TypeError` en `admin_verify_document`, en vez de `NOT_FOUND`.
3. Una solicitud `matched` sin `acceptedOfferId` hace que `report_no_show` y `courier_cancel_match` devuelvan éxito con `cancelledOfferId: undefined`; ese resultado falla su propio `outputSchema`. `executeRpc` valida inputs, no outputs.
4. `report_incident` acepta una solicitud `draft`. El Master Plan limita el reporte al viaje activo y, después de `delivered`, a 24 horas; el fake no conserva `deliveredAt`, por lo que tampoco puede producir naturalmente `INCIDENT_WINDOW_EXPIRED`.

Los ocho `!` de las líneas 362, 465, 598, 656, 681, 723, 754 y 914 además violan la prohibición explícita de AGENTS.md. Dos ya esconden los fallos anteriores.

**Prueba roja a agregar:** conservar los cuatro contracasos del probe; cada uno hoy pasa demostrando el defecto. Agregar validación de output en el adapter ayuda a que una implementación incompleta falle cerca de la causa, pero no sustituye validar las relaciones antes de mutar.

### H08 · La secuencia nueva colisiona con ofertas sembradas

`src/domain/testing/rpc-fake.ts:232,293-298,489-497` · medio · `P15-entregable-declarado-pero-no-ejecutable`

La secuencia corrige la colisión entre ofertas creadas durante una instancia vacía, pero siempre empieza en 1. Sembré `00000000-0000-4000-8000-000000000001`; la primera `submit_offer` devolvió el mismo ID y reemplazó silenciosamente el fixture.

**Prueba roja a agregar:** una oferta sembrada con el primer ID debe seguir intacta después de crear otra. Inicializar contra los seeds o inyectar un generador determinista que compruebe disponibilidad.

### H14 · El audit quedó verde silenciando diez vulnerabilidades altas/críticas

`package.json:30,47,66-78` · crítico · `P15-entregable-declarado-pero-no-ejecutable`

La actualización redujo deuda, pero el resultado no remedia H14: `pnpm.auditConfig.ignoreGhsas` ignora 8 avisos altos y 2 críticos. Por eso `pnpm audit --audit-level=high` termina 0 mientras imprime:

```text
25 vulnerabilities found
Severity: 2 low | 13 moderate | 8 high (8 ignored) | 2 critical (2 ignored)
```

Los avisos no son exclusivos de Next 15: varios declaran afectado Next 14; incluyen DoS/SSRF de App Router y Server Actions, y dos RCE críticas. Next 14 está fuera de soporte según la política oficial.

**Decisión humana cerrada antes de entregar:** Lautaro073 autorizó ampliar T-006 para actualizar Next.js a una versión soportada y parcheada, como mínimo 15.5.24. Los `ignoreGhsas` no se aceptan como cierre. Actualizar `next` y `eslint-config-next` de forma compatible, retirar las excepciones que dejen de corresponder y repetir instalación congelada, suite, build y audit.

Referencias primarias: [política de soporte de Next.js](https://nextjs.org/support-policy), [Server Actions DoS](https://github.com/advisories/GHSA-m99w-x7hq-7vfj), [RCE Windows](https://github.com/advisories/GHSA-p293-qw3h-jr36), [RCE Image Optimization](https://github.com/advisories/GHSA-2xp9-vwfh-vxw4).

## Probe de ronda 2

El archivo temporal `src/domain/review-pr58-r2-probe.test.ts` ejecutó siete contracasos y salió **7/7 PASS**. Eso demuestra los comportamientos incorrectos actuales:

```text
✓ publish_request admite AAL2_REQUIRED forzado
✓ admin_update_setting traduce clave y valor inválidos al genérico VALIDATION_ERROR
✓ accept_offer acepta una oferta cuyo courier no existe
✓ admin_verify_document arroja TypeError si falta el courier relacionado
✓ report_no_show retorna un output que su schema rechaza
✓ report_incident acepta una solicitud draft
✓ submit_offer sobreescribe una oferta sembrada con el primer ID de la secuencia
```

El probe y la mutación de cobertura se retiraron; ningún archivo de producción quedó modificado por la revisión.

## Mejora no bloqueante

- `admin_update_setting` declara `INVALID_SETTING_KEY` e `INVALID_SETTING_VALUE`, pero los rechazos del schema se traducen a `VALIDATION_ERROR`. La unión discriminada de H04 sí está corregida; conviene decidir y probar qué frontera emite los dos códigos específicos para que el catálogo no prometa errores inalcanzables.
- Vitest 3 avisa que el tercer argumento objeto usado por `tools/verify-build-boundaries.test.ts` quedará inválido en Vitest 4. Es preexistente y está fuera del alcance de T-006, pero importa al preparar la próxima actualización.
- `prettier --check` sobre los archivos tocados marca seis archivos. No es job bloqueante y parte del ruido es histórico/Windows; no lo mezclo con los cuatro defectos funcionales.

## No revisado / límites

- No corrí `pnpm test:db` local por falta de Docker. Verifiqué el contenido del job, no su color.
- No hay policies RLS en el diff; no corresponde inventar cobertura RLS para esta ronda.
- No aprobé ni mergeé la PR.
