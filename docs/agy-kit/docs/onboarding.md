# Levantar cadeApp desde cero

> Lo sigue cualquier persona (o su agente) antes de su primera tarea o al retomar en otra máquina.
> Las versiones exactas las fija T-000/T-002 en `package.json`; si difieren de acá, manda `package.json`.

## 1. Herramientas
- Node.js: la versión de `.nvmrc` / `engines.node` (usar nvm o fnm).
- pnpm vía Corepack: `corepack enable` (la versión la fija `packageManager` en `package.json`).
- Git y cuenta de GitHub con 2FA. agy instalado y con sesión iniciada.

## 2. Repositorio
```
git clone <repo> cadeapp && cd cadeapp
pnpm install --frozen-lockfile
cp .env.example .env.local        # completar con las credenciales públicas de cadeApp-staging provistas por Lautaro073
```

## 3. Base y tipos (cadeApp-staging)
```
pnpm db:types                     # genera los tipos de TypeScript desde cadeApp-staging sin requerir Docker
```

## 4. Verificar
```
pnpm typecheck && pnpm lint && pnpm test
pnpm dev                          # http://localhost:3000
```

## 5. agy
- Abrí agy en la raíz del repo: carga `AGENTS.md`, `.agents/rules` y `.agents/skills` solo.
- Probá el guard una vez: pedile que lea `.env.local` → debe bloquearse.
- Nueva tarea: "Tomá T-xxx con la skill tomar-tarea". Tarea empezada: "Retomá T-xxx con la skill retomar-tarea".

## Qué NO hay en tu máquina
- Service role remota de producción, tokens de Supabase de deploy o Vercel. Los tiene CI. En `.env.local` solo van las variables públicas y la anon key de `cadeApp-staging`.
