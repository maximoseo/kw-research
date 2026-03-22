import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import { z } from 'zod';
import { getAiMaxRetries, getAiRequestTimeoutMs, getConfiguredModels } from '@/lib/env';

export type ModelTier = 'opus' | 'sonnet' | 'haiku';

function extractJsonPayload(content: string) {
  const fenced = content.match(/```json\s*([\s\S]*?)```/i);
  if (fenced?.[1]) {
    return fenced[1].trim();
  }

  const firstBrace = content.indexOf('{');
  const firstBracket = content.indexOf('[');
  const start = [firstBrace, firstBracket].filter((value) => value >= 0).sort((a, b) => a - b)[0];
  if (start === undefined) {
    return content.trim();
  }

  const trimmed = content.slice(start).trim();
  return trimmed;
}

function parseJsonWithSchema<T>(content: string, schema: z.ZodSchema<T>) {
  const extracted = extractJsonPayload(content);
  return schema.parse(JSON.parse(extracted));
}

function buildAnthropicCandidates(tier?: ModelTier) {
  const { anthropicModel } = getConfiguredModels();
  if (anthropicModel) {
    return [anthropicModel];
  }
  switch (tier) {
    case 'opus': return ['claude-opus-4-20250115'];
    case 'sonnet': return ['claude-sonnet-4-20250514'];
    case 'haiku': return ['claude-sonnet-4-20250514']; // no haiku tier, use sonnet
    default: return ['claude-opus-4-20250115', 'claude-sonnet-4-20250514'];
  }
}

async function callAnthropic<T>(params: {
  schema: z.ZodSchema<T>;
  system: string;
  prompt: string;
  maxTokens?: number;
  modelTier?: ModelTier;
}) {
  const { anthropicApiKey } = getConfiguredModels();
  if (!anthropicApiKey) {
    return null;
  }

  const client = new Anthropic({
    apiKey: anthropicApiKey,
    timeout: getAiRequestTimeoutMs(),
    maxRetries: 0,
  });

  let lastError: Error | null = null;
  const candidates = buildAnthropicCandidates(params.modelTier);
  for (const model of candidates) {
    for (let attempt = 0; attempt <= getAiMaxRetries(); attempt += 1) {
      try {
        const response = await client.messages.create({
          model,
          temperature: 0.3,
          max_tokens: params.maxTokens ?? 4096,
          system: `${params.system}\nReturn valid JSON only, with no prose before or after the JSON.`,
          messages: [{ role: 'user', content: params.prompt }],
        });

        const text = response.content
          .filter((block) => block.type === 'text')
          .map((block) => block.text)
          .join('\n');

        return parseJsonWithSchema(text, params.schema);
      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Anthropic request failed.');
      }
    }
  }

  if (lastError) {
    throw lastError;
  }

  return null;
}

/** @deprecated OpenAI fallback is disabled — Anthropic is the sole provider. */
async function callOpenAi<T>(params: {
  schema: z.ZodSchema<T>;
  system: string;
  prompt: string;
  maxTokens?: number;
}) {
  const { openAiApiKey, openAiModel } = getConfiguredModels();
  if (!openAiApiKey) {
    return null;
  }

  const client = new OpenAI({
    apiKey: openAiApiKey,
    timeout: getAiRequestTimeoutMs(),
    maxRetries: getAiMaxRetries(),
  });

  const isGpt5 = openAiModel.startsWith('gpt-5');
  const response = await client.chat.completions.create({
    model: openAiModel,
    temperature: 0.3,
    response_format: { type: 'json_object' },
    ...(isGpt5
      ? { max_completion_tokens: params.maxTokens ?? 4096 }
      : { max_tokens: params.maxTokens ?? 4096 }),
    messages: [
      { role: 'system', content: `${params.system}\nReturn valid JSON only, with no prose.` },
      { role: 'user', content: params.prompt },
    ],
  } as never);

  const text = response.choices[0]?.message?.content;
  if (!text) {
    throw new Error('OpenAI response did not contain any content.');
  }

  return parseJsonWithSchema(text, params.schema);
}

export async function callAiJson<T>(params: {
  schema: z.ZodSchema<T>;
  system: string;
  prompt: string;
  maxTokens?: number;
  modelTier?: ModelTier;
}) {
  const result = await callAnthropic(params);
  if (result) {
    return result;
  }

  throw new Error('Anthropic API failed. Ensure ANTHROPIC_API_KEY is set.');
}
