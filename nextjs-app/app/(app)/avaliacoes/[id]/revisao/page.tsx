'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/contexts/ToastContext'
import { SCALE_LABELS } from '@/lib/constants'
import {
  calculateRiskScores,
  ResponseWithQuestion,
} from '@/lib/risk-calculator'
import { PageHeader } from '@/components/layout/PageHeader'
import { Card, CardHeader, CardBody } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { StatsGrid } from '@/components/ui/StatsGrid'
import { Alert } from '@/components/ui/Alert'
import { Modal } from '@/components/ui/Modal'

interface AssessmentData {
  id: string
  mode: string
  cycle_number: number
  respondente_nome: string | null
  respondente_cargo: string | null
  status: string
  companies: { name: string } | null
  sectors: { name: string } | null
}

interface Factor {
  id: number
  code: string
  name: string
  order_index: number
}

interface Question {
  id: number
  factor_id: number
  text: string
  scale_type: string
  reverse_scored: boolean
}

interface ResponseData {
  id: string
  question_id: number
  score: number
  valor_normalizado: number
}

function getScoreLabel(scaleType: string, score: number): string {
  const labels = SCALE_LABELS[scaleType] || SCALE_LABELS.concordance
  return labels[score - 1] || String(score)
}

function getScoreBadgeVariant(
  score: number
): 'baixo' | 'moderado' | 'alto' | 'critico' {
  if (score <= 2) return 'critico'
  if (score <= 3) return 'moderado'
  if (score <= 4) return 'baixo'
  return 'baixo'
}

function getRiskLevel(score: number): string {
  if (score <= 25) return 'baixo'
  if (score <= 50) return 'moderado'
  if (score <= 75) return 'alto'
  return 'critico'
}

