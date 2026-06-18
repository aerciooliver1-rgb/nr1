import React from 'react';

interface FormRowProps {
  children: React.ReactNode;
}

export function FormRow({ children }: FormRowProps) {
  return <div className="form-row">{children}</div>;
}
