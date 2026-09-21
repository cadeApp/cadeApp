// Fixture de prueba: archivo en src/server/** sin import 'server-only' (debe fallar con cadeapp/server-layer-must-be-server-only)
export const someServerHelper = () => 'missing server-only';
