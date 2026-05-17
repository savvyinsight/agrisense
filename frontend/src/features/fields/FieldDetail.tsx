import { useEffect, useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { TrendChart } from '@/shared/components/TrendChart';
import { getField } from '@/features/fields/api';
import { getDevices } from '@/features/devices/api';
import { getZones, deleteZone, getIrrigationEvents } from '@/features/irrigation/api';
import type { IrrigationEvent } from '@/features/irrigation/api';
import { IrrigationZoneFormModal } from '@/features/irrigation/IrrigationZoneFormModal';
import { getActiveAlerts } from '@/features/alerts/api';
import { getCurrentWeather } from '@/features/weather/api';
import type { Field } from '@/shared/types';
import type { Device, Alert } from '@/shared/types/api';
import type { IrrigationZone } from '@/features/irrigation/api';
import { toast } from '@/shared/components/Toast';
import { cn } from '@/shared/lib/cn';

const healthColor: Record<string, string> = { healthy: 'text-success', warning: 'text-warning', critical: 'text-critical' };
const healthBg: Record<string, string> = { healthy: 'bg-success/10', warning: 'bg-warning/10', critical: 'bg-critical/10' };

const zoneStatusColor: Record<string, string> = { active: 'text-accent', scheduled: 'text-info-bright', idle: 'text-text-muted', failed: 'text-critical' };
const zoneStatusBg: Record<string, string> = { active: 'bg-accent/10', scheduled: 'bg-info-bright/10', idle: 'bg-surface-hover', failed: 'bg-critical/10' };

const typeIcon: Record<string, string> = { controller: '🔧', both: '📡', sensor: '🌡️' };


function timeAgo(dateStr: string | null | undefined, t: TFunction): string | null {
  if (!dateStr) return null;
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return t('fields.justNow');
  if (mins < 60) return t('fields.minutesAgo', { mins });
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return t('fields.hoursAgo', { hrs });
  return t('fields.daysAgo', { days: Math.floor(hrs / 24) });
}

export default function FieldDetail() {
  const { t } = useTranslation();
  const { id } = useParams();
  const navigate = useNavigate();
  const [field, setField] = useState<Field | null>(null);
  const [devices, setDevices] = useState<Device[]>([]);
  const [zones, setZones] = useState<IrrigationZone[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [events, setEvents] = useState<IrrigationEvent[]>([]);
  const [weather, setWeather] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [zoneFormOpen, setZoneFormOpen] = useState(false);
  const [editingZone, setEditingZone] = useState<IrrigationZone | null>(null);
  const [deletingZoneId, setDeletingZoneId] = useState<number | null>(null);

  const fieldId = Number(id);

  const loadZones = async () => {
    const res = await getZones(fieldId);
    if (res.success && res.data) setZones(res.data);
  };

  useEffect(() => {
    (async () => {
      const [fieldRes, deviceRes, zoneRes, alertRes, weatherRes] = await Promise.all([
        getField(fieldId),
        getDevices(),
        getZones(fieldId),
        getActiveAlerts(),
        getCurrentWeather(),
      ]);

      if (fieldRes.success && fieldRes.data) setField(fieldRes.data);

      const allDevices = deviceRes.success && deviceRes.data ? deviceRes.data.devices : [];
      const fieldDevices = allDevices.filter((d: Device) => d.field_id === fieldId);
      setDevices(fieldDevices);

      if (zoneRes.success && zoneRes.data) setZones(zoneRes.data);
      if (alertRes.success && alertRes.data) setAlerts(alertRes.data?.alerts ?? []);
      if (weatherRes.success && weatherRes.data) setWeather(weatherRes.data);

      const eventRes = await getIrrigationEvents({ field_id: fieldId });
      if (eventRes.success && eventRes.data) setEvents(eventRes.data);

      setLoading(false);
    })();
  }, [fieldId]);

  const avgMoisture = field?.soil_moisture;
  const avgTemp = field?.temperature;
  const avgHumidity = field?.humidity;

  const fieldAlerts = useMemo(() =>
    alerts.filter(a => a.device_id && devices.some(d => d.device_id === a.device_id)),
    [alerts, devices]
  );

  const lastEventForZone = useMemo(() => {
    const map = new Map<number, IrrigationEvent>();
    for (const e of events) {
      if (!map.has(e.zone_id) || new Date(e.start_time) > new Date(map.get(e.zone_id)!.start_time)) {
        map.set(e.zone_id, e);
      }
    }
    return map;
  }, [events]);

  if (loading) return <div className="max-w-5xl mx-auto py-12"><div className="h-[400px] rounded-lg bg-surface-card border border-border-default animate-pulse" /></div>;

  if (!field) {
    return (
      <div className="max-w-3xl mx-auto py-12 text-center">
        <span className="text-4xl block mb-4">🔍</span>
        <h2 className="text-lg font-bold text-text-primary mb-2">{t('fields.notFound')}</h2>
        <p className="text-sm text-text-muted mb-4">{t('fields.notFoundDesc')}</p>
        <button onClick={() => navigate('/fields')} className="text-sm text-accent hover:text-accent-hover font-medium">← {t('fields.backToFields')}</button>
      </div>
    );
  }

  const metrics = [
    { label: t('fields.soilMoisture'), value: avgMoisture, unit: '%', status: field.health, normal: { min: 40, max: 80 }, icon: '💧' },
    { label: t('fields.temperature'), value: avgTemp, unit: '°C', status: field.health, normal: { min: 15, max: 35 }, icon: '🌡️' },
    { label: t('fields.humidity'), value: avgHumidity, unit: '%', status: field.health, normal: { min: 40, max: 90 }, icon: '💨' },
  ];

  return (
    <div className="max-w-5xl mx-auto space-y-4 md:space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => navigate('/fields')} className="text-text-muted hover:text-text-primary transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-bold text-text-primary">{field.name}</h1>
            <span className={cn('text-xs font-medium px-2 py-0.5 rounded-full', healthBg[field.health], healthColor[field.health])}>{field.health}</span>
          </div>
          <p className="text-sm text-text-muted">{field.crop && `${field.crop} · `}{field.area_hectares} ha{field.last_irrigation ? ` · ${t('fields.lastIrrigation', { date: timeAgo(field.last_irrigation, t) ?? '' })}` : ''}</p>
        </div>
        {weather && (
          <div className="text-right text-xs text-text-muted">
            <div>{weather.temperature ?? '--'}°C</div>
            <div>{weather.forecast ?? ''}</div>
          </div>
        )}
      </div>

      {/* Critical banner */}
      {field.health === 'critical' && (
        <div className="rounded-lg border-2 border-critical bg-critical-bg p-3 md:p-4">
          <div className="flex items-center gap-2">
            <span>🔴</span>
            <span className="text-sm font-bold text-critical">{t('fields.criticalCondition')}</span>
          </div>
          <p className="text-xs text-text-secondary mt-1">{t('fields.criticalConditionDesc')}</p>
        </div>
      )}

      {/* Key metrics */}
      <div className="grid grid-cols-3 gap-3 md:gap-4">
        {metrics.map((m) => {
          const isAbnormal = m.value !== undefined && (m.value < m.normal.min || m.value > m.normal.max);
          return (
            <div key={m.label} className={cn('rounded-lg border bg-surface-card p-4', isAbnormal ? 'border-warning bg-warning-bg' : 'border-border-default')}>
              <div className="flex items-center justify-center gap-1 text-xs text-text-muted mb-1">
                <span>{m.icon}</span>
                <span>{m.label}</span>
              </div>
              <div className="text-center">
                <span className={cn('text-2xl font-bold', m.status === 'critical' ? 'text-critical' : m.status === 'warning' ? 'text-warning' : 'text-text-primary')}>
                  {m.value != null ? `${m.value}${m.unit}` : '--'}
                </span>
              </div>
              {devices.length > 1 && (
                <div className="text-[10px] text-text-muted text-center mt-1">
                  {t('fields.avgOfSensors', { count: devices.length })}
                </div>
              )}
              {isAbnormal && <span className="text-[10px] text-warning block text-center mt-1">{t('fields.outsideNormal')}</span>}
            </div>
          );
        })}
      </div>

      {/* Devices in this field */}
      {devices.length > 0 && (
        <div className="rounded-lg border border-border-default bg-surface-card p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-text-primary">{t('fields.devices', { count: devices.length })}</h3>
          </div>
          <div className="space-y-2">
            {devices.map(d => (
              <div key={d.id} className="flex items-center gap-3 px-3 py-2 rounded-lg bg-surface-hover/50">
                <span className="text-base">{typeIcon[d.type] ?? '🌡️'}</span>
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-text-primary truncate">{d.name || d.device_id}</div>
                  <div className="text-[10px] text-text-muted font-mono">{d.device_id}</div>
                </div>
                <div className="flex items-center gap-3 text-xs">
                  {d.latestTemp != null && <span className="text-text-secondary">{d.latestTemp}°C</span>}
                  <span className={cn('flex items-center gap-1', d.status === 'online' ? 'text-green-500' : 'text-red-500')}>
                    <span className={cn('w-1.5 h-1.5 rounded-full inline-block', d.status === 'online' ? 'bg-green-500' : 'bg-red-500')} />
                    {d.status === 'online' ? t('common.online') : t('common.offline')}
                  </span>
                  {d.last_heartbeat && <span className="text-text-muted">{timeAgo(d.last_heartbeat, t)}</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 7-day trend charts (mock fallback until historical API is integrated) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="rounded-lg border border-border-default bg-surface-card p-4">
          <h3 className="text-sm font-semibold text-text-primary mb-3">{t('fields.moistureTrend')}</h3>
          <TrendChart data={generateTrendData(7, avgMoisture ?? 50, 8, { secondary: { base: (avgTemp ?? 25) - 3, variance: 4 } })} type="area" color="#2E7D32" secondaryColor="#38bdf8" showSecondary unit="%" height={160} />
        </div>
        <div className="rounded-lg border border-border-default bg-surface-card p-4">
          <h3 className="text-sm font-semibold text-text-primary mb-3">{t('fields.tempTrend')}</h3>
          <TrendChart data={generateTrendData(7, avgTemp ?? 25, 5)} type="line" color="#f59e0b" unit="°C" height={160} />
        </div>
      </div>

      {/* Irrigation Zones */}
      <div className="rounded-lg border border-border-default bg-surface-card p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-text-primary">{t('fields.irrigationZones', { count: zones.length })}</h3>
          <button
            onClick={() => { setEditingZone(null); setZoneFormOpen(true); }}
            className="text-xs font-medium text-accent hover:text-accent-hover flex items-center gap-1 min-h-[44px] px-2"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
            {t('fields.addZone')}
          </button>
        </div>
        {zones.length > 0 ? (
          <div className="space-y-3">
            {zones.map(zone => (
              <div key={zone.id} className="flex items-center gap-4 px-3 py-3 rounded-lg bg-surface-hover/50 group">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-sm font-medium text-text-primary truncate">{zone.name}</span>
                    <span className={cn('text-[10px] font-medium px-2 py-0.5 rounded-full shrink-0', zoneStatusBg[zone.status], zoneStatusColor[zone.status])}>{zone.status}</span>
                  </div>
                  <div className="flex items-center gap-4 text-xs text-text-muted">
                    <span>{zone.moisture > 0 ? <>{t('fields.moistureValue', { value: zone.moisture })}<strong className={zone.moisture < zone.target_moisture ? 'text-warning' : 'text-text-primary'}> / {t('fields.targetMoisture', { value: zone.target_moisture })}</strong></> : <span className="italic">{t('fields.noMoistureData')}</span>}</span>
                    {zone.runtime_minutes > 0 && <span>{t('fields.runtimeMinutes', { minutes: zone.runtime_minutes })}</span>}
                    {zone.flow_rate_lpm > 0 && <span>{t('fields.flowRate', { rate: zone.flow_rate_lpm })}</span>}
                    {zone.device_name ? <span className="text-accent">{zone.device_name}</span> : zone.device_id ? <span className="text-accent">{t('fields.deviceNumber', { id: zone.device_id })}</span> : <span className="text-text-muted italic">{t('fields.noController')}</span>}
                    {(() => {
                      const last = lastEventForZone.get(zone.id);
                      return last ? <span>{t('fields.lastEvent', { time: timeAgo(last.end_time ?? last.start_time, t) })}</span> : null;
                    })()}
                  </div>
                  {zone.moisture > 0 && (
                    <div className="mt-2 h-1.5 bg-surface-elevated rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all" style={{
                        width: `${Math.min(100, (zone.moisture / zone.target_moisture) * 100)}%`,
                        backgroundColor: zone.moisture >= zone.target_moisture ? '#22c55e' : zone.moisture > zone.target_moisture * 0.7 ? '#f59e0b' : '#ef4444',
                      }} />
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => { setEditingZone(zone); setZoneFormOpen(true); }}
                    className="text-text-muted hover:text-text-primary min-h-[44px] min-w-[44px] flex items-center justify-center"
                    title={t('fields.editZone')}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                  </button>
                  <button
                    onClick={() => setDeletingZoneId(zone.id)}
                    className="text-text-muted hover:text-critical min-h-[44px] min-w-[44px] flex items-center justify-center"
                    title={t('fields.deleteZone')}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-text-muted text-center py-6">{t('fields.noZonesDesc')}</p>
        )}
      </div>

      {/* Zone Form Modal */}
      <IrrigationZoneFormModal
        open={zoneFormOpen}
        onClose={() => { setZoneFormOpen(false); setEditingZone(null); }}
        onSaved={loadZones}
        zone={editingZone}
        preSelectedFieldId={fieldId}
      />

      {/* Delete Zone Confirmation */}
      {deletingZoneId !== null && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/50" onClick={() => setDeletingZoneId(null)}>
          <div className="bg-surface-card rounded-lg border border-border-default w-full max-w-sm mx-4 p-6 shadow-xl" onClick={e => e.stopPropagation()}>
            <h3 className="text-base font-bold text-text-primary mb-2">{t('fields.deleteZoneTitle')}</h3>
            <p className="text-sm text-text-secondary mb-6">{t('fields.deleteZoneConfirm')}</p>
            <div className="flex gap-3">
              <button onClick={() => setDeletingZoneId(null)} className="flex-1 py-2.5 rounded-lg border border-border-default text-sm text-text-secondary hover:text-text-primary transition-colors min-h-[44px]">{t('common.cancel')}</button>
              <button onClick={async () => {
                const res = await deleteZone(deletingZoneId);
                if (res.success) { toast('success', t('fields.zoneDeleted')); loadZones(); }
                else { toast('error', res.error || t('fields.failedToDeleteZone')); }
                setDeletingZoneId(null);
              }} className="flex-1 py-2.5 rounded-lg bg-critical text-white text-sm font-medium hover:bg-critical/80 transition-colors min-h-[44px]">{t('common.delete')}</button>
            </div>
          </div>
        </div>
      )}

      {/* Recent Irrigation Events */}
      {events.length > 0 && (
        <div className="rounded-lg border border-border-default bg-surface-card p-4">
          <h3 className="text-sm font-semibold text-text-primary mb-3">{t('fields.recentIrrigation', { count: events.length })}</h3>
          <div className="space-y-2">
            {events.slice(0, 5).map(e => (
              <div key={e.id} className="flex items-start gap-3 px-3 py-2 rounded-lg bg-surface-hover/50 text-sm">
                <span className={e.status === 'completed' ? 'text-success' : e.status === 'failed' ? 'text-critical' : 'text-info-bright'}>
                  {e.status === 'completed' ? '✅' : e.status === 'failed' ? '❌' : '⏱️'}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="text-text-primary">
                    {e.status === 'running' ? t('fields.irrigationRunning') : e.status === 'completed' ? t('fields.irrigationCompleted') : t('fields.irrigationFailed')}
                    {e.duration_minutes > 0 && ` (${e.duration_minutes}m)`}
                  </div>
                  <div className="text-[10px] text-text-muted">
                    {timeAgo(e.start_time, t)}{e.water_usage_liters > 0 ? ` · ${t('fields.waterUsed', { liters: e.water_usage_liters })}` : ''} · {e.trigger_type}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Active Alerts */}
      {fieldAlerts.length > 0 && (
        <div className="rounded-lg border border-border-default bg-surface-card p-4">
          <h3 className="text-sm font-semibold text-text-primary mb-3">{t('fields.activeAlerts', { count: fieldAlerts.length })}</h3>
          <div className="space-y-2">
            {fieldAlerts.slice(0, 5).map(a => (
              <div key={a.id} className="flex items-start gap-3 px-3 py-2 rounded-lg bg-surface-hover/50 text-sm">
                <span className={a.severity === 'critical' ? 'text-critical' : a.severity === 'warning' ? 'text-warning' : 'text-info-bright'}>
                  {a.severity === 'critical' ? '🔴' : a.severity === 'warning' ? '⚠️' : 'ℹ️'}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="text-text-primary truncate">{a.message}</div>
                  <div className="text-[10px] text-text-muted">{a.device_name || a.device_id} · {timeAgo(a.triggered_at, t)}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* What changed */}
      {(() => {
        const issues: { icon: string; color: string; text: string }[] = [];
        if (avgMoisture !== undefined && avgMoisture < 40) {
          issues.push({ icon: '⚠', color: 'text-warning', text: t('fields.whatChangedIssues.lowMoisture', { value: avgMoisture }) });
          if (avgMoisture < 20) issues.push({ icon: '🔴', color: 'text-critical', text: t('fields.whatChangedIssues.criticalMoisture') });
        }
        if (avgTemp !== undefined && avgTemp > 35) {
          issues.push({ icon: '🔴', color: 'text-critical', text: t('fields.whatChangedIssues.highTemp', { value: avgTemp }) });
        } else if (avgTemp !== undefined && avgTemp > 30) {
          issues.push({ icon: '⚠', color: 'text-warning', text: t('fields.whatChangedIssues.warmTemp', { value: avgTemp }) });
        }
        if (avgHumidity !== undefined && avgHumidity < 30) {
          issues.push({ icon: '⚠', color: 'text-warning', text: t('fields.whatChangedIssues.lowHumidity', { value: avgHumidity }) });
        } else if (avgHumidity !== undefined && avgHumidity > 90) {
          issues.push({ icon: '⚠', color: 'text-warning', text: t('fields.whatChangedIssues.highHumidity', { value: avgHumidity }) });
        }
        if (issues.length === 0) return null;
        return (
          <div className="rounded-lg border border-border-default bg-surface-card p-4">
            <h3 className="text-sm font-semibold text-text-primary mb-2">{t('fields.whatChanged')}</h3>
            <div className="space-y-2 text-sm">
              {issues.map((issue, i) => (
                <div key={i} className={`flex items-start gap-2 ${issue.color}`}>
                  <span className="mt-0.5 shrink-0">{issue.icon}</span>
                  <span>{issue.text}</span>
                </div>
              ))}
            </div>
          </div>
        );
      })()}
    </div>
  );
}

function generateTrendData(
  days: number, baseValue: number, variance: number,
  options?: { secondary?: { base: number; variance: number } }
): { label: string; value: number; secondary?: number }[] {
  const data = [];
  const now = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    const value = baseValue + (Math.random() - 0.5) * variance * 2;
    const secondary = options?.secondary ? options.secondary.base + (Math.random() - 0.5) * options.secondary.variance * 2 : undefined;
    data.push({
      label: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      value: Math.round(value * 10) / 10,
      secondary: secondary ? Math.round(secondary * 10) / 10 : undefined,
    });
  }
  return data;
}
