# PR #83 · T-115 — Ronda 2 · auditoría completa desde cero

- **PR:** #83 · `feat/T-115-vista-de-viaje` → `develop`
- **SHA revisado:** `4c2adedbcae27d3b3cb754325a12769cda5e1749`
- **Código de producto:** sin cambios desde `4b4f18b`; `4c2aded` solo agregó la carpeta de revisión.
- **develop actual al revisar:** `b6bdac6cfe4c5ac9227e87692b8572e1f6bc2121`
- **Merge-base:** `720e2d4f39ab5b4d5d09a55016072eb8fe940855`
- **Estado de rama:** ahead 3 · behind 6 · diverged
- **Fecha:** 2026-09-24
- **Resultado:** **CON BLOQUEANTES (11)** · 1 mejora · D01 aceptada.

> Lautaro pidió revisar “como si fuera ronda 1”. Por trazabilidad no se borra el archivo anterior: esta es
> `ronda-2.md`, pero el método fue una auditoría completa desde cero, releyendo ficha, reglas, C06/R07/T05,
> diff y clases enteras. No fue una verificación de H01–H06.

## Lo más importante

La ficha oficial de T-115 cambió mientras la PR estaba abierta. En el merge-base pedía solamente mensajes/actions;
en `develop` actual exige además C06/R07/T05, transiciones válidas **e inválidas**, revelación post-`matched`,
cancelación en dos pasos, foco/48 px, loading/empty/error/pending y capturas a 390/360 px.

Los “Archivos permitidos” son idénticos. El problema no es scope de rutas: la fase roja quedó vieja.

Además, H08–H12 estaban ya en el primer diff y **mi ronda 1 no los vio**. Los registro como agujeros de mi revisión
anterior, no como trabajo nuevo de P2.

## Resumen

| ID | Sev. | Lugar | Problema | Estado |
|---|---:|---|---|---|
| H01 | alto | actions.test.ts:92 | no prueba RPC/input exactos | BLOQUEANTE |
| H02 | alto | actions.test.ts:58 | matriz auth 4/12 | BLOQUEANTE |
| H03 | alto | actions.test.ts:180 | “default” pasa `true`, no omite | BLOQUEANTE |
| H04 | alto | whatsapp.test.ts:56 | privacidad por blacklist | BLOQUEANTE |
| H05 | medio | log/T-115.md:13 | rojo por imports ≠ mutación | BLOQUEANTE |
| H06 | bajo | log/T-115.md:14 | bitácora contradictoria | MEJORA |
| H07 | alto | ficha / cuerpo PR | rama sigue DoD viejo | BLOQUEANTE |
| H08 | alto | actions.test.ts:80 | 5/6 estados inválidos sin test | BLOQUEANTE |
| H09 | alto | queries.test.ts ausente | sin control de datos del viaje / monto accepted | BLOQUEANTE |
| H10 | alto | tests UI ausentes | sin TDD de C06/R07/T05 ni estados visuales | BLOQUEANTE |
| H11 | alto | actions.test.ts:13 | 0 aserciones de revalidación | BLOQUEANTE |
| H12 | medio | whatsapp.test.ts:113 | borde <8 contradice contrato de 10 dígitos | BLOQUEANTE |
| D01 | decisión | AGENTS.md | `wa.me/<recipient_phone>` autorizado post-RLS | ACEPTADA |

---

## H01 · RPC/input exactos no observados · BLOQUEANTE

Las 6 pruebas felices programan el resultado de `callRequestRpc` y luego inspeccionan `res.ok/status`, pero
ninguna afirma qué nombre de RPC ni qué input se envió.

**Mutación roja que falta:** hacer que todas las actions llamen `mark_picked_up`. Los resultados mockeados
permiten que los happy paths actuales sigan verdes.

**Arreglo:** por action, afirmar el cliente, rpcName, input exacto y una sola llamada.

## H02 · Matriz de sesión/rol incompleta · BLOQUEANTE

Barrido completo:

| Action | sin sesión | rol incorrecto |
|---|---:|---:|
| picked up | ✅ | ✅ |
| delivered | ❌ | ✅ |
| courier cancel | ❌ | ❌ |
| no show | ❌ | ✅ |
| merchant cancel | ❌ | ❌ |
| republish | ❌ | ❌ |

4/12 celdas.

**Arreglo:** matriz `action × {UNAUTHENTICATED, UNAUTHORIZED_ACTOR}`.

