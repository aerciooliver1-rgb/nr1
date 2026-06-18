'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/contexts/ToastContext'
import { PageHeader } from '@/components/layout/PageHeader'
import { Card, CardHeader, CardBody } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Alert } from '@/components/ui/Alert'
import { EmptyState } from '@/components/ui/EmptyState'
import { Spinner } from '@/components/ui/Spinner'

interface RiskScoreRow {
  id: string
  factor_id: number
  raw_score: number
  final_score: number
  classification: string
  factors: {
    id: number
    name: string
    code: string
    dimension: string
    consequence: string
  } | null
}

interface CatalogItem {
  id: string
  name: string
  objetivo: string
  description: string
  modalidade: string
  duracao: string
  publico_alvo: string
  target_factor_ids: number[]
  min_risk_level: string
  is_custom: boolean
}

interface SelectedIntervention {
  id: string
  risk_score_id: string
  catalog_id: string | null
  custom_name: string | null
  custom_description: string | null
}

const RISK_LEVEL_ORDER: Record<string, number> = {
  baixo: 1,
  moderado: 2,
  alto: 3,
  critico: 4,
}

const CLASSIFICATION_LABELS: Record<string, string> = {
  critico: 'Critico',
  alto: 'Alto',
  moderado: 'Moderado',
  baixo: 'Baixo',
}

