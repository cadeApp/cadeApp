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
        <RegisterForm initialRole={initialRole} />
      </main>
    </div>
  );
}
