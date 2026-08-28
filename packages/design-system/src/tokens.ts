export const dazatTokens = Object.freeze({
  color: {
    brand: '#81D8D0',
    canvas: '#FFFFFF',
    textPrimary: '#000000',
    textMuted: '#4A4A4A',
    neutral: '#BDBDBD',
    surface: '#F4F4F4',
    border: '#D4D4D4',
    danger: '#C62828'
  },
  spacing: {
    1: 4,
    2: 8,
    3: 12,
    4: 16,
    5: 20,
    6: 24,
    8: 32,
    10: 40
  },
  radius: {
    input: 4,
    button: 6,
    card: 12,
    sheet: 16
  },
  motion: {
    interactiveMs: 200
  },
  typography: {
    family: 'Inter',
    fallback: 'system-ui'
  }
} as const);
