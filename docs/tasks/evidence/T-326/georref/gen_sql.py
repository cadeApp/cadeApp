"""Genera la migración, el seed y el pgTAP de T-326 desde la evidencia versionada.

Fuentes (únicas):
  - docs/tasks/evidence/T-326/barrios-fuente.md   -> nombres aprobados (columna «Normalización candidata»)
  - docs/tasks/evidence/T-326/georref/barrios-centroides.json -> estado por barrio (derivado | null) y lat/lng

Uso, desde la raíz del repo:  python docs/tasks/evidence/T-326/georref/gen_sql.py
"""
import io
import json
import re

FUENTE = 'docs/tasks/evidence/T-326/barrios-fuente.md'
CENTROIDES = 'docs/tasks/evidence/T-326/georref/barrios-centroides.json'
MIGRATION = 'supabase/migrations/20261002233000_t326_aguilares_zones.sql'
TEST = 'supabase/tests/t326_aguilares_zones.sql'
SEED = 'supabase/seed.sql'
LEGACY = ('Aguilares', '-27.431480', '-65.614660')


def read(p):
    with io.open(p, encoding='utf-8', newline='') as fh:
        return fh.read().replace('\r\n', '\n')


def write(p, s):
    with io.open(p, 'w', encoding='utf-8', newline='\n') as fh:
        fh.write(s)


rows = [(m.group(1), m.group(3).strip()) for m in
        re.finditer(r'^\| (\d{2}) \| ([^|]+) \| ([^|]+) \| ([^|]+) \|$', read(FUENTE), re.M)]
cent = json.loads(read(CENTROIDES))
assert len(rows) == 63 and len({n for _, n in rows}) == 63
assert [(r[0], r[1]) for r in rows] == [(c['num'], c['name']) for c in cent], 'centroides desalineados con la lista aprobada'
assert all("'" not in n for _, n in rows)
assert 'Aguilares - Centro' in {n for _, n in rows}

for c in cent:
    if c['estado'] == 'derivado':
        assert -27.4550 <= c['lat'] <= -27.4100 and -65.6400 <= c['lng'] <= -65.5950, c
        assert (f"{c['lat']:.6f}", f"{c['lng']:.6f}") != LEGACY[1:], c
    else:
        assert c['estado'] == 'null' and c.get('lat') is None and c.get('motivo'), c

derived = [c for c in cent if c['estado'] == 'derivado']
nulls = [c for c in cent if c['estado'] == 'null']
assert len({(c['lat'], c['lng']) for c in derived}) == len(derived), 'dos barrios con el mismo punto'


def coord(c):
    if c['estado'] == 'derivado':
        return f"{c['lat']:.6f}, {c['lng']:.6f}"
    return 'null, null'


def zone_values(indent):
    return ',\n'.join(f"{indent}('{c['name']}', {coord(c)}, true)" for c in cent)


# PR218-H04: la migración y el seed usan el mismo upsert. Una fila preexistente converge a la evidencia,
# incluido NULL/NULL cuando la evidencia no tiene centroide.
UPSERT = f"""insert into public.zones (name, centroid_lat, centroid_lng, active)
values
{zone_values('  ')}
on conflict (name) do update
set centroid_lat = excluded.centroid_lat,
    centroid_lng = excluded.centroid_lng,
    active = excluded.active;
"""
MIGRATION_VERSION = re.match(r'.*/(\d{14})_', MIGRATION).group(1)

# Filas divergentes que el pgTAP precarga antes de re-ejecutar la migración aplicada.
NULL_PROBE = nulls[0]['name']
DERIVED_PROBE = derived[0]['name']
STALE_NULL = ('-27.450000', '-65.600000')
STALE_DERIVED = ('-27.451000', '-65.601000')
assert {STALE_NULL, STALE_DERIVED}.isdisjoint({(f"{c['lat']:.6f}", f"{c['lng']:.6f}") for c in derived})


HEADER_NOTE = (f"-- {len(derived)} barrios con centroide cartográfico DERIVADO del plano municipal 2015 (no es una coordenada\n"
               f"-- oficial: punto representativo = centro del rótulo circular del barrio, llevado a WGS84 con un ajuste afín\n"
               f"-- sobre intersecciones de calles de OpenStreetMap) y {len(nulls)} sin centroide. Detalle y reproducción:\n"
               f"-- docs/tasks/evidence/T-326/georreferenciacion.md")

