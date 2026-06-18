import React from 'react';

interface CardProps {
  className?: string;
  children: React.ReactNode;
}

export function Card({ className, children }: CardProps) {
  return (
    <div className={`card${className ? ` ${className}` : ''}`}>
      {children}
    </div>
  );
}

interface CardHeaderProps {
  children: React.ReactNode;
  action?: React.ReactNode;
}

export function CardHeader({ children, action }: CardHeaderProps) {
  return (
    <div className="card-header">
      <h2>{children}</h2>
      {action && action}
    </div>
  );
}

interface CardBodyProps {
  children: React.ReactNode;
  className?: string;
}

export function CardBody({ children, className }: CardBodyProps) {
  return (
    <div className={`card-body${className ? ` ${className}` : ''}`}>
      {children}
    </div>
  );
}
