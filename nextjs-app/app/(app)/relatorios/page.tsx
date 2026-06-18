'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { PageHeader } from '@/components/layout/PageHeader'
import { Card, CardHeader, CardBody } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { StatsGrid } from '@/components/ui/StatsGrid'
import { EmptyState } from '@/components/ui/EmptyState'
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

export default function RelatoriosPage() {
  const [assessments, setAssessments] = useState<CompletedAssessment[]>([])
  const [loading, setLoading] = useState(true)
  const { toast } = useToast()

  useEffect(() => {
    async function fetchData() {
      const sb = createClient()
      const { data, error } = await sb
        .from('assessments')
        .select('id, company_id, sector_id, cycle_number, status, completed_at, indice_risco_geral, nivel_risco_geral, companies(name), sectors(name)')
        .eq('status', 'completed')
        .order('completed_at', { ascending: false })

      if (error) {
        toast('Erro ao carregar relatorios', 'error')
      } else {
        setAssessments((data as unknown as CompletedAssessment[]) ?? [])
      }
      setLoading(false)
    }
    fetchData()
  }, [toast])

  function averageRiskIndex(): string {
    const withIndex = assessments.filter((a) => a.indice_risco_geral != null)
    if (withIndex.length === 0) return '—'
    const sum = withIndex.reduce((acc, a) => acc + (a.indice_risco_geral ?? 0), 0)
    return (sum / withIndex.length).toFixed(1)
  }

  function mostCommonRiskLevel(): string {
    const counts: Record<string, number> = {}
    for (const a of assessments) {
      if (a.nivel_risco_geral) {
        counts[a.nivel_risco_geral] = (counts[a.nivel_risco_geral] ?? 0) + 1
      }
    }
    const entries = Object.entries(counts)
    if (entries.length === 0) return '—'
    entries.sort((a, b) => b[1] - a[1])
    return RISK_LABELS[entries[0][0] as RiskLevel] ?? entries[0][0]
  }

  function riskVariant(): 'success' | 'warning' | 'danger' | undefined {
    const avg = averageRiskIndex()
    if (avg === '—') return undefined
    const val = parseFloat(avg)
    if (val <= 25) return 'success'
    if (val <= 50) return 'warning'
    return 'danger'
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
      <PageHeader title="Relatorios" breadcrumb="Relatorios de avaliacoes concluidas" />

      <StatsGrid
        items={[
          { value: assessments.length, label: 'Avaliacoes concluidas' },
          { value: averageRiskIndex(), label: 'Indice de risco medio', variant: riskVariant() },
          { value: mostCommonRiskLevel(), label: 'Nivel de risco mais comum' },
        ]}
      />

      <Card>
        <CardHeader>Avaliacoes Concluidas</CardHeader>
        <CardBody>
          {assessments.length === 0 ? (
            <EmptyState
              icon="📊"
              title="Nenhuma avaliacao concluida"
              description="Os relatorios aparecerao aqui quando houver avaliacoes finalizadas."
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
                    <th>Indice de risco</th>
                    <th>Acoes</th>
                  </tr>
                </thead>
                <tbody>
                  {assessments.map((a) => (
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
                      <td>
                        {a.indice_risco_geral != null
                          ? a.indice_risco_geral.toFixed(1)
                          : '—'}
                      </td>
                      <td>
                        <Link
                          href={`/avaliacoes/${a.id}/resultado`}
                          className="btn btn-secondary btn-sm"
                        >
                          Ver Resultado
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardBody>
      </Card>
    </>
  )
}
