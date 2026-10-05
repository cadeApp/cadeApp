# Evidencia — PR #253 — Ronda 1

## Estado
~~~text
SHA revisado: 0dc814cf1e240f50bc3c9add370ac924866c39cc
develop: 1cd3da01b3af9619e4a19107ba5e8354a18c2159
compare: ahead 2 / behind 1
~~~

## Pruebas estáticas
- axe: loader recorre `node_modules/.pnpm`; package no declara axe; lock trae `axe-core@4.13.0` vía `eslint-plugin-jsx-a11y`.
- auth: merchant y courier usan la misma page; el guard redirige `/login` cuando hay sesión.
- trip: seed base = `published`; CC-008 exige `matched|in_transit|delivered` y oferta aceptada.
- storage: courier = INSERT; admin = ALL. El spec no elimina el objeto creado.
- a11y: tags actuales llegan a `wcag21aa`; regla del proyecto = WCAG 2.2 AA.
- evidencia: RED declarado = fail-closed del entorno; test declarado = verify-fichas 7/7, no `pnpm test`.

## Ejecución independiente
~~~text
git clone --branch feat/T-309-uploads-a11y --single-branch https://github.com/cadeApp/cadeApp.git
fatal: Could not resolve host: github.com
~~~
No se presentan checks locales como ejecutados. CI no se inspecciona para cierre con bloqueantes.
