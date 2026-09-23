import * as React from 'react';
import { cn } from '@/ui/cn';
import { DESIGN_TOKENS } from '@/ui/tokens';

export const BRAND_ASSET_PATHS = {
  logoSvg: '/brand/logo.svg',
  logoWebp: '/brand/logo.webp',
  icon192: '/icon-192x192.png',
  icon512: '/icon-512x512.png',
} as const;

export const BRAND_LOGO_GEOMETRY = {
  viewBoxFull: '0 0 220 56',
  viewBoxIcon: '0 0 62 56',
  box: { x: 4, y: 14, width: 22, height: 22, rx: 3 },
  wavyRoadPath:
    'M4 22H12.5C14.2 22 15.2 23.2 14.8 24.8C14.4 26.4 15.4 27.8 17.2 27.8H22.5C25.5 27.8 27.8 30.2 27.8 33.2V36',
  boxBasePath: 'M4 35.5H26',
  helmet: { cx: 38, cy: 13.5, r: 5.2 },
  visorPath: 'M39.5 12.2L43 13.5L40.5 15.5',
  riderAndScooterBodyPath:
    'M31.5 19.5C33 18 35.5 18.5 37.5 20L35.8 23.5H48V27.5C52.5 29.5 56.5 33.5 58 38.5H46.5C47 35 45.5 30.5 41.5 28.5H31.5C29.5 28.5 28.5 26.5 29 24.2L31.5 19.5Z',
  chassisPath: 'M10 38.5H45C48.5 38.5 50.5 34.5 49.5 31',
  rearWheel: { cx: 15.5, cy: 41.5, r: 4.8 },
  frontWheel: { cx: 52.5, cy: 41.5, r: 4.8 },
} as const;

export const BRAND_LOGO_SVG_MARKUP = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${BRAND_LOGO_GEOMETRY.viewBoxFull}" role="img" aria-label="cadeApp">
  <rect x="${BRAND_LOGO_GEOMETRY.box.x}" y="${BRAND_LOGO_GEOMETRY.box.y}" width="${BRAND_LOGO_GEOMETRY.box.width}" height="${BRAND_LOGO_GEOMETRY.box.height}" rx="${BRAND_LOGO_GEOMETRY.box.rx}" fill="${DESIGN_TOKENS.colors.primary}" />
  <path d="${BRAND_LOGO_GEOMETRY.wavyRoadPath}" stroke="${DESIGN_TOKENS.colors.background}" stroke-width="2.6" stroke-linecap="round" fill="none" />
  <path d="${BRAND_LOGO_GEOMETRY.boxBasePath}" stroke="${DESIGN_TOKENS.colors.ink}" stroke-width="2.5" stroke-linecap="round" />
  <circle cx="${BRAND_LOGO_GEOMETRY.helmet.cx}" cy="${BRAND_LOGO_GEOMETRY.helmet.cy}" r="${BRAND_LOGO_GEOMETRY.helmet.r}" fill="${DESIGN_TOKENS.colors.ink}" />
  <path d="${BRAND_LOGO_GEOMETRY.visorPath}" fill="${DESIGN_TOKENS.colors.background}" />
  <path d="${BRAND_LOGO_GEOMETRY.riderAndScooterBodyPath}" fill="${DESIGN_TOKENS.colors.ink}" />
  <path d="${BRAND_LOGO_GEOMETRY.chassisPath}" stroke="${DESIGN_TOKENS.colors.ink}" stroke-width="3.2" stroke-linecap="round" fill="none" />
  <circle cx="${BRAND_LOGO_GEOMETRY.rearWheel.cx}" cy="${BRAND_LOGO_GEOMETRY.rearWheel.cy}" r="${BRAND_LOGO_GEOMETRY.rearWheel.r}" fill="${DESIGN_TOKENS.colors.ink}" />
  <circle cx="${BRAND_LOGO_GEOMETRY.frontWheel.cx}" cy="${BRAND_LOGO_GEOMETRY.frontWheel.cy}" r="${BRAND_LOGO_GEOMETRY.frontWheel.r}" fill="${DESIGN_TOKENS.colors.ink}" />
  <text x="68" y="38" font-family="${DESIGN_TOKENS.fonts.display}, sans-serif" font-weight="800" font-size="27" fill="${DESIGN_TOKENS.colors.ink}">cadeApp</text>
</svg>`;

export interface BrandLogoProps extends React.SVGAttributes<SVGSVGElement> {
  showWordmark?: boolean;
  label?: string;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'default' | 'inverse' | 'mono';
}

export function BrandLogo({
  showWordmark = true,
  label = 'cadeApp',
  size = 'md',
  variant = 'default',
  className,
  ...props
}: BrandLogoProps) {
  const sizeClass = size === 'sm' ? 'h-8' : size === 'lg' ? 'h-12' : 'h-10';
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox={showWordmark ? BRAND_LOGO_GEOMETRY.viewBoxFull : BRAND_LOGO_GEOMETRY.viewBoxIcon}
      role="img"
      aria-label={label}
      data-variant={variant}
      className={cn(sizeClass, 'w-auto select-none', className)}
      {...props}
    >
      <rect
        x={BRAND_LOGO_GEOMETRY.box.x}
        y={BRAND_LOGO_GEOMETRY.box.y}
        width={BRAND_LOGO_GEOMETRY.box.width}
        height={BRAND_LOGO_GEOMETRY.box.height}
        rx={BRAND_LOGO_GEOMETRY.box.rx}
        fill={DESIGN_TOKENS.colors.primary}
      />
      <path
        d={BRAND_LOGO_GEOMETRY.wavyRoadPath}
        stroke={DESIGN_TOKENS.colors.background}
        strokeWidth="2.6"
        strokeLinecap="round"
        fill="none"
      />
      <path
        d={BRAND_LOGO_GEOMETRY.boxBasePath}
        stroke={DESIGN_TOKENS.colors.ink}
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      <circle
        cx={BRAND_LOGO_GEOMETRY.helmet.cx}
        cy={BRAND_LOGO_GEOMETRY.helmet.cy}
        r={BRAND_LOGO_GEOMETRY.helmet.r}
        fill={DESIGN_TOKENS.colors.ink}
      />
      <path d={BRAND_LOGO_GEOMETRY.visorPath} fill={DESIGN_TOKENS.colors.background} />
      <path d={BRAND_LOGO_GEOMETRY.riderAndScooterBodyPath} fill={DESIGN_TOKENS.colors.ink} />
      <path
        d={BRAND_LOGO_GEOMETRY.chassisPath}
        stroke={DESIGN_TOKENS.colors.ink}
        strokeWidth="3.2"
        strokeLinecap="round"
        fill="none"
      />
      <circle
        cx={BRAND_LOGO_GEOMETRY.rearWheel.cx}
        cy={BRAND_LOGO_GEOMETRY.rearWheel.cy}
        r={BRAND_LOGO_GEOMETRY.rearWheel.r}
        fill={DESIGN_TOKENS.colors.ink}
      />
      <circle
        cx={BRAND_LOGO_GEOMETRY.frontWheel.cx}
        cy={BRAND_LOGO_GEOMETRY.frontWheel.cy}
        r={BRAND_LOGO_GEOMETRY.frontWheel.r}
        fill={DESIGN_TOKENS.colors.ink}
      />
      {showWordmark ? (
        <text
          x="68"
          y="38"
          fontFamily={`${DESIGN_TOKENS.fonts.display}, sans-serif`}
          fontWeight="800"
          fontSize="27"
          fill={DESIGN_TOKENS.colors.ink}
        >
          cadeApp
        </text>
      ) : null}
    </svg>
  );
}