export default function IntervencoesPage() {
  const router = useRouter()
  const params = useParams()
  const id = params.id as string
  const supabase = createClient()
  const { currentUser } = useAuth()
  const { toast } = useToast()

  const [loading, setLoading] = useState(true)
  const [riskScores, setRiskScores] = useState<RiskScoreRow[]>([])
  const [catalog, setCatalog] = useState<CatalogItem[]>([])
  const [selected, setSelected] = useState<SelectedIntervention[]>([])
  const [adding, setAdding] = useState<string | null>(null)

  const loadData = useCallback(async () => {
    const [scoresRes, catalogRes, selectedRes] = await Promise.all([
      supabase
        .from('risk_scores')
        .select(
          'id, factor_id, raw_score, final_score, classification, factors(id, name, code, dimension, consequence)'
        )
        .eq('assessment_id', id)
        .order('final_score', { ascending: false }),
      supabase
        .from('intervention_catalog')
        .select(
          'id, name, objetivo, description, modalidade, duracao, publico_alvo, target_factor_ids, min_risk_level, is_custom'
        ),
      supabase
        .from('assessment_interventions')
        .select('id, risk_score_id, catalog_id, custom_name, custom_description')
        .eq('assessment_id', id),
    ])

    if (scoresRes.data) setRiskScores(scoresRes.data as unknown as RiskScoreRow[])
    if (catalogRes.data) setCatalog(catalogRes.data as unknown as CatalogItem[])
    if (selectedRes.data) setSelected(selectedRes.data as unknown as SelectedIntervention[])
    setLoading(false)
  }, [id, supabase])

  useEffect(() => {
    loadData()
  }, [loadData])

  const atRiskScores = riskScores.filter(
    (rs) => RISK_LEVEL_ORDER[rs.classification] >= RISK_LEVEL_ORDER['moderado']
  )

  function getMatchingCatalog(factorId: number, classification: string): CatalogItem[] {
    const riskLevel = RISK_LEVEL_ORDER[classification] || 0
    return catalog.filter((item) => {
      const targetMatches =
        Array.isArray(item.target_factor_ids) &&
        item.target_factor_ids.includes(factorId)
      const minLevel = RISK_LEVEL_ORDER[item.min_risk_level] || 0
      return targetMatches && riskLevel >= minLevel
    })
  }

  function isAlreadySelected(riskScoreId: string, catalogId: string): boolean {
    return selected.some(
      (s) => s.risk_score_id === riskScoreId && s.catalog_id === catalogId
    )
  }

  function getSelectedForScore(riskScoreId: string): SelectedIntervention[] {
    return selected.filter((s) => s.risk_score_id === riskScoreId)
  }

  async function handleAddIntervention(riskScoreId: string, catalogId: string) {
    setAdding(catalogId)
    try {
      const { data, error } = await supabase
        .from('assessment_interventions')
        .insert({
          assessment_id: id,
          risk_score_id: riskScoreId,
          catalog_id: catalogId,
          created_by: currentUser?.id,
        })
        .select('id, risk_score_id, catalog_id, custom_name, custom_description')
        .single()

      if (error) throw error

      setSelected((prev) => [...prev, data as unknown as SelectedIntervention])
      toast('Intervencao adicionada com sucesso.', 'success')
    } catch (err) {
      console.error(err)
      toast('Erro ao adicionar intervencao.', 'error')
    }
    setAdding(null)
  }

  async function handleRemoveIntervention(interventionId: string) {
    try {
      const { error } = await supabase
        .from('assessment_interventions')
        .delete()
        .eq('id', interventionId)

      if (error) throw error

      setSelected((prev) => prev.filter((s) => s.id !== interventionId))
      toast('Intervencao removida.', 'success')
    } catch (err) {
      console.error(err)
      toast('Erro ao remover intervencao.', 'error')
    }
  }

  if (loading) return <Spinner />

  return (
    <>
      <PageHeader
        title="Intervencoes Recomendadas"
        breadcrumb="Avaliacoes > Resultado > Intervencoes"
      />

      {atRiskScores.length === 0 ? (
        <Alert variant="success">
          Nenhum fator com risco moderado ou superior identificado. Parabens pela boa gestao!
        </Alert>
      ) : (
        <Alert variant="info">
          {atRiskScores.length} fator(es) com risco moderado ou superior identificado(s).
          Selecione as intervencoes recomendadas para cada fator.
        </Alert>
      )}

      {atRiskScores.map((rs) => {
        const matching = getMatchingCatalog(rs.factor_id, rs.classification)
        const selectedForThis = getSelectedForScore(rs.id)

        return (
          <Card key={rs.id}>
            <CardHeader
              action={
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span
                    style={{
                      fontSize: 13,
                      fontWeight: 600,
                      color: 'var(--text-secondary)',
                    }}
                  >
                    Score: {Math.round(rs.final_score)}
                  </span>
                  <Badge
                    variant={
                      rs.classification as 'baixo' | 'moderado' | 'alto' | 'critico'
                    }
                  >
                    {CLASSIFICATION_LABELS[rs.classification] || rs.classification}
                  </Badge>
                </div>
              }
            >
              {rs.factors?.code} — {rs.factors?.name}
            </CardHeader>
            <CardBody>
              {/* Already selected interventions */}
              {selectedForThis.length > 0 && (
                <div style={{ marginBottom: 16 }}>
                  <h4
                    style={{
                      fontSize: 11,
                      textTransform: 'uppercase',
                      letterSpacing: '0.08em',
                      color: 'var(--accent)',
                      marginBottom: 8,
                    }}
                  >
                    Intervencoes Selecionadas
                  </h4>
                  {selectedForThis.map((sel) => {
                    const catalogItem = catalog.find((c) => c.id === sel.catalog_id)
                    return (
                      <div
                        key={sel.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '10px 14px',
                          marginBottom: 6,
                          background: 'var(--bg-surface)',
                          borderRadius: 'var(--radius-sm)',
                          border: '1px solid var(--border)',
                        }}
                      >
                        <div>
                          <strong style={{ fontSize: 13, color: 'var(--text)' }}>
                            {catalogItem?.name || sel.custom_name || 'Intervencao personalizada'}
                          </strong>
                          {catalogItem?.modalidade && (
                            <span
                              style={{
                                fontSize: 11,
                                color: 'var(--text-muted)',
                                marginLeft: 10,
                              }}
                            >
                              {catalogItem.modalidade}
                            </span>
                          )}
                        </div>
                        <Button
                          variant="danger"
                          size="sm"
                          onClick={() => handleRemoveIntervention(sel.id)}
                        >
                          Remover
                        </Button>
                      </div>
                    )
                  })}
                </div>
              )}

              {/* Available catalog interventions */}
              {matching.length === 0 ? (
                <p
                  style={{
                    fontSize: 13,
                    color: 'var(--text-muted)',
                  }}
                >
                  Nenhuma intervencao catalogada encontrada para este fator e nivel de risco.
                </p>
              ) : (
                <>
                  <h4
                    style={{
                      fontSize: 11,
                      textTransform: 'uppercase',
                      letterSpacing: '0.08em',
                      color: 'var(--text-secondary)',
                      marginBottom: 8,
                    }}
                  >
                    Intervencoes Disponiveis
                  </h4>
                  {matching.map((item) => {
                    const alreadySelected = isAlreadySelected(rs.id, item.id)
                    return (
                      <div key={item.id} className="program-card">
                        <div className="flex-between" style={{ marginBottom: 6 }}>
                          <h4>{item.name}</h4>
                          <Button
                            variant={alreadySelected ? 'secondary' : 'primary'}
                            size="sm"
                            onClick={() => handleAddIntervention(rs.id, item.id)}
                            disabled={alreadySelected || adding === item.id}
                          >
                            {alreadySelected
                              ? 'Selecionada'
                              : adding === item.id
                                ? 'Adicionando...'
                                : 'Selecionar'}
                          </Button>
                        </div>
                        {item.objetivo && (
                          <p
                            style={{
                              fontSize: 12,
                              color: 'var(--accent)',
                              marginBottom: 4,
                              fontWeight: 600,
                            }}
                          >
                            Objetivo: {item.objetivo}
                          </p>
                        )}
                        <p
                          style={{
                            fontSize: 13,
                            color: 'var(--text-secondary)',
                            lineHeight: 1.6,
                          }}
                        >
                          {item.description}
                        </p>
                        <div className="meta">
                          <span>Modalidade: {item.modalidade}</span>
                          <span>Duracao: {item.duracao}</span>
                          <span>Publico-alvo: {item.publico_alvo}</span>
                        </div>
                      </div>
                    )
                  })}
                </>
              )}
            </CardBody>
          </Card>
        )
      })}

      {atRiskScores.length > 0 && selected.length === 0 && (
        <EmptyState
          icon="📋"
          title="Nenhuma intervencao selecionada"
          description="Selecione pelo menos uma intervencao para cada fator de risco antes de prosseguir."
        />
      )}

      <div className="btn-group" style={{ justifyContent: 'flex-end' }}>
        <Button
          variant="secondary"
          onClick={() => router.push(`/avaliacoes/${id}/resultado`)}
        >
          Voltar ao Resultado
        </Button>
        <Button
          variant="primary"
          onClick={() => router.push(`/avaliacoes/${id}/plano`)}
          disabled={selected.length === 0}
        >
          Prosseguir para Plano de Acao
        </Button>
      </div>
    </>
  )
}
