'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/contexts/ToastContext'
import { PageHeader } from '@/components/layout/PageHeader'
import { Card, CardHeader, CardBody } from '@/components/ui/Card'
import { FormGroup } from '@/components/forms/FormGroup'
import { FormRow } from '@/components/forms/FormRow'
import { Button } from '@/components/ui/Button'
import { Alert } from '@/components/ui/Alert'
import { formatCNPJ } from '@/lib/utils'

const SETORES_ECONOMICOS = [
  'Industria',
  'Comercio',
  'Servicos',
  'Saude',
  'Educacao',
  'Tecnologia',
  'Construcao',
  'Agropecuaria',
  'Financeiro',
  'Transporte',
  'Outros',
]

const PORTES = [
  'MEI',
  'Microempresa',
  'Pequeno porte',
  'Medio porte',
  'Grande porte',
]

export default function NovaEmpresaPage() {
  const router = useRouter()
  const { currentUser } = useAuth()
  const { toast } = useToast()

  const [name, setName] = useState('')
  const [cnpj, setCnpj] = useState('')
  const [setorEconomico, setSetorEconomico] = useState('')
  const [porte, setPorte] = useState('')
  const [grauRiscoNr4, setGrauRiscoNr4] = useState('')
  const [contatoResponsavel, setContatoResponsavel] = useState('')
  const [emailContato, setEmailContato] = useState('')
  const [telefone, setTelefone] = useState('')
  const [observacoes, setObservacoes] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  function handleCnpjChange(value: string) {
    const digits = value.replace(/\D/g, '').slice(0, 14)
    setCnpj(formatCNPJ(digits.length === 14 ? digits : digits))
  }

  async function handleSave() {
    if (!name.trim()) {
      setError('Razao Social e obrigatoria.')
      return
    }

    if (!currentUser) {
      setError('Usuario nao autenticado.')
      return
    }

    setSaving(true)
    setError('')

    try {
      const sb = createClient()

      const { data: newCompany, error: insertError } = await sb
        .from('companies')
        .insert({
          name: name.trim(),
          cnpj: cnpj.replace(/\D/g, '') || null,
          setor_economico: setorEconomico || null,
          porte: porte || null,
          grau_risco_nr4: grauRiscoNr4 ? parseInt(grauRiscoNr4) : null,
          contato_responsavel: contatoResponsavel.trim() || null,
          email_contato: emailContato.trim() || null,
          telefone: telefone.trim() || null,
          observacoes: observacoes.trim() || null,
          created_by: currentUser.id,
        })
        .select()
        .single()

      if (insertError) throw insertError

      await sb.from('company_users').insert({
        company_id: newCompany.id,
        user_id: currentUser.id,
      })

      toast('Empresa cadastrada com sucesso!', 'success')
      router.push(`/empresas/${newCompany.id}`)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Erro ao salvar empresa.'
      setError(message)
      toast(message, 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <PageHeader title="Cadastrar Empresa" breadcrumb="Empresas / Nova empresa" />

      <Card>
        <CardHeader>Dados da Empresa</CardHeader>
        <CardBody>
          {error && <Alert variant="danger">{error}</Alert>}

          <FormRow>
            <FormGroup label="Razao Social *">
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Nome da empresa"
              />
            </FormGroup>
            <FormGroup label="CNPJ">
              <input
                type="text"
                value={cnpj}
                onChange={(e) => handleCnpjChange(e.target.value)}
                placeholder="00.000.000/0000-00"
              />
            </FormGroup>
          </FormRow>

          <FormRow>
            <FormGroup label="Setor Economico">
              <select
                value={setorEconomico}
                onChange={(e) => setSetorEconomico(e.target.value)}
              >
                <option value="">Selecione...</option>
                {SETORES_ECONOMICOS.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </FormGroup>
            <FormGroup label="Porte">
              <select value={porte} onChange={(e) => setPorte(e.target.value)}>
                <option value="">Selecione...</option>
                {PORTES.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </FormGroup>
            <FormGroup label="Grau de Risco NR-4">
              <select
                value={grauRiscoNr4}
                onChange={(e) => setGrauRiscoNr4(e.target.value)}
              >
                <option value="">Selecione...</option>
                <option value="1">1</option>
                <option value="2">2</option>
                <option value="3">3</option>
                <option value="4">4</option>
              </select>
            </FormGroup>
          </FormRow>

          <FormRow>
            <FormGroup label="Contato Responsavel">
              <input
                type="text"
                value={contatoResponsavel}
                onChange={(e) => setContatoResponsavel(e.target.value)}
                placeholder="Nome do responsavel"
              />
            </FormGroup>
            <FormGroup label="E-mail do Contato">
              <input
                type="email"
                value={emailContato}
                onChange={(e) => setEmailContato(e.target.value)}
                placeholder="contato@empresa.com"
              />
            </FormGroup>
            <FormGroup label="Telefone">
              <input
                type="text"
                value={telefone}
                onChange={(e) => setTelefone(e.target.value)}
                placeholder="(00) 00000-0000"
              />
            </FormGroup>
          </FormRow>

          <FormGroup label="Observacoes">
            <textarea
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
              placeholder="Informacoes adicionais sobre a empresa..."
            />
          </FormGroup>

          <div className="btn-group" style={{ marginTop: 24 }}>
            <Button variant="primary" onClick={handleSave} disabled={saving}>
              {saving ? 'Salvando...' : 'Salvar Empresa'}
            </Button>
            <Button variant="secondary" onClick={() => router.push('/empresas')}>
              Cancelar
            </Button>
          </div>
        </CardBody>
      </Card>
    </>
  )
}
