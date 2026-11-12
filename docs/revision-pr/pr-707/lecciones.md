# Lecciones — PR #707 (T-433), Ronda 1

**Fuente:** un bloqueante documental y tres mejoras en `hallazgos.jsonl`.

## Patrón dominante

**P08 — La matriz de despliegue es parte del contrato de seguridad.** Un check de longitud de secret en Vercel no alcanza para demostrar que un workflow con `environment: develop` o `staging` recibirá el valor correcto. Aunque la implementación sea segura en código, el rollout puede fallar si se confunden secretos del repositorio con los de environments y solo se actualiza Actions cuando se rota Vercel.

**Regla candidata para futuras PR:** siempre que una tarea modifique validación de variables secretas usadas por workflows:
1. Enumerar cada **consumidor real**, su `environment:` y su origen efectivo de `secrets.NAME` con la precedencia de GitHub.
2. En un checklist operativo, verificar **por separado** el valor válido en despliegue y el del caller, incluso si no hay rotación.
3. Pedir un gate de autorización post-rotación/health sin exponer el secreto.
4. Distinguir `min(n)` de entropía: generar secretos nuevos con fuente criptográfica y no publicar valores.

Los hallazgos H02/H04 recuerdan el patrón P03: antes de citar un CC o afirmar un efecto global («todas las rutas»), comprobar el texto fuente y el mecanismo exacto.

## Numeración AG

**No se propone aún un número AG nuevo**: es una PR documental y P08/P03 ya están catalogados; asignar un AG requeriría enumerar el máximo en todas las ramas remotas y confirmar recurrencia. Se deja esta regla como candidata de seguimiento, no como modificación a `AGENTS.md`.

## Advertencias y alcance

- El problema de precedencia de GitHub está documentado y los jobs sí usan environments; **no se conoce** si hoy existe un secret duplicado ni si algún valor es insuficiente.
- La comparación y las mutaciones del revisor son **sobre el documento en memoria**, no sobre código, despliegues, secretos o E2E.
- D1-A, D2-A y D3-A no se reabren. La mejora H02 corrige el argumento documental, no cambia la decisión del producto.

## Ronda 2

Las cuatro correcciones cumplen las propiedades documentales. La versión de Ronda 1 del harness exigía frases exactas y podría producir falsos RED aunque la redacción corrigiera el problema: no se utilizó para verificar R2. El auditor independiente de esta ronda se probó mediante seis mutaciones aisladas, análogo a AG-60. No se crea una nueva AG por una única PR documental.

La validación de secretos efectivos queda deliberadamente en manos de Lautaro073 durante el rollout de la implementación. El CI oficial se encontró cancelado sin jobs; `approval-policy` verde y 123 tests declarados por el autor no equivalen a CI completo.
