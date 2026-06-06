import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { Alert2 } from '@/shared/types';
import { cn } from '@/shared/lib/cn';

interface CriticalAlertsSectionProps {
  alerts: Alert2[];
  onViewAll?: () => void;
  onAcknowledge?: (alertId: number) => void;
}

export function CriticalAlertsSection({
  alerts,
  onViewAll,
  onAcknowledge,
}: CriticalAlertsSectionProps) {
  const { t } = useTranslation();
  // Filter for critical and warning alerts only
  const activeAlerts = useMemo(() => {
    return alerts
      .filter(a => a.status === 'active' && (a.severity === 'critical' || a.severity === 'high'))
      .sort((a, b) => {
        // Critical first, then by timestamp (newest first)
        if (a.severity !== b.severity) {
          return (a.severity === 'critical' ? 0 : 1) - (b.severity === 'critical' ? 0 : 1);
        }
        return new Date(b.triggered_at || 0).getTime() - new Date(a.triggered_at || 0).getTime();
      })
      .slice(0, 5); // Show top 5
  }, [alerts]);

  if (activeAlerts.length === 0) {
    return null;
  }

  const criticalCount = activeAlerts.filter(a => a.severity === 'critical').length;
  const warningCount = activeAlerts.filter(a => a.severity === 'high').length;

  return (
    <div className="rounded-lg border-2 border-amber-300 bg-amber-50 p-4 md:p-5">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          {criticalCount > 0 ? (
            <>
              <span className="text-2xl">🔴</span>
              <div>
                <p className="font-bold text-red-700 text-sm md:text-base">
                  {t('dashboard.criticalAlertCount', { count: criticalCount })}
                </p>
                {warningCount > 0 && (
                  <p className="text-xs text-amber-700">{t('dashboard.warningCount', { count: warningCount })}</p>
                )}
              </div>
            </>
          ) : (
            <>
              <span className="text-2xl">🟡</span>
              <div>
                <p className="font-bold text-amber-700 text-sm md:text-base">
                  {t('dashboard.warningAlertCount', { count: warningCount })}
                </p>
                <p className="text-xs text-amber-700">{t('dashboard.requiresAttention')}</p>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Alert List */}
      <div className="space-y-2 mb-4">
        {activeAlerts.map((alert) => (
          <div
            key={alert.id}
            className={cn(
              'rounded-lg p-3 bg-white border-l-4',
              alert.severity === 'critical' ? 'border-l-red-500 border-red-100' : 'border-l-amber-500 border-amber-100'
            )}
          >
            {/* Alert Title + Field */}
            <div className="flex items-start justify-between mb-1">
              <div className="flex-1">
                <p className={cn(
                  'font-semibold text-sm',
                  alert.severity === 'critical' ? 'text-red-700' : 'text-amber-700'
                )}>
                  {alert.severity === 'critical' ? '🔴' : '🟡'} {alert.title}
                </p>
                {alert.field_name && (
                  <p className="text-xs text-text-secondary">{t('dashboard.fieldLabel', { name: alert.field_name })}</p>
                )}
              </div>
              <button
                onClick={() => onAcknowledge?.(alert.id)}
                className="ml-2 px-2 py-1 text-xs font-medium text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded transition-colors"
                title={t('dashboard.acknowledgeThisAlert')}
              >
                ✓
              </button>
            </div>

            {/* Recommended Action */}
            {alert.recommended_action && (
              <p className={cn(
                'text-xs mt-1 p-2 rounded bg-opacity-10',
                alert.severity === 'critical' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
              )}>
                💡 {alert.recommended_action}
              </p>
            )}

            {/* Timestamp */}
            <p className="text-xs text-text-secondary mt-1">
              {alert.triggered_at ? new Date(alert.triggered_at).toLocaleTimeString() : 'Now'}
            </p>
          </div>
        ))}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between">
        <p className="text-xs text-amber-700">
          {activeAlerts.length < (alerts.filter(a => a.status === 'active' && (a.severity === 'critical' || a.severity === 'high')).length) && (
            t('dashboard.showingAlerts', { shown: activeAlerts.length, total: alerts.filter(a => a.status === 'active' && (a.severity === 'critical' || a.severity === 'high')).length })
          )}
        </p>
        <button
          onClick={onViewAll}
          className="px-3 py-1.5 text-xs font-semibold bg-amber-600 text-white rounded hover:bg-amber-700 transition-colors"
        >
          {t('dashboard.viewAllAlertsLink')}
        </button>
      </div>
    </div>
  );
}

export default CriticalAlertsSection;
