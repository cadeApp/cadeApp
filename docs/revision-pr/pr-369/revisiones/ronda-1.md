# T-368 / PR #369 — Ronda 1

**Fecha:** 2026-10-15. **HEAD funcional inspeccionado:** cad2a98ae8fd1f7b42067eab8b679abd586209f3. **Base documental de ficha:** 64f824700cb80ba587ea3936fa979dc763e07476.

## Revisión por inspección
- src/app/(merchant)/merchant/plan/page.tsx sigue siendo Server Component y lee CADEAPP_SUPPORT_WHATSAPP_NUMBER solo del servidor; validación Zod + buildWhatsAppUrl existente normaliza al teléfono internacional argentino. Ausente o inválido renderiza botón disabled y aviso, no enlace a wa.me sin destinatario.
- Se actualizó el vocabulario flete a envío, se enlazaron los términos existentes /legal/pilot y se cambió la redacción del piloto/renovación sin prometer paquetes todavía no implementados.
- .env.example contiene solo la variable vacía; no se leen, crean ni suben .env.local, datos personales ni secrets.
- El test prueba el componente real renderizado, con mocks solo de obtención de perfil y estado de suscripción; casos de número válido, ausente, inválido y enlace legal. No es un test de integración real con Vercel.
- No hay cambios de piloto, contratos, Supabase, RLS, vencimientos, pagos ni dependencias.

## Bloqueantes y límites
- No se detectaron bloqueantes de código por inspección. CI del HEAD final pendiente al redactar, por lo que NO se declara apta para merge hasta que pase.
- El requisito de demostrar RED independiente no se ha ejecutado; no atribuirlo al revisor. Registrar evidencia real o limitación antes del cierre.
- El PR documental #367 debe quedar mergeado antes de mergear implementación T-368.
- Verificación humana de la URL de WhatsApp en el entorno con el número real sigue pendiente; la foto del cadete es otra issue.

**Operación:** no se hizo deploy manual, ni se cambió configuración de infraestructura.

