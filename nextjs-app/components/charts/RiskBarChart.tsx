'use client'

import { Bar } from 'react-chartjs-2'
import {
  Chart,
  type ChartData,
  type ChartOptions,
  registerables,
} from 'chart.js'

Chart.register(...registerables)
Chart.defaults.color = '#888888'
Chart.defaults.borderColor = '#252525'

interface RiskBarChartProps {
  labels: string[]
  scores: number[]
  classifications: string[]
}

const COLOR_MAP: Record<string, string> = {
  critico: '#C03060',
  alto: '#E04848',
  moderado: '#E8A020',
  baixo: '#34B89A',
}

export default function RiskBarChart({
  labels,
  scores,
  classifications,
}: RiskBarChartProps) {
  const data: ChartData<'bar'> = {
    labels,
    datasets: [
      {
        label: 'Score de Risco',
        data: scores,
        backgroundColor: classifications.map(
          (c) => COLOR_MAP[c] || '#888888'
        ),
        borderRadius: 4,
        maxBarThickness: 48,
      },
    ],
  }

  const options: ChartOptions<'bar'> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false,
      },
      tooltip: {
        backgroundColor: '#1A1A1A',
        borderColor: '#252525',
        borderWidth: 1,
        titleFont: { family: 'Sora' },
        bodyFont: { family: 'Sora' },
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        max: 100,
        grid: {
          color: '#1E1E1E',
        },
        ticks: {
          font: { family: 'Sora', size: 11 },
        },
      },
      x: {
        grid: {
          display: false,
        },
        ticks: {
          font: { family: 'Sora', size: 11 },
        },
      },
    },
  }

  return (
    <div className="chart-container">
      <Bar data={data} options={options} />
    </div>
  )
}
