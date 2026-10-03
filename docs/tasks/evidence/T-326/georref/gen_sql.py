"""Genera la migración, el seed y el pgTAP de T-326 desde la evidencia versionada.

Fuentes (únicas):
  - docs/tasks/evidence/T-326/barrios-fuente.md   -> nombres aprobados (columna «Normalización candidata»)
  - docs/tasks/evidence/T-326/georref/barrios-centroides.json -> estado por barrio
    (derivado | referencia_local | null) y lat/lng

Uso, desde la raíz del repo:  python docs/tasks/evidence/T-326/georref/gen_sql.py
"""
import io
import json
import re

FUENTE = 'docs/tasks/evidence/T-326/barrios-fuente.md'
CENTROIDES = 'docs/tasks/evidence/T-326/georref/barrios-centroides.json'
# Timestamp posterior a CC-019 (20261003120000): los barrios periféricos necesitan el recuadro ampliado.
MIGRATION = 'supabase/migrations/20261003130000_t326_aguilares_zones.sql'
TEST = 'supabase/tests/t326_aguilares_zones.sql'
SEED = 'supabase/seed.sql'
LEGACY = ('Aguilares', '-27.431480', '-65.614660')
# CC-019: área de servicio de Aguilares.
BOUNDS = {'min_lat': -27.4800, 'max_lat': -27.3800, 'min_lng': -65.6450, 'max_lng': -65.5800}
# Único par que comparte punto, por decisión de Lautaro073: 24 El Alto «va junto con la Villa Nueva» (23).
SHARED_POINT = ('El Alto', 'Villa Nueva')


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
    if c['estado'] in ('derivado', 'referencia_local'):
        assert BOUNDS['min_lat'] <= c['lat'] <= BOUNDS['max_lat'] and BOUNDS['min_lng'] <= c['lng'] <= BOUNDS['max_lng'], c
        assert (f"{c['lat']:.6f}", f"{c['lng']:.6f}") != LEGACY[1:], c
    else:
        assert c['estado'] == 'null' and c.get('lat') is None and c.get('motivo'), c

derived = [c for c in cent if c['estado'] == 'derivado']
local = [c for c in cent if c['estado'] == 'referencia_local']
nulls = [c for c in cent if c['estado'] == 'null']
located = derived + local
by_name = {c['name']: c for c in cent}
assert (by_name[SHARED_POINT[0]]['lat'], by_name[SHARED_POINT[0]]['lng']) ==     (by_name[SHARED_POINT[1]]['lat'], by_name[SHARED_POINT[1]]['lng']), 'El Alto debe usar el punto de Villa Nueva'
assert len({(c['lat'], c['lng']) for c in located}) == len(located) - 1, 'solo El Alto y Villa Nueva comparten punto'


def coord(c):
    if c['estado'] in ('derivado', 'referencia_local'):
        return f"{c['lat']:.6f}, {c['lng']:.6f}"
    return 'null, null'


def zone_values(indent):
    return ',\n'.join(f"{indent}('{c['name']}', {coord(c)}, true)" for c in cent)


# PR218-H04: la migración y el seed usan el mismo upsert. Una fila preexistente converge a la evidencia
# (también a NULL/NULL si algún día la evidencia vuelve a tener un barrio sin punto).
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
LOCAL_PROBE = by_name['Santa Rosa']['name']
DERIVED_PROBE = derived[0]['name']
STALE_LOCAL = ('-27.450000', '-65.600000')
STALE_DERIVED = ('-27.451000', '-65.601000')
assert by_name[LOCAL_PROBE]['estado'] == 'referencia_local'
assert {STALE_LOCAL, STALE_DERIVED}.isdisjoint({(f"{c['lat']:.6f}", f"{c['lng']:.6f}") for c in located})


