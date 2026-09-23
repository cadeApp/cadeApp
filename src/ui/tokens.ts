export const DESIGN_TOKENS = {
  colors: {
    primary: '#09BABD',
    primaryDark: '#0B7A7D',
    ink: '#12182C',
    background: '#FDFCFB',
    surface: '#FFFFFF',
    muted: '#F3F4F6',
    mutedForeground: '#5B6475',
    border: '#E4E7EC',
    accent: '#F0FDF4',
    success: '#177A4B',
    warning: '#B45309',
    warningSurface: '#FFF4E0',
    danger: '#C62828',
  },
  fonts: {
    display: 'Montserrat',
    sans: 'Inter',
    mono: 'JetBrains Mono',
  },
  radii: {
    controlPx: 10,
    cardPx: 12,
    pillPx: 9999,
  },
  touchTargets: {
    minHeightPx: 48,
    ctaHeightPx: 52,
    offerQuickButtonHeightPx: 48,
  },
  typography: {
    minFontSizePx: 14,
    minFontSizeRem: '0.875rem',
  },
} as const;

function parseHexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace('#', '').trim();
  if (clean.length !== 6) {
    throw new Error(`Invalid hex color: ${hex}`);
  }
  const num = Number.parseInt(clean, 16);
  return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
}

function channelToLinear(channel: number): number {
  const sRgb = channel / 255;
  return sRgb <= 0.03928 ? sRgb / 12.92 : ((sRgb + 0.055) / 1.055) ** 2.4;
}

export function getRelativeLuminance(hex: string): number {
  const [r, g, b] = parseHexToRgb(hex);
  const R = channelToLinear(r);
  const G = channelToLinear(g);
  const B = channelToLinear(b);
  return 0.2126 * R + 0.7152 * G + 0.0722 * B;
}

export function getContrastRatio(foregroundHex: string, backgroundHex: string): number {
  const lum1 = getRelativeLuminance(foregroundHex);
  const lum2 = getRelativeLuminance(backgroundHex);
  const brightest = Math.max(lum1, lum2);
  const darkest = Math.min(lum1, lum2);
  return Number(((brightest + 0.05) / (darkest + 0.05)).toFixed(2));
}

export interface TokenContrastReport {
  primaryButtonAAA: boolean;
  secondaryButtonAAA: boolean;
  primaryTextLinkAA: boolean;
  bodyTextAAA: boolean;
  mutedTextAA: boolean;
  mutedBadgeAA: boolean;
  successBadgeAA: boolean;
  badgeSuccessAA: boolean;
  warningBadgeAA: boolean;
  dangerBadgeAA: boolean;
}

export function verifyTokenContrastMatrix(): TokenContrastReport {
  const c = DESIGN_TOKENS.colors;
  return {
    primaryButtonAAA: getContrastRatio(c.ink, c.primary) >= 7.0,
    secondaryButtonAAA: getContrastRatio(c.surface, c.ink) >= 7.0,
    primaryTextLinkAA: getContrastRatio(c.primaryDark, c.surface) >= 4.5,
    bodyTextAAA: getContrastRatio(c.ink, c.background) >= 15.0,
    mutedTextAA: getContrastRatio(c.mutedForeground, c.surface) >= 4.5,
    mutedBadgeAA: getContrastRatio(c.mutedForeground, c.muted) >= 4.5,
    successBadgeAA: getContrastRatio(c.surface, c.success) >= 4.5,
    badgeSuccessAA: getContrastRatio(c.success, c.accent) >= 4.5,
    warningBadgeAA: getContrastRatio(c.warning, c.warningSurface) >= 4.5,
    dangerBadgeAA: getContrastRatio(c.surface, c.danger) >= 4.5,
  };
}
