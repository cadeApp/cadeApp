-- ============================================================================
-- T-326: barrios reales de Aguilares para el onboarding de comercio
-- ============================================================================
-- Fuente: plano municipal «CIUDAD DE AGUILARES Y DIVISIONES DE BARRIOS» (nov. 2015); lista de 62 entradas
-- aprobada en docs/tasks/evidence/T-326/barrios-fuente.md.
-- 51 barrios con centroide cartográfico DERIVADO del plano municipal 2015 (no es una coordenada
-- oficial: punto representativo = centro del rótulo circular del barrio, llevado a WGS84 con un ajuste afín
-- sobre intersecciones de calles de OpenStreetMap) y 11 sin centroide. Detalle y reproducción:
-- docs/tasks/evidence/T-326/georreferenciacion.md
-- Generado con docs/tasks/evidence/T-326/georref/gen_sql.py. Idempotente.

-- 1. La fila general queda legacy: se conserva (UUID y centroide histórico) y deja de ser seleccionable.
update public.zones
set active = false
where name = 'Aguilares';

-- 2. Barrios aprobados. Si la fila ya existe solo se activa: no se pisa un centroide existente.
insert into public.zones (name, centroid_lat, centroid_lng, active)
values
  ('Chacarita', -27.422618, -65.616127, true),
  ('San José', -27.422884, -65.611733, true),
  ('Santo Domingo', -27.426663, -65.611599, true),
  ('J. F. Kennedy', -27.429432, -65.611460, true),
  ('El Porvenir', -27.434205, -65.611323, true),
  ('9 de Julio', -27.434511, -65.614602, true),
  ('San Martín', -27.440821, -65.617480, true),
  ('Aguilares - Centro', -27.429625, -65.615706, true),
  ('Almirante Brown', -27.445822, -65.617800, true),
  ('Los Álamos', -27.449446, -65.616527, true),
  ('Fray M. Esquiú', -27.447452, -65.618683, true),
  ('Alpargatas', -27.451923, -65.616631, true),
  ('Virgen del Carmen', -27.450990, -65.620061, true),
  ('Hostería', -27.446101, -65.614088, true),
  ('Sofía', -27.450276, -65.608179, true),
  ('San Lorenzo', null, null, true),
  ('Cristo - Centro', -27.453997, -65.609098, true),
  ('Gambarte', null, null, true),
  ('Terán', null, null, true),
  ('Villa Nueva', -27.415980, -65.612274, true),
  ('El Alto', null, null, true),
  ('El Ceibal', null, null, true),
  ('Santa Emilia', null, null, true),
  ('Evita', -27.422358, -65.618734, true),
  ('Ampliación Evita', -27.420573, -65.619387, true),
  ('Municipal', -27.422044, -65.620893, true),
  ('San Nicolás', -27.420169, -65.622668, true),
  ('Obrero', -27.420447, -65.624687, true),
  ('Independencia Norte', -27.423160, -65.624798, true),
  ('Las Rosas', -27.424315, -65.626383, true),
  ('Independencia', -27.426702, -65.619668, true),
  ('Libertad', -27.426902, -65.623854, true),
  ('Virgen de Guadalupe', -27.427084, -65.626390, true),
  ('Newbery', -27.435451, -65.619552, true),
  ('25 de Mayo', -27.438724, -65.619653, true),
  ('Barrientos', -27.441815, -65.620100, true),
  ('La Cumbre', -27.430776, -65.623737, true),
  ('J. A. Roca', -27.437152, -65.623042, true),
  ('San Cayetano', -27.438427, -65.624263, true),
  ('12 de Octubre', -27.430513, -65.627225, true),
  ('A. Illia', -27.433454, -65.627646, true),
  ('El Parque', -27.434329, -65.630560, true),
  ('Juan Pablo II', -27.432751, -65.630876, true),
  ('Huasa Rincón', -27.427764, -65.633992, true),
  ('Los Callejones', -27.428742, -65.633868, true),
  ('Tagusa Norte', -27.423959, -65.608449, true),
  ('Tagusa Sur', -27.427553, -65.606806, true),
  ('Belgrano', -27.439149, -65.612238, true),
  ('Colón', -27.438251, -65.609186, true),
  ('11 de Marzo', -27.438043, -65.607426, true),
  ('San Miguel', null, null, true),
  ('San Antonio', null, null, true),
  ('Finca Lolita', null, null, true),
  ('Mercantil', -27.440480, -65.623419, true),
  ('Universitario', -27.434567, -65.627642, true),
  ('Virgen del Valle', -27.419371, -65.625804, true),
  ('Loteo Buffo', -27.444252, -65.623009, true),
  ('Loteo Alpargatas', -27.444206, -65.625081, true),
  ('Loteo Lizárraga', -27.440405, -65.624904, true),
  ('Santa Rosa', null, null, true),
  ('FOTIA', -27.450713, -65.607055, true),
  ('Virgen de la Merced', null, null, true)
on conflict (name) do update
set active = true;
