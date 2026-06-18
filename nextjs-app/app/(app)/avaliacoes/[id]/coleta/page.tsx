'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/contexts/ToastContext'
import { SCALE_LABELS } from '@/lib/constants'
import { PageHeader } from '@/components/layout/PageHeader'
import { Card, CardHeader, CardBody } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { ProgressBar } from '@/components/ui/ProgressBar'
import { Alert } from '@/components/ui/Alert'

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
  order_index: number
}

interface ExistingResponse {
  id: string
  question_id: number
  score: number
  valor_normalizado: number
}

export default function ColetaPage() {
  const router = useRouter()
  const params = useParams()
  const id = params.id as string
  const supabase = createClient()
  const { currentUser } = useAuth()
  const { toast } = useToast()

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [factors, setFactors] = useState<Factor[]>([])
  const [questions, setQuestions] = useState<Question[]>([])
  const [existingResponses, setExistingResponses] = useState<ExistingResponse[]>([])
  const [currentFactorIndex, setCurrentFactorIndex] = useState(0)
  const [responses, setResponses] = useState<Record<number, number>>({})
  const [assessmentStatus, setAssessmentStatus] = useState('')

  useEffect(() => {
    async function loadData() {
      const [assessmentRes, factorsRes, questionsRes, responsesRes] =
        await Promise.all([
          supabase
            .from('assessments')
            .select('id, status')
            .eq('id', id)
            .single(),
          supabase
            .from('factors')
            .select('id, code, name, order_index')
            .order('order_index'),
          supabase
            .from('questions')
            .select('id, factor_id, text, scale_type, reverse_scored, order_index')
            .order('order_index'),
          supabase
            .from('assessment_responses')
            .select('id, question_id, score, valor_normalizado')
            .eq('assessment_id', id),
        ])

      if (assessmentRes.data) {
        setAssessmentStatus(assessmentRes.data.status)
      }
      if (factorsRes.data) setFactors(factorsRes.data)
      if (questionsRes.data) setQuestions(questionsRes.data)
      if (responsesRes.data) {
        setExistingResponses(responsesRes.data)
        const resMap: Record<number, number> = {}
        responsesRes.data.forEach((r) => {
          resMap[r.question_id] = r.score
        })
        setResponses(resMap)
      }

      setLoading(false)
    }
    loadData()
  }, [id, supabase])

  const currentFactor = factors[currentFactorIndex]
  const currentQuestions = currentFactor
    ? questions.filter((q) => q.factor_id === currentFactor.id)
    : []

  const totalQuestions = questions.length
  const answeredCount = Object.keys(responses).length
  const progressPercent =
    totalQuestions > 0 ? Math.round((answeredCount / totalQuestions) * 100) : 0

  const handleResponseChange = useCallback(
    (questionId: number, score: number) => {
      setResponses((prev) => ({ ...prev, [questionId]: score }))
    },
    []
  )

  function isFactorComplete(factorIndex: number): boolean {
    const factor = factors[factorIndex]
    if (!factor) return false
    const factorQuestions = questions.filter((q) => q.factor_id === factor.id)
    return factorQuestions.every((q) => responses[q.id] !== undefined)
  }

  async function saveCurrentFactor() {
    if (!currentFactor) return
    setSaving(true)

    try {
      for (const q of currentQuestions) {
        const score = responses[q.id]
        if (score === undefined) continue

        const valorNormalizado = q.reverse_scored
          ? ((5 - score) / 4) * 100
          : ((score - 1) / 4) * 100

        const existing = existingResponses.find(
          (r) => r.question_id === q.id
        )

        if (existing) {
          await supabase
            .from('assessment_responses')
            .update({ score, valor_normalizado: valorNormalizado })
            .eq('id', existing.id)
        } else {
          const { data } = await supabase
            .from('assessment_responses')
            .insert({
              assessment_id: id,
              question_id: q.id,
              score,
              valor_normalizado: valorNormalizado,
              answered_by: currentUser?.id || null,
            })
            .select('id, question_id, score, valor_normalizado')
            .single()

          if (data) {
            setExistingResponses((prev) => [...prev, data])
          }
        }
      }

      // Update assessment status to in_progress if still draft
      if (assessmentStatus === 'draft') {
        await supabase
          .from('assessments')
          .update({ status: 'in_progress', started_at: new Date().toISOString() })
          .eq('id', id)
        setAssessmentStatus('in_progress')
      }

      toast('Respostas salvas.', 'success')
    } catch (err) {
      console.error(err)
      toast('Erro ao salvar respostas.', 'error')
    }

    setSaving(false)
  }

  async function handlePrevious() {
    await saveCurrentFactor()
    if (currentFactorIndex > 0) {
      setCurrentFactorIndex((prev) => prev - 1)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }

  async function handleNext() {
    await saveCurrentFactor()
    if (currentFactorIndex < factors.length - 1) {
      setCurrentFactorIndex((prev) => prev + 1)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }

  async function handleFinalizarColeta() {
    await saveCurrentFactor()

    // Check if all questions are answered
    const unanswered = questions.filter((q) => responses[q.id] === undefined)
    if (unanswered.length > 0) {
      toast(
        `Existem ${unanswered.length} questao(oes) nao respondida(s). Responda todas antes de finalizar.`,
        'warning'
      )
      return
    }

    try {
      const { error } = await supabase
        .from('assessments')
        .update({ status: 'review' })
        .eq('id', id)

      if (error) throw error

      toast('Coleta finalizada! Revise as respostas antes de calcular.', 'success')
      router.push(`/avaliacoes/${id}/revisao`)
    } catch (err) {
      console.error(err)
      toast('Erro ao finalizar coleta.', 'error')
    }
  }

  if (loading) {
    return (
      <div className="loading">
        <div className="spinner" />
      </div>
    )
  }

  const isLastFactor = currentFactorIndex === factors.length - 1

  return (
    <>
      <PageHeader
        title="Coleta de Dados"
        breadcrumb="Avaliacoes > Coleta"
      />

      {/* Progress */}
      <div style={{ marginBottom: 16 }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 8,
          }}
        >
          <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
            Fator {currentFactorIndex + 1} de {factors.length}
          </span>
          <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
            {answeredCount}/{totalQuestions} questoes respondidas ({progressPercent}%)
          </span>
        </div>
        <ProgressBar
          value={progressPercent}
          color={progressPercent === 100 ? 'green' : 'orange'}
        />
      </div>

      {/* Factor Stepper */}
      <div style={{ marginBottom: 16 }}>
        <div className="stepper">
          {factors.map((factor, idx) => {
            let className = 'stepper-item'
            if (idx === currentFactorIndex) className += ' active'
            else if (isFactorComplete(idx)) className += ' completed'

            return (
              <div
                key={factor.id}
                className={className}
                onClick={() => {
                  saveCurrentFactor().then(() => {
                    setCurrentFactorIndex(idx)
                    window.scrollTo({ top: 0, behavior: 'smooth' })
                  })
                }}
              >
                <span className="step-num">{idx + 1}</span>
                {factor.code}
              </div>
            )
          })}
        </div>
      </div>

      {/* Current Factor Questions */}
      {currentFactor && (
        <Card>
          <CardHeader>
            {currentFactor.code} - {currentFactor.name}
          </CardHeader>
          <CardBody>
            <p
              style={{
                fontSize: 13,
                color: 'var(--text-muted)',
                marginBottom: 20,
              }}
            >
              Responda cada questao utilizando a escala fornecida. Selecione a
              opcao que melhor representa a realidade do ambiente de trabalho.
            </p>

            {currentQuestions.map((q, qIdx) => {
              const labels =
                SCALE_LABELS[q.scale_type] || SCALE_LABELS.concordance

              return (
                <div key={q.id} className="likert-group">
                  <div className="question-text">
                    {qIdx + 1}. {q.text}
                  </div>
                  <div className="likert-options">
                    {labels.map((label, scoreIdx) => {
                      const score = scoreIdx + 1
                      return (
                        <label key={score}>
                          <input
                            type="radio"
                            name={`q-${q.id}`}
                            value={score}
                            checked={responses[q.id] === score}
                            onChange={() => handleResponseChange(q.id, score)}
                          />
                          <span>{label}</span>
                        </label>
                      )
                    })}
                  </div>
                </div>
              )
            })}

            {/* Factor completion status */}
            {isFactorComplete(currentFactorIndex) && (
              <Alert variant="success">
                Todas as questoes deste fator foram respondidas.
              </Alert>
            )}
          </CardBody>
        </Card>
      )}

      {/* Navigation */}
      <div
        className="btn-group"
        style={{ justifyContent: 'space-between', marginTop: 16 }}
      >
        <Button
          variant="secondary"
          onClick={handlePrevious}
          disabled={currentFactorIndex === 0 || saving}
        >
          Fator Anterior
        </Button>

        <div className="btn-group">
          {isLastFactor ? (
            <Button
              variant="primary"
              onClick={handleFinalizarColeta}
              disabled={saving}
            >
              {saving ? 'Salvando...' : 'Finalizar Coleta'}
            </Button>
          ) : (
            <Button
              variant="primary"
              onClick={handleNext}
              disabled={saving}
            >
              {saving ? 'Salvando...' : 'Proximo Fator'}
            </Button>
          )}
        </div>
      </div>
    </>
  )
}
