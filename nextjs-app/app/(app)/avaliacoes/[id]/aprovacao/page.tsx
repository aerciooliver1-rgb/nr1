'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/contexts/ToastContext'
import { fmtDate, fmtApproval } from '@/lib/utils'
import { PageHeader } from '@/components/layout/PageHeader'
import { Card, CardHeader, CardBody } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Alert } from '@/components/ui/Alert'
import { FormGroup } from '@/components/forms/FormGroup'
import { FormRow } from '@/components/forms/FormRow'
import { Spinner } from '@/components/ui/Spinner'

interface ActionPlanRow {
  id: string
  assessment_id: string
  approval_status: string
  approval_notes: string | null
  approver_name: string | null
  approver_role: string | null
  approved_by: string | null
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

function getApprovalVariant(
  status: string
): 'aprovado' | 'com_ressalvas' | 'em_revisao' | 'pendente' {
  switch (status) {
    case 'aprovado':
      return 'aprovado'
    case 'com_ressalvas':
      return 'com_ressalvas'
    case 'em_revisao':
      return 'em_revisao'
    default:
      return 'pendente'
  }
}

function getPriorityVariant(p: string): 'baixo' | 'moderado' | 'alto' | 'critico' {
  if (p === 'baixo' || p === 'moderado' || p === 'alto' || p === 'critico') return p
  return 'moderado'
}

export default function AprovacaoPage() {
  const router = useRouter()
  const params = useParams()
  const id = params.id as string
  const supabase = createClient()
  const { currentUser } = useAuth()
  const { toast } = useToast()

  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [plan, setPlan] = useState<ActionPlanRow | null>(null)
  const [items, setItems] = useState<ActionItemRow[]>([])
  const [approverName, setApproverName] = useState('')
  const [approverRole, setApproverRole] = useState('')
  const [notes, setNotes] = useState('')
  const [showNotesField, setShowNotesField] = useState(false)

  const loadData = useCallback(async () => {
    const { data: planData } = await supabase
      .from('action_plans')
      .select(
        'id, assessment_id, approval_status, approval_notes, approver_name, approver_role, approved_by, approved_at'
      )
      .eq('assessment_id', id)
      .maybeSingle()

    if (planData) {
      const typedPlan = planData as unknown as ActionPlanRow
      setPlan(typedPlan)

      if (typedPlan.approver_name) setApproverName(typedPlan.approver_name)
      if (typedPlan.approver_role) setApproverRole(typedPlan.approver_role)
      if (typedPlan.approval_notes) setNotes(typedPlan.approval_notes)

      // Fetch action items
      const { data: itemsData } = await supabase
        .from('action_items')
        .select(
          'id, description, action_type, priority, status, responsible_name, due_date, completion_pct'
        )
        .eq('action_plan_id', typedPlan.id)
        .order('priority')

      if (itemsData) setItems(itemsData as unknown as ActionItemRow[])
    }

    setLoading(false)
  }, [id, supabase])

  useEffect(() => {
    loadData()
  }, [loadData])

  const canApprove =
    plan &&
    (plan.approval_status === 'pendente' || plan.approval_status === 'em_revisao')

  const isApproved =
    plan &&
    (plan.approval_status === 'aprovado' || plan.approval_status === 'com_ressalvas')

  async function handleApproval(status: 'aprovado' | 'com_ressalvas' | 'em_revisao') {
    if (!plan) {
      toast('Plano de acao nao encontrado.', 'error')
      return
    }

    if (!approverName.trim()) {
      toast('Informe o nome do aprovador.', 'warning')
      return
    }

    if (!approverRole.trim()) {
      toast('Informe o cargo do aprovador.', 'warning')
      return
    }

    if (status === 'com_ressalvas' && !notes.trim()) {
      toast('Informe as ressalvas para aprovacao com ressalvas.', 'warning')
      return
    }

    if (status === 'em_revisao' && !notes.trim()) {
      toast('Informe o motivo da solicitacao de revisao.', 'warning')
      return
    }

    setSubmitting(true)

    try {
      const { error } = await supabase
        .from('action_plans')
        .update({
          approval_status: status,
          approval_notes: notes || null,
          approver_name: approverName,
          approver_role: approverRole,
          approved_by: currentUser?.id || null,
          approved_at: new Date().toISOString(),
        })
        .eq('id', plan.id)

      if (error) throw error

      setPlan((prev) =>
        prev
          ? {
              ...prev,
              approval_status: status,
              approval_notes: notes || null,
              approver_name: approverName,
              approver_role: approverRole,
              approved_at: new Date().toISOString(),
            }
          : null
      )

      const statusLabel =
        status === 'aprovado'
          ? 'aprovado'
          : status === 'com_ressalvas'
            ? 'aprovado com ressalvas'
            : 'devolvido para revisao'

      toast(`Plano ${statusLabel} com sucesso!`, 'success')
    } catch (err) {
      console.error(err)
      toast('Erro ao registrar decisao de aprovacao.', 'error')
    }

    setSubmitting(false)
  }

  if (loading) return <Spinner />

  if (!plan) {
    return (
      <>
        <PageHeader
          title="Aprovacao do Plano"
          breadcrumb="Avaliacoes > Aprovacao"
        />
        <Alert variant="warning">
          Plano de acao nao encontrado para esta avaliacao. Retorne a etapa de
          plano de acao para criar um.
        </Alert>
        <div className="btn-group" style={{ justifyContent: 'flex-end' }}>
          <Button
            variant="secondary"
            onClick={() => router.push(`/avaliacoes/${id}/plano`)}
          >
            Ir para Plano de Acao
          </Button>
        </div>
      </>
    )
  }

  return (
    <>
      <PageHeader
        title="Aprovacao do Plano"
        breadcrumb="Avaliacoes > Apresentacao > Aprovacao"
      />

      {/* Approval status card */}
      <Card>
        <CardHeader>Status da Aprovacao</CardHeader>
        <CardBody>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 16,
              marginBottom: isApproved ? 16 : 0,
            }}
          >
            <span
              style={{
                fontSize: 13,
                color: 'var(--text-secondary)',
              }}
            >
              Status atual:
            </span>
            <Badge variant={getApprovalVariant(plan.approval_status)}>
              {fmtApproval(plan.approval_status)}
            </Badge>
          </div>

