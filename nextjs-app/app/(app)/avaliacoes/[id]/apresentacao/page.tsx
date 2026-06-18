'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/contexts/ToastContext'
import { fmtDate } from '@/lib/utils'
import { PageHeader } from '@/components/layout/PageHeader'
import { Card, CardHeader, CardBody } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Alert } from '@/components/ui/Alert'
import { Spinner } from '@/components/ui/Spinner'

interface AssessmentRow {
  id: string
  cycle_number: number
  status: string
  indice_risco_geral: number
  nivel_risco_geral: string
  created_at: string
  companies: { name: string } | null
  sectors: { name: string; num_trabalhadores: number } | null
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
    name: string
    code: string
    dimension: string
    consequence: string
  } | null
}

interface InterventionRow {
  id: string
  catalog_id: string | null
  custom_name: string | null
  custom_description: string | null
  intervention_catalog: {
    name: string
    objetivo: string
    description: string
    modalidade: string
    duracao: string
  } | null
  risk_scores: {
    classification: string
    factors: {
      name: string
      code: string
    } | null
  } | null
}

interface ActionPlanRow {
  id: string
  approval_status: string
  approval_notes: string | null
  approver_name: string | null
  approver_role: string | null
  approved_at: string | null
}

interface ActionItemRow {
  id: string
  description: string
  action_type: string
  priority: string
  status: string
  responsible_name: string
  due_date: string | null
  completion_pct: number
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

const ACTION_TYPE_LABELS: Record<string, string> = {
  eliminacao: 'Eliminacao',
  reducao: 'Reducao',
  controle: 'Controle',
  epi: 'EPI',
}

const PRIORITY_LABELS: Record<string, string> = {
  baixo: 'Baixo',
  moderado: 'Moderado',
  alto: 'Alto',
  critico: 'Critico',
}

const STATUS_LABELS: Record<string, string> = {
  pendente: 'Pendente',
  em_andamento: 'Em andamento',
  concluida: 'Concluida',
  atrasada: 'Atrasada',
}

export default function ApresentacaoPage() {
  const router = useRouter()
  const params = useParams()
  const id = params.id as string
  const supabase = createClient()
  const { toast } = useToast()

  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [assessment, setAssessment] = useState<AssessmentRow | null>(null)
  const [riskScores, setRiskScores] = useState<RiskScoreRow[]>([])
  const [interventions, setInterventions] = useState<InterventionRow[]>([])
  const [actionPlan, setActionPlan] = useState<ActionPlanRow | null>(null)
  const [actionItems, setActionItems] = useState<ActionItemRow[]>([])

  const loadData = useCallback(async () => {
    const [assessmentRes, scoresRes, interventionsRes, planRes] =
      await Promise.all([
        supabase
          .from('assessments')
          .select(
            'id, cycle_number, status, indice_risco_geral, nivel_risco_geral, created_at, companies(name), sectors(name, num_trabalhadores)'
          )
          .eq('id', id)
          .single(),
        supabase
          .from('risk_scores')
          .select(
            'id, factor_id, raw_score, severity, probability, final_score, classification, factors(name, code, dimension, consequence)'
          )
          .eq('assessment_id', id)
          .order('final_score', { ascending: false }),
        supabase
          .from('assessment_interventions')
          .select(
            'id, catalog_id, custom_name, custom_description, intervention_catalog(name, objetivo, description, modalidade, duracao), risk_scores(classification, factors(name, code))'
          )
          .eq('assessment_id', id),
        supabase
          .from('action_plans')
          .select(
            'id, approval_status, approval_notes, approver_name, approver_role, approved_at'
          )
          .eq('assessment_id', id)
          .maybeSingle(),
      ])

    if (assessmentRes.data)
      setAssessment(assessmentRes.data as unknown as AssessmentRow)
    if (scoresRes.data)
      setRiskScores(scoresRes.data as unknown as RiskScoreRow[])
    if (interventionsRes.data)
      setInterventions(interventionsRes.data as unknown as InterventionRow[])

    if (planRes.data) {
      const plan = planRes.data as unknown as ActionPlanRow
      setActionPlan(plan)

      const { data: itemsData } = await supabase
        .from('action_items')
        .select(
          'id, description, action_type, priority, status, responsible_name, due_date, completion_pct'
        )
        .eq('action_plan_id', plan.id)
        .order('priority')

      if (itemsData) setActionItems(itemsData as unknown as ActionItemRow[])
    }

    setLoading(false)
  }, [id, supabase])

  useEffect(() => {
    loadData()
  }, [loadData])

  async function handleSendForApproval() {
    if (!actionPlan) {
      toast('Plano de acao nao encontrado.', 'error')
      return
    }

    setSubmitting(true)

    try {
      const { error } = await supabase
        .from('action_plans')
        .update({ approval_status: 'pendente' })
        .eq('id', actionPlan.id)

      if (error) throw error

      toast('Plano enviado para aprovacao com sucesso!', 'success')
      router.push(`/avaliacoes/${id}/aprovacao`)
    } catch (err) {
      console.error(err)
      toast('Erro ao enviar para aprovacao.', 'error')
      setSubmitting(false)
    }
  }

  if (loading) return <Spinner />

  if (!assessment) {
    toast('Avaliacao nao encontrada.', 'error')
    return null
  }

  const riskLevel = assessment.nivel_risco_geral || 'moderado'
  const companyName = assessment.companies?.name || 'Empresa'
  const sectorName = assessment.sectors?.name || 'Setor'
  const numWorkers = assessment.sectors?.num_trabalhadores || 0

  return (
    <>
      <PageHeader
        title="Apresentacao do Diagnostico"
        breadcrumb="Avaliacoes > Plano de Acao > Apresentacao"
      >
        <Button
          variant="secondary"
          onClick={() => window.print()}
        >
          Imprimir Relatorio
        </Button>
      </PageHeader>

      {/* Report header */}
      <Card>
        <CardBody>
          <div
            style={{
              background:
                'linear-gradient(135deg, #1A1A1A 0%, #252525 50%, #1A1A1A 100%)',
              borderRadius: 'var(--radius-md)',
              padding: '40px 32px',
              textAlign: 'center',
              border: '1px solid var(--border)',
            }}
          >
            <div
              style={{
                fontSize: 10,
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.15em',
                color: 'var(--accent)',
                marginBottom: 12,
              }}
            >
              Diagnostico de Riscos Psicossociais — NR-1
            </div>
            <h2
              style={{
                fontSize: 28,
                fontWeight: 800,
                color: 'var(--text)',
                letterSpacing: '-0.03em',
                marginBottom: 8,
              }}
            >
              {companyName}
            </h2>
            <p
              style={{
                fontSize: 14,
                color: 'var(--text-secondary)',
                marginBottom: 4,
              }}
            >
              {sectorName} — {numWorkers} trabalhador(es) — Ciclo{' '}
              {assessment.cycle_number}
            </p>
            <p
              style={{
                fontSize: 12,
                color: 'var(--text-muted)',
              }}
            >
              {new Date(assessment.created_at).toLocaleDateString('pt-BR', {
                day: '2-digit',
                month: 'long',
                year: 'numeric',
              })}
            </p>
          </div>
        </CardBody>
      </Card>

      {/* Overall risk summary */}
      <Card>
        <CardHeader>Resumo Geral de Risco</CardHeader>
        <CardBody>
          <div className={`risk-indicator ${riskLevel}`}>
            <div className="risk-score">
              {Math.round(assessment.indice_risco_geral)}
            </div>
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
        </CardBody>
      </Card>

      {/* Risk factors table */}
      <Card>
        <CardHeader>Fatores de Risco</CardHeader>
        <CardBody>
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Codigo</th>
                  <th>Fator</th>
                  <th>Dimensao</th>
                  <th>Score</th>
                  <th>Classificacao</th>
                </tr>
              </thead>
              <tbody>
                {riskScores.map((rs, idx) => (
                  <tr key={rs.id}>
                    <td>
                      <strong>{idx + 1}</strong>
                    </td>
                    <td>
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 600,
                          color: 'var(--text-secondary)',
                        }}
                      >
                        {rs.factors?.code}
                      </span>
                    </td>
                    <td>
                      <strong>{rs.factors?.name || '—'}</strong>
                    </td>
                    <td>{rs.factors?.dimension || '—'}</td>
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
                        variant={
                          rs.classification as
                            | 'baixo'
                            | 'moderado'
                            | 'alto'
                            | 'critico'
                        }
                      >
                        {CLASSIFICATION_LABELS[rs.classification] ||
                          rs.classification}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardBody>
      </Card>

      {/* Selected interventions */}
      <Card>
        <CardHeader>Intervencoes Selecionadas</CardHeader>
        <CardBody>
          {interventions.length === 0 ? (
            <p
              style={{
                fontSize: 13,
                color: 'var(--text-muted)',
                textAlign: 'center',
                padding: 24,
              }}
            >
              Nenhuma intervencao selecionada para esta avaliacao.
            </p>
          ) : (
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Intervencao</th>
                    <th>Objetivo</th>
                    <th>Fator Alvo</th>
                    <th>Modalidade</th>
                    <th>Duracao</th>
                  </tr>
                </thead>
                <tbody>
                  {interventions.map((interv) => (
                    <tr key={interv.id}>
                      <td>
                        <strong>
                          {interv.intervention_catalog?.name ||
                            interv.custom_name ||
                            'Intervencao personalizada'}
                        </strong>
                      </td>
                      <td
                        style={{
                          fontSize: 12,
                          color: 'var(--text-secondary)',
                          maxWidth: 220,
                        }}
                      >
                        {interv.intervention_catalog?.objetivo || '—'}
                      </td>
                      <td>
                        {interv.risk_scores?.factors?.code} —{' '}
                        {interv.risk_scores?.factors?.name}
                      </td>
                      <td>
                        {interv.intervention_catalog?.modalidade || '—'}
                      </td>
                      <td>
                        {interv.intervention_catalog?.duracao || '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardBody>
      </Card>

      {/* Action plan summary */}
      <Card>
        <CardHeader
          action={
            actionPlan ? (
              <Badge
                variant={
                  (actionPlan.approval_status as
                    | 'pendente'
                    | 'aprovado'
                    | 'com_ressalvas'
                    | 'em_revisao') || 'pendente'
                }
              >
                {CLASSIFICATION_LABELS[actionPlan.approval_status] ||
                  actionPlan.approval_status}
              </Badge>
            ) : undefined
          }
        >
          Plano de Acao
        </CardHeader>
        <CardBody>
          {actionItems.length === 0 ? (
            <p
              style={{
                fontSize: 13,
                color: 'var(--text-muted)',
                textAlign: 'center',
                padding: 24,
              }}
            >
              Nenhum item no plano de acao.
            </p>
          ) : (
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Acao</th>
                    <th>Tipo</th>
                    <th>Prioridade</th>
                    <th>Responsavel</th>
                    <th>Prazo</th>
                    <th>Status</th>
                    <th>Conclusao</th>
                  </tr>
                </thead>
                <tbody>
                  {actionItems.map((item) => (
                    <tr key={item.id}>
                      <td>
                        <strong>{item.description}</strong>
                      </td>
                      <td>
                        {ACTION_TYPE_LABELS[item.action_type] ||
                          item.action_type}
                      </td>
                      <td>
                        <Badge
                          variant={
                            item.priority as
                              | 'baixo'
                              | 'moderado'
                              | 'alto'
                              | 'critico'
                          }
                        >
                          {PRIORITY_LABELS[item.priority] || item.priority}
                        </Badge>
                      </td>
                      <td>{item.responsible_name}</td>
                      <td>{fmtDate(item.due_date)}</td>
                      <td>
                        <Badge
                          variant={
                            item.status as
                              | 'pendente'
                              | 'em_andamento'
                              | 'concluida'
                              | 'atrasada'
                          }
                        >
                          {STATUS_LABELS[item.status] || item.status}
                        </Badge>
                      </td>
                      <td>{item.completion_pct}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardBody>
      </Card>

      {/* Action buttons */}
      <div className="btn-group" style={{ justifyContent: 'flex-end' }}>
        <Button
          variant="secondary"
          onClick={() => router.push(`/avaliacoes/${id}/plano`)}
        >
          Voltar ao Plano
        </Button>
        <Button
          variant="primary"
          onClick={handleSendForApproval}
          disabled={submitting || !actionPlan}
        >
          {submitting ? 'Enviando...' : 'Enviar para Aprovacao'}
        </Button>
      </div>
    </>
  )
}
