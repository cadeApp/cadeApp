# T-368 / PR #369 — Ronda 2: error de tipado de matchers

**HEAD con fallo:** `420204c48a8a20058c3ab412d4814c736658c38d`. En [CI 38683996699](https://github.com/cadeApp/cadeApp/actions/runs/38683996699) `typecheck` falló con cinco `TS2339` por usar matchers `jest-dom` (`toHaveAttribute`, `toBeDisabled`, `toHaveTextContent`) sin tipos en el Vitest de este repo.

**Corrección:** sin alterar la funcionalidad ni reducir cobertura, las mismas cinco expectativas verifican valores nativos del DOM: `getAttribute('href')`, `getAttribute('rel')`, `HTMLButtonElement.disabled` y `textContent`. Se mantiene el mismo link exacto, el botón deshabilitado y el mensaje visible.

**Estado:** arreglado-sin-verificar hasta que un nuevo CI del HEAD corregido termine; no marcar GREEN por inspección ni silenciar la falla. No se tocó configuración de tests ni CI.
