import React from 'react';

interface StatItem {
  value: string | number;
  label: string;
  variant?: 'warning' | 'danger' | 'success';
}

interface StatsGridProps {
  items: StatItem[];
}

export function StatsGrid({ items }: StatsGridProps) {
  return (
    <div className="stats-grid">
      {items.map((item, index) => (
        <div
          key={index}
          className={`stat-card${item.variant ? ` ${item.variant}` : ''}`}
        >
          <div className="stat-value">{item.value}</div>
          <div className="stat-label">{item.label}</div>
        </div>
      ))}
    </div>
  );
}
