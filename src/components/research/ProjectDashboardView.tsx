'use client';

import { useCallback, useEffect, useState } from 'react';
import { FileText, GanttChart, GitMerge, Globe, Radar, Settings2, ShieldAlert } from 'lucide-react';
import type { ResearchProjectDetail } from '@/lib/research';
import { Button, Card, Tabs } from '@/components/ui';
import ResearchDashboard from './ResearchDashboard';
import ContentGapAnalysis from './ContentGapAnalysis';
import ContentBriefGenerator from './ContentBriefGenerator';
import KeywordOverlapViz from './KeywordOverlapViz';
import CannibalizationReport from './CannibalizationReport';

const DOMAIN_STORAGE_KEY = 'kw-research:user-domain';

function loadSavedDomain(): string {
  if (typeof window === 'undefined') return '';
  try {
    return localStorage.getItem(DOMAIN_STORAGE_KEY) || '';
  } catch {
    return '';
  }
}

function saveDomain(domain: string) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(DOMAIN_STORAGE_KEY, domain);
  } catch {
    /* quota exceeded */
  }
}

type DashboardTab = 'research' | 'gap-analysis' | 'overlap' | 'cannibalization' | 'briefs';

const tabs: { id: DashboardTab; label: string; icon: React.ReactNode }[] = [
  { id: 'research', label: 'Research', icon: <Radar className="h-4 w-4" /> },
  { id: 'gap-analysis', label: 'Gap Analysis', icon: <GanttChart className="h-4 w-4" /> },
  { id: 'overlap', label: 'Overlap', icon: <GitMerge className="h-4 w-4" /> },
  { id: 'cannibalization', label: 'Cannibalization', icon: <ShieldAlert className="h-4 w-4" /> },
  { id: 'briefs', label: 'Briefs', icon: <FileText className="h-4 w-4" /> },
];

export default function ProjectDashboardView({ project }: { project: ResearchProjectDetail }) {
  const [activeTab, setActiveTab] = useState<DashboardTab>('research');
  const [userDomain, setUserDomain] = useState('');
  const [domainInputValue, setDomainInputValue] = useState('');

  // Load saved domain on mount
  useEffect(() => {
    const saved = loadSavedDomain();
    if (saved) {
      setUserDomain(saved);
      setDomainInputValue(saved);
    }
  }, []);

  const handleDomainSave = useCallback(() => {
    const cleaned = domainInputValue.trim().replace(/^https?:\/\//, '').replace(/\/$/, '');
    setUserDomain(cleaned);
    setDomainInputValue(cleaned);
    saveDomain(cleaned);
  }, [domainInputValue]);

  const handleDomainClear = useCallback(() => {
    setUserDomain('');
    setDomainInputValue('');
    saveDomain('');
  }, []);

  return (
    <div className="min-w-0 space-y-5">
      <Card className="space-y-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-2">
            <p className="eyebrow">Project workspace</p>
            <div>
              <h1 className="text-heading-1">{project.name}</h1>
              <p className="mt-1 text-body text-text-secondary">
                {project.brandName} · {project.market} · {project.language}
              </p>
            </div>
          </div>

          <div className="rounded-xl border border-border/50 bg-surface-raised/50 px-4 py-3 lg:min-w-[340px]">
            <div className="mb-2 flex items-center gap-2">
              <Settings2 className="h-4 w-4 text-text-muted" />
              <p className="text-caption font-medium text-text-secondary">Personal difficulty domain</p>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <div className="relative flex-1">
                <Globe className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
                <input
                  type="text"
                  className="field-input min-w-0 w-full pl-9 text-body-sm"
                  placeholder="e.g. example.com"
                  value={domainInputValue}
                  onChange={(e) => setDomainInputValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleDomainSave();
                  }}
                />
              </div>
              <Button type="button" size="sm" onClick={handleDomainSave}>Set</Button>
              {userDomain && (
                <Button type="button" size="sm" variant="ghost" onClick={handleDomainClear}>Clear</Button>
              )}
            </div>
            <p className="mt-2 text-caption text-text-muted">
              {userDomain ? `Active domain: ${userDomain}` : 'Set your domain to unlock personal difficulty insights.'}
            </p>
          </div>
        </div>

        <Tabs
          tabs={tabs.map(t => ({ id: t.id, label: t.label, icon: t.icon }))}
          activeTab={activeTab}
          onChange={(id) => setActiveTab(id as DashboardTab)}
        />
      </Card>

      {/* Tab content */}
      {activeTab === 'research' && <ResearchDashboard project={project} userDomain={userDomain} />}
      {activeTab === 'gap-analysis' && (
        <ContentGapAnalysis
          projectId={project.id}
          userDomain={userDomain || project.homepageUrl}
        />
      )}
      {activeTab === 'overlap' && (
        <KeywordOverlapViz projectId={project.id} />
      )}
      {activeTab === 'cannibalization' && (
        <CannibalizationReport projectId={project.id} />
      )}
      {activeTab === 'briefs' && (
        <ContentBriefGenerator projectId={project.id} />
      )}
    </div>
  );
}
