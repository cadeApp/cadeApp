# Lecciones de PR #510

**Fuente:** 3 bloqueantes (H01–H03) y una mejora documental tomada (H04).

- **P06 — casos omitidos:** una RPC nueva en el fake no queda probada por validar solo el schema; un detalle con multientrega también debe contemplar legacy `drops=[]`.
- **P08 — control que mide un proxy:** un `.eq()` no-op en mocks deja pasar lecturas sin `request_id`; verificar condiciones y usar fixture adversaria.
- **P03 — texto de contrato contradictorio:** corregir las afirmaciones de impacto cuando la arquitectura exige un fake.

## Acciones futuras

1. Agregar tests del fake real y mutaciones de predicados/keyset.
2. Probar explícitamente escenarios legacy en UI.
3. Hacer que mocks de PostgREST registren/apliquen condiciones de aislamiento.
4. No debilitar tests, exclusions ni thresholds para fabricar verde.

No se asigna un nuevo identificador `AG-NN`: no se comprobó el máximo en todas las ramas remotas; se documentan los patrones P03/P06/P08 del catálogo existente. No proponer cambio a `AGENTS.md` por esta sola PR. H02 y H03 aún deben reproducirse mediante mutación RED independiente.
