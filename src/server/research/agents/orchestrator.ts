'use strict';

import { z } from 'zod';
import type { ResearchInputSnapshot, SiteLanguage } from '@/lib/research';
import { callAiJson } from '../ai';
import type { ModelTier } from '../ai';

const agentResultSchema = z.object({
  agentId: z.string(),
  agentRole: z.string(),
  status: z.enum(['success', 'error', 'skipped']),
  output: z.record(z.unknown()).optional(),
  error: z.string().optional(),
  reasoning: z.string().optional(),
  modelUsed: z.string().optional(),
  durationMs: z.number().optional(),
  suggestions: z.array(z.string()).optional(),
  warnings: z.array(z.string()).optional(),
});

const swarmPlanSchema = z.object({
  phases: z.array(
    z.object({
      phaseId: z.string(),
      phaseLabel: z.string(),
      tasks: z.array(
        z.object({
          taskId: z.string(),
          taskLabel: z.string(),
          agentRole: z.string(),
          modelTier: z.enum(['opus', 'sonnet', 'haiku']),
          parallelGroup: z.string().nullable(),
          dependsOn: z.array(z.string()).default([]),
          priority: z.number().min(1).max(10).default(5),
          input: z.record(z.unknown()),
        }),
      ),
    }),
  ),
  orchestration: z.object({
    synthesisModel: z.enum(['opus', 'sonnet']),
    fallbackEnabled: z.boolean(),
    maxParallelTasks: z.number().min(1).max(10).default(3),
  }),
});

const agentResponseSchema = z.object({
  agentResults: z.array(agentResultSchema),
  synthesis: z.record(z.unknown()),
  executionPlan: z.record(z.array(z.string())).default({}),
});

const reasoningSchema = z.object({
  plan: z.string(),
  reasoning: z.string(),
  modelRecommendations: z.record(z.enum(['opus', 'sonnet', 'haiku'])),
  estimatedCostSavings: z.string().optional(),
  riskFlags: z.array(z.string()).default([]),
});

export type AgentResult = z.infer<typeof agentResultSchema>;
export type SwarmPlan = z.infer<typeof swarmPlanSchema>;
export type AgentResponse = z.infer<typeof agentResponseSchema>;

function buildSwarmSystemPrompt(role: string, phaseLabel: string) {
  return `You are the ${role} specialist agent within a keyword research swarm system. Your role: ${phaseLabel}.

You are executing as part of a coordinated multi-agent research pipeline. Your responsibilities:
- Execute your assigned task with high precision
- Return structured JSON output with your findings
- Flag uncertainty clearly rather than guessing
- Document your reasoning for synthesis by other agents
- If the input specifies a language (e.g. Hebrew), ALL text output must be in that language

CRITICAL: Return valid JSON only, with no prose before or after the JSON block.`;
}

function buildSwarmPrompt(
  phaseLabel: string,
  taskLabel: string,
  input: Record<string, unknown>,
  outputContract: Record<string, unknown>,
  modelTier: ModelTier,
) {
  // Extract language from input to add language constraint
  const language = typeof input.language === 'string' ? input.language : null;
  const languageConstraint = language
    ? `All text values in the output MUST be written in ${language}`
    : null;

  return JSON.stringify({
    context: {
      agentRole: phaseLabel,
      assignedTask: taskLabel,
      instruction: `You are responsible for: ${taskLabel}. Execute this task and return structured results.`,
    },
    input,
    outputContract,
    constraints: [
      'Return ONLY valid JSON matching the output contract',
      'Do not include explanatory text outside the JSON',
      'If data is unavailable, return null values rather than guessing',
      'Flag low-confidence data with a warning in the reasoning field',
      ...(languageConstraint ? [languageConstraint] : []),
    ],
  });
}

export async function callSwarmAgent(params: {
  agentId: string;
  agentRole: string;
  phaseLabel: string;
  taskLabel: string;
  input: Record<string, unknown>;
  outputContract: Record<string, unknown>;
  modelTier?: ModelTier;
  maxTokens?: number;
  timeoutMs?: number;
}): Promise<AgentResult> {
  const startTime = Date.now();
  const modelTier = params.modelTier ?? 'sonnet';

  try {
    const output = await callAiJson({
      schema: z.object({
        status: z.enum(['success', 'error']),
        output: z.record(z.unknown()),
        reasoning: z.string().optional(),
        suggestions: z.array(z.string()).default([]),
        warnings: z.array(z.string()).default([]),
      }),
      system: buildSwarmSystemPrompt(params.agentRole, params.phaseLabel),
      prompt: buildSwarmPrompt(
        params.phaseLabel,
        params.taskLabel,
        params.input,
        params.outputContract,
        modelTier,
      ),
      maxTokens: params.maxTokens ?? 4096,
      modelTier,
    });

    return {
      agentId: params.agentId,
      agentRole: params.agentRole,
      status: 'success',
      output: output.output,
      reasoning: output.reasoning,
      modelUsed: modelTier,
      durationMs: Date.now() - startTime,
      suggestions: output.suggestions,
      warnings: output.warnings,
    };
  } catch (error) {
    return {
      agentId: params.agentId,
      agentRole: params.agentRole,
      status: 'error',
      error: error instanceof Error ? error.message : 'Unknown agent error',
      modelUsed: modelTier,
      durationMs: Date.now() - startTime,
    };
  }
}

