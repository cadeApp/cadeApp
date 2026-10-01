# Evidencia y comandos — PR #160

## Ronda 3

**SHA revisado:** `01476eb56b7ec962d488cd087b6d7abc5f31ca53`

### Sincronización

Comparación remota:
- develop: `f0238c3fd3c8c8dbfcb8b35e63ed45451c0e845c`
- head revisado: `01476eb56b7ec962d488cd087b6d7abc5f31ca53`
- ahead: 11
- behind: **0**
- merge-base: develop actual

### Concurrencia

Inspección de `main-flow.spec.ts`:
- dos confirmaciones dentro de `Promise.all`;
- alerta filtrada por mensaje de `ALREADY_MATCHED`;
- `expect.poll` sobre estado server-side;
- expected: request matched, acceptedCount=1, nonAcceptedCount=1 y accepted_offer_id igual a la ganadora.

Corrección estructural confirmada; falta runtime independiente.

### Publicación cash

El producto renderiza el preset con:

```tsx
Paga con: {formatArs(preset)}
```

y `formatArs(5000)` devuelve `$ 5.000`.

El Page Object construye `/paga con.*5000/i`; no coincide con el texto real.

Después del submit el caso busca “Paquete chico” y “Efectivo” en toda la página. La fixture base ya creó una request `chico/cash`, por lo que esas aserciones no identifican la request recién publicada.

### Ordenamiento

Oráculo actual:

```ts
expect(orderDoc[0]).not.toBe(orderPrice[0]);
```

No prueba que Doc2 sea primero por documentación ni que $1500 sea primero por precio.

### Cambio de rol en Flow 5

Cadena observada:
1. `loginAsMerchant(page)`;
2. la misma page/context conserva cookies merchant;
3. `loginAsCourier(0, page)` navega a `/login`;
4. `evaluateRouteGuard('/login', merchantSession)` redirige a `/merchant/dashboard`;
5. el formulario de login courier no queda disponible.

### Cleanup auxiliar

Migraciones actuales:
- `publish_request` genera `rate_limits` y `audit_log`;
- `submit_offer` y `withdraw_offer` generan `rate_limits`;
- `mark_picked_up` y `mark_delivered` generan `audit_log`.

Esquema:
- `audit_log.actor_id` → profiles con `ON DELETE SET NULL`;
- `rate_limits.subject` es texto, sin FK.

`cleanupStagingData` no elimina esas tablas, así que las filas sobreviven al teardown.

### Evidencia declarada por el autor

- typecheck: verde declarado;
- lint: verde declarado;
- staging-seed: 36/36 verde declarado;
- verify-fichas: un fallo en T-322, ajeno a T-303;
- test:db: rojo local por ausencia de Supabase local;
- Playwright: solo `--list`, sin ejecución staging;
- `pnpm test`: sin salida pegada en body.

La demostración RED de concurrencia usa un estado simulado con dos accepted; no se toma como mutación de la implementación real.

### Checks de esta revisión

No se ejecutaron checks/CI en Ronda 3 porque existen bloqueantes estáticos anteriores a aprobación.
