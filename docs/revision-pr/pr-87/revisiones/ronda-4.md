# Ronda 4 — PR #87 (T-118) — Revisión independiente

- **SHA revisado:** `cf6fa22299b4df28982b0babb0ba7bc0aa146526`
- **develop:** `b6bdac6cfe4c5ac9227e87692b8572e1f6bc2121`
- **Fecha:** 2026-09-25
- **Desde R3:** 1 commit de implementación después de `81d595d`; 11 archivos tocados; `docs/revision-pr/pr-87/**` intacto.
- **GitHub:** PR mergeable al iniciar/cerrar la inspección.
- **CI:** no inspeccionado porque persisten bloqueantes.
- **Checks locales del proyecto:** no ejecutables en este runtime sin checkout del repo. Se ejecutaron probes aislados de Node para mutaciones del scanner y topes de métricas.

## Informe formato revisar-pr

~~~text
Informe revisar-pr — T-118 — 2026-09-25 — generado por revisión independiente
Resultado: CON BLOQUEANTES (4)
Checks locales: typecheck ⚪ no ejecutado · lint ⚪ no ejecutado · test ⚪ no ejecutado · test:db n.a.
BLOQUEANTES:
- [src/app/route-integrity.test.ts:111-116; src/features/requests/components/merchant-history-view.tsx:190] (PR87-H09) el scanner general resuelve bien el filesystem pero sólo extrae rutas literales entre comillas. No ve template literals reales como href={`/merchant/requests/${req.id}`}; una mutación a /ghost/${id} queda verde.
- [PR #87 body/comments + Stitch P00/C00/R00] (PR87-H10) ya hay imágenes, pero la evidencia vinculante sigue incompleta/incorrecta: falta C05, falta R02 individual y R05; se usa P04-documento-legal como falsa referencia de /forgot-password; no hay evidencia específica de reduced-motion.
- [src/features/requests/queries.ts:481,491,555] (PR87-R04) la corrección acotada de métricas impone topes silenciosos: máximo 10×50=500 solicitudes y sólo las primeras 50 accepted_offer_id del día. Con 51 ofertas el promedio puede ser incorrecto.
- [src/features/requests/queries.ts:423-452; merchant/dashboard/page.tsx:36; merchant-requests-list.tsx:126] (PR87-H20) C02 sigue cargando/renderizando terminales porque getMerchantRequests defaulta status=all sin filtro; el dashboard vinculante es de solicitudes activas.
MEJORAS:
- En el body, corregir también “P01–P04”: T-118 exige P01–P03 + /forgot-password funcional; P04 es documento legal de T-311.
No revisado / dudas para Lautaro073:
- ninguna decisión de alcance pendiente. A01/A02 siguen aceptadas.
- CI no se inspeccionó porque quedan bloqueantes.
~~~

## Revalidación de los 8 bloqueantes de R3

### Cerrados en `cf6fa22299b4df28982b0babb0ba7bc0aa146526`

- **H01**: rutas legales inexistentes fuera de `isPublicRoute`; post-login usa whitelist/patrones existentes por rol.
- **H16**: `paid_until` se formatea como fecha civil sin `Date`.
- **H17**: “Todas” filtra `delivered|cancelled|expired` antes de paginar.
- **H18**: historial hidrata cadete + monto aceptado real.
- **R03 (defecto original)**: ya no existe una lectura única ilimitada; usa lotes de 50.
- **H19 (defecto original)**: corte del día de Aguilares y tarifa diaria, no histórica.

### Parciales

- **H09**: el resolutor es general, pero el extractor de navegación no cubre template literals.
- **H10**: los adjuntos existen, pero no cubren toda la matriz visual vinculante ni reduced-motion.

### Nuevos

- **R04**: los lotes acotados tienen un techo global no autorizado (500 solicitudes / 50 ofertas).
- **H20**: C02 muestra estados terminales en la lista que debe ser activa.

## Probes independientes

### H09 — template literals ciegos

Con las mismas regex del helper:

~~~text
<Link href={`/ghost/${id}`}>x</Link> => false
router.push(`/ghost/${id}`) => false
return { redirectTo: '/ghost' } => true
~~~

Por tanto una mutación del prefijo de un link dinámico real no hace rojo el control.

### R04 — truncación silenciosa

~~~text
51 ofertas: queriedCount=50
montos: 50 × 1000 + 1 × 10000
promedio correcto = 1176
promedio con slice(0,50) = 1000

501 solicitudes
batchSize = 50
maxBatches = 10
filas alcanzables = 500
omitidas = 1
~~~

## Evidencia visual

Se verificó por API que el commit visual `bc27f5eea7fbdeb07b224d9b908b1259e8c51a2a` existe y contiene 23 PNG, y que el body/comentario de PR los renderiza como imágenes.

Contraste con los README vinculantes:
- C00 incluye **C05-confirmar-aceptacion**; no hay PNG de implementación C05 en el commit visual ni fila C05 en la tabla.
- R00 incluye **R02-onboarding-vehiculo** y **R05-ofertar**; la tabla agrupa R01/R02 usando sólo referencia/implementación R01 y omite R05.
- P00 define **P04-documento-legal** como Términos/Privacidad, no recuperación de contraseña; el body lo etiqueta como “P04 — Recuperar”.
- La evidencia A11y enumera focus/targets/safe-area, pero no reduced-motion.

No se necesitó inspeccionar píxel por píxel para estos incumplimientos: faltan/están mal identificados entregables explícitos.

## CI

No inspeccionado: persisten 4 bloqueantes.
