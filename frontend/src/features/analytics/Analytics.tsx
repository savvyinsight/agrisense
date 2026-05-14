import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { getDevices } from '@/features/devices/api';
import { getAnalyticsReport } from '@/features/analytics/api';
import { StatusCard } from '@/shared/components/StatusCard';
import { ChartSkeleton } from '@/shared/components/SkeletonLoader';
import type { Device, AnalyticsReport } from '@/shared/types/api';

export default function Analytics() {
  const { t } = useTranslation();
  const [devices, setDevices] = useState<Device[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [startDate, setStartDate] = useState(() => new Date(Date.now() - 30 * 86400000));
  const [endDate, setEndDate] = useState(() => new Date());
  const [reportType, setReportType] = useState('daily');
  const [report, setReport] = useState<AnalyticsReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    getDevices().then((res) => { if (res.success && res.data) setDevices(res.data.devices); });
  }, []);

  const generateReport = async () => {
    if (!selectedId) { setError(t('analytics.selectDeviceRequired')); return; }
    setLoading(true); setError('');
    const res = await getAnalyticsReport({ device_id: Number(selectedId), start: startDate.toISOString(), end: endDate.toISOString(), report_type: reportType });
    if (res.success && res.data) setReport(res.data);
    else setError(res.error || t('analytics.failedToGenerate'));
    setLoading(false);
  };

  const getSensorData = (type: string) => report?.sensor_reports?.find((s) => s.sensor_type === type);
  const avg = (type: string) => { const d = getSensorData(type)?.data; if (!d?.length) return null; return d.reduce((a: number, b: any) => a + (b.avg ?? b.value ?? 0), 0) / d.length; };
  const fmt = (type: string) => { const d = getSensorData(type)?.data; if (!d) return []; return d.map((x: any) => ({ date: x.timestamp?.split('T')[0] || x.date, value: x.avg ?? x.value ?? 0 })); };

  const metrics = [
    { label: t('analytics.avgTemperature'), value: avg('temperature'), unit: '°C' },
    { label: t('analytics.avgHumidity'), value: avg('humidity'), unit: '%' },
    { label: t('analytics.avgSoilMoisture'), value: avg('soil_moisture'), unit: '%' },
    { label: t('analytics.reportTypeLabel'), value: null, unit: reportType },
  ];

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-lg font-bold text-text-primary">{t('analytics.title')}</h1>
        <p className="text-sm text-text-muted mt-0.5">{t('analytics.subtitle')}</p>
      </div>

      <div className="rounded-lg border border-border-default bg-surface-card p-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1.5">{t('analytics.selectDevice')}</label>
            <select value={selectedId} onChange={(e) => setSelectedId(e.target.value)} className="w-full px-3 py-2 rounded-lg bg-surface-base border border-border-default text-text-primary text-sm focus:outline-none focus:border-accent">
              <option value="">{t('analytics.selectDevicePlaceholder')}</option>
              {devices.map((d) => <option key={d.id} value={d.id}>{d.device_id} - {d.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1.5">{t('analytics.startDate')}</label>
            <input type="date" value={startDate.toISOString().split('T')[0]} onChange={(e) => setStartDate(new Date(e.target.value))} className="w-full px-3 py-2 rounded-lg bg-surface-base border border-border-default text-text-primary text-sm focus:outline-none focus:border-accent" />
          </div>
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1.5">{t('analytics.endDate')}</label>
            <input type="date" value={endDate.toISOString().split('T')[0]} onChange={(e) => setEndDate(new Date(e.target.value))} className="w-full px-3 py-2 rounded-lg bg-surface-base border border-border-default text-text-primary text-sm focus:outline-none focus:border-accent" />
          </div>
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1.5">{t('analytics.reportType')}</label>
            <select value={reportType} onChange={(e) => setReportType(e.target.value)} className="w-full px-3 py-2 rounded-lg bg-surface-base border border-border-default text-text-primary text-sm focus:outline-none focus:border-accent">
              <option value="daily">{t('analytics.daily')}</option>
              <option value="weekly">{t('analytics.weekly')}</option>
              <option value="monthly">{t('analytics.monthly')}</option>
            </select>
          </div>
          <div className="flex items-end">
            <button onClick={generateReport} disabled={loading} className="w-full py-2 rounded-lg bg-accent hover:bg-accent-hover text-white text-sm font-medium transition-colors disabled:opacity-50">
              {loading ? t('analytics.generating') : t('analytics.generateReport')}
            </button>
          </div>
        </div>
      </div>

      {error && <div className="text-sm p-3 rounded-lg bg-critical-bg text-critical border border-critical/30">{error}</div>}

      {loading && <div className="space-y-4"><ChartSkeleton /><ChartSkeleton /></div>}

      {report && !loading && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {metrics.map((m) => <StatusCard key={m.label} label={m.label} value={m.value !== null ? `${(m.value as number).toFixed(1)}${m.unit}` : m.unit} status="info" />)}
          </div>

          {getSensorData('temperature') && (
            <div className="rounded-lg border border-border-default bg-surface-card p-4">
              <h3 className="text-sm font-semibold text-text-primary mb-4">{t('analytics.temperatureTrend')}</h3>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={fmt('temperature')}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#2a2e3e" />
                  <XAxis dataKey="date" stroke="#6b7280" fontSize={12} />
                  <YAxis unit="°C" stroke="#6b7280" fontSize={12} />
                  <Tooltip contentStyle={{ background: '#1e2130', border: '1px solid #2a2e3e', borderRadius: 8, fontSize: 13 }} labelStyle={{ color: '#e8eaed' }} />
                  <Line type="monotone" dataKey="value" stroke="#2E7D32" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}

          {getSensorData('humidity') && (
            <div className="rounded-lg border border-border-default bg-surface-card p-4">
              <h3 className="text-sm font-semibold text-text-primary mb-4">{t('analytics.humidityTrend')}</h3>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={fmt('humidity')}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#2a2e3e" />
                  <XAxis dataKey="date" stroke="#6b7280" fontSize={12} />
                  <YAxis unit="%" stroke="#6b7280" fontSize={12} />
                  <Tooltip contentStyle={{ background: '#1e2130', border: '1px solid #2a2e3e', borderRadius: 8, fontSize: 13 }} labelStyle={{ color: '#e8eaed' }} />
                  <Bar dataKey="value" fill="#64748b" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {getSensorData('soil_moisture') && (
            <div className="rounded-lg border border-border-default bg-surface-card p-4">
              <h3 className="text-sm font-semibold text-text-primary mb-4">{t('analytics.soilMoistureTrend')}</h3>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={fmt('soil_moisture')}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#2a2e3e" />
                  <XAxis dataKey="date" stroke="#6b7280" fontSize={12} />
                  <YAxis unit="%" stroke="#6b7280" fontSize={12} />
                  <Tooltip contentStyle={{ background: '#1e2130', border: '1px solid #2a2e3e', borderRadius: 8, fontSize: 13 }} labelStyle={{ color: '#e8eaed' }} />
                  <Line type="monotone" dataKey="value" stroke="#f59e0b" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </>
      )}
    </div>
  );
}
