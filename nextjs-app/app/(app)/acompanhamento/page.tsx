'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { PageHeader } from '@/components/layout/PageHeader'
import { Card, CardBody } from '@/components/ui/Card'
import { Tabs } from '@/components/ui/Tabs'
import { Badge } from '@/components/ui/Badge'
import { ProgressBar } from '@/components/ui/ProgressBar'
import { EmptyState } from '@/components/ui/EmptyState'
import { useToast } from '@/contexts/ToastContext'
import { fmtDate } from '@/lib/utils'

interface ActionItem {
  id: string
  description: string
  priority: 'baixo' | 'moderado' | 'alto' | 'critico'
  responsible_name: string | null
  due_date: string | null
  status: 'pendente' | 'em_andamento' | 'concluida' | 'atrasada'
  completion_pct: number
}

const STATUSES = ['pendente', 'em_andamento', 'concluida', 'atrasada'] as const
const STATUS_LABELS: Record<string, string> = {
  pendente: 'Pendente',
  em_andamento: 'Em Andamento',
  concluida: 'Concluida',
  atrasada: 'Atrasada',
}

export default function AcompanhamentoPage() {
  const [items, setItems] = useState<ActionItem[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('kanban')
  const { toast } = useToast()

  useEffect(() => {
    fetchItems()
  }, [])

  async function fetchItems() {
    const sb = createClient()
    const { data, error } = await sb
      .from('action_items')
      .select('*')
      .order('priority', { ascending: true })
      .order('due_date', { ascending: true })

    if (error) {
      toast('Erro ao carregar acoes', 'error')
    } else {
      setItems((data as ActionItem[]) ?? [])
    }
    setLoading(false)
  }

  async function handleStatusChange(id: string, newStatus: string) {
    const sb = createClient()
    const { error } = await sb
      .from('action_items')
      .update({ status: newStatus })
      .eq('id', id)

    if (error) {
      toast('Erro ao atualizar status', 'error')
    } else {
      toast('Status atualizado', 'success')
      setItems((prev) =>
        prev.map((item) =>
          item.id === id ? { ...item, status: newStatus as ActionItem['status'] } : item
        )
      )
    }
  }

  function getColumnItems(status: string) {
    return items.filter((item) => item.status === status)
  }

  function progressColor(val: number): 'green' | 'orange' | 'red' {
    if (val >= 70) return 'green'
    if (val >= 40) return 'orange'
    return 'red'
  }

  if (loading) {
    return (
      <div className="loading">
        <div className="spinner" />
      </div>
    )
  }

  return (
    <>
      <PageHeader title="Acompanhamento" breadcrumb="Gestao de acoes e planos" />

      <Tabs
        tabs={[
          { key: 'kanban', label: 'Kanban' },
          { key: 'table', label: 'Tabela' },
        ]}
        activeTab={activeTab}
        onChange={setActiveTab}
      />

      {items.length === 0 ? (
        <Card>
          <CardBody>
            <EmptyState
              icon="📋"
              title="Nenhuma acao cadastrada"
              description="As acoes aparecerao aqui quando forem criadas a partir dos planos de acao."
            />
          </CardBody>
        </Card>
      ) : activeTab === 'kanban' ? (
        <div className="kanban-board">
          {STATUSES.map((status) => {
            const col = getColumnItems(status)
            return (
              <div key={status} className="kanban-column">
                <h3>
                  {STATUS_LABELS[status]}{' '}
                  <Badge variant={status}>
                    {col.length}
                  </Badge>
                </h3>
                {col.map((item) => (
                  <div key={item.id} className="kanban-card">
                    <div className="flex-between mb-8">
                      <Badge variant={item.priority}>
                        {item.priority}
                      </Badge>
                    </div>
                    <p style={{ marginBottom: 8 }}>
                      {item.description.length > 80
                        ? item.description.slice(0, 80) + '...'
                        : item.description}
                    </p>
                    {item.responsible_name && (
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6 }}>
                        {item.responsible_name}
                      </div>
                    )}
                    {item.due_date && (
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 8 }}>
                        Prazo: {fmtDate(item.due_date)}
                      </div>
                    )}
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <select
                        value={item.status}
                        onChange={(e) => handleStatusChange(item.id, e.target.value)}
                        style={{ padding: '6px 10px', fontSize: 11 }}
                      >
                        {STATUSES.map((s) => (
                          <option key={s} value={s}>
                            {STATUS_LABELS[s]}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                ))}
              </div>
            )
          })}
        </div>
      ) : (
        <Card>
          <CardBody>
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Acao</th>
                    <th>Prioridade</th>
                    <th>Responsavel</th>
                    <th>Prazo</th>
                    <th>Status</th>
                    <th>%</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => (
                    <tr key={item.id}>
                      <td>
                        <strong>
                          {item.description.length > 80
                            ? item.description.slice(0, 80) + '...'
                            : item.description}
                        </strong>
                      </td>
                      <td>
                        <Badge variant={item.priority}>
                          {item.priority}
                        </Badge>
                      </td>
                      <td>{item.responsible_name ?? '—'}</td>
                      <td>{fmtDate(item.due_date)}</td>
                      <td>
                        <div className="form-group" style={{ marginBottom: 0 }}>
                          <select
                            value={item.status}
                            onChange={(e) => handleStatusChange(item.id, e.target.value)}
                            style={{ padding: '6px 10px', fontSize: 11 }}
                          >
                            {STATUSES.map((s) => (
                              <option key={s} value={s}>
                                {STATUS_LABELS[s]}
                              </option>
                            ))}
                          </select>
                        </div>
                      </td>
                      <td style={{ minWidth: 80 }}>
                        <ProgressBar
                          value={item.completion_pct ?? 0}
                          color={progressColor(item.completion_pct ?? 0)}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardBody>
        </Card>
      )}
    </>
  )
}