write(MIGRATION, f"""-- ============================================================================
-- T-326: barrios reales de Aguilares para el onboarding de comercio
-- ============================================================================
-- Fuente: plano municipal «CIUDAD DE AGUILARES Y DIVISIONES DE BARRIOS» (nov. 2015); lista de {len(cent)} entradas
-- aprobada en docs/tasks/evidence/T-326/barrios-fuente.md.
{HEADER_NOTE}
-- Generado con docs/tasks/evidence/T-326/georref/gen_sql.py. Idempotente.

-- 1. La fila general queda legacy: se conserva (UUID y centroide histórico) y deja de ser seleccionable.
update public.zones
set active = false
where name = 'Aguilares';

-- 2. Barrios aprobados. Una fila que ya existe converge a la evidencia: centroide (incluido null) y active.
{UPSERT}""")

seed = read(SEED)
start = seed.index('-- T-004: operational defaults.')
end = seed.index('insert into public.platform_settings')
write(SEED, seed[:start] + f"""-- T-004: operational defaults. The general Aguilares centroid is the verified
-- locality point (OpenStreetMap node 198437989), not an invented barrio point.
-- T-326: this general row is legacy and inactive; it is kept for historical references only.
insert into public.zones (name, centroid_lat, centroid_lng, active)
values ('{LEGACY[0]}', {LEGACY[1]}, {LEGACY[2]}, false)
on conflict (name) do update
set centroid_lat = excluded.centroid_lat,
    centroid_lng = excluded.centroid_lng,
    active = excluded.active;

-- T-326: the {len(cent)} barrios approved in docs/tasks/evidence/T-326/barrios-fuente.md, same upsert as the
-- migration *_t326_aguilares_zones.sql (generated by docs/tasks/evidence/T-326/georref/gen_sql.py).
-- {len(derived)} carry a centroid DERIVED from the 2015 municipal plan; {len(nulls)} have none.
{UPSERT}
""" + seed[end:])
assert read(SEED).count(UPSERT) == 1 and read(MIGRATION).count(UPSERT) == 1

expected = ',\n'.join(
    f"  ('{c['name']}', {'true' if c['estado'] == 'derivado' else 'false'}, {coord(c)})" for c in cent)
