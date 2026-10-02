# Evidencia — PR #215 / T-329

## RED

```text
commit: 00135b2a7de46cbf40a0b698bbf5f31f3d3a4ab2
CI run: 37049987855
unit: failure
verify-workflows:
ERR_ASSERTION — T-306 global-settings must run serially when the exact Preview SHA contains the spec
```

## GREEN

```text
commit: 9e57678f7a5b2b0e9bfc62a39ea3ab932afd54fe
CI run: 37050313665 / attempt 2

build          success
typecheck      success
unit           success
audit          success
db-tests       success
lint           success
bundle-budget  success
```

Build attempt 1 del mismo SHA falló en `next/font` y el rerun pasó sin cambio de código.

## Preview

```text
Vercel: success
e2e-preview run 37050531814: success
```

T-329 no contiene `subscription.global-settings.spec.ts`; por diseño el condicional no la ejecuta en esta PR. La comprobación funcional del branch positivo corresponde a T-306 después del merge de T-329.
