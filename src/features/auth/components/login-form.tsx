'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Eye, EyeOff, AlertCircle } from 'lucide-react';
import { Button } from '@/ui/button';
import { Card } from '@/ui/card';
import { Input } from '@/ui/input';
import { loginAction } from '../actions';
import { authCopy } from '../copy';
import { resolvePostLoginRedirect } from '../guards';

export function LoginForm({ initialRedirectTo }: { initialRedirectTo?: string }) {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErrorMessage(null);
    setIsPending(true);

    try {
      const result = await loginAction({ email, password, redirectTo: initialRedirectTo });
      if (!result.ok) {
        if (result.code === 'UNAUTHENTICATED') {
          setErrorMessage(authCopy.login.errorInvalidCredentials);
        } else {
          setErrorMessage(authCopy.login.errorGeneric);
        }
        setIsPending(false);
        return;
      }

      // Sanitiza el destino final previniendo Open Redirect y salto de roles
      const targetUrl = resolvePostLoginRedirect(
        initialRedirectTo,
        result.data.role,
        result.data.consentStatus
      );
      router.push(targetUrl);
      router.refresh();
    } catch {
      setErrorMessage(authCopy.login.errorGeneric);
      setIsPending(false);
    }
  };

  return (
    <Card className="w-full space-y-6 p-6 sm:p-8">
      <div className="space-y-1.5 text-center sm:text-left">
        <h1 className="font-display text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
          {authCopy.login.title}
        </h1>
        <p className="text-sm text-muted-foreground">{authCopy.login.subtitle}</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="space-y-2">
          <label htmlFor="email" className="block text-sm font-semibold text-foreground">
            {authCopy.login.emailLabel}
          </label>
          <Input
            id="email"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={authCopy.login.emailPlaceholder}
          />
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <label htmlFor="password" className="text-sm font-semibold text-foreground">
              {authCopy.login.passwordLabel}
            </label>
            <Link
              href="/forgot-password"
              className="rounded-sm text-sm font-semibold text-primary-dark underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {authCopy.login.forgotPassword}
            </Link>
          </div>
          <div className="relative">
            <Input
              id="password"
              type={showPassword ? 'text' : 'password'}
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="pr-12"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-0 top-0 flex h-12 min-h-12 w-12 min-w-12 items-center justify-center rounded-r-lg text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-label={showPassword ? authCopy.login.hidePassword : authCopy.login.showPassword}
            >
              {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
            </button>
          </div>

          {errorMessage && (
            <div
              role="alert"
              className="mt-2 flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm font-medium text-destructive"
            >
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}
        </div>

        <Button
          type="submit"
          size="lg"
          disabled={isPending}
          className="h-12 min-h-12 w-full font-display text-base font-bold shadow-sm"
        >
          {isPending ? authCopy.login.loadingButton : authCopy.login.submitButton}
        </Button>
      </form>

      <div className="flex flex-wrap justify-center gap-x-4 gap-y-2 text-sm text-muted-foreground">
        <Link
          href="/legal/terms"
          className="rounded-sm underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          Términos
        </Link>
        <Link
          href="/legal/privacy"
          className="rounded-sm underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          Privacidad
        </Link>
      </div>

      <div className="border-t border-border/60 pt-4 text-center text-sm text-muted-foreground">
        <span>{authCopy.login.noAccount} </span>
        <Link
          href="/register"
          className="rounded-sm font-semibold text-primary-dark underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {authCopy.login.registerLink}
        </Link>
      </div>
    </Card>
  );
}
