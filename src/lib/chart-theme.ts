/**
 * chart-theme.ts — Canonical chart color theme for kw-research.
 *
 * Every chart/rechart component MUST import from here instead of
 * hardcoding any hex, rgb, or hsl values. The underlying CSS variables
 * live in `src/app/globals.css` and support both light and dark themes.
 *
 * Usage:
 *   import { chartTheme } from '@/lib/chart-theme';
 *   // recharts: stroke={chartTheme.series[0]}
 *   // tailwind fill: className={`fill-[hsl(var(--chart-1))]`}
 *   // inline style: style={{ color: `hsl(${chartTheme.cssVars['--chart-1']})` }}
 */

export const chartTheme = {
  /** Series colors — use series[0] for primary, [1] for secondary, etc. */
  series: [
    'hsl(var(--chart-1))',
    'hsl(var(--chart-2))',
    'hsl(var(--chart-3))',
    'hsl(var(--chart-4))',
    'hsl(var(--chart-5))',
    'hsl(var(--chart-6))',
  ],

  /** Overlap / intersection color */
  overlap: 'hsl(var(--chart-overlap))',

  /** Semantic scales */
  positive: 'hsl(var(--success))',
  negative: 'hsl(var(--destructive))',
  neutral: 'hsl(var(--text-muted))',
  warning: 'hsl(var(--warning))',
  info: 'hsl(var(--info))',

  /** Raw CSS variable values for inline styles (e.g., recharts config objects) */
  cssVars: {
    '--chart-1': 'var(--chart-1)',
    '--chart-2': 'var(--chart-2)',
    '--chart-3': 'var(--chart-3)',
    '--chart-4': 'var(--chart-4)',
    '--chart-5': 'var(--chart-5)',
    '--chart-6': 'var(--chart-6)',
    '--chart-overlap': 'var(--chart-overlap)',
    '--success': 'var(--success)',
    '--destructive': 'var(--destructive)',
    '--warning': 'var(--warning)',
    '--info': 'var(--info)',
  },
} as const;

export type ChartTheme = typeof chartTheme;
