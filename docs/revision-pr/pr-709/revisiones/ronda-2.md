# Revisión independiente R2 — PR #709 · T-434 · CC-050

**Fecha:** 2026-11-12 (Argentina). **SHA verificado:** `1c84e9976cc5bf5655985b4f959fcf12569647b1`. **Base:** `develop@dba3314f17f2068b6ff0c7596476d81c2c92e1c1`.

**Resultado: CON BLOQUEANTES (2)** nuevos (PR709-H07 y H08), y **1 mejora** (PR709-H09). Las seis observaciones de R1 están **arregladas-verificadas a nivel documental**, pero **no equivalen a SEC-09 implementado/probado**. La PR debe seguir abierta sin mergear.

## Entrada y alcance

- Head del PR consultado en GitHub: `1c84e9976cc5bf5655985b4f959fcf12569647b1`. La comparación `d74611f...1c84e997` encontró 1 commit y exactamente 4 documentos: `CC-050.md` (+157/-35), `T-434.md` (+82/-23), `implementation-plan.md` (+1/-1) y `log/T-434.md` (+28). La carpeta `docs/revision-pr/pr-709/` seguía intacta desde el commit anterior del revisor. `develop` permanecía en `dba3314f`, sin avance ni conflicto aparente por ancestría; **no** se ejecutó `git merge-tree`.
- Leídos los comentarios: comentario técnico R1 del revisor y comentario del bot de Vercel; el cuerpo original del PR no está sincronizado con los cambios R2. T-434 **no existe en develop**, se contrasta contra el archivo nuevo en la rama, y el alcance autorizado documental se conserva.
- Los checks del autor `pnpm exec vitest run tools` 10 archivos/123 tests se registraron en la bitácora; **no fueron reproducidos en un clone**. No se ejecutaron `pnpm`, pgTAP, Docker, Supabase ni scripts `docs/revision-pr/**`. Por haber bloqueantes nuevos, **no se usa CI verde como aprobación**.
- Evidencia independiente: en runtime JS del conector se ejecutaron **6/6 aserciones documentales** para H01-H06 y **6/6 mutaciones en memoria** (cada una rompe una exigencia textual y vuelve rojo su control estático), NO mutaciones RED→GREEN de la implementación ni el harness bajo `docs/revision-pr/**`. Demostración horaria independiente con `Intl` para UTC/Tucumán/Los Ángeles. El script completo para reproducir inspección documental se agrega a [evidencia/comandos.md](../evidencia/comandos.md).

## Estado de hallazgos R1

