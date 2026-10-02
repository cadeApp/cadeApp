-- ============================================================================
-- T-326: barrios reales de Aguilares para el onboarding de comercio
-- ============================================================================
-- Fuente: plano municipal «CIUDAD DE AGUILARES Y DIVISIONES DE BARRIOS» (nov. 2015); lista de 62 entradas
-- aprobada en docs/tasks/evidence/T-326/barrios-fuente.md. Ningún barrio se carga con centroide: no hay
-- georreferenciación ejecutada (docs/tasks/evidence/T-326/georreferenciacion.md) y CC-017 permite zonas
-- activas sin centroide. Idempotente: se puede aplicar sobre una base que ya tenga alguna de estas filas.

-- 1. La fila general queda legacy: se conserva (UUID y centroide histórico) y deja de ser seleccionable.
update public.zones
set active = false
where name = 'Aguilares';

-- 2. Barrios aprobados. Si la fila ya existe solo se activa; no se pisa un centroide existente.
insert into public.zones (name, centroid_lat, centroid_lng, active)
values
  ('Chacarita', null, null, true),
  ('San José', null, null, true),
  ('Santo Domingo', null, null, true),
  ('J. F. Kennedy', null, null, true),
  ('El Porvenir', null, null, true),
  ('9 de Julio', null, null, true),
  ('San Martín', null, null, true),
  ('Aguilares - Centro', null, null, true),
  ('Almirante Brown', null, null, true),
  ('Los Álamos', null, null, true),
  ('Fray M. Esquiú', null, null, true),
  ('Alpargatas', null, null, true),
  ('Virgen del Carmen', null, null, true),
  ('Hostería', null, null, true),
  ('Sofía', null, null, true),
  ('San Lorenzo', null, null, true),
  ('Cristo - Centro', null, null, true),
  ('Gambarte', null, null, true),
  ('Terán', null, null, true),
  ('Villa Nueva', null, null, true),
  ('El Alto', null, null, true),
  ('El Ceibal', null, null, true),
  ('Santa Emilia', null, null, true),
  ('Evita', null, null, true),
  ('Ampliación Evita', null, null, true),
  ('Municipal', null, null, true),
  ('San Nicolás', null, null, true),
  ('Obrero', null, null, true),
  ('Independencia Norte', null, null, true),
  ('Las Rosas', null, null, true),
  ('Independencia', null, null, true),
  ('Libertad', null, null, true),
  ('Virgen de Guadalupe', null, null, true),
  ('Newbery', null, null, true),
  ('25 de Mayo', null, null, true),
  ('Barrientos', null, null, true),
  ('La Cumbre', null, null, true),
  ('J. A. Roca', null, null, true),
  ('San Cayetano', null, null, true),
  ('12 de Octubre', null, null, true),
  ('A. Illia', null, null, true),
  ('El Parque', null, null, true),
  ('Juan Pablo II', null, null, true),
  ('Huasa Rincón', null, null, true),
  ('Los Callejones', null, null, true),
  ('Tagusa Norte', null, null, true),
  ('Tagusa Sur', null, null, true),
  ('Belgrano', null, null, true),
  ('Colón', null, null, true),
  ('11 de Marzo', null, null, true),
  ('San Miguel', null, null, true),
  ('San Antonio', null, null, true),
  ('Finca Lolita', null, null, true),
  ('Mercantil', null, null, true),
  ('Universitario', null, null, true),
  ('Virgen del Valle', null, null, true),
  ('Loteo Buffo', null, null, true),
  ('Loteo Alpargatas', null, null, true),
  ('Loteo Lizárraga', null, null, true),
  ('Santa Rosa', null, null, true),
  ('FOTIA', null, null, true),
  ('Virgen de la Merced', null, null, true)
on conflict (name) do update
set active = true;
