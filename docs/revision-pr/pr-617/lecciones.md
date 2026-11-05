# Lecciones — PR #617 / T-407

**Fuente:** H01 y H02, ambos por inspección. No se ejecutaron mutaciones del revisor.

## Patrón

- **H01, P06:** enumerar estados reales de una RPC, no inferir el resultado positivo a partir del verbo del nombre. La función `admin_resolve_incident` también puede desestimar. Refuerza `pr-56/AG-37`.
- **H02, P08:** probar los estados límite de la navegación: una página vacía sin cursor no reemplaza al caso con cursor obsoleto. El control debe fallar si desaparece el fallback. Refuerza `pr-82/AG-76`.
- **Proceso:** las mutaciones que registra el autor no sustituyen una batería independiente del revisor; ver `pr-68/AG-75`.

## Acciones

1. Añadir matriz `resolved/dismissed/ausente`, mutar la rama específica.
2. Añadir caso de cursor vacío con todos los filtros preservados; mutar la guarda.
3. Repetir los tests del autor y cotejar CI/E2E tras arreglar bloqueantes.

No se crea un número `AG-xx` nuevo en esta ronda, porque los patrones refuerzan lecciones existentes; la numeración global remota se exige solo para lecciones nuevas.

