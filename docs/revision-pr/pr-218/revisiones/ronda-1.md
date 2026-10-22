# Informe de revisión — PR #218 / T-326 — Ronda 1

**PR:** https://github.com/cadeApp/cadeApp/pull/218  
**SHA funcional revisado:** `ea2b03a0d5cb5362e046bc6bdf4a0cff7e1169af`  
**Fecha:** 2026-10-02

## Resultado

**CON BLOQUEANTES.**

La PR está correctamente en Draft. La lista/data/georreferenciación tienen una base sólida, pero no es seguro activar esta entrega todavía: existen dos defectos externos que T-326 no puede tocar, una evidencia RED pendiente, una inconsistencia de `ON CONFLICT` y una discrepancia real de la fuente que requiere decisión de P1.

## Verificación independiente de datos y georreferenciación

Se compararon de forma mecánica:

- `docs/tasks/evidence/T-326/barrios-fuente.md`;
- `georref/barrios-centroides.json`;
- migración T-326;
- seed;
- pgTAP.

Resultado actual:

```text
barrios aprobados/versionados: 62
derivados: 51
null: 11
migration rows: 62
seed rows: 62
mismatches evidencia ↔ migration: 0
mismatches evidencia ↔ seed: 0
coordenadas duplicadas: 0
derivados fuera de bounds: 0
```

La evidencia de georreferenciación incluye:
- hash del PDF;
- datos OSM versionados;
- 19 controles medidos, 17 usados;
- 2 outliers descartados por residuo > 40 m;
- transformación afín reproducible;
- RMS de ajuste 24,9 m;
- leave-one-out RMS 32,9 m y máximo 62,7 m;
- overlay visual.

La entrega **no afirma** que los puntos sean centroides geométricos oficiales: usa el centro del rótulo circular como punto representativo interior y documenta esa limitación. Para el uso aprobado (recentrado/fallback aproximado; pin/dirección siguen siendo precisos) no se abre un bloqueante adicional por la técnica, aunque debe conservarse esa terminología honesta.

---

## PR218-H01 — Select controlado se resetea a vacío

**Severidad:** alto  
**Raíz:** `src/ui/select.tsx`  
**Resolución separada:** **CC-018 / #219**

El Select compartido mezcla:
- estado/UI propios;
- items propios `button[role=option]`;
- un `SelectPrimitive.Root` de Radix que espera sus propios `SelectPrimitive.Item`.

El select oculto de Radix no conoce los UUID renderizados por los botones. En modo controlado dentro de un formulario, la reproducción observada es:

```text
onValueChange('<uuid>')
onValueChange('')
```

Por eso el valor vuelve al placeholder.

### Regla

No arreglarlo en T-326 ignorando `''`. `src/ui/**` es contrato compartido y la ficha ordena abrir contract-change si el primitive no alcanza.

### Estado

CC-018 #219 ya fue abierto/formalizado durante esta revisión. T-326 debe esperar su merge.

---

## PR218-H02 — publish_request fabrica 500 m con barrios sin centroide

**Severidad:** alto  
**Raíz vigente:** `app_private.request_cycle`  
**Resolución separada:** **T-330 / #220**

CC-017 permite una zona activa con lat/lng null y exige no fabricar distancia.

La action de creación respeta esa semántica, pero `publish_request` vuelve a resolver:

```sql
v_lat1 := coalesce(v_contacts.pickup_lat, v_pickup.centroid_lat);
v_lng1 := coalesce(v_contacts.pickup_lng, v_pickup.centroid_lng);
v_lat2 := coalesce(v_contacts.dropoff_lat, v_dropoff.centroid_lat);
v_lng2 := coalesce(v_contacts.dropoff_lng, v_dropoff.centroid_lng);

v_distance := case
  when v_lat1 = v_lat2 and v_lng1 = v_lng2 then 0
  else greatest(500, cálculo)
end;
```

Si las coordenadas efectivas son null:
- los `NOT BETWEEN` no disparan;
- el cálculo queda null;
- PostgreSQL `greatest(500, null)` devuelve 500;
- la RPC persiste 500 m.

Eso contradice directamente CC-017 y es alcanzable con los 11 barrios null actuales.

### Estado

T-330 #220 ya fue abierto/formalizado. No tocar RPC desde T-326.

---

