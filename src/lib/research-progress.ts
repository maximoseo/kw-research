import type { ResearchRunDetail } from '@/lib/research';

export type ResearchProcessStepId =
  | 'queued'
  | 'crawl'
  | 'analysis'
  | 'competitors'
  | 'pillars'
  | 'clusters'
  | 'qa'
  | 'export';

export type ResearchProcessStepState = 'complete' | 'current' | 'upcoming' | 'failed';

export const RESEARCH_PROCESS_STEPS: Array<{
  id: ResearchProcessStepId;
  label: string;
  description: string;
}> = [
  {
    id: 'queued',
    label: 'Queued',
    description: 'The job is stored and waiting for the research worker to pick it up.',
  },
  {
    id: 'crawl',
    label: 'Site crawl',
    description: 'Fetching the sitemap, homepage, about page, and core site evidence.',
  },
  {
    id: 'analysis',
    label: 'Website analysis',
    description: 'Understanding the business, audience, coverage, and market context.',
  },
  {
    id: 'competitors',
    label: 'Competitor discovery',
    description: 'Finding relevant competitors and extracting useful opportunity themes.',
  },
  {
    id: 'pillars',
    label: 'Pillar planning',
    description: 'Generating non-overlapping pillar opportunities for the research output.',
  },
  {
    id: 'clusters',
    label: 'Cluster generation',
    description: 'Building cluster ideas under each pillar while avoiding cannibalization.',
  },
  {
    id: 'qa',
    label: 'QA checks',
    description: 'Validating row structure, deduplicating output, and normalizing brand order.',
  },
  {
    id: 'export',
    label: 'Excel export',
    description: 'Building, verifying, and storing the final workbook for download.',
  },
];

const PROCESS_STAGE_TO_STEP: Record<string, ResearchProcessStepId | undefined> = {
  crawl: 'crawl',
  analysis: 'analysis',
  competitors: 'competitors',
  pillars: 'pillars',
  clusters: 'clusters',
  qa: 'qa',
  export: 'export',
};

type RunLike = Pick<ResearchRunDetail, 'status' | 'logs' | 'step' | 'errorMessage' | 'workbookName'>;

function getCurrentStepId(run: RunLike): ResearchProcessStepId {
  if (run.status === 'queued') {
    return 'queued';
  }

  const lastTrackedStep = [...run.logs]
    .reverse()
    .map((entry) => PROCESS_STAGE_TO_STEP[entry.stage])
    .find(Boolean);

  return lastTrackedStep ?? 'queued';
}

export function deriveResearchProcess(run: RunLike) {
  const currentStepId = getCurrentStepId(run);
  const currentIndex = RESEARCH_PROCESS_STEPS.findIndex((step) => step.id === currentStepId);
  const steps = RESEARCH_PROCESS_STEPS.map((step, index) => {
    if (run.status === 'completed') {
      return { ...step, state: 'complete' as const };
    }

    if (index < currentIndex) {
      return { ...step, state: 'complete' as const };
    }

    if (index === currentIndex) {
      return {
        ...step,
        state: (run.status === 'failed' ? 'failed' : 'current') as ResearchProcessStepState,
      };
    }

    return { ...step, state: 'upcoming' as const };
  });

  const completedCount = steps.filter((step) => step.state === 'complete').length;
  const currentStep = steps[currentIndex] ?? steps[0];

  const headline =
    run.status === 'completed'
      ? 'Research complete'
      : run.status === 'failed'
        ? 'Research failed'
        : run.status === 'processing'
          ? `${currentStep.label} in progress`
          : 'Queued for processing';

  return {
    headline,
    currentStep,
    currentStepId,
    completedCount,
    totalSteps: RESEARCH_PROCESS_STEPS.length,
    progressPercent:
      run.status === 'completed'
        ? 100
        : Math.round((completedCount / RESEARCH_PROCESS_STEPS.length) * 100),
    steps,
    status: run.status,
    helperText:
      run.status === 'failed'
        ? run.errorMessage || run.step || 'The research run stopped before the workbook was created.'
        : run.status === 'completed'
          ? run.workbookName
            ? `Workbook ready: ${run.workbookName}`
            : 'Workbook verified and ready to download.'
          : run.step || currentStep.description,
  };
}
