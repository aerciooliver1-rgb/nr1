import type { RiskLevel } from './types'

export interface ResponseWithQuestion {
  factor_id: number
  valor_normalizado: number
}

export interface CalculatedRiskScore {
  factor_id: number
  raw_score: number
  severity: number
  probability: number
  final_score: number
  classification: RiskLevel
}

function getSeverity(raw: number): number {
  if (raw <= 25) return 1
  if (raw <= 50) return 2
  if (raw <= 75) return 3
  return 4
}

function getProbability(raw: number): number {
  if (raw <= 20) return 1
  if (raw <= 45) return 2
  if (raw <= 70) return 3
  return 4
}

function getClassification(raw: number): RiskLevel {
  if (raw <= 25) return 'baixo'
  if (raw <= 50) return 'moderado'
  if (raw <= 75) return 'alto'
  return 'critico'
}

/**
 * Calculate risk scores per factor from a list of responses.
 *
 * Logic:
 * - Group responses by factor_id
 * - For each factor: raw = average of valor_normalizado
 * - severity: <=25 -> 1, <=50 -> 2, <=75 -> 3, else -> 4
 * - probability: <=20 -> 1, <=45 -> 2, <=70 -> 3, else -> 4
 * - classification: <=25 -> 'baixo', <=50 -> 'moderado', <=75 -> 'alto', else -> 'critico'
 * - final_score = min(100, (severity * probability / 16) * 100)
 */
export function calculateRiskScores(
  responses: ResponseWithQuestion[]
): CalculatedRiskScore[] {
  // Group responses by factor_id
  const grouped = new Map<number, number[]>()

  for (const r of responses) {
    const values = grouped.get(r.factor_id)
    if (values) {
      values.push(r.valor_normalizado)
    } else {
      grouped.set(r.factor_id, [r.valor_normalizado])
    }
  }

  const results: CalculatedRiskScore[] = []

  for (const [factor_id, values] of grouped) {
    const raw_score = values.reduce((sum, v) => sum + v, 0) / values.length
    const severity = getSeverity(raw_score)
    const probability = getProbability(raw_score)
    const classification = getClassification(raw_score)
    const final_score = Math.min(100, (severity * probability / 16) * 100)

    results.push({
      factor_id,
      raw_score,
      severity,
      probability,
      final_score,
      classification,
    })
  }

  return results
}