export default function RevisaoPage() {
  const router = useRouter()
  const params = useParams()
  const id = params.id as string
  const supabase = createClient()
  const { toast } = useToast()

  const [loading, setLoading] = useState(true)
  const [calculating, setCalculating] = useState(false)
  const [showConfirmModal, setShowConfirmModal] = useState(false)
  const [assessment, setAssessment] = useState<AssessmentData | null>(null)
  const [factors, setFactors] = useState<Factor[]>([])
  const [questions, setQuestions] = useState<Question[]>([])
  const [responses, setResponses] = useState<ResponseData[]>([])
  const [openAccordions, setOpenAccordions] = useState<Record<string, boolean>>({})

  useEffect(() => {
    async function loadData() {
      const [assessmentRes, factorsRes, questionsRes, responsesRes] =
        await Promise.all([
          supabase
            .from('assessments')
            .select(
              'id, mode, cycle_number, respondente_nome, respondente_cargo, status, companies(name), sectors(name)'
            )
            .eq('id', id)
            .single(),
          supabase
            .from('factors')
            .select('id, code, name, order_index')
            .order('order_index'),
          supabase
            .from('questions')
            .select('id, factor_id, text, scale_type, reverse_scored'),
          supabase
            .from('assessment_responses')
            .select('id, question_id, score, valor_normalizado')
            .eq('assessment_id', id),
        ])

      if (assessmentRes.data)
        setAssessment(assessmentRes.data as unknown as AssessmentData)
      if (factorsRes.data) setFactors(factorsRes.data)
      if (questionsRes.data) setQuestions(questionsRes.data)
      if (responsesRes.data) setResponses(responsesRes.data)
      setLoading(false)
    }
    loadData()
  }, [id, supabase])

  const answeredQuestionIds = new Set(responses.map((r) => r.question_id))
  const totalQuestions = questions.length
  const answeredCount = responses.length
  const missingQuestions = questions.filter((q) => !answeredQuestionIds.has(q.id))
  const allAnswered = missingQuestions.length === 0

  function toggleAccordion(factorId: number) {
    setOpenAccordions((prev) => ({
      ...prev,
      [factorId]: !prev[factorId],
    }))
  }

  async function handleCalculate() {
    setCalculating(true)
    setShowConfirmModal(false)

    try {
      // Fetch all responses with factor info from questions
      const { data: allResponses } = await supabase
        .from('assessment_responses')
        .select('question_id, score, valor_normalizado')
        .eq('assessment_id', id)

      if (!allResponses || allResponses.length === 0) {
        toast('Nenhuma resposta encontrada.', 'error')
        setCalculating(false)
        return
      }

      // Build ResponseWithQuestion array for the calculator
      // We need factor_id for each response - get from questions
      const questionFactorMap: Record<number, number> = {}
      questions.forEach((q) => {
        questionFactorMap[q.id] = q.factor_id
      })

      const responsesForCalc: ResponseWithQuestion[] = allResponses.map((r) => ({
        factor_id: questionFactorMap[r.question_id],
        valor_normalizado: r.valor_normalizado,
      }))

      // Calculate risk scores using the imported calculator
      const calculatedScores = calculateRiskScores(responsesForCalc)

      // Delete old risk_scores for this assessment
      await supabase.from('risk_scores').delete().eq('assessment_id', id)

      // Insert new risk_scores
      const riskScoreRows = calculatedScores.map((rs) => ({
        assessment_id: id,
        factor_id: rs.factor_id,
        raw_score: Math.round(rs.raw_score * 100) / 100,
        severity: rs.severity,
        probability: rs.probability,
        final_score: Math.round(rs.final_score * 100) / 100,
        classification: rs.classification,
      }))

      const { error: insertError } = await supabase
        .from('risk_scores')
        .insert(riskScoreRows)

      if (insertError) throw insertError

      // Calculate overall risk index
      const generalIndex =
        riskScoreRows.reduce((sum, rs) => sum + rs.final_score, 0) /
        riskScoreRows.length
      const generalLevel = getRiskLevel(generalIndex)

      // Update assessment status
      const { error: updateError } = await supabase
        .from('assessments')
        .update({
          indice_risco_geral: Math.round(generalIndex * 100) / 100,
          nivel_risco_geral: generalLevel,
          status: 'completed',
          completed_at: new Date().toISOString(),
        })
        .eq('id', id)

      if (updateError) throw updateError

      toast('Resultados calculados com sucesso!', 'success')
      router.push(`/avaliacoes/${id}/resultado`)
    } catch (err) {
      console.error(err)
      toast('Erro ao calcular resultados.', 'error')
      setCalculating(false)
    }
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
        <PageHeader title="Revisao" breadcrumb="Avaliacoes > Revisao" />
        <Alert variant="danger">Avaliacao nao encontrada.</Alert>
      </>
    )
  }

  return (
    <>
      <PageHeader title="Revisao da Avaliacao" breadcrumb="Avaliacoes > Revisao" />

      {/* Assessment Summary */}
      <Card>
        <CardHeader>Resumo da Avaliacao</CardHeader>
        <CardBody>
          <div className="detail-grid">
            <div className="detail-item">
              <span className="detail-label">Empresa</span>
              <span className="detail-value">
                {assessment.companies?.name || '---'}
              </span>
            </div>
            <div className="detail-item">
              <span className="detail-label">Setor</span>
              <span className="detail-value">
                {assessment.sectors?.name || '---'}
              </span>
            </div>
            <div className="detail-item">
              <span className="detail-label">Modalidade</span>
              <span className="detail-value">
                {assessment.mode === 'institucional'
                  ? 'Institucional'
                  : 'Anonimo'}
              </span>
            </div>
            <div className="detail-item">
              <span className="detail-label">Ciclo</span>
              <span className="detail-value">{assessment.cycle_number}</span>
            </div>
            {assessment.respondente_nome && (
              <div className="detail-item">
                <span className="detail-label">Respondente</span>
                <span className="detail-value">
                  {assessment.respondente_nome} ({assessment.respondente_cargo})
                </span>
              </div>
            )}
          </div>
        </CardBody>
      </Card>

      {/* Completion Stats */}
      <StatsGrid
        items={[
          { value: String(totalQuestions), label: 'Total de Questoes' },
          { value: String(answeredCount), label: 'Respondidas' },
          {
            value: String(missingQuestions.length),
            label: 'Pendentes',
            variant: missingQuestions.length > 0 ? 'warning' : undefined,
          },
          {
            value:
              totalQuestions > 0
                ? `${Math.round((answeredCount / totalQuestions) * 100)}%`
                : '0%',
            label: 'Conclusao',
          },
        ]}
      />

      {/* Status Alert */}
      {allAnswered ? (
        <Alert variant="success">
          Todas as {totalQuestions} questoes foram respondidas. Pronto para
          calcular os resultados.
        </Alert>
      ) : (
        <Alert variant="warning">
          {missingQuestions.length} questao(oes) ainda nao respondida(s). Revise
          os fatores abaixo antes de calcular.
        </Alert>
      )}

      {/* Responses grouped by factor */}
      {factors.map((factor) => {
        const factorQuestions = questions.filter(
          (q) => q.factor_id === factor.id
        )
        const factorResponses = responses.filter((r) =>
          factorQuestions.some((q) => q.id === r.question_id)
        )
        const factorAnswered = factorResponses.length
        const factorTotal = factorQuestions.length
        const isComplete = factorAnswered === factorTotal
        const isOpen = openAccordions[factor.id] || false

        return (
          <div key={factor.id} className="accordion-item">
            <div
              className={`accordion-header${isOpen ? ' open' : ''}`}
              onClick={() => toggleAccordion(factor.id)}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span>{factor.code}</span>
                <span
                  style={{
                    fontWeight: 400,
                    color: 'var(--text-secondary)',
                  }}
                >
                  {factor.name}
                </span>
                <Badge variant={isComplete ? 'concluida' : 'pendente'}>
                  {factorAnswered}/{factorTotal}
                </Badge>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation()
                    router.push(`/avaliacoes/${id}/coleta`)
                  }}
                >
                  Editar
                </Button>
                <span className="arrow">&#9660;</span>
              </div>
            </div>
            <div className={`accordion-body${isOpen ? ' open' : ''}`}>
              <div className="table-container">
                <table>
                  <thead>
                    <tr>
                      <th>Questao</th>
                      <th style={{ width: 160 }}>Resposta</th>
                    </tr>
                  </thead>
                  <tbody>
                    {factorQuestions.map((q) => {
                      const resp = factorResponses.find(
                        (r) => r.question_id === q.id
                      )
                      return (
                        <tr key={q.id}>
                          <td style={{ color: 'var(--text)' }}>{q.text}</td>
                          <td>
                            {resp ? (
                              <Badge
                                variant={getScoreBadgeVariant(resp.score)}
                              >
                                {getScoreLabel(q.scale_type, resp.score)}
                              </Badge>
                            ) : (
                              <Badge variant="pendente">Nao respondida</Badge>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )
      })}

      {/* Action Buttons */}
      <div
        className="btn-group"
        style={{ justifyContent: 'flex-end', marginTop: 20 }}
      >
        <Button
          variant="secondary"
          onClick={() => router.push(`/avaliacoes/${id}/coleta`)}
        >
          Voltar a Coleta
        </Button>
        <Button
          variant="primary"
          onClick={() => setShowConfirmModal(true)}
          disabled={calculating}
        >
          {calculating ? 'Calculando...' : 'Calcular Resultados'}
        </Button>
      </div>

      {/* Confirmation Modal */}
      <Modal
        isOpen={showConfirmModal}
        onClose={() => setShowConfirmModal(false)}
        title="Confirmar Calculo dos Resultados"
      >
        <p
          style={{
            fontSize: 14,
            color: 'var(--text-secondary)',
            marginBottom: 20,
            lineHeight: 1.6,
          }}
        >
          Tem certeza que deseja calcular os resultados? Esta acao ira processar
          todas as respostas e gerar os indices de risco para cada fator
          psicossocial avaliado.
        </p>
        {!allAnswered && (
          <Alert variant="warning">
            Atencao: existem {missingQuestions.length} questao(oes) nao
            respondida(s). O calculo sera feito apenas com as respostas
            existentes.
          </Alert>
        )}
        <div className="btn-group" style={{ justifyContent: 'flex-end' }}>
          <Button
            variant="secondary"
            onClick={() => setShowConfirmModal(false)}
          >
            Cancelar
          </Button>
          <Button variant="primary" onClick={handleCalculate}>
            Confirmar Calculo
          </Button>
        </div>
      </Modal>
    </>
  )
}
