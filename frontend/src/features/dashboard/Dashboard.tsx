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
import { getZones } from '@/features/irrigation/api';
import { getCurrentWeather } from '@/features/weather/api';
import { toast } from '@/shared/components/Toast';
import { getFields } from '@/features/fields/api';
import type { Field, Alert2, WebSocketMessage, SensorDataMessage, Device } from '@/shared/types';
import { cn } from '@/shared/lib/cn';

export default function Dashboard() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user, isAdmin } = useAuthStore();
  const { alerts, setAlerts, addAlert } = useAlertsStore();
  const token = useAuthStore((s) => s.token);
  const [devices, setDevices] = useState<Device[]>([]);
  const [fields, setFields] = useState<Field[]>([]);
  const [deviceData, setDeviceData] = useState<(Device & { readings?: Record<string, number> })[]>([]);
  const [totalWater, setTotalWater] = useState(0);
  const [weatherText, setWeatherText] = useState('--');

  const handleWsMessage = (data: WebSocketMessage) => {
    if (data.type !== 'sensor_data') return;
    const p = (data as SensorDataMessage).payload as { device_id: string; value: number };
    if (p.value > 30) {
      addAlert({
        id: Date.now(), device_id: p.device_id,
        title: `${p.value.toFixed(1)}°C — High temperature detected`,
        message: '', severity: p.value > 35 ? 'critical' : 'high', status: 'active',
        triggered_at: new Date().toISOString(),
        recommended_action: 'Check ventilation or shade coverage',
      });
    }
  };

  const { isConnected } = useWebSocket(token, handleWsMessage);

  useEffect(() => {
    (async () => {
      const [deviceRes, alertRes, fieldRes] = await Promise.all([getDevices(), getActiveAlerts(), getFields()]);
      if (deviceRes.success && deviceRes.data) {
        setDevices(deviceRes.data.devices);
        const ids = deviceRes.data.devices.map((d) => String(d.id));
        const rr = await getDevicesDataLatest(ids);
        const rd: Record<string, any> = rr.success && rr.data ? rr.data.devices || {} : {};
        setDeviceData(deviceRes.data.devices.map((d) => ({
          ...d,
          readings: rd[d.device_id] || {},
        })));
      }
      if (alertRes.success && alertRes.data) {
        setAlerts((alertRes.data.alerts || []).map((a) => ({
          id: a.id, device_id: a.device_id, device_name: a.device_name,
          title: a.message, message: '',
          severity: a.severity === 'critical' ? 'critical' : a.severity === 'warning' ? 'high' : 'medium',
          status: a.status === 'acknowledged' ? 'acknowledged' : a.status === 'resolved' ? 'resolved' : 'active',
          triggered_at: a.triggered_at, confidence: 85,
          recommended_action: a.severity === 'critical' ? 'Inspect immediately' : 'Monitor situation',
        })));
      }
      if (fieldRes.success && fieldRes.data) setFields(fieldRes.data);

      const [zoneRes, weatherRes] = await Promise.all([getZones(), getCurrentWeather()]);
      if (zoneRes.success && zoneRes.data) {
        setTotalWater(zoneRes.data.reduce((sum, z) => sum + (z.runtime_minutes || z.runtime || 0) * (z.flow_rate_lpm || z.flowRate || 0), 0));
      }
      if (weatherRes.success && weatherRes.data) {
        const w = weatherRes.data;
        setWeatherText(`${w.temperature}°C / ${w.humidity}%`);
      }
    })();
  }, [setAlerts]);

  // Generate mock field geometry for the map
  const fieldGeo = useMemo(() => fields.map((f, i) => ({
    id: f.id, name: f.name, health: f.health, soil_moisture: f.soil_moisture,
    alerts: f.health === 'critical' ? 1 : f.health === 'warning' ? 1 : undefined,
    zoneCount: f.zones?.length || 0,
    geometry: {
      type: 'Polygon' as const,
      coordinates: [[
        [114.3 + (i % 3) * 0.04 - 0.02, 30.5 + i * 0.03 - 0.015],
        [114.3 + (i % 3) * 0.04 + 0.02, 30.5 + i * 0.03 - 0.015],
        [114.3 + (i % 3) * 0.04 + 0.025, 30.5 + i * 0.03 + 0.015],
        [114.3 + (i % 3) * 0.04 - 0.015, 30.5 + i * 0.03 + 0.02],
        [114.3 + (i % 3) * 0.04 - 0.02, 30.5 + i * 0.03 - 0.015],
      ]],
    },
  })), [fields]);

  const handleAcknowledge = async (id: number) => {
    const res = await acknowledgeAlert(id);
    if (res.success) { setAlerts(alerts.filter((a) => a.id !== id)); toast('success', t('alerts.alertAcknowledged')); }
    else toast('error', t('alerts.acknowledgeError'));
  };

  const criticalCount = alerts.filter((a) => a.status === 'active' && a.severity === 'critical').length;
  const highActive = alerts.filter((a) => a.status === 'active' && a.severity === 'high');
  const mediumActive = alerts.filter((a) => a.status === 'active' && a.severity === 'medium');
  const onlineCount = devices.filter((d) => d.status === 'online').length;
  const healthPct = devices.length > 0 ? Math.round((onlineCount / devices.length) * 100) : 0;
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
      <div className="grid grid-cols-2 md:grid-cols-5 gap-2 md:gap-3">
        <StatusCard label={t('dashboard.farmHealth')} value={`${healthPct}%`} status={healthPct === 100 ? 'healthy' : healthPct > 0 ? 'warning' : 'critical'} icon="🌾" subtitle={isConnected ? t('dashboard.live') : t('dashboard.offline')} />
        <StatusCard label={t('dashboard.criticalAlerts')} value={criticalCount} status={criticalCount > 0 ? 'critical' : 'healthy'} icon="⚡" subtitle={criticalCount > 0 ? t('dashboard.requiresAttention') : t('dashboard.allClear')} onClick={() => navigate('/alerts')} />
        <StatusCard label={t('dashboard.waterUsage')} value={`${(totalWater / 1000).toFixed(1)}k L`} status="info" icon="💧" subtitle={t('dashboard.today')} onClick={() => navigate('/irrigation')} />
        <StatusCard label={t('dashboard.weatherRisk')} value={weatherText} status="info" icon="☀" subtitle={t('common.today')} onClick={() => navigate('/weather')} />
        <StatusCard label={t('dashboard.connectivity')} value={`${onlineCount}/${devices.length}`} status={devices.length > 0 && onlineCount === devices.length ? 'healthy' : 'warning'} icon="📡" subtitle={isConnected ? t('dashboard.systemOnline') : t('dashboard.disconnected')} />
      </div>

      {/* ─── MAIN: Map + Priority Feed ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">
        <div className="lg:col-span-2 order-2 lg:order-1">
          <FarmMap
            fields={fieldGeo}
            height={340}
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
            {[{ zone: t('irrigation.title'), status: t('irrigation.active'), time: 'Running 60m', water: '5,700 L', urgent: true },
              { zone: t('irrigation.title'), status: t('irrigation.active'), time: 'Running 45m', water: '5,400 L', urgent: false },
              { zone: t('irrigation.title'), status: t('irrigation.failed'), time: 'Failed 15m ago', water: '0 L', urgent: true },
            ].map((item) => (
              <div key={item.zone} className={cn('flex items-center justify-between py-2 px-3 rounded-md', item.urgent ? 'bg-critical-bg' : '')}>
                <div className="flex items-center gap-2">
                  <span className={cn('w-2 h-2 rounded-full', item.urgent ? 'bg-critical' : 'bg-info-bright')} />
                  <span className="text-sm text-text-primary">{item.zone}</span>
                </div>
                <div className="flex items-center gap-3 text-xs">
                  <span className={item.status === t('irrigation.failed') ? 'text-critical font-medium' : 'text-info-bright'}>{item.status}</span>
                  <span className="text-text-muted hidden sm:inline">{item.time}</span>
                  <span className="text-text-muted w-16 text-right">{item.water}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
