"use client";

import { useState, useEffect } from 'react';

// Panel de alertas activas en tiempo real
export default function AlertPanel() {
  const [alerts, setAlerts] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [alertCount, setAlertCount] = useState(0);

  // Datos simulados de alertas
  const mockAlerts = [
    {
      id: 'ALT001',
      device: 'Fresadora CNC',
      department: 'Ingeniería',
      priority: 'high',
      type: 'maintenance',
      status: 'active',
      message: 'Fallo en refrigerante - Temperatura elevada',
      timestamp: new Date(Date.now() - 8 * 60 * 1000),
      escalationLevel: 1,
      ageInMinutes: 8,
      assignedTo: null,
      notificationSent: ['torreta', 'display']
    },
    {
      id: 'ALT002',
      device: 'Conveyor Belt',
      department: 'Mantenimiento',
      priority: 'critical',
      type: 'emergency',
      status: 'escalation',
      message: 'Motor sobrecalentado - Parada de emergencia recomendada',
      timestamp: new Date(Date.now() - 25 * 60 * 1000),
      escalationLevel: 2,
      ageInMinutes: 25,
      assignedTo: 'Carlos M.',
      notificationSent: ['torreta', 'display', 'email', 'telegram']
    },
    {
      id: 'ALT003',
      device: 'Soldadora Robot',
      department: 'Calidad',
      priority: 'medium',
      type: 'quality',
      status: 'acknowledged',
      message: 'Desviación en parámetros de soldadura detectada',
      timestamp: new Date(Date.now() - 45 * 60 * 1000),
      escalationLevel: 0,
      ageInMinutes: 45,
      assignedTo: 'Ana R.',
      notificationSent: ['display', 'email']
    }
  ];

  useEffect(() => {
    // Simular carga de alertas
    setTimeout(() => {
      setAlerts(mockAlerts);
      setAlertCount(mockAlerts.length);
      setIsLoading(false);
    }, 500);

    // Actualización en tiempo real cada 30 segundos
    const interval = setInterval(() => {
      setAlerts(prev => 
        prev.map(alert => ({
          ...alert,
          ageInMinutes: Math.floor((Date.now() - alert.timestamp) / 60000)
        }))
      );
    }, 30000);

    return () => clearInterval(interval);
  }, []);

  const getPriorityColor = (priority) => {
    const colors = {
      'low': 'border-gray-300 bg-gray-50',
      'medium': 'border-yellow-300 bg-yellow-50',
      'high': 'border-orange-300 bg-orange-50',
      'critical': 'border-red-300 bg-red-50'
    };
    return colors[priority] || 'border-gray-300 bg-gray-50';
  };

  const getStatusIcon = (status) => {
    const icons = {
      'active': '🔴',
      'acknowledged': '🟡',
      'escalation': '🟠',
      'resolved': '🟢',
      'unassigned': '⚪'
    };
    return icons[status] || '⚪';
  };

  const getEscalationBadge = (level) => {
    if (level === 0) return null;
    return (
      <span className="badge badge-warning text-xs">
        Escalamiento Nivel {level}
      </span>
    );
  };

  const formatTimeAgo = (minutes) => {
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h ${mins}m`;
  };

  const acknowledgeAlert = (alertId) => {
    setAlerts(prev => 
      prev.map(alert => 
        alert.id === alertId 
          ? { ...alert, status: 'acknowledged', assignedTo: 'Usuario Actual' }
          : alert
      )
    );
  };

  if (isLoading) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 rounded mb-4"></div>
          <div className="space-y-3">
            {Array.from({ length: 3 }, (_, i) => (
              <div key={i} className="h-16 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow p-6">
      {/* Header del panel */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold text-gray-900">
          Alertas Activas ({alertCount})
        </h2>
        <div className="flex items-center space-x-2">
          <div className="w-3 h-3 bg-red-400 rounded-full animate-pulse"></div>
          <span className="text-sm text-gray-600">Tiempo Real</span>
        </div>
      </div>

      {/* Lista de alertas */}
      <div className="space-y-3">
        {alerts.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <div className="text-4xl mb-2">✅</div>
            <p>No hay alertas activas</p>
          </div>
        ) : (
          alerts.map(alert => (
            <AlertCard
              key={alert.id}
              alert={alert}
              onAcknowledge={acknowledgeAlert}
            />
          ))
        )}
      </div>

      {/* Footer con acciones */}
      <div className="mt-4 pt-4 bg-gray-50 rounded p-3 border-t">
        <div className="flex justify-between items-center text-sm text-gray-600">
          <span>
            Última actualización: {new Date().toLocaleTimeString()}
          </span>
          <button className="btn btn-sm btn-outline">
            Ver Todas las Alertas
          </button>
        </div>
      </div>
    </div>
  );
}

// Componente individual de alerta
function AlertCard({ alert, onAcknowledge }) {
  const getPriorityColor = (priority) => {
    const colors = {
      'low': 'border-gray-300 bg-gray-50',
      'medium': 'border-yellow-300 bg-yellow-50',
      'high': 'border-orange-300 bg-orange-50',
      'critical': 'border-red-300 bg-red-50'
    };
    return colors[priority] || 'border-gray-300 bg-gray-50';
  };

  const getStatusColor = (status) => {
    const colors = {
      'active': 'text-red-600',
      'acknowledged': 'text-yellow-600',
      'escalation': 'text-orange-600',
      'resolved': 'text-green-600',
      'unassigned': 'text-gray-600'
    };
    return colors[status] || 'text-gray-600';
  };

  const getStatusIcon = (status) => {
    const icons = {
      'active': '🔴',
      'acknowledged': '🟡',
      'escalation': '🟠',
      'resolved': '🟢',
      'unassigned': '⚪'
    };
    return icons[status] || '⚪';
  };

  const formatTimeAgo = (minutes) => {
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h ${mins}m`;
  };

  return (
    <div className={`border rounded-lg p-4 transition-all hover:shadow-md ${getPriorityColor(alert.priority)}`}>
      <div className="flex items-start justify-between">
        {/* Información principal */}
        <div className="flex-1">
          <div className="flex items-center space-x-2 mb-2">
            <span className="font-semibold text-gray-900">{alert.device}</span>
            <span className={`text-sm ${getStatusColor(alert.status)}`}>
              {getStatusIcon(alert.status)}
            </span>
            <span className="badge badge-sm badge-outline">
              {alert.priority.toUpperCase()}
            </span>
            {alert.escalationLevel > 0 && (
              <span className="badge badge-sm badge-warning">
                N{alert.escalationLevel}
              </span>
            )}
          </div>

          <p className="text-gray-700 mb-2">{alert.message}</p>

          <div className="flex items-center space-x-4 text-xs text-gray-500">
            <span>🕐 {formatTimeAgo(alert.ageInMinutes)}</span>
            <span>🎯 {alert.department}</span>
            {alert.assignedTo && (
              <span>👤 {alert.assignedTo}</span>
            )}
          </div>
        </div>

        {/* Acciones */}
        <div className="flex flex-col space-y-2">
          {alert.status === 'active' && (
            <button
              onClick={() => onAcknowledge(alert.id)}
              className="btn btn-sm btn-primary"
            >
              Atender
            </button>
          )}
          
          <button className="btn btn-sm btn-outline">
            Ver Detalles
          </button>
        </div>
      </div>

      {/* Notificaciones enviadas */}
      {alert.notificationSent.length > 0 && (
        <div className="mt-2 pt-2 border-t border-gray-200">
          <div className="flex items-center space-x-2 text-xs text-gray-500">
            <span>Notificado vía:</span>
            {alert.notificationSent.map(notif => (
              <span key={notif} className="badge badge-xs">
                {notif === 'torreta' ? '🚨' : 
                 notif === 'display' ? '📺' : 
                 notif === 'email' ? '📧' : 
                 notif === 'telegram' ? '📲' : notif}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
