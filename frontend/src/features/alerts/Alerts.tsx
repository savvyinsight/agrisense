import { useEffect, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@/shared/stores/authStore';
import { useAlertsStore } from '@/shared/stores/alertsStore';
import { useWebSocket } from '@/shared/hooks/useWebSocket';
import { getActiveAlerts, getAlertHistory, acknowledgeAlert, resolveAlert, getAlertRules, snoozeAlert, unsnoozeAlert } from '@/features/alerts/api';
import { groupAlerts, getIssueTypeEmoji } from '@/features/alerts/groupAlerts';
import { alertNotificationService } from '@/features/alerts/NotificationService';
import { AlertRuleDetail } from '@/features/alerts/AlertRuleDetail';
import { cn } from '@/shared/lib/cn';
import { toast } from '@/shared/components/Toast';
import type { Alert2, WebSocketMessage, AlertRule } from '@/shared/types';

const PAGE_SIZE = 20;

const severityIcon: Record<string, string> = { critical: '🔴', high: '🟠', medium: '🟡', low: '🔵' };
const severityBorder: Record<string, string> = { critical: 'border-l-critical', high: 'border-l-warning', medium: 'border-l-warning', low: 'border-l-info' };
const severityBg: Record<string, string> = { critical: 'bg-critical-bg', high: 'bg-warning-bg', medium: '', low: '' };

function issueTypeLabel(issueType: string, t: (k: string) => string): string {
  const map: Record<string, string> = {
    temperature: 'alerts.issueTypeTemperature',
    moisture: 'alerts.issueTypeMoisture',
    humidity: 'alerts.issueTypeHumidity',
    irrigation: 'alerts.issueTypeIrrigation',
    device: 'alerts.issueTypeDevice',
    power: 'alerts.issueTypePower',
    sensor: 'alerts.issueTypeSensor',
    other: 'alerts.issueTypeOther',
  };
  return t(map[issueType] || 'alerts.issueTypeOther');
}

function mapSeverity(s: string): Alert2['severity'] {
  if (s === 'critical') return 'critical';
  if (s === 'warning' || s === 'high') return 'high';
  return 'medium';
}

function mapStatus(s: string): Alert2['status'] {
  if (s === 'acknowledged') return 'acknowledged';
  if (s === 'resolved') return 'resolved';
  return 'active';
}

export default function Alerts() {
  const { t } = useTranslation();
  const { alerts, setAlerts, addAlert, removeAlert, updateAlert } = useAlertsStore();
  const token = useAuthStore((s) => s.token);
  const [tab, setTab] = useState<'active' | 'history' | 'grouped'>('active');
  const [history, setHistory] = useState<Alert2[]>([]);
  const [historyTotal, setHistoryTotal] = useState(0);
  const [historyPage, setHistoryPage] = useState(1);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [alertRules, setAlertRules] = useState<AlertRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [notificationEnabled, setNotificationEnabled] = useState(false);
  const [acknowledging, setAcknowledging] = useState<Set<number>>(new Set());
  const [resolving, setResolving] = useState<Set<number>>(new Set());
  const [snoozing, setSnoozing] = useState<Set<number>>(new Set());
  const [snoozeMenu, setSnoozeMenu] = useState<number | null>(null);

  // Single WebSocket handler for alert_triggered messages from backend
  useWebSocket(token, useCallback((data: WebSocketMessage) => {
    if (data.type === 'alert_triggered') {
      const p = data.payload as Record<string, unknown>;
      const newAlert: Alert2 = {
        id: (p.id as number) || Date.now(),
        device_id: (p.device_id as string) || '',
        device_name: p.device_name as string | undefined,
        rule_name: p.rule_name as string | undefined,
        field_id: p.field_id as number | undefined,
        title: (p.message as string) || 'Alert triggered',
        message: (p.message as string) || '',
        severity: mapSeverity(p.severity as string),
        status: 'active',
        triggered_at: (p.triggered_at as string) || new Date().toISOString(),
        recommended_action: p.severity === 'critical' ? t('alerts.defaultCriticalAction') : t('alerts.defaultMonitorAction'),
        confidence: p.severity === 'critical' ? 95 : 85,
      };
      addAlert(newAlert);
      if (notificationEnabled) {
        alertNotificationService.sendAlert(newAlert);
      }
    }
  }, [addAlert, notificationEnabled, t]));

  useEffect(() => {
    alertNotificationService.requestPermission().then((granted) => {
      setNotificationEnabled(granted);
    });
  }, []);

  const loadActive = useCallback(async () => {
    setLoading(true);
    const [alertRes, rulesRes] = await Promise.all([
      getActiveAlerts(),
      getAlertRules(),
    ]);

    if (alertRes.success && alertRes.data) {
      const mapped: Alert2[] = (alertRes.data.alerts || []).map((a) => ({
        id: a.id,
        device_id: a.device_id,
        device_name: a.device_name,
        rule_name: a.rule_name,
        field_id: (a as any).field_id,
        title: a.message,
        message: a.message,
        severity: mapSeverity(a.severity),
        status: mapStatus(a.status),
        triggered_at: a.triggered_at,
        confidence: 85,
        recommended_action: a.severity === 'critical' ? t('alerts.defaultCriticalAction') : t('alerts.defaultMonitorAction'),
      }));
      setAlerts(mapped);
    }

    if (rulesRes.success && rulesRes.data) {
      setAlertRules(rulesRes.data.rules || []);
    }

    setLoading(false);
  }, [setAlerts, t]);

  const loadHistory = useCallback(async (page: number, append: boolean) => {
    setHistoryLoading(true);
    const res = await getAlertHistory(page, PAGE_SIZE);
    if (res.success && res.data) {
      const mapped: Alert2[] = (res.data.alerts || []).map((a) => ({
        id: a.id,
        device_id: a.device_id,
        device_name: a.device_name,
        rule_name: a.rule_name,
        field_id: (a as any).field_id,
        title: a.message,
        message: a.message,
        severity: mapSeverity(a.severity),
        status: mapStatus(a.status),
        triggered_at: a.triggered_at,
        confidence: 85,
        recommended_action: a.severity === 'critical' ? t('alerts.defaultCriticalAction') : t('alerts.defaultMonitorAction'),
        acknowledged_at: a.acknowledged_at,
        resolved_at: a.resolved_at,
      }));
      setHistory(append ? (prev) => [...prev, ...mapped] : mapped);
      setHistoryTotal(res.data.total ?? 0);
    }
    setHistoryLoading(false);
  }, [t]);

  useEffect(() => {
    if (tab === 'active') {
      loadActive();
    } else if (tab === 'history') {
      setHistory([]);
      setHistoryPage(1);
      loadHistory(1, false);
    }
  }, [tab, loadActive, loadHistory]);

  const handleAcknowledge = async (id: number) => {
    if (acknowledging.has(id)) return;
    setAcknowledging((prev) => new Set(prev).add(id));
    const res = await acknowledgeAlert(id);
    if (res.success) {
      removeAlert(id);
      toast('success', t('alerts.alertAcknowledged'));
    } else {
      toast('error', t('alerts.acknowledgeError'));
    }
    setAcknowledging((prev) => { const n = new Set(prev); n.delete(id); return n; });
  };

  const handleResolve = async (id: number) => {
    if (resolving.has(id)) return;
    setResolving((prev) => new Set(prev).add(id));
    const res = await resolveAlert(id);
    if (res.success) {
      updateAlert(id, { status: 'resolved', resolved_at: new Date().toISOString() });
      toast('success', t('alerts.alertResolved'));
    } else {
      toast('error', t('alerts.resolveError'));
    }
    setResolving((prev) => { const n = new Set(prev); n.delete(id); return n; });
  };

  const handleSnooze = async (id: number, minutes: number) => {
    if (snoozing.has(id)) return;
    setSnoozing((prev) => new Set(prev).add(id));
    setSnoozeMenu(null);
    const res = await snoozeAlert(id, minutes);
    if (res.success) {
      const snoozeUntil = new Date(Date.now() + minutes * 60000).toISOString();
      updateAlert(id, { snoozed_until: snoozeUntil } as any);
      toast('success', t('alerts.snoozedFor', { minutes }));
    } else {
      toast('error', res.error || t('alerts.snoozeFailed'));
    }
    setSnoozing((prev) => { const n = new Set(prev); n.delete(id); return n; });
  };

  const handleUnsnooze = async (id: number) => {
    const res = await unsnoozeAlert(id);
    if (res.success) {
      updateAlert(id, { snoozed_until: null } as any);
      toast('success', t('alerts.unsnoozed'));
    }
  };

  const loadMore = () => {
    const nextPage = historyPage + 1;
    setHistoryPage(nextPage);
    loadHistory(nextPage, true);
  };

  const display = tab === 'active' ? alerts : tab === 'history' ? history : alerts;
  const grouped = groupAlerts(display);
  const activeCount = alerts.filter((a) => a.status === 'active').length;
  const critical = display.filter((a) => a.status === 'active' && a.severity === 'critical');
  const high = display.filter((a) => a.status === 'active' && a.severity === 'high');
  const other = display.filter((a) => a.status !== 'active' || (a.severity !== 'critical' && a.severity !== 'high'));

  const canLoadMore = tab === 'history' && history.length < historyTotal;

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-lg font-bold text-text-primary">{t('alerts.title')}</h1>
        <p className="text-sm text-text-muted mt-0.5">{t('alerts.subtitle')}</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 rounded-lg bg-surface-card p-1 border border-border-default w-fit">
        <button onClick={() => setTab('active')} className={cn('px-4 py-2 text-sm font-medium rounded-md transition-colors', tab === 'active' ? 'bg-accent text-white' : 'text-text-secondary hover:text-text-primary')}>
          {t('alerts.activeAlerts', { count: activeCount })}
        </button>
        <button onClick={() => setTab('grouped')} className={cn('px-4 py-2 text-sm font-medium rounded-md transition-colors', tab === 'grouped' ? 'bg-accent text-white' : 'text-text-secondary hover:text-text-primary')}>
          {t('alerts.tabGrouped')} ({grouped.length})
        </button>
        <button onClick={() => setTab('history')} className={cn('px-4 py-2 text-sm font-medium rounded-md transition-colors', tab === 'history' ? 'bg-accent text-white' : 'text-text-secondary hover:text-text-primary')}>
          {t('alerts.alertHistory', { count: historyTotal })}
        </button>
        {!notificationEnabled && (
          <button onClick={() => alertNotificationService.requestPermission().then(setNotificationEnabled)} className={cn('px-4 py-2 text-sm font-medium rounded-md transition-colors ml-auto text-yellow-600 hover:text-yellow-700 bg-yellow-50')}>
            🔔 {t('alerts.enableNotifications')}
          </button>
        )}
      </div>

      {loading ? (
        <div className="space-y-3">{[1, 2, 3].map((i) => <div key={i} className="h-28 rounded-lg bg-surface-card border border-border-default animate-pulse" />)}</div>
      ) : display.length === 0 && tab !== 'history' ? (
        <div className="rounded-lg border border-border-default bg-surface-card p-8 text-center">
          <span className="text-3xl block mb-3">✅</span>
          <p className="text-sm text-text-primary font-medium">{t('alerts.noActiveAlerts')}</p>
          <p className="text-xs text-text-muted mt-1">{t('alerts.allClear')}</p>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Critical alerts */}
          {critical.map((a) => {
            const isSnoozed = a.snoozed_until && new Date(a.snoozed_until) > new Date();
            return (
            <div key={a.id} className={cn('rounded-lg border border-border-default border-l-[4px] p-4', severityBorder.critical, severityBg.critical, isSnoozed && 'opacity-60')}>
              <div className="flex items-start gap-3">
                <span className="text-lg mt-0.5">{severityIcon.critical}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-bold text-critical uppercase tracking-wider">{t('component.critical')}</span>
                    {a.is_flapping && (
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-warning-bg text-warning border border-warning/30 animate-pulse">
                        {t('alerts.flapping')} {a.flap_count ? `(${a.flap_count})` : ''}
                      </span>
                    )}
                    {isSnoozed && (
                      <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-surface-hover text-text-muted border border-border-default">
                        {t('alerts.snoozedUntil')} {new Date(a.snoozed_until!).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    )}
                    {a.confidence && <span className="text-xs text-text-muted">{a.confidence}%</span>}
                    <span className="text-xs text-text-muted">{new Date(a.triggered_at).toLocaleString()}</span>
                  </div>
                  <p className="text-sm font-semibold text-text-primary mt-1">{a.title}</p>
                  {a.message && <p className="text-sm text-text-secondary mt-1">{a.message}</p>}
                  {a.condition_holding_seconds != null && a.condition_required_seconds != null && (
                    <div className="mt-2">
                      <div className="flex items-center gap-2 text-[10px] text-text-muted mb-1">
                        <span>{t('alerts.conditionHolding')}: {a.condition_holding_seconds}s / {a.condition_required_seconds}s</span>
                      </div>
                      <div className="w-full h-1.5 rounded-full bg-surface-base overflow-hidden">
                        <div className="h-full rounded-full bg-accent transition-all" style={{ width: `${Math.min(100, (a.condition_holding_seconds / a.condition_required_seconds) * 100)}%` }} />
                      </div>
                    </div>
                  )}
                  {a.recommended_action && (
                    <div className="mt-2 text-sm bg-critical/10 rounded-md p-2.5 border border-critical/20">
                      <span className="font-semibold text-critical text-xs uppercase">{t('component.recommendation')}</span>
                      <p className="text-text-primary mt-0.5">{a.recommended_action}</p>
                    </div>
                  )}
                  <div className="flex items-center gap-2 mt-3">
                    <button onClick={() => handleAcknowledge(a.id)} disabled={acknowledging.has(a.id)} className="px-3 py-1.5 text-xs font-medium rounded-md bg-surface-hover text-text-secondary hover:text-text-primary hover:bg-border-default transition-colors disabled:opacity-50">
                      {acknowledging.has(a.id) ? '...' : t('alerts.acknowledge')}
                    </button>
                    <button onClick={() => handleResolve(a.id)} disabled={resolving.has(a.id)} className="px-3 py-1.5 text-xs font-medium rounded-md bg-success/10 text-success hover:bg-success/20 transition-colors disabled:opacity-50">
                      {resolving.has(a.id) ? '...' : t('alerts.resolve')}
                    </button>
                    <div className="relative">
                      {isSnoozed ? (
                        <button onClick={() => handleUnsnooze(a.id)} className="px-3 py-1.5 text-xs font-medium rounded-md bg-warning/10 text-warning hover:bg-warning/20 transition-colors">
                          {t('alerts.unsnooze')}
                        </button>
                      ) : (
                        <button onClick={() => setSnoozeMenu(snoozeMenu === a.id ? null : a.id)} className="px-3 py-1.5 text-xs font-medium rounded-md bg-surface-hover text-text-muted hover:text-text-primary hover:bg-border-default transition-colors">
                          {t('alerts.snooze')}
                        </button>
                      )}
                      {snoozeMenu === a.id && (
                        <div className="absolute top-full left-0 mt-1 bg-surface-card border border-border-default rounded-lg shadow-lg z-10 py-1 min-w-[120px]">
                          {[15, 60, 240, 480].map((m) => (
                            <button key={m} onClick={() => handleSnooze(a.id, m)} className="w-full text-left px-3 py-1.5 text-xs text-text-secondary hover:text-text-primary hover:bg-surface-hover transition-colors">
                              {m < 60 ? `${m}m` : `${m / 60}h`}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
            );
          })}

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
                  <div className="flex items-center gap-2 mt-2">
                    <button onClick={() => handleAcknowledge(a.id)} disabled={acknowledging.has(a.id)} className="text-xs text-text-muted hover:text-text-primary font-medium disabled:opacity-50">
                      {acknowledging.has(a.id) ? '...' : t('component.acknowledge')}
                    </button>
                    <button onClick={() => handleResolve(a.id)} disabled={resolving.has(a.id)} className="text-xs text-success font-medium disabled:opacity-50">
                      {resolving.has(a.id) ? '...' : t('alerts.resolve')}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}

          {/* Medium/low alerts */}
          {other.filter((a) => a.status === 'active').length > 0 && (
            <div>
              <span className="text-xs font-semibold text-text-muted uppercase tracking-wider block mb-2">{t('common.info')}</span>
              <div className="space-y-1.5">
                {other.filter((a) => a.status === 'active').map((a) => (
                  <div key={a.id} className="flex items-center gap-3 px-3 py-2 rounded-md hover:bg-surface-hover transition-colors">
                    <span>{severityIcon.medium}</span>
                    <span className="text-sm text-text-primary flex-1 min-w-0 truncate">{a.title}</span>
                    <span className="text-xs text-text-muted shrink-0">{new Date(a.triggered_at).toLocaleTimeString()}</span>
                    <button onClick={() => handleAcknowledge(a.id)} className="text-xs text-text-muted hover:text-text-primary font-medium shrink-0">{t('component.acknowledge')}</button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* History - resolved/acknowledged alerts */}
          {tab === 'history' && history.length > 0 && (
            <div>
              <span className="text-xs font-semibold text-text-muted uppercase tracking-wider block mb-2">{t('alerts.alertHistory', { count: historyTotal })}</span>
              <div className="space-y-1.5">
                {history.map((a) => (
                  <div key={a.id} className="flex items-center gap-3 px-3 py-2 rounded-md bg-surface-card border border-border-default">
                    <span>{a.status === 'resolved' ? '✅' : a.status === 'acknowledged' ? '👁️' : severityIcon[a.severity] || 'ℹ️'}</span>
                    <span className="text-sm text-text-primary flex-1 min-w-0 truncate">{a.title}</span>
                    <span className="text-xs text-text-muted shrink-0">{new Date(a.triggered_at).toLocaleString()}</span>
                    <span className={cn(
                      'text-[10px] font-medium px-1.5 py-0.5 rounded',
                      a.status === 'resolved' ? 'bg-success/10 text-success' : a.status === 'acknowledged' ? 'bg-info-bright/10 text-info-bright' : 'bg-warning-bg text-warning'
                    )}>
                      {a.status}
                    </span>
                  </div>
                ))}
              </div>
              {canLoadMore && (
                <div className="text-center mt-4">
                  <button
                    onClick={loadMore}
                    disabled={historyLoading}
                    className="px-4 py-2 text-sm font-medium rounded-md bg-surface-hover text-text-secondary hover:text-text-primary hover:bg-border-default transition-colors disabled:opacity-50"
                  >
                    {historyLoading ? t('common.loading') : t('common.loadMore')}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* History empty */}
          {tab === 'history' && history.length === 0 && !loading && (
            <div className="rounded-lg border border-border-default bg-surface-card p-8 text-center">
              <span className="text-3xl block mb-3">📋</span>
              <p className="text-sm text-text-primary font-medium">{t('alerts.noAlertHistory')}</p>
              <p className="text-xs text-text-muted mt-1">{t('alerts.historyWillAppear')}</p>
            </div>
          )}

          {/* Grouped view */}
          {tab === 'grouped' && (
            <div className="space-y-4">
              {grouped.length === 0 ? (
                <div className="rounded-lg border border-border-default bg-surface-card p-8 text-center">
                  <span className="text-3xl block mb-3">✅</span>
                  <p className="text-sm text-text-primary font-medium">{t('alerts.noGroupedAlerts')}</p>
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
                            {group.field_name || t('alerts.farm')} — {issueTypeLabel(group.issue_type, t)}
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
                            {t('alerts.alert', { count: group.count })}
                          </span>
                        </div>

                        <p className="text-sm text-text-secondary mb-3">{group.latest.title}</p>

                        {group.latest.recommended_action && (
                          <div className="mb-3 text-sm bg-text-primary/5 rounded-md p-2.5 border border-text-primary/10">
                            <span className="font-semibold text-text-primary text-xs uppercase">{t('component.recommendation')}</span>
                            <p className="text-text-secondary mt-0.5">{group.latest.recommended_action}</p>
                          </div>
                        )}

                        <div className="text-xs text-text-muted mb-3">
                          <p>{t('alerts.firstTriggered', { date: new Date(group.first_triggered).toLocaleString() })}</p>
                          <p>{t('alerts.lastTriggered', { date: new Date(group.last_triggered).toLocaleString() })}</p>
                        </div>

                        {group.latest.rule_name && (
                          <AlertRuleDetail alert={group.latest} rules={alertRules} className="mb-3" />
                        )}

                        <div className="flex items-center gap-2">
                          <button onClick={() => handleAcknowledge(group.latest.id)} disabled={acknowledging.has(group.latest.id)} className="px-3 py-1.5 text-xs font-medium rounded-md bg-surface-hover text-text-secondary hover:text-text-primary hover:bg-border-default transition-colors disabled:opacity-50">
                            {acknowledging.has(group.latest.id) ? '...' : t('alerts.acknowledge')}
                          </button>
                        </div>
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
