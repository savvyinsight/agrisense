import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@/shared/stores/authStore';
import { useAlertsStore } from '@/shared/stores/alertsStore';
import { useWebSocket } from '@/shared/hooks/useWebSocket';
import { getActiveAlerts, getAlertHistory, acknowledgeAlert, getAlertRules } from '@/features/alerts/api';
import { groupAlerts, getIssueTypeEmoji, getIssueTypeLabel } from '@/features/alerts/groupAlerts';
import { alertNotificationService } from '@/features/alerts/NotificationService';
import { AlertRuleDetail } from '@/features/alerts/AlertRuleDetail';
import { cn } from '@/shared/lib/cn';
import { toast } from '@/shared/components/Toast';
import type { Alert2, WebSocketMessage, SensorDataMessage, AlertRule } from '@/shared/types';

const severityIcon: Record<string, string> = { critical: '🔴', high: '🟠', medium: '🟡', low: '🔵' };
const severityBorder: Record<string, string> = { critical: 'border-l-critical', high: 'border-l-warning', medium: 'border-l-warning', low: 'border-l-info' };
const severityBg: Record<string, string> = { critical: 'bg-critical-bg', high: 'bg-warning-bg', medium: '', low: '' };

export default function Alerts() {
  const { t } = useTranslation();
  const { alerts, setAlerts, addAlert } = useAlertsStore();
  const token = useAuthStore((s) => s.token);
  const [tab, setTab] = useState<'active' | 'history' | 'grouped'>('active');
  const [history, setHistory] = useState<Alert2[]>([]);
  const [alertRules, setAlertRules] = useState<AlertRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [notificationEnabled, setNotificationEnabled] = useState(false);

  useWebSocket(token, (data: WebSocketMessage) => {
    if (data.type !== 'sensor_data') return;
    const p = (data as SensorDataMessage).payload as { device_id: string; value: number };
    if (p.value > 30) {
      const newAlert: Alert2 = {
        id: Date.now(), device_id: p.device_id,
        title: `High temperature detected on ${p.device_id}`,
        message: `Temperature reached ${p.value.toFixed(1)}°C — above safe threshold of 30°C`,
        severity: p.value > 35 ? 'critical' : 'high', status: 'active', triggered_at: new Date().toISOString(),
        recommended_action: p.value > 35 ? 'Inspect field immediately. Check irrigation and shade coverage.' : 'Monitor temperature. Consider ventilation.',
        confidence: p.value > 35 ? 95 : 80,
      };
      addAlert(newAlert);
      // Send push notification if enabled
      if (notificationEnabled) {
        alertNotificationService.sendAlert(newAlert);
      }
    }
  });

  useEffect(() => {
    // Request notification permission on mount
    alertNotificationService.requestPermission().then((granted) => {
      setNotificationEnabled(granted);
    });
  }, []);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const [alertRes, rulesRes] = await Promise.all([
        tab === 'active' ? getActiveAlerts() : getAlertHistory(),
        getAlertRules(),
      ]);

      if (alertRes.success && alertRes.data) {
        const mapped: Alert2[] = (alertRes.data.alerts || []).map((a) => ({
          id: a.id, device_id: a.device_id, device_name: a.device_name, rule_name: a.rule_name,
          title: a.message, message: a.message,
          severity: a.severity === 'critical' ? 'critical' : a.severity === 'warning' ? 'high' : 'medium',
          status: a.status === 'acknowledged' ? 'acknowledged' : a.status === 'resolved' ? 'resolved' : 'active',
          triggered_at: a.triggered_at, confidence: 85,
          recommended_action: a.severity === 'critical' ? 'Inspect immediately. Check equipment and environmental conditions.' : 'Monitor situation. No immediate action required.',
        }));
        if (tab === 'active') setAlerts(mapped);
        else setHistory(mapped);
      }

      if (rulesRes.success && rulesRes.data) {
        setAlertRules(rulesRes.data.rules || []);
      }

      setLoading(false);
    })();
  }, [tab, setAlerts]);

  const handleAcknowledge = async (id: number) => {
    const res = await acknowledgeAlert(id);
    if (res.success) { setAlerts(alerts.filter((a) => a.id !== id)); toast('success', t('alerts.alertAcknowledged')); }
    else toast('error', t('alerts.acknowledgeError'));
  };

  const display = tab === 'active' ? alerts : tab === 'history' ? history : alerts;
  const grouped = groupAlerts(display);
  const activeCount = alerts.filter((a) => a.status === 'active').length;
  const critical = display.filter((a) => a.severity === 'critical');
  const high = display.filter((a) => a.severity === 'high');
  const other = display.filter((a) => a.severity === 'medium' || a.severity === 'low');

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-lg font-bold text-text-primary">{t('alerts.title')}</h1>
        <p className="text-sm text-text-muted mt-0.5">{t('alerts.subtitle')}</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 rounded-lg bg-surface-card p-1 border border-border-default w-fit">
        <button onClick={() => setTab('active')} className={cn('px-4 py-2 text-sm font-medium rounded-md transition-colors', tab === 'active' ? 'bg-accent text-white' : 'text-text-secondary hover:text-text-primary')}>
          Active ({activeCount})
        </button>
        <button onClick={() => setTab('grouped')} className={cn('px-4 py-2 text-sm font-medium rounded-md transition-colors', tab === 'grouped' ? 'bg-accent text-white' : 'text-text-secondary hover:text-text-primary')}>
          Grouped ({grouped.length})
        </button>
        <button onClick={() => setTab('history')} className={cn('px-4 py-2 text-sm font-medium rounded-md transition-colors', tab === 'history' ? 'bg-accent text-white' : 'text-text-secondary hover:text-text-primary')}>
          History ({history.length})
        </button>
        {!notificationEnabled && (
          <button onClick={() => alertNotificationService.requestPermission().then(setNotificationEnabled)} className={cn('px-4 py-2 text-sm font-medium rounded-md transition-colors ml-auto text-yellow-600 hover:text-yellow-700 bg-yellow-50')}>
            🔔 Enable Notifications
          </button>
        )}
      </div>

      {loading ? (
        <div className="space-y-3">{[1, 2, 3].map((i) => <div key={i} className="h-28 rounded-lg bg-surface-card border border-border-default animate-pulse" />)}</div>
      ) : display.length === 0 ? (
        <div className="rounded-lg border border-border-default bg-surface-card p-8 text-center">
          <span className="text-3xl block mb-3">✅</span>
          <p className="text-sm text-text-primary font-medium">{tab === 'active' ? 'No active alerts' : 'No alert history'}</p>
          <p className="text-xs text-text-muted mt-1">{tab === 'active' ? 'All systems operating normally' : 'Historical alerts will appear here'}</p>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Critical alerts — most prominent */}
          {critical.map((a) => (
            <div key={a.id} className={cn('rounded-lg border border-border-default border-l-[4px] p-4', severityBorder.critical, severityBg.critical)}>
              <div className="flex items-start gap-3">
                <span className="text-lg mt-0.5">{severityIcon.critical}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-bold text-critical uppercase tracking-wider">{t('component.critical')}</span>
                    {a.confidence &&                     <span className="text-xs text-text-muted">{a.confidence}%</span>}
                    <span className="text-xs text-text-muted">{new Date(a.triggered_at).toLocaleString()}</span>
                  </div>
                  <p className="text-sm font-semibold text-text-primary mt-1">{a.title}</p>
                  {a.message && <p className="text-sm text-text-secondary mt-1">{a.message}</p>}
                  {a.recommended_action && (
                    <div className="mt-2 text-sm bg-critical/10 rounded-md p-2.5 border border-critical/20">
                      <span className="font-semibold text-critical text-xs uppercase">{t('component.recommendation')}</span>
                      <p className="text-text-primary mt-0.5">{a.recommended_action}</p>
                    </div>
                  )}
                  <div className="flex items-center gap-2 mt-3">
                    <button onClick={() => handleAcknowledge(a.id)} className="px-3 py-1.5 text-xs font-medium rounded-md bg-surface-hover text-text-secondary hover:text-text-primary hover:bg-border-default transition-colors">
                      Acknowledge
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}

          {/* High alerts */}
          {high.map((a) => (
            <div key={a.id} className={cn('rounded-lg border border-border-default border-l-[4px] p-4', severityBorder.high, severityBg.high)}>
              <div className="flex items-start gap-3">
                <span className="text-lg mt-0.5">{severityIcon.high}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-semibold text-warning uppercase tracking-wider">{t('component.high')}</span>
                    <span className="text-xs text-text-muted">{new Date(a.triggered_at).toLocaleString()}</span>
                  </div>
                  <p className="text-sm font-medium text-text-primary mt-1">{a.title}</p>
                  {a.message && <p className="text-sm text-text-secondary mt-1">{a.message}</p>}
                  {a.recommended_action && (
                    <p className="text-xs text-warning mt-2">
                      <span className="font-medium">→</span> {a.recommended_action}
                    </p>
                  )}
                  <button onClick={() => handleAcknowledge(a.id)} className="mt-2 text-xs text-text-muted hover:text-text-primary font-medium">
                    {t('component.acknowledge')}
                  </button>
                </div>
              </div>
            </div>
          ))}

          {/* Medium/low alerts — grouped, compact */}
          {other.length > 0 && (
            <div>
              <span className="text-xs font-semibold text-text-muted uppercase tracking-wider block mb-2">{t('common.info')}</span>
              <div className="space-y-1.5">
                {other.map((a) => (
                  <div key={a.id} className="flex items-center gap-3 px-3 py-2 rounded-md hover:bg-surface-hover transition-colors cursor-pointer" onClick={() => handleAcknowledge(a.id)}>
                    <span>{severityIcon.medium}</span>
                    <span className="text-sm text-text-primary flex-1 min-w-0 truncate">{a.title}</span>
                    <span className="text-xs text-text-muted shrink-0">{new Date(a.triggered_at).toLocaleTimeString()}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Grouped view */}
          {tab === 'grouped' && (
            <div className="space-y-4">
              {grouped.length === 0 ? (
                <div className="rounded-lg border border-border-default bg-surface-card p-8 text-center">
                  <span className="text-3xl block mb-3">✅</span>
                  <p className="text-sm text-text-primary font-medium">No grouped alerts</p>
                </div>
              ) : (
                grouped.map((group) => (
                  <div
                    key={group.key}
                    className={cn(
                      'rounded-lg border border-l-[4px] p-4',
                      group.severity === 'critical'
                        ? 'bg-critical-bg border-critical'
                        : group.severity === 'high'
                          ? 'bg-warning-bg border-warning'
                          : 'bg-surface-card border-border-default'
                    )}
                  >
                    <div className="flex items-start gap-3">
                      <span className="text-2xl">{getIssueTypeEmoji(group.issue_type)}</span>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 flex-wrap mb-2">
                          <span className="text-sm font-bold text-text-primary">
                            {group.field_name || 'Farm'} — {getIssueTypeLabel(group.issue_type)}
                          </span>
                          <span
                            className={cn(
                              'px-2 py-1 rounded text-xs font-semibold',
                              group.severity === 'critical'
                                ? 'bg-critical text-white'
                                : group.severity === 'high'
                                  ? 'bg-warning text-white'
                                  : 'bg-text-muted text-white'
                            )}
                          >
                            {group.count} {group.count === 1 ? 'Alert' : 'Alerts'}
                          </span>
                        </div>

                        <p className="text-sm text-text-secondary mb-3">{group.latest.title}</p>

                        {group.latest.recommended_action && (
                          <div className="mb-3 text-sm bg-text-primary/5 rounded-md p-2.5 border border-text-primary/10">
                            <span className="font-semibold text-text-primary text-xs uppercase">Recommendation</span>
                            <p className="text-text-secondary mt-0.5">{group.latest.recommended_action}</p>
                          </div>
                        )}

                        <div className="text-xs text-text-muted mb-3">
                          <p>First triggered: {new Date(group.first_triggered).toLocaleString()}</p>
                          <p>Last triggered: {new Date(group.last_triggered).toLocaleString()}</p>
                        </div>

                        {group.latest.rule_name && (
                          <AlertRuleDetail alert={group.latest} rules={alertRules} className="mb-3" />
                        )}

                        <button onClick={() => handleAcknowledge(group.latest.id)} className="px-3 py-1.5 text-xs font-medium rounded-md bg-surface-hover text-text-secondary hover:text-text-primary hover:bg-border-default transition-colors">
                          Acknowledge
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
