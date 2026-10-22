begin;

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
  ('Chacarita', 'derivado', -27.422618, -65.616127),
  ('San José', 'derivado', -27.422884, -65.611733),
  ('1º de Mayo', 'derivado', -27.425778, -65.614882),
  ('Santo Domingo', 'derivado', -27.426663, -65.611599),
  ('J. F. Kennedy', 'derivado', -27.429432, -65.611460),
  ('El Porvenir', 'derivado', -27.434205, -65.611323),
  ('9 de Julio', 'derivado', -27.434511, -65.614602),
  ('San Martín', 'derivado', -27.440821, -65.617480),
  ('Aguilares - Centro', 'derivado', -27.429625, -65.615706),
  ('Almirante Brown', 'derivado', -27.445822, -65.617800),
  ('Los Álamos', 'derivado', -27.449446, -65.616527),
  ('Fray M. Esquiú', 'derivado', -27.447452, -65.618683),
  ('Alpargatas', 'derivado', -27.451923, -65.616631),
  ('Virgen del Carmen', 'derivado', -27.450990, -65.620061),
  ('Hostería', 'derivado', -27.446101, -65.614088),
  ('Sofía', 'derivado', -27.450276, -65.608179),
  ('San Lorenzo', 'derivado', -27.455981, -65.614109),
  ('Cristo - Centro', 'derivado', -27.453997, -65.609098),
  ('Gambarte', 'derivado', -27.456143, -65.603636),
  ('Terán', 'derivado', -27.456337, -65.602134),
  ('Villa Nueva', 'derivado', -27.415980, -65.612274),
  ('El Alto', 'referencia_local', -27.415980, -65.612274),
  ('El Ceibal', 'referencia_local', -27.396438, -65.635938),
  ('Santa Emilia', 'referencia_local', -27.395470, -65.613699),
  ('Evita', 'derivado', -27.422358, -65.618734),
  ('Ampliación Evita', 'derivado', -27.420573, -65.619387),
  ('Municipal', 'derivado', -27.422044, -65.620893),
  ('San Nicolás', 'derivado', -27.420169, -65.622668),
  ('Obrero', 'derivado', -27.420447, -65.624687),
  ('Independencia Norte', 'derivado', -27.423160, -65.624798),
  ('Las Rosas', 'derivado', -27.424315, -65.626383),
  ('Independencia', 'derivado', -27.426702, -65.619668),
  ('Libertad', 'derivado', -27.426902, -65.623854),
  ('Virgen de Guadalupe', 'derivado', -27.427084, -65.626390),
  ('Newbery', 'derivado', -27.435451, -65.619552),
  ('25 de Mayo', 'derivado', -27.438724, -65.619653),
  ('Barrientos', 'derivado', -27.441815, -65.620100),
  ('La Cumbre', 'derivado', -27.430776, -65.623737),
  ('J. A. Roca', 'derivado', -27.437152, -65.623042),
  ('San Cayetano', 'derivado', -27.438427, -65.624263),
  ('12 de Octubre', 'derivado', -27.430513, -65.627225),
  ('A. Illia', 'derivado', -27.433454, -65.627646),
  ('El Parque', 'derivado', -27.434329, -65.630560),
  ('Juan Pablo II', 'derivado', -27.432751, -65.630876),
  ('Huasa Rincón', 'derivado', -27.427764, -65.633992),
  ('Los Callejones', 'derivado', -27.428742, -65.633868),
  ('Tagusa Norte', 'derivado', -27.423959, -65.608449),
  ('Tagusa Sur', 'derivado', -27.427553, -65.606806),
  ('Belgrano', 'derivado', -27.439149, -65.612238),
  ('Colón', 'derivado', -27.438251, -65.609186),
  ('11 de Marzo', 'derivado', -27.438043, -65.607426),
  ('San Miguel', 'referencia_local', -27.428441, -65.589211),
  ('San Antonio', 'referencia_local', -27.427272, -65.595871),
  ('Finca Lolita', 'referencia_local', -27.434197, -65.602335),
  ('Mercantil', 'derivado', -27.440480, -65.623419),
  ('Universitario', 'derivado', -27.434567, -65.627642),
  ('Virgen del Valle', 'derivado', -27.419371, -65.625804),
  ('Loteo Buffo', 'derivado', -27.444252, -65.623009),
  ('Loteo Alpargatas', 'derivado', -27.444206, -65.625081),
  ('Loteo Lizárraga', 'derivado', -27.440405, -65.624904),
  ('Santa Rosa', 'referencia_local', -27.466365, -65.619503),
  ('FOTIA', 'derivado', -27.450713, -65.607055),
  ('Virgen de la Merced', 'derivado', -27.455233, -65.602138);

select is((select count(*)::integer from t326_expected), 63, 'the approved list has 63 barrios');

-- 1. Exactamente los barrios aprobados están activos
select is((select count(*)::integer from public.zones where active), 63, 'exactly 63 zones are active');

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
  array[-27.431480, -65.614660]::numeric[],
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
  56,
  'the evidence documents 56 centroids derived from the municipal plan'
);

select is(
  (select count(*)::integer from t326_expected where estado = 'referencia_local'),
  7,
  'the evidence documents 7 local references approved by Lautaro073'
);

select is(
  (select count(*)::integer from t326_expected where estado = 'null'),
  0,
  'the evidence documents 0 barrios without a point'
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
    where z.centroid_lat = -27.431480 and z.centroid_lng = -65.614660
  ),
  0,
  'the general Aguilares centroid is not copied to any barrio'
);

-- Único punto compartido, por decisión de Lautaro073: El Alto va junto con Villa Nueva.
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
  array['El Alto', 'Villa Nueva'],
  'only El Alto and Villa Nueva share a centroid'
);

-- CC-019: área de servicio de Aguilares
select is(
  (
    select count(*)::integer
    from public.zones
    where active
      and centroid_lat is not null
      and (
        centroid_lat not between -27.4800 and -27.3800
        or centroid_lng not between -65.6450 and -65.5800
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
    where version = '20261003130000'
      and cardinality(statements) > 0
  ),
  1,
  'the applied T-326 migration is recorded with its statements'
);

-- Barrio con referencia local, con coordenadas viejas.
update public.zones
set centroid_lat = -27.450000, centroid_lng = -65.600000, active = false
where name = 'Santa Rosa';

-- Barrio derivado con coordenadas distintas de la evidencia.
update public.zones
set centroid_lat = -27.451000, centroid_lng = -65.601000, active = false
where name = 'Chacarita';

do $$
declare
  stmt text;
begin
  for stmt in
    select unnest(statements)
    from supabase_migrations.schema_migrations
    where version = '20261003130000'
  loop
    -- Un fragmento que solo tiene comentarios no es una sentencia ejecutable.
    continue when btrim(regexp_replace(stmt, '--[^\n]*', '', 'g'), E' \n\r\t') = '';
    execute stmt;
  end loop;
end
$$;

select is(
  (select array[centroid_lat, centroid_lng] from public.zones where name = 'Santa Rosa' and active),
  (select array[lat, lng] from t326_expected where name = 'Santa Rosa'),
  'a stale centroid on a local-reference barrio converges to the documented value'
);

select is(
  (select array[centroid_lat, centroid_lng] from public.zones where name = 'Chacarita' and active),
  (select array[lat, lng] from t326_expected where name = 'Chacarita'),
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
