/**
 * Centralised chart colour palette.
 * All values reference CSS custom properties so they automatically
 * respond to light / dark theme switches.
 */
export const chartTheme = {
  series: [
    'hsl(var(--chart-1))',
    'hsl(var(--chart-2))',
    'hsl(var(--chart-3))',
    'hsl(var(--chart-4))',
  ],
  positive: 'hsl(var(--success))',
  negative: 'hsl(var(--destructive))',
  neutral: 'hsl(var(--text-muted))',
  overlap: 'hsl(var(--chart-overlap))',
  grid: 'hsl(var(--border))',
  tooltip: {
    bg: 'hsl(var(--surface-raised))',
    border: 'hsl(var(--border))',
    text: 'hsl(var(--text-primary))',
    muted: 'hsl(var(--text-muted))',
  },
} as const;

export type ChartTheme = typeof chartTheme;
