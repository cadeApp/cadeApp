'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Store, Check, AlertCircle } from 'lucide-react';
import { BrandLogo } from '@/ui/brand-logo';
import { registerAction } from '../actions';
import { authCopy } from '../copy';
import type { SignupRole } from '../schemas';

export function RegisterForm({ initialRole }: { initialRole?: SignupRole }) {
  const router = useRouter();
  const [role, setRole] = useState<SignupRole>(initialRole || 'merchant');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!acceptTerms) {
      setErrorMessage(authCopy.register.errorTermsRequired);
      return;
    }
    setErrorMessage(null);
    setIsPending(true);

    try {
      const result = await registerAction({
        email,
        password,
        role,
        acceptTerms,
      });

      if (!result.ok) {
        if (result.code === 'INVALID_SIGNUP_ROLE') {
          setErrorMessage(authCopy.register.errorAdminRejected);
        } else {
          setErrorMessage(authCopy.register.errorGeneric);
        }
        setIsPending(false);
        return;
      }

      router.push(result.data.redirectTo);
      router.refresh();
    } catch {
      setErrorMessage(authCopy.register.errorGeneric);
      setIsPending(false);
    }
  };

  return (
    <div className="w-full max-w-sm space-y-6">
      <div className="space-y-1 text-center">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          {authCopy.register.title}
        </h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Selector de rol: Comercio vs Repartidor */}
        <div className="space-y-3">
          <button
            type="button"
            aria-pressed={role === 'merchant'}
            onClick={() => setRole('merchant')}
            className={`relative flex w-full items-start gap-3 rounded-lg border-2 p-4 text-left transition-colors ${
              role === 'merchant'
                ? 'border-primary-dark bg-card shadow-sm'
                : 'border-border bg-card/60 hover:bg-card'
            }`}
          >
            <div className="mt-0.5 rounded-full bg-primary/10 p-2 text-primary-dark">
              <Store className="h-5 w-5" />
            </div>
            <div className="flex-1 pr-6">
              <div className="font-semibold text-foreground">
                {authCopy.register.merchantRoleTitle}
              </div>
              <div className="text-sm text-muted-foreground">
                {authCopy.register.merchantRoleDesc}
              </div>
            </div>
            {role === 'merchant' && (
              <div className="absolute right-3 top-3 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground">
                <Check className="h-3 w-3 stroke-[3]" />
              </div>
            )}
          </button>

          <button
            type="button"
            aria-pressed={role === 'courier'}
            onClick={() => setRole('courier')}
            className={`relative flex w-full items-start gap-3 rounded-lg border-2 p-4 text-left transition-colors ${
              role === 'courier'
                ? 'border-primary-dark bg-card shadow-sm'
                : 'border-border bg-card/60 hover:bg-card'
            }`}
          >
            <div className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 p-1.5 text-primary-dark">
              <BrandLogo showWordmark={false} className="h-6 w-auto shrink-0" />
            </div>
            <div className="flex-1 pr-6">
              <div className="font-semibold text-foreground">
                {authCopy.register.courierRoleTitle}
              </div>
              <div className="text-sm text-muted-foreground">
                {authCopy.register.courierRoleDesc}
              </div>
            </div>
            {role === 'courier' && (
              <div className="absolute right-3 top-3 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground">
                <Check className="h-3 w-3 stroke-[3]" />
              </div>
            )}
          </button>
        </div>

        {/* Campo Email */}
        <div className="space-y-2">
          <label htmlFor="email" className="text-sm font-medium text-foreground">
            {authCopy.register.emailLabel}
          </label>
          <input
            id="email"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={authCopy.register.emailPlaceholder}
            className="flex h-12 w-full rounded-md border border-input bg-card px-3 py-2 text-sm text-foreground shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
          />
        </div>

        {/* Campo Contraseña */}
        <div className="space-y-2">
          <label htmlFor="password" className="text-sm font-medium text-foreground">
            {authCopy.register.passwordLabel}
          </label>
          <input
            id="password"
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="flex h-12 w-full rounded-md border border-input bg-card px-3 py-2 text-sm text-foreground shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
          />
          <p className="text-sm text-muted-foreground">{authCopy.register.passwordHelper}</p>
        </div>

        {/* Checkbox de términos */}
        <div className="flex items-start space-x-2 pt-1">
          <input
            id="terms"
            type="checkbox"
            checked={acceptTerms}
            onChange={(e) => setAcceptTerms(e.target.checked)}
            className="mt-1 h-4 w-4 rounded border-input text-primary focus:ring-ring"
          />
          <label htmlFor="terms" className="text-sm leading-relaxed text-muted-foreground">
            Acepto los{' '}
            <Link href="/terms" className="text-primary-dark underline hover:text-foreground">
              Términos
            </Link>{' '}
            y la{' '}
            <Link href="/privacy" className="text-primary-dark underline hover:text-foreground">
              Política de privacidad
            </Link>
          </label>
        </div>

        {errorMessage && (
          <div
            role="alert"
            className="flex items-center gap-2 rounded-md bg-destructive/10 p-3 text-sm text-destructive"
          >
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        <button
          type="submit"
          disabled={isPending}
          className="inline-flex h-12 w-full items-center justify-center rounded-md bg-primary px-4 py-2 text-base font-semibold text-primary-foreground shadow transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50"
        >
          {isPending ? authCopy.register.loadingButton : authCopy.register.submitButton}
        </button>
      </form>

      <div className="text-center text-sm text-muted-foreground">
        <span>{authCopy.register.hasAccount} </span>
        <Link
          href="/login"
          className="font-medium text-primary-dark hover:underline focus:outline-none focus:ring-1 focus:ring-ring"
        >
          {authCopy.register.loginLink}
        </Link>
      </div>
    </div>
  );
}
