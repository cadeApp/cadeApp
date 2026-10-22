# PR #388 — evidencia reproducible de revisión documental

SHA base de autor: `b597810ef7eddc319ce8cc9d62002f930379e1d0`.
SHA con correcciones mínimas: `ecd13a15831be01c9473c202151f49a2d7d07840`.
La revisión no desplegó nada ni ejecutó SQL remoto.

## Controles observados

- GH Actions CI sobre `b597810`: `db-tests`, `unit`, `typecheck`, `lint`, `build`, `audit` y `bundle-budget` con conclusión **success**. No atribuir esos resultados a `ecd13a15831be01c9473c202151f49a2d7d07840`.
- `approval-policy` **failure**, razón en log: falta informe completo de revisar-pr en el cuerpo de la PR.
- `e2e-preview` estado `error`; el workflow de `repository_dispatch` estaba corriendo contra `develop` @ `50c99b0` y terminó **cancelled** tras 54 casos visibles, con fallo inicial de `notifications.spec.ts` luego superado en retry. No hay veredicto E2E completo del HEAD de PR.
- GitHub informó `mergeable=true` al consultar #388; no equivale a `git merge-tree`, que no pudo ejecutarse sin clon local.
- No se corrió `pnpm` local, `git diff --check`, `git ls-remote` ni `node docs/revision-pr/analizar.mjs verificacion` en un checkout de este entorno; falta red disponible hacia GitHub desde el contenedor.

## Inspección estructural independiente (ejecutada en memoria)

Lectura mediante conector GitHub de `docs/tasks/T-369.md` y `docs/implementation-plan.md` del SHA `ecd13a15831be01c9473c202151f49a2d7d07840`; validador independiente JS ejecutado en memoria. Resultado efectivo:

- BASE GREEN: 8/8 condiciones revisadas (6 reglas de dominio, DoD/plan, alcance de ficha). El harness reproducible abajo implementa las 7 condiciones vinculantes (excluye comprobación meramente decorativa de secciones).
- Mutaciones: **6/6 detectadas** (RED), contra restricción de match, retorno a reserva, liberación sin republicación, primera compra, sincronía de DoD y compuerta CC-029.
- Las mutaciones fueron exclusivamente copias de strings en memoria. **No** son pruebas SQL, ni sustituyen pruebas de concurrencia, de RLS ni E2E. La suite futura de T-369 debe aportar sus propios RED→GREEN sobre comportamiento real.

## Script completo de la batería propia

Desde la raíz del repositorio, copiar el bloque completo a `/tmp/t369-contract-check.mjs`, ejecutar `node /tmp/t369-contract-check.mjs`. Debe dar BASE GREEN y seis RED; si un mutante no es detectado, el script retorna código de fallo. No escribe sobre el repositorio.

```bash
cat > /tmp/t369-contract-check.mjs <<'NODE'
import { readFileSync } from "node:fs";

const ficha = readFileSync("docs/tasks/T-369.md", "utf8");
const plan = readFileSync("docs/implementation-plan.md", "utf8");

function validate(doc, schedule) {
  const lines = doc.split("\n");
  const start = lines.findIndex(line => line === "## DoD");
  const initial = lines.slice(start + 1).find(line => line.startsWith("- [ ] "))?.slice(6);
  const row = schedule.split("\n").find(line => line.startsWith("| T-369 |")) || "";
  const expected = row.split("|").at(-2)?.trim();
  return [
    ["vencimiento sin match", doc.includes("vence **sin match** (haya o no ofertas pendientes)")],
    ["no_show vuelve a reserva", doc.includes("consumo vuelve a **reserva de esa misma solicitud**") &&
      doc.includes("cancelación del repartidor **antes del retiro**")],
    ["no_show sin repub libera", doc.includes("cierra la solicitud sin republicar, la reserva se libera al saldo")],
    ["contrato y DoD especifican camino", doc.includes("no exige crédito ni plan nuevo") &&
      doc.includes("regresan el consumo a reserva")],
    ["primera compra no gratuidad", doc.includes("primera **compra** confirmada fuera de la app") &&
      doc.includes("Una acreditación gratuita o ajuste administrativo no consume")],
    ["CC-029 sigue bloqueando implementación", doc.includes("**Estado de la ficha: NO LISTA") &&
      doc.includes("CC-029 mergeado (todavía no existe")],
    ["DoD coincide con plan", initial === expected],
  ].filter(([_, ok]) => !ok).map(([name]) => name);
}

const base = validate(ficha, plan);
if (base.length) {
  console.error("GREEN base FAILED:", base);
  process.exit(1);
}
console.log("BASE GREEN: 7/7 invariantes documentales");
const mutants = [
  ["1 sin match -> sin ofertas", ficha.replace("vence **sin match** (haya o no ofertas pendientes)", "vence sin ofertas"), plan],
  ["2 vuelta a reserva -> saldo", ficha.replace("consumo vuelve a **reserva de esa misma solicitud**", "consumo se reintegra al saldo"), plan],
  ["3 no_show sin repub retiene", ficha.replace("cierra la solicitud sin republicar, la reserva se libera al saldo", "cierra la solicitud sin republicar, la reserva queda retenida"), plan],
  ["4 primera compra -> primera acreditacion", ficha.replace("primera **compra** confirmada fuera de la app", "primera acreditación"), plan],
  ["5 diverge DoD y plan", ficha.replace("- [ ] Con el piloto activo todo sigue gratis e ilimitado sin reservar créditos;", "- [ ] Con el piloto activo se limita el uso de créditos;"), plan],
  ["6 implementacion sin CC", ficha.replace("**Estado de la ficha: NO LISTA", "**Estado de la ficha: LISTA"), plan],
];
let red = 0;
for (const [name, d, p] of mutants) {
  const fail = validate(d, p);
  if (fail.length === 0) {
    console.error("MUTATION BLIND:", name);
    process.exitCode = 1;
  } else {
    red++;
    console.log("RED:", name, "=>", fail.join("; "));
  }
}
console.log("MUTACIONES RED:", red, "/6; mutantes solo en memoria, sin modificar archivos");
NODE
node /tmp/t369-contract-check.mjs
```

## Revalidación del PR después del commit de revisión

```bash
git fetch origin
git diff --check origin/develop...origin/docs/T-369-ficha
pnpm exec vitest run tools/verify-fichas.test.ts
node docs/revision-pr/analizar.mjs verificacion
node /tmp/t369-contract-check.mjs
```

No ejecutar Supabase/Docker local ni tocar credenciales. El e2e-preview es gate externo: verificar corrida completa asociada al nuevo HEAD antes del merge.
