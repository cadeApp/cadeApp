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
    <div className="flex min-h-screen flex-col bg-background">
      <TopBar
        leftAction={
          <Link href="/" aria-label="Volver al inicio">
            <Button
              variant="ghost"
              size="icon"
              className="min-h-12 min-w-12 text-background hover:bg-white/10"
            >
              <ArrowLeft className="h-5 w-5" aria-hidden="true" />
            </Button>
          </Link>
        }
      />
      <main className="flex flex-1 flex-col items-center justify-center p-4">
        <LoginForm initialRedirectTo={initialRedirectTo} />
      </main>
    </div>
  );
}