## PR218-H03 — Falta demostrar RED del pgTAP T-326

**Severidad:** medio  
**Archivo:** `supabase/tests/t326_aguilares_zones.sql`

El GREEN sí existe y el pgTAP se ejecuta:

```text
t326_aguilares_zones.sql .. ok
Files=16, Tests=1671
Result: PASS
```

Pero el run previo a la data (`37073383120`) fue cancelado antes de ejecutar `db-tests`.

### Arreglo requerido

Antes de Ronda 2, demostrar por CI una mutación real, por ejemplo:
- omitir/desactivar uno de los barrios esperados; o
- cambiar un centroide documentado; o
- asignar una coordenada a un barrio marcado `null`.

El pgTAP debe quedar rojo. Revertir la mutación sin debilitar tests y obtener GREEN final.

No hace falta Docker local.

---

## PR218-H04 — ON CONFLICT no sincroniza la clasificación documentada

**Severidad:** medio  
**Archivos:** migración T-326, `supabase/seed.sql`, generador `georref/gen_sql.py`

El INSERT contiene los 51 valores derivados y 11 pares null correctos, pero termina en:

```sql
on conflict (name) do update
set active = true;
```

y el seed equivale a:

```sql
set active = excluded.active;
```

Eso significa que si una fila del mismo barrio ya existe:
- un barrio que la evidencia clasifica `null` puede conservar coordenadas antiguas;
- uno `derivado` puede conservar otro centroide;
- el ambiente queda distinto del estado reproducible documentado aunque la migración “pase” en una base limpia.

Esto contradice el DoD de que cada barrio quede en la categoría documentada y que seed/migración estén alineados.

### Arreglo requerido

El generador debe producir un upsert determinista para los 62 nombres T-326:

```sql
on conflict (name) do update
set centroid_lat = excluded.centroid_lat,
    centroid_lng = excluded.centroid_lng,
    active = excluded.active;
```

Regenerar migración/seed/pgTAP desde las fuentes, no editar la lista a mano.

Agregar una prueba/mutación que preinserte al menos:
- un barrio `null` con coordenadas viejas;
- un barrio `derivado` con coordenadas distintas;

y demuestre que el resultado final coincide con la evidencia T-326.

---

## PR218-H05 — la fuente completa revela 03 — 1º de Mayo

**Severidad:** alto · **DECISIÓN P1 REQUERIDA**

La lista aprobada inicialmente tiene 62 entradas y consideraba ausente el número 03.

La lectura posterior del PDF completo/vectorial encontró:
- entrada de leyenda **`03 — 1º de Mayo`**;
- rótulo circular `(03)` dentro del plano;
- punto derivable aproximado: **-27.425778, -65.614882**.

El agente hizo correctamente **no agregarlo** sin nueva aprobación: la data actual sigue en 62.

### Decisión requerida

Lautaro073 debe decidir:
- **A:** agregar `03 — 1º de Mayo` y pasar la lista a 63 barrios; o
- **B:** mantenerlo excluido deliberadamente aunque figure en el PDF completo.

Si se elige A, usar el nombre de la fuente **`1º de Mayo`** salvo decisión explícita de normalizarlo distinto, y regenerar evidencia/data/tests mediante el generador.

---

## Estado de CI

En el commit previo a la georreferenciación, CI #944 dejó:
- typecheck ✅
- lint ✅
- build ✅
- audit ✅
- db-tests ✅
- bundle-budget ✅
- unit ❌ **esperado**: 11 RED del selector.

El HEAD actual incluye la georreferenciación/data regenerada y ya mergeó develop hasta PR #217; no se considera listo para merge mientras H01/H02 y la decisión H05 sigan abiertos.

## Coordinación

Durante la revisión se crearon:
- CC-018 #219;
- T-330 #220;
- PR documental #221 para ficha/contrato/plan.

T-326 / #190 quedó etiquetada `bloqueada`.

## Próxima ronda

Después de mergear #219 y #220 y resolver H05:
1. mergear `origin/develop` en la rama;
2. resolver la bitácora append-only;
3. regenerar data si cambia la lista;
4. corregir H04;
5. demostrar H03;
6. implementar selector con Select corregido;
7. demostrar mutaciones de UI;
8. typecheck/lint/unit/DB;
9. E2E Preview GREEN;
10. pedir Ronda 2.
