'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { PageHeader } from '@/components/layout/PageHeader'
import { Card, CardHeader, CardBody } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { EmptyState } from '@/components/ui/EmptyState'
import { fmtDate, fmtStatus } from '@/lib/utils'

interface Assessment {
  id: string
  status: string
  risco: string | null
  ciclo: string | null
  modo: string | null
  created_at: string
  sectors: { name: string; company_id: string } | null
  companies: { id: string; name: string } | null
}

export default function AvaliacoesPage() {
  const [assessments, setAssessments] = useState<Assessment[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchAssessments() {
      const sb = createClient()
      const { data } = await sb
        .from('assessments')
        .select('*, sectors(name, company_id), companies(id, name)')
        .order('created_at', { ascending: false })

      setAssessments((data as Assessment[]) ?? [])
      setLoading(false)
    }

    fetchAssessments()
  }, [])

  function getAssessmentLink(assessment: Assessment) {
    if (
      assessment.status === 'draft' ||
      assessment.status === 'in_progress' ||
      assessment.status === 'coletando'
    ) {
      return `/avaliacoes/${assessment.id}/questionario`
    }
    if (assessment.status === 'review') {
      return `/avaliacoes/${assessment.id}/revisao`
    }
    return `/avaliacoes/${assessment.id}/resultado`
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
      <PageHeader title="Avaliacoes" breadcrumb="Gestao de Avaliacoes">
        <Link href="/avaliacoes/nova" className="btn btn-primary">
          + Nova Avaliacao
        </Link>
      </PageHeader>

      <Card>
        <CardHeader>Todas as Avaliacoes</CardHeader>
        <CardBody>
          {assessments.length === 0 ? (
            <EmptyState
              icon="📋"
              title="Nenhuma avaliacao encontrada"
              description="Crie uma nova avaliacao para comecar."
              action={
                <Link href="/avaliacoes/nova" className="btn btn-primary">
                  + Nova Avaliacao
                </Link>
              }
            />
          ) : (
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Empresa</th>
                    <th>Setor</th>
                    <th>Ciclo</th>
                    <th>Modo</th>
                    <th>Status</th>
                    <th>Risco</th>
                    <th>Data</th>
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
                      <td>{a.ciclo ?? '—'}</td>
                      <td>{a.modo ?? '—'}</td>
                      <td>
                        <Badge variant={a.status as 'pendente'}>
                          {fmtStatus(a.status)}
                        </Badge>
                      </td>
                      <td>
                        {a.risco ? (
                          <Badge variant={a.risco as 'baixo'}>
                            {a.risco}
                          </Badge>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td>{fmtDate(a.created_at)}</td>
                      <td>
                        <Link
                          href={getAssessmentLink(a)}
                          className="btn btn-secondary btn-sm"
                        >
                          Abrir
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
