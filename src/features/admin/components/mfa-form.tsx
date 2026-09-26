'use client';

import * as React from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/ui/card';
import { notify } from '@/ui/notify';
import { verifyAdminMfaAction } from '../actions';

export function MfaForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get('redirectTo') || '/admin/applicants';

  const [code, setCode] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    const cleanCode = code.trim();
    if (cleanCode.length !== 6) {
      setErrorMsg('Ingresá los 6 dígitos numéricos de tu app autenticadora.');
      return;
    }

    setLoading(true);
    setErrorMsg(null);

    try {
      const res = await verifyAdminMfaAction({ code: cleanCode });

      if (!res.ok) {
        if (res.code === 'VALIDATION_ERROR') {
          setErrorMsg('Código incorrecto o expirado. Verificá tu app e intentá de nuevo.');
        } else if (res.code === 'UNAUTHORIZED_ACTOR') {
          setErrorMsg('No tenés permisos de administrador para realizar esta acción.');
        } else {
          setErrorMsg('No se pudo verificar el código MFA en este momento.');
        }
        return;
      }

      notify.success('Identidad verificada con éxito.');
      router.push(redirectTo);
      router.refresh();
    } catch {
      setErrorMsg('Error de conexión al verificar el segundo factor.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="w-full max-w-md shadow-md">
      <CardHeader className="text-center">
        <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
          <svg
            className="h-6 w-6"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
            />
          </svg>
        </div>
        <CardTitle className="text-xl font-bold tracking-tight">Verificación en dos pasos</CardTitle>
        <CardDescription className="text-sm text-muted-foreground">
          Ingresá el código de 6 dígitos generado por tu app autenticadora (Google Authenticator, Authy, etc.).
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleVerify} className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="totp-code" className="block text-center text-sm font-medium text-foreground">
              Código de seguridad
            </label>
            <input
              id="totp-code"
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={6}
              autoComplete="one-time-code"
              autoFocus
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
              placeholder="000000"
              className="w-full text-center text-2xl font-mono tracking-widest h-12 rounded-md border border-input bg-background px-3 py-2 ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              required
            />
            {errorMsg ? (
              <p role="alert" className="text-center text-sm text-destructive font-medium">
                {errorMsg}
              </p>
            ) : null}
          </div>

          <Button type="submit" className="w-full h-11 text-base font-semibold" disabled={loading || code.length !== 6}>
            {loading ? 'Verificando...' : 'Verificar código'}
          </Button>

          <div className="pt-2 text-center text-sm text-muted-foreground">
            <p className="text-xs">
              ¿Problemas con el código de tu app autenticadora? Asegurate de que la hora de tu dispositivo esté sincronizada automáticamente.
            </p>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
