'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Store, Check, AlertCircle, Eye, EyeOff } from 'lucide-react';
import { BrandLogo } from '@/ui/brand-logo';
import { Button } from '@/ui/button';
import { Card } from '@/ui/card';
import { Input } from '@/ui/input';
import { registerAction } from '../actions';
import { authCopy } from '../copy';
import type { SignupRole } from '../schemas';

export function RegisterForm({ initialRole }: { initialRole?: SignupRole }) {
  const router = useRouter();
  const [role, setRole] = useState<SignupRole>(initialRole || 'merchant');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
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
    <Card className="w-full space-y-6 p-6 sm:p-8">
      <div className="space-y-1.5 text-center sm:text-left">
        <h1 className="font-display text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
          {authCopy.register.title}
        </h1>
        <p className="text-sm text-muted-foreground">
          Elegí tu perfil para empezar a operar en Aguilares
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Selector de rol: Comercio vs Repartidor */}
        <div className="space-y-3">
          <button
            type="button"
            aria-pressed={role === 'merchant'}
            onClick={() => setRole('merchant')}
            className={`relative flex min-h-16 w-full items-start gap-3 rounded-lg border-2 p-4 text-left transition-colors ${
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
            className={`relative flex min-h-16 w-full items-start gap-3 rounded-lg border-2 p-4 text-left transition-colors ${
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
          <label htmlFor="email" className="block text-sm font-semibold text-foreground">
            {authCopy.register.emailLabel}
          </label>
          <Input
            id="email"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={authCopy.register.emailPlaceholder}
          />
        </div>

        {/* Campo Contraseña */}
        <div className="space-y-2">
          <label htmlFor="password" className="block text-sm font-semibold text-foreground">
            {authCopy.register.passwordLabel}
          </label>
          <div className="relative">
            <Input
              id="password"
              type={showPassword ? 'text' : 'password'}
              required
              minLength={8}
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="pr-12"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-0 top-0 flex h-12 w-12 min-h-12 min-w-12 items-center justify-center rounded-r-lg text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-label={showPassword ? authCopy.login.hidePassword : authCopy.login.showPassword}
            >
              {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
            </button>
          </div>
          <p className="text-sm text-muted-foreground">{authCopy.register.passwordHelper}</p>
        </div>

        {/* Checkbox de términos */}
        <div className="flex items-start space-x-2.5 pt-1">
          <input
            id="terms"
            type="checkbox"
            checked={acceptTerms}
            onChange={(e) => setAcceptTerms(e.target.checked)}
            className="mt-1 h-4 w-4 rounded border-input text-primary focus:ring-ring"
          />
          <label htmlFor="terms" className="text-sm leading-relaxed text-muted-foreground">
            Acepto los{' '}
            <span className="font-semibold text-foreground">
              Términos y Política de privacidad del Piloto
            </span>{' '}
            <span className="text-muted-foreground">(en publicación · T-311)</span>
          </label>
        </div>

        {errorMessage && (
          <div
            role="alert"
            className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm font-medium text-destructive"
          >
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        <Button
          type="submit"
          size="lg"
          disabled={isPending}
          className="h-12 min-h-12 w-full font-display text-base font-bold shadow-sm"
        >
          {isPending ? authCopy.register.loadingButton : authCopy.register.submitButton}
        </Button>
      </form>

      <div className="border-t border-border/60 pt-4 text-center text-sm text-muted-foreground">
        <span>{authCopy.register.hasAccount} </span>
        <Link
          href="/login"
          className="font-semibold text-primary-dark underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm"
        >
          {authCopy.register.loginLink}
        </Link>
      </div>
    </Card>
  );
}
