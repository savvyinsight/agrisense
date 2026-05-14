import { useMemo } from 'react';
import type { Device, Alert2, Field } from '@/shared/types';
import { cn } from '@/shared/lib/cn';

interface StatusSummaryProps {
  devices: Device[];
  fields: Field[];
  alerts: Alert2[];
  weather?: { temperature: number; condition: string } | null;
  onViewAlerts?: () => void;
  onViewDetails?: () => void;
}

export function StatusSummary({
  devices,
  fields,
  alerts,
  weather,
  onViewAlerts,
  onViewDetails,
}: StatusSummaryProps) {
  

  // Calculate health metrics
  const metrics = useMemo(() => {
    const onlineDevices = devices.filter(d => d.status === 'online').length;
    const healthPct = devices.length > 0 ? Math.round((onlineDevices / devices.length) * 100) : 0;
    
    const criticalAlerts = alerts.filter(a => a.status === 'active' && a.severity === 'critical').length;
    const warningAlerts = alerts.filter(a => a.status === 'active' && a.severity === 'high').length;
    const fieldsAtRisk = fields.filter(f => f.health !== 'healthy').length;
    
    const healthStatus = criticalAlerts > 0 ? 'critical' : warningAlerts > 0 ? 'warning' : healthPct === 100 ? 'healthy' : 'info';
    
    return {
      healthPct,
      onlineDevices,
      totalDevices: devices.length,
      criticalAlerts,
      warningAlerts,
      fieldsAtRisk,
      healthStatus,
    };
  }, [devices, fields, alerts]);

  const statusColor = {
    critical: 'bg-red-50 border-red-200',
    warning: 'bg-amber-50 border-amber-200',
    healthy: 'bg-green-50 border-green-200',
    info: 'bg-blue-50 border-blue-200',
  }[metrics.healthStatus];

  const statusTextColor = {
    critical: 'text-red-700',
    warning: 'text-amber-700',
    healthy: 'text-green-700',
    info: 'text-blue-700',
  }[metrics.healthStatus];

  const statusIcon = {
    critical: '🔴',
    warning: '🟡',
    healthy: '🟢',
    info: '🔵',
  }[metrics.healthStatus];

  return (
    <div className={cn('rounded-lg border-2 p-4 md:p-6', statusColor)}>
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-2xl">{statusIcon}</span>
            <h2 className={cn('text-lg md:text-xl font-bold', statusTextColor)}>
              {metrics.healthStatus === 'critical' && 'Critical Issues'}
              {metrics.healthStatus === 'warning' && 'Attention Required'}
              {metrics.healthStatus === 'healthy' && 'All Systems Healthy'}
              {metrics.healthStatus === 'info' && 'Farm Status'}
            </h2>
          </div>
          {weather && (
            <p className="text-sm text-text-secondary">
              🌡️ {weather.temperature.toFixed(1)}°C, {weather.condition}
            </p>
          )}
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        {/* Health % */}
        <div className="bg-white rounded-lg p-3 border border-border-light">
          <p className="text-xs text-text-secondary mb-1">Farm Health</p>
          <p className="text-2xl font-bold text-text-primary">{metrics.healthPct}%</p>
          <p className="text-xs text-text-secondary">{metrics.onlineDevices}/{metrics.totalDevices} online</p>
        </div>

        {/* Critical Alerts */}
        <div className={cn(
          'rounded-lg p-3 border',
          metrics.criticalAlerts > 0
            ? 'bg-red-50 border-red-200'
            : 'bg-white border-border-light'
        )}>
          <p className="text-xs text-text-secondary mb-1">Critical</p>
          <p className={cn('text-2xl font-bold', metrics.criticalAlerts > 0 ? 'text-red-600' : 'text-text-primary')}>
            {metrics.criticalAlerts}
          </p>
          <p className="text-xs text-text-secondary">Requires immediate action</p>
        </div>

        {/* Warning Alerts */}
        <div className={cn(
          'rounded-lg p-3 border',
          metrics.warningAlerts > 0
            ? 'bg-amber-50 border-amber-200'
            : 'bg-white border-border-light'
        )}>
          <p className="text-xs text-text-secondary mb-1">Warning</p>
          <p className={cn('text-2xl font-bold', metrics.warningAlerts > 0 ? 'text-amber-600' : 'text-text-primary')}>
            {metrics.warningAlerts}
          </p>
          <p className="text-xs text-text-secondary">Monitor closely</p>
        </div>

        {/* Fields at Risk */}
        <div className={cn(
          'rounded-lg p-3 border',
          metrics.fieldsAtRisk > 0
            ? 'bg-orange-50 border-orange-200'
            : 'bg-white border-border-light'
        )}>
          <p className="text-xs text-text-secondary mb-1">Fields at Risk</p>
          <p className={cn('text-2xl font-bold', metrics.fieldsAtRisk > 0 ? 'text-orange-600' : 'text-text-primary')}>
            {metrics.fieldsAtRisk}
          </p>
          <p className="text-xs text-text-secondary">of {fields.length} total</p>
        </div>
      </div>

      {/* Critical Alert Details */}
      {metrics.criticalAlerts > 0 && (
        <div className="bg-red-50 border border-red-200 rounded p-3 mb-4">
          <p className="text-sm font-semibold text-red-700 mb-2">🔴 Critical Alerts</p>
          {alerts
            .filter(a => a.status === 'active' && a.severity === 'critical')
            .slice(0, 2)
            .map(alert => (
              <div key={alert.id} className="text-sm text-red-700 mb-1">
                <p className="font-medium">{alert.title}</p>
                {alert.recommended_action && (
                  <p className="text-xs text-red-600 mt-0.5">→ {alert.recommended_action}</p>
                )}
              </div>
            ))}
          {metrics.criticalAlerts > 2 && (
            <button
              onClick={onViewAlerts}
              className="text-xs font-semibold text-red-600 hover:text-red-700 mt-2"
            >
              View all {metrics.criticalAlerts} critical alerts →
            </button>
          )}
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex gap-2">
        {metrics.criticalAlerts > 0 && (
          <button
            onClick={onViewAlerts}
            className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-semibold hover:bg-red-700 transition-colors"
          >
            View Critical Alerts
          </button>
        )}
        <button
          onClick={onViewDetails}
          className="flex-1 px-4 py-2 bg-text-primary text-white rounded-lg text-sm font-semibold hover:bg-text-secondary transition-colors"
        >
          View Details →
        </button>
      </div>
    </div>
  );
}

export default StatusSummary;
