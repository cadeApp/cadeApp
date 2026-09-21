export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-6 text-center">
      <div className="max-w-md space-y-4 rounded-xl border bg-card p-8 shadow-sm">
        <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary font-bold text-xl">
          ⚡
        </div>
        <h1 className="text-2xl font-bold font-display tracking-tight text-foreground">
          cadeApp
        </h1>
        <p className="text-muted-foreground text-sm">
          Plataforma de logística urbana hiperlocal para Aguilares, Tucumán.
        </p>
        <div className="rounded-lg bg-muted p-3 text-sm font-mono text-muted-foreground">
          Fase 0 · Scaffold mínimo operativo (T-000)
        </div>
      </div>
    </main>
  );
}
