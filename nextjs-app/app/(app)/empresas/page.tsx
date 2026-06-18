'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { PageHeader } from '@/components/layout/PageHeader'
import { Card, CardHeader, CardBody } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'

interface Company {
  id: string
  name: string
  cnpj: string | null
  setor_economico: string | null
  porte: string | null
  grau_risco_nr4: number | null
  created_at: string
}

export default function EmpresasPage() {
  const [companies, setCompanies] = useState<Company[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchCompanies() {
      const sb = createClient()
      const { data } = await sb
        .from('companies')
        .select('*')
        .order('created_at', { ascending: false })

      setCompanies((data as Company[]) ?? [])
      setLoading(false)
    }

    fetchCompanies()
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
      <PageHeader title="Empresas" breadcrumb="Gestao de Empresas">
        <Link href="/empresas/nova" className="btn btn-primary">
          + Nova Empresa
        </Link>
      </PageHeader>

      <Card>
        <CardHeader>Todas as Empresas</CardHeader>
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
                    <th>CNPJ</th>
                    <th>Setor</th>
                    <th>Porte</th>
                    <th>Grau NR-4</th>
                    <th>Acoes</th>
                  </tr>
                </thead>
                <tbody>
                  {companies.map((c) => (
                    <tr key={c.id}>
                      <td>
                        <strong>{c.name}</strong>
                      </td>
                      <td>{c.cnpj ?? '—'}</td>
                      <td>{c.setor_economico ?? '—'}</td>
                      <td>{c.porte ?? '—'}</td>
                      <td>{c.grau_risco_nr4 ?? '—'}</td>
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
