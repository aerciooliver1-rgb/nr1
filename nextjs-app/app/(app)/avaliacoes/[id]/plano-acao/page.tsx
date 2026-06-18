'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/contexts/ToastContext'
import { fmtDate, fmtStatus } from '@/lib/utils'
import { PageHeader } from '@/components/layout/PageHeader'
import { Card, CardHeader, CardBody } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Spinner } from '@/components/ui/Spinner'

interface ActionPlan {
  id: string
  assessment_id: string
  status: string
  created_at: string
}

interface ActionItem {
  id: string
  action_plan_id: string
  program_id: string | null
  descricao: string
  tipo: string
  responsavel: string
  prazo: string
  status: string
  prioridade: string
}

interface AssessmentIntervention {
  id: string
  program_id: string
  intervention_catalog: {
    name: string
    description: string
  } | null
}

const PRIORITY_ORDER: Record<string, number> = {
  critica: 1,
  alta: 2,
  media: 3,
  baixa: 4,
}

export default function PlanoAcaoPage() {
  const router = useRouter()
  const params = useParams()
  const id = params.id as string
  const supabase = createClient()
  const { currentUser } = useAuth()
  const { toast } = useToast()

  const [loading, setLoading] = useState(true)
  const [plan, setPlan] = useState<ActionPlan | null>(null)
  const [items, setItems] = useState<ActionItem[]>([])

  useEffect(() => {
    async function loadData() {
      // Try to find existing plan
      const { data: existingPlan } = await supabase
        .from('action_plans')
        .select('id, assessment_id, status, created_at')
        .eq('assessment_id', id)
        .maybeSingle()

      if (existingPlan) {
        setPlan(existingPlan)
        // Load existing items
        const { data: existingItems } = await supabase
          .from('action_items')
          .select(
            'id, action_plan_id, program_id, descricao, tipo, responsavel, prazo, status, prioridade'
          )
          .eq('action_plan_id', existingPlan.id)
          .order('prioridade')

        if (existingItems) setItems(existingItems)
      } else {
        // Create new plan
        const { data: newPlan, error: planError } = await supabase
          .from('action_plans')
          .insert({
            assessment_id: id,
            status: 'pendente',
            created_by: currentUser?.id,
          })
          .select('id, assessment_id, status, created_at')
          .single()

        if (planError) {
          console.error(planError)
          toast('Erro ao criar plano de acao.', 'error')
          setLoading(false)
          return
        }

        setPlan(newPlan)

        // Fetch interventions and create items
        const { data: interventions } = await supabase
          .from('assessment_interventions')
          .select(
            'id, program_id, intervention_catalog(name, description)'
          )
          .eq('assessment_id', id)

        if (interventions && interventions.length > 0) {
          const newItems = (interventions as unknown as AssessmentIntervention[]).map(
            (interv) => ({
              action_plan_id: newPlan.id,
              program_id: interv.program_id,
              descricao:
                interv.intervention_catalog?.name ||
                'Acao a definir',
              tipo: 'preventiva',
              responsavel: '',
              prazo: '',
              status: 'pendente',
              prioridade: 'media',
            })
          )

          const { data: createdItems } = await supabase
            .from('action_items')
            .insert(newItems)
            .select(
              'id, action_plan_id, program_id, descricao, tipo, responsavel, prazo, status, prioridade'
            )

          if (createdItems) setItems(createdItems)
        }
      }

      setLoading(false)
    }
    loadData()
  }, [id, supabase, currentUser, toast])

  async function handleFieldUpdate(
    itemId: string,
    field: string,
    value: string
  ) {
    const { error } = await supabase
      .from('action_items')
      .update({ [field]: value })
      .eq('id', itemId)

    if (error) {
      console.error(error)
      toast('Erro ao atualizar.', 'error')
      return
    }

    setItems((prev) =>
      prev.map((item) =>
        item.id === itemId ? { ...item, [field]: value } : item
      )
    )
  }

  function getPriorityVariant(
    p: string
  ): 'critico' | 'alto' | 'moderado' | 'baixo' {
    switch (p) {
      case 'critica':
        return 'critico'
      case 'alta':
        return 'alto'
      case 'media':
        return 'moderado'
      case 'baixa':
        return 'baixo'
      default:
        return 'moderado'
    }
  }

  function getStatusVariant(
    s: string
  ): 'pendente' | 'em_andamento' | 'concluida' | 'atrasada' {
    switch (s) {
      case 'pendente':
        return 'pendente'
      case 'em_andamento':
        return 'em_andamento'
      case 'concluida':
        return 'concluida'
      case 'atrasada':
        return 'atrasada'
      default:
        return 'pendente'
    }
  }

  const sortedItems = [...items].sort(
    (a, b) =>
      (PRIORITY_ORDER[a.prioridade] || 99) -
      (PRIORITY_ORDER[b.prioridade] || 99)
  )

  if (loading) return <Spinner />

  return (
    <>
      <PageHeader
        title="Plano de Acao"
        breadcrumb="Avaliacoes > Plano de Acao"
      />

      <Card>
        <CardHeader
          action={
            plan ? (
              <Badge variant={getStatusVariant(plan.status)}>
                {fmtStatus(plan.status)}
              </Badge>
            ) : undefined
          }
        >
          Acoes Planejadas
        </CardHeader>
        <CardBody>
          {sortedItems.length === 0 ? (
            <p
              style={{
                fontSize: 13,
                color: 'var(--text-muted)',
                textAlign: 'center',
                padding: 24,
              }}
            >
              Nenhuma acao no plano. Adicione intervencoes primeiro.
            </p>
          ) : (
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Prioridade</th>
                    <th>Acao</th>
                    <th>Tipo</th>
                    <th>Responsavel</th>
                    <th>Prazo</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedItems.map((item) => (
                    <tr key={item.id}>
                      <td>
                        <Badge
                          variant={getPriorityVariant(item.prioridade)}
                        >
                          {item.prioridade}
                        </Badge>
                      </td>
                      <td>
                        <strong>{item.descricao}</strong>
                      </td>
                      <td>
                        <select
                          value={item.tipo}
                          onChange={(e) =>
                            handleFieldUpdate(
                              item.id,
                              'tipo',
                              e.target.value
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
                          }}
                        >
                          <option value="preventiva">Preventiva</option>
                          <option value="corretiva">Corretiva</option>
                          <option value="melhoria">Melhoria</option>
                        </select>
                      </td>
                      <td>
                        <input
                          type="text"
                          value={item.responsavel}
                          onChange={(e) =>
                            handleFieldUpdate(
                              item.id,
                              'responsavel',
                              e.target.value
                            )
                          }
                          placeholder="Nome"
                          style={{
                            background: 'var(--bg-input)',
                            border: '1px solid var(--border)',
                            borderRadius: 6,
                            color: 'var(--text)',
                            padding: '6px 10px',
                            fontSize: 12,
                            fontFamily: 'inherit',
                            width: 140,
                          }}
                        />
                      </td>
                      <td>
                        <input
                          type="date"
                          value={item.prazo}
                          onChange={(e) =>
                            handleFieldUpdate(
                              item.id,
                              'prazo',
                              e.target.value
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
                          }}
                        />
                      </td>
                      <td>
                        <Badge variant={getStatusVariant(item.status)}>
                          {fmtStatus(item.status)}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardBody>
      </Card>

      <div className="btn-group" style={{ justifyContent: 'flex-end' }}>
        <Button
          variant="secondary"
          onClick={() =>
            router.push(`/avaliacoes/${id}/apresentacao`)
          }
        >
          Gerar Apresentacao
        </Button>
        <Button
          variant="primary"
          onClick={() =>
            router.push(`/avaliacoes/${id}/aprovacao`)
          }
        >
          Submeter para Aprovacao
        </Button>
      </div>
    </>
  )
}
