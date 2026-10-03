# T-326 — Evidencia de georreferenciación del plano municipal

## Estado

**EJECUTADA el 2026-10-02; completada el 2026-10-03.** Los 63 barrios aprobados tienen punto:

- **56 `derivado`** del plano municipal: 55 desde el centro del rótulo circular y 1 (17 San Lorenzo) desde el centro
  del área rosa del plano.
- **7 `referencia_local`**, aprobados por Lautaro073 (24, 25, 26, 55, 56, 57 y 65): el plano no los ubica o los deja
  agrupados en el borde.
- **0 `NULL`.**

19, 20, 67 y el área de 17 caen al sur del recuadro original. Entran gracias a CC-019 (#225, issue #226), que amplió el
área de servicio a lat -27.4800..-27.3800 y lng -65.6450..-65.5800. La lista pasó de 62 a 63 con la incorporación de
`03 — 1º de Mayo` (decisión P1, opción A, hallazgo PR218-H05).

Los puntos derivados son **aproximados y no oficiales**: sirven para recentrar el mapa y como fallback aproximado.
La ubicación precisa del comercio sigue siendo la dirección, el pin o el GPS.

## Fuente

- Archivo: `1009795293-Plano-Aguilares-Con-Barrios-260211-114103.pdf` (1 página, 612 × 1008 pt, vectorial)
- SHA-256: `7dc1206e60a3ffe629fecec389f28e817944ce2b6d1d4c97d1f5044c658dfd93` (recalculado el 2026-10-02 sobre el archivo aportado: coincide)
- Municipio: Aguilares
- Tema impreso: `CIUDAD DE AGUILARES Y DIVISIONES DE BARRIOS` / `PLANO POR BARRIOS`
- Fecha: noviembre de 2015
- Cartografía de referencia: OpenStreetMap, calles con nombre dentro del recuadro de Aguilares
  (`-27.4550..-27.4100`, `-65.6400..-65.5950`), descargadas con Overpass el 2026-10-02.
  Copia en `georref/osm-calles-aguilares.json` (© colaboradores de OpenStreetMap, licencia ODbL).

## Hallazgos al leer el plano

- **Rótulo de barrio = número dentro de un círculo** (por ejemplo `(09)` en el Centro). Los números violetas sin círculo
  son equipamientos (escuelas, salud, iglesias), no barrios.
- **La leyenda trae 63 entradas:** incluye `03- 1º de Mayo`, que la transcripción inicial de `barrios-fuente.md` omitía.
  El plano tiene además un rótulo circular `(03)`. **Resuelto el 2026-10-02:** Lautaro073 eligió la opción A e incorporó
  el barrio 03 a la lista aprobada; `points.json` le da -27.425778, -65.614882 (`in_bounds = true`) y queda `derivado`.
- En el mapa hay rótulos circulares `21`, `22`, `47` y `58` que no figuran en la leyenda: no se usan.

## Metodología

### 1. Punto representativo por barrio

Centro del rótulo circular del barrio, tomado del texto vectorial del PDF (palabras numéricas de 4,9 pt fuera de la
leyenda). Cada rótulo se verificó visualmente en una hoja de recortes del render a 400 ppp. Se descartaron los números
de 4,9 pt que forman parte de nombres de calle (`20 DE JUNIO`, `24 DE SETIEMBRE`).

**No es el centroide geométrico del polígono del barrio**: varios barrios están rayados (sin relleno) o comparten color
con sus vecinos, y su contorno no se puede separar de forma confiable. El rótulo está dibujado dentro del barrio, así
que es un punto interior razonable.

### 2. Puntos de control

Intersección de dos calles con nombre, medida de las dos formas:

- **Plano:** cada rótulo de calle define una recta (centro del rótulo + dirección del texto); el punto es el cruce de
  las dos rectas. Se toma el par de rótulos más cercano entre sí.
- **OSM:** cruce de las geometrías de las dos calles. En avenidas de doble mano (dos cruces a menos de 30 m) se promedian.

Se contrastaron tres intersecciones contra Google Maps; en las tres la diferencia con OSM fue menor a 5 m:

| Intersección | Google Maps | OSM |
|---|---|---|
| Av. Sarmiento y San Martín | -27.4310088, -65.6141484 | -27.430993, -65.614127 |
| Catamarca y Tierra del Fuego | -27.4184898, -65.6139322 | -27.418470, -65.613940 |
| Costa Rica y México | -27.4510349, -65.6194409 | -27.451024, -65.619483 |

| ID | Intersección (plano → OSM) | x plano | y plano | lat OSM | lng OSM | uso | residuo ajuste | residuo LOO |
|---|---|---:|---:|---:|---:|---|---:|---:|
| CP01 | D. RETONDO x C. PELLEGRINI | 220.3 | 347.7 | -27.429449 | -65.624387 | ajuste | 18.8 m | 23.0 m |
| CP02 | ALSINA x V. SARFIELD | 263.5 | 359.8 | -27.430257 | -65.621206 | ajuste | 11.8 m | 13.0 m |
| CP03 | AV. SARMIENTO x SAN MARTIN | 360.8 | 371.8 | -27.430993 | -65.614127 | ajuste | 10.6 m | 11.9 m |
| CP04 | J.B. ALBERDI x SAN MARTIN | 332.5 | 371.8 | -27.431056 | -65.616297 | ajuste | 17.4 m | 18.7 m |
| CP05 | B. RIVADAVIA x A. DEL VALLE | 416.3 | 323.0 | -27.428001 | -65.609758 | ajuste | 37.1 m | 46.0 m |
| CP06 | M. MORENO x AV. MITRE | 389.5 | 382.1 | -27.431896 | -65.611930 | ajuste | 17.0 m | 20.6 m |
| CP07 | J. MARMOL x C. PELLEGRINI | 375.3 | 337.3 | -27.429029 | -65.613086 | ajuste | 24.3 m | 27.3 m |
| CP08 | AV. GRAL. SAVIO x A. AGUADO | 194.3 | 455.8 | -27.436519 | -65.625668 | ajuste | 37.7 m | 49.0 m |
| CP09 | AV. GRAL. SAVIO x I. GORRITI | 194.3 | 403.1 | -27.433341 | -65.625841 | ajuste | 33.9 m | 44.0 m |
| CP10 | COSTA RICA x ECUADOR | 285.3 | 629.9 | -27.447965 | -65.618554 | descartado (61.1 m) | — | — |
| CP11 | COSTA RICA x MEXICO | 285.3 | 678.6 | -27.451024 | -65.619483 | ajuste | 23.7 m | 62.7 m |
| CP12 | CATAMARCA x TIERRA DEL FUEGO | 360.6 | 182.0 | -27.418470 | -65.613940 | ajuste | 25.2 m | 30.3 m |
| CP13 | MISIONES x ANTARTIDA ARGENTINA | 389.8 | 208.3 | -27.420229 | -65.612143 | ajuste | 15.9 m | 18.8 m |
| CP14 | LA RIOJA x ANTARTIDA ARGENTINA | 374.9 | 202.7 | -27.419845 | -65.613284 | ajuste | 21.6 m | 25.3 m |
| CP15 | AV. NEUQUEN x TIERRA DEL FUEGO | 343.5 | 175.6 | -27.418041 | -65.615093 | ajuste | 31.7 m | 38.7 m |
| CP16 | N. LAPRIDA x C. PELLEGRINI | 279.0 | 345.1 | -27.429306 | -65.620216 | ajuste | 23.5 m | 25.5 m |
| CP17 | D. RETONDO x V. SARFIELD | 220.3 | 361.8 | -27.430387 | -65.624355 | ajuste | 15.9 m | 19.2 m |
| CP18 | LAMADRID x J.A. ROCA | 318.8 | 271.0 | -27.425039 | -65.617743 | descartado (81.3 m) | — | — |
| CP19 | AV. SARMIENTO x AV. BELGRANO | 360.8 | 282.8 | -27.425422 | -65.614358 | ajuste | 32.8 m | 35.9 m |

19 puntos medidos, distribuidos norte (CP12–CP15), centro (CP01–CP07, CP16, CP17, CP19), oeste (CP08, CP09) y sur
(CP10, CP11). 2 descartados por residuo > 40 m (CP10, CP18), 17 usados.

### 3. Transformación

Afín de 6 parámetros, mínimos cuadrados, de coordenadas del plano (pt) a metros locales
(`x_m = (lng + 65.62) × 98 804,77`, `y_m = (lat + 27.43) × 111 132`). Parámetros en `georref/transform.json`.

- Escala: 7,11 m/pt en x y 7,31 m/pt en y; ángulo entre ejes 89,6°. Es lo esperable de un plano dibujado casi a escala.
- **Residuos:** RMS del ajuste 24,9 m. Validación *leave-one-out* (cada punto se predice con un ajuste que no lo usa):
  **RMS 32,9 m, máximo 62,7 m** (CP11, el único punto del sur).
- **Validación visual:** `georref/superposicion-osm.jpg` dibuja todas las calles de OSM (azul), transformadas al plano,
  sobre el render del plano, junto con los rótulos usados (rojo). En el centro las calles caen sobre las calles del
  plano. En el **norte** (zona amarilla) quedan corridas alrededor de media cuadra: el error ahí es de 40–60 m.

## Resultado por barrio

Estados:
- `derivado`: punto reproducible, dentro del recuadro de Aguilares que valida la DB.
- `referencia_local`: el plano no ubica el barrio (sin rótulo circular, o rótulos agrupados en el borde del plano).
  El punto es el lugar que Lautaro073 señaló con capturas de Google Maps, leído de Google Maps u OpenStreetMap. No es
  geocodificación automática por nombre. Detalle en `georref/referencias-locales.json` y en la sección siguiente.
- `null`: sin punto confiable. Hoy ningún barrio queda en este estado.

| Nº plano | Barrio | punto en el plano (x, y) | método de punto | lat | lng | estado | nota / motivo si es null |
|---:|---|---|---|---:|---:|---|---|
| 01 | Chacarita | (332.8, 243.2) | centro del rótulo circular | -27.422618 | -65.616127 | derivado | |
| 02 | San José | (393.9, 247.0) | centro del rótulo circular | -27.422884 | -65.611733 | derivado | |
| 03 | 1º de Mayo | (350.0, 291.2) | centro del rótulo circular | -27.425778 | -65.614882 | derivado | |
| 04 | Santo Domingo | (395.6, 304.5) | centro del rótulo circular | -27.426663 | -65.611599 | derivado | |
| 05 | J. F. Kennedy | (397.4, 346.6) | centro del rótulo circular | -27.429432 | -65.611460 | derivado | |
| 06 | El Porvenir | (399.1, 419.2) | centro del rótulo circular | -27.434205 | -65.611323 | derivado | |
| 07 | 9 de Julio | (353.5, 424.0) | centro del rótulo circular | -27.434511 | -65.614602 | derivado | |
| 08 | San Martín | (313.2, 520.1) | centro del rótulo circular | -27.440821 | -65.617480 | derivado | |
| 09 | Aguilares - Centro | (338.4, 349.7) | centro del rótulo circular | -27.429625 | -65.615706 | derivado | |
| 10 | Almirante Brown | (308.5, 596.2) | centro del rótulo circular | -27.445822 | -65.617800 | derivado | |
| 11 | Los Álamos | (326.0, 651.3) | centro del rótulo circular | -27.449446 | -65.616527 | derivado | |
| 12 | Fray M. Esquiú | (296.1, 621.1) | centro del rótulo circular | -27.447452 | -65.618683 | derivado | |
| 13 | Alpargatas | (324.4, 689.0) | centro del rótulo circular | -27.451923 | -65.616631 | derivado | |
| 14 | Virgen del Carmen | (276.8, 674.9) | centro del rótulo circular | -27.450990 | -65.620061 | derivado | |
| 15 | Hostería | (360.1, 600.3) | centro del rótulo circular | -27.446101 | -65.614088 | derivado | |
| 16 | Sofía | (442.0, 663.5) | centro del rótulo circular | -27.450276 | -65.608179 | derivado | |
| 17 | San Lorenzo | (359.3, 750.6) | centro del área rosa del plano | -27.455981 | -65.614109 | derivado | |
| 18 | Cristo - Centro | (429.1, 720.2) | centro del rótulo circular | -27.453997 | -65.609098 | derivado | |
| 19 | Gambarte | (504.9, 752.6) | centro del rótulo circular | -27.456143 | -65.603636 | derivado | |
| 20 | Terán | (525.8, 755.5) | centro del rótulo circular | -27.456337 | -65.602134 | derivado | |
| 23 | Villa Nueva | (386.7, 142.0) | centro del rótulo circular | -27.415980 | -65.612274 | derivado | |
| 24 | El Alto | — | referencia local | -27.415980 | -65.612274 | referencia_local | mismo punto que 23 Villa Nueva |
| 25 | El Ceibal | — | referencia local | -27.396438 | -65.635938 | referencia_local | ver «Referencias locales» |
| 26 | Santa Emilia | — | referencia local | -27.395470 | -65.613699 | referencia_local | ver «Referencias locales» |
| 27 | Evita | (296.6, 239.3) | centro del rótulo circular | -27.422358 | -65.618734 | derivado | |
| 28 | Ampliación Evita | (287.6, 212.2) | centro del rótulo circular | -27.420573 | -65.619387 | derivado | |
| 29 | Municipal | (266.6, 234.7) | centro del rótulo circular | -27.422044 | -65.620893 | derivado | |
| 30 | San Nicolás | (242.0, 206.2) | centro del rótulo circular | -27.420169 | -65.622668 | derivado | |
| 31 | Obrero | (213.9, 210.5) | centro del rótulo circular | -27.420447 | -65.624687 | derivado | |
| 32 | Independencia Norte | (212.2, 251.8) | centro del rótulo circular | -27.423160 | -65.624798 | derivado | |
| 33 | Las Rosas | (190.2, 269.5) | centro del rótulo circular | -27.424315 | -65.626383 | derivado | |
| 34 | Independencia | (283.4, 305.5) | centro del rótulo circular | -27.426702 | -65.619668 | derivado | |
| 35 | Libertad | (225.2, 308.7) | centro del rótulo circular | -27.426902 | -65.623854 | derivado | |
| 36 | Virgen de Guadalupe | (189.9, 311.6) | centro del rótulo circular | -27.427084 | -65.626390 | derivado | |
| 37 | Newbery | (284.6, 438.5) | centro del rótulo circular | -27.435451 | -65.619552 | derivado | |
| 38 | 25 de Mayo | (283.0, 488.3) | centro del rótulo circular | -27.438724 | -65.619653 | derivado | |
| 39 | Barrientos | (276.7, 535.4) | centro del rótulo circular | -27.441815 | -65.620100 | derivado | |
| 40 | La Cumbre | (226.6, 367.6) | centro del rótulo circular | -27.430776 | -65.623737 | derivado | |
| 41 | J. A. Roca | (236.0, 464.6) | centro del rótulo circular | -27.437152 | -65.623042 | derivado | |
| 42 | San Cayetano | (219.0, 484.0) | centro del rótulo circular | -27.438427 | -65.624263 | derivado | |
| 43 | 12 de Octubre | (178.2, 363.8) | centro del rótulo circular | -27.430513 | -65.627225 | derivado | |
| 44 | A. Illia | (172.2, 408.5) | centro del rótulo circular | -27.433454 | -65.627646 | derivado | |
| 45 | El Parque | (131.6, 422.0) | centro del rótulo circular | -27.434329 | -65.630560 | derivado | |
| 46 | Juan Pablo II | (127.3, 398.0) | centro del rótulo circular | -27.432751 | -65.630876 | derivado | |
| 48 | Huasa Rincón | (84.2, 322.3) | centro del rótulo circular | -27.427764 | -65.633992 | derivado | |
| 49 | Los Callejones | (85.9, 337.1) | centro del rótulo circular | -27.428742 | -65.633868 | derivado | |
| 50 | Tagusa Norte | (439.5, 263.2) | centro del rótulo circular | -27.423959 | -65.608449 | derivado | |
| 51 | Tagusa Sur | (462.2, 317.8) | centro del rótulo circular | -27.427553 | -65.606806 | derivado | |
| 52 | Belgrano | (386.1, 494.5) | centro del rótulo circular | -27.439149 | -65.612238 | derivado | |
| 53 | Colón | (428.6, 480.7) | centro del rótulo circular | -27.438251 | -65.609186 | derivado | |
| 54 | 11 de Marzo | (453.1, 477.4) | centro del rótulo circular | -27.438043 | -65.607426 | derivado | |
| 55 | San Miguel | — | referencia local | -27.428441 | -65.589211 | referencia_local | ver «Referencias locales» |
| 56 | San Antonio | — | referencia local | -27.427272 | -65.595871 | referencia_local | ver «Referencias locales» |
| 57 | Finca Lolita | — | referencia local | -27.434197 | -65.602335 | referencia_local | ver «Referencias locales» |
| 59 | Mercantil | (230.6, 515.2) | centro del rótulo circular | -27.440480 | -65.623419 | derivado | |
| 60 | Universitario | (172.2, 425.5) | centro del rótulo circular | -27.434567 | -65.627642 | derivado | |
| 61 | Virgen del Valle | (198.4, 194.2) | centro del rótulo circular | -27.419371 | -65.625804 | derivado | |
| 62 | Loteo Buffo | (236.1, 572.6) | centro del rótulo circular | -27.444252 | -65.623009 | derivado | |
| 63 | Loteo Alpargatas | (207.3, 572.0) | centro del rótulo circular | -27.444206 | -65.625081 | derivado | |
| 64 | Loteo Lizárraga | (210.0, 514.1) | centro del rótulo circular | -27.440405 | -65.624904 | derivado | |
| 65 | Santa Rosa | — | referencia local | -27.466365 | -65.619503 | referencia_local | ver «Referencias locales» |
| 66 | FOTIA | (457.6, 670.1) | centro del rótulo circular | -27.450713 | -65.607055 | derivado | |
| 67 | Virgen de la Merced | (525.8, 738.7) | centro del rótulo circular | -27.455233 | -65.602138 | derivado | |


## Barrio 17: centro del área rosa

El plano tiene dos rótulos, 17A y 17. Por decisión de Lautaro073, el barrio 17 San Lorenzo es **toda el área pintada de
rosa**: la franja bajo 17A y las cuatro manzanas alrededor de (17). `georref/area17.py` toma los 49 rellenos
vectoriales de ese color en la zona, cuenta 22 009 píxeles rosas en el render a 400 ppp y calcula su centroide:
(359.3, 750.6) pt → **-27.455981, -65.614109**, a unos 16 m del rótulo (17). La máscara está en
`georref/area-17-mascara.png` y coincide con la captura de Lautaro073. El error del ajuste en el sur es el de CP11
(LOO 62,7 m).

## Referencias locales

Aprobadas por Lautaro073 el 2026-10-03, con capturas de Google Maps del lugar de cada barrio. Fuente y enlace en
`georref/referencias-locales.json`.

| Nº | Barrio | lat | lng | lugar de referencia |
|---:|---|---:|---:|---|
| 24 | El Alto | -27.415980 | -65.612274 | «va junto con la Villa Nueva»: mismo punto que 23 Villa Nueva (único punto compartido) |
| 25 | El Ceibal | -27.396438 | -65.635938 | Google Maps «El ceival Monte rico»; OSM «El Ceibal» a ~60 m |
| 26 | Santa Emilia | -27.395470 | -65.613699 | OpenStreetMap «Barrio Santa Emilia»; elegido frente a «Monte Rico Alto» |
| 55 | San Miguel | -27.428441 | -65.589211 | Google Maps «Canchita de barrio San miguel», pasando Tagusa sobre Av. Belgrano |
| 56 | San Antonio | -27.427272 | -65.595871 | Google Maps «Capilla San Antonio de Padua», mismo sector |
| 57 | Finca Lolita | -27.434197 | -65.602335 | Google Maps «Finca Lolita» |
| 65 | Santa Rosa | -27.466365 | -65.619503 | OpenStreetMap «Santa Rosa» (suburb), sobre la Ruta 38 entre «La casa de Tiziano» y «Motel Grey» |

## Reproducción

Herramientas: Python 3.11 con `pymupdf`, `numpy` y `pillow` en un entorno descartable (no son dependencias del proyecto),
y `pdftoppm` para el render. `BASE` es una carpeta de trabajo con `plano/plano.pdf` y `geo/ways.json`.

1. `pdftoppm -r 400 -png plano/plano.pdf plano/plano` → `plano/plano-1.png`.
2. Rótulos circulares: `georref/rotulos-circulares.json` (palabras numéricas de 4,9 pt del PDF, fuera de la leyenda).
3. `python georref/controls.py BASE` → `controls.json` (puntos de control).
4. `python georref/fit.py BASE 40` → `transform.json` y residuos (`georref/ajuste-salida.txt`).
5. `python georref/points.py BASE` → `points.json` y la superposición con OSM. `in_bounds` usa el recuadro de
   CC-019.
5b. `python georref/area17.py BASE` → `area-17.json` y `area-17-mascara.png` (barrio 17).
6. `python georref/final.py BASE <repo>` → `BASE/geo/final.json`, que se copia sin cambios como
   `barrios-centroides.json` (estado por barrio). Exige las 63 entradas de `barrios-fuente.md` y combina
   `points.json`, `area-17.json` y `georref/referencias-locales.json`.
7. `python docs/tasks/evidence/T-326/georref/gen_sql.py`, desde la raíz del repo, regenera la migración, el seed y el
   pgTAP desde `barrios-fuente.md` + `barrios-centroides.json`. Salida actual: `ok · derivados=56 · referencia_local=7 · null=0`.
   La migración y el seed comparten el mismo upsert (`on conflict (name) do update set centroid_lat, centroid_lng,
   active` desde `excluded`): una fila preexistente converge a la evidencia, también a `NULL`/`NULL` (PR218-H04).
   El pgTAP precarga dos filas divergentes y re-ejecuta las sentencias registradas de la migración aplicada.

## Reglas

- No usar geocoding del nombre como sustituto del plano.
- No copiar el centro de Aguilares ni el centroide general de otra zona. El pgTAP verifica que ningún barrio lo tenga y
  que ningún punto se repita.
- No elegir coordenadas a ojo: todo punto sale de un rótulo del PDF y de una transformación con residuos documentados.
- Si hay barrio multipartito o rótulo ambiguo, el centroide queda `NULL`, salvo que Lautaro073 apruebe una referencia
  local documentada.
- En UI, el centroide derivado sirve para recentrado o fallback aproximado; no reemplaza el pin o la dirección precisa
  del comercio.
