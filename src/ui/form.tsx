'use client';

import * as React from 'react';
import * as LabelPrimitive from '@radix-ui/react-label';
import { Slot } from '@radix-ui/react-slot';
import {
  Controller,
  FormProvider,
  useFormContext,
  type ControllerProps,
  type FieldPath,
  type FieldValues,
} from 'react-hook-form';
import { cn } from '@/ui/cn';

export const Form = FormProvider;

interface FormFieldContextValue {
  id: string;
  name: string;
  error?: string;
}

const FormFieldContext = React.createContext<FormFieldContextValue | null>(null);

export function useFormField() {
  const context = React.useContext(FormFieldContext);
  const rhfContext = useFormContext();
  if (!context) {
    throw new Error('useFormField must be used within <FormField>');
  }
  const fieldState = rhfContext?.getFieldState
    ? rhfContext.getFieldState(context.name, rhfContext.formState)
    : undefined;
  const resolvedError = context.error ?? fieldState?.error?.message;

  return {
    ...context,
    error: resolvedError,
    formItemId: `${context.id}-form-item`,
    formDescriptionId: `${context.id}-form-item-description`,
    formMessageId: `${context.id}-form-item-message`,
  };
}

export interface DeclarativeFormFieldProps {
  name: string;
  error?: string;
  children: React.ReactNode;
}

export type FormFieldProps<
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>,
> =
  | DeclarativeFormFieldProps
  | (ControllerProps<TFieldValues, TName> & { error?: string });

export function FormField<
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>,
>(props: FormFieldProps<TFieldValues, TName>) {
  const id = React.useId();

  if ('render' in props) {
    return (
      <FormFieldContext.Provider value={{ id, name: String(props.name), error: props.error }}>
        <Controller {...props} />
      </FormFieldContext.Provider>
    );
  }

  return (
    <FormFieldContext.Provider value={{ id, name: props.name, error: props.error }}>
      {props.children}
    </FormFieldContext.Provider>
  );
}

export function FormItem({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('space-y-1.5', className)} {...props} />;
}

export function FormLabel({
  className,
  ...props
}: React.ComponentPropsWithoutRef<typeof LabelPrimitive.Root>) {
  const { error, formItemId } = useFormField();
  return (
    <LabelPrimitive.Root
      htmlFor={formItemId}
      className={cn(
        'block text-sm font-semibold text-foreground',
        error && 'text-destructive',
        className
      )}
      {...props}
    />
  );
}

export const FormControl = React.forwardRef<
  HTMLElement,
  React.ComponentPropsWithoutRef<typeof Slot>
>(({ className, ...props }, ref) => {
  const { error, formItemId, formDescriptionId, formMessageId } = useFormField();

  return (
    <Slot
      ref={ref}
      id={formItemId}
      aria-describedby={!error ? formDescriptionId : `${formDescriptionId} ${formMessageId}`}
      aria-invalid={Boolean(error)}
      className={className}
      {...props}
    />
  );
});
FormControl.displayName = 'FormControl';

export function FormDescription({
  className,
  ...props
}: React.HTMLAttributes<HTMLParagraphElement>) {
  const { formDescriptionId } = useFormField();
  return (
    <p id={formDescriptionId} className={cn('text-sm text-muted-foreground', className)} {...props} />
  );
}

export function FormMessage({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLParagraphElement>) {
  const { error, formMessageId } = useFormField();
  const body = error ?? children;
  if (!body) {
    return null;
  }
  return (
    <p
      id={formMessageId}
      role="alert"
      className={cn('text-sm font-medium text-destructive', className)}
      {...props}
    >
      {body}
    </p>
  );
}
