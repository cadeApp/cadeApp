# Ronda 5 — PR #180 / T-307

**SHA:** `d967b7820a43155b076fc0cd501d4a2953054132`  
**Resultado:** **CON BLOQUEANTES DE PRODUCTO**

T-327 quedó operativo y el trusted runner ejecutó realmente los 3 tests de `notifications.spec.ts`.

Run `37100304678`:
- Realtime + permission denied: RED 3/3, no segunda GET;
- offline + formulario: GREEN;
- reconnect/refetch: RED 3/3, no segunda GET.

Los RED validan que H02/H05 ya no son controles falsos. La falla está en producto/T-204, no en el spec.

Se derivó el defecto a #229.

No aprobar ni mergear.
