import { useEffect, useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/shared/stores/authStore';
import { useAlertsStore } from '@/shared/stores/alertsStore';
import { useWebSocket } from '@/shared/hooks/useWebSocket';
import { StatusCard } from '@/shared/components/StatusCard';
import { AlertBanner } from '@/shared/components/AlertBanner';
import { FieldCard } from '@/shared/components/FieldCard';
import { FarmMap } from '@/shared/components/FarmMap';
import { TrendChart, generateTrendData } from '@/shared/components/TrendChart';
import { getDevices, getDevicesDataLatest } from '@/features/devices/api';
import { getActiveAlerts, acknowledgeAlert } from '@/features/alerts/api';
import { getZones, startZone, stopZone, type IrrigationZone } from '@/features/irrigation/api';
import { toast } from '@/shared/components/Toast';
import { getFields } from '@/features/fields/api';
import type { Field, Alert2, WebSocketMessage, Device } from '@/shared/types';
import { cn } from '@/shared/lib/cn';

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

export default function Dashboard() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { isAdmin } = useAuthStore();
  const { alerts, setAlerts, addAlert } = useAlertsStore();
  const token = useAuthStore((s) => s.token);
  const [devices, setDevices] = useState<Device[]>([]);
  const [fields, setFields] = useState<Field[]>([]);
  const [totalWater, setTotalWater] = useState(0);
  const [zones, setZones] = useState<IrrigationZone[]>([]);
  const [irrigationActionId, setIrrigationActionId] = useState<number | null>(null);

  // Handle WebSocket messages — backend rule engine now broadcasts alert_triggered
  const handleWsMessage = (data: WebSocketMessage) => {
    switch (data.type) {
      case 'alert_triggered': {
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
          status: mapStatus(p.status as string),
          triggered_at: (p.triggered_at as string) || new Date().toISOString(),
          recommended_action: p.severity === 'critical' ? t('alerts.defaultCriticalAction') : t('alerts.defaultMonitorAction'),
          confidence: p.severity === 'critical' ? 95 : 85,
        };
        addAlert(newAlert);
        break;
      }
      case 'device_connected': {
        const device = (data as any).payload as { device_id: string; name?: string };
        toast('success', t('dashboard.deviceBackOnline', { name: device.name || device.device_id }));
        break;
      }
      case 'device_disconnected': {
        const device = (data as any).payload as { device_id: string; name?: string };
        const rawAlert: Partial<Alert2> = {
          id: Date.now(),
          device_id: device.device_id,
          device_name: device.name,
          title: `Device offline: ${device.name || device.device_id}`,
          severity: 'high',
          status: 'active',
          triggered_at: new Date().toISOString(),
          recommended_action: 'Check device connectivity',
        };
        addAlert(rawAlert as Alert2);
        break;
      }
    }
  };

  const { isConnected } = useWebSocket(token, handleWsMessage);

  useEffect(() => {
    (async () => {
      const [deviceRes, alertRes, fieldRes] = await Promise.all([
        getDevices(),
        getActiveAlerts(),
        getFields(),
      ]);
      if (deviceRes.success && deviceRes.data) {
        setDevices(deviceRes.data.devices || []);
        const ids = (deviceRes.data.devices || []).map((d: any) => String(d.id));
        await getDevicesDataLatest(ids);
      }
      if (alertRes.success && alertRes.data) {
        setAlerts((alertRes.data.alerts || []).map((a) => ({
          id: a.id,
          device_id: a.device_id,
          device_name: a.device_name,
          title: a.message,
          message: '',
          severity: mapSeverity(a.severity),
          status: mapStatus(a.status),
          triggered_at: a.triggered_at,
          confidence: 85,
          recommended_action: a.severity === 'critical' ? t('alerts.defaultCriticalAction') : t('alerts.defaultMonitorAction'),
        })));
      }
      if (fieldRes.success && fieldRes.data) setFields(fieldRes.data);

      const zoneRes = await getZones();
      if (zoneRes.success && zoneRes.data) {
        setZones(zoneRes.data);
        setTotalWater(zoneRes.data.reduce((sum, z) => sum + z.runtime_minutes * z.flow_rate_lpm, 0));
      }
    })();
  }, [setAlerts]);

  // Generate field geometry with real coordinates if available, else use location-based fallback
  const fieldGeo = useMemo(() => fields
    .filter(f => (f.latitude != null && f.longitude != null) || f.geometry)
    .map((f) => {
      const parsedGeo = f.geometry
        ? (typeof f.geometry === 'string' ? (() => { try { return JSON.parse(f.geometry); } catch { return null; } })() : f.geometry)
        : null;
      return {
        id: f.id, name: f.name, health: f.health, soil_moisture: f.soil_moisture,
        alerts: f.health === 'critical' ? 1 : f.health === 'warning' ? 1 : undefined,
        zoneCount: f.zones?.length || 0,
        latitude: f.latitude,
        longitude: f.longitude,
        geometry: parsedGeo || {
          type: 'Polygon' as const,
          coordinates: [[
            [(f.longitude ?? 114.3) - 0.015, (f.latitude ?? 30.5) - 0.015],
            [(f.longitude ?? 114.3) + 0.015, (f.latitude ?? 30.5) - 0.015],
            [(f.longitude ?? 114.3) + 0.0195, (f.latitude ?? 30.5) + 0.015],
            [(f.longitude ?? 114.3) - 0.012, (f.latitude ?? 30.5) + 0.0195],
            [(f.longitude ?? 114.3) - 0.015, (f.latitude ?? 30.5) - 0.015],
          ]],
        },
      };
    }), [fields]);

  const handleAcknowledge = async (id: number) => {
    const res = await acknowledgeAlert(id);
    if (res.success) {
      const { removeAlert } = useAlertsStore.getState();
      removeAlert(id);
      toast('success', t('alerts.alertAcknowledged'));
    } else toast('error', t('alerts.acknowledgeError'));
  };

  const handleZoneAction = async (zoneId: number, action: () => Promise<any>, successMsg: string, errorMsg: string) => {
    setIrrigationActionId(zoneId);
    const res = await action();
    if (res.success) {
      toast('success', successMsg);
      setZones(zones.map((z) => z.id === zoneId ? (res.data || z) : z));
    } else {
      toast('error', errorMsg);
    }
    setIrrigationActionId(null);
  };

  const handleZoneStart = (zoneId: number) =>
    handleZoneAction(zoneId, () => startZone(zoneId), t('irrigation.started'), t('common.failedToSave'));

  const handleZoneStop = (zoneId: number) =>
    handleZoneAction(zoneId, () => stopZone(zoneId), t('irrigation.stopped'), t('common.failedToSave'));

  const criticalCount = alerts.filter((a) => a.status === 'active' && a.severity === 'critical').length;
  const highActive = alerts.filter((a) => a.status === 'active' && a.severity === 'high');
  const mediumActive = alerts.filter((a) => a.status === 'active' && a.severity === 'medium');
  const onlineCount = devices.filter((d) => d.status === 'online').length;
  const healthyFieldCount = fields.filter((f) => f.health === 'healthy').length;
  const warningFieldCount = fields.filter((f) => f.health === 'warning').length;
  const criticalFieldCount = fields.filter((f) => f.health === 'critical').length;
  const healthPct = fields.length > 0 ? Math.round((healthyFieldCount / fields.length) * 100) : 0;
  const fieldsNeedingAttention = fields.filter((f) => f.health !== 'healthy');
  const totalActive = alerts.filter((a) => a.status === 'active').length;
  const moistureTrend = useMemo(() => generateTrendData(7, 48, 15, { secondary: { base: 32, variance: 8 } }), []);

  return (
    <div className="max-w-7xl mx-auto space-y-4 md:space-y-6">
      {/* ─── TIER 1: Critical alerts ─── */}
      {criticalCount > 0 && (
        <div className="rounded-lg border-2 border-critical bg-critical-bg p-3 md:p-4">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-lg">🔴</span>
            <span className="text-sm font-bold text-critical uppercase tracking-wider">{criticalCount} {t('dashboard.criticalAlerts').toUpperCase()}</span>
          </div>
          {alerts.filter((a) => a.status === 'active' && a.severity === 'critical').slice(0, 2).map((a) => (
            <div key={a.id} className="flex items-start gap-2 text-sm mb-1">
              <span className="mt-0.5 shrink-0">⚠</span>
              <div>
                <p className="text-text-primary font-medium">{a.title}</p>
                {a.recommended_action && <p className="text-critical text-xs mt-0.5">→ {a.recommended_action}</p>}
              </div>
            </div>
          ))}
          {criticalCount > 2 && <button onClick={() => navigate('/alerts')} className="text-xs text-critical font-medium hover:underline">+ {criticalCount - 2} {t('common.view').toLowerCase()}</button>}
        </div>
      )}

      {/* ─── TIER 2: Status bar ─── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-3">
        <StatusCard label={t('dashboard.farmHealth')} value={`${healthPct}%`} status={criticalFieldCount > 0 ? 'critical' : warningFieldCount > 0 ? 'warning' : 'healthy'} icon="🌾" subtitle={`${healthyFieldCount}/${fields.length} ${t('common.healthy').toLowerCase()}`} />
        <StatusCard label={t('dashboard.criticalAlerts')} value={criticalCount} status={criticalCount > 0 ? 'critical' : 'healthy'} icon="⚡" subtitle={criticalCount > 0 ? t('dashboard.requiresAttention') : t('dashboard.allClear')} onClick={() => navigate('/alerts')} />
        <StatusCard label={t('dashboard.waterUsage')} value={`${(totalWater / 1000).toFixed(1)}k L`} status="info" icon="💧" subtitle={t('dashboard.today')} onClick={() => navigate('/irrigation')} />
        <StatusCard label={t('dashboard.connectivity')} value={`${onlineCount}/${devices.length}`} status={devices.length > 0 && onlineCount === devices.length ? 'healthy' : 'warning'} icon="📡" subtitle={isConnected ? t('dashboard.systemOnline') : t('dashboard.disconnected')} />
      </div>

      {/* ─── MAIN: Map + Priority Feed ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">
        <div className="lg:col-span-2 order-2 lg:order-1">
        <FarmMap
          fields={fieldGeo}
          devices={devices.map(d => ({
            id: d.id ?? d.device_id,
            device_id: d.device_id,
            name: d.name,
            latitude: d.latitude ?? 0,
            longitude: d.longitude ?? 0,
            status: d.status,
            type: d.type,
            field_id: d.field_id,
            last_heartbeat: d.last_heartbeat,
            latestTemp: d.latestTemp,
          })).filter(d => d.latitude && d.longitude)}
          height={typeof window !== 'undefined' && window.innerWidth < 768 ? 250 : 340}
          onFieldClick={(f) => navigate(`/fields/${f.id}`)}
          className="shadow-elevated"
        />
          {fieldsNeedingAttention.length > 0 && (
            <div className="mt-4">
              <h3 className="text-sm font-semibold text-text-primary mb-3 flex items-center gap-2">
                {t('dashboard.fieldStatus')}
                <span className="text-xs font-normal text-warning bg-warning-bg px-2 py-0.5 rounded-full">{fieldsNeedingAttention.length}</span>
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {fieldsNeedingAttention.map((f) => (
                  <FieldCard key={f.id} field={f} onClick={() => navigate(`/fields/${f.id}`)} />
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="order-1 lg:order-2 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-text-primary">{t('dashboard.priorityFeed')}</h2>
            {totalActive > 0 && <span className="text-xs text-critical font-medium">{totalActive} {t('common.active')}</span>}
          </div>

          {highActive.length > 0 && (
            <div className="space-y-2">
              <span className="text-xs font-semibold text-warning uppercase tracking-wider">{t('dashboard.requiresAttention')}</span>
              {highActive.slice(0, 3).map((a) => (
                <AlertBanner key={a.id} title={a.title} severity={a.severity} recommendedAction={a.recommended_action} onClick={() => navigate('/alerts')} onAcknowledge={() => handleAcknowledge(a.id)} />
              ))}
            </div>
          )}

          {mediumActive.length > 0 && (
            <div className="space-y-2">
              <span className="text-xs font-semibold text-text-muted uppercase tracking-wider">{t('common.info')}</span>
              {mediumActive.slice(0, 2).map((a) => (
                <AlertBanner key={a.id} title={a.title} severity={a.severity} onClick={() => navigate('/alerts')} onAcknowledge={() => handleAcknowledge(a.id)} />
              ))}
            </div>
          )}

          {totalActive === 0 && (
            <div className="rounded-lg border border-border-default bg-surface-card p-5 text-center">
              <span className="text-2xl block mb-2">✅</span>
              <p className="text-sm text-text-primary font-medium">{t('dashboard.allSystemsNormal')}</p>
              <p className="text-xs text-text-muted mt-1">{t('dashboard.noActiveAlerts')}</p>
            </div>
          )}

          <div className="rounded-lg border border-border-default bg-surface-card p-4">
            <h3 className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-3">
              {isAdmin() ? t('common.edit') : t('dashboard.quickActions')}
            </h3>
            <div className="space-y-1.5">
              <button onClick={() => navigate('/fields')} className="w-full text-left text-sm text-text-secondary hover:text-text-primary py-2.5 px-2 rounded-md hover:bg-surface-hover transition-colors min-h-[44px]">📋 {t('dashboard.viewAllDevices')}</button>
              <button onClick={() => navigate('/irrigation')} className="w-full text-left text-sm text-text-secondary hover:text-text-primary py-2.5 px-2 rounded-md hover:bg-surface-hover transition-colors min-h-[44px]">💧 {t('irrigation.title')}</button>
              {isAdmin() && (
                <button onClick={() => navigate('/analytics')} className="w-full text-left text-sm text-text-secondary hover:text-text-primary py-2.5 px-2 rounded-md hover:bg-surface-hover transition-colors min-h-[44px]">📊 {t('dashboard.generateReport')}</button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ─── BOTTOM: Charts ─── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
        <div className="rounded-lg border border-border-default bg-surface-card p-4">
          <h3 className="text-sm font-semibold text-text-primary mb-4">{t('fields.soilMoisture')}</h3>
          <TrendChart data={moistureTrend} type="area" color="#2E7D32" secondaryColor="#38bdf8" showSecondary unit="%" height={180} />
        </div>
        <div className="rounded-lg border border-border-default bg-surface-card p-4">
          <h3 className="text-sm font-semibold text-text-primary mb-4">{t('dashboard.irrigationToday')}</h3>
          <div className="space-y-2.5">
            {zones.length === 0 ? (
              <div className="text-center py-6 text-sm text-text-muted">{t('common.noIrrigation')}</div>
            ) : zones.map((zone) => {
              const isUrgent = zone.status === 'failed' || zone.moisture < zone.target_moisture * 0.5;
              const statusLabel = zone.status === 'active' ? t('irrigation.active') : zone.status === 'failed' ? t('irrigation.failed') : zone.status === 'scheduled' ? t('irrigation.scheduled') : t('irrigation.idle');
              const timeLabel = zone.status === 'active' ? t('common.runningMinutes', { minutes: zone.runtime_minutes }) : statusLabel;
              const waterLabel = zone.status !== 'idle' ? `${Math.round(zone.runtime_minutes * zone.flow_rate_lpm).toLocaleString()} L` : '-';
              return (
                <div key={zone.id} className={cn('flex items-center justify-between py-2 px-3 rounded-md', isUrgent ? 'bg-critical-bg' : '')}>
                  <div className="flex items-center gap-2">
                    <span className={cn('w-2 h-2 rounded-full', isUrgent ? 'bg-critical' : 'bg-info-bright')} />
                    <span className="text-sm text-text-primary">{zone.name}</span>
                  </div>
                  <div className="flex items-center gap-3 text-xs">
                    <span className={zone.status === 'failed' ? 'text-critical font-medium' : 'text-info-bright'}>{statusLabel}</span>
                    <span className="text-text-muted hidden sm:inline">{timeLabel}</span>
                    <span className="text-text-muted w-16 text-right">{waterLabel}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ─── IRRIGATION STATUS SECTION ─── */}
      {zones.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-text-primary flex items-center gap-2">
              💧 {t('irrigation.irrigationStatus')}
              <span className="text-xs font-normal text-text-secondary bg-surface-elevated px-2 py-0.5 rounded-full">{zones.length} {t('irrigation.zones')}</span>
            </h2>
            <button onClick={() => navigate('/irrigation')} className="text-xs text-accent hover:underline font-medium">
              {t('common.viewAll')}
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {zones.map((zone) => {
              const moisturePct = Math.round((zone.moisture / zone.target_moisture) * 100);
              
              let statusColor = 'text-success';
              let statusBg = 'bg-success-bg';
              let statusBorder = 'border-l-success';
              
              if (zone.status === 'failed') {
                statusColor = 'text-critical';
                statusBg = 'bg-critical-bg';
                statusBorder = 'border-l-critical';
              } else if (moisturePct < 40) {
                statusColor = 'text-critical';
                statusBg = 'bg-critical-bg';
                statusBorder = 'border-l-critical';
              } else if (moisturePct < 60) {
                statusColor = 'text-warning';
                statusBg = 'bg-warning-bg';
                statusBorder = 'border-l-warning';
              }

              const statusConfig: Record<string, { color: string; bg: string }> = {
                active: { color: 'text-info-bright', bg: 'bg-info-bg' },
                scheduled: { color: 'text-accent', bg: 'bg-accent/10' },
                idle: { color: 'text-text-muted', bg: 'bg-surface-hover' },
                failed: { color: 'text-critical', bg: 'bg-critical-bg' },
              };
              const cfg = statusConfig[zone.status] || statusConfig.idle;

              return (
                <div
                  key={zone.id}
                  className={cn(
                    'rounded-lg border border-l-[3px] p-4 transition-all hover:shadow-sm',
                    statusBg,
                    statusBorder,
                    'bg-surface-card'
                  )}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h3 className="text-sm font-semibold text-text-primary">{zone.name}</h3>
                      <span className={cn('text-xs font-medium px-2 py-0.5 rounded-full mt-1 inline-block', cfg.color, cfg.bg)}>
                        {t(`irrigation.${zone.status}`)}
                      </span>
                    </div>
                    <div
                      className={cn(
                        'w-3 h-3 rounded-full',
                        zone.status === 'failed'
                          ? 'bg-critical'
                          : moisturePct < 40
                          ? 'bg-critical'
                          : moisturePct < 60
                          ? 'bg-warning'
                          : 'bg-success'
                      )}
                    />
                  </div>

                  <div className="mb-3">
                    <div className="flex justify-between text-xs text-text-secondary mb-1.5">
                      <span className="font-medium">
                        <span className={cn('font-semibold', statusColor)}>
                          {zone.moisture}%
                        </span>
                        <span className="text-text-muted"> / {zone.target_moisture}%</span>
                      </span>
                      <span className="text-text-muted">{t('common.target')}</span>
                    </div>
                    <div className="h-2 bg-surface-elevated rounded-full overflow-hidden">
                      <div
                        className={cn('h-full rounded-full transition-all', statusColor === 'text-success' ? 'bg-success' : statusColor === 'text-warning' ? 'bg-warning' : 'bg-critical')}
                        style={{ width: `${Math.min(moisturePct, 100)}%` }}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs text-text-muted mb-3 pb-3 border-b border-border-default">
                    <div>
                      <span className="block text-text-secondary font-medium">{t('common.runtime')}</span>
                      <span>{zone.runtime_minutes}m</span>
                    </div>
                    <div>
                      <span className="block text-text-secondary font-medium">{t('common.flowRate')}</span>
                      <span>{zone.flow_rate_lpm} L/min</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    {isAdmin() && zone.status !== 'active' && zone.status !== 'failed' && (
                      <button
                        onClick={() => handleZoneStart(zone.id)}
                        disabled={irrigationActionId === zone.id}
                        className="py-2 px-3 rounded-md bg-accent/20 text-accent text-xs font-medium hover:bg-accent/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed min-h-[36px] flex items-center justify-center"
                        title={t('irrigation.startZone')}
                      >
                        {irrigationActionId === zone.id ? (
                          <span className="w-3 h-3 border-2 border-accent border-t-transparent rounded-full animate-spin" />
                        ) : (
                          <>▶ {t('common.start')}</>
                        )}
                      </button>
                    )}
                    {isAdmin() && zone.status === 'active' && (
                      <button
                        onClick={() => handleZoneStop(zone.id)}
                        disabled={irrigationActionId === zone.id}
                        className="py-2 px-3 rounded-md bg-critical/20 text-critical text-xs font-medium hover:bg-critical/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed min-h-[36px] flex items-center justify-center"
                        title={t('irrigation.stopZone')}
                      >
                        {irrigationActionId === zone.id ? (
                          <span className="w-3 h-3 border-2 border-critical border-t-transparent rounded-full animate-spin" />
                        ) : (
                          <>⏹ {t('common.stop')}</>
                        )}
                      </button>
                    )}
                    <button
                      onClick={() => navigate('/irrigation')}
                      className={cn(
                        'py-2 px-3 rounded-md bg-surface-hover text-text-secondary text-xs font-medium hover:bg-surface-elevated transition-colors min-h-[36px]',
                        (!isAdmin() || (zone.status !== 'active' && zone.status !== 'failed')) ? 'col-span-1' : 'col-span-2'
                      )}
                      title={t('common.view')}
                    >
                      {!isAdmin() || (zone.status !== 'active' && zone.status !== 'failed') ? '⚙' : isAdmin() && zone.status === 'active' ? '⚙' : '→'} {t('common.view')}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
