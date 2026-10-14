# Informe de revisión — PR #224 / T-308 — Ronda 2

**SHA revisado:** `4370ddc741bd8be21e7ab5b93add6b9455034ed9`  
**Merge de develop previo del autor:** `508d619c59190c190ecef0f53b9f242de3bf52bc`  
**develop actual:** `3e5d5381dbf59717763f1927e1cf080504a9ebf1`  
**Fecha:** 2026-10-03

## Resultado

**CON 3 BLOQUEANTES: PR224-H03, PR224-H04 y PR224-H05.**

PR224-H01 y PR224-H02 quedan **arreglado-verificado** con evidencia del gate E2E real.

No hay decisiones 🔵 de P1.

## Sincronización

El autor sí hizo el merge solicitado de develop:

```text
508d619c Merge remote-tracking branch 'origin/develop' into feat/T-308-incidents-e2e
```

y luego el arreglo:

```text
4370ddc fix(incidents): address round 1 review blockers H01-H04 [T-308]
```

Sin embargo, durante la ronda develop avanzó 5 commits más:

```text
origin/develop...HEAD
behind: 5
ahead: 6
```

Esos commits incluyen T-332, T-333, T-325 y T-334. T-334 cambia `src/features/auth/guards.ts` y el flujo de login/onboarding, así que la ejecución final de DoD 1/MFA debe hacerse después del nuevo merge.

---

## PR224-H01 — ARREGLADO-VERIFICADO

El helper propio que hacía signup con `role: 'admin'` fue eliminado.

Los casos administrativos usan ahora:

```ts
const adminCredentials = await seedAdminUser(stagingContext);
const adminClient = await createAuthenticatedClient(adminCredentials);
await elevateAdminToAal2(adminClient, adminCredentials);
```

### Evidencia independiente

Gate `e2e-preview` run `37144346616`:

- **DoD 2** pasó.
- **DoD 3** pasó.
- Ambos ejecutan `seedAdminUser`, autenticación, AAL2 y `admin_suspend_courier`.

Por lo tanto el bootstrap canónico no solo compila: completó en Supabase Develop.

**Estado → arreglado-verificado en `4370ddc`.**

---

## PR224-H02 — ARREGLADO-VERIFICADO

DoD 1 usa ahora:

```ts
const matched = await seedDeliveryRequestInState(stagingContext, {
  status: 'matched',
  merchantId: merchant.id,
  assignedCourierId: courier.id,
  withContacts: true,
});
```

### Evidencia independiente

El mismo gate llegó a:

1. autenticar al merchant;
2. abrir `/trips/<requestId>`;
3. encontrar y pulsar «Reportar un problema»;
4. abrir el Dialog;
5. fallar recién buscando el tipo de incidente dentro del formulario.

Eso demuestra que la precondición `matched` ya es válida para `get_trip_details` y que el viaje se renderiza.

**Estado → arreglado-verificado en `4370ddc`.**

---

## PR224-H03 — ARREGLADO-SIN-VERIFICAR · BLOQUEANTE

El código sí corrige la causa original: ya no usa `LoginPage.login()`.

Ahora hace credenciales → click → espera `/login/mfa` y luego completa TOTP.

No puede marcarse verificado todavía porque el gate falla antes, en el formulario de incidente, y nunca alcanza las líneas 97–110 del flujo admin.

Además develop actual incorporó T-334, que modificó guards/login. Aunque el cambio parece centrado en onboarding de merchant/courier, el procedimiento exige probar el árbol que realmente se va a mergear.

### Para cerrar

- integrar develop actual;
- corregir H05;
- el gate debe alcanzar y completar MFA;
- debe terminar viendo el incidente en `/admin/incidents`.

---

## PR224-H04 — PARCIAL · BLOQUEANTE

Mejoró una parte importante: ya existe una ejecución E2E real contra Preview + Supabase Develop.

Status de commit sobre `4370ddc`:

```text
e2e-preview: failure
run: 37144346616
23 passed / 1 failed
```

Pero la bitácora de R2 todavía escribe para los cuatro casos:

```text
Salida RED esperada
Salida GREEN real: Evaluada en el gate...
```

Eso no es evidencia RED ejecutada. Y el gate que finalmente ocurrió no fue GREEN.

Por tanto:

- discovery ya no es el único dato;
- DoD 2/3/4 sí tuvieron GREEN real;
- DoD 1 no;
- ninguna de las cuatro mutaciones RED documentadas fue ejecutada y registrada con run/salida.

**Estado → parcial.**

### Para cerrar

Después de corregir H05 y sincronizar develop:

1. ejecutar las mutaciones temporales pedidas en R1 una por una;
2. registrar run/SHA y fallo exacto;
3. restaurar el spec final;
4. ejecutar gate final GREEN;
5. actualizar la bitácora desde resultados reales, no desde «esperado».

---

## PR224-H05 — MEDIO · BLOQUEANTE
### DoD 1 usa cuatro textos que ya no existen en el producto

El gate real encontró el primero:

```text
incidents.spec.ts:65
/problema con el pago/i

UI:
"Problema con el cobro"
```

y falló las tres veces (ejecución + 2 retries):

```text
Locator: getByRole('radio', { name: /problema con el pago/i })
Received: <element(s) not found>
```

Al barrer la clase completa aparecen tres fallos siguientes que el gate todavía no alcanzó:

| Spec | Texto buscado | Copy real |
|---|---|---|
| línea 65 | `Problema con el pago` | `Problema con el cobro` |
| línea 69 | `¿Qué sucedió?` | `¿Qué pasó?` |
| línea 77 | `reporte enviado` | `Recibimos tu reporte. La administración lo va a revisar.` |
| línea 117 | `Problema con el pago` | `Problema con el cobro` |

Fuente canónica en `src/features/incidents/copy.ts`:

```text
:9  payment_issue: 'Problema con el cobro'
:33 descriptionLabel: '¿Qué pasó?'
:39 success: 'Recibimos tu reporte. La administración lo va a revisar.'
```

### Corrección esperada

Corregir **las cuatro** expresiones del E2E en la misma ronda:

```ts
/problema con el cobro/i
/¿qué pasó\?/i
/recibimos tu reporte/i
/problema con el cobro/i
```

No cambiar el copy productivo para acomodar el test.

---

## CI normal del SHA

Run `37144198984`:

```text
typecheck       success
lint            success
build           success
db-tests        success
bundle-budget   success
audit           failure
unit            failure
```

El `unit` falló únicamente por:

```text
tools/verify-fichas.test.ts
Desincronizadas: T-333
1737 passed / 1 failed
```

El audit falló por la advisory de `braces`.

Ambos problemas están fuera de T-308 y fueron corregidos posteriormente en develop por T-333/T-332, respectivamente. La rama debe traer esos commits antes de la siguiente evaluación.

## Conclusión

**NO MERGEAR PR #224 todavía.**

Siguiente ronda: merge de develop actual, H05 completo, H03 alcanzado por runtime, RED de mutación reales y gate final GREEN.