          {isApproved && (
            <div
              style={{
                padding: '16px 20px',
                background: 'var(--bg-surface)',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--border)',
              }}
            >
              <div style={{ marginBottom: 8 }}>
                <span
                  style={{
                    fontSize: 11,
                    textTransform: 'uppercase',
                    letterSpacing: '0.08em',
                    color: 'var(--text-muted)',
                  }}
                >
                  Aprovado por
                </span>
                <p style={{ fontSize: 14, color: 'var(--text)', marginTop: 2 }}>
                  {plan.approver_name}
                  {plan.approver_role && (
                    <span
                      style={{
                        fontSize: 12,
                        color: 'var(--text-secondary)',
                        marginLeft: 8,
                      }}
                    >
                      ({plan.approver_role})
                    </span>
                  )}
                </p>
              </div>
              {plan.approved_at && (
                <div style={{ marginBottom: 8 }}>
                  <span
                    style={{
                      fontSize: 11,
                      textTransform: 'uppercase',
                      letterSpacing: '0.08em',
                      color: 'var(--text-muted)',
                    }}
                  >
                    Data da aprovacao
                  </span>
                  <p style={{ fontSize: 14, color: 'var(--text)', marginTop: 2 }}>
                    {fmtDate(plan.approved_at)}
                  </p>
                </div>
              )}
              {plan.approval_notes && (
                <div>
                  <span
                    style={{
                      fontSize: 11,
                      textTransform: 'uppercase',
                      letterSpacing: '0.08em',
                      color: 'var(--text-muted)',
                    }}
                  >
                    Observacoes
                  </span>
                  <p
                    style={{
                      fontSize: 13,
                      color: 'var(--text-secondary)',
                      marginTop: 2,
                      lineHeight: 1.6,
                    }}
                  >
                    {plan.approval_notes}
                  </p>
                </div>
              )}
            </div>
          )}
        </CardBody>
      </Card>

      {/* Approval form (only when pending or in review) */}
      {canApprove && (
        <Card>
          <CardHeader>Decisao de Aprovacao</CardHeader>
          <CardBody>
            <FormRow>
              <FormGroup label="Nome do Aprovador">
                <input
                  type="text"
                  value={approverName}
                  onChange={(e) => setApproverName(e.target.value)}
                  placeholder="Nome completo do aprovador"
                />
              </FormGroup>
              <FormGroup label="Cargo do Aprovador">
                <input
                  type="text"
                  value={approverRole}
                  onChange={(e) => setApproverRole(e.target.value)}
                  placeholder="Cargo ou funcao"
                />
              </FormGroup>
            </FormRow>

            <FormGroup label="Observacoes / Ressalvas">
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Informe observacoes, ressalvas ou motivo de revisao (obrigatorio para aprovacao com ressalvas ou solicitacao de revisao)"
                rows={4}
              />
            </FormGroup>

            <div
              className="btn-group"
              style={{ justifyContent: 'flex-end', marginTop: 16 }}
            >
              <Button
                variant="danger"
                onClick={() => handleApproval('em_revisao')}
                disabled={submitting}
              >
                Solicitar Revisao
              </Button>
              <Button
                variant="secondary"
                onClick={() => handleApproval('com_ressalvas')}
                disabled={submitting}
              >
                Aprovar com Ressalvas
              </Button>
              <Button
                variant="primary"
                onClick={() => handleApproval('aprovado')}
                disabled={submitting}
              >
                {submitting ? 'Registrando...' : 'Aprovar'}
              </Button>
            </div>
          </CardBody>
        </Card>
      )}

      {/* Action items summary */}
      <Card>
        <CardHeader>Resumo do Plano de Acao</CardHeader>
        <CardBody>
          {items.length === 0 ? (
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
                  {items.map((item) => (
                    <tr key={item.id}>
                      <td>
                        <strong>{item.description}</strong>
                      </td>
                      <td>
                        {ACTION_TYPE_LABELS[item.action_type] ||
                          item.action_type}
                      </td>
                      <td>
                        <Badge variant={getPriorityVariant(item.priority)}>
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

      {/* Navigation */}
      <div className="btn-group" style={{ justifyContent: 'flex-end' }}>
        <Button
          variant="secondary"
          onClick={() => router.push(`/avaliacoes/${id}/apresentacao`)}
        >
          Voltar a Apresentacao
        </Button>
        {isApproved && (
          <Button
            variant="primary"
            onClick={() => router.push(`/avaliacoes`)}
          >
            Concluir
          </Button>
        )}
      </div>
    </>
  )
}
