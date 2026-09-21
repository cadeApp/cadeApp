# Levantar cadeApp desde cero

> Lo sigue cualquier persona (o su agente) antes de su primera tarea o al retomar en otra máquina.
> Las versiones exactas las fija T-000/T-002 en `package.json`; si difieren de acá, manda `package.json`.

## 1. Herramientas
- Node.js: la versión de `.nvmrc` / `engines.node` (usar nvm o fnm).
- pnpm vía Corepack: `corepack enable` (la versión la fija `packageManager` en `package.json`).
- Docker Desktop opcional (el flujo estándar utiliza el entorno remoto cadeapp-staging).
- Git y cuenta de GitHub con 2FA. agy instalado y con sesión iniciada.
- **No** instalar ni loguear Supabase CLI global contra proyectos remotos: se usa la de `devDependencies` (`pnpm supabase`).

## 2. Repositorio
```
git clone <repo> cadeapp && cd cadeapp
pnpm install --frozen-lockfile
cp .env.example .env.local        # completar con las variables de cadeapp-staging (solicitarlas al Tech Lead)
```

## 3. Base de datos (Entorno remoto)
cadeApp utiliza el proyecto centralizado `cadeapp-staging` en la nube para desarrollo y staging (sin requerir Docker local para el flujo habitual).
- Los tipos TypeScript de la base residen commiteados en `src/types/database.types.ts`.
- En CI (`ci.yml`, construido en T-003), se validará que no haya drift de tipos contra staging mediante `pnpm db:types`.
- En local se trabaja consumiendo directamente los tipos commiteados en `src/types/database.types.ts`.

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
- Credenciales de staging o producción, service role remota, tokens de Supabase o Vercel. Los tiene CI.
