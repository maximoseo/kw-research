'use client';

import { useCallback, useEffect, useState } from 'react';
import { BarChart3, FileText, GanttChart, GitMerge, Globe, Radar, ShieldAlert } from 'lucide-react';
import type { ResearchProjectDetail } from '@/lib/research';
import { Tabs } from '@/components/ui';
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
      {/* Domain input bar */}
      <div className="flex flex-col gap-2.5 rounded-xl border border-border/50 bg-surface-raised/40 px-4 py-3 sm:flex-row sm:items-center sm:gap-3 sm:py-2.5">
        <div className="flex items-center gap-2 shrink-0">
          <Globe className="h-4 w-4 text-text-muted shrink-0" />
          <label className="text-body-sm font-medium text-text-secondary whitespace-nowrap">
            Your domain:
          </label>
        </div>
        <div className="flex flex-1 items-center gap-2">
          <input
            type="text"
            className="field-input min-w-0 flex-1 text-body-sm"
            placeholder="e.g. example.com"
            value={domainInputValue}
            onChange={(e) => setDomainInputValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleDomainSave();
            }}
          />
          <button
            type="button"
            className="min-h-tap shrink-0 rounded-lg px-3 py-2 text-caption font-semibold bg-accent text-white hover:bg-accent-hover transition-colors"
            onClick={handleDomainSave}
          >
            Set
          </button>
          {userDomain && (
            <button
              type="button"
              className="min-h-tap shrink-0 rounded-lg px-2 py-2 text-caption text-text-muted hover:text-destructive transition-colors"
              onClick={handleDomainClear}
            >
              Clear
            </button>
          )}
        </div>
        {userDomain ? (
          <span className="text-caption text-success font-medium whitespace-nowrap">
            ✓ {userDomain}
          </span>
        ) : (
          <span className="hidden text-caption text-text-muted whitespace-nowrap sm:block">
            Set to see personal difficulty
          </span>
        )}
      </div>

      {/* Tab bar — icons on mobile, labels on sm+ */}
      <Tabs
        tabs={tabs.map(t => ({ id: t.id, label: t.label, icon: t.icon }))}
        activeTab={activeTab}
        onChange={(id) => setActiveTab(id as DashboardTab)}
      />

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
