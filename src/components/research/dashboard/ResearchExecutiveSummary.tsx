'use client';

import { Card } from '@/components/ui';
import { TrendingUp, TableProperties } from 'lucide-react';
import { cn } from '@/lib/utils';

type SynthesisSnapshot = Record<string, unknown>;

export default function ResearchExecutiveSummary({ synthesis }: { synthesis: SynthesisSnapshot }) {
  const executiveSummary = synthesis.executiveSummary as SynthesisSnapshot | undefined;
  const metricsAnalysis = synthesis.metricsAnalysis as SynthesisSnapshot | undefined;
  const mainKeywordsTable = (synthesis.mainKeywordsTable as Array<SynthesisSnapshot> | undefined) ?? [];
  const keyInsights = (synthesis.keyInsights as string[] | undefined) ?? [];
  const contentStrategy = synthesis.contentStrategy as SynthesisSnapshot | undefined;
  const intentDistribution = synthesis.intentDistribution as SynthesisSnapshot | undefined;

  const volumeDist = (metricsAnalysis?.volumeDistribution as SynthesisSnapshot | undefined);
  const highVolumeCount = typeof volumeDist?.high === 'number' ? volumeDist.high : 0;
  const totalVolume = metricsAnalysis?.totalMonthlyVolume as number | undefined;
  const avgCpc = metricsAnalysis?.avgCpc as number | undefined;
  const highestVolKw = metricsAnalysis?.highestVolumeKeyword as string | undefined;
  const highestCpcKw = metricsAnalysis?.highestCpcKeyword as string | undefined;

  return (
    <div className="space-y-4">
      {executiveSummary && (
        <div className="rounded-lg border border-border/50 bg-surface-raised/60 p-5">
          <div className="flex items-center gap-2 mb-2.5">
            <TrendingUp className="h-4 w-4 text-accent" />
            <h3 className="text-heading-3 text-text-primary">
              {String(executiveSummary.title ?? 'Keyword Research Report')}
            </h3>
          </div>
          <p className="text-body text-text-secondary">{String(executiveSummary.subtitle ?? '')}</p>
          <div className="mt-2.5 flex flex-wrap gap-3 text-caption text-text-muted">
            <span>{String(executiveSummary.brandName ?? '')}</span>
            <span>·</span>
            <span>
              {String(executiveSummary.language ?? '')} · {String(executiveSummary.market ?? '')}
            </span>
            <span>·</span>
            <span>{String(executiveSummary.pillarCount ?? 0)} pillars</span>
            <span>·</span>
            <span>{String(executiveSummary.clusterCount ?? 0)} clusters</span>
          </div>
        </div>
      )}

      {metricsAnalysis && (
        <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
          <Card className="p-4 text-center">
            <p className="text-xl font-bold text-accent tabular-nums">
              {totalVolume != null ? totalVolume.toLocaleString() : '-'}
            </p>
            <p className="mt-1 text-caption text-text-muted">Total Monthly Volume</p>
            {highestVolKw && (
              <p className="mt-1 text-caption text-text-secondary truncate" title={highestVolKw}>
                Top: {highestVolKw}
              </p>
            )}
          </Card>
          <Card className="p-4 text-center">
            <p className="text-xl font-bold text-accent tabular-nums">
              {avgCpc != null ? `$${avgCpc.toFixed(2)}` : '-'}
            </p>
            <p className="mt-1 text-caption text-text-muted">Average CPC</p>
            {highestCpcKw && (
              <p className="mt-1 text-caption text-text-secondary truncate" title={highestCpcKw}>
                Top: {highestCpcKw}
              </p>
            )}
          </Card>
          <Card className="p-4 text-center">
            <p className="text-xl font-bold text-accent tabular-nums">
              {highVolumeCount > 0 ? highVolumeCount : '-'}
            </p>
            <p className="mt-1 text-caption text-text-muted">High-Volume Keywords</p>
            <p className="mt-1 text-caption text-text-secondary">&gt;1K monthly searches</p>
          </Card>
          <Card className="p-4 text-center">
            <p className="text-xl font-bold text-accent tabular-nums">{mainKeywordsTable.length}</p>
            <p className="mt-1 text-caption text-text-muted">Tracked Keywords</p>
            <p className="mt-1 text-caption text-text-secondary">with real volume &amp; CPC</p>
          </Card>
        </div>
      )}

      {mainKeywordsTable.length > 0 && (
        <div className="overflow-hidden rounded-lg border border-border/50 bg-surface-raised/60">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/50 px-4 py-2.5">
            <div className="flex items-center gap-2 text-body font-semibold text-text-primary">
              <TableProperties className="h-4 w-4 text-accent" />
              Main Keywords — Volume &amp; CPC
            </div>
            <span className="text-caption text-text-muted">{mainKeywordsTable.length} keywords</span>
          </div>
          <div className="max-h-[400px] overflow-x-auto overflow-y-auto">
            <table className="min-w-[600px] w-full text-left">
              <thead className="sticky top-0 z-10 bg-surface-raised shadow-[0_1px_0_hsl(var(--border)/0.5)]">
                <tr className="text-text-muted">
                  {['Keyword', 'Volume', 'CPC', 'Intent', 'Pillar', 'Priority'].map((label) => (
                    <th
                      key={label}
                      className="px-2.5 py-2.5 text-caption font-semibold uppercase tracking-wider whitespace-nowrap sm:px-3.5"
                    >
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border/30">
                {mainKeywordsTable.slice(0, 30).map((row, index) => (
                  <tr
                    key={`${String(row.keyword)}-${index}`}
                    className={cn(
                      'align-top transition-colors hover:bg-accent/[0.02]',
                      index % 2 === 1 && 'bg-surface-inset/30',
                    )}
                  >
                    <td
                      className="max-w-[180px] truncate px-2.5 py-2.5 font-medium text-text-primary sm:px-3.5 md:max-w-[240px]"
                      title={String(row.keyword ?? '')}
                    >
                      {String(row.keyword ?? '')}
                    </td>
                    <td className="px-2.5 py-2.5 font-mono text-body-sm text-text-secondary tabular-nums sm:px-3.5">
                      {row.searchVolume != null ? Number(row.searchVolume).toLocaleString() : '-'}
                    </td>
                    <td className="px-2.5 py-2.5 font-mono text-body-sm text-text-secondary tabular-nums sm:px-3.5">
                      {row.cpc != null ? `$${Number(row.cpc).toFixed(2)}` : '-'}
                    </td>
                    <td className="px-2.5 py-2.5 sm:px-3.5">
                      <span
                        className={cn(
                          'inline-block rounded-md px-2 py-0.5 text-caption font-medium',
                          String(row.intent) === 'Informational' && 'bg-info/[0.08] text-info',
                          String(row.intent) === 'Commercial' && 'bg-warning/[0.08] text-warning',
                          String(row.intent) === 'Transactional' && 'bg-success/[0.08] text-success',
                          String(row.intent) === 'Navigational' && 'bg-accent/[0.08] text-accent',
                        )}
                      >
                        {String(row.intent ?? '')}
                      </span>
                    </td>
                    <td className="max-w-[120px] truncate px-2.5 py-2.5 text-body-sm text-text-secondary sm:px-3.5">
                      {String(row.pillar ?? '')}
                    </td>
                    <td className="px-2.5 py-2.5 text-body-sm text-text-secondary sm:px-3.5">
                      {String(row.priority ?? '')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {keyInsights.length > 0 && (
        <div className="rounded-lg border border-border/50 bg-surface-raised/60 p-5">
          <h3 className="text-heading-3 text-text-primary mb-3">Key Insights</h3>
          <ul className="space-y-2">
            {keyInsights.map((insight, index) => (
              <li key={index} className="flex items-start gap-2 text-body text-text-secondary">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
                {insight}
              </li>
            ))}
          </ul>
        </div>
      )}

      {contentStrategy && (
        <div className="rounded-lg border border-border/50 bg-surface-raised/60 p-5">
          <h3 className="text-heading-3 text-text-primary mb-3">Content Strategy</h3>
          <p className="text-body text-text-secondary">{String(contentStrategy.overview ?? '')}</p>
        </div>
      )}

      {intentDistribution && (
        <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
          {Object.entries(intentDistribution).map(([intent, count]) => (
            <div
              key={intent}
              className="rounded-lg border border-border/50 bg-surface-raised/60 p-3 text-center"
            >
              <p className="text-heading-3 text-accent tabular-nums">{String(count)}</p>
              <p className="mt-0.5 text-caption text-text-muted">{intent}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
