'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/contexts/ToastContext'
import { PageHeader } from '@/components/layout/PageHeader'
import { Card, CardHeader, CardBody } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { StatsGrid } from '@/components/ui/StatsGrid'
import { Alert } from '@/components/ui/Alert'
import type { RiskLevel } from '@/lib/types'

interface AssessmentData {
  id: string
  indice_risco_geral: number | null
  nivel_risco_geral: string | null
  companies: { name: string } | null
  sectors: { name: string } | null
}

interface RiskScoreRow {
  id: string
  factor_id: number
  raw_score: number
  severity: number
  probability: number
  final_score: number
  classification: string
  factors: {
    code: string
    name: string
    dimension: string
    consequence: string
  } | null
}

interface ObservationRow {
  id: string
  factor_id: number
  observation: string
}

const CLASSIFICATION_LABELS: Record<string, string> = {
  critico: 'Critico',
  alto: 'Alto',
  moderado: 'Moderado',
  baixo: 'Baixo',
}

const COLOR_MAP: Record<string, string> = {
  critico: '#C03060',
  alto: '#E04848',
  moderado: '#E8A020',
  baixo: '#34B89A',
}

export default function ResultadoPage() {
  const router = useRouter()
  const params = useParams()
  const id = params.id as string
  const supabase = createClient()
  const { toast } = useToast()

  const [loading, setLoading] = useState(true)
  const [assessment, setAssessment] = useState<AssessmentData | null>(null)
  const [riskScores, setRiskScores] = useState<RiskScoreRow[]>([])
  const [observations, setObservations] = useState<Record<number, string>>({})
  const [savingObs, setSavingObs] = useState<Record<number, boolean>>({})

  useEffect(() => {
    async function loadData() {
      const [assessmentRes, scoresRes, obsRes] = await Promise.all([
        supabase
          .from('assessments')
          .select(
            'id, indice_risco_geral, nivel_risco_geral, companies(name), sectors(name)'
          )
          .eq('id', id)
          .single(),
        supabase
          .from('risk_scores')
          .select(
            'id, factor_id, raw_score, severity, probability, final_score, classification, factors(code, name, dimension, consequence)'
          )
          .eq('assessment_id', id)
          .order('final_score', { ascending: false }),
        supabase
          .from('factor_observations')
          .select('id, factor_id, observation')
          .eq('assessment_id', id),
      ])

      if (assessmentRes.data)
        setAssessment(assessmentRes.data as unknown as AssessmentData)
      if (scoresRes.data)
        setRiskScores(scoresRes.data as unknown as RiskScoreRow[])
      if (obsRes.data) {
        const obsMap: Record<number, string> = {}
        ;(obsRes.data as ObservationRow[]).forEach((o) => {
          obsMap[o.factor_id] = o.observation
        })
        setObservations(obsMap)
      }

      setLoading(false)
    }
    loadData()
  }, [id, supabase])

  const handleObservationChange = useCallback(
    (factorId: number, text: string) => {
      setObservations((prev) => ({ ...prev, [factorId]: text }))
    },
    []
  )

  async function saveObservation(factorId: number) {
    setSavingObs((prev) => ({ ...prev, [factorId]: true }))
    const text = observations[factorId] || ''

    try {
      // Check if observation already exists
      const { data: existing } = await supabase
        .from('factor_observations')
        .select('id')
        .eq('assessment_id', id)
        .eq('factor_id', factorId)
        .maybeSingle()

      if (existing) {
        await supabase
          .from('factor_observations')
          .update({ observation: text })
          .eq('id', existing.id)
      } else {
        await supabase.from('factor_observations').insert({
          assessment_id: id,
          factor_id: factorId,
          observation: text,
        })
      }

      toast('Observacao salva.', 'success')
    } catch (err) {
      console.error(err)
      toast('Erro ao salvar observacao.', 'error')
    }

    setSavingObs((prev) => ({ ...prev, [factorId]: false }))
  }

  if (loading) {
    return (
      <div className="loading">
        <div className="spinner" />
      </div>
    )
  }

  if (!assessment) {
    return (
      <>
        <PageHeader title="Resultado" breadcrumb="Avaliacoes > Resultado" />
        <Alert variant="danger">Avaliacao nao encontrada.</Alert>
      </>
    )
  }

  const riskLevel = (assessment.nivel_risco_geral || 'moderado') as RiskLevel
  const indiceGeral = assessment.indice_risco_geral ?? 0
  const sortedScores = [...riskScores].sort(
    (a, b) => b.final_score - a.final_score
  )
  const criticalCount = riskScores.filter(
    (rs) => rs.classification === 'critico'
  ).length
  const moderateOrHighCount = riskScores.filter(
    (rs) =>
      rs.classification === 'moderado' ||
      rs.classification === 'alto' ||
      rs.classification === 'critico'
  ).length

  return (
    <>
      <PageHeader
        title="Resultado da Avaliacao"
        breadcrumb="Avaliacoes > Resultado"
      >
        <Button
          variant="primary"
          onClick={() => router.push(`/avaliacoes/${id}/intervencoes`)}
        >
          Selecionar Intervencoes
        </Button>
      </PageHeader>

      {/* Overall Risk Indicator */}
      <div className={`risk-indicator ${riskLevel}`}>
        <div className="risk-score">{Math.round(indiceGeral)}</div>
        <div>
          <div className="risk-label">
            Risco {CLASSIFICATION_LABELS[riskLevel] || riskLevel}
          </div>
          <p
            style={{
              fontSize: 13,
              color: 'var(--text-secondary)',
              marginTop: 4,
            }}
          >
            Indice Geral de Risco Psicossocial
          </p>
        </div>
      </div>

      {/* Stats Grid */}
      <StatsGrid
        items={[
          {
            value: String(Math.round(indiceGeral)),
            label: 'Indice Geral',
          },
          {
            value: CLASSIFICATION_LABELS[riskLevel] || riskLevel,
            label: 'Nivel de Risco',
            variant:
              riskLevel === 'critico' || riskLevel === 'alto'
                ? 'danger'
                : riskLevel === 'moderado'
                  ? 'warning'
                  : 'success',
          },
          {
            value: String(criticalCount),
            label: 'Fatores Criticos',
            variant: criticalCount > 0 ? 'danger' : undefined,
          },
          {
            value: String(moderateOrHighCount),
            label: 'Fatores Moderados+',
            variant: moderateOrHighCount > 0 ? 'warning' : undefined,
          },
        ]}
      />

      {/* Risk Scores Table */}
      <Card>
        <CardHeader>Ranking de Riscos por Fator</CardHeader>
        <CardBody>
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Codigo</th>
                  <th>Fator</th>
                  <th>Score (0-100)</th>
                  <th>Classificacao</th>
                  <th>Consequencia</th>
                </tr>
              </thead>
              <tbody>
                {sortedScores.map((rs, idx) => (
                  <tr key={rs.id}>
                    <td>
                      <strong>{idx + 1}</strong>
                    </td>
                    <td>
                      <span
                        style={{
                          fontSize: 12,
                          fontWeight: 600,
                          color: 'var(--text-muted)',
                        }}
                      >
                        {rs.factors?.code || '---'}
                      </span>
                    </td>
                    <td>
                      <strong>{rs.factors?.name || '---'}</strong>
                      <div
                        style={{
                          fontSize: 11,
                          color: 'var(--text-muted)',
                        }}
                      >
                        {rs.factors?.dimension || ''}
                      </div>
                    </td>
                    <td style={{ minWidth: 120 }}>
                      <div
                        className="risk-bar"
                        style={{
                          width: `${Math.max(rs.final_score, 8)}%`,
                          background:
                            COLOR_MAP[rs.classification] || '#888',
                        }}
                      >
                        {Math.round(rs.final_score)}
                      </div>
                    </td>
                    <td>
                      <Badge
                        variant={rs.classification as RiskLevel}
                      >
                        {CLASSIFICATION_LABELS[rs.classification] ||
                          rs.classification}
                      </Badge>
                    </td>
                    <td
                      style={{
                        fontSize: 12,
                        maxWidth: 260,
                        color: 'var(--text-secondary)',
                      }}
                    >
                      {rs.factors?.consequence || '---'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardBody>
      </Card>

      {/* Factor Observations */}
      <Card>
        <CardHeader>Observacoes por Fator</CardHeader>
        <CardBody>
          <p
            style={{
              fontSize: 13,
              color: 'var(--text-secondary)',
              marginBottom: 16,
            }}
          >
            Registre observacoes qualitativas para cada fator de risco. Estas
            informacoes complementam os dados quantitativos e auxiliam na
            definicao de intervencoes.
          </p>
          {sortedScores.map((rs) => (
            <div
              key={rs.id}
              style={{
                marginBottom: 16,
                padding: 16,
                background: 'var(--bg-surface)',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--border-light)',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: 8,
                }}
              >
                <div>
                  <strong style={{ fontSize: 14 }}>
                    {rs.factors?.code} - {rs.factors?.name}
                  </strong>
                  <Badge
                    variant={rs.classification as RiskLevel}
                  >
                    {CLASSIFICATION_LABELS[rs.classification]}
                  </Badge>
                </div>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => saveObservation(rs.factor_id)}
                  disabled={savingObs[rs.factor_id]}
                >
                  {savingObs[rs.factor_id] ? 'Salvando...' : 'Salvar'}
                </Button>
              </div>
              <textarea
                value={observations[rs.factor_id] || ''}
                onChange={(e) =>
                  handleObservationChange(rs.factor_id, e.target.value)
                }
                placeholder={`Observacoes sobre ${rs.factors?.name || 'este fator'}...`}
                style={{
                  width: '100%',
                  minHeight: 80,
                  resize: 'vertical',
                }}
              />
            </div>
          ))}
        </CardBody>
      </Card>

      {/* Navigation */}
      <div className="btn-group" style={{ justifyContent: 'flex-end' }}>
        <Button
          variant="secondary"
          onClick={() => router.push(`/avaliacoes/${id}/revisao`)}
        >
          Voltar a Revisao
        </Button>
        <Button
          variant="primary"
          onClick={() => router.push(`/avaliacoes/${id}/intervencoes`)}
        >
          Selecionar Intervencoes
        </Button>
      </div>
    </>
  )
}
