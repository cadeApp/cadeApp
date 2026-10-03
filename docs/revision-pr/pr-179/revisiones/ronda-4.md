# Ronda 4 — PR #179 / T-304

**Fecha:** 2026-10-03  
**SHA funcional revisado:** `08d8193dd71ff5161f1cd3255ac3da9823259480`  
**Resultado:** **CON BLOQUEANTES (6)**

## Preflight

- PR abierta, no Draft.
- Rama sincronizada: `behind=0`, `ahead=20`.
- Diff contra develop limitado a los archivos autorizados de T-304 + `docs/revision-pr/pr-179/**`.
- `docs/revision-pr/pr-179/**` quedó byte-a-byte intacto desde el commit de R3 `75b74466` antes de esta ronda.
- La ampliación de harness en la ficha de rama sigue siendo la excepción D01=1-A ya autorizada por P1; no hay decisión nueva.
- No se inspeccionó CI actual: los bloqueantes estáticos impiden entrar todavía en fase de aprobación.
- Intento de clonar el SHA para mutaciones independientes: no disponible por DNS del entorno (`Could not resolve host: github.com`). La comprobación de R4 es estática/source-history; los runs del body siguen sin contarse como verificación independiente.

## Hallazgos anteriores

### H03 — SIGUE BLOQUEANTE
La evidencia RED nueva no rompe el sistema ni los datos bajo prueba: cambia el oráculo.

Commit `14e72b29`:

```diff
- expect(inspection.requestStatus).toBe('published');
+ expect(inspection.requestStatus).toBe('draft'); // MUTACIÓN TEMPORAL H03
```

Eso solo demuestra que Playwright falla cuando se escribe una expectativa falsa. Contradice dos instrucciones explícitas:
- no cambiar expectativas correctas;
- las mutaciones M1-M4 debían romper propiedades/datos test-owned, no el `expect`.

Además solo se presentó una mutación E2E real; faltan atomicidad, TTL, delivered y CC-015 según la batería pedida.

### H04 — SIGUE BLOQUEANTE
El body y `docs/tasks/T-304.md` marcan RED/DoD completos aunque H03 no es válido y H16 deja un negativo con falso verde posible.

### H10 — VERIFICADO
`develop...head` da `behind=0`.

### H11 — ARREGLADO SIN VERIFICAR
Por inspección, cleanup descubre incidents y los elimina antes de requests. No se inspecciona el run actual todavía porque la ronda sigue bloqueada.

### H12 — ARREGLADO SIN VERIFICAR
Por inspección, `seedAdminUser` crea merchant temporal, trackea el user, borra subtipo, promueve profile y actualiza metadata. Falta verificación independiente de runtime al final.

### H13 — ARREGLADO SIN VERIFICAR
`getPlatformSettingNumber` ya falla cerrado y no tiene fallback 45. Falta ejecución independiente al final.

### H14 — VERIFICADO POR INSPECCIÓN
La documentación ya no inventa un gap de push; atribuye correctamente el despacho a `src/server/rpc/requests.ts` / T-206.

### H15 — PARCIAL
El assert de ausencia fue agregado, pero el oráculo que alimenta `incidents` puede tragarse un error y devolver `[]`. H16 bloquea su cierre.

---

## H16 · Oráculo de incidents fail-open · BLOQUEANTE ALTO

En `getRequestInspectionData`:

```ts
let incidents = [];
try {
  const { data: incidentsData } = await ...
  ...
} catch {
  // Tolerante en mocks unitarios
}
```

No se inspecciona `error`, y una excepción también se ignora.

Luego Fila 8 hace:

```ts
expect(expiredInspection.incidents ?? []).toHaveLength(0);
```

Por lo tanto el mismo verde significa dos cosas distintas:
1. PostgreSQL respondió correctamente con cero incidentes;
2. la consulta falló y el helper devolvió el valor inicial `[]`.

Es la variante exacta de **pr-82/AG-76**: una aserción negativa puede pasar sin ejercer la fuente nueva.

La misma clase existe en `request_cancellation_reasons`: allí los asserts positivos suelen volverla visible, pero el helper igualmente no debe ocultar fallos de un oráculo E2E.

**Corrección:** ambos oráculos deben fallar cerrado ante `error` o excepción; los mocks unitarios deben modelar explícitamente esas tablas.

## H17 · Bitácora histórica reescrita · BLOQUEANTE MEDIO

La entrada Ronda 2 era:

> se documentó explícitamente el gap contractual...

En el SHA actual esa línea fue reemplazada retroactivamente por la explicación correcta de T-206.

La corrección conceptual es buena, pero el mecanismo viola la bitácora append-only. **pr-82/AG-97** existe justamente para preservar lo que se sabía en cada sesión.

**Corrección:** restaurar esa única línea histórica exactamente como estaba en `75b74466` y añadir la rectificación en la entrada nueva; no volver a editar sesiones anteriores.

## H18 · Controles unitarios nuevos no cubren todo lo que declaran · BLOQUEANTE MEDIO

Caso H11:

```ts
it('... agrega los IDs descubiertos a createdIncidentIds', ...)
...
expect(mockClient.from).toHaveBeenCalledWith('incidents');
```

Ese assert solo demuestra que se consultó la tabla. Si se elimina la línea que agrega `row.id` al tracking, el assert final sigue siendo verdadero. El control debe demostrar que el ID descubierto llega al `delete().in('id', [incId])`.

También falta el negativo pedido para `seedAdminUser`: no hay test que haga fallar `merchants.delete` y exija que el helper falle conservando el user ID trackeado.

Esto repite **P08 / pr-82/AG-76**.

## Alcance / calidad

- No hay `.skip`, `.only`, `.fixme` ni sleeps introducidos en los archivos T-304.
- No aumentó el uso de `any` respecto de develop en el test del seed.
- La carpeta del revisor no fue tocada por asako.
- La ficha de rama amplía la ficha de develop, pero esa ampliación corresponde a D01/D02 ya decididas por P1; no se vuelve a preguntar.

## CI

No inspeccionado en esta ronda. Según el protocolo, CI se abre recién cuando los bloqueantes estáticos están cerrados. Los IDs `37091625220`, `37092161863` y `37092681742` permanecen como declaraciones/evidencia del autor hasta R5.

## Criterio de Ronda 5

1. H03: M1-M4 reales sin tocar expectations.
2. H16: incidents + cancellationReasons fail-closed.
3. H17: historial de bitácora restaurado; rectificación solo append-only.
4. H18: controles que fallen si se corta la propagación del incId y si falla merchants.delete.
5. Body/ficha no declaran H03/H15 completos antes de la evidencia final.
6. `behind=0`.
7. Recién entonces inspeccionar CI, los logs exact-head y reproducir la evidencia RED/GREEN del autor.
