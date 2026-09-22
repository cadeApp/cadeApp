# PR #56 · Ronda 1 — `3a6876b`

| | |
|---|---|
| **SHA revisado** | `3a6876b` |
| **Tarea** | T-005 (Fase 0 — Fundaciones y contratos) |
| **Base** | `f698539` |
| **Tamaño** | 9 archivos, +767 / −0 |
| **Fecha** | 2026-09-22 |

## Veredicto

**El diseño de lectura está muy bien y el de escritura tiene dos agujeros de escalada de privilegios.**

Lo que hay que reconocer primero, porque es lo difícil: **la matriz se prueba con los roles de verdad.** `pg_temp.act_as()` hace `set local role authenticated` y setea `request.jwt.claims` con el `sub`, así que `auth.uid()` devuelve el actor. Eso es `AG-29` aplicada antes de que se la pidiera, y es la diferencia entre una matriz verificada y una decorativa. `rls_enabled.sql` además es **genérico**: barre `pg_class` en vez de una lista, así que atrapa cualquier tabla futura sin RLS.

Pero el `with check` de dos políticas de actualización no congela las columnas que deciden privilegios:

> **Un repartidor puede ponerse `license_status = 'verified'` e `insurance_status = 'verified'` a sí mismo.** Eso lleva `doc_level` —columna generada— a 2, sin que ningún admin lo revise.

> **Un comercio puede ponerse `subscription_status = 'active'` y `paid_until = '2099-12-31'`.** Se autoconcede la suscripción.

Ninguna de las dos rompe nada **hoy**, porque todavía no hay nada que consuma `doc_level` ni `subscription_status`. Rompen a T-006 y T-007, que van a construir encima creyendo que esos campos significan algo.

| | |
|---|---|
| Abiertos | 9 (2 altos, 4 medios, 3 azules) |
| **Bloqueantes** | **2** (H01, H02) |
| Alcance | 9 archivos, **0 fuera de la ficha** |
| CI | **9 de 9** · `db-tests` con **58/58** pgTAP en 3 archivos |

## Checks en `3a6876b`

| Comando / job | Resultado |
|---|---|
| `pnpm typecheck` · `pnpm lint` | exit 0 |
| `pnpm test` | 72/72 Vitest · 18/18 workflows |
| `db-tests` en CI | **pass** · `rls_enabled.sql ok`, `rls_matrix.sql ok`, `structure.sql ok` · `Files=3, Tests=58` · `Result: PASS` |
| CI completo | 9 de 9 |
| Alcance | 9 archivos, **0 fuera** — novena ronda consecutiva |

---

## Lo que está muy bien

- **La matriz corre con los roles reales.** `act_as()` combina `set local role` con `request.jwt.claims`, que es exactamente cómo lo hace Supabase en producción. Sin eso, quince aserciones pasarían sin verificar nada — es el error que yo mismo había anticipado en `AG-29` y acá no está.
- **`rls_enabled.sql` es genérico, no una lista.** Dos aserciones sobre `pg_class`: ninguna tabla de `public` sin `relrowsecurity`, ninguna sin al menos una policy. Eso cierra el residual que había dejado en la #54, donde la RLS se habilitaba recorriendo un array de 14 nombres escrito a mano. Y la fase roja está demostrada: la bitácora registra que con una tabla `_table_without_rls` plantada fallan 2/2.
- **El esquema `app_private` con funciones `security definer` es la decisión correcta**, y por dos motivos a la vez: evita la recursión de RLS —una policy sobre `profiles` que consulta `profiles`— y mantiene los helpers fuera de `--schema public`, así que el contrato de tipos no se mueve. Está bien razonado y bien explicado.
- **La aserción del invariante que más importa usa el conjunto exacto, no un conteo:**
  ```sql
  select is(
    (select array_agg(request_id order by request_id) from public.delivery_request_contacts),
    array[pg_temp.req_m1_matched_id()], ...
  ```
  y hay un caso negativo con un **segundo repartidor aprobado** que no fue aceptado en ninguna solicitud y ve 0 contactos. Eso es lo que el DoD pedía, probado en las dos direcciones.
- **La prueba 15 cierra `PR54-H07`**, que era mío: un comercio hace `update` como `authenticated`, se dispara `set_updated_at` y `lives_ok` afirma que no hay error de privilegios. La duda que había dejado abierta quedó resuelta por ejecución.
- **El admin se crea con el procedimiento oficial** —alta como `merchant` y `update` del rol—, así que el bootstrap de `PR54-H03` está ejercitado por segunda vez en un archivo distinto.
- **El bucket es privado**, con `file_size_limit` y `allowed_mime_types`, el `insert` está acotado a `courier/<auth.uid()>/`, y hay una aserción de que un repartidor autenticado no puede listar objetos.