export async function planSwarmExecution(params: {
  input: ResearchInputSnapshot;
  pillarCount: number;
  clusterCount: number;
  availableAgents: number;
}): Promise<SwarmPlan> {
  const response = await callAiJson({
    schema: swarmPlanSchema,
    system: `You are the Swarm Orchestrator for a keyword research pipeline. Your job is to plan the optimal execution strategy for a keyword research job.

Given the research parameters, produce a detailed swarm execution plan that:
1. Groups independent tasks for parallel execution
2. Assigns the right model tier to each task based on complexity
3. Sequences dependent tasks correctly
4. Maximizes parallelism while respecting dependencies

Return valid JSON only with the execution plan.`,
    prompt: JSON.stringify({
      task: 'Generate an optimized swarm execution plan',
      researchParams: {
        language: params.input.language,
        market: params.input.market,
        brandName: params.input.brandName,
        mode: params.input.mode,
        targetRows: params.input.targetRows,
        pillarCount: params.pillarCount,
        estimatedClusterCount: params.clusterCount,
        hasExistingResearch: Boolean(params.input.existingResearchSummary),
        availableAgents: params.availableAgents,
      },
      modelTiers: {
        opus: 'Highest reasoning - used for site analysis, competitor synthesis, strategic decisions',
        sonnet: 'Balanced - used for content generation, cluster design, supporting keyword extraction',
        haiku: 'Fastest - used for metadata enrichment, simple validations, data formatting',
      },
      outputContract: {
        phases: [{
          phaseId: 'phase-1',
          phaseLabel: 'Discovery & Analysis',
          tasks: [{
            taskId: 'task-1',
            taskLabel: 'string',
            agentRole: 'string',
            modelTier: 'opus | sonnet | haiku',
            parallelGroup: 'string | null',
            dependsOn: [],
            priority: 1,
            input: {},
          }],
        }],
        orchestration: {
          synthesisModel: 'opus | sonnet',
          fallbackEnabled: true,
          maxParallelTasks: 3,
        },
      },
    }),
    modelTier: 'sonnet',
    maxTokens: 3000,
  });

  return swarmPlanSchema.parse(response);
}

export async function synthesizeAgentResults(
  results: AgentResult[],
  context: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const successfulResults = results.filter((r) => r.status === 'success');

  if (successfulResults.length === 0) {
    return { synthesisStatus: 'no-results', context };
  }

  const synthesisInput = successfulResults.map((r) => ({
    agentId: r.agentId,
    agentRole: r.agentRole,
    output: r.output,
    reasoning: r.reasoning,
    warnings: r.warnings,
  }));

  try {
    const synthesis = await callAiJson({
      schema: z.object({
        synthesis: z.record(z.unknown()),
        executiveSummary: z.string(),
        keyInsights: z.array(z.string()),
        nextSteps: z.array(z.string()),
        confidence: z.enum(['high', 'medium', 'low']),
        flaggedIssues: z.array(z.string()).default([]),
      }),
      system: `You are the Swarm Synthesis Agent. Your role is to take the outputs from multiple specialist agents and produce a unified, coherent synthesis.

Merge the agent results into a single coherent output, resolving any conflicts, highlighting key insights, and providing clear next steps.`,
      prompt: JSON.stringify({
        task: 'Synthesize all agent results into a unified research context',
        agentResults: synthesisInput,
        researchContext: context,
        outputContract: {
          synthesis: 'Unified context object merging all agent outputs',
          executiveSummary: '2-3 sentence summary of the research state',
          keyInsights: ['array of key findings from agent outputs'],
          nextSteps: ['recommended next actions based on synthesis'],
          confidence: 'high | medium | low',
          flaggedIssues: ['any issues or conflicts detected across agents'],
        },
      }),
      modelTier: 'opus',
      maxTokens: 3500,
    });

    return synthesis as Record<string, unknown>;
  } catch {
    return {
      synthesisStatus: 'fallback',
      combinedOutputs: successfulResults.map((r) => r.output),
      context,
    };
  }
}

export function selectModelForTask(taskComplexity: 'high' | 'medium' | 'low'): ModelTier {
  switch (taskComplexity) {
    case 'high': return 'opus';
    case 'medium': return 'sonnet';
    case 'low': return 'haiku';
  }
}
