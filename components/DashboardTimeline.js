"use client";

import { useState, useEffect } from 'react';

// Componente principal del timeline estilo Grafana
export default function DashboardTimeline() {
  const [timeRange, setTimeRange] = useState('1h'); // 1h, 4h, 8h, 24h
  const [machines, setMachines] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  // Datos simulados para demostración
  const mockMachines = [
    {
      id: 'DEV001',
      name: 'Empacadora Line A',
      status: 'active',
      currentDuration: 45, // minutos
      lastChange: new Date(Date.now() - 45 * 60 * 1000),
      timeline: [
        { time: new Date(Date.now() - 120 * 60 * 1000), status: 'call', duration: 15 },
        { time: new Date(Date.now() - 105 * 60 * 1000), status: 'maintenance', duration: 20 },
        { time: new Date(Date.now() - 85 * 60 * 1000), status: 'active', duration: 45 },
      ]
    },
    {
      id: 'DEV002',
      name: 'Fresadora CNC',
      status: 'call',
      currentDuration: 8,
      lastChange: new Date(Date.now() - 8 * 60 * 1000),
      escalationLevel: 1,
      timeline: [
        { time: new Date(Date.now() - 30 * 60 * 1000), status: 'active', duration: 22 },
        { time: new Date(Date.now() - 8 * 60 * 1000), status: 'call', duration: 8 },
      ]
    },
    {
      id: 'DEV003',
      name: 'Soldadora Robot',
      status: 'escalation',
      currentDuration: 25,
      lastChange: new Date(Date.now() - 25 * 60 * 1000),
      escalationLevel: 2,
      timeline: [
        { time: new Date(Date.now() - 60 * 60 * 1000), status: 'active', duration: 35 },
        { time: new Date(Date.now() - 25 * 60 * 1000), status: 'escalation', duration: 25 },
      ]
    },
    {
      id: 'DEV004',
      name: 'Conveyor Belt',
      status: 'critical',
      currentDuration: 12,
      lastChange: new Date(Date.now() - 12 * 60 * 1000),
      escalationLevel: 3,
      timeline: [
        { time: new Date(Date.now() - 45 * 60 * 1000), status: 'active', duration: 33 },
        { time: new Date(Date.now() - 12 * 60 * 1000), status: 'critical', duration: 12 },
      ]
    },
    {
      id: 'DEV005',
      name: 'Compresor Principal',
      status: 'offline',
      currentDuration: 60,
      lastChange: new Date(Date.now() - 60 * 60 * 1000),
      timeline: [
        { time: new Date(Date.now() - 120 * 60 * 1000), status: 'active', duration: 60 },
        { time: new Date(Date.now() - 60 * 60 * 1000), status: 'offline', duration: 60 },
      ]
    }
  ];

  useEffect(() => {
    // Simular carga de datos
    setTimeout(() => {
      setMachines(mockMachines);
      setIsLoading(false);
    }, 1000);
  }, []);

  const getTimeRangeMinutes = (range) => {
    const ranges = { '1h': 60, '4h': 240, '8h': 480, '24h': 1440 };
    return ranges[range];
  };

  const getStatusColor = (status) => {
    const colors = {
      'active': 'bg-green-500',
      'call': 'bg-yellow-500',
      'escalation': 'bg-orange-500',
      'critical': 'bg-red-500',
      'offline': 'bg-gray-500'
    };
    return colors[status] || 'bg-gray-300';
  };

  const getStatusLabel = (status) => {
    const labels = {
      'active': 'Activo',
      'call': 'Con Llamado',
      'escalation': 'Escalamiento',
      'critical': 'Crítico',
      'offline': 'Offline'
    };
    return labels[status] || status;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="loading loading-spinner loading-lg"></div>
        <span className="ml-2">Cargando timeline...</span>
      </div>
    );
  }

  return (
    <div className="w-full">
      {/* Controles de tiempo */}
      <div className="flex justify-between items-center mb-4 p-2 bg-gray-100 rounded">
        <div className="flex space-x-2">
          {['1h', '4h', '8h', '24h'].map(range => (
            <button
              key={range}
              onClick={() => setTimeRange(range)}
              className={`px-3 py-1 rounded text-sm ${
                timeRange === range ? 'bg-blue-500 text-white' : 'bg-white text-gray-700'
              }`}
            >
              {range}
            </button>
          ))}
        </div>
        <div className="text-sm text-gray-600">
          Última actualización: {new Date().toLocaleTimeString()}
        </div>
      </div>

      {/* Leyenda de colores */}
      <div className="flex space-x-4 mb-4 text-sm">
        <div className="flex items-center">
          <div className="w-4 h-4 bg-green-500 rounded mr-2"></div>
          <span>Activo</span>
        </div>
        <div className="flex items-center">
          <div className="w-4 h-4 bg-yellow-500 rounded mr-2"></div>
          <span>Llamado</span>
        </div>
        <div className="flex items-center">
          <div className="w-4 h-4 bg-orange-500 rounded mr-2"></div>
          <span>Escalamiento</span>
        </div>
        <div className="flex items-center">
          <div className="w-4 h-4 bg-red-500 rounded mr-2"></div>
          <span>Crítico</span>
        </div>
        <div className="flex items-center">
          <div className="w-4 h-4 bg-gray-500 rounded mr-2"></div>
          <span>Offline</span>
        </div>
      </div>

      {/* Timeline horizontal */}
      <div className="overflow-x-auto">
        <div className="min-w-full space-y-2">
          {machines.map(machine => (
            <TimelineRow
              key={machine.id}
              machine={machine}
              timeRange={getTimeRangeMinutes(timeRange)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

// Componente de fila del timeline
function TimelineRow({ machine, timeRange }) {
  const rowHeight = 40;
  const totalMinutes = timeRange;
  const pixelPerMinute = 600 / totalMinutes; // 600px de ancho base

  const getStatusLabel = (status) => {
    const labels = {
      'active': 'Activo',
      'call': 'Con Llamado',
      'escalation': 'Escalamiento',
      'critical': 'Crítico',
      'offline': 'Offline'
    };
    return labels[status] || status;
  };

  const getStatusColor = (status) => {
    const colors = {
      'active': 'bg-green-500',
      'call': 'bg-yellow-500',
      'escalation': 'bg-orange-500',
      'critical': 'bg-red-500',
      'offline': 'bg-gray-500'
    };
    return colors[status] || 'bg-gray-300';
  };

  return (
    <div className="flex items-center bg-white border rounded p-2 hover:shadow-md transition-shadow">
      {/* Información de la máquina */}
      <div className="flex-shrink-0 w-48 pr-4">
        <div className="flex items-center justify-between">
         <span className="font-medium">{machine.name}</span>
          <div className="flex items-center space-x-2">
            <span className={`px-2 py-1 rounded text-xs text-white ${
              machine.status === 'active' ? 'bg-green-500' :
              machine.status === 'call' ? 'bg-yellow-500' :
              machine.status === 'escalation' ? 'bg-orange-500' :
              machine.status === 'critical' ? 'bg-red-500' :
              'bg-gray-500'
            }`}>
              {getStatusLabel(machine.status)}
            </span>
            {machine.escalationLevel > 0 && (
              <span className="badge badge-warning text-xs">
                N{machine.escalationLevel}
              </span>
            )}
          </div>
        </div>
        <div className="text-xs text-gray-500">
          Duración: {machine.currentDuration}min
        </div>
      </div>

      {/* Timeline visual */}
      <div className="flex-1 relative h-8 bg-gray-100 rounded overflow-hidden">
        {/* Línea de tiempo de fondo */}
        <div className="absolute inset-0 flex items-center">
          <div className="flex w-full h-full">
            {Array.from({ length: totalMinutes }, (_, i) => (
              <div
                key={i}
                className="flex-1 border-r border-gray-200"
                style={{ minWidth: '1px' }}
              />
            ))}
          </div>
        </div>

        {/* Estados históricos */}
        {machine.timeline.map((event, index) => (
          <div
            key={index}
            className={`absolute h-full ${getStatusColor(event.status)} opacity-80`}
            style={{
              left: `${(timeRange - (new Date() - event.time) / (1000 * 60)) * pixelPerMinute}px`,
              width: `${event.duration * pixelPerMinute}px`,
            }}
            title={`${getStatusLabel(event.status)} - ${event.duration}min`}
          />
        ))}

        {/* Marcador de tiempo actual */}
        <div className="absolute top-0 bottom-0 w-0.5 bg-black z-10"
             style={{ left: `${timeRange * pixelPerMinute}px` }}>
        </div>
      </div>

      {/* Información adicional */}
      <div className="flex-shrink-0 w-24 text-right text-xs text-gray-500">
        {machine.lastChange.toLocaleTimeString()}
      </div>
    </div>
  );
}
