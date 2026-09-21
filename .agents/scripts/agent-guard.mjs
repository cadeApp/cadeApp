#!/usr/bin/env node
// Hook PreToolUse de agy para cadeApp.
// Bloquea comandos contra ambientes remotos, pushes peligrosos y lectura de secretos.
// Es una barrera extra: la barrera dura es que ninguna máquina de desarrollo tenga credenciales de producción.
// Lo que no se bloquea devuelve "ask", que respeta los permisos normales de agy (nunca "allow").
import { readFileSync } from 'node:fs';

const respond = (decision, reason) => {
  process.stdout.write(JSON.stringify(reason ? { decision, reason } : { decision }));
  process.exit(0);
};

let payload;
try {
  payload = JSON.parse(readFileSync(0, 'utf8') || '{}');
} catch {
  respond('force_ask', 'agent-guard: no pude leer la llamada; confirmá manualmente.');
}

const toolName = String(payload?.toolCall?.name ?? '');
const args = payload?.toolCall?.args ?? {};
const text = JSON.stringify(args);
const command = typeof args.CommandLine === 'string' ? args.CommandLine : '';

// .env, .env.local, .env.production... pero no .env.example
const SECRET_FILE = /(^|[^a-zA-Z0-9_])\.env(?![a-zA-Z0-9_-])(?!\.example($|[\s"'\\/,;:)&|<>\]}`]))/i;
const SECRET_NAME = /SERVICE_ROLE|VAPID_PRIVATE|DNI_HMAC_SECRET|CRON_SECRET|SUPABASE_ACCESS_TOKEN|SUPABASE_DB_PASSWORD/i;

if (SECRET_FILE.test(text)) respond('deny', 'Regla 00: no se leen ni tocan archivos .env (solo .env.example).');

if (toolName === 'run_command' || command) {
  const rules = [
    [/\bsupabase\b[^\n|&;]*\b(db\s+push|link|secrets|projects|functions\s+deploy|migration\s+repair|db\s+dump|db\s+pull)\b/i,
      'Regla 00: comandos de Supabase contra ambientes remotos solo corren en CI.'],
    [/\bsupabase\b[^\n|&;]*--(linked|db-url|project-ref)\b/i, 'Regla 00: nada de Supabase remoto desde local.'],
    [/\bgit\s+push\b[^\n|&;]*(\s--force\b|\s-f\b|--force-with-lease)/i, 'Regla 50: sin force push.'],
    [/\bgit\s+push\b[^\n|&;]*\b(origin\s+)?(HEAD:)?(develop|staging|main)\b(?![\w/-])/i, 'Regla 50: no se pushea a develop, staging ni main.'],
    [/\bgit\s+push\b(?![^\n|&;]*\s+[a-zA-Z0-9][\w.-]*\s+(?!develop\b|staging\b|main\b|HEAD\b)[a-zA-Z0-9][\w./-]*)/i, 'Regla 50: push sin rama explícita; nombrá remoto y rama (nunca develop, staging ni main).'],
    [/\bgit\s+(branch\s+-D|push\s+\S+\s+--delete)\s+(develop|staging|main)\b/i, 'Regla 50: no se borran ramas protegidas.'],
    [/\bvercel\b[^\n|&;]*\b(deploy|--prod|env|secrets|promote|rollback)\b/i, 'Regla 00: deploys y variables de hosting solo por CI.'],
    [/\bgh\s+(secret|variable)\b|\bgh\s+api\b[^\n]*\/(secrets|environments)\b/i, 'Regla 00: secretos de GitHub fuera del alcance del agente.'],
    [/\b(npm|pnpm|yarn)\s+publish\b/i, 'No se publican paquetes.'],
    [/\b(curl|wget|iwr|Invoke-WebRequest)\b[^\n]*\|\s*(sh|bash|pwsh|powershell|iex|Invoke-Expression)\b/i, 'No se ejecutan scripts descargados.'],
    [/\bprintenv\b|^\s*(env|set)\s*$|\b(Get-ChildItem|gci|dir|ls)\s+env:/im, 'Regla 00: no se listan variables de entorno.'],
    [SECRET_NAME, 'Regla 00: el comando menciona un secreto.'],
    [/\brm\s+-[a-z]*r[a-z]*f?[a-z]*\s+(\/|~|\*|\.\s*$)|Remove-Item\b[^\n]*-Recurse[^\n]*\s(\/|\\|~|\*|C:\\)\s*/i, 'Borrado recursivo peligroso.'],
    [/--no-verify\b/i, 'Regla 50: no se saltean hooks de git.']
  ];
  for (const [pattern, reason] of rules) if (pattern.test(command)) respond('deny', reason);
}

respond('ask');
