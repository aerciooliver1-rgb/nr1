'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/contexts/ToastContext'
import { SCALE_LABELS } from '@/lib/constants'
import { PageHeader } from '@/components/layout/PageHeader'
import { Card, CardBody } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { ProgressBar } from '@/components/ui/ProgressBar'
import { Spinner } from '@/components/ui/Spinner'

interface Factor {
  id: string
  name: string
  code: string
  order_index: number
}

interface Question {
  id: string
  factor_id: string
  text: string
  scale_type: string
  reverse_scored: boolean
  order_index: number
}

interface Response {
  id: string
  question_id: string
  score: number
  valor_normalizado: number
}

export default function QuestionarioPage() {
  const router = useRouter()
  const params = useParams()
  const id = params.id as string
  const supabase = createClient()
  const { toast } = useToast()

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [factors, setFactors] = useState<Factor[]>([])
  const [questions, setQuestions] = useState<Question[]>([])
  const [existingResponses, setExistingResponses] = useState<Response[]>([])
  const [currentFactorIndex, setCurrentFactorIndex] = useState(0)
  const [responses, setResponses] = useState<Record<string, number>>({})
  const [observations, setObservations] = useState<Record<string, string>>({})

  useEffect(() => {
    async function loadData() {
      const [factorsRes, questionsRes, responsesRes, obsRes] =
        await Promise.all([
          supabase
            .from('factors')
            .select('id, name, code, order_index')
            .order('order_index'),
          supabase
            .from('questions')
            .select(
              'id, factor_id, text, scale_type, reverse_scored, order_index'
            )
            .order('order_index'),
          supabase
            .from('responses')
            .select('id, question_id, score, valor_normalizado')
            .eq('assessment_id', id),
          supabase
            .from('observations')
            .select('factor_id, text')
            .eq('assessment_id', id),
        ])

      if (factorsRes.data) setFactors(factorsRes.data)
      if (questionsRes.data) setQuestions(questionsRes.data)
      if (responsesRes.data) {
        setExistingResponses(responsesRes.data)
        const resMap: Record<string, number> = {}
        responsesRes.data.forEach((r) => {
          resMap[r.question_id] = r.score
        })
        setResponses(resMap)
      }
      if (obsRes.data) {
        const obsMap: Record<string, string> = {}
        obsRes.data.forEach((o) => {
          obsMap[o.factor_id] = o.text
        })
        setObservations(obsMap)
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
    (questionId: string, score: number) => {
      setResponses((prev) => ({ ...prev, [questionId]: score }))
    },
    []
  )

  const handleObservationChange = useCallback(
    (factorId: string, text: string) => {
      setObservations((prev) => ({ ...prev, [factorId]: text }))
    },
    []
  )

  async function saveCurrentFactor() {
    if (!currentFactor) return
    setSaving(true)

    try {
      // Save responses for current factor's questions
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
            .from('responses')
            .update({
              score,
              valor_normalizado: valorNormalizado,
            })
            .eq('id', existing.id)
        } else {
          const { data } = await supabase
            .from('responses')
            .insert({
              assessment_id: id,
              question_id: q.id,
              factor_id: currentFactor.id,
              score,
              valor_normalizado: valorNormalizado,
            })
            .select('id, question_id, score, valor_normalizado')
            .single()

          if (data) {
            setExistingResponses((prev) => [...prev, data])
          }
        }
      }

      // Save observation for current factor
      const obsText = observations[currentFactor.id]
      if (obsText !== undefined) {
        const { data: existingObs } = await supabase
          .from('observations')
          .select('id')
          .eq('assessment_id', id)
          .eq('factor_id', currentFactor.id)
          .maybeSingle()

        if (existingObs) {
          await supabase
            .from('observations')
            .update({ text: obsText })
            .eq('id', existingObs.id)
        } else {
          await supabase.from('observations').insert({
            assessment_id: id,
            factor_id: currentFactor.id,
            text: obsText,
          })
        }
      }

      toast('Respostas salvas.', 'success')
    } catch (err) {
      console.error(err)
      toast('Erro ao salvar respostas.', 'error')
    }

    setSaving(false)
  }

  async function handleNext() {
    await saveCurrentFactor()
    if (currentFactorIndex < factors.length - 1) {
      setCurrentFactorIndex((prev) => prev + 1)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } else {
      router.push(`/avaliacoes/${id}/revisao`)
    }
  }

  async function handlePrevious() {
    await saveCurrentFactor()
    if (currentFactorIndex > 0) {
      setCurrentFactorIndex((prev) => prev - 1)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }

  function handleStepClick(index: number) {
    // Save before navigating
    saveCurrentFactor().then(() => {
      setCurrentFactorIndex(index)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    })
  }

  function isFactorCompleted(factorIndex: number) {
    const factor = factors[factorIndex]
    if (!factor) return false
    const factorQuestions = questions.filter(
      (q) => q.factor_id === factor.id
    )
    return factorQuestions.every((q) => responses[q.id] !== undefined)
  }

  if (loading) return <Spinner />

  return (
    <>
      <PageHeader
        title="Questionario NR-1"
        breadcrumb="Avaliacoes > Questionario"
      />

      <p
        style={{
          fontSize: 13,
          color: 'var(--text-secondary)',
          marginBottom: 8,
        }}
      >
        {answeredCount}/{totalQuestions} questoes ({progressPercent}%)
      </p>
      <ProgressBar
        value={progressPercent}
        color={progressPercent === 100 ? 'green' : 'orange'}
      />

      <div style={{ marginTop: 16, marginBottom: 16 }}>
        <div className="stepper">
          {factors.map((factor, idx) => {
            let className = 'stepper-item'
            if (idx === currentFactorIndex) className += ' active'
            else if (isFactorCompleted(idx)) className += ' completed'

            return (
              <div
                key={factor.id}
                className={className}
                onClick={() => handleStepClick(idx)}
              >
                <span className="step-num">{idx + 1}</span>
                {factor.code}
              </div>
            )
          })}
        </div>
      </div>

      {currentFactor && (
        <Card>
          <CardBody>
            <h3
              style={{
                fontSize: 16,
                fontWeight: 700,
                marginBottom: 4,
                color: 'var(--text)',
              }}
            >
              {currentFactor.name}
            </h3>
            <p
              style={{
                fontSize: 12,
                color: 'var(--text-muted)',
                marginBottom: 20,
              }}
            >
              Fator {currentFactorIndex + 1} de {factors.length}
            </p>

            {currentQuestions.map((q) => {
              const labels =
                SCALE_LABELS[q.scale_type] || SCALE_LABELS.concordance

              return (
                <div key={q.id} className="likert-group">
                  <div className="question-text">{q.text}</div>
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
                            onChange={() =>
                              handleResponseChange(q.id, score)
                            }
                          />
                          <span>{label}</span>
                        </label>
                      )
                    })}
                  </div>
                </div>
              )
            })}

            <div style={{ marginTop: 20 }}>
              <div className="form-group">
                <label>Observacoes sobre {currentFactor.name}</label>
                <textarea
                  value={observations[currentFactor.id] || ''}
                  onChange={(e) =>
                    handleObservationChange(
                      currentFactor.id,
                      e.target.value
                    )
                  }
                  placeholder="Observacoes opcionais sobre este fator..."
                />
              </div>
            </div>
          </CardBody>
        </Card>
      )}

      <div
        className="btn-group"
        style={{ justifyContent: 'space-between', marginTop: 16 }}
      >
        <Button
          variant="secondary"
          onClick={handlePrevious}
          disabled={currentFactorIndex === 0 || saving}
        >
          Anterior
        </Button>
        <Button
          variant="primary"
          onClick={handleNext}
          disabled={saving}
        >
          {saving
            ? 'Salvando...'
            : currentFactorIndex === factors.length - 1
              ? 'Finalizar'
              : 'Proximo'}
        </Button>
      </div>
    </>
  )
}
