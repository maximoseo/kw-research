'use client';

import { useState } from 'react';
import { BarChart3, FileText, GanttChart, GitMerge, Radar } from 'lucide-react';
import type { ResearchProjectDetail } from '@/lib/research';
import ResearchDashboard from './ResearchDashboard';
import ContentGapAnalysis from './ContentGapAnalysis';
import ContentBriefGenerator from './ContentBriefGenerator';
import KeywordOverlapViz from './KeywordOverlapViz';

type DashboardTab = 'research' | 'gap-analysis' | 'overlap' | 'briefs';

const tabs: { id: DashboardTab; label: string; icon: React.ReactNode }[] = [
  { id: 'research', label: 'Research', icon: <Radar className="h-4 w-4" /> },
  { id: 'gap-analysis', label: 'Gap Analysis', icon: <GanttChart className="h-4 w-4" /> },
  { id: 'overlap', label: 'Overlap', icon: <GitMerge className="h-4 w-4" /> },
  { id: 'briefs', label: 'Briefs', icon: <FileText className="h-4 w-4" /> },
];

export default function ProjectDashboardView({ project }: { project: ResearchProjectDetail }) {
  const [activeTab, setActiveTab] = useState<DashboardTab>('research');

  return (
    <div className="min-w-0 space-y-6">
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
      {activeTab === 'research' && <ResearchDashboard project={project} />}
      {activeTab === 'gap-analysis' && (
        <ContentGapAnalysis
          projectId={project.id}
          userDomain={project.homepageUrl}
        />
      )}
      {activeTab === 'overlap' && (
        <KeywordOverlapViz projectId={project.id} />
      )}
      {activeTab === 'briefs' && (
        <ContentBriefGenerator projectId={project.id} />
      )}
    </div>
  );
}
