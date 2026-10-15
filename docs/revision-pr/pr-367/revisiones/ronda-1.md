# PR #367 — Revisión independiente, ronda 1

**Fecha:** 2026-10-15 (Argentina). **HEAD de fichas examinado:** `331f1a23c0947d67996884905210c60861d9d50e`; **base develop:** `14c28ed3c41cb2bde92705fc018c7dd0df73245b`.

**Resultado: SIN BLOQUEANTES de documentación.** Dos ficheros nuevos `docs/tasks/T-367.md` y `docs/tasks/T-368.md`, sin modificar contratos, DB ni UI. El objetivo fue acotar el trabajo futuro y el hotfix menor autorizado por el usuario.

## Comprobaciones de contenido
- T-367: el avatar se sube como `kind='avatar'` y se persiste en `courier_documents`; `courier/profile/page.tsx` no solicita `storage_path`, mientras `courier-profile-view.tsx` muestra siempre `<User/>`. Documento diferencia causa de UI confirmada e hipótesis de estado Storage, no afirma haber realizado inspección SQL real. Restringe a avatar propio; no exponer DNI/selfie ni bucket público. Si hace falta contrato o permisos, CC antes de implementar.
- T-368: incluye los tres textos vistos en pantalla, vincula a `src/features/legal/documents.ts` y a `/legal/pilot` ya existente, y reutiliza `src/lib/whatsapp.ts::buildWhatsAppUrl`, que valida números nacionales argentinos. Explicita `CADEAPP_SUPPORT_WHATSAPP_NUMBER` vacío en `.env.example`, que NO da acceso a datos reales ni inventa un número.
- Delimita alcance: no modifica lógica ni condiciones del piloto; monetización #356 no implementada. Futura PR de código independiente.
- Validación de fichas: no ejecutada localmente por falta de worktree; los checks GitHub del HEAD posterior a este informe determinarán CI real. No inventar pruebas ni resultados.

## Bloqueantes
Ninguno en la ficha. **Operación manual pendiente (fuera de esta PR):** configurar teléfono real en el entorno Vercel al activar el enlace WhatsApp y verificar foto del cadete con cuenta de prueba tras implementar T-367.

## Limitaciones
Inspección de fuentes a través de conector GitHub; sin entorno de test local, Storage, MFA ni E2E. Estos límites no se trasladan como éxitos ficticios. Este informe no prueba que el bug de avatar esté solucionado.
