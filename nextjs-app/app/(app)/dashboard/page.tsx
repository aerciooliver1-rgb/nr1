'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { PageHeader } from '@/components/layout/PageHeader'
import { Card, CardHeader, CardBody } from '@/components/ui/Card'
import { StatsGrid } from '@/components/ui/StatsGrid'
import { EmptyState } from '@/components/ui/EmptyState'
import { fmtDate } from '@/lib/utils'

interface Company {
  id: string
  name: string
  cnpj: string | null
  setor_economico: string | null
  porte: string | null
  sectors: { id: string; name: string; num_trabalhadores: number }[]
}

export default function DashboardPage() {
  const [companies, setCompanies] = useState<Company[]>([])
  const [totalCompanies, setTotalCompanies] = useState(0)
  const [activeAssessments, setActiveAssessments] = useState(0)
  const [completedAssessments, setCompletedAssessments] = useState(0)
  const [overdueActions, setOverdueActions] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchData() {
      const sb = createClient()

      const [companiesCountRes, activeRes, completedRes, overdueRes, companiesRes] =
        await Promise.all([
          sb.from('companies').select('id', { count: 'exact', head: true }),
          sb
            .from('assessments')
            .select('id', { count: 'exact', head: true })
            .in('status', ['in_progress', 'coletando', 'review']),
          sb
            .from('assessments')
            .select('id', { count: 'exact', head: true })
            .eq('status', 'completed'),
          sb
            .from('action_plans')
            .select('id', { count: 'exact', head: true })
            .eq('status', 'atrasada'),
          sb
            .from('companies')
            .select('*, sectors(id, name, num_trabalhadores)')
            .order('created_at', { ascending: false }),
        ])

      setTotalCompanies(companiesCountRes.count ?? 0)
      setActiveAssessments(activeRes.count ?? 0)
      setCompletedAssessments(completedRes.count ?? 0)
      setOverdueActions(overdueRes.count ?? 0)
      setCompanies((companiesRes.data as Company[]) ?? [])
      setLoading(false)
    }

    fetchData()
  }, [])

  if (loading) {
    return (
      <div className="loading">
        <div className="spinner" />
      </div>
    )
  }

  return (
    <>
      <PageHeader title="Dashboard" breadcrumb="Visao geral do portfolio">
        <Link href="/empresas/nova" className="btn btn-primary">
          + Nova Empresa
        </Link>
        <Link href="/avaliacoes/nova" className="btn btn-secondary">
          + Nova Avaliacao
        </Link>
      </PageHeader>

      <StatsGrid
        items={[
          { value: totalCompanies, label: 'Empresas Cadastradas' },
          {
            value: activeAssessments,
            label: 'Avaliacoes Ativas',
            variant: 'warning',
          },
          {
            value: completedAssessments,
            label: 'Avaliacoes Concluidas',
            variant: 'success',
          },
          {
            value: overdueActions,
            label: 'Acoes Atrasadas',
            variant: 'danger',
          },
        ]}
      />

      <Card>
        <CardHeader>Empresas</CardHeader>
        <CardBody>
          {companies.length === 0 ? (
            <EmptyState
              icon="🏢"
              title="Nenhuma empresa cadastrada"
              description="Cadastre sua primeira empresa para comecar."
              action={
                <Link href="/empresas/nova" className="btn btn-primary">
                  + Nova Empresa
                </Link>
              }
            />
          ) : (
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Empresa</th>
                    <th>Setor Economico</th>
                    <th>Porte</th>
                    <th>Setores</th>
                    <th>Acoes</th>
                  </tr>
                </thead>
                <tbody>
                  {companies.map((c) => (
                    <tr key={c.id}>
                      <td>
                        <strong>{c.name}</strong>
                        {c.cnpj && (
                          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                            {c.cnpj}
                          </div>
                        )}
                      </td>
                      <td>{c.setor_economico ?? '—'}</td>
                      <td>{c.porte ?? '—'}</td>
                      <td>{c.sectors?.length ?? 0}</td>
                      <td>
                        <Link
                          href={`/empresas/${c.id}`}
                          className="btn btn-secondary btn-sm"
                        >
                          Ver
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
