import { appendFileSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export function evaluateBundleBudget(buildOutput, maxKb) {
  const routes = [];
  for (const line of buildOutput.split(/\r?\n/)) {
    const match = line.match(
      /^[┌├└│]\s*[○ƒλ●]?\s*(\/\S*)\s+[\d.]+\s+(?:B|kB|MB)\s+([\d.]+)\s+(kB|MB)\s*$/
    );
    if (!match) continue;
    const [, route, sizeText, unit] = match;
    routes.push({ route, sizeKb: Number(sizeText) * (unit === 'MB' ? 1024 : 1) });
  }

  const lines = [
    `## First Load JS por ruta (límite ${maxKb} kB)`,
    '',
    '| Ruta | Tamaño | Estado |',
    '| --- | ---: | --- |',
  ];
  for (const { route, sizeKb } of routes) {
    lines.push(
      `| ${route} | ${Number(sizeKb.toFixed(1))} kB | ${sizeKb > maxKb ? 'Supera el límite' : 'OK'} |`
    );
  }
  if (routes.length === 0) lines.push('| — | — | No se pudo leer el resultado de Next.js |');
  return {
    ok: routes.length > 0 && routes.every(({ sizeKb }) => sizeKb <= maxKb),
    report: `${lines.join('\n')}\n`,
  };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  const outputPath = process.argv[2];
  if (!outputPath) throw new Error('Indicá el archivo con la salida de next build.');
  const result = evaluateBundleBudget(readFileSync(outputPath, 'utf8'), 180);
  console.log(result.report);
  if (process.env.GITHUB_STEP_SUMMARY) {
    appendFileSync(process.env.GITHUB_STEP_SUMMARY, result.report);
  }
  if (!result.ok) process.exitCode = 1;
}
