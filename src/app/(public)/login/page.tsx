import Link from 'next/link';
import { z } from 'zod';
import { LoginForm } from '@/features/auth';
import { TopBar } from '@/ui/top-bar';
import { Button } from '@/ui/button';
import { ArrowLeft } from 'lucide-react';

const loginSearchParamsSchema = z.object({
  redirectTo: z.string().optional(),
});

interface LoginPageProps {
  searchParams: Promise<unknown>;
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const rawParams = await searchParams;
  const parsed = loginSearchParamsSchema.safeParse(rawParams);
  const initialRedirectTo = parsed.success ? parsed.data.redirectTo : undefined;

  return (
    <div className="flex flex-1 flex-col bg-background">
      <TopBar
        leftAction={
          <Link
            href="/"
            aria-label="Volver al inicio"
            className="inline-flex h-12 w-12 min-h-12 min-w-12 items-center justify-center rounded-lg text-background transition-colors hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <ArrowLeft className="h-5 w-5" aria-hidden="true" />
          </Link>
        }
        rightAction={
          <Link href="/register">
            <Button
              variant="ghost"
              size="sm"
              className="font-semibold text-background hover:bg-white/10 hover:text-background"
            >
              Registrarme
            </Button>
          </Link>
        }
      />

      <main className="mx-auto flex w-full max-w-[390px] flex-1 flex-col items-center justify-center px-4 py-8 sm:max-w-md sm:px-6 sm:py-12">
        <LoginForm initialRedirectTo={initialRedirectTo} />
      </main>
    </div>
  );
}