| ID | Resultado R2 | Inspección puntual |
|---|---|---|
| **H01** | **arreglado-verificado (documental)** | `CC-050 `3b` especifica RPC de disputa con aal2, UUID/teléfono, filtro `pending` no enviada con documentación y máximo 10, con salida enmascarada; ruta admin separada y pgTAP de cola normal intacta. |
| **H02** | **arreglado-verificado (documental)** | `courier_dni_released` en allowlist de motivo, `dni_registered` en campos visibles, etiqueta, pantalla, auditoría sin hash y rechazo de motivos con formas de DNI/HMAC; riesgo residual reconocido. |
| **H03** | **arreglado-verificado (documental)** | DoD de 5 errores `finalize` con cupo 5, sexto `RATE_LIMITED`, fronteras de motivo, auditoría única y mutaciones RED por invariante. No se han ejecutado en DB. |
| **H04** | **arreglado-verificado (documental)** | Server Component `page.tsx` arma WhatsApp con env del servidor y helper público; prop `string|null`, ausencia de enlace con número inválido, suites page/form y archivos autorizados. |
| **H05** | **arreglado-verificado (documental)** | Copy específico de cupo diario y test de UI; **advertencia:** al resolver H07 es obligatorio alinear «mañana» con el huso horario escogido. |
| **H06** | **arreglado-verificado (documental)** | CC en PR, dependencias reales de develop y decisiones automáticas atribuidas correctamente en CC, ficha y bitácora. El cuerpo PR pendiente se registra aparte como H09. |

Los seis registros originales se conservan en `hallazgos.jsonl` con `verificado_en_sha=1c84e997...` y `verificado_metodo` limitado **expresamente a inspección documental + aserciones estáticas independientes**. El resultado de los tests de implementación seguirá pendiente hasta la PR correspondiente.

## BLOQUEANTES NUEVOS

### PR709-H07 — Inicio de día dependiente del huso horario que trae el cliente

**Fuente:** `docs/contracts/CC-050.md:56-64`, RPC `consume_courier_application_attempt`. **Severidad:** alto · **Patrón:** `P08-control-no-cubre-lo-que-dice` · origen: ficha.

El contrato exige `window_start = date_trunc('day', now())` sobre una columna `timestamptz`. PostgreSQL documenta que ese truncamiento usa la variable `TimeZone` de la transacción salvo que se proporcione tercer parámetro. PostgREST admite `Prefer: timezone=<zona>` y modifica el huso horario de la sesión HTTP. Fuentes oficiales:

- https://www.postgresql.org/docs/16/functions-datetime.html (9.9.2)
- https://docs.postgrest.org/en/v12/references/api/preferences.html#timezone

**Prueba lógica independiente (NO contra staging):** para el mismo instante `2026-11-12T17:00:00Z`:
- sesión UTC: `window_start = 2026-11-12T00:00:00Z`;
- sesión America/Argentina/Tucuman: `window_start = 2026-11-12T03:00:00Z`;
- sesión America/Los_Angeles: `window_start = 2026-11-12T08:00:00Z`.

Los tres timestamps son **claves distintas** para la misma cuenta, acción y fecha civil. Si PostgREST permite aplicar la preferencia a esa RPC en el despliegue, el cliente puede obtener un cupo por cada ventana, rompiendo SEC-09. **No** se afirmó haber explotado el endpoint real.

**Corrección obligatoria del CC y la ficha:** fijar zona **dentro** de la función; se recomienda `date_trunc('day', now(), 'America/Argentina/Tucuman')` para que «día» y «volvé mañana» coincidan con la jurisdicción de la app. PostgreSQL soporta el tercer parámetro precisamente para ignorar la zona de la sesión. Si se mantiene UTC por decisión de producto, debe fijarse explícitamente `'UTC'`, describir el reinicio a las 21:00 de Tucumán y cambiar el copy «mañana» cuando corresponda; no dejar `date_trunc('day', now())`. No crear setting mutable del contador.

**Pruebas faltantes:** en `supabase/tests/cc050_courier_dni_hardening.sql` simular dos zonas de sesión con `set_config('TimeZone', 'UTC', true)` y `set_config('TimeZone', 'America/Argentina/Tucuman', true)` bajo el **mismo actor**; luego de cinco consumos, el siguiente devuelve `RATE_LIMITED` y no crea otra fila de `rate_limits`. No depender del huso del runner. Probar frontera de día local con reloj fijo/test determinista cuando sea posible. Añadir test que exija zona fija o introspección de función. **Mutación RED futura:** reemplazar `date_trunc('day', now(), 'America/Argentina/Tucuman')` por versión de dos argumentos; debe permitir otro consumo bajo la segunda zona y fallar la prueba de cupo único. Poner en rojo el caso REAL, no una expectation tautológica.

**Decisiones:** ninguna abierta: el límite 5/día/cuenta sigue igual (D1-A), y fijar el calendario local es la recomendación técnica consistente con la UX aprobada; registrar en `Decisiones` que la selección de zona es del revisor/agente bajo autorización automática, **nunca una elección expresa de Lautaro**.

### PR709-H08 — Ambigüedad de salida JSON y cast condicional de búsqueda de disputa

**Fuente:** `CC-050.md:135-146` frente a `CC-050.md:172-176`. **Severidad:** medio (bloqueante documental: contrato compartido) · **Patrón:** `P11-api-publica-inconsistente` · origen: ficha.

La RPC nueva se declara `returns jsonb` y «devuelve hasta 10 filas» (no dice si es un array u objeto), mientras el contrato obligatorio en dominio exige **objeto** `{ candidates: [...] }`. Un agente puede implementar `jsonb_agg` como array y pasar el SQL aunque el parser de RPC falle en la app. Además se describe la comparación `c.profile_id = p_lookup::uuid` **o** por teléfono; si se hace un solo predicado `OR` evaluando `p_lookup::uuid` para un teléfono, ese cast es inválido y fallaría la ruta por teléfono. El texto no impone ramificar por tipo validado antes de hacer el cast.

**Corrección técnica:** definir en ``3b` una única salida `jsonb_build_object('candidates', coalesce(v_rows, '[]'::jsonb))`, con `candidates` array máximo 10, incluso sin coincidencias (`{"candidates":[]}`). En dominio `outputSchema` y fake, usar esa **misma** envoltura. Especificar `IF` cuando `lookup` es UUID exacto (cast solo allí) y `ELSIF` cuando es teléfono completo validado (comparación contra teléfono normalizado, **sin** ningún `::uuid` en esa rama). Limitar formato de teléfono a dígitos y separadores telefónicos razonables (espacios, `+`, `()`, guiones), luego extraer 10..13 dígitos; no aceptar basura como `foo3812345678` por quitar todos los caracteres sin inspección. No cambiar la decisión de búsqueda separada ni agregar endpoints.

