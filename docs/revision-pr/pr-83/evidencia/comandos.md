# Evidencia reproducible — PR #83 / ronda 1

**SHA revisado:** `4b4f18b0676cd5c5afb8ab5bb7f4328e28050621`

## Preflight

```text
head: 4b4f18b0676cd5c5afb8ab5bb7f4328e28050621
branch: feat/T-115-vista-de-viaje
base: develop@720e2d4f39ab5b4d5d09a55016072eb8fe940855
compare: ahead 2 / behind 0
files: 3
comments: 0
threads: 0
```

Intento de checkout:

```bash
git clone https://github.com/cadeApp/cadeApp.git /tmp/cadeApp-pr83
# fatal: unable to access ... Could not resolve host: github.com
```

No se usaron `.env*`, secretos ni servicios remotos.

## H01 · RPC equivocada invisible

Mutación: las seis actions llaman a `mark_picked_up`. El mock sigue devolviendo el resultado configurado.

```text
picked_up: WRONG RPC NAME, CURRENT ASSERTIONS GREEN
delivered: WRONG RPC NAME, CURRENT ASSERTIONS GREEN
courier_cancel: WRONG RPC NAME, CURRENT ASSERTIONS GREEN
no_show: WRONG RPC NAME, CURRENT ASSERTIONS GREEN
merchant_cancel: WRONG RPC NAME, CURRENT ASSERTIONS GREEN
republish: WRONG RPC NAME, CURRENT ASSERTIONS GREEN
```

## H02 · Guards faltantes

```text
pickedUp       unauth ✅ wrong-role ✅
delivered      unauth ❌ wrong-role ✅
courierCancel  unauth ❌ wrong-role ❌
noShow         unauth ❌ wrong-role ✅
merchantCancel unauth ❌ wrong-role ❌
republish      unauth ❌ wrong-role ❌
```

Mutación sin guard en las tres actions sin caso de rol incorrecto:

```text
courierCancel: current happy path GREEN; proposed wrong-role RED
merchantCancel: current happy path GREEN; proposed wrong-role RED
republish: current happy path GREEN; proposed wrong-role RED
```

## H03 · no-show

Mutación: forzar `republish=true`.

```text
current republish=true: GREEN
proposed republish=false => cancelled: RED
```

El caso “por defecto” actual pasa `true`; no prueba el default.

## H04 · privacidad

Mutación en ambos mensajes: agregar `Dirección exacta: San Martín 450`.

```text
coordination mutant: CURRENT ASSERTIONS GREEN
customer mutant: CURRENT ASSERTIONS GREEN
```

La blacklist no ve ese dato extra.

## H05 · rojo declarado

La evidencia del PR es fallo de resolución de imports. Eso prueba que faltan módulos, no que una aserción detecta su propiedad rota.

## JSONL

Validación local previa:

```bash
node docs/revision-pr/analizar.mjs verificacion
# 7 hallazgos
# 1 decisión aceptada
# 0 decisiones pendientes
# 6 otros abiertos
```
