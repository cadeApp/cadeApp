# Evidencia y comandos reproducibles — PR #584, Ronda 1

**SHA auditado:** 2337c2a71f3bdfaa12aa782ca2269546926444a1.
**Método real:** lectura de archivos por GitHub y mutaciones independientes en memoria (sin tocar la rama). NO se ejecutó Playwright ni CI en esta sesión.

## Inventario de controles y observación

- AdminNav: header en lg:hidden; aside en lg:flex, lg:w-64; layout main en flex-1: cuatro controles estructurales GREEN.
- Mutaciones independientes: lg:hidden→md:hidden, lg:flex→md:flex, lg:w-64→lg:w-48, flex-1→flex-none: cuatro controles respectivos RED.
- Spec E2E: width: 390 presente; 1023, 1024 y 1280 ausentes.
- Este resultado demuestra únicamente la sensibilidad de los controles estructurales a cambios de clase, NO la sensibilidad del E2E. No se presenta como E2E RED→GREEN.

## Harness completo independiente (Node; trabaja solo en memoria)

Se puede copiar el bloque desde el directorio raíz del repo, a un archivo en /tmp. Usa solo Node y no modifica ningún archivo:

    cat > /tmp/pr584-r1-estructura.mjs <<'NODE'
    import fs from 'node:fs';
    import path from 'node:path';
    const root = process.env.REPO_PATH || process.cwd();
    const nav = fs.readFileSync(path.join(root, 'src/app/(admin)/admin-nav.tsx'), 'utf8');
    const layout = fs.readFileSync(path.join(root, 'src/app/(admin)/layout.tsx'), 'utf8');
    const spec = fs.readFileSync(path.join(root, 'e2e/specs/admin-nav-mobile.spec.ts'), 'utf8');
    function check(n, l) {
      const aside = n.match(/<aside className="([^"]+)"/)?.[1] || '';
      const header = n.match(/<header className="([^"]+)"/)?.[1] || '';
      const main = l.match(/<main className="([^"]+)"/)?.[1] || '';
      const has = (s, cls) => s.split(/\s+/).includes(cls);
      return {
        headerLG: has(header, 'lg:hidden'),
        sidebarLG: has(aside, 'lg:flex'),
        sidebarWidth: has(aside, 'lg:w-64'),
        mainFlex: has(main, 'flex-1')
      };
    }
    const baseline = check(nav, layout);
    if (!Object.values(baseline).every(Boolean)) throw new Error('Control sin mutar NO está verde');
    console.log('CONTROL GREEN 4/4');
    const mutants = [
      ['header desde md', 'lg:hidden', 'md:hidden', 'nav', 'headerLG'],
      ['sidebar desde md', 'lg:flex', 'md:flex', 'nav', 'sidebarLG'],
      ['sidebar angosta', 'lg:w-64', 'lg:w-48', 'nav', 'sidebarWidth'],
      ['main sin flex', 'flex-1', 'flex-none', 'layout', 'mainFlex']
    ];
    let red = 0;
    for (const [label, from, to, target, property] of mutants) {
      const source = target === 'nav' ? nav : layout;
      if (!source.includes(from)) throw new Error('Sin objetivo: ' + label);
      const changed = source.replace(from, to);
      const result = check(target === 'nav' ? changed : nav, target === 'layout' ? changed : layout);
      if (result[property] === false && Object.keys(result).every(k => k === property || result[k])) {
        red++;
        console.log('RED confirmado: ' + label);
      } else throw new Error('Mutante no detectado: ' + label);
    }
    if (red !== mutants.length) throw new Error('Mutación incompleta');
    console.log('MUTANTES RED ' + red + '/' + mutants.length);
    console.log('VIEWPORTS mencionados en spec:', JSON.stringify({
      390: spec.includes('width: 390'),
      1023: spec.includes('1023'),
      1024: spec.includes('1024'),
      1280: spec.includes('1280')
    }));
    NODE
    node /tmp/pr584-r1-estructura.mjs

Salida equivalente comprobada de manera independiente contra el SHA auditado:

    CONTROL GREEN 4/4
    RED confirmado: header desde md
    RED confirmado: sidebar desde md
    RED confirmado: sidebar angosta
    RED confirmado: main sin flex
    MUTANTES RED 4/4
    VIEWPORTS mencionados en spec: {"390":true,"1023":false,"1024":false,"1280":false}

El último chequeo de texto es una señal de inventario, NO una aserción funcional. No alcanza con agregar las cadenas de los números en comentarios o expectativas falsas.

## E2E real que debe acompañar el arreglo H01 (aún NO ejecutado por revisión)

Con entorno autorizado de aplicación contra Supabase Develop, las variables de proceso y el servidor del Preview configurados sin leer/escribir secretos:

    pnpm exec playwright test e2e/specs/admin-nav-mobile.spec.ts --project=chromium --workers=1 --retries=0

El nuevo test tiene que validar 1023, 1024 y 1280 con aserciones reales sobre DOM visible, enlaces, nombre y Salir y getBoundingClientRect del main. En especial a 1023 px debe haber Menú y NO sidebar; a 1024 px, sidebar y NO Menú; ancho del main 768 px; a 1280 px ancho del main 1024 px. La tolerancia de píxeles admite ±1 por redondeo.

Para probar RED de lg:hidden→md:hidden se requiere **build local del código mutado** (aplicación servida desde loopback y test apuntando a ella), no reutilizar PLAYWRIGHT_TEST_BASE_URL de un Preview Vercel sin mutar. El autor debe guardar el texto de fuente en memoria, mutarlo temporalmente, ejecutar en local, registrar fallo por expectativa, restaurar en finally y volver a ejecutar GREEN. No poner el mutante en la rama compartida, no crear test falso, no adulterar aserciones, no usar mocks que eviten la UI de producción. No se ejecutan comandos contra Supabase remoto administrativo ni se levanta Docker o Supabase local.

## Validaciones pendientes cuando el cambio esté pusheado

    git fetch origin
    git ls-remote origin refs/heads/feat/T-402-admin-shell
    git diff origin/develop...origin/feat/T-402-admin-shell --stat
    pnpm typecheck > /tmp/pr584-typecheck.log 2>&1
    pnpm lint > /tmp/pr584-lint.log 2>&1
    pnpm test > /tmp/pr584-test.log 2>&1
    pnpm exec playwright test e2e/specs/admin-nav-mobile.spec.ts --project=chromium --workers=1 --retries=0 > /tmp/pr584-e2e.log 2>&1
    node docs/revision-pr/analizar.mjs verificacion

Los comandos se ejecutan sobre worktree limpio del SHA que se quiere verificar. Los resultados locales, CI y E2E que aún no se hayan corrido no se anotan como verdes. En ronda 2 debe leerse el log del CI oficial del SHA de código, no solo el icono de estado.
