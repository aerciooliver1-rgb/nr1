'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { PageHeader } from '@/components/layout/PageHeader'
import { Card, CardHeader, CardBody } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { Alert } from '@/components/ui/Alert'
import { useToast } from '@/contexts/ToastContext'
import { fmtDate } from '@/lib/utils'
import type { RiskLevel } from '@/lib/types'

interface CompletedAssessment {
  id: string
  company_id: string
  sector_id: string
  cycle_number: number
  status: string
  completed_at: string | null
  indice_risco_geral: number | null
  nivel_risco_geral: RiskLevel | null
  companies: { name: string } | null
  sectors: { name: string } | null
}

const RISK_LABELS: Record<RiskLevel, string> = {
  baixo: 'Baixo',
  moderado: 'Moderado',
  alto: 'Alto',
  critico: 'Critico',
}

const TWO_YEARS_MS = 2 * 365 * 24 * 60 * 60 * 1000

export default function ReavaliacaoPage() {
  const [assessments, setAssessments] = useState<CompletedAssessment[]>([])
  const [loading, setLoading] = useState(true)
  const [startingCycle, setStartingCycle] = useState<string | null>(null)
  const { toast } = useToast()
  const router = useRouter()

  useEffect(() => {
    async function fetchData() {
      const sb = createClient()
      const { data, error } = await sb
        .from('assessments')
        .select('id, company_id, sector_id, cycle_number, status, completed_at, indice_risco_geral, nivel_risco_geral, companies(name), sectors(name)')
        .eq('status', 'completed')
        .order('completed_at', { ascending: false })

      if (error) {
        toast('Erro ao carregar avaliacoes', 'error')
      } else {
        setAssessments((data as unknown as CompletedAssessment[]) ?? [])
      }
      setLoading(false)
    }
    fetchData()
  }, [toast])

  function daysSinceCompletion(completedAt: string | null): number {
    if (!completedAt) return 0
    const completed = new Date(completedAt).getTime()
    const now = Date.now()
    return Math.floor((now - completed) / (1000 * 60 * 60 * 24))
  }

  function isOverdue(completedAt: string | null): boolean {
    if (!completedAt) return false
    const completed = new Date(completedAt).getTime()
    return Date.now() - completed > TWO_YEARS_MS
  }

  async function handleStartNewCycle(assessment: CompletedAssessment) {
    setStartingCycle(assessment.id)
    const nextCycle = assessment.cycle_number + 1
    router.push(
      `/avaliacoes/nova?empresa=${assessment.company_id}&setor=${assessment.sector_id}&ciclo=${nextCycle}`
    )
  }

  const overdueCount = assessments.filter((a) => isOverdue(a.completed_at)).length

  if (loading) {
    return (
      <div className="loading">
        <div className="spinner" />
      </div>
    )
  }

  return (
    <>
      <PageHeader title="Reavaliacao" breadcrumb="Controle de prazos de reavaliacao" />

      {overdueCount > 0 && (
        <Alert variant="warning">
          {overdueCount} avaliacao(oes) com prazo de reavaliacao vencido (mais de 2 anos desde a conclusao).
        </Alert>
      )}

      <Card>
        <CardHeader>Avaliacoes Concluidas</CardHeader>
        <CardBody>
          {assessments.length === 0 ? (
            <EmptyState
              icon="📅"
              title="Nenhuma avaliacao concluida"
              description="As avaliacoes concluidas aparecerao aqui para controle de reavaliacao."
            />
          ) : (
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Empresa</th>
                    <th>Setor</th>
                    <th>Data de conclusao</th>
                    <th>Nivel de risco</th>
                    <th>Dias desde conclusao</th>
                    <th>Situacao</th>
                    <th>Acoes</th>
                  </tr>
                </thead>
                <tbody>
                  {assessments.map((a) => {
                    const days = daysSinceCompletion(a.completed_at)
                    const overdue = isOverdue(a.completed_at)

                    return (
                      <tr key={a.id}>
                        <td>
                          <strong>{a.companies?.name ?? '—'}</strong>
                        </td>
                        <td>{a.sectors?.name ?? '—'}</td>
                        <td>{fmtDate(a.completed_at)}</td>
                        <td>
                          {a.nivel_risco_geral ? (
                            <Badge variant={a.nivel_risco_geral}>
                              {RISK_LABELS[a.nivel_risco_geral]}
                            </Badge>
                          ) : (
                            '—'
                          )}
                        </td>
                        <td>{days} dias</td>
                        <td>
                          {overdue ? (
                            <Badge variant="atrasada">Vencida</Badge>
                          ) : (
                            <Badge variant="concluida">Em dia</Badge>
                          )}
                        </td>
                        <td>
                          <Button
                            variant="primary"
                            size="sm"
                            onClick={() => handleStartNewCycle(a)}
                            disabled={startingCycle === a.id}
                          >
                            {startingCycle === a.id ? 'Iniciando...' : 'Novo ciclo'}
                          </Button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardBody>
      </Card>
    </>
  )
}
