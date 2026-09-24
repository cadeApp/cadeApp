import Link from 'next/link';
import { z } from 'zod';
import { RegisterForm } from '@/features/auth';
import { TopBar } from '@/ui/top-bar';
import { Button } from '@/ui/button';
import { ArrowLeft } from 'lucide-react';
import type { SignupRole } from '@/domain/schemas';

const registerSearchParamsSchema = z.object({
  role: z.enum(['merchant', 'courier']).optional(),
});

interface RegisterPageProps {
  searchParams: Promise<unknown>;
}

export default async function RegisterPage({ searchParams }: RegisterPageProps) {
  const rawParams = await searchParams;
  const parsed = registerSearchParamsSchema.safeParse(rawParams);
  const initialRole = parsed.success ? (parsed.data.role as SignupRole | undefined) : undefined;

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
          <Link href="/login">
            <Button
              variant="ghost"
              size="sm"
              className="font-semibold text-background hover:bg-white/10 hover:text-background"
            >
              Ingresar
            </Button>
          </Link>
        }
      />

      <main className="mx-auto flex w-full max-w-[390px] flex-1 flex-col items-center justify-center px-4 py-8 sm:max-w-md sm:px-6 sm:py-12">
        <RegisterForm initialRole={initialRole} />
      </main>
    </div>
  );
}
