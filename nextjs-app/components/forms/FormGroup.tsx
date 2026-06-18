import React from 'react';

interface FormGroupProps {
  label: string;
  children: React.ReactNode;
  className?: string;
}

export function FormGroup({ label, children, className }: FormGroupProps) {
  return (
    <div className={`form-group${className ? ` ${className}` : ''}`}>
      <label>{label}</label>
      {children}
    </div>
  );
}
