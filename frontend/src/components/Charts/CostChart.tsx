'use client'

import React, { useEffect, useRef } from 'react'
import Chart from 'chart.js/auto'

interface CostChartProps {
  data: number[]
  labels: string[]
  color?: string
  height?: number
}

export function CostChart({ data, labels, color = '#6366f1', height = 250 }: CostChartProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const chartRef = useRef<Chart | null>(null)

  useEffect(() => {
    if (!canvasRef.current) return

    const ctx = canvasRef.current.getContext('2d')
    if (!ctx) return

    // Create a smooth gradient
    const gradient = ctx.createLinearGradient(0, 0, 0, height)
    gradient.addColorStop(0, `${color}40`) // 25% opacity
    gradient.addColorStop(1, `${color}00`) // 0% opacity

    if (chartRef.current) {
      chartRef.current.destroy()
    }

    chartRef.current = new Chart(ctx, {
      type: 'line',
      data: {
        labels: labels,
        datasets: [
          {
            label: 'Cost',
            data: data,
            borderColor: color,
            backgroundColor: gradient,
            borderWidth: 2,
            pointRadius: 0,
            pointHoverRadius: 4,
            fill: true,
            tension: 0.4, // Smooth curves
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: {
          intersect: false,
          mode: 'index',
        },
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: '#111827',
            titleColor: '#9ca3af',
            bodyColor: '#f3f4f6',
            borderColor: '#374151',
            borderWidth: 1,
            padding: 12,
            displayColors: false,
            callbacks: {
              label: (context) => `$${Number(context.raw).toFixed(4)}`
            }
          }
        },
        scales: {
          x: {
            grid: { display: false, drawBorder: false },
            ticks: { color: '#6b7280', maxTicksLimit: 6 }
          },
          y: {
            grid: { color: '#1f2937', drawBorder: false },
            ticks: { 
              color: '#6b7280',
              callback: (value) => `$${value}` 
            },
            beginAtZero: true
          }
        }
      }
    })

    return () => {
      if (chartRef.current) chartRef.current.destroy()
    }
  }, [data, labels, color, height])

  return (
    <div style={{ height: `${height}px`, width: '100%' }}>
      <canvas ref={canvasRef} />
    </div>
  )
}
