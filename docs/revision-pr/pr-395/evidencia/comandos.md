# Evidencia — PR #395 / CC-029 — ronda 1

**HEAD base de análisis:** `ed96bbae40cc02992fc21962bf4c2b43ef3ecfdd`. Las correcciones documentales están en el commit de revisión que contiene esta carpeta (ver HEAD del PR).

## Fuentes y límites

Se leyeron `docs/contracts/CC-029.md`, `docs/tasks/T-369.md` desde `develop` y el HEAD del PR, la fila del plan, la plantilla contract-change y los segmentos reales de SQL:
- `supabase/migrations/20261013140000_t340_clean_legacy.sql` (request_cycle y ramas de cancelación).
- `supabase/migrations/20261007090000_t339_fixed_price.sql` (match_offer).
- `supabase/migrations/20261015084902_cc026_reconcile_expired_requests.sql` (vencimientos).
- `src/features/trips/actions.ts` (entrada real de republish y no_show).

**Ejecución propia sobre texto propuesto, en memoria:** BASELINE GREEN 11/11 condiciones, **11/11 mutaciones RED** detectadas. Las mutaciones no modifican el árbol y cada variante falla porque se eliminó la propiedad que protege un control; no son tests falsos ni SQL simulado. No se ejecutaron tests locales de Node/pnpm por no contar con clon, ni `analizar.mjs`, E2E o `db-tests` (estos últimos no bloquean PR documental por instrucción del usuario).

## Harness reproducible completo

Desde un checkout de la rama del PR, copiar el siguiente script a `/tmp/cc029-doc-check.mjs` y ejecutarlo con Node (sin dependencias):

```bash
cat > /tmp/cc029-doc-check.mjs <<'JS'
import {readFileSync} from "node:fs";
const cc = readFileSync("docs/contracts/CC-029.md", "utf8");
const task = readFileSync("docs/tasks/T-369.md", "utf8");
const plan = readFileSync("docs/implementation-plan.md", "utf8");
function missing(c,t,p){
 const row=p.split("\n").find(v=>v.startsWith("| T-369 |"))||"";
 const lines=t.split("\n");
 const initial=lines.slice(lines.indexOf("## DoD")+1).find(v=>v.startsWith("- [ ] "))?.slice(6);
 return [
  ["cargo corriente",c.includes("where is_current")&&c.includes("históricos")],
  ["lote futuro",c.includes("merchant_plan_periods.starts_at <= now()")&&c.includes("no están disponibles antes")],
  ["gracia solo racha",c.includes("La gracia no extiende el ilimitado")&&c.includes("D-R1 (1-A")],
  ["legacy sin solapamiento",c.includes("primer instante posterior")&&c.includes("D-R2 (2-A")],
  ["arrastre al corte",c.includes("unused_as_of(previous.ends_at)")&&c.includes("movimientos")],
  ["conversión única",c.includes("exactamente una vez por par")&&c.includes("refund_source_lot_id")],
  ["locks coherentes",c.includes("No se reconcilian otras solicitudes")],
  ["rollout 3-A",c.includes("D-R3 (3-A")&&t.includes("**Rollout multi-PR:** sí")],
  ["DoD sincronizado",initial===row.split("|").at(-2)?.trim()],
  ["tarea bloqueada",t.includes("**Estado de la ficha: NO LISTA")],
  ["piloto intacto",c.includes("**no se crea ningún cargo**")],
 ].filter(v=>!v[1]).map(v=>v[0]);
}
const baseline=missing(cc,task,plan);
if (baseline.length){console.error("BASELINE FAIL:",baseline);process.exit(1)}
console.log("BASELINE GREEN: 11/11 condiciones");
const variants=[
 ["índice antiguo",cc.replace("where is_current","where state <> 'released'"),task,plan],
 ["lote futuro gastable",cc.replace("merchant_plan_periods.starts_at <= now()","merchant_plan_periods.starts_at > now()"),task,plan],
 ["gracia extiende ilimitado",cc.replace("La gracia no extiende el ilimitado","La gracia extiende el ilimitado"),task,plan],
 ["legacy se solapa",cc.replace("primer instante posterior","instante anterior"),task,plan],
 ["arrastre de saldo actual",cc.replace("unused_as_of(previous.ends_at)","current_available"),task,plan],
 ["conversión sin unicidad",cc.replace("exactamente una vez por par","cualquier cantidad por par"),task,plan],
 ["lock invertido",cc.replace("No se reconcilian otras solicitudes","Se reconcilian otras solicitudes"),task,plan],
 ["sin autorización multi PR",cc,task.replace("**Rollout multi-PR:** sí","**Rollout multi-PR:** no"),plan],
 ["DoD alterado",cc,task.replace("- [ ] Con el piloto activo","- [ ] Con el piloto apagado"),plan],
 ["tarea marcada lista",cc,task.replace("**Estado de la ficha: NO LISTA","**Estado de la ficha: LISTA"),plan],
 ["piloto genera cargo",cc.replace("**no se crea ningún cargo**","**se crea cargo**"),task,plan]
];
let reds=0;
for (const [label,c,t,p] of variants) {
 const errors=missing(c,t,p);
 if (!errors.length){console.error("MUTACIÓN CIEGA:",label);process.exitCode=1}
 else {reds++;console.log("RED:",label,"=>",errors.join(","))}
}
console.log("MUTACIONES RED:",reds,"/11 (solo memoria)");
JS
node /tmp/cc029-doc-check.mjs
```

Esperado: `BASELINE GREEN: 11/11 condiciones` y `MUTACIONES RED: 11/11`. Los mutantes de documentación solo existen en memoria; no escribir ni commitear variantes rotas.

## Checks útiles si existe checkout limpio (no realizados por esta revisión)

```bash
git fetch origin
git diff --check origin/develop...HEAD
pnpm exec vitest run tools/verify-fichas.test.ts
node /tmp/cc029-doc-check.mjs
node docs/revision-pr/analizar.mjs verificacion
git status --short
```

**Pruebas obligatorias en los futuros PR de implementación**: pgTAP de publicación/fin de período, índice de cargo corriente, conversiones idempotentes, carreras de locks, as-of de arrastre, pausa del ilimitado al `ends_at`; E2E Preview/staging sobre el SHA exacto del paso tercero. No adulterar expectativas ni mocks para forzar resultados.
