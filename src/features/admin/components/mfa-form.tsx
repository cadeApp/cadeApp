'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/ui/card';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/ui/input-otp';
import { notify } from '@/ui/notify';
import { verifyAdminMfaAction } from '../actions';
import { adminMfaSchema } from '../schemas';

export interface MfaFormProps {
  redirectTo?: string;
}

const mfaCodeSchema = adminMfaSchema.pick({ code: true });
type MfaFormData = { code: string };

function getTotpSecondsRemaining(nowMs = Date.now()): number {
  const seconds = Math.floor(nowMs / 1000);
  const elapsed = seconds % 30;
  return elapsed === 0 ? 30 : 30 - elapsed;
}

export function MfaForm({ redirectTo = '/admin/applicants' }: MfaFormProps = {}) {
  const router = useRouter();
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);

  const [secondsRemaining, setSecondsRemaining] = React.useState(() =>
    getTotpSecondsRemaining()
  );

  React.useEffect(() => {
    const update = () => {
      setSecondsRemaining(getTotpSecondsRemaining());
    };

    update();
    const timer = window.setInterval(update, 1000);

    return () => window.clearInterval(timer);
  }, []);

  const {
    watch,
    setValue,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<MfaFormData>({
    resolver: zodResolver(mfaCodeSchema),
    defaultValues: { code: '' },
  });

  const code = watch('code');

  const onSubmit = handleSubmit(async (data) => {
    setErrorMsg(null);

    try {
      const res = await verifyAdminMfaAction({ code: data.code, redirectTo });

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
      router.push(res.data.redirectTo);
      router.refresh();
    } catch {
      setErrorMsg('Error de conexión al verificar el segundo factor.');
    }
  });

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
        <CardTitle className="font-display text-xl font-bold tracking-tight">
          Verificación en dos pasos
        </CardTitle>
        <CardDescription className="text-sm text-muted-foreground">
          Ingresá el código de 6 dígitos generado por tu app autenticadora (Google Authenticator, Authy, etc.).
        </CardDescription>
      </CardHeader>

      <CardContent>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-3">
            <label
              htmlFor="totp-code"
              className="block text-center text-sm font-medium text-foreground"
            >
              Código de seguridad
            </label>
            <div className="flex justify-center">
              <InputOTP
                id="totp-code"
                maxLength={6}
                value={code}
                onChange={(val) => setValue('code', val, { shouldValidate: true })}
                disabled={isSubmitting}
              >
                <InputOTPGroup>
                  <InputOTPSlot index={0} />
                  <InputOTPSlot index={1} />
                  <InputOTPSlot index={2} />
                  <InputOTPSlot index={3} />
                  <InputOTPSlot index={4} />
                  <InputOTPSlot index={5} />
                </InputOTPGroup>
              </InputOTP>
            </div>
            <p className="text-center text-sm text-muted-foreground" aria-live="polite">
              {`Expira en 00:${String(secondsRemaining).padStart(2, '0')}`}
            </p>
            {errors.code ? (
              <p className="text-center text-sm text-destructive font-medium" role="alert">
                {errors.code.message ?? 'Ingresá los 6 dígitos numéricos.'}
              </p>
            ) : null}
          </div>

          {errorMsg ? (
            <div
              className="rounded-lg bg-destructive/10 p-3 text-center text-sm font-medium text-destructive"
              role="alert"
            >
              {errorMsg}
            </div>
          ) : null}

          <Button
            type="submit"
            className="w-full h-11 text-base font-semibold"
            disabled={isSubmitting || code.length !== 6}
          >
            {isSubmitting ? 'Verificando...' : 'Verificar código'}
          </Button>

          <div className="pt-2 text-center text-sm text-muted-foreground">
            <p className="text-sm">
              ¿Problemas con el código de tu app autenticadora? Asegurate de que la hora de tu dispositivo esté sincronizada automáticamente.
            </p>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