**Pruebas:** pgTAP de JSON vacío y llenado como objeto `candidates`, schema domain, búsqueda con teléfono puro y formateado sin excepción, rechazo `foo3812345678` y `%3812345678`, UUID exacto válido y búsqueda vacía. **Mutaciones RED futuras:** retornar array raíz en vez del objeto; evaluar `p_lookup::uuid` en la rama telefónica; aceptar texto basura con 10 dígitos. Cada test debe fallar la propiedad correspondiente.

## MEJORA

### PR709-H09 — Fuente de verdad documental aún desactualizada en cuerpo PR e invariantes

- En `CC-050.md:220` la matriz dice «Sin las **dos** RPC nuevas», ahora son **tres**.
- El cuerpo de la PR sigue describiendo solo D1-A, D2-A y D3-A y la autorrevisión «revisión independiente pendiente», sin reflejar D4-B, D5-A, D6-A, el canal WhatsApp, la búsqueda separada y la auditoría visible. No cambiar ese bloque histórico por un «SIN BLOQUEANTES» nuevo: actualizar resumen de alcance, procedencia automática y un enlace al informe de R2.
- No afecta las RPC si se corrige luego, pero se toma la mejora con H07/H08 para no trasladar a implementación una ficha y un cuerpo divergentes.

## Cobertura y reconciliación

Confirmado en el head R2:
- El listado de archivos permitidos de T-434 incluye nuevas rutas SSR, admin, auditoría, pgTAP CC-044 y tests; la fila T-434 del plan y `Impacto exacto` del CC contienen sus capas. El diff del agy solo modifica los 4 docs, sin cambios en `docs/revision-pr/**`.
- `D4-B, D5-A, D6-A` y D1-A/D2-A/D3-A están registrados como elecciones **automáticas bajo autorización permanente**, no como aprobación expresa personal en la sesión.
- Las pruebas de las tres RPC siguen siendo compromisos FUTUROS del DoD, no evidencia ejecutada.
- **Nuevo gap** de ventana horaria y contrato JSON debe ser reconciliado en los mismos tres documentos antes de mergear.

## Resultado / siguiente paso

**CON BLOQUEANTES (2)**. Agente: corregir únicamente `docs/contracts/CC-050.md`, `docs/tasks/T-434.md`, la fila `T-434` del plan y `docs/tasks/log/T-434.md`; después sincronizar el cuerpo del PR. No editar `docs/revision-pr/**`. Ronda 3 revisará el SHA nuevo. **Sin aprobar ni mergear**.
