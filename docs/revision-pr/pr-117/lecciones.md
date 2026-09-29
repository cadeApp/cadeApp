# Lecciones de la PR #117

## R7

Corregir una frontera arquitectónica puede reabrir un problema de rendimiento si el entry point público mezcla API liviana y componentes visuales pesados.

La regla no debe resolverse eligiendo entre arquitectura **o** performance:
- `CourierFeed` debe consumir otra feature por `index.ts`;
- las rutas courier deben quedar ≤180 kB.

La API pública puede mantener ambos invariantes exponiendo primitivas livianas directamente y componentes pesados mediante loaders dinámicos públicos.

También se repite el patrón del bundle-budget advisory: un workflow `success` no implica que el presupuesto se cumpla. Hay que leer las líneas por ruta.
