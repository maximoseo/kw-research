export type SiteLanguage = 'English' | 'Hebrew';
export type ResearchMode = 'fresh' | 'expand';
export type ResearchStatus = 'queued' | 'processing' | 'completed' | 'failed';
export type ResearchIntent = 'Informational' | 'Commercial' | 'Transactional' | 'Navigational';

export type ResearchInputSnapshot = {
  homepageUrl: string;
  aboutUrl: string;
  sitemapUrl: string;
  brandName: string;
  language: SiteLanguage;
  market: string;
  competitorUrls: string[];
  notes: string;
  targetRows: number;
  mode: ResearchMode;
  existingResearchSummary?: UploadedResearchSummary | null;
};

export type ResearchRow = {
  existingParentPage: string;
  existingParentPageUrl?: string | null;
  pillar: string;
  cluster: string;
  intent: ResearchIntent;
  primaryKeyword: string;
  keywords: string[];
  rowType: 'pillar' | 'cluster';
  slugPath: string;
  notes?: string[];
};

export type UploadedResearchSummary = {
  sheetName: string;
  rowCount: number;
  pillars: string[];
  clusters: string[];
  primaryKeywords: string[];
  keywordFingerprints: string[];
};

export type ResearchRunLog = {
  id: string;
  runId: string;
  stage: string;
  level: 'info' | 'warning' | 'error';
  message: string;
  metadata?: Record<string, unknown> | null;
  createdAt: number;
};

export type ResearchProjectSummary = {
  id: string;
  name: string;
  brandName: string;
  language: SiteLanguage;
  market: string;
  homepageUrl: string;
  aboutUrl: string;
  sitemapUrl: string;
  competitorUrls: string[];
  notes: string;
  createdAt: number;
  updatedAt: number;
  runCount: number;
  latestRunId: string | null;
  latestRunStatus: ResearchStatus | null;
  latestRunQueuedAt: number | null;
  latestRunCompletedAt: number | null;
};

export type ResearchProjectDetail = ResearchProjectSummary;

export type ResearchRunSummary = {
  id: string;
  projectId: string;
  projectName: string;
  brandName: string;
  language: SiteLanguage;
  market: string;
  mode: ResearchMode;
  status: ResearchStatus;
  step: string | null;
  targetRows: number;
  queuedAt: number;
  completedAt: number | null;
  workbookName: string | null;
  errorMessage: string | null;
};

export type ResearchRunDetail = ResearchRunSummary & {
  input: ResearchInputSnapshot;
  rows: ResearchRow[];
  logs: ResearchRunLog[];
  siteSnapshot?: Record<string, unknown> | null;
  competitorSnapshot?: Record<string, unknown> | null;
  resultSummary?: Record<string, unknown> | null;
  uploadedFileId?: string | null;
};
