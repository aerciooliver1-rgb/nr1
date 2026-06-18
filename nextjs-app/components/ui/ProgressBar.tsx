import React from 'react';

interface ProgressBarProps {
  value: number;
  color: 'green' | 'orange' | 'red';
}

export function ProgressBar({ value, color }: ProgressBarProps) {
  return (
    <div className="progress-bar">
      <div
        className={`fill ${color}`}
        style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
      />
    </div>
  );
}
