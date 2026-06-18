export interface Company {
  id: string
  name: string
  cnpj: string
  setor_economico: string
  porte: string
  grau_risco_nr4: number
  contato_nome: string
  contato_email: string
  contato_telefone: string
  observacoes: string | null
  created_by: string
  created_at: string
  sectors?: Sector[]
}

export interface Sector {
  id: string
  company_id: string
  name: string
  num_trabalhadores: number
  gestor_nome: string
  created_at: string
}

export type AssessmentMode = 'institucional' | 'anonimo'

export type AssessmentStatus =
  | 'draft'
  | 'in_progress'
  | 'coletando'
  | 'review'
  | 'completed'
  | 'arquivada'

export type RiskLevel = 'baixo' | 'moderado' | 'alto' | 'critico'

export interface Assessment {
  id: string
  company_id: string
  sector_id: string
  mode: AssessmentMode
  cycle_number: number
  status: AssessmentStatus
  created_by: string
  started_at: string | null
  completed_at: string | null
  respondente_nome: string | null
  respondente_cargo: string | null
  minimo_respondentes: number | null
  link_survey: string | null
  indice_risco_geral: number | null
  nivel_risco_geral: RiskLevel | null
  companies?: { name: string }
  sectors?: { name: string; num_trabalhadores: number }
}

export interface Factor {
  id: number
  code: string
  name: string
  dimension: string
  consequence: string
  order_index: number
}

export type ScaleType = 'frequency' | 'concordance' | 'existencia'

export interface Question {
  id: number
  factor_id: number
  question_code: string
  text: string
  scale_type: ScaleType
  reverse_scored: boolean
  order_index: number
}

export interface AssessmentResponse {
  id: string
  assessment_id: string
  question_id: number
  score: number
  valor_normalizado: number | null
  answered_by: string | null
  sessao_anonima: string | null
}

export interface RiskScore {
  id: string
  assessment_id: string
  factor_id: number
  raw_score: number
  severity: number
  probability: number
  final_score: number
  classification: RiskLevel
  factors?: { name: string; code: string; dimension: string; consequence: string }
}

export interface FactorObservation {
  id: string
  assessment_id: string
  factor_id: number
  observation: string
}

export interface InterventionCatalog {
  id: string
  name: string
  objetivo: string
  description: string
  modalidade: string
  duracao: string
  publico_alvo: string
  target_factor_ids: number[]
  min_risk_level: RiskLevel
  is_custom: boolean
  created_by: string | null
  created_at: string
}

export interface AssessmentIntervention {
  id: string
  assessment_id: string
  risk_score_id: string
  catalog_id: string | null
  custom_name: string | null
  custom_description: string | null
  created_by: string
  intervention_catalog?: InterventionCatalog
  risk_scores?: RiskScore
}

export type ApprovalStatus = 'pendente' | 'aprovado' | 'com_ressalvas' | 'em_revisao'

export interface ActionPlan {
  id: string
  assessment_id: string
  approval_status: ApprovalStatus
  approval_notes: string | null
  approver_name: string | null
  approver_role: string | null
  approved_by: string | null
  approved_at: string | null
}

export type ActionType = 'eliminacao' | 'reducao' | 'controle' | 'epi'

export type ActionPriority = 'baixo' | 'moderado' | 'alto' | 'critico'

export type ActionStatus = 'pendente' | 'em_andamento' | 'concluida' | 'atrasada'

export interface ActionItem {
  id: string
  action_plan_id: string
  intervention_id: string
  description: string
  action_type: ActionType
  priority: ActionPriority
  status: ActionStatus
  responsible_name: string
  due_date: string | null
  completion_pct: number
}

export interface Profile {
  id: string
  full_name: string
  crp: string | null
}

export interface CompanyUser {
  company_id: string
  user_id: string
  role: string
}

export type SessaoAnonimaStatus = string

export interface SessaoAnonima {
  token: string
  assessment_id: string
  status: SessaoAnonimaStatus
  concluida_em: string | null
}
