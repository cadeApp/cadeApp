// Helper para definir la configuración de Playwright sin requerir resolución runtime obligatoria en Node
function defineConfig<T>(config: T): T {
  return config;
}

export default defineConfig({
  testDir: './e2e/specs',
});