write(TEST, f"""begin;

create extension if not exists pgtap with schema extensions;
set local search_path to public, extensions;

select plan(18);

-- Esperado: lista aprobada (barrios-fuente.md) + estado por barrio (georref/barrios-centroides.json).
-- Generado con docs/tasks/evidence/T-326/georref/gen_sql.py.
create temporary table t326_expected (
  name text primary key,
  derived boolean not null,
  lat numeric(9, 6),
  lng numeric(9, 6)
) on commit drop;
insert into t326_expected (name, derived, lat, lng)
values
{expected};

select is((select count(*)::integer from t326_expected), {len(cent)}, 'the approved list has {len(cent)} barrios');

-- 1. Exactamente los barrios aprobados están activos
select is((select count(*)::integer from public.zones where active), {len(cent)}, 'exactly {len(cent)} zones are active');

select is_empty(
  $$ select name from t326_expected
     except
     select name from public.zones where active $$,
  'every approved barrio exists and is active'
);

select is_empty(
  $$ select name from public.zones where active
     except
     select name from t326_expected $$,
  'no zone outside the approved list is active'
);

-- 2. Fila general legacy: se conserva, inactiva, con su centroide histórico
select is(
  (select count(*)::integer from public.zones where name = 'Aguilares' and not active),
  1,
  'the general Aguilares row is kept and is inactive'
);

select is(
  (select array[centroid_lat, centroid_lng] from public.zones where name = 'Aguilares'),
  array[{LEGACY[1]}, {LEGACY[2]}]::numeric[],
  'the legacy Aguilares row keeps its historical centroid'
);

-- 3. Barrio 09: entidad distinta de la fila legacy
select is(
  (select count(*)::integer from public.zones where name = 'Aguilares - Centro' and active),
  1,
  'barrio 09 is loaded as the active zone Aguilares - Centro'
);

select is(
  (select count(*)::integer from public.zones where name = 'Centro'),
  0,
  'the raw legend text Centro is not used as a zone name'
);

-- 4. Centroides: solo los derivados documentados, el resto null
select is(
  (select count(*)::integer from t326_expected where derived),
  {len(derived)},
  'the evidence documents {len(derived)} derived centroids'
);

select is_empty(
  $$ select e.name
     from t326_expected e
     join public.zones z on z.name = e.name
     where e.derived
       and (z.centroid_lat is distinct from e.lat or z.centroid_lng is distinct from e.lng) $$,
  'every derived centroid matches the documented value'
);

select is_empty(
  $$ select e.name
     from t326_expected e
     join public.zones z on z.name = e.name
     where not e.derived
       and (z.centroid_lat is not null or z.centroid_lng is not null) $$,
  'barrios without georeferencing have both centroid coordinates null'
);

select is(
  (
    select count(*)::integer
    from public.zones z
    join t326_expected e on e.name = z.name
    where z.centroid_lat = {LEGACY[1]} and z.centroid_lng = {LEGACY[2]}
  ),
  0,
  'the general Aguilares centroid is not copied to any barrio'
);

select is(
  (
    select count(*)::integer
    from (
      select z.centroid_lat, z.centroid_lng
      from public.zones z
      join t326_expected e on e.name = z.name
      where z.centroid_lat is not null
      group by z.centroid_lat, z.centroid_lng
      having count(*) > 1
    ) repeated
  ),
  0,
  'no centroid is shared by two barrios'
);

select is(
  (
    select count(*)::integer
    from public.zones
    where active
      and centroid_lat is not null
      and (
        centroid_lat not between -27.4550 and -27.4100
        or centroid_lng not between -65.6400 and -65.5950
      )
  ),
  0,
  'every centroid on an active zone stays inside the Aguilares bounding box'
);

-- 5. PR218-H04: el upsert real de la migración T-326 hace converger filas preexistentes divergentes.
-- Se re-ejecutan las sentencias que el CLI registró al aplicar la migración, no una copia del test.
select is(
  (
    select count(*)::integer
    from supabase_migrations.schema_migrations
    where version = '{MIGRATION_VERSION}'
      and cardinality(statements) > 0
  ),
  1,
  'the applied T-326 migration is recorded with its statements'
);

-- Barrio sin centroide en la evidencia, con coordenadas viejas.
update public.zones
set centroid_lat = {STALE_NULL[0]}, centroid_lng = {STALE_NULL[1]}, active = false
where name = '{NULL_PROBE}';

-- Barrio derivado con coordenadas distintas de la evidencia.
update public.zones
set centroid_lat = {STALE_DERIVED[0]}, centroid_lng = {STALE_DERIVED[1]}, active = false
where name = '{DERIVED_PROBE}';

do $$
declare
  stmt text;
begin
  for stmt in
    select unnest(statements)
    from supabase_migrations.schema_migrations
    where version = '{MIGRATION_VERSION}'
  loop
    -- Un fragmento que solo tiene comentarios no es una sentencia ejecutable.
    continue when btrim(regexp_replace(stmt, '--[^\\n]*', '', 'g'), E' \\n\\r\\t') = '';
    execute stmt;
  end loop;
end
$$;

select is(
  (select array[centroid_lat, centroid_lng] from public.zones where name = '{NULL_PROBE}' and active),
  array[null, null]::numeric[],
  'a stale centroid on a barrio without georeferencing converges to null'
);

select is(
  (select array[centroid_lat, centroid_lng] from public.zones where name = '{DERIVED_PROBE}' and active),
  (select array[lat, lng] from t326_expected where name = '{DERIVED_PROBE}'),
  'a stale centroid on a derived barrio converges to the documented value'
);

select is_empty(
  $$ select e.name
     from t326_expected e
     join public.zones z on z.name = e.name
     where not z.active
        or z.centroid_lat is distinct from e.lat
        or z.centroid_lng is distinct from e.lng $$,
  'after re-applying the migration every barrio matches the evidence'
);

select * from finish();
rollback;
""")
print(f'ok · derivados={len(derived)} · null={len(nulls)}')
