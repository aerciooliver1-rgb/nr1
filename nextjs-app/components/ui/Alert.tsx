import React from 'react';

interface AlertProps {
  variant: 'info' | 'warning' | 'success' | 'danger';
  children: React.ReactNode;
}

export function Alert({ variant, children }: AlertProps) {
  return (
    <div className={`alert alert-${variant}`}>
      {children}
    </div>
  );
}