HEADER_NOTE = (f"-- {len(derived)} barrios con centroide cartográfico DERIVADO del plano municipal 2015 (no es una coordenada\n"
               f"-- oficial: centro del rótulo circular o, para 17, del área rosa, llevado a WGS84 con un ajuste afín\n"
               f"-- sobre intersecciones de calles de OpenStreetMap), {len(local)} con REFERENCIA LOCAL aprobada por Lautaro073\n"
               f"-- (georref/referencias-locales.json; 24 El Alto usa el punto de 23 Villa Nueva) y {len(nulls)} sin centroide.\n"
               f"-- Detalle y reproducción: docs/tasks/evidence/T-326/georreferenciacion.md")

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
-- {len(derived)} carry a centroid DERIVED from the 2015 municipal plan, {len(local)} a LOCAL REFERENCE approved by
-- Lautaro073 and {len(nulls)} have none.
{UPSERT}
""" + seed[end:])
assert read(SEED).count(UPSERT) == 1 and read(MIGRATION).count(UPSERT) == 1

expected = ',\n'.join(f"  ('{c['name']}', '{c['estado']}', {coord(c)})" for c in cent)
write(TEST, f"""begin;

create extension if not exists pgtap with schema extensions;
set local search_path to public, extensions;

select plan(20);

-- Esperado: lista aprobada (barrios-fuente.md) + estado por barrio (georref/barrios-centroides.json).
-- Generado con docs/tasks/evidence/T-326/georref/gen_sql.py.
create temporary table t326_expected (
  name text primary key,
  estado text not null check (estado in ('derivado', 'referencia_local', 'null')),
  lat numeric(9, 6),
  lng numeric(9, 6)
) on commit drop;
insert into t326_expected (name, estado, lat, lng)
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

-- 4. Centroides: derivados del plano, referencias locales aprobadas y, si los hubiera, null
select is(
  (select count(*)::integer from t326_expected where estado = 'derivado'),
  {len(derived)},
  'the evidence documents {len(derived)} centroids derived from the municipal plan'
);

select is(
  (select count(*)::integer from t326_expected where estado = 'referencia_local'),
  {len(local)},
  'the evidence documents {len(local)} local references approved by Lautaro073'
);

select is(
  (select count(*)::integer from t326_expected where estado = 'null'),
  {len(nulls)},
  'the evidence documents {len(nulls)} barrios without a point'
);

select is_empty(
  $$ select e.name
     from t326_expected e
     join public.zones z on z.name = e.name
     where e.estado <> 'null'
       and (z.centroid_lat is distinct from e.lat or z.centroid_lng is distinct from e.lng) $$,
  'every documented point matches the zone centroid'
);

select is_empty(
  $$ select e.name
     from t326_expected e
     join public.zones z on z.name = e.name
     where e.estado = 'null'
       and (z.centroid_lat is not null or z.centroid_lng is not null) $$,
  'barrios without a documented point have both centroid coordinates null'
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

-- Único punto compartido, por decisión de Lautaro073: {SHARED_POINT[0]} va junto con {SHARED_POINT[1]}.
select is(
  (
    select array_agg(z.name order by z.name)
    from public.zones z
    join t326_expected e on e.name = z.name
    where (z.centroid_lat, z.centroid_lng) in (
      select z2.centroid_lat, z2.centroid_lng
      from public.zones z2
      join t326_expected e2 on e2.name = z2.name
      where z2.centroid_lat is not null
      group by z2.centroid_lat, z2.centroid_lng
      having count(*) > 1
    )
  ),
  array['{SHARED_POINT[0]}', '{SHARED_POINT[1]}'],
  'only {SHARED_POINT[0]} and {SHARED_POINT[1]} share a centroid'
);

-- CC-019: área de servicio de Aguilares
select is(
  (
    select count(*)::integer
    from public.zones
    where active
      and centroid_lat is not null
      and (
        centroid_lat not between {BOUNDS['min_lat']:.4f} and {BOUNDS['max_lat']:.4f}
        or centroid_lng not between {BOUNDS['min_lng']:.4f} and {BOUNDS['max_lng']:.4f}
      )
  ),
  0,
  'every centroid on an active zone stays inside the Aguilares service area (CC-019)'
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

-- Barrio con referencia local, con coordenadas viejas.
update public.zones
set centroid_lat = {STALE_LOCAL[0]}, centroid_lng = {STALE_LOCAL[1]}, active = false
where name = '{LOCAL_PROBE}';

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
  (select array[centroid_lat, centroid_lng] from public.zones where name = '{LOCAL_PROBE}' and active),
  (select array[lat, lng] from t326_expected where name = '{LOCAL_PROBE}'),
  'a stale centroid on a local-reference barrio converges to the documented value'
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
print(f'ok · derivados={len(derived)} · referencia_local={len(local)} · null={len(nulls)}')
