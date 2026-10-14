# Lecciones de PR #329

- Cambio de contrato migrado: los tests deben leer información privada del destino desde la tabla privada canonical y corroborar que el padre publicado mantiene legacy NULL.
- Los E2E de privacidad deben verificar el actor y el evento real (ID + `updated_at`) en lugar de usar un cambio sensible como mero disparador de Realtime.
- Ningún nuevo `AG-xx` creado: se trata del ajuste de fixtures ya conocido en #327/#328 y no de una nueva regla necesaria.
- **Evidencia de límites:** los mutantes negativos independientes no se corrieron aquí. Registrarlo permite distinguir GREEN CI auténtico de mutación adversarial independiente.
