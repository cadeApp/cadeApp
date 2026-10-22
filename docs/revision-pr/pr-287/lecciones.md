# Lecciones de la PR #287

**Fuente:** 0 hallazgos. Datos crudos en [`hallazgos.jsonl`](hallazgos.jsonl).

## Resultado

No aparece un patrón nuevo atribuible al agente ni a la ficha.

Este paso aplicó correctamente varias lecciones ya existentes:

- el RED se ejecutó en una PR aislada y cerrada sin merge, usando el mismo archivo que luego quedó GREEN;
- la migración y `database.types.ts` viajaron juntas, evitando drift;
- la RPC `SECURITY DEFINER` conserva una frontera explícita de actor, consentimiento y ownership;
- el gate E2E se interpretó según el orden real del rollout y no como un falso bloqueo funcional;
- el presupuesto de bundle se inspeccionó por valores y se comparó contra el target, en vez de confiar solo en el color del job.

No se agrega numeración AG nueva.
