'use client';

import * as React from 'react';
import type { z } from 'zod';
import { cn } from './cn';

export interface ZodFormState<TValues extends Record<string, unknown>> {
  values: TValues;
  errors: Partial<Record<keyof TValues & string, string>>;
  setValue: <K extends keyof TValues & string>(name: K, value: TValues[K]) => void;
  validate: () => { ok: true; data: TValues } | { ok: false };
}

/**
 * Hook de formulario tipado con Zod (`safeParse`) para `src/ui/form.tsx`.
 * Permite usar el mismo schema Zod de `schemas.ts` en cliente y servidor.
 */
export function useZodForm<TSchema extends z.ZodType<Record<string, unknown>>>(
  schema: TSchema,
  defaultValues: z.infer<TSchema>
): ZodFormState<z.infer<TSchema>> {
  type Values = z.infer<TSchema>;
  const [values, setValues] = React.useState<Values>(defaultValues);
  const [errors, setErrors] = React.useState<Partial<Record<keyof Values & string, string>>>({});

  const setValue = React.useCallback(
    <K extends keyof Values & string>(name: K, value: Values[K]) => {
      setValues((prev) => ({ ...prev, [name]: value }));
      setErrors((prev) => {
        if (!prev[name]) return prev;
        const next = { ...prev };
        delete next[name];
        return next;
      });
    },
    []
  );

  const validate = React.useCallback(() => {
    const parsed = schema.safeParse(values);
    if (parsed.success) {
      setErrors({});
      return { ok: true as const, data: parsed.data as Values };
    }
    const fieldErrors: Partial<Record<keyof Values & string, string>> = {};
    for (const issue of parsed.error.issues) {
      const firstKey = String(issue.path[0] ?? '') as keyof Values & string;
      if (firstKey && !fieldErrors[firstKey]) {
        fieldErrors[firstKey] = issue.message;
      }
    }
    setErrors(fieldErrors);
    return { ok: false as const };
  }, [schema, values]);

  return {
    values,
    errors,
    setValue,
    validate,
  };
}

interface FormContextValue {
  values: Record<string, unknown>;
  errors: Partial<Record<string, string>>;
  setValue: (name: string, value: unknown) => void;
}

const FormContext = React.createContext<FormContextValue | null>(null);
const FormFieldNameContext = React.createContext<string | null>(null);

export function useFormField() {
  const form = React.useContext(FormContext);
  const name = React.useContext(FormFieldNameContext);
  if (!form || !name) {
    throw new Error('useFormField debe invocarse dentro de <FormField>.');
  }
  return {
    name,
    value: form.values[name],
    error: form.errors[name],
  };
}

export interface FormProps<TValues extends Record<string, unknown>> extends Omit<
  React.FormHTMLAttributes<HTMLFormElement>,
  'onSubmit'
> {
  form: ZodFormState<TValues>;
  onSubmit: (validValues: TValues) => void | Promise<void>;
}

export function Form<TValues extends Record<string, unknown>>({
  form,
  onSubmit,
  className,
  children,
  ...props
}: FormProps<TValues>) {
  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const result = form.validate();
    if (result.ok) {
      await onSubmit(result.data);
    }
  };

  return (
    <FormContext.Provider
      value={{
        values: form.values,
        errors: form.errors,
        setValue: (name, val) =>
          form.setValue(name as keyof TValues & string, val as TValues[keyof TValues & string]),
      }}
    >
      <form noValidate onSubmit={handleSubmit} className={cn('space-y-4', className)} {...props}>
        {children}
      </form>
    </FormContext.Provider>
  );
}

export interface FormFieldRenderProps {
  field: {
    name: string;
    value: unknown;
    onChange: (nextValue: unknown) => void;
  };
  error?: string;
}

export interface FormFieldProps {
  name: string;
  render: (props: FormFieldRenderProps) => React.ReactNode;
}

export function FormField({ name, render }: FormFieldProps) {
  const form = React.useContext(FormContext);
  if (!form) {
    throw new Error('<FormField> debe usarse dentro de <Form>.');
  }

  return (
    <FormFieldNameContext.Provider value={name}>
      {render({
        field: {
          name,
          value: form.values[name],
          onChange: (nextValue) => form.setValue(name, nextValue),
        },
        error: form.errors[name],
      })}
    </FormFieldNameContext.Provider>
  );
}

export function FormItem({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('space-y-1.5', className)} {...props} />;
}

export function FormLabel({ className, ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) {
  const { error } = useFormField();
  return (
    <label
      className={cn(
        'block font-sans text-sm font-semibold text-foreground',
        error && 'text-destructive',
        className
      )}
      {...props}
    />
  );
}

export function FormControl({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('w-full', className)} {...props} />;
}

export function FormDescription({
  className,
  ...props
}: React.HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn('text-sm text-muted-foreground', className)} {...props} />;
}

export function FormMessage({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLParagraphElement>) {
  const { error } = useFormField();
  const body = error ?? children;
  if (!body) {
    return null;
  }
  return (
    <p role="alert" className={cn('text-sm font-medium text-destructive', className)} {...props}>
      {body}
    </p>
  );
}
