"use client";

import { useState, useEffect } from 'react';

// Widget de métricas principales tipo Grafana
export default function MetricsDashboard() {
  const [metrics, setMetrics] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  // Métricas simuladas para demostración
  const mockMetrics = [
    {
      title: 'Máquinas Activas',
      value: 12,
      total: 15,
      percentage: 80,
      trend: '+5%',
      color: 'green',
      icon: '🟢'
    },
    {
      title: 'Llamados Activos',
      value: 3,
      total: 15,
      percentage: 20,
      trend: '-2%',
      color: 'orange',
      icon: '🔴'
    },
    {
      title: 'Tiempo Medio RR',
      value: '8.5',
      unit: 'min',
      trend: '-1.2min',
      color: 'blue',
      icon: '⏱️',
      description: 'Resolución'
    },
    {
      title: 'Eficiencia OEE',
      value: 85.2,
      unit: '%',
      trend: '+2.1%',
      color: 'purple',
      icon: '📊'
    },
    {
      title: 'Paradas Planificadas',
      value: 1,
      description: 'Próxima: 14:00',
      color: 'gray',
      icon: '📅'
    },
    {
      title: 'Trabajadores Online',
      value: 25,
      total: 28,
      percentage: 89,
      trend: '+3',
      color: 'cyan',
      icon: '👥'
    }
  ];

  useEffect(() => {
    // Simular carga de datos
    setTimeout(() => {
      setMetrics(mockMetrics);
      setIsLoading(false);
    }, 800);
  }, []);

  const getColorClass = (color) => {
    const colors = {
      green: 'text-green-600 bg-green-100',
      orange: 'text-orange-600 bg-orange-100',
      blue: 'text-blue-600 bg-blue-100',
      purple: 'text-purple-600 bg-purple-100',
      gray: 'text-gray-600 bg-gray-100',
      cyan: 'text-cyan-600 bg-cyan-100'
    };
    return colors[color] || 'text-gray-600 bg-gray-100';
  };

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="bg-white border rounded-lg p-4 animate-pulse">
            <div className="h-4 bg-gray-200 rounded mb-2"></div>
            <div className="h-8 bg-gray-200 rounded mb-2"></div>
            <div className="h-3 bg-gray-200 rounded"></div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
      {metrics.map((metric, index) => (
        <MetricCard key={index} metric={metric} />
      ))}
    </div>
  );
}

// Componente individual de métrica
function MetricCard({ metric }) {
  const getColorClass = (color) => {
    const colors = {
      green: 'text-green-600 bg-green-100 border-green-200',
      orange: 'text-orange-600 bg-orange-100 border-orange-200',
      blue: 'text-blue-600 bg-blue-100 border-blue-200',
      purple: 'text-purple-600 bg-purple-100 border-purple-200',
      gray: 'text-gray-600 bg-gray-100 border-gray-200',
      cyan: 'text-cyan-600 bg-cyan-100 border-cyan-200'
    };
    return colors[metric.color] || 'text-gray-600 bg-gray-100 border-gray-200';
  };

  const getProgressColor = (color) => {
    const colors = {
      green: 'bg-green-500',
      orange: 'bg-orange-500',
      blue: 'bg-blue-500',
      purple: 'bg-purple-500',
      gray: 'bg-gray-500',
      cyan: 'bg-cyan-500'
    };
    return colors[metric.color] || 'bg-gray-500';
  };

  const isPositiveTrend = metric.trend && metric.trend.startsWith('+');
  const trendColor = isPositiveTrend ? 'text-green-600' : 
                     metric.trend && metric.trend.startsWith('-') ? 'text-red-600' : 
                     'text-gray-600';

  return (
    <div className={`border rounded-lg p-4 transition-all hover:shadow-md ${getColorClass(metric.color)}`}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center space-x-2">
          <span className="text-lg">{metric.icon}</span>
          <span className="text-sm font-medium opacity-80">{metric.title}</span>
        </div>
      </div>

      <div className="mb-2">
        <div className="flex items-baseline space-x-1">
          <span className="text-2xl font-bold">{metric.value}</span>
          {metric.unit && <span className="text-sm opacity-60">{metric.unit}</span>}
        </div>
      </div>

      {/* Barra de progreso si hay total definido */}
      {metric.total && (
        <div className="mb-2">
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div 
              className={`h-2 rounded-full ${getProgressColor(metric.color)}`}
              style={{ width: `${(metric.value / metric.total) * 100}%` }}
            ></div>
          </div>
          <div className="text-xs opacity-60 mt-1">
            {metric.value}/{metric.total}
          </div>
        </div>
      )}

      {/* Tendencia o descripción adicional */}
      <div className="flex items-center justify-between">
        {metric.trend ? (
          <span className={`text-xs font-medium ${trendColor}`}>
            {metric.trend}
          </span>
        ) : metric.description ? (
          <span className="text-xs opacity-60">{metric.description}</span>
        ) : null}
        
        {/* Indicador de actualización en tiempo real */}
        <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
      </div>
    </div>
  );
}
