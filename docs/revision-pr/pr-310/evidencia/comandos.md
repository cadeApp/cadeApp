# Evidencia y comandos — PR #310 · Ronda 1

## GitHub: datos inspeccionados

```bash
gh api repos/cadeApp/cadeApp/pulls/310
gh api repos/cadeApp/cadeApp/compare/develop...cf0eed969db81d4eadb260e3fe0ddb9e63f7b6af
gh api repos/cadeApp/cadeApp/commits/cf0eed969db81d4eadb260e3fe0ddb9e63f7b6af/check-runs
gh api repos/cadeApp/cadeApp/commits/cf0eed969db81d4eadb260e3fe0ddb9e63f7b6af/status
gh api repos/cadeApp/cadeApp/actions/jobs/113477270004/logs
gh api repos/cadeApp/cadeApp/actions/jobs/113477270171/logs
gh api repos/cadeApp/cadeApp/actions/jobs/113477881481/logs
```

Salidas realmente observadas:
```text
unit: Test Files 123 passed (123); Tests 1948 passed (1948)
db-tests: Files=19, Tests=1854; Result: PASS
e2e-preview: 43 passed; 3 passed
Vercel: success
approval-policy: failure hasta publicar el informe independiente
develop...PR310: diverged, ahead 4, behind 1; sin archivos solapados con último commit develop
```

## E2E de la PR efímera #309 — jobs examinados

```bash
gh api repos/cadeApp/cadeApp/actions/jobs/113221577705/logs # RED contraste
gh api repos/cadeApp/cadeApp/actions/jobs/113422451922/logs # GREEN contraste
gh api repos/cadeApp/cadeApp/actions/jobs/113432563439/logs # RED htmlFor
gh api repos/cadeApp/cadeApp/actions/jobs/113444259041/logs # GREEN revert htmlFor
gh api repos/cadeApp/cadeApp/actions/jobs/113455619811/logs # RED documento ausente
gh api repos/cadeApp/cadeApp/actions/jobs/113466915959/logs # GREEN revert documento ausente
```

El RED de contraste llegó realmente a `Violaciones WCAG en idle`; los dos RED de mutación llegaron a `getByLabel(/DNI frente/i).toBeAttached()`, no a error de infraestructura. Ambos E2E objetivo volvieron a GREEN tras revertir los mutantes. La PR #309 se cerró sin mergear.

## Instrumentación independiente de contraste (código íntegro)

Este arnés de Node lee los HSL de los tokens reales, usa fórmula sRGB/WCAG sin imports del test, y hace una **mutación en memoria** (`dark` a `primary`). Guardar este contenido como `/tmp/pr310-contrast.mjs` o pegarlo en un `node --input-type=module`, ejecutándolo desde el raíz del repo:

```js
import fs from 'node:fs';
import assert from 'node:assert/strict';
const css = fs.readFileSync('src/ui/tokens.css', 'utf8');
function token(key) {
  const m = css.match(new RegExp('\\-\\-' + key + ':\\s*([\\d.]+)\\s+([\\d.]+)%\\s+([\\d.]+)%'));
  assert(m, 'token missing: '+key);
  const [h,s,l] = [Number(m[1]),Number(m[2])/100,Number(m[3])/100];
  const a=s*Math.min(l,1-l);
  const channel=n => {
    const k=(n+h/30)%12;
    return Math.round(255*(l-a*Math.max(-1,Math.min(k-3,9-k,1))));
  };
  return [channel(0),channel(8),channel(4)];
}
const over=(fg,base,alpha)=>fg.map((x,i)=>Math.round(x*alpha+base[i]*(1-alpha)));
const lumi=color=>color.map(x=>x/255).map(v=>v<=0.04045?v/12.92:((v+0.055)/1.055)**2.4)
  .reduce((sum,v,i)=>sum+v*[0.2126,0.7152,0.0722][i],0);
const ratio=(a,b)=>{const x=lumi(a),y=lumi(b);return(Math.max(x,y)+0.05)/(Math.min(x,y)+0.05);};
const dark=token('primary-dark'), primary=token('primary');
const white=token('card'), page=token('background');
for(const bg of [white,page,over(primary,white,0.05),over(primary,page,0.05)]) {
  const green=ratio(dark,bg), red=ratio(primary,bg);
  assert(green>=4.5,'GREEN contrast must meet AA');
  assert(red<4.5,'RED contrast mutation must violate AA');
  process.stdout.write(JSON.stringify({bg,green,red})+'\n');
}
```

Se verificó asimismo en un cálculo Python independiente (sin repositorio ejecutable): primary-dark RGB (11,122,125), primary RGB (9,186,189). Ratios GREEN: blanco 5.129; página 5.006; hover 4.919. RED primary: 2.395; 2.337; 2.297. **Este arnés no sustituye Vitest ni Playwright: el resultado de esos comandos solo se atribuye a CI GitHub**.

## Comandos requeridos de cierre (en CI)

```bash
pnpm typecheck && pnpm lint && pnpm test
```

Sin tests falsos ni expectativas adulteradas. No se hizo push a develop, ni se ejecutó Supabase remoto o workflows manualmente.
