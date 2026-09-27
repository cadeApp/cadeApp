import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

const rootDir = process.cwd();
const featureDir = path.join(rootDir, 'src', 'features', 'incidents');
const inboxDir = path.join(rootDir, 'src', 'app', '(admin)', 'admin', 'incidents');
const tripPage = path.join(rootDir, 'src', 'app', 'trips', '[id]', 'page.tsx');

function collectSourceFiles(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  const files: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectSourceFiles(fullPath));
    } else if (/\.tsx?$/.test(entry.name) && !entry.name.includes('.test.')) {
      files.push(fullPath);
    }
  }
  return files;
}

function readAll(files: readonly string[]): string {
  return files.map((file) => fs.readFileSync(file, 'utf-8')).join('\n');
}

describe('T-124 DoD: bandeja A05 publicada en /admin/incidents (D01)', () => {
  it.each(['page.tsx', 'loading.tsx', 'error.tsx'])('existe /admin/incidents/%s', (file) => {
    expect(fs.existsSync(path.join(inboxDir, file))).toBe(true);
  });

  it('existe el detalle /admin/incidents/[id] con page, loading y error', () => {
    for (const file of ['page.tsx', 'loading.tsx', 'error.tsx']) {
      expect(fs.existsSync(path.join(inboxDir, '[id]', file)), file).toBe(true);
    }
  });

  it('no se publica la ruta suelta /incidents ni un layout propio', () => {
    expect(fs.existsSync(path.join(rootDir, 'src', 'app', '(admin)', 'incidents', 'page.tsx'))).toBe(false);
    expect(fs.existsSync(path.join(inboxDir, 'layout.tsx'))).toBe(false);
  });

  it.each([
    ['page.tsx', 'getIncidentsQueue'],
    [path.join('[id]', 'page.tsx'), 'getIncidentDetail'],
  ])('%s es Server Component y lee con %s desde @/features/incidents/server', (file, query) => {
    const page = fs.readFileSync(path.join(inboxDir, file), 'utf-8');
    expect(page).not.toMatch(/['"]use client['"]/);
    expect(page).toMatch(
      new RegExp(`import\\s*\\{[^}]*\\b${query}\\b[^}]*\\}\\s*from\\s*'@/features/incidents/server'`)
    );
    expect(page).toMatch(new RegExp(`${query}\\s*\\(`));
    expect(page).not.toMatch(/@\/server\//);
  });
});

describe('T-124 DoD: el botón de reporte vive en el viaje (D02)', () => {
  it('la vista de viaje renderiza ReportIncidentButton de @/features/incidents para comercio y repartidor', () => {
    const page = fs.readFileSync(tripPage, 'utf-8');
    expect(page).toMatch(
      /import\s*\{[^}]*\bReportIncidentButton\b[^}]*\}\s*from\s*'@\/features\/incidents'/
    );
    expect((page.match(/<ReportIncidentButton\b/g) ?? []).length).toBeGreaterThanOrEqual(2);
    expect(page).toMatch(/requestId=\{trip\.id\}/);
  });
});

describe('T-124 DoD: mutaciones solo por RPC auditadas (D03)', () => {
  const sources = () => readAll([...collectSourceFiles(featureDir), ...collectSourceFiles(inboxDir)]);

  it('la feature nunca escribe incidents, audit_log, couriers ni offers directo', () => {
    expect(sources()).not.toMatch(
      /from\(\s*['"](?:incidents|audit_log|couriers|offers)['"]\s*\)\s*\.(?:insert|update|upsert|delete)\(/
    );
  });

  it('actions.ts reporta con report_incident y suspende con admin_suspend_courier', () => {
    const actions = fs.readFileSync(path.join(featureDir, 'actions.ts'), 'utf-8');
    expect(actions).toMatch(/callRequestRpc\([^)]*'report_incident'/);
    expect(actions).toMatch(/adminSuspendCourierRpc\(/);
  });

  it('actions.ts resuelve con admin_resolve_incident (pendiente del contract-change D03)', () => {
    const actions = fs.readFileSync(path.join(featureDir, 'actions.ts'), 'utf-8');
    expect(actions).toMatch(/adminResolveIncidentRpc\(/);
  });

  it('la feature no usa service role', () => {
    expect(sources()).not.toMatch(/createAdminClient|@\/server\/supabase\/admin/);
  });
});

describe('T-124 DoD: protege datos de contacto del destinatario', () => {
  it('ningún archivo de la feature ni de la bandeja referencia delivery_request_contacts ni datos del destinatario', () => {
    const content = readAll([...collectSourceFiles(featureDir), ...collectSourceFiles(inboxDir)]);
    expect(content).not.toMatch(/delivery_request_contacts|recipient_?(?:name|phone)|recipientName|recipientPhone/i);
  });
});

describe('T-124 DoD: convenciones de UI', () => {
  const uiFiles = () => [...collectSourceFiles(featureDir), ...collectSourceFiles(inboxDir)];

  it('sin text-xs, colores hex ni medidas arbitrarias', () => {
    const violations: string[] = [];
    for (const file of uiFiles()) {
      fs.readFileSync(file, 'utf-8')
        .split('\n')
        .forEach((line, index) => {
          if (/text-xs|#[0-9a-fA-F]{3,6}\b|\w-\[[^\]]+\]/.test(line)) {
            violations.push(`${path.relative(rootDir, file)}:${index + 1}: ${line.trim()}`);
          }
        });
    }
    expect(violations).toEqual([]);
  });

  it('los textos viven en copy.ts y la feature lo exporta', () => {
    expect(fs.existsSync(path.join(featureDir, 'copy.ts'))).toBe(true);
    expect(fs.readFileSync(path.join(featureDir, 'index.ts'), 'utf-8')).toContain("from './copy'");
  });
});
