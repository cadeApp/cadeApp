# Lecciones — PR #83 / T-115

**Fuente:** ronda 1 sobre `4b4f18b` y auditoría completa de ronda 2 sobre `4c2aded`.

> La numeración de la primera pasada se corrigió de AG-64…69 a **AG-76…81** porque, mientras #83 quedó abierta,
> otras revisiones mergeadas en `develop` ocuparon AG-64…75. La corrección es solo de trazabilidad: no cambia
> el contenido técnico de los hallazgos.

## Patrón dominante

`P08-control-no-cubre-lo-que-dice` reaparece en cuatro fronteras distintas: resultado de un mock como proxy
de la RPC invocada, blacklist como proxy de minimización, `ActionResult` como proxy de invalidación de caché
y builders como proxy de la procedencia de datos sensibles/económicos.

## AG-76 · Una Server Action se prueba por la llamada que hace y por lo que devuelve

**Origen:** H01.

> Si la RPC está mockeada, cada happy path afirma operación, cliente/input y resultado. El resultado solo no
> demuestra el cableado.

## AG-77 · La autorización de actions se revisa como matriz action × actor

**Origen:** H02.

> Enumerar para cada action `sin sesión` y `rol incorrecto`; un guard probado en otra action no protege esta.

## AG-78 · Un default se prueba omitiendo el campo

**Origen:** H03.

> Pasar explícitamente el valor por defecto no prueba el default. Si una action expone un booleano opcional,
> se prueba omitido y cada variante que la API decida conservar; si el flujo de producto fija una sola variante,
> estrechar la API es mejor que probar ramas que la UI no debe ofrecer.

## AG-79 · Privacidad se prueba con sentinelas, no con blacklist

**Origen:** H04.

> Cargar datos prohibidos como `SENTINEL_*` en un objeto deliberadamente más ancho y afirmar que ninguno aparece.
> La blacklist solo cubre lo que alguien recordó nombrar.

## AG-80 · Un rojo por infraestructura no valida el control

**Origen:** H05.

> La evidencia del principio 8 dice qué propiedad se mutó y qué aserción cayó. Import/setup/conexión rojos son
> una fase inicial válida, pero no son la mutación del control.

## AG-81 · La regla de privacidad debe expresar el trust boundary

**Origen:** D01.

> No mezclar fuga hacia actores no autorizados con uso de un dato por quien ya puede leerlo. `wa.me/<recipient_phone>`
> queda permitido para actor autorizado por RLS; logs, analytics y push siguen fuera.

## AG-82 · La ficha se vuelve a leer desde el develop actual, no solo desde el merge-base

**Origen:** H07.

> Una rama puede quedar técnicamente igual y volverse incorrecta porque la ficha avanzó. Al iniciar cada ronda
> se compara la ficha de `develop` actual con la que vio la rama. Si cambió el DoD, el rebase y la nueva fase roja
> van antes de implementar o validar.

## AG-83 · “Transiciones inválidas” significa enumerar una por action

**Origen:** H08.

> Cuando el DoD pide transiciones válidas e inválidas, una prueba de `INVALID_STATE_TRANSITION` no representa
> seis actions. La matriz es `action × {éxito, estado inválido}` y se completa antes de cerrar la fase roja.

## AG-84 · La procedencia de un dato se prueba en la frontera que lo obtiene

**Origen:** H09.

> Un builder que recibe `amountArs` solo demuestra formato. “Monto aceptado” requiere una prueba de query/ensamblado
> que demuestre que viene de la oferta `accepted`; lo mismo para contactos post-`matched` e identidad del cadete.

## AG-85 · Una tarea visual hace TDD también sobre estados y acciones destructivas

**Origen:** H10.

> Si el DoD obliga loading/empty/error/pending, foco, confirmación en dos pasos y targets táctiles, la fase roja
> incluye tests de componente/DOM para esas propiedades antes de escribir la vista. Tests de Server Actions no las cubren.

## AG-86 · La invalidación de caché es parte observable de una mutación

**Origen:** H11.

> Una Server Action puede devolver el `ActionResult` correcto y dejar la UI vieja. Si la regla exige
> `revalidatePath/revalidateTag`, el happy path afirma también la invalidación exacta.

## AG-87 · Los bordes de normalización se prueban exactamente

**Origen:** H12.

> Si el contrato dice “10 dígitos nacionales”, no alcanza con probar que 3 dígitos fallan. Probar 9/10/11
> (y formatos con prefijos) evita que un umbral barato se disfrace del contrato real.

## Advertencias

- H08–H12 ya estaban latentes en el primer diff y **mi ronda 1 no los encontró**. Es exactamente el costo que
  AG-37 pide evitar; por eso esta ronda fue un barrido completo y no una simple re-verificación.
- H07 no existía al abrir la PR: nació porque `develop` avanzó 6 commits y T-115 recibió una ficha visual más
  estricta. No se atribuye a P2 como una decisión incorrecta.
- Antes de implementar T05, `src/ui/alert-dialog.tsx` no existe en `develop`. La ficha ya prescribe qué hacer:
  abrir `contract-change` si esa primitiva es la requerida; no sustituirla silenciosamente dentro de T-115.
- D01 sigue resuelta por Lautaro073 y no autoriza tocar `AGENTS.md` dentro de T-115.
