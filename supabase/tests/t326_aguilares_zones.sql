begin;

create extension if not exists pgtap with schema extensions;
set local search_path to public, extensions;

select plan(14);

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
  ('Chacarita', true, -27.422618, -65.616127),
  ('San José', true, -27.422884, -65.611733),
  ('Santo Domingo', true, -27.426663, -65.611599),
  ('J. F. Kennedy', true, -27.429432, -65.611460),
  ('El Porvenir', true, -27.434205, -65.611323),
  ('9 de Julio', true, -27.434511, -65.614602),
  ('San Martín', true, -27.440821, -65.617480),
  ('Aguilares - Centro', true, -27.429625, -65.615706),
  ('Almirante Brown', true, -27.445822, -65.617800),
  ('Los Álamos', true, -27.449446, -65.616527),
  ('Fray M. Esquiú', true, -27.447452, -65.618683),
  ('Alpargatas', true, -27.451923, -65.616631),
  ('Virgen del Carmen', true, -27.450990, -65.620061),
  ('Hostería', true, -27.446101, -65.614088),
  ('Sofía', true, -27.450276, -65.608179),
  ('San Lorenzo', false, null, null),
  ('Cristo - Centro', true, -27.453997, -65.609098),
  ('Gambarte', false, null, null),
  ('Terán', false, null, null),
  ('Villa Nueva', true, -27.415980, -65.612274),
  ('El Alto', false, null, null),
  ('El Ceibal', false, null, null),
  ('Santa Emilia', false, null, null),
  ('Evita', true, -27.422358, -65.618734),
  ('Ampliación Evita', true, -27.420573, -65.619387),
  ('Municipal', true, -27.422044, -65.620893),
  ('San Nicolás', true, -27.420169, -65.622668),
  ('Obrero', true, -27.420447, -65.624687),
  ('Independencia Norte', true, -27.423160, -65.624798),
  ('Las Rosas', true, -27.424315, -65.626383),
  ('Independencia', true, -27.426702, -65.619668),
  ('Libertad', true, -27.426902, -65.623854),
  ('Virgen de Guadalupe', true, -27.427084, -65.626390),
  ('Newbery', true, -27.435451, -65.619552),
  ('25 de Mayo', true, -27.438724, -65.619653),
  ('Barrientos', true, -27.441815, -65.620100),
  ('La Cumbre', true, -27.430776, -65.623737),
  ('J. A. Roca', true, -27.437152, -65.623042),
  ('San Cayetano', true, -27.438427, -65.624263),
  ('12 de Octubre', true, -27.430513, -65.627225),
  ('A. Illia', true, -27.433454, -65.627646),
  ('El Parque', true, -27.434329, -65.630560),
  ('Juan Pablo II', true, -27.432751, -65.630876),
  ('Huasa Rincón', true, -27.427764, -65.633992),
  ('Los Callejones', true, -27.428742, -65.633868),
  ('Tagusa Norte', true, -27.423959, -65.608449),
  ('Tagusa Sur', true, -27.427553, -65.606806),
  ('Belgrano', true, -27.439149, -65.612238),
  ('Colón', true, -27.438251, -65.609186),
  ('11 de Marzo', true, -27.438043, -65.607426),
  ('San Miguel', false, null, null),
  ('San Antonio', false, null, null),
  ('Finca Lolita', false, null, null),
  ('Mercantil', true, -27.440480, -65.623419),
  ('Universitario', true, -27.434567, -65.627642),
  ('Virgen del Valle', true, -27.419371, -65.625804),
  ('Loteo Buffo', true, -27.444252, -65.623009),
  ('Loteo Alpargatas', true, -27.444206, -65.625081),
  ('Loteo Lizárraga', true, -27.440405, -65.624904),
  ('Santa Rosa', false, null, null),
  ('FOTIA', true, -27.450713, -65.607055),
  ('Virgen de la Merced', false, null, null);

select is((select count(*)::integer from t326_expected), 62, 'the approved list has 62 barrios');

-- 1. Exactamente los barrios aprobados están activos
select is((select count(*)::integer from public.zones where active), 62, 'exactly 62 zones are active');

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

-- 4. Centroides: solo los derivados documentados, el resto null
select is(
  (select count(*)::integer from t326_expected where derived),
  51,
  'the evidence documents 51 derived centroids'
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
    where z.centroid_lat = -27.431480 and z.centroid_lng = -65.614660
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

select * from finish();
rollback;
