'use client'

import { useState, useEffect, useMemo } from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Card, CardBody } from '@/components/ui/Card'
import { Alert } from '@/components/ui/Alert'
import { ProgressBar } from '@/components/ui/ProgressBar'
import { SCALE_LABELS } from '@/lib/constants'

type SurveyState = 'loading' | 'error' | 'consent' | 'questions' | 'confirm' | 'done'

interface SessaoAnonima {
  token: string
  assessment_id: string
  status: string
  concluida_em: string | null
}

interface AssessmentInfo {
  id: string
  status: string
  companies?: { name: string }
  sectors?: { name: string }
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
  order_index: number
}

interface FactorWithQuestions {
  factor: Factor
  questions: Question[]
}

export default function SurveyTokenPage() {
  const params = useParams()
  const token = params.token as string

  const [state, setState] = useState<SurveyState>('loading')
  const [errorMessage, setErrorMessage] = useState('')
  const [sessao, setSessao] = useState<SessaoAnonima | null>(null)
  const [assessmentInfo, setAssessmentInfo] = useState<AssessmentInfo | null>(null)
  const [factorsWithQuestions, setFactorsWithQuestions] = useState<FactorWithQuestions[]>([])
  const [currentFactorIdx, setCurrentFactorIdx] = useState(0)
  const [responses, setResponses] = useState<Record<number, number>>({})
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    async function loadSessao() {
      const sb = createClient()

      const { data: sessaoData, error: sessaoError } = await sb
        .from('sessoes_anonimas')
        .select('*')
        .eq('token', token)
        .single()

      if (sessaoError || !sessaoData) {
        setErrorMessage('Link invalido ou sessao nao encontrada.')
        setState('error')
        return
      }

      const sessaoRow = sessaoData as SessaoAnonima

      if (sessaoRow.status === 'concluida' || sessaoRow.concluida_em) {
        setErrorMessage('Esta pesquisa ja foi respondida. Obrigado pela participacao!')
        setState('error')
        return
      }

      setSessao(sessaoRow)

      const { data: assessmentData, error: assessmentError } = await sb
        .from('assessments')
        .select('id, status, companies(name), sectors(name)')
        .eq('id', sessaoRow.assessment_id)
        .single()

      if (assessmentError || !assessmentData) {
        setErrorMessage('Avaliacao nao encontrada.')
        setState('error')
        return
      }

      const info = assessmentData as unknown as AssessmentInfo

      if (info.status !== 'coletando') {
        setErrorMessage('Esta avaliacao nao esta recebendo respostas no momento.')
        setState('error')
        return
      }

      setAssessmentInfo(info)
      setState('consent')
    }

    loadSessao()
  }, [token])

  async function loadQuestions() {
    const sb = createClient()

    const [factorsRes, questionsRes] = await Promise.all([
      sb.from('factors').select('*').order('order_index', { ascending: true }),
      sb.from('questions').select('*').order('order_index', { ascending: true }),
    ])

    if (!factorsRes.data || !questionsRes.data) {
      setErrorMessage('Erro ao carregar questionario.')
      setState('error')
      return
    }

    const factors = factorsRes.data as Factor[]
    const questions = questionsRes.data as Question[]

    const grouped: FactorWithQuestions[] = factors
      .map((f) => ({
        factor: f,
        questions: questions.filter((q) => q.factor_id === f.id),
      }))
      .filter((g) => g.questions.length > 0)

    setFactorsWithQuestions(grouped)
  }

  function handleResponse(questionId: number, value: number) {
    setResponses((prev) => ({ ...prev, [questionId]: value }))
  }

  function currentFactor(): FactorWithQuestions | null {
    return factorsWithQuestions[currentFactorIdx] ?? null
  }

  function allCurrentAnswered(): boolean {
    const cf = currentFactor()
    if (!cf) return false
    return cf.questions.every((q) => responses[q.id] !== undefined)
  }

  function allAnswered(): boolean {
    return factorsWithQuestions.every((g) =>
      g.questions.every((q) => responses[q.id] !== undefined)
    )
  }

  const totalQuestions = useMemo(
    () => factorsWithQuestions.reduce((acc, g) => acc + g.questions.length, 0),
    [factorsWithQuestions]
  )

  const answeredCount = useMemo(
    () => Object.keys(responses).length,
    [responses]
  )

  function progressPct(): number {
    if (totalQuestions === 0) return 0
    return Math.round((answeredCount / totalQuestions) * 100)
  }

  function handleNext() {
    if (!allCurrentAnswered()) return
    if (currentFactorIdx < factorsWithQuestions.length - 1) {
      setCurrentFactorIdx((prev) => prev + 1)
    } else if (allAnswered()) {
      setState('confirm')
    }
  }

  function handlePrev() {
    if (currentFactorIdx > 0) {
      setCurrentFactorIdx((prev) => prev - 1)
    }
  }

  function normalizeValue(score: number, reverseScored: boolean): number {
    const normalized = reverseScored ? 100 - ((score - 1) / 4) * 100 : ((score - 1) / 4) * 100
    return Math.round(normalized * 100) / 100
  }

  async function handleSubmit() {
    if (submitting || !sessao) return
    setSubmitting(true)

    try {
      const sb = createClient()

      const responseRows = Object.entries(responses).map(([questionIdStr, score]) => {
        const questionId = Number(questionIdStr)
        const question = factorsWithQuestions
          .flatMap((g) => g.questions)
          .find((q) => q.id === questionId)

        const valorNormalizado = question
          ? normalizeValue(score, question.reverse_scored)
          : ((score - 1) / 4) * 100

        return {
          assessment_id: sessao.assessment_id,
          question_id: questionId,
          score,
          valor_normalizado: valorNormalizado,
          sessao_anonima: token,
        }
      })

      const { error: respError } = await sb
        .from('assessment_responses')
        .insert(responseRows)

      if (respError) {
        setErrorMessage('Erro ao salvar respostas. Tente novamente.')
        setState('error')
        setSubmitting(false)
        return
      }

      const { error: updateError } = await sb
        .from('sessoes_anonimas')
        .update({ status: 'concluida', concluida_em: new Date().toISOString() })
        .eq('token', token)

      if (updateError) {
        setErrorMessage('Respostas salvas, mas erro ao finalizar sessao.')
        setState('error')
        setSubmitting(false)
        return
      }

      setState('done')
    } catch {
      setErrorMessage('Erro inesperado. Tente novamente.')
      setState('error')
    }
    setSubmitting(false)
  }

  async function handleConsent() {
    await loadQuestions()
    setState('questions')
  }

  if (state === 'loading') {
    return (
      <div className="survey-container">
        <div className="loading">
          <div className="spinner" />
        </div>
      </div>
    )
  }

  if (state === 'error') {
    return (
      <div className="survey-container">
        <div className="survey-header">
          <h1>DRPS NR-1 — Pesquisa Anonima</h1>
          <p>Avaliacao de Riscos Psicossociais</p>
        </div>
        <Alert variant="danger">{errorMessage}</Alert>
      </div>
    )
  }

  if (state === 'consent') {
    return (
      <div className="survey-container">
        <div className="survey-header">
          <h1>DRPS NR-1 — Pesquisa Anonima</h1>
          <p>Avaliacao de Riscos Psicossociais</p>
        </div>

        <Card>
          <CardBody>
            <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 16, textAlign: 'center' }}>
              Termo de Anonimato
            </h2>

            <div className="anonymity-banner">
              <strong>Suas respostas sao completamente anonimas</strong>
              Nenhuma informacao pessoal sera coletada ou vinculada as suas respostas.
              Os dados serao utilizados exclusivamente para fins de avaliacao dos riscos
              psicossociais no ambiente de trabalho, conforme previsto na NR-1.
            </div>

            {assessmentInfo && (
              <div style={{ textAlign: 'center', marginBottom: 24, fontSize: 13, color: 'var(--text-secondary)' }}>
                <p><strong>Empresa:</strong> {assessmentInfo.companies?.name ?? '—'}</p>
                <p><strong>Setor:</strong> {assessmentInfo.sectors?.name ?? '—'}</p>
              </div>
            )}

            <div style={{ textAlign: 'center' }}>
              <button className="btn btn-primary" onClick={handleConsent}>
                Entendi e quero responder
              </button>
            </div>
          </CardBody>
        </Card>
      </div>
    )
  }

  if (state === 'questions') {
    const cf = currentFactor()

    return (
      <div className="survey-container">
        <div className="survey-header">
          <h1>DRPS NR-1 — Pesquisa Anonima</h1>
          <p>
            {assessmentInfo?.companies?.name} — {assessmentInfo?.sectors?.name}
          </p>
        </div>

        <div style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--text-muted)', marginBottom: 6 }}>
            <span>Progresso</span>
            <span>{progressPct()}%</span>
          </div>
          <ProgressBar value={progressPct()} color={progressPct() >= 70 ? 'green' : progressPct() >= 40 ? 'orange' : 'red'} />
        </div>

        {cf && (
          <Card>
            <CardBody>
              <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 4 }}>
                {cf.factor.name}
              </h3>
              <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 20 }}>
                Fator {currentFactorIdx + 1} de {factorsWithQuestions.length}
              </p>

              {cf.questions.map((q) => {
                const labels = SCALE_LABELS[q.scale_type] ?? SCALE_LABELS.frequency
                return (
                  <div key={q.id} className="likert-group">
                    <div className="question-text">{q.text}</div>
                    <div className="likert-options">
                      {labels.map((label, idx) => {
                        const value = idx + 1
                        return (
                          <label key={idx}>
                            <input
                              type="radio"
                              name={`q_${q.id}`}
                              checked={responses[q.id] === value}
                              onChange={() => handleResponse(q.id, value)}
                            />
                            <span>{label}</span>
                          </label>
                        )
                      })}
                    </div>
                  </div>
                )
              })}

              <div className="btn-group" style={{ marginTop: 16, justifyContent: 'space-between' }}>
                <button
                  className="btn btn-secondary"
                  onClick={handlePrev}
                  disabled={currentFactorIdx === 0}
                >
                  Anterior
                </button>
                <button
                  className="btn btn-primary"
                  onClick={handleNext}
                  disabled={!allCurrentAnswered()}
                >
                  {currentFactorIdx === factorsWithQuestions.length - 1 ? 'Finalizar' : 'Proximo'}
                </button>
              </div>
            </CardBody>
          </Card>
        )}
      </div>
    )
  }

  if (state === 'confirm') {
    return (
      <div className="survey-container">
        <div className="survey-header">
          <h1>DRPS NR-1 — Pesquisa Anonima</h1>
          <p>
            {assessmentInfo?.companies?.name} — {assessmentInfo?.sectors?.name}
          </p>
        </div>

        <Card>
          <CardBody>
            <div style={{ textAlign: 'center' }}>
              <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 12 }}>
                Confirmar envio
              </h2>
              <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 24 }}>
                Voce respondeu todas as {totalQuestions} questoes. Apos o envio, nao sera
                possivel alterar suas respostas. Confirme se deseja enviar.
              </p>
              <div className="btn-group" style={{ justifyContent: 'center' }}>
                <button
                  className="btn btn-primary"
                  onClick={handleSubmit}
                  disabled={submitting}
                >
                  {submitting ? 'Enviando...' : 'Enviar respostas'}
                </button>
                <button
                  className="btn btn-secondary"
                  onClick={() => {
                    setState('questions')
                    setCurrentFactorIdx(0)
                  }}
                >
                  Revisar respostas
                </button>
              </div>
            </div>
          </CardBody>
        </Card>
      </div>
    )
  }

  if (state === 'done') {
    return (
      <div className="survey-container">
        <div className="survey-header">
          <h1>DRPS NR-1 — Pesquisa Anonima</h1>
          <p>Avaliacao de Riscos Psicossociais</p>
        </div>

        <Card>
          <CardBody>
            <div style={{ textAlign: 'center', padding: '40px 20px' }}>
              <div style={{ fontSize: 48, marginBottom: 16 }}>&#10003;</div>
              <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>
                Obrigado pela participacao!
              </h2>
              <p style={{ fontSize: 14, color: 'var(--text-secondary)' }}>
                Suas respostas foram enviadas com sucesso. Elas serao utilizadas de forma
                anonima para a avaliacao dos riscos psicossociais do seu setor de trabalho.
              </p>
              <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 12 }}>
                Voce pode fechar esta pagina.
              </p>
            </div>
          </CardBody>
        </Card>
      </div>
    )
  }

  return null
}
