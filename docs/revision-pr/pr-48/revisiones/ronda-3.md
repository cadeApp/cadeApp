# Ronda 3 — cierre · PR #48 / T-001

**Head SHA revisado:** `9a963690daaf1c2c872cc81e6f1d6a68540a8457`
**Anterior:** `d359aec0c2709a9000254f9a62d97a663aed0b40`
**Fecha:** 2026-09-21

---

## Veredicto

**Los 7 registros están cerrados y verificados. Nada pendiente.**

```
pnpm typecheck  → exit 0
pnpm lint       → ✔ No ESLint warnings or errors
pnpm test       → 54/54 en 7 archivos
```

La PR figura `MERGEABLE` / `mergeStateStatus: CLEAN`, y la rama está al día con `develop`.

---

## H06 · Falso positivo cerrado sin abrir otro

```js
- const SECRET_FILE = /(^|[^a-zA-Z0-9_])\.env(?!\.example(...))/i;
+ const SECRET_FILE = /(^|[^a-zA-Z0-9_])\.env(?![a-zA-Z0-9_-])(?!\.example(...))/i;
```

El límite de palabra tras `.env` es el arreglo que había propuesto. Batería completa de 17 casos contra `9a96369`:

| Debe bloquearse | | No debe bloquearse | |
|---|---|---|---|
| `cat .env.local` | deny ✅ | `cat .env.example` | ask ✅ |
| `cat .env` | deny ✅ | `cat docs/.environment-setup.md` | ask ✅ |
| `cat .env*` | deny ✅ | `cat .envoy-config.yaml` | ask ✅ |
| `cat .env.*` | deny ✅ | `grep -rn process.env src/` | ask ✅ |
| `cp .env* /tmp/x` | deny ✅ | `pnpm test` | ask ✅ |
| `cat .env.production` | deny ✅ | `git push origin feat/T-001-kit` | ask ✅ |
| `git push` | deny ✅ | `git push -u origin feat/x` | ask ✅ |
| `git push origin HEAD` | deny ✅ | | |
| `git push origin develop` | deny ✅ | | |
| `git push origin main` | deny ✅ | | |

Lo relevante: **cerrar H06 no reabrió H01**. Los seis casos de secretos siguen en `deny` y los cinco legítimos en `ask`.

### Demostrado en rojo

Quité el `(?![a-zA-Z0-9_-])` y corrí la suite:

```
Tests  1 failed | 27 passed (28)
```

El test que falla es exactamente el de H06. Restaurado, vuelve a verde.

---

## A02 · Resuelto ampliando la ficha

La fila T-001 del plan pasó de listar `tools/verify-t001.test.ts` a listar `tools/**`. Es la opción (a), la que recomendé: evita repetir la discusión en cada PR que necesite agregar una prueba.

Verificación: filtrando `git diff --name-only origin/develop...HEAD` por la lista actualizada, **no queda ningún archivo fuera**.

---

## Balance de las tres rondas

| Ronda | SHA | Qué pasó |
|---|---|---|
| 1 | `fb7398a` | 5 hallazgos + 1 decisión de alcance |
| 2 | `d359aec` | Los 6 cerrados; aparecen 2 residuos al arreglar (H06, A02) |
| 3 | `9a96369` | Los 2 residuos cerrados; nada nuevo |

Los tests pasaron de **38 → 53 → 54**. El crecimiento son casi todos **casos negativos**: comandos legítimos que no deben bloquearse. Es `AG-07` aplicado sin que hubiera que insistir, y es lo que permitió cerrar H06 con confianza de que no se reabría H01.

Vale notar el contraste con la #47: allí un arreglo desactivó el control de otro hallazgo con los 23 tests en verde (`PR47-R01`). Acá los dos residuos de la ronda 2 se detectaron **en la revisión**, no después, porque los casos negativos ya estaban escritos.

---

## Metodología

Verificado contra `9a96369` con el árbol limpio. El guard se ejerció con su formato real (`toolCall.args.CommandLine`), 17 casos entre positivos y negativos. El límite de palabra se revirtió temporalmente para comprobar que el test falla, y se restauró. Comandos en [`../evidencia/comandos.md`](../evidencia/comandos.md).
