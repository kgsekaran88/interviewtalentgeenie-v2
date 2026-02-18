/**
 * Design Token Utilities
 * Reads CSS variables from the design system and converts them for use in exports (Word, PDF, etc.)
 */

/**
 * Convert HSL values to Hex color string
 * @param h - Hue (0-360)
 * @param s - Saturation (0-100)
 * @param l - Lightness (0-100)
 * @returns Hex color string without # prefix (e.g., "6366F1")
 */
export function hslToHex(h: number, s: number, l: number): string {
  s /= 100;
  l /= 100;

  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs((h / 60) % 2 - 1));
  const m = l - c / 2;
  let r = 0, g = 0, b = 0;

  if (0 <= h && h < 60) {
    r = c; g = x; b = 0;
  } else if (60 <= h && h < 120) {
    r = x; g = c; b = 0;
  } else if (120 <= h && h < 180) {
    r = 0; g = c; b = x;
  } else if (180 <= h && h < 240) {
    r = 0; g = x; b = c;
  } else if (240 <= h && h < 300) {
    r = x; g = 0; b = c;
  } else if (300 <= h && h < 360) {
    r = c; g = 0; b = x;
  }

  const toHex = (n: number) => {
    const hex = Math.round((n + m) * 255).toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  };

  return `${toHex(r)}${toHex(g)}${toHex(b)}`.toUpperCase();
}

/**
 * Parse CSS HSL variable value (e.g., "239 84% 67%") to h, s, l numbers
 */
function parseHSL(hslString: string): { h: number; s: number; l: number } | null {
  // Handle format: "239 84% 67%" or "239, 84%, 67%"
  const cleaned = hslString.replace(/%/g, '').replace(/,/g, ' ');
  const parts = cleaned.trim().split(/\s+/).map(Number);
  
  if (parts.length >= 3 && parts.every(n => !isNaN(n))) {
    return { h: parts[0], s: parts[1], l: parts[2] };
  }
  return null;
}

/**
 * Get a CSS variable value from the document
 */
function getCSSVariable(name: string): string {
  if (typeof document === 'undefined') return '';
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

/**
 * Get a design token color as Hex (without # prefix)
 * @param tokenName - CSS variable name without -- prefix (e.g., "primary", "success")
 * @returns Hex color string (e.g., "6366F1")
 */
export function getTokenHex(tokenName: string): string {
  const value = getCSSVariable(`--${tokenName}`);
  const hsl = parseHSL(value);
  
  if (hsl) {
    return hslToHex(hsl.h, hsl.s, hsl.l);
  }
  
  // Fallback colors if parsing fails
  const fallbacks: Record<string, string> = {
    'primary': '6366F1',
    'primary-foreground': 'FFFFFF',
    'secondary': 'F4F4F5',
    'secondary-foreground': '18181B',
    'success': '22C55E',
    'success-foreground': 'FFFFFF',
    'warning': 'F59E0B',
    'warning-foreground': '1E1E1E',
    'destructive': 'EF4444',
    'destructive-foreground': 'FFFFFF',
    'muted': 'F4F4F5',
    'muted-foreground': '71717A',
    'foreground': '18181B',
    'background': 'FAFAFA',
    'card': 'FFFFFF',
    'card-foreground': '18181B',
    'border': 'E4E4E7',
    'accent': 'A855F7',
    'accent-foreground': '18181B',
  };
  
  return fallbacks[tokenName] || '000000';
}

/**
 * Get all design tokens as hex colors for Word/PDF export
 */
export function getExportColors() {
  return {
    primary: getTokenHex('primary'),
    primaryForeground: getTokenHex('primary-foreground'),
    secondary: getTokenHex('secondary'),
    secondaryForeground: getTokenHex('secondary-foreground'),
    success: getTokenHex('success'),
    successForeground: getTokenHex('success-foreground'),
    warning: getTokenHex('warning'),
    warningForeground: getTokenHex('warning-foreground'),
    destructive: getTokenHex('destructive'),
    destructiveForeground: getTokenHex('destructive-foreground'),
    muted: getTokenHex('muted'),
    mutedForeground: getTokenHex('muted-foreground'),
    foreground: getTokenHex('foreground'),
    background: getTokenHex('background'),
    card: getTokenHex('card'),
    cardForeground: getTokenHex('card-foreground'),
    border: getTokenHex('border'),
    accent: getTokenHex('accent'),
    accentForeground: getTokenHex('accent-foreground'),
  };
}

/**
 * Get decision-specific colors based on hiring decision
 */
export function getDecisionColors(decision: string) {
  const colors = getExportColors();
  
  switch (decision) {
    case 'strong_hire':
      return { bg: colors.success, fg: colors.successForeground };
    case 'hire':
      return { bg: colors.primary, fg: colors.primaryForeground };
    case 'consider':
      return { bg: colors.warning, fg: colors.warningForeground };
    case 'reject':
      return { bg: colors.destructive, fg: colors.destructiveForeground };
    default:
      return { bg: colors.secondary, fg: colors.secondaryForeground };
  }
}
