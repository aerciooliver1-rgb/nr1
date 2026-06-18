/**
 * Format a CNPJ string: XX.XXX.XXX/XXXX-XX
 */
export function formatCNPJ(cnpj: string): string {
  const digits = cnpj.replace(/\D/g, '')
  if (digits.length !== 14) return cnpj
  return digits.replace(
    /^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/,
    '$1.$2.$3/$4-$5'
  )
}

/**
 * Format a date string to pt-BR locale.
 */
export function fmtDate(date: string | null | undefined): string {
  if (!date) return '—'
  return new Date(date).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

const STATUS_MAP: Record<string, string> = {
  draft: 'Rascunho',
  in_progress: 'Em andamento',
  coletando: 'Coletando respostas',
  review: 'Em revisão',
  completed: 'Concluída',
  arquivada: 'Arquivada',
  pendente: 'Pendente',
  em_andamento: 'Em andamento',
  concluida: 'Concluída',
  atrasada: 'Atrasada',
}

/**
 * Map a status code to its Portuguese label.
 */
export function fmtStatus(status: string): string {
  return STATUS_MAP[status] ?? status
}

const APPROVAL_MAP: Record<string, string> = {
  pendente: 'Pendente',
  aprovado: 'Aprovado',
  com_ressalvas: 'Com ressalvas',
  em_revisao: 'Em revisão',
}

/**
 * Map an approval status code to its Portuguese label.
 */
export function fmtApproval(status: string): string {
  return APPROVAL_MAP[status] ?? status
}

/**
 * Escape HTML special characters to prevent XSS.
 */
export function esc(str: string): string {
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#x27;',
  }
  return str.replace(/[&<>"']/g, (ch) => map[ch])
}
