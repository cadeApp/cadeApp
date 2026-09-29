# Git y coordinación entre personas y agentes

## Dónde vive cada cosa
| Qué | Dónde |
|---|---|
| Qué hay que hacer | `docs/tasks/T-xxx.md` en develop (solo cambia por PR) |
| Quién la tiene y en qué estado | Issue de GitHub + Project "cadeApp" (Bloqueada → Lista → En curso → En review → Hecha) |
| Trabajo en curso | rama `feat/T-xxx-slug` + PR en Draft desde el primer push |
| Qué pasó en cada sesión | `docs/tasks/log/T-xxx.md` en la rama (lo escribe el agente al cerrar sesión) |
| Cambios de contrato | `docs/contracts/CC-nnn.md` + issue con label `contract-change` |

## Reglas de trabajo simultáneo
- Nunca dos personas en la misma tarea a la vez: el issue asignado indica quién la tiene.
- Empezar cada sesión con `git fetch` y rebase sobre `origin/develop`.
- Terminar cada sesión con la skill `cerrar-sesion`: nada queda solo en local.
- `package.json` / `pnpm-lock.yaml`: una dependencia nueva solo si la ficha la lista. Conflicto en el lockfile:
  tomar el de develop (`git checkout origin/develop -- pnpm-lock.yaml`) y correr `pnpm install`.
- `src/types/database.types.ts`: solo lo regenera un PR de migración (`pnpm db:types`).
- Archivos de otra zona: solo si la ficha nombra la subruta concreta; el PR lo revisa el dueño de esa zona.

## Ramas y ambientes
- `feat/T-xxx-*` → PR a `develop` (squash merge). Release semanal: PR `develop → staging` abierto por el
  capitán de release (rota P1 → P2 → P3) solo si develop está verde; el PR de release no resuelve conflictos.
- `staging → main`: suite E2E completa verde en staging + aprobación de Lautaro073.
- Hotfix: `fix/T-xxx-*` desde `main`, aprobado por Lautaro073, back-merge a `staging` y `develop` el mismo día.
  Si incluye migración, es forward-only y la misma migración entra a develop antes de seguir.
- Migraciones: `pnpm supabase migration new <nombre>`; nunca editar una mergeada; dos PRs de migración: el
  segundo rebasea y vuelve a correr `pnpm test:db` antes del merge.

## Revisión
- develop/staging/main protegidas: PR, checks verdes (incluido `approval-policy`) y rama al día.
  Sin «require approvals»: bloquearía los PR de Lautaro073, que nadie más puede aprobar.
- Antes de pedir revisión: skill `revisar-pr` sobre el propio PR, corregir bloqueantes y pegar el informe.
- PR de persona2 o persona3 → aprueba Lautaro073. **PR de Lautaro073 → los aprueba y mergea él mismo**, con CI
  verde, el informe de `revisar-pr` sin bloqueantes en el cuerpo y el checklist de seguridad marcado. No se pide
  aprobación de persona2 ni persona3: no programan, así que no pueden revisar código. Lo que reemplaza a la
  aprobación de un par es la revisión independiente, que corre hasta que no queda ningún hallazgo abierto.
- Si otra zona toca tus archivos, dejá un comentario de visto bueno (coordinación; no reemplaza la aprobación).
- No hay procedimiento de emergencia: si Lautaro073 no está, no se mergean cambios de `supabase/`, RLS ni RPC;
  se sigue con el fake de RPC.

## Frená y preguntá a Lautaro073 (en el issue, label `necesita-lautaro`) si
- una prueba falla y no se entiende por qué (nunca cambiar la prueba para que pase);
- hay que tocar archivos fuera de la ficha, contratos, auth, RLS, `package.json`, `.github` o `.agents`;
- el guard bloquea algo o el agente propone saltear una regla.

## Sin cuota de agy a mitad de sesión
- A mano: `git add -A`, `git commit -m "wip(T-xxx): corte por cuota"`, `git push` y una línea en la bitácora.
