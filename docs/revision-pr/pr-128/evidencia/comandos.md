# Evidencia reproducible — PR #128

## Ronda 1

SHA revisado: `f5a11f0f8f4e85e83f675c56afbef47b529a81d1`.

GitHub reportó `ahead 1 / behind 0`. La ficha T-315 no existía en develop y quedó aceptada por decisión 1-A.

El checkout completo falló por DNS:

```
Could not resolve host: github.com
```

Harness R1:

```
baseline: GREEN
remove vercel pull: GREEN
health con || true: GREEN
actor no autorizado con exit 0: GREEN
```

Eso originó H02.

---

## Ronda 2

SHA revisado: `c2df5e6aafe12fdd0de6057455b0707a83645c4a`.

### Sincronización

```
develop: ffded647be7445b33092ccc76d26e78430ec87dd
merge-base: b659027f49a96762d020e23f159f898b2895d938
head: c2df5e6aafe12fdd0de6057455b0707a83645c4a
ahead_by: 3
behind_by: 1
mergeable: true
```

El nuevo commit de develop corresponde a CC-013 y no toca los archivos funcionales de T-315.

### Limitación del entorno

Se volvió a intentar un clone limpio y falló con:

```
fatal: unable to access 'https://github.com/cadeApp/cadeApp.git/':
Could not resolve host: github.com
```

Por eso no se atribuyen como propios los checks generales declarados por el autor.

### Batería independiente R2

La revisión reprodujo las aserciones relevantes de `job()`, `step()`, secuencia, actor y health sobre el workflow del SHA y aplicó mutaciones distintas de las usadas por el autor.

Salida:

```
baseline: GREEN
M1 comment out staging pull: GREEN
M2 invert staging health with !: GREEN
M3 actor back to triggering_actor: RED
```

M1:

```
pnpm dlx vercel@61.0.0 pull ...
->
# pnpm dlx vercel@61.0.0 pull ...
```

El control sigue GREEN porque `indexOf` encuentra el texto dentro del comentario.

M2:

```
curl --fail ... "$APP_URL/api/health"
->
! curl --fail ... "$APP_URL/api/health"
```

El control sigue GREEN aunque la negación invierte el estado de salida y rompe la propiedad de “fallar el job”.

M3:

```
workflow_run.actor.login
->
workflow_run.triggering_actor.login
```

El control queda RED; esto verifica H01.

### RED exigido para la próxima ronda

1. comentar una sola línea activa de `vercel pull` debe poner RED el test de secuencia;
2. anteponer `!` a un solo `curl --fail` debe poner RED el test de health;
3. el autor debe agregar una mutación propia distinta que vuelva no ejecutable `pull/build/deploy` o absorba/invierta el fallo del health;
4. baseline restaurado debe quedar GREEN.

El arreglo no debe limitarse a sumar más strings prohibidos: tiene que comprobar positivamente que los comandos son líneas ejecutables y que el health propaga su exit.
