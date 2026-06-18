'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { PageHeader } from '@/components/layout/PageHeader'
import { Card, CardHeader, CardBody } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { FormGroup } from '@/components/forms/FormGroup'
import { Alert } from '@/components/ui/Alert'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/contexts/ToastContext'

interface Profile {
  id: string
  full_name: string
  crp: string | null
}

export default function ConfiguracoesPage() {
  const { currentUser, loading: authLoading, logout } = useAuth()
  const { toast } = useToast()
  const [fullName, setFullName] = useState('')
  const [crp, setCrp] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [loggingOut, setLoggingOut] = useState(false)

  useEffect(() => {
    async function loadProfile() {
      if (!currentUser) {
        setLoading(false)
        return
      }

      const sb = createClient()
      const { data, error } = await sb
        .from('profiles')
        .select('*')
        .eq('id', currentUser.id)
        .single()

      if (!error && data) {
        const profile = data as Profile
        setFullName(profile.full_name ?? '')
        setCrp(profile.crp ?? '')
      }
      setLoading(false)
    }

    if (!authLoading) {
      loadProfile()
    }
  }, [currentUser, authLoading])

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!currentUser) return

    if (!fullName.trim()) {
      toast('O nome e obrigatorio', 'warning')
      return
    }

    setSaving(true)
    const sb = createClient()
    const { error } = await sb
      .from('profiles')
      .upsert({
        id: currentUser.id,
        full_name: fullName.trim(),
        crp: crp.trim() || null,
      })

    if (error) {
      toast('Erro ao salvar perfil', 'error')
    } else {
      toast('Perfil salvo com sucesso', 'success')
    }
    setSaving(false)
  }

  async function handleLogout() {
    setLoggingOut(true)
    try {
      await logout()
    } catch {
      toast('Erro ao sair', 'error')
      setLoggingOut(false)
    }
  }

  if (loading || authLoading) {
    return (
      <div className="loading">
        <div className="spinner" />
      </div>
    )
  }

  return (
    <>
      <PageHeader title="Configuracoes" breadcrumb="Perfil e preferencias" />

      <Card>
        <CardHeader>Perfil do Profissional</CardHeader>
        <CardBody>
          <form onSubmit={handleSave}>
            <FormGroup label="Nome completo">
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Seu nome completo"
              />
            </FormGroup>

            <FormGroup label="CRP (Registro Profissional do Psicologo)">
              <input
                type="text"
                value={crp}
                onChange={(e) => setCrp(e.target.value)}
                placeholder="Ex: 06/123456"
              />
            </FormGroup>

            <FormGroup label="E-mail">
              <input
                type="email"
                value={currentUser?.email ?? ''}
                disabled
                style={{ opacity: 0.6, cursor: 'not-allowed' }}
              />
            </FormGroup>

            <div className="btn-group">
              <Button type="submit" variant="primary" disabled={saving}>
                {saving ? 'Salvando...' : 'Salvar Perfil'}
              </Button>
            </div>
          </form>
        </CardBody>
      </Card>

      <Card>
        <CardHeader>Sobre o Sistema</CardHeader>
        <CardBody>
          <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.8 }}>
            <p>
              <strong>DRPS NR-1</strong> — Diagnostico de Riscos Psicossociais v1.0
            </p>
            <p>
              Sistema desenvolvido para atender as exigencias da Norma Regulamentadora NR-1
              (Disposicoes Gerais e Gerenciamento de Riscos Ocupacionais), com foco na
              identificacao, avaliacao e gestao de fatores de risco psicossocial no ambiente
              de trabalho.
            </p>
            <p style={{ marginTop: 12 }}>
              <strong>Instrumento:</strong> Questionario estruturado com escalas Likert validadas
              (frequencia, concordancia e existencia), cobrindo fatores como organizacao do
              trabalho, demandas emocionais, autonomia, relacoes interpessoais, entre outros.
            </p>
            <p style={{ marginTop: 12 }}>
              <strong>Referencia normativa:</strong> NR-1 (Portaria SEPRT n.o 6.730/2020),
              NR-17 (Ergonomia) e diretrizes da OIT sobre riscos psicossociais.
            </p>
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader>Sessao</CardHeader>
        <CardBody>
          <Alert variant="info">
            Conectado como <strong>{currentUser?.email ?? '—'}</strong>
          </Alert>
          <div style={{ marginTop: 16 }}>
            <Button variant="danger" onClick={handleLogout} disabled={loggingOut}>
              {loggingOut ? 'Saindo...' : 'Sair do sistema'}
            </Button>
          </div>
        </CardBody>
      </Card>
    </>
  )
}
