'use client';

import * as React from 'react';
import * as TooltipPrimitive from '@radix-ui/react-tooltip';

import { cn } from '@/ui/cn';

// Generado con `shadcn add tooltip` (T-427). Sin las clases de tailwindcss-animate (no está instalado y las animaciones
// van con los presets de Motion); con Portal y flecha, en la tinta del panel.
const TooltipProvider = TooltipPrimitive.Provider;

const Tooltip = TooltipPrimitive.Root;

const TooltipTrigger = TooltipPrimitive.Trigger;

const TooltipContent = React.forwardRef<
  React.ElementRef<typeof TooltipPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Content>
>(({ className, sideOffset = 6, children, ...props }, ref) => (
  <TooltipPrimitive.Portal>
    <TooltipPrimitive.Content
      ref={ref}
      sideOffset={sideOffset}
      className={cn(
        'z-50 rounded-md bg-secondary px-2.5 py-1.5 text-xs font-medium text-secondary-foreground shadow-md',
        className
      )}
      {...props}
    >
      {children}
      <TooltipPrimitive.Arrow className="fill-secondary" />
    </TooltipPrimitive.Content>
  </TooltipPrimitive.Portal>
));
TooltipContent.displayName = TooltipPrimitive.Content.displayName;

export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider };
