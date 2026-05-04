'use client';

import { useCallback, useEffect, useState } from 'react';
import { BarChart3, FileText, GanttChart, GitMerge, Globe, Radar, ShieldAlert } from 'lucide-react';
import type { ResearchProjectDetail } from '@/lib/research';
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
    <div className="min-w-0 space-y-6">
      {/* Domain input bar */}
      <div className="flex items-center gap-3 rounded-xl border border-border/50 bg-surface-raised/40 px-4 py-2.5">
        <Globe className="h-4 w-4 text-text-muted shrink-0" />
        <label className="text-body-sm font-medium text-text-secondary whitespace-nowrap">
          Your domain:
        </label>
        <div className="flex items-center gap-2 flex-1">
          <input
            type="text"
            className="field-input flex-1 max-w-sm text-body-sm"
            placeholder="e.g. example.com"
            value={domainInputValue}
            onChange={(e) => setDomainInputValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleDomainSave();
            }}
          />
          <button
            type="button"
            className="rounded-md px-3 py-1 text-caption font-medium bg-accent text-white hover:bg-accent/90 transition-colors"
            onClick={handleDomainSave}
          >
            Set
          </button>
          {userDomain && (
            <button
              type="button"
              className="rounded-md px-2 py-1 text-caption text-text-muted hover:text-red-500 transition-colors"
              onClick={handleDomainClear}
            >
              Clear
            </button>
          )}
        </div>
        {userDomain && (
          <span className="text-caption text-accent font-medium whitespace-nowrap">
            ✓ {userDomain}
          </span>
        )}
        {!userDomain && (
          <span className="text-caption text-text-muted whitespace-nowrap">
            Set to see personal difficulty
          </span>
        )}
      </div>

      {/* Tab bar */}
      <div className="flex items-center gap-1 rounded-xl border border-border/50 bg-surface-raised/40 p-1 w-fit">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-body-sm font-semibold transition-all duration-150 ${
              activeTab === tab.id
                ? 'bg-surface text-text-primary shadow-[0_1px_3px_rgba(0,0,0,0.08)] ring-1 ring-border/30'
                : 'text-text-muted hover:text-text-secondary hover:bg-surface-raised'
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

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
