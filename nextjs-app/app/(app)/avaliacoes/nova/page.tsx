'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/contexts/ToastContext'
import { PageHeader } from '@/components/layout/PageHeader'
import { Card, CardHeader, CardBody } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Alert } from '@/components/ui/Alert'
import { FormGroup } from '@/components/forms/FormGroup'
import { FormRow } from '@/components/forms/FormRow'

interface CompanyOption {
  id: string
  name: string
}

interface SectorOption {
  id: string
  name: string
}

export default function NovaAvaliacaoPage() {
  const router = useRouter()
  const supabase = createClient()
  const { currentUser } = useAuth()
  const { toast } = useToast()

  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [companies, setCompanies] = useState<CompanyOption[]>([])
  const [sectors, setSectors] = useState<SectorOption[]>([])
  const [empresaId, setEmpresaId] = useState('')
  const [setorId, setSetorId] = useState('')
  const [modo, setModo] = useState<'institucional' | 'anonimo'>('institucional')
  const [ciclo, setCiclo] = useState(1)
  const [respondenteNome, setRespondenteNome] = useState('')
  const [respondenteCargo, setRespondenteCargo] = useState('')
  const [minimoRespondentes, setMinimoRespondentes] = useState(5)

  useEffect(() => {
    async function loadCompanies() {
      const { data } = await supabase
        .from('companies')
        .select('id, name')
        .order('name')
      if (data) setCompanies(data)
      setLoading(false)
    }
    loadCompanies()
  }, [supabase])

  useEffect(() => {
    async function loadSectors() {
      if (!empresaId) {
        setSectors([])
        setSetorId('')
        return
      }
      const { data } = await supabase
        .from('sectors')
        .select('id, name')
        .eq('company_id', empresaId)
        .order('name')
      if (data) setSectors(data)
      setSetorId('')
    }
    loadSectors()
  }, [empresaId, supabase])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (!empresaId || !setorId) {
      toast('Selecione a empresa e o setor.', 'warning')
      return
    }

    if (modo === 'institucional' && (!respondenteNome || !respondenteCargo)) {
      toast('Preencha o nome e cargo do respondente.', 'warning')
      return
    }

    setSubmitting(true)

    try {
      const insertData: Record<string, unknown> = {
        company_id: empresaId,
        sector_id: setorId,
        mode: modo,
        cycle_number: ciclo,
        status: 'draft',
        created_by: currentUser?.id,
      }

      if (modo === 'institucional') {
        insertData.respondente_nome = respondenteNome
        insertData.respondente_cargo = respondenteCargo
      } else {
        insertData.minimo_respondentes = minimoRespondentes
      }

      const { data, error } = await supabase
        .from('assessments')
        .insert(insertData)
        .select('id')
        .single()

      if (error) throw error

      toast('Avaliacao criada com sucesso!', 'success')
      router.push(`/avaliacoes/${data.id}/coleta`)
    } catch (err) {
      console.error(err)
      toast('Erro ao criar avaliacao.', 'error')
      setSubmitting(false)
    }
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
      <PageHeader
        title="Nova Avaliacao"
        breadcrumb="Avaliacoes > Nova Avaliacao"
      />

      <form onSubmit={handleSubmit}>
        <Card>
          <CardHeader>Dados da Avaliacao</CardHeader>
          <CardBody>
            <FormRow>
              <FormGroup label="Empresa">
                <select
                  value={empresaId}
                  onChange={(e) => setEmpresaId(e.target.value)}
                >
                  <option value="">Selecione a empresa</option>
                  {companies.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </FormGroup>
              <FormGroup label="Setor">
                <select
                  value={setorId}
                  onChange={(e) => setSetorId(e.target.value)}
                  disabled={!empresaId}
                >
                  <option value="">
                    {empresaId
                      ? 'Selecione o setor'
                      : 'Selecione uma empresa primeiro'}
                  </option>
                  {sectors.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </FormGroup>
            </FormRow>

            <FormRow>
              <FormGroup label="Modalidade">
                <select
                  value={modo}
                  onChange={(e) =>
                    setModo(e.target.value as 'institucional' | 'anonimo')
                  }
                >
                  <option value="institucional">Institucional</option>
                  <option value="anonimo">Anonimo</option>
                </select>
              </FormGroup>
              <FormGroup label="Ciclo">
                <input
                  type="number"
                  min={1}
                  value={ciclo}
                  onChange={(e) => setCiclo(Number(e.target.value))}
                />
              </FormGroup>
            </FormRow>

            {modo === 'institucional' && (
              <FormRow>
                <FormGroup label="Nome do Respondente">
                  <input
                    type="text"
                    value={respondenteNome}
                    onChange={(e) => setRespondenteNome(e.target.value)}
                    placeholder="Nome completo do respondente"
                  />
                </FormGroup>
                <FormGroup label="Cargo do Respondente">
                  <input
                    type="text"
                    value={respondenteCargo}
                    onChange={(e) => setRespondenteCargo(e.target.value)}
                    placeholder="Cargo do respondente"
                  />
                </FormGroup>
              </FormRow>
            )}

            {modo === 'anonimo' && (
              <>
                <Alert variant="warning">
                  No modo anonimo, as respostas nao serao vinculadas a
                  identidades individuais. Um link de pesquisa sera gerado
                  para compartilhar com os colaboradores.
                </Alert>
                <FormGroup label="Minimo de Respondentes">
                  <input
                    type="number"
                    min={1}
                    value={minimoRespondentes}
                    onChange={(e) =>
                      setMinimoRespondentes(Number(e.target.value))
                    }
                  />
                </FormGroup>
              </>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader>Informacoes sobre a Avaliacao NR-1</CardHeader>
          <CardBody>
            <Alert variant="success">
              Esta avaliacao abrange{' '}
              <strong>13 fatores de risco psicossocial</strong> conforme a NR-1,
              incluindo: carga de trabalho, autonomia, relacoes interpessoais,
              lideranca, reconhecimento, comunicacao, equilibrio trabalho-vida,
              assedio, suporte organizacional, clareza de papel, participacao,
              justica organizacional e seguranca no emprego.
            </Alert>
          </CardBody>
        </Card>

        <div className="btn-group" style={{ justifyContent: 'flex-end' }}>
          <Button
            variant="secondary"
            onClick={() => router.push('/avaliacoes')}
          >
            Cancelar
          </Button>
          <Button variant="primary" type="submit" disabled={submitting}>
            {submitting ? 'Criando...' : 'Criar Avaliacao'}
          </Button>
        </div>
      </form>
    </>
  )
}