## H03 · El test “por defecto” no prueba el default · BLOQUEANTE

`merchantReportNoShowAction` recibe explícitamente:

```ts
{ requestId, republish: true }
```

Eso no prueba el default de `report_no_show`.

**Corrección de mi ronda 1:** `false → cancelled` solo es obligatorio si la action conserva ese booleano como
parte de su API. C06 define “no llegó” con republicación; también es válido estrechar la action a ese flujo y
probar que **omitir** `republish` termina en `published`.

## H04 · “Sin datos de más” es blacklist · BLOQUEANTE

Agregar por ejemplo `Dirección exacta: SENTINEL_ADDRESS` a cualquiera de los dos mensajes deja verdes las
aserciones actuales: ninguna lista “dirección” entre los tokens prohibidos.

**Arreglo:** objeto deliberadamente más ancho con sentinelas para teléfono, direcciones, coordenadas, notas,
patente, IDs, etc.; afirmar que ningún sentinel aparece, además de los campos positivos permitidos.

## H05 · El rojo documentado no valida los controles · BLOQUEANTE

La evidencia pegada es:

- no existe `./actions`;
- no existe `@/lib/whatsapp`.

Eso es un comienzo de TDD válido, y el commit rojo separado `93ee171` está bien. Lo incorrecto es marcar
“cada prueba se demostró fallando al romper la regla”: ninguna aserción llegó a ejecutarse.

**Arreglo:** mutación concreta por propiedad, rojo, restauración de memoria, verde.

## H06 · Bitácora contradictoria · MEJORA

La misma entrada dice “Apertura de PR #83 en Draft” y luego “Falta: … abrir PR Draft”. Además conserva
`Último commit: 37b656d`.

Actualizarla en el próximo cierre.

---

## H07 · La PR sigue una ficha que ya no es la oficial · BLOQUEANTE

Comparación mecánica:

- merge-base de la rama: `720e2d`;
- `develop` actual: `b6bdac6`;
- rama: ahead 3 / **behind 6**;
- “Archivos permitidos”: **idénticos**;
- DoD: pasó de 4 a 8 ítems.

El cuerpo del PR todavía dice “DoD (copiado de la ficha)” y muestra el DoD viejo.

La ficha vigente ahora exige, entre otras cosas:

- C06/R07/T05;
- transiciones válidas e inválidas;
- contactos/direcciones solo después de `matched`;
- cobro en mano;
- cancelación en dos pasos con motivo, foco y 48 px;
- loading/empty/error/pending;
- navegador + capturas 390/360.

**Arreglo:** rebase sobre `develop`, releer la ficha/directiva visual, ampliar la fase roja **antes** de
implementar y actualizar cuerpo/bitácora.

## H08 · Solo 1/6 transiciones inválidas está en rojo · BLOQUEANTE

El nuevo DoD dice literalmente “transitions válidas/ inválidas”.

Solo `markTripPickedUpAction` tiene un caso `INVALID_STATE_TRANSITION`. No lo tienen:

1. `markTripDeliveredAction`
2. `courierCancelTripAction`
3. `merchantReportNoShowAction`
4. `merchantCancelTripAction`
5. `republishTripAction`

**Mutación:** tragar o remapear `INVALID_STATE_TRANSITION` en cualquiera de esas cinco actions no afecta la suite.

**Arreglo:** matriz por action con happy path + invalid-state propagation.

## H09 · No existe test de la query/datos del viaje · BLOQUEANTE

No existe `src/features/trips/queries.test.ts` y ambos tests nuevos contienen **0 referencias a queries**.

Eso deja sin control justo la frontera que decide:

- contactos y direcciones post-`matched`;
- nombre/foto/vehículo/patente del cadete;
- datos de comercio/cliente para R07;
- medio de pago y cambio;
- **procedencia del monto aceptado**.

`whatsapp.test.ts` demuestra que si le pasan `amountArs=1800`, imprime `$ 1.800`; no demuestra que ese 1800
salga de la oferta `accepted`.

**Arreglo:** fase roja de query/ensamblado, con acceptedOfferId/accepted offer como fuente y revelación según estado/rol.

## H10 · No hay TDD visual para C06/R07/T05 ni estados obligatorios · BLOQUEANTE

El diff de producto tiene `actions.test.ts` y `whatsapp.test.ts`; no hay ningún `*.test.tsx` de trips.

Por eso hoy podrían implementarse y quedar verdes:

