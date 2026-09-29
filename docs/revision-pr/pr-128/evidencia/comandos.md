# Evidencia reproducible — PR #128 / Ronda 1

SHA revisado: `f5a11f0f8f4e85e83f675c56afbef47b529a81d1`.

## Sincronización

GitHub reportó:

```
base: develop@b659027f49a96762d020e23f159f898b2895d938
head: f5a11f0f8f4e85e83f675c56afbef47b529a81d1
ahead_by: 1
behind_by: 0
```

La ficha `docs/tasks/T-315.md` consultada en `develop` devolvió 404; en la rama existe y fue agregada por este PR.

## Limitación del entorno

Se intentó un checkout independiente:

```bash
git clone https://github.com/cadeApp/cadeApp.git /tmp/cadeapp-pr128
```

Resultado:

```
fatal: unable to access 'https://github.com/cadeApp/cadeApp.git/':
Could not resolve host: github.com
```

Por eso no se atribuyen como propios `pnpm typecheck/lint/test` ni los checks declarados por el autor. El CI general tampoco se inspecciona en esta ronda porque hay bloqueantes.

## Harness independiente para PR128-H02

El harness reproduce exactamente las aserciones nuevas relevantes de `verify-workflows.test.mjs` contra el contenido de `deploy.yml` del SHA revisado y luego aplica tres mutaciones.

```python
import re

def job(yaml, name):
    normalized = yaml.replace("\r\n", "\n")
    start = normalized.index(f"\n  {name}:\n")
    tail = normalized[start + 1:]
    header_len = len(f"  {name}:\n")
    match = re.search(r"\n {2}[\w-]+:\n", tail[header_len:])
    return normalized[start:] if not match else normalized[start:start + 1 + header_len + match.start()]

def current_new_tests(yaml):
    assert re.search(r"workflow_run:\n\s+workflows: \[migrate\]\n\s+types: \[completed\]", yaml)
    assert re.search(r"branches: \[staging, main\]", yaml)

    for name in ("staging", "production"):
        body = job(yaml, name)
        assert "github.event.workflow_run.conclusion == 'success'" in body
        assert "github.event.workflow_run.event == 'push'" in body
        assert "ref: ${{ github.event.workflow_run.head_sha }}" in body

    assert "concurrency:" in yaml
    assert re.search(r"cancel-in-progress:\s*false", yaml)

    staging = job(yaml, "staging")
    production = job(yaml, "production")
    assert "head_branch == 'staging'" in staging
    assert re.search(r"^\s+environment: staging$", staging, re.M)
    assert "head_branch == 'main'" in production
    assert re.search(r"^\s+environment: production$", production, re.M)

    for match in re.finditer(r"pnpm dlx (vercel\S*)", yaml):
        assert match.group(1) == "vercel@61.0.0"

    for body in (staging, production):
        assert re.search(r"vercel@61\.0\.0 build --prod", body)
        assert re.search(r"vercel@61\.0\.0 deploy --prebuilt --prod", body)

    assert not re.search(r"if:.*github\.actor", production)
    assert re.search(
        r"TRIGGERING_ACTOR: \$\{\{ github\.event\.workflow_run\.triggering_actor\.login \}\}",
        production,
    )
    assert "\"$TRIGGERING_ACTOR\" != 'Lautaro073'" in production

    for name in ("staging", "production"):
        body = job(yaml, name)
        deploy_index = body.index("deploy --prebuilt --prod")
        health_index = body.index('"$APP_URL/api/health"')
        assert deploy_index < health_index
        assert re.search(r"curl --fail", body)

# DEPLOY contiene el texto exacto de .github/workflows/deploy.yml del SHA revisado.
current_new_tests(DEPLOY)

m1 = DEPLOY.replace(
    '          pnpm dlx vercel@61.0.0 pull --yes --environment=production --token="$VERCEL_TOKEN"\n',
    '',
)
current_new_tests(m1)

m2 = DEPLOY.replace(
    '--max-time 15 "$APP_URL/api/health"',
    '--max-time 15 "$APP_URL/api/health" || true',
)
current_new_tests(m2)

m3 = DEPLOY.replace(
    "            echo '::error::El deploy de production requiere un release iniciado por Lautaro073.'\n            exit 1",
    "            echo '::error::El deploy de production requiere un release iniciado por Lautaro073.'\n            exit 0",
)
current_new_tests(m3)
```

Salida observada:

```
baseline: GREEN
M1 remove vercel pull: GREEN
M2 health ignores failure: GREEN
M3 unauthorized actor exits 0: GREEN
```

Esto demuestra el hueco del instrumento: las tres implementaciones rotas siguen satisfaciendo las aserciones actuales.

## RED que debe producir el arreglo

Después de endurecer `verify-workflows.test.mjs`, ejecutar por separado:

1. borrar solo la línea `vercel@61.0.0 pull --yes --environment=production ...` de ambos jobs → el test de secuencia debe fallar;
2. agregar `|| true` al comando de health → el test de health debe fallar;
3. cambiar a `exit 0` la rama de actor no autorizado → el test de compuerta debe fallar;
4. cambiar `workflow_run.actor.login` de vuelta a `workflow_run.triggering_actor.login` → el test de identidad debe fallar.

Restaurar cada mutación antes de aplicar la siguiente. No se aceptan tests creados/adulterados para hacer verde la implementación.
