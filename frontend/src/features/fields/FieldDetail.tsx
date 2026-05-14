import { useEffect, useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { TrendChart } from '@/shared/components/TrendChart';
import { getField } from '@/features/fields/api';
import type { Field } from '@/shared/types';
import { cn } from '@/shared/lib/cn';

const healthColor: Record<string, string> = { healthy: 'text-success', warning: 'text-warning', critical: 'text-critical' };
const healthBg: Record<string, string> = { healthy: 'bg-success/10', warning: 'bg-warning/10', critical: 'bg-critical/10' };
const healthBorder: Record<string, string> = { healthy: 'border-l-success', warning: 'border-l-warning', critical: 'border-l-critical' };

export default function FieldDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [field, setField] = useState<Field | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const res = await getField(Number(id));
      if (res.success && res.data) setField(res.data);
      setLoading(false);
    })();
  }, [id]);

  const moistureHistory = useMemo(() => generateTrendData(7, field?.soil_moisture ?? 50, 8, { secondary: { base: (field?.temperature ?? 25) - 3, variance: 4 } }), [field]);
  const tempHistory = useMemo(() => generateTrendData(7, field?.temperature ?? 25, 5), [field]);

  if (loading) return <div className="max-w-5xl mx-auto py-12"><div className="h-[400px] rounded-lg bg-surface-card border border-border-default animate-pulse" /></div>;

  if (!field) {
    return (
      <div className="max-w-3xl mx-auto py-12 text-center">
        <span className="text-4xl block mb-4">🔍</span>
        <h2 className="text-lg font-bold text-text-primary mb-2">Field not found</h2>
        <p className="text-sm text-text-muted mb-4">The field you're looking for doesn't exist.</p>
        <button onClick={() => navigate('/fields')} className="text-sm text-accent hover:text-accent-hover font-medium">← Back to Fields</button>
      </div>
    );
  }

  const metrics = [
    { label: t('fields.soilMoisture'), value: field.soil_moisture, unit: '%', status: field.health, normal: { min: 40, max: 80 } },
    { label: t('fields.temperature'), value: field.temperature, unit: '°C', status: field.health, normal: { min: 15, max: 35 } },
    { label: t('fields.humidity'), value: field.humidity, unit: '%', status: field.health, normal: { min: 40, max: 90 } },
  ];

  return (
    <div className="max-w-5xl mx-auto space-y-4 md:space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => navigate('/fields')} className="text-text-muted hover:text-text-primary transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
        </button>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-bold text-text-primary">{field.name}</h1>
            <span className={cn('text-xs font-medium px-2 py-0.5 rounded-full', healthBg[field.health], healthColor[field.health])}>{field.health}</span>
          </div>
          <p className="text-sm text-text-muted">{field.crop} • {field.area_hectares} ha</p>
        </div>
      </div>

      {/* Critical banner */}
      {field.health === 'critical' && (
        <div className="rounded-lg border-2 border-critical bg-critical-bg p-3 md:p-4">
          <div className="flex items-center gap-2">
            <span>🔴</span>
            <span className="text-sm font-bold text-critical">Critical condition detected</span>
          </div>
          <p className="text-xs text-text-secondary mt-1">Soil moisture is critically low (18%). Immediate irrigation recommended.</p>
        </div>
      )}

      {/* Key metrics with normal range indicators */}
      <div className="grid grid-cols-3 gap-3 md:gap-4">
        {metrics.map((m) => {
          const isAbnormal = m.value !== undefined && (m.value < m.normal.min || m.value > m.normal.max);
          return (
            <div key={m.label} className={cn('rounded-lg border bg-surface-card p-4 text-center', isAbnormal ? 'border-warning bg-warning-bg' : 'border-border-default')}>
              <span className="text-xs text-text-muted block mb-1">{m.label}</span>
              <span className={cn('text-2xl font-bold', m.status === 'critical' ? 'text-critical' : m.status === 'warning' ? 'text-warning' : 'text-text-primary')}>
                {m.value ?? '--'}{m.unit}
              </span>
              {isAbnormal && <span className="text-[10px] text-warning block mt-1">Outside normal range</span>}
              <span className="text-[10px] text-text-muted block mt-1">Normal: {m.normal.min}–{m.normal.max}{m.unit}</span>
            </div>
          );
        })}
      </div>

      {/* What changed section — checks all metrics */}
      {(() => {
        const issues: { icon: string; color: string; text: string }[] = [];
        if (field.soil_moisture !== undefined && field.soil_moisture < 40) {
          issues.push({ icon: '⚠', color: 'text-warning', text: `Soil moisture at ${field.soil_moisture}% — below optimal threshold of 40%` });
          if (field.soil_moisture < 20) issues.push({ icon: '🔴', color: 'text-critical', text: 'Critical — crop stress risk if not addressed within 6 hours' });
        }
        if (field.temperature !== undefined && field.temperature > 35) {
          issues.push({ icon: '🔴', color: 'text-critical', text: `Temperature at ${field.temperature}°C — above safe threshold of 35°C` });
        } else if (field.temperature !== undefined && field.temperature > 30) {
          issues.push({ icon: '⚠', color: 'text-warning', text: `Temperature at ${field.temperature}°C — approaching heat stress threshold` });
        }
        if (field.humidity !== undefined && field.humidity < 30) {
          issues.push({ icon: '⚠', color: 'text-warning', text: `Humidity at ${field.humidity}% — very dry conditions` });
        } else if (field.humidity !== undefined && field.humidity > 90) {
          issues.push({ icon: '⚠', color: 'text-warning', text: `Humidity at ${field.humidity}% — elevated disease risk` });
        }
        if (field.soil_moisture !== undefined && field.last_irrigation) {
          const daysSinceIrrigation = Math.floor((Date.now() - new Date(field.last_irrigation).getTime()) / 86400000);
          if (daysSinceIrrigation > 7 && field.soil_moisture < 50) {
            issues.push({ icon: '💧', color: 'text-info-bright', text: `${daysSinceIrrigation} days since last irrigation — soil moisture declining` });
          }
        }
        if (issues.length === 0) return null;
        return (
          <div className="rounded-lg border border-border-default bg-surface-card p-4">
            <h3 className="text-sm font-semibold text-text-primary mb-2">What changed</h3>
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

      {/* 7-day trend charts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="rounded-lg border border-border-default bg-surface-card p-4">
          <h3 className="text-sm font-semibold text-text-primary mb-3">Soil Moisture (7-day)</h3>
          <TrendChart data={moistureHistory} type="area" color="#2E7D32" secondaryColor="#38bdf8" showSecondary unit="%" height={160} />
        </div>
        <div className="rounded-lg border border-border-default bg-surface-card p-4">
          <h3 className="text-sm font-semibold text-text-primary mb-3">Temperature (7-day)</h3>
          <TrendChart data={tempHistory} type="line" color="#f59e0b" unit="°C" height={160} />
        </div>
      </div>

      {/* Zones */}
      {field.zones && field.zones.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-text-primary mb-3">{t('fields.zones')} ({field.zones.length})</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {field.zones.map((zone) => (
              <div key={zone.id} className={cn('rounded-lg border bg-surface-card p-4', healthBorder[zone.status])}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-text-primary">{zone.name}</span>
                  <span className={cn('text-xs font-medium px-2 py-0.5 rounded-full', healthBg[zone.status], healthColor[zone.status])}>{zone.status}</span>
                </div>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div><span className="text-xs text-text-muted block">{t('fields.moisture')}</span><span className={cn('text-sm font-bold tabular-nums', healthColor[zone.status])}>{zone.soil_moisture}%</span></div>
                  <div><span className="text-xs text-text-muted block">{t('fields.temp')}</span><span className="text-sm font-bold tabular-nums text-text-primary">{zone.temperature}°C</span></div>
                  <div><span className="text-xs text-text-muted block">{t('fields.humidity')}</span><span className="text-sm font-bold tabular-nums text-text-primary">{zone.humidity}%</span></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Irrigation history */}
      <div className="rounded-lg border border-border-default bg-surface-card p-4">
        <h2 className="text-sm font-semibold text-text-primary mb-3">{t('fields.irrigationHistory')}</h2>
        {field.last_irrigation ? (
          <p className="text-sm text-text-secondary">{t('fields.lastIrrigation', { date: new Date(field.last_irrigation).toLocaleString() })}</p>
        ) : (
          <p className="text-sm text-text-muted">{t('fields.noIrrigationData')}</p>
        )}
      </div>
    </div>
  );
}

// Helper function to generate trend data
function generateTrendData(
  days: number,
  baseValue: number,
  variance: number,
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