---

## 🔴 H01 · Un repartidor puede verificarse los documentos a sí mismo

**`supabase/migrations/20260922051650_rls_v1.sql:176` · alto · bloqueante**

```sql
create policy couriers_update_self on public.couriers
  for update to authenticated
  using (profile_id = auth.uid())
  with check (
    profile_id = auth.uid()
    and status = (select c.status from public.couriers c where c.profile_id = auth.uid())
    and dni_hmac is not distinct from (select c.dni_hmac from public.couriers c where c.profile_id = auth.uid())
  );
```

Congela `status` y `dni_hmac`, que es la parte difícil y está bien resuelta. Lo que queda abierto son las columnas que decide un admin:

| Columna | ¿Congelada? | Qué significa |
|---|---|---|
| `status` | **sí** | aprobado / pendiente / suspendido |
| `dni_hmac` | **sí** | identidad |
| `license_status` | **no** | resultado de la revisión de la licencia |
| `insurance_status` | **no** | resultado de la revisión del seguro |
| `decided_by`, `decided_at` | **no** | quién y cuándo decidió |
| `deactivated_at` | **no** | baja operativa |

`doc_level` es `generated always as (...) stored` sobre `license_status` e `insurance_status`, así que:

```sql
-- como el repartidor, con su propio JWT
update public.couriers
set license_status = 'verified', insurance_status = 'verified'
where profile_id = auth.uid();
-- doc_level pasa a 2
```

Y de paso puede escribir `decided_by` con el id de perfil que quiera y `decided_at` con cualquier fecha, o sea **fabricar el registro de quién lo aprobó**.

No hay consecuencia hoy porque nada consume `doc_level` todavía. La hay en T-006, que va a decidir qué trabajos ve cada repartidor, y en la matriz de documentos de T-007.

**Cómo arreglarlo.** Extender el `with check` con las cuatro columnas, con la misma forma que ya usa para `status`; o —más limpio y más barato de mantener— dejar `couriers_update_self` acotado a las columnas que el repartidor sí puede tocar (`vehicle_type`, `vehicle_plate`, `available`) comparando el resto contra su valor actual. La prueba que falta es una sola: como repartidor, el `update` que se autoverifica **tiene que fallar**.

## 🔴 H02 · Un comercio puede autoconcederse la suscripción

**`supabase/migrations/20260922051650_rls_v1.sql:157` · alto · bloqueante**

```sql
create policy merchants_update_self on public.merchants
  for update to authenticated
  using (profile_id = auth.uid())
  with check (profile_id = auth.uid());
```

Acá no hay nada congelado. La tabla `merchants` tiene `subscription_status` (`pilot`/`active`/`expired`/`cancelled`), `paid_until` y `notes`:

```sql
update public.merchants
set subscription_status = 'active', paid_until = '2099-12-31'
where profile_id = auth.uid();
```

Es el mismo defecto que H01 con otra cara, y más directo: **el estado de pago del comercio es autoservicio.** `notes` además parece campo de uso administrativo.

**Cómo arreglarlo.** Congelar `subscription_status`, `paid_until` y `notes` contra su valor actual, igual que H01. Y la misma prueba en negativo.

## 🟠 H03 · Cualquier repartidor aprobado lee todos los comercios, enteros

**`supabase/migrations/20260922051650_rls_v1.sql:153` · alto**

```sql
create policy merchants_select_courier on public.merchants
  for select to authenticated
  using (app_private.is_approved_courier());
```

Sin ninguna condición de relación: **un repartidor aprobado hace `select * from public.merchants` y obtiene todas las filas**, incluidas las de comercios que nunca publicaron nada. Y la fila trae `default_pickup_address`, `default_pickup_lat/lng`, `subscription_status`, `paid_until` y `notes`.

Chirría contra el resto del diseño. T-004 separó los datos de contacto en `delivery_request_contacts` justo para que un repartidor no viera direcciones que no le corresponden, y hay una prueba estructural que lo defiende. Esta política reabre la puerta por el costado: la dirección de retiro está en `merchants`.

**Cómo arreglarlo.** Acotar a los comercios con los que el repartidor tiene relación visible —dueño de una solicitud publicada no vencida, o de aquella donde su oferta fue aceptada—, con un helper como los que ya existen. Si además hace falta que vea solo el nombre comercial, RLS no alcanza: eso es una vista o `grant select (columna)`.

