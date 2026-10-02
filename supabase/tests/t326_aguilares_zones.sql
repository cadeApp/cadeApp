begin;

create extension if not exists pgtap with schema extensions;
set local search_path to public, extensions;

select plan(11);

-- Lista aprobada: columna «Normalización candidata» de docs/tasks/evidence/T-326/barrios-fuente.md
-- (62 entradas, numeración municipal discontinua).
create temporary table t326_expected (name text primary key) on commit drop;
insert into t326_expected (name)
values
  ('Chacarita'),
  ('San José'),
  ('Santo Domingo'),
  ('J. F. Kennedy'),
  ('El Porvenir'),
  ('9 de Julio'),
  ('San Martín'),
  ('Aguilares - Centro'),
  ('Almirante Brown'),
  ('Los Álamos'),
  ('Fray M. Esquiú'),
  ('Alpargatas'),
  ('Virgen del Carmen'),
  ('Hostería'),
  ('Sofía'),
  ('San Lorenzo'),
  ('Cristo - Centro'),
  ('Gambarte'),
  ('Terán'),
  ('Villa Nueva'),
  ('El Alto'),
  ('El Ceibal'),
  ('Santa Emilia'),
  ('Evita'),
  ('Ampliación Evita'),
  ('Municipal'),
  ('San Nicolás'),
  ('Obrero'),
  ('Independencia Norte'),
  ('Las Rosas'),
  ('Independencia'),
  ('Libertad'),
  ('Virgen de Guadalupe'),
  ('Newbery'),
  ('25 de Mayo'),
  ('Barrientos'),
  ('La Cumbre'),
  ('J. A. Roca'),
  ('San Cayetano'),
  ('12 de Octubre'),
  ('A. Illia'),
  ('El Parque'),
  ('Juan Pablo II'),
  ('Huasa Rincón'),
  ('Los Callejones'),
  ('Tagusa Norte'),
  ('Tagusa Sur'),
  ('Belgrano'),
  ('Colón'),
  ('11 de Marzo'),
  ('San Miguel'),
  ('San Antonio'),
  ('Finca Lolita'),
  ('Mercantil'),
  ('Universitario'),
  ('Virgen del Valle'),
  ('Loteo Buffo'),
  ('Loteo Alpargatas'),
  ('Loteo Lizárraga'),
  ('Santa Rosa'),
  ('FOTIA'),
  ('Virgen de la Merced');

select is(
  (select count(*)::integer from t326_expected),
  62,
  'the approved list has 62 barrios'
);

-- 1. Exactamente los barrios aprobados están activos
select is(
  (select count(*)::integer from public.zones where active),
  62,
  'exactly 62 zones are active'
);

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

-- 4. Centroides: ninguno inventado
select is(
  (
    select count(*)::integer
    from public.zones z
    join t326_expected e on e.name = z.name
    where z.centroid_lat is not null or z.centroid_lng is not null
  ),
  0,
  'no approved barrio has a centroid: none was georeferenced'
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
    from public.zones
    where active
      and centroid_lat is not null
      and (
        centroid_lat not between -27.4550 and -27.4100
        or centroid_lng not between -65.6400 and -65.5950
      )
  ),
  0,
  'any centroid on an active zone stays inside the Aguilares bounding box'
);

select * from finish();
rollback;
