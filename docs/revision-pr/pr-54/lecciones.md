# Lecciones de la PR #54 para `AGENTS.md` y las reglas

**Fuente:** 6 hallazgos de la ronda 1. Datos crudos en [`hallazgos.jsonl`](hallazgos.jsonl).

> Provisorio: la PR sigue abierta. Se completa al cerrarla.

## Patrón dominante

**Lo que el esquema declara sobre el ciclo de vida de un dato no lo verifica nadie.** Las tres cosas que aparecieron —una cascada que no cascadea, un `updated_at` que nunca se actualiza, una FK que no ata la oferta a su solicitud— son del mismo tipo: el DDL dice algo sobre cómo se comportan las filas con el tiempo, y las pruebas verifican que las columnas y los checks **existan**.

No es un descuido de esta PR: **el DoD pidió «pgTAP de estructura» y entregó pgTAP de estructura**, más de lo prometido, porque el trigger sí tiene pruebas de conducta. Lo que falta es una categoría de prueba que ninguna ficha pidió todavía.

Y conviene decir el contraste, porque es el dato útil: el único invariante de esta PR que **sí** tiene prueba de conducta —el rol de alta— es el único que quedó sin defectos.

## Lecciones propuestas

### AG-28 · Una cláusula `on delete` es una promesa de comportamiento: se prueba borrando
**Origen:** H01

`profiles.id references auth.users (id) on delete cascade` se lee como «borrar el usuario borra su perfil». Con una solicitud publicada, una oferta, un incidente o una fila de auditoría, el borrado choca con una FK sin acción y **falla entero**: ni borra ni retiene. Las 37 pruebas de pgTAP pasan porque ninguna intenta un borrado.

La pista de que la intención era otra está en el propio DDL: `audit_log.actor_id` y `couriers.decided_by` son **nullable**, que es la forma de `on delete set null`.

> **Regla propuesta.** Una migración que declara `on delete cascade` en alguna parte de una cadena lleva una prueba que **ejecuta el borrado desde la raíz de la cadena** y afirma el resultado esperado, sea «se borró», «se retuvo» o «falla a propósito». Si la respuesta es «se retiene el historial», el `cascade` de la raíz es engañoso y hace falta un camino de anonimización con ficha propia. Y toda FK hacia una tabla de personas declara explícitamente su `on delete`: dejarlo implícito es elegir `no action` sin decirlo.

### AG-29 · Una prueba de base que corre como superusuario no puede verificar un grant
**Origen:** H04

`grant execute on function public.handle_new_user() to authenticated` sobre una función `security definer` es la forma que la regla de seguridad pide mirar. Hoy no es explotable —PostgreSQL no deja llamar una función de trigger directamente— y tampoco hace falta, porque el `execute` de un trigger se verifica al crearlo, no al disparar. Si hiciera falta, el rol estaría equivocado: en `auth.users` inserta `supabase_auth_admin`.

Lo que importa para la regla: **`supabase test db` corre como superusuario.** Si el grant fuera necesario y estuviera mal puesto, las 37 pruebas seguirían en verde y el alta real fallaría en producción.

> **Regla propuesta.** Toda prueba sobre permisos —grants, RLS, policies— se corre **con el rol que va a ejercerlos** (`set local role authenticated`, o un JWT de prueba), nunca con el rol por defecto de `supabase test db`. Un `select` que pasa como superusuario no dice nada sobre lo que puede hacer un usuario. Esto es lo que T-005 va a necesitar sí o sí para su matriz de RLS: conviene dejarlo escrito antes.

### AG-30 · Un valor de enum sin camino que lo produzca es una tarea que falta
**Origen:** H03

`profile_role` tiene `admin`, el esquema lo da por existente —`couriers.decided_by`, `incidents`, `audit_log`— y T-005 va a escribir una matriz de RLS con ese rol. Ningún camino crea uno: el trigger rechaza `admin` a propósito, y es lo correcto. Hoy la única forma es dar de alta un `merchant` y hacer un `update` con el service role, que no está escrito en ninguna parte.

> **Regla propuesta.** Cuando un tipo enumerado, un flag o un estado se declara y ninguna ruta del código puede producirlo, la tarea no está completa: o se quita del tipo, o el procedimiento que lo produce queda escrito en el DoD de la ficha que lo va a necesitar. Es `AG-21` aplicada a los datos en vez de a los checks: «lo hace otro» no es una resolución si ninguna ficha se comprometió.

## Advertencias

- **Ronda 1 de una PR abierta.** Las tres salen de un caso cada una.
- **AG-29 es la que más rinde de las tres, y hay que aplicarla ya:** T-005 es una matriz de RLS entera, y si sus pruebas corren como superusuario van a pasar todas sin verificar nada. Es el mismo error que `PR51-H07` —un control que corre y no puede fallar— trasladado a la base.
- **AG-28 tiene una mitad barata y una mitad que es decisión.** La barata (`on delete set null` en dos columnas ya nullable) entra en T-004; la otra necesita que alguien decida entre borrar y anonimizar.

## Lo que dice el dato entre PRs

**Primera PR sin ningún `origen: ficha`.** De 6 hallazgos, 5 son `agente` y 1 es `ambos` (H03, donde el DoD pide el corte estricto y ninguna ficha se hizo cargo del arranque del admin). La serie venía #47 11%, #48 25%, #49 31%, #51 0 puros con 2 `ambos`, y ahora 0 puros con 1. Las fichas dejaron de ser la fuente de los problemas después de las PR #50 y #53, y el control de `tools/verify-fichas.test.ts` sigue justificado: **la señal de que funciona es justamente que no aparezca.**

La novedad es de otro tipo: **por primera vez el trabajo revisado aplicó lecciones de rondas anteriores sin que se las recordaran.** `AG-25` (afirmar el bloque concreto, no la presencia de un string) está en cómo se prueban los índices parciales, y la fase roja por CI —el patrón de T-003— se usó sola cuando Docker no estaba disponible. Es la primera vez que el dato de una revisión se ve aplicado en la siguiente sin intervención.

El patrón nuevo, `P16-cascada-declarada-que-no-cascadea`, es por ahora de un solo caso. Conviene mirarlo en T-005 y T-006, que son las que van a tocar el ciclo de vida de las filas.
