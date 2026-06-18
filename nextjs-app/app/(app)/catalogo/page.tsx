'use client'

import { useState, useEffect, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { PageHeader } from '@/components/layout/PageHeader'
import { Card, CardHeader, CardBody } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { Modal } from '@/components/ui/Modal'
import { useToast } from '@/contexts/ToastContext'

interface Program {
  id: string
  name: string
  descricao: string | null
  objetivo: string | null
  modalidade: string | null
  duracao: string | null
  publico_alvo: string | null
  is_custom: boolean
  created_at: string
}

const EMPTY_FORM = {
  name: '',
  objetivo: '',
  modalidade: '',
  duracao: '',
  publico_alvo: '',
  descricao: '',
}

export default function CatalogoPage() {
  const [programs, setPrograms] = useState<Program[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const { toast } = useToast()

  useEffect(() => {
    fetchPrograms()
  }, [])

  async function fetchPrograms() {
    const sb = createClient()
    const { data, error } = await sb
      .from('intervention_catalog')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      toast('Erro ao carregar catalogo', 'error')
    } else {
      setPrograms((data as Program[]) ?? [])
    }
    setLoading(false)
  }

  const filtered = useMemo(() => {
    if (!search.trim()) return programs
    const q = search.toLowerCase()
    return programs.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        (p.descricao && p.descricao.toLowerCase().includes(q))
    )
  }, [programs, search])

  function handleChange(
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) {
    setForm({ ...form, [e.target.name]: e.target.value })
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim()) {
      toast('Nome e obrigatorio', 'warning')
      return
    }
    setSaving(true)
    const sb = createClient()
    const { error } = await sb.from('intervention_catalog').insert({
      name: form.name.trim(),
      objetivo: form.objetivo.trim() || null,
      modalidade: form.modalidade.trim() || null,
      duracao: form.duracao.trim() || null,
      publico_alvo: form.publico_alvo.trim() || null,
      descricao: form.descricao.trim() || null,
      is_custom: true,
    })

    if (error) {
      toast('Erro ao salvar programa', 'error')
    } else {
      toast('Programa criado com sucesso', 'success')
      setModalOpen(false)
      setForm(EMPTY_FORM)
      await fetchPrograms()
    }
    setSaving(false)
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
      <PageHeader title="Catalogo de Intervencoes" breadcrumb="Programas de intervencao NR-1">
        <button className="btn btn-primary" onClick={() => setModalOpen(true)}>
          + Novo Programa
        </button>
      </PageHeader>

      <Card>
        <CardHeader>
          Programas Disponiveis
        </CardHeader>
        <CardBody>
          <div className="form-group" style={{ marginBottom: 20 }}>
            <input
              type="text"
              placeholder="Buscar por nome ou descricao..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          {filtered.length === 0 ? (
            <EmptyState
              icon="📋"
              title="Nenhum programa encontrado"
              description={
                search
                  ? 'Tente ajustar sua busca.'
                  : 'Crie seu primeiro programa de intervencao.'
              }
            />
          ) : (
            filtered.map((p) => (
              <div key={p.id} className="program-card">
                <div className="flex-between">
                  <h4>{p.name}</h4>
                  <span className="tag">
                    {p.is_custom ? 'Custom' : 'Padrao'}
                  </span>
                </div>
                {p.descricao && (
                  <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 6 }}>
                    {p.descricao}
                  </p>
                )}
                <div className="meta">
                  {p.modalidade && <span>Modalidade: {p.modalidade}</span>}
                  {p.duracao && <span>Duracao: {p.duracao}</span>}
                  {p.publico_alvo && <span>Publico: {p.publico_alvo}</span>}
                </div>
              </div>
            ))
          )}
        </CardBody>
      </Card>

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title="Novo Programa de Intervencao">
        <form onSubmit={handleSave}>
          <div className="form-group">
            <label>Nome</label>
            <input
              type="text"
              name="name"
              value={form.name}
              onChange={handleChange}
              placeholder="Nome do programa"
            />
          </div>

          <div className="form-group">
            <label>Objetivo</label>
            <textarea
              name="objetivo"
              value={form.objetivo}
              onChange={handleChange}
              placeholder="Objetivo do programa"
            />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Modalidade</label>
              <input
                type="text"
                name="modalidade"
                value={form.modalidade}
                onChange={handleChange}
                placeholder="Ex: Presencial, Online"
              />
            </div>
            <div className="form-group">
              <label>Duracao</label>
              <input
                type="text"
                name="duracao"
                value={form.duracao}
                onChange={handleChange}
                placeholder="Ex: 8 semanas"
              />
            </div>
          </div>

          <div className="form-group">
            <label>Publico-alvo</label>
            <input
              type="text"
              name="publico_alvo"
              value={form.publico_alvo}
              onChange={handleChange}
              placeholder="Ex: Gestores, Colaboradores"
            />
          </div>

          <div className="form-group">
            <label>Descricao</label>
            <textarea
              name="descricao"
              value={form.descricao}
              onChange={handleChange}
              placeholder="Descricao detalhada do programa"
            />
          </div>

          <div className="btn-group" style={{ marginTop: 8 }}>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Salvando...' : 'Salvar Programa'}
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setModalOpen(false)}
            >
              Cancelar
            </button>
          </div>
        </form>
      </Modal>
    </>
  )
}
