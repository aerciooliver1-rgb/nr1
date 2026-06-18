import React from 'react';

interface PageHeaderProps {
  title: string;
  breadcrumb: string;
  children?: React.ReactNode;
}

export function PageHeader({ title, breadcrumb, children }: PageHeaderProps) {
  return (
    <div className="page-header">
      <div>
        <h1>{title}</h1>
        <div className="breadcrumb">{breadcrumb}</div>
      </div>
      {children && <div className="btn-group">{children}</div>}
    </div>
  );
}
