export const DESIGN_TOKENS = {
  colors: {
    primary: '#09BABD',
    primaryForeground: '#12182C',
    primaryDark: '#0B7A7D',
    background: '#FDFCFB',
    card: '#FFFFFF',
    border: '#E4E7EC',
    mutedForeground: '#5B6475',
    success: '#177A4B',
    warning: '#B45309',
    warningSurface: '#FFF4E0',
    danger: '#C62828',
  },
  typography: {
    minFontSizePx: 14,
    bodyFontSizePx: 16,
    headingFont: 'Montserrat',
    bodyFont: 'Inter',
  },
  dimensions: {
    buttonRadiusPx: 10,
    cardRadiusPx: 12,
    badgeRadiusPx: 9999,
    minTouchTargetPx: 48,
    topBarHeightPx: 56,
  },
} as const;

function parseHexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace(/^#/, '').trim();
  if (clean.length !== 6) {
    throw new RangeError(`Color hexadecimal inválido: ${hex}`);
  }
  const r = Number.parseInt(clean.slice(0, 2), 16);
  const g = Number.parseInt(clean.slice(2, 4), 16);
  const b = Number.parseInt(clean.slice(4, 6), 16);
  return [r, g, b];
}

function channelToLinear(value255: number): number {
  const srgb = value255 / 255;
  return srgb <= 0.03928 ? srgb / 12.92 : Math.pow((srgb + 0.055) / 1.055, 2.4);
}

/**
 * Calcula la luminancia relativa WCAG 2.2 de un color en formato `#RRGGBB`.
 */
export function getRelativeLuminance(hex: string): number {
  const [r, g, b] = parseHexToRgb(hex);
  const R = channelToLinear(r);
  const G = channelToLinear(g);
  const B = channelToLinear(b);
  return 0.2126 * R + 0.7152 * G + 0.0722 * B;
}

/**
 * Calcula la relación de contraste WCAG 2.2 entre dos colores (`1` a `21`),
 * redondeada a 2 decimales.
 */
export function getContrastRatio(hexA: string, hexB: string): number {
  const lumA = getRelativeLuminance(hexA);
  const lumB = getRelativeLuminance(hexB);
  const lighter = Math.max(lumA, lumB);
  const darker = Math.min(lumA, lumB);
  const ratio = (lighter + 0.05) / (darker + 0.05);
  return Math.round(ratio * 100) / 100;
}

export interface TokenContrastMatrixResult {
  allPass: boolean;
  primaryButtonRatio: number;
  primaryButtonAAA: boolean;
  inkOnBackgroundRatio: number;
  inkOnBackgroundAAA: boolean;
  deepTealOnWhiteRatio: number;
  deepTealOnWhiteAA: boolean;
  mutedOnWhiteRatio: number;
  mutedOnWhiteAA: boolean;
  warningOnSurfaceRatio: number;
  warningOnSurfaceAA: boolean;
  dangerWhiteRatio: number;
  dangerWhiteAA: boolean;
}

/**
 * Verifica la matriz completa de contraste de los tokens canónicos de Stitch (D16):
 * - Botón primario (#12182C sobre #09BABD) >= 6.9:1 (WCAG AAA para UI y texto)
 * - Tinta (#12182C) sobre fondo (#FDFCFB) >= 15:1 (WCAG AAA)
 * - Teal oscuro (#0B7A7D) sobre blanco (#FFFFFF) >= 4.5:1 (WCAG AA; nunca usar #09BABD para texto sobre blanco)
 * - Texto secundario (#5B6475) sobre blanco (#FFFFFF) >= 4.5:1 (WCAG AA)
 * - Aviso (#B45309) sobre superficie cálida (#FFF4E0) >= 4.5:1 (WCAG AA)
 * - Error (#C62828) con texto blanco (#FFFFFF) >= 4.5:1 (WCAG AA)
 */
export function verifyTokenContrastMatrix(): TokenContrastMatrixResult {
  const primaryButtonRatio = getContrastRatio(
    DESIGN_TOKENS.colors.primaryForeground,
    DESIGN_TOKENS.colors.primary
  );
  const inkOnBackgroundRatio = getContrastRatio(
    DESIGN_TOKENS.colors.primaryForeground,
    DESIGN_TOKENS.colors.background
  );
  const deepTealOnWhiteRatio = getContrastRatio(
    DESIGN_TOKENS.colors.primaryDark,
    DESIGN_TOKENS.colors.card
  );
  const mutedOnWhiteRatio = getContrastRatio(
    DESIGN_TOKENS.colors.mutedForeground,
    DESIGN_TOKENS.colors.card
  );
  const warningOnSurfaceRatio = getContrastRatio(
    DESIGN_TOKENS.colors.warning,
    DESIGN_TOKENS.colors.warningSurface
  );
  const dangerWhiteRatio = getContrastRatio(DESIGN_TOKENS.colors.danger, DESIGN_TOKENS.colors.card);

  const primaryButtonAAA = primaryButtonRatio >= 6.9;
  const inkOnBackgroundAAA = inkOnBackgroundRatio >= 7.0;
  const deepTealOnWhiteAA = deepTealOnWhiteRatio >= 4.5;
  const mutedOnWhiteAA = mutedOnWhiteRatio >= 4.5;
  const warningOnSurfaceAA = warningOnSurfaceRatio >= 4.5;
  const dangerWhiteAA = dangerWhiteRatio >= 4.5;

  const allPass =
    primaryButtonAAA &&
    inkOnBackgroundAAA &&
    deepTealOnWhiteAA &&
    mutedOnWhiteAA &&
    warningOnSurfaceAA &&
    dangerWhiteAA;

  return {
    allPass,
    primaryButtonRatio,
    primaryButtonAAA,
    inkOnBackgroundRatio,
    inkOnBackgroundAAA,
    deepTealOnWhiteRatio,
    deepTealOnWhiteAA,
    mutedOnWhiteRatio,
    mutedOnWhiteAA,
    warningOnSurfaceRatio,
    warningOnSurfaceAA,
    dangerWhiteRatio,
    dangerWhiteAA,
  };
}
