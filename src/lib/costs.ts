/**
 * DMD-006 — Per-generation cost tracking
 * Anthropic pricing as of 2026 — verify at https://www.anthropic.com/pricing
 * before launch and update if changed.
 */

export const ANTHROPIC_PRICING: Record<string, { input: number; output: number }> = {
  // Cost per token (divide per-million rates by 1,000,000)
  'claude-sonnet-4-6':  { input: 0.000003,    output: 0.000015   },
  'claude-opus-4-5':    { input: 0.000015,    output: 0.000075   },
  'claude-haiku-4-5':   { input: 0.0000008,   output: 0.000004   },
  // Fallback for unknown models
  'default':            { input: 0.000003,    output: 0.000015   },
}

export interface PassCost {
  model: string
  inputTokens: number
  outputTokens: number
  costUsd: number
}

export interface GenerationCost {
  passes: PassCost[]
  totalCostUsd: number
  totalInputTokens: number
  totalOutputTokens: number
}

export function calculatePassCost(
  model: string,
  inputTokens: number,
  outputTokens: number,
): PassCost {
  const pricing = ANTHROPIC_PRICING[model] ?? ANTHROPIC_PRICING['default']
  const costUsd = inputTokens * pricing.input + outputTokens * pricing.output
  return { model, inputTokens, outputTokens, costUsd }
}

export function sumCosts(passes: PassCost[]): GenerationCost {
  const totalCostUsd = passes.reduce((sum, p) => sum + p.costUsd, 0)
  const totalInputTokens = passes.reduce((sum, p) => sum + p.inputTokens, 0)
  const totalOutputTokens = passes.reduce((sum, p) => sum + p.outputTokens, 0)
  return { passes, totalCostUsd, totalInputTokens, totalOutputTokens }
}

/** Round to 6 decimal places for display */
export function formatCost(usd: number): string {
  return `$${usd.toFixed(6)}`
}
