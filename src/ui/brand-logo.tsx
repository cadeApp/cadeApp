import React from 'react';
import { cn } from './cn';

export const BRAND_ASSET_PATHS = {
  svg: '/brand/logo.svg',
  webp: '/brand/logo.webp',
  icon192: '/icon-192x192.png',
  icon512: '/icon-512x512.png',
} as const;

export const BRAND_LOGO_SVG_MARKUP =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40" fill="none"><rect x="4" y="6" width="32" height="28" rx="8" fill="#09BABD"/><path d="M4 21C11 16 17 26 24 21C29 17 33 19 36 21" stroke="#12182C" stroke-width="2.5" stroke-linecap="round"/><circle cx="14" cy="27" r="3" fill="#12182C"/><circle cx="27" cy="27" r="3" fill="#12182C"/><path d="M14 27H23L26 19H19L16 23H12" stroke="#12182C" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';

export interface BrandLogoProps extends React.HTMLAttributes<HTMLDivElement> {
  size?: 'sm' | 'md' | 'lg';
  showWordmark?: boolean;
  variant?: 'default' | 'inverse';
}

const sizeMap = {
  sm: 'h-8 w-8',
  md: 'h-10 w-10',
  lg: 'h-12 w-12',
} as const;

/**
 * Componente oficial `<BrandLogo />` de cadeApp (< 5 KB).
 * Representa la caja de envío teal (#09BABD) cruzada por la línea de ruta ondulada
 * y el repartidor en tinta marina (#12182C), sin importar archivos crudos de `assets/`.
 */
export function BrandLogo({
  size = 'md',
  showWordmark = true,
  variant = 'default',
  className,
  ...props
}: BrandLogoProps) {
  return (
    <div
      role="img"
      aria-label="cadeApp"
      className={cn('inline-flex select-none items-center gap-2.5', className)}
      {...props}
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 40 40"
        fill="none"
        aria-hidden="true"
        className={cn('shrink-0 rounded-lg', sizeMap[size])}
      >
        <rect x="4" y="6" width="32" height="28" rx="8" fill="#09BABD" />
        <path
          d="M4 21C11 16 17 26 24 21C29 17 33 19 36 21"
          stroke="#12182C"
          strokeWidth="2.5"
          strokeLinecap="round"
        />
        <circle cx="14" cy="27" r="3" fill="#12182C" />
        <circle cx="27" cy="27" r="3" fill="#12182C" />
        <path
          d="M14 27H23L26 19H19L16 23H12"
          stroke="#12182C"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      {showWordmark ? (
        <span
          className={cn(
            'font-display text-lg font-bold tracking-tight',
            variant === 'inverse' ? 'text-background' : 'text-foreground'
          )}
        >
          cadeApp
        </span>
      ) : null}
    </div>
  );
}