La prueba que falta es del mismo tipo que las que ya hay: un repartidor aprobado **no** debería ver el comercio 2 si el comercio 2 no tiene nada publicado.

## 🟡 H04 · La única política que nombra a `anon` llama a una función que `anon` no puede ejecutar

**`supabase/migrations/20260922051650_rls_v1.sql:135` · medio**

```sql
create policy zones_select_active on public.zones
  for select to anon, authenticated
  using (active or app_private.is_admin());
```

pero:

```sql
revoke all on function app_private.is_admin() from public, anon, authenticated;
grant execute on function app_private.is_admin() to authenticated;   -- anon no
```

PostgreSQL verifica el privilegio de `execute` **al inicializar la expresión**, no cuando la evalúa, así que el `or` no lo salva por cortocircuito: un `select` de `anon` sobre `zones` debería fallar con *permission denied for function is_admin*. Si tengo razón, **`anon` no puede leer las zonas**, que es lo único que la matriz le permite.

No lo puedo comprobar acá: no tengo la base levantada. **Y la matriz tampoco lo comprueba**, que es la otra mitad del problema: las dos únicas pruebas de `anon` son negativas —ve 0 solicitudes, ve 0 contactos—, así que si `anon` quedara bloqueado de todo, los 58 tests siguen en verde.

**Cómo resolverlo.** Partir la política en dos, que además es más claro:

```sql
create policy zones_select_public on public.zones
  for select to anon, authenticated using (active);
create policy zones_select_admin on public.zones
  for select to authenticated using (app_private.is_admin());
```

Y sumar **una prueba positiva de `anon`**: `anon` ve la zona activa de Aguilares. Es una línea y cubre el agujero entero.

## 🟡 H05 · La matriz no hace ningún `update` sobre las tres tablas donde viven los `with check`

**`supabase/tests/rls_matrix.sql:6` · medio**

De las 15 aserciones, 14 son `select` y la única de escritura es la prueba 15, sobre `delivery_requests`. Las políticas de `profiles`, `couriers` y `merchants` —donde están los `with check` que congelan columnas, y donde aparecen H01 y H02— **no se ejercen nunca**.

Hay un segundo motivo para probarlas, aparte de H01 y H02: esos `with check` traen subconsultas sobre la propia tabla,

```sql
with check (... and role = (select p.role from public.profiles p where p.id = auth.uid()))
```

y una subconsulta a la misma tabla dentro de su propia policy es el caso que produce *infinite recursion detected in policy for relation «profiles»*. Acá probablemente no recurse —la subconsulta cae en las políticas de `select`, que no vuelven a la tabla—, pero **es exactamente el riesgo que el esquema `app_private` se creó para evitar**, y en estas tres políticas no se usó. Una prueba lo contesta.

Faltan, como mínimo:
- un `update` propio legítimo que **pase** (cambiar `display_name`, `available`, `business_name`);
- un `update` que intente cambiar el rol / `status` / `license_status` / `subscription_status` y **falle**.

## 🟡 H06 · `offers_update_merchant` no tiene `with check`

**`supabase/migrations/20260922051650_rls_v1.sql:293` · medio**

```sql
create policy offers_update_merchant on public.offers
  for update to authenticated
  using (app_private.is_request_merchant(request_id, auth.uid()));
```

Sin `with check`, PostgreSQL usa el `using` como check. Eso deja que el comercio dueño de la solicitud **reescriba cualquier columna de las ofertas que recibió**: `amount_ars`, `eta_minutes`, `message`, `status`, incluso `courier_id`.

`amount_ars` es el precio que puso el repartidor. Que la contraparte pueda editarlo no es un detalle. Y poner `status = 'accepted'` a mano saltea la RPC de aceptación que va a escribir T-006 —y con ella el índice único parcial es lo único que queda en pie—.

**Cómo arreglarlo.** Un `with check` explícito que congele `amount_ars`, `eta_minutes`, `message` y `courier_id`, dejando al comercio solo la transición de `status` que le corresponda; o quitar la política y dejar la aceptación exclusivamente en la RPC de T-006, que es lo que probablemente convenga. Si se va por lo segundo, conviene anotarlo en el DoD de T-006.

## 🔵 H07 · `using (true)` sin la justificación escrita

**`supabase/migrations/20260922051650_rls_v1.sql:352` · bajo**

```sql
create policy platform_settings_select_authenticated on public.platform_settings
  for select to authenticated using (true);
```

El checklist de seguridad del template dice textualmente *«nada con `USING (true)` sin justificación»*. Acá la justificación existe y es buena —`min_offer_ars`, `request_ttl_minutes`, `pilot_active`, `pilot_terms_version`, `subscription_grace_days` son configuración operativa que el cliente necesita— pero no está escrita en ningún lado, y es el único `using (true)` de la migración. Dos líneas de comentario y queda cerrado.

## 🔵 H08 · Cualquiera puede abrir un incidente sobre cualquier solicitud

**`supabase/migrations/20260922051650_rls_v1.sql:311` · bajo**

```sql
create policy incidents_insert_authenticated on public.incidents
  for insert to authenticated
  with check (reporter_id = auth.uid());
```

Solo exige que se firme con el propio id. No exige ninguna relación con `request_id`, así que un repartidor puede abrir incidentes sobre solicitudes de comercios con los que nunca trabajó, con `kind` y `description` libres. Es ruido para el admin más que un riesgo, pero el helper que hace falta ya existe.

## 🔵 H09 · Subir a `courier-docs` no requiere ser repartidor

**`supabase/migrations/20260922051650_rls_v1.sql:381` · bajo**

```sql
create policy courier_docs_insert_own_folder on storage.objects
  for insert to authenticated
  with check (bucket_id = 'courier-docs' and (storage.foldername(name))[1] = 'courier'
              and (storage.foldername(name))[2] = auth.uid()::text)
```

La carpeta es la propia, así que nadie pisa a nadie, pero un comercio puede subir archivos al bucket de documentos de repartidores. Impacto bajo —almacenamiento—, y se cierra sumando `app_private.is_approved_courier()`… salvo que el flujo real sea subir documentos **antes** de ser aprobado, en cuyo caso el check correcto es que el perfil tenga rol `courier`.

---

## Nota de proceso · quién escribe la revisión

Esta carpeta llegó con la revisión ya escrita: `revisiones/ronda-1.md` decía **«Revisor: Revisión independiente (agy)»**, «Resultado: SIN BLOQUEANTES», «MEJORAS: ninguna pendiente», y `hallazgos.jsonl` traía un solo registro, el de alcance. Lo moví a [`autorrevision-agy.md`](../autorrevision-agy.md) sin tocarle el contenido, porque es un dato útil, no un archivo a borrar.

**No está mal que el agy se revise a sí mismo**: la regla 50 lo pide —*«antes de pedir revisión: skill `revisar-pr` sobre el propio PR»*—. Lo que no puede es ocupar el lugar de la revisión independiente ni firmar con su nombre. El contraste es el dato: la autorrevisión declaró cero hallazgos sobre una migración que tiene dos escaladas de privilegios.

Y hay una consecuencia que me toca a mí, porque salió de un cambio que hice: **el cuerpo dice «generado por agy» y `approval-policy` pasa igual.** El control verifica el **formato** del informe, no quién lo escribió, y no puede verificarlo. Cuando saqué la exigencia de aprobación de un par en la #55 —correctamente, porque nadie podía darla—, este check quedó como único control automático sobre una PR de P1, y es un control de formato. Conviene decirlo en §2 en vez de dejar que parezca más de lo que es: **el freno real es que no se mergea hasta que la revisión independiente lo diga; `approval-policy` es el recordatorio de pegar el informe, no su garantía.**

---

## Alcance

9 archivos, **0 fuera de la ficha**. Novena ronda consecutiva en cero.

## Para cerrar

| # | Qué | Quién |
|---|---|---|
| 1 | **H01** — congelar `license_status`, `insurance_status`, `decided_by`, `decided_at` en `couriers_update_self` | agy |
| 2 | **H02** — congelar `subscription_status`, `paid_until` y `notes` en `merchants_update_self` | agy |
| 3 | **H03** — acotar `merchants_select_courier` a los comercios con relación visible | agy |
| 4 | **H04** — partir `zones_select_active` en dos, y sumar una prueba **positiva** de `anon` | agy |
| 5 | **H05** — `update` en la matriz para `profiles`, `couriers` y `merchants`, en las dos direcciones | agy |
| 6 | **H06** — `with check` en `offers_update_merchant`, o mover la aceptación a la RPC de T-006 | **@Lautaro073**, decisión |
| 7 | **H07 · H08 · H09** — justificación del `using (true)`, relación en `incidents`, rol en el bucket | agy |
| 8 | La nota de §2 sobre qué garantiza `approval-policy` | **@Lautaro073**, PR de docs |

Del 1 al 5 y el 7 son todos dentro de la ficha: solo tocan la migración y `supabase/tests/rls_*.sql`.
