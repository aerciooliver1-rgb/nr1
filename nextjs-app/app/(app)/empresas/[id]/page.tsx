'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/contexts/ToastContext'
import { PageHeader } from '@/components/layout/PageHeader'
import { Card, CardHeader, CardBody } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { StatsGrid } from '@/components/ui/StatsGrid'
import { EmptyState } from '@/components/ui/EmptyState'
import { Alert } from '@/components/ui/Alert'
import { FormGroup } from '@/components/forms/FormGroup'
import { fmtDate, fmtStatus } from '@/lib/utils'

interface Sector {
  id: string
  name: string
  num_trabalhadores: number
  gestor: string | null
}

interface Assessment {
  id: string
  sector_id: string
  ciclo: string | null
  modo: string | null
  status: string
  risco: string | null
  created_at: string
  sectors: { name: string } | null
}

interface Company {
  id: string
  name: string
  cnpj: string | null
  setor_economico: string | null
  porte: string | null
  grau_risco_nr4: number | null
}

export default function EmpresaDetailPage() {
  const params = useParams<{ id: string }>()
  const { toast } = useToast()

  const [company, setCompany] = useState<Company | null>(null)
  const [sectors, setSectors] = useState<Sector[]>([])
  const [assessments, setAssessments] = useState<Assessment[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // Inline sector form state
  const [newSectorName, setNewSectorName] = useState('')
  const [newSectorWorkers, setNewSectorWorkers] = useState('')
  const [newSectorGestor, setNewSectorGestor] = useState('')
  const [addingSector, setAddingSector] = useState(false)

  const companyId = params.id

  useEffect(() => {
    async function fetchData() {
      const sb = createClient()

      const [companyRes, sectorsRes, assessmentsRes] = await Promise.all([
        sb.from('companies').select('*').eq('id', companyId).single(),
        sb
          .from('sectors')
          .select('*')
          .eq('company_id', companyId)
          .order('name'),
        sb
          .from('assessments')
          .select('*, sectors(name)')
          .eq('company_id', companyId)
          .order('created_at', { ascending: false }),
      ])

      if (companyRes.error) {
        setError('Empresa nao encontrada.')
        setLoading(false)
        return
      }

      setCompany(companyRes.data as Company)
      setSectors((sectorsRes.data as Sector[]) ?? [])
      setAssessments((assessmentsRes.data as Assessment[]) ?? [])
      setLoading(false)
    }

    fetchData()
  }, [companyId])

  async function handleAddSector() {
    if (!newSectorName.trim()) return

    setAddingSector(true)
    try {
      const sb = createClient()
      const { data, error: insertError } = await sb
        .from('sectors')
        .insert({
          company_id: companyId,
          name: newSectorName.trim(),
          num_trabalhadores: newSectorWorkers
            ? parseInt(newSectorWorkers)
            : 0,
          gestor: newSectorGestor.trim() || null,
        })
        .select()
        .single()

      if (insertError) throw insertError

      setSectors((prev) => [...prev, data as Sector])
      setNewSectorName('')
      setNewSectorWorkers('')
      setNewSectorGestor('')
      toast('Setor adicionado com sucesso!', 'success')
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Erro ao adicionar setor.'
      toast(message, 'error')
    } finally {
      setAddingSector(false)
    }
  }

  async function handleDeleteSector(sectorId: string) {
    try {
      const sb = createClient()
      const { error: deleteError } = await sb
        .from('sectors')
        .delete()
        .eq('id', sectorId)

      if (deleteError) throw deleteError

      setSectors((prev) => prev.filter((s) => s.id !== sectorId))
      toast('Setor removido.', 'success')
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Erro ao remover setor.'
      toast(message, 'error')
    }
  }

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

  if (error || !company) {
    return (
      <>
        <PageHeader title="Empresa" breadcrumb="Empresas" />
        <Alert variant="danger">{error || 'Empresa nao encontrada.'}</Alert>
      </>
    )
  }

  const totalWorkers = sectors.reduce(
    (sum, s) => sum + (s.num_trabalhadores || 0),
    0
  )
  const completedCount = assessments.filter(
    (a) => a.status === 'completed' || a.status === 'concluida'
  ).length
  const inProgressCount = assessments.filter((a) =>
    ['in_progress', 'coletando', 'review', 'draft'].includes(a.status)
  ).length

  return (
    <>
      <PageHeader title={company.name} breadcrumb="Empresas / Perfil da empresa">
        <Link
          href={`/avaliacoes/nova?empresa=${company.id}`}
          className="btn btn-primary"
        >
          + Nova Avaliacao
        </Link>
      </PageHeader>

      <StatsGrid
        items={[
          { value: sectors.length, label: 'Setores' },
          { value: totalWorkers, label: 'Trabalhadores' },
          {
            value: completedCount,
            label: 'Avaliacoes Concluidas',
            variant: 'success',
          },
          {
            value: inProgressCount,
            label: 'Em Andamento',
            variant: 'warning',
          },
        ]}
      />

      {/* Sectors Card */}
      <Card>
        <CardHeader
          action={
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              {sectors.length} setor(es)
            </span>
          }
        >
          Setores
        </CardHeader>
        <CardBody>
          {/* Add sector inline form */}
          <div className="inline-form" style={{ marginBottom: 20 }}>
            <FormGroup label="Nome do Setor">
              <input
                type="text"
                value={newSectorName}
                onChange={(e) => setNewSectorName(e.target.value)}
                placeholder="Ex: Administrativo"
              />
            </FormGroup>
            <FormGroup label="Trabalhadores">
              <input
                type="number"
                value={newSectorWorkers}
                onChange={(e) => setNewSectorWorkers(e.target.value)}
                placeholder="0"
              />
            </FormGroup>
            <FormGroup label="Gestor">
              <input
                type="text"
                value={newSectorGestor}
                onChange={(e) => setNewSectorGestor(e.target.value)}
                placeholder="Nome do gestor"
              />
            </FormGroup>
            <Button
              variant="primary"
              size="sm"
              onClick={handleAddSector}
              disabled={addingSector}
            >
              {addingSector ? '...' : 'Adicionar'}
            </Button>
          </div>

          {sectors.length === 0 ? (
            <EmptyState
              icon="📂"
              title="Nenhum setor cadastrado"
              description="Adicione setores para esta empresa usando o formulario acima."
            />
          ) : (
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Setor</th>
                    <th>Trabalhadores</th>
                    <th>Gestor</th>
                    <th>Acoes</th>
                  </tr>
                </thead>
                <tbody>
                  {sectors.map((s) => (
                    <tr key={s.id}>
                      <td>
                        <strong>{s.name}</strong>
                      </td>
                      <td>{s.num_trabalhadores}</td>
                      <td>{s.gestor ?? '—'}</td>
                      <td>
                        <Button
                          variant="danger"
                          size="sm"
                          onClick={() => handleDeleteSector(s.id)}
                        >
                          Remover
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

      {/* Assessments Card */}
      <Card>
        <CardHeader>Historico de Avaliacoes</CardHeader>
        <CardBody>
          {assessments.length === 0 ? (
            <EmptyState
              icon="📋"
              title="Nenhuma avaliacao realizada"
              description="Crie uma nova avaliacao para esta empresa."
              action={
                <Link
                  href={`/avaliacoes/nova?empresa=${company.id}`}
                  className="btn btn-primary"
                >
                  + Nova Avaliacao
                </Link>
              }
            />
          ) : (
            <div className="table-container">
              <table>
                <thead>
                  <tr>
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
