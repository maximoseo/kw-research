'use client';

import { useCallback, useEffect, useState } from 'react';
import { FileText, GanttChart, GitMerge, Globe, LayoutDashboard, Radar, ShieldAlert } from 'lucide-react';
import type { ResearchProjectDetail } from '@/lib/research';
import { cn } from '@/lib/utils';
import { Button, Card, Tabs } from '@/components/ui';
import ResearchDashboard from './ResearchDashboard';
import ProjectOverview from './project/ProjectOverview';
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

type DashboardTab = 'overview' | 'research' | 'gap-analysis' | 'overlap' | 'cannibalization' | 'briefs';

const tabs: { id: DashboardTab; label: string; icon: React.ReactNode }[] = [
  { id: 'overview', label: 'Overview', icon: <LayoutDashboard className="h-4 w-4" /> },
  { id: 'research', label: 'Research', icon: <Radar className="h-4 w-4" /> },
  { id: 'gap-analysis', label: 'Gap Analysis', icon: <GanttChart className="h-4 w-4" /> },
  { id: 'overlap', label: 'Overlap', icon: <GitMerge className="h-4 w-4" /> },
  { id: 'cannibalization', label: 'Cannibalization', icon: <ShieldAlert className="h-4 w-4" /> },
  { id: 'briefs', label: 'Briefs', icon: <FileText className="h-4 w-4" /> },
];

export default function ProjectDashboardView({ project }: { project: ResearchProjectDetail }) {
  const [activeTab, setActiveTab] = useState<DashboardTab>('overview');
  const [userDomain, setUserDomain] = useState('');
  const [domainInputValue, setDomainInputValue] = useState('');
  const [domainOpen, setDomainOpen] = useState(false);

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

          <div className="flex items-center gap-3">
            {/* Domain toolbar popover */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setDomainOpen(!domainOpen)}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-body-sm font-medium transition-all min-h-[34px]',
                  userDomain
                    ? 'border-accent/25 bg-accent/[0.06] text-accent'
                    : 'border-border/40 bg-surface-raised/60 text-text-muted hover:border-accent/20 hover:text-text-secondary',
                )}
                aria-label="Set personal domain"
              >
                <Globe className="h-3.5 w-3.5 shrink-0" />
                <span className="hidden sm:inline max-w-[140px] truncate">
                  {userDomain || 'Domain'}
                </span>
              </button>
              {domainOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setDomainOpen(false)} />
                  <div className="absolute right-0 top-full z-20 mt-1.5 w-[280px] rounded-xl border border-border/60 bg-surface p-3 shadow-elevation-2 animate-fade-in">
                    <p className="text-caption font-medium text-text-secondary mb-2">Personal difficulty domain</p>
                    <div className="flex gap-1.5">
                      <div className="relative flex-1">
                        <Globe className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-text-muted" />
                        <input
                          type="text"
                          className="field-input min-w-0 w-full pl-8 text-body-sm"
                          placeholder="example.com"
                          value={domainInputValue}
                          onChange={(e) => setDomainInputValue(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') { handleDomainSave(); setDomainOpen(false); }
                          }}
                        />
                      </div>
                      <Button type="button" size="sm" onClick={() => { handleDomainSave(); setDomainOpen(false); }}>Set</Button>
                    </div>
                    {userDomain && (
                      <button
                        type="button"
                        onClick={() => { handleDomainClear(); setDomainOpen(false); }}
                        className="mt-1.5 text-caption text-text-muted hover:text-destructive transition-colors"
                      >
                        Clear domain
                      </button>
                    )}
                  </div>
                </>
              )}
            </div>

            <Tabs
              tabs={tabs.map(t => ({ id: t.id, label: t.label, icon: t.icon }))}
              activeTab={activeTab}
              onChange={(id) => setActiveTab(id as DashboardTab)}
            />
          </div>
        </div>
      </Card>

      {/* Tab content */}
      {activeTab === 'overview' && (
        <ProjectOverview
          project={project}
          onCreateRun={() => setActiveTab('research')}
          onSelectRun={(runId) => {
            setActiveTab('research');
            // Set initial run via search params
            const url = new URL(window.location.href);
            url.searchParams.set('runId', runId);
            window.history.replaceState({}, '', url.toString());
            window.location.reload();
          }}
        />
      )}
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
