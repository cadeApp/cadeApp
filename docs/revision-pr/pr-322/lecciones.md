# Lecciones — PR #322

Dos mejoras documentales, sin bloqueantes ni patrón transversal nuevo que amerite otra regla AG.

1. Una optimización debe separar el cambio de navegación comprobable, el ahorro de consultas real y la latencia de punta a punta. No declarar menos cadenas de auth por inferencia solamente.
2. Las fichas de diagnóstico deben enlazar el módulo ejecutor de red (src/features/auth/server.ts), además de helpers puros (guards.ts).
3. El test verify-fichas asegura estructura y sincronía plan/DoD, pero no prueba rendimiento ni causación.

No modificar AGENTS.md a partir de un solo caso.