- cancelar con un clic en vez de confirmación en dos pasos;
- motivo sin validación visual;
- sin foco visible;
- targets de 44 px;
- sin estado pending del botón;
- sin Skeleton/loading;
- sin empty/error;
- datos protegidos visibles en una vista incorrecta.

La ficha actual exige esos comportamientos **cubiertos**.

**Arreglo:** tests de componente/DOM en rojo antes de la UI.

### Primitiva T05

`src/ui/alert-dialog.tsx` **no existe** en develop; `src/ui/dialog.tsx` sí. T05 especifica AlertDialog y la
ficha ya dice qué hacer si falta una primitiva compartida: **contract-change antes de tocar `src/ui/**`**.
No lo cuento como un hallazgo extra: es el procedimiento de desbloqueo de H10.

## H11 · La invalidación de caché está completamente ciega · BLOQUEANTE

`next/cache` se mockea en líneas 13–16, pero hay:

- 0 `toHaveBeenCalledWith` / `toHaveBeenCalledTimes` sobre `revalidatePath/revalidateTag`;
- 0 `expect(...revalidate...)`.

La regla 25 exige que una mutación invalide path/tag. Las actions de offers en develop ya aplican este patrón.

**Mutación:** eliminar toda revalidación de las seis actions futuras; la suite actual sigue verde.

**Arreglo:** cada happy path afirma la invalidación exacta que necesita la vista/lista afectada.

## H12 · El test de teléfono fija un borde demasiado laxo · BLOQUEANTE

El formatter canónico documenta:

> “Extrae los **10 dígitos nacionales** de un número móvil argentino”.

Pero la implementación heredada solo lanza si `digits.length < 8`, y el test nuevo replica ese borde:

```ts
expect(() => buildWhatsAppUrl('123', 'Hola')).toThrow();
```

Reproducción del algoritmo actual:

```text
1234567     => THROW
12345678    => https://wa.me/54912345678?text=Hola
123456789   => https://wa.me/549123456789?text=Hola
1234567890  => https://wa.me/5491234567890?text=Hola
12345678901 => https://wa.me/54912345678901?text=Hola
```

El nuevo control no detectaría 8/9/11 dígitos.

**Arreglo:** probar el borde documentado (9/10/11 y formatos +54/549/0/15). Dentro de T-115 se puede validar el
resultado normalizado antes de delegar; si se decide corregir el formatter único, eso requiere contract-change
porque `src/lib/format/**` no está autorizado.

---

## D01 · `wa.me/<recipient_phone>` · ACEPTADA

Sigue vigente la decisión de Lautaro073: el teléfono puede formar parte del `wa.me` cuando comercio/cadete
aceptado ya está autorizado por RLS a leerlo. No tocar `AGENTS.md` dentro de T-115.

## NO TOCAR / correcto

- **Mapa:** reservado expresamente para T-117; no pedirlo en T-115.
- **Commit rojo separado:** `93ee171` contiene solo bitácora + tests; eso está bien.
- **Ausencia de implementación:** la PR sigue Draft en fase roja; no es un hallazgo por sí sola. El problema es
  que la fase roja ya no cubre la ficha vigente.
- **Alcance:** los archivos actuales están dentro de la lista permitida.
- **D01:** no volver a bloquear el uso autorizado de `wa.me`.

## Checks de esta ronda

- Ficha: leída desde **develop actual**, no desde la rama.
- Comentarios/threads: leído el comentario de ronda 1; 0 threads inline.
- Bitácora: leída completa.
- Alcance: ✅.
- `test:db`: n.a. para el diff actual.
- `pnpm typecheck/lint/test`: no ejecutados; el entorno sigue sin resolver `github.com` para obtener checkout.
- CI: **no consultado**, porque quedan bloqueantes.
- Mutaciones/análisis: H01–H05 revalidados por ser los mismos blobs; H07–H12 enumerados mecánicamente y H12
  reproducido con el algoritmo exacto del formatter.

## Qué tiene que pasar antes de la próxima revisión

1. Rebasear contra `develop` y pullear esta carpeta de revisión.
2. Actualizar cuerpo y bitácora a la ficha vigente.
3. Abrir contract-change si T05 requiere agregar AlertDialog a `src/ui`.
4. Completar la fase roja: H01–H05 y H08–H12.
5. Implementar C06/R07/T05 y actions/queries/messages.
6. Verificar 390/360 px y estados visuales; adjuntar capturas.
7. Correr `pnpm typecheck && pnpm lint && pnpm test`.
8. Volver a pedir revisión.
