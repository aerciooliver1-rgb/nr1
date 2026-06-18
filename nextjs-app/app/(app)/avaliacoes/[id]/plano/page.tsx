'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/contexts/ToastContext'
import { fmtDate, fmtStatus } from '@/lib/utils'
import { PageHeader } from '@/components/layout/PageHeader'
import { Card, CardHeader, CardBody } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { FormGroup } from '@/components/forms/FormGroup'
import { FormRow } from '@/components/forms/FormRow'
import { EmptyState } from '@/components/ui/EmptyState'
import { Spinner } from '@/components/ui/Spinner'

interface InterventionRow {
  id: string
  risk_score_id: string
  catalog_id: string | null
  custom_name: string | null
  custom_description: string | null
  intervention_catalog: {
    name: string
    objetivo: string
    description: string
  } | null
  risk_scores: {
    classification: string
    final_score: number
    factors: {
      name: string
      code: string
    } | null
  } | null
}

interface ActionPlanRow {
  id: string
  assessment_id: string
  approval_status: string
  approval_notes: string | null
}

interface ActionItemRow {
  id: string
  action_plan_id: string
  intervention_id: string
  description: string
  action_type: string
  priority: string
  status: string
  responsible_name: string
  due_date: string | null
  completion_pct: number
}

interface NewActionItem {
  intervention_id: string
  description: string
  action_type: string
  priority: string
  responsible_name: string
  due_date: string
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

function getPriorityVariant(p: string): 'baixo' | 'moderado' | 'alto' | 'critico' {
  if (p === 'baixo' || p === 'moderado' || p === 'alto' || p === 'critico') return p
  return 'moderado'
}

function getStatusVariant(s: string): 'pendente' | 'em_andamento' | 'concluida' | 'atrasada' {
  if (s === 'pendente' || s === 'em_andamento' || s === 'concluida' || s === 'atrasada') return s
  return 'pendente'
}

export default function PlanoAcaoPage() {
  const router = useRouter()
  const params = useParams()
  const id = params.id as string
  const supabase = createClient()
  const { currentUser } = useAuth()
  const { toast } = useToast()

  const [loading, setLoading] = useState(true)
  const [interventions, setInterventions] = useState<InterventionRow[]>([])
  const [plan, setPlan] = useState<ActionPlanRow | null>(null)
  const [items, setItems] = useState<ActionItemRow[]>([])
  const [modalOpen, setModalOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [newItem, setNewItem] = useState<NewActionItem>({
    intervention_id: '',
    description: '',
    action_type: 'reducao',
    priority: 'moderado',
    responsible_name: '',
    due_date: '',
  })

  const loadData = useCallback(async () => {
    // Fetch interventions for this assessment
    const { data: interventionsData } = await supabase
      .from('assessment_interventions')
      .select(
        'id, risk_score_id, catalog_id, custom_name, custom_description, intervention_catalog(name, objetivo, description), risk_scores(classification, final_score, factors(name, code))'
      )
      .eq('assessment_id', id)

    if (interventionsData) {
      setInterventions(interventionsData as unknown as InterventionRow[])
    }

    // Fetch or create action plan
    let currentPlan: ActionPlanRow | null = null

    const { data: existingPlan } = await supabase
      .from('action_plans')
      .select('id, assessment_id, approval_status, approval_notes')
      .eq('assessment_id', id)
      .maybeSingle()

    if (existingPlan) {
      currentPlan = existingPlan as unknown as ActionPlanRow
    } else {
      const { data: newPlan, error: planError } = await supabase
        .from('action_plans')
        .insert({
          assessment_id: id,
          approval_status: 'pendente',
        })
        .select('id, assessment_id, approval_status, approval_notes')
        .single()

      if (planError) {
        console.error(planError)
        toast('Erro ao criar plano de acao.', 'error')
        setLoading(false)
        return
      }

      currentPlan = newPlan as unknown as ActionPlanRow
    }

    setPlan(currentPlan)

    // Fetch action items
    if (currentPlan) {
      const { data: itemsData } = await supabase
        .from('action_items')
        .select(
          'id, action_plan_id, intervention_id, description, action_type, priority, status, responsible_name, due_date, completion_pct'
        )
        .eq('action_plan_id', currentPlan.id)
        .order('priority')

      if (itemsData) setItems(itemsData as unknown as ActionItemRow[])
    }

    setLoading(false)
  }, [id, supabase, toast])

  useEffect(() => {
    loadData()
  }, [loadData])

  function openAddModal(interventionId: string) {
    const intervention = interventions.find((i) => i.id === interventionId)
    setNewItem({
      intervention_id: interventionId,
      description: intervention?.intervention_catalog?.name || intervention?.custom_name || '',
      action_type: 'reducao',
      priority: 'moderado',
      responsible_name: '',
      due_date: '',
    })
    setModalOpen(true)
  }

  async function handleAddItem(e: React.FormEvent) {
    e.preventDefault()

    if (!plan) {
      toast('Plano de acao nao encontrado.', 'error')
      return
    }

    if (!newItem.description.trim()) {
      toast('Preencha a descricao da acao.', 'warning')
      return
    }

    if (!newItem.responsible_name.trim()) {
      toast('Preencha o nome do responsavel.', 'warning')
      return
    }

    if (!newItem.due_date) {
      toast('Selecione a data de prazo.', 'warning')
      return
    }

    setSaving(true)

    try {
      const { data, error } = await supabase
        .from('action_items')
        .insert({
          action_plan_id: plan.id,
          intervention_id: newItem.intervention_id,
          description: newItem.description,
          action_type: newItem.action_type,
          priority: newItem.priority,
          status: 'pendente',
          responsible_name: newItem.responsible_name,
          due_date: newItem.due_date,
          completion_pct: 0,
        })
        .select(
          'id, action_plan_id, intervention_id, description, action_type, priority, status, responsible_name, due_date, completion_pct'
        )
        .single()

      if (error) throw error

      setItems((prev) => [...prev, data as unknown as ActionItemRow])
      setModalOpen(false)
      toast('Acao adicionada ao plano.', 'success')
    } catch (err) {
      console.error(err)
      toast('Erro ao adicionar acao.', 'error')
    }

    setSaving(false)
  }

  async function handleStatusChange(itemId: string, newStatus: string) {
    const { error } = await supabase
      .from('action_items')
      .update({ status: newStatus })
      .eq('id', itemId)

    if (error) {
      console.error(error)
      toast('Erro ao atualizar status.', 'error')
      return
    }

    setItems((prev) =>
      prev.map((item) =>
        item.id === itemId ? { ...item, status: newStatus } : item
      )
    )
  }

  async function handleCompletionChange(itemId: string, pct: number) {
    const { error } = await supabase
      .from('action_items')
      .update({ completion_pct: pct })
      .eq('id', itemId)

    if (error) {
      console.error(error)
      toast('Erro ao atualizar progresso.', 'error')
      return
    }

    setItems((prev) =>
      prev.map((item) =>
        item.id === itemId ? { ...item, completion_pct: pct } : item
      )
    )
  }

  function getInterventionName(interventionId: string): string {
    const intervention = interventions.find((i) => i.id === interventionId)
    return (
      intervention?.intervention_catalog?.name ||
      intervention?.custom_name ||
      'Intervencao'
    )
  }

  if (loading) return <Spinner />

  return (
    <>
      <PageHeader
        title="Plano de Acao"
        breadcrumb="Avaliacoes > Intervencoes > Plano de Acao"
      />

      {/* Interventions summary */}
      <Card>
        <CardHeader
          action={
            plan ? (
              <Badge variant={getStatusVariant(plan.approval_status || 'pendente')}>
                {STATUS_LABELS[plan.approval_status] || plan.approval_status}
              </Badge>
            ) : undefined
          }
        >
          Intervencoes Selecionadas
        </CardHeader>
        <CardBody>
          {interventions.length === 0 ? (
            <EmptyState
              icon="📋"
              title="Nenhuma intervencao selecionada"
              description="Volte a etapa de intervencoes para selecionar programas."
            />
          ) : (
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Intervencao</th>
                    <th>Fator de Risco</th>
                    <th>Nivel</th>
                    <th>Acoes</th>
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
                      <td>
                        {interv.risk_scores?.factors?.code} —{' '}
                        {interv.risk_scores?.factors?.name}
                      </td>
                      <td>
                        {interv.risk_scores && (
                          <Badge
                            variant={
                              interv.risk_scores.classification as
                                | 'baixo'
                                | 'moderado'
                                | 'alto'
                                | 'critico'
                            }
                          >
                            {interv.risk_scores.classification}
                          </Badge>
                        )}
                      </td>
                      <td>
                        <Button
                          variant="primary"
                          size="sm"
                          onClick={() => openAddModal(interv.id)}
                        >
                          + Acao
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardBody>
      </Card>

      {/* Action items table */}
      <Card>
        <CardHeader>Itens do Plano de Acao</CardHeader>
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
              Nenhuma acao cadastrada. Adicione acoes para cada intervencao acima.
            </p>
          ) : (
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Descricao</th>
                    <th>Tipo</th>
                    <th>Prioridade</th>
                    <th>Responsavel</th>
                    <th>Prazo</th>
                    <th>Status</th>
                    <th>% Conclusao</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => (
                    <tr key={item.id}>
                      <td>
                        <strong>{item.description}</strong>
                        <div
                          style={{
                            fontSize: 11,
                            color: 'var(--text-muted)',
                          }}
                        >
                          {getInterventionName(item.intervention_id)}
                        </div>
                      </td>
                      <td>{ACTION_TYPE_LABELS[item.action_type] || item.action_type}</td>
                      <td>
                        <Badge variant={getPriorityVariant(item.priority)}>
                          {PRIORITY_LABELS[item.priority] || item.priority}
                        </Badge>
                      </td>
                      <td>{item.responsible_name}</td>
                      <td>{fmtDate(item.due_date)}</td>
                      <td>
                        <select
                          value={item.status}
                          onChange={(e) =>
                            handleStatusChange(item.id, e.target.value)
                          }
                          style={{
                            background: 'var(--bg-input)',
                            border: '1px solid var(--border)',
                            borderRadius: 6,
                            color: 'var(--text)',
                            padding: '6px 10px',
                            fontSize: 12,
                            fontFamily: 'inherit',
                          }}
                        >
                          <option value="pendente">Pendente</option>
                          <option value="em_andamento">Em andamento</option>
                          <option value="concluida">Concluida</option>
                          <option value="atrasada">Atrasada</option>
                        </select>
                      </td>
                      <td>
                        <input
                          type="number"
                          min={0}
                          max={100}
                          value={item.completion_pct}
                          onChange={(e) =>
                            handleCompletionChange(
                              item.id,
                              parseInt(e.target.value) || 0
                            )
                          }
                          style={{
                            background: 'var(--bg-input)',
                            border: '1px solid var(--border)',
                            borderRadius: 6,
                            color: 'var(--text)',
                            padding: '6px 10px',
                            fontSize: 12,
                            fontFamily: 'inherit',
                            width: 70,
                            textAlign: 'center',
                          }}
                        />
                        <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 4 }}>
                          %
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardBody>
      </Card>

      {/* Navigation buttons */}
      <div className="btn-group" style={{ justifyContent: 'flex-end' }}>
        <Button
          variant="secondary"
          onClick={() => router.push(`/avaliacoes/${id}/intervencoes`)}
        >
          Voltar
        </Button>
        <Button
          variant="primary"
          onClick={() => router.push(`/avaliacoes/${id}/apresentacao`)}
          disabled={items.length === 0}
        >
          Gerar Apresentacao
        </Button>
      </div>

      {/* Add action item modal */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Adicionar Acao ao Plano"
      >
        <form onSubmit={handleAddItem}>
          <FormGroup label="Descricao da Acao">
            <input
              type="text"
              value={newItem.description}
              onChange={(e) =>
                setNewItem((prev) => ({ ...prev, description: e.target.value }))
              }
              placeholder="Descreva a acao a ser realizada"
            />
          </FormGroup>

          <FormRow>
            <FormGroup label="Tipo de Acao">
              <select
                value={newItem.action_type}
                onChange={(e) =>
                  setNewItem((prev) => ({ ...prev, action_type: e.target.value }))
                }
              >
                <option value="eliminacao">Eliminacao</option>
                <option value="reducao">Reducao</option>
                <option value="controle">Controle</option>
                <option value="epi">EPI</option>
              </select>
            </FormGroup>
            <FormGroup label="Prioridade">
              <select
                value={newItem.priority}
                onChange={(e) =>
                  setNewItem((prev) => ({ ...prev, priority: e.target.value }))
                }
              >
                <option value="baixo">Baixo</option>
                <option value="moderado">Moderado</option>
                <option value="alto">Alto</option>
                <option value="critico">Critico</option>
              </select>
            </FormGroup>
          </FormRow>

          <FormRow>
            <FormGroup label="Responsavel">
              <input
                type="text"
                value={newItem.responsible_name}
                onChange={(e) =>
                  setNewItem((prev) => ({
                    ...prev,
                    responsible_name: e.target.value,
                  }))
                }
                placeholder="Nome do responsavel"
              />
            </FormGroup>
            <FormGroup label="Prazo">
              <input
                type="date"
                value={newItem.due_date}
                onChange={(e) =>
                  setNewItem((prev) => ({ ...prev, due_date: e.target.value }))
                }
              />
            </FormGroup>
          </FormRow>

          <div
            className="btn-group"
            style={{ justifyContent: 'flex-end', marginTop: 16 }}
          >
            <Button
              variant="secondary"
              onClick={() => setModalOpen(false)}
            >
              Cancelar
            </Button>
            <Button variant="primary" type="submit" disabled={saving}>
              {saving ? 'Salvando...' : 'Adicionar Acao'}
            </Button>
          </div>
        </form>
      </Modal>
    </>
  )
}
