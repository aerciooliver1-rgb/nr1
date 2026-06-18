import React from 'react';

type BadgeVariant =
  | 'baixo'
  | 'moderado'
  | 'alto'
  | 'critico'
  | 'pendente'
  | 'em_andamento'
  | 'in_progress'
  | 'coletando'
  | 'concluida'
  | 'completed'
  | 'atrasada'
  | 'draft'
  | 'review'
  | 'aprovado'
  | 'com_ressalvas'
  | 'em_revisao';

interface BadgeProps {
  variant: BadgeVariant;
  children: React.ReactNode;
}

export function Badge({ variant, children }: BadgeProps) {
  return (
    <span className={`badge badge-${variant}`}>
      {children}
    </span>
  );
}
