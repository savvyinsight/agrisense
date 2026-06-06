import { useEffect, useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { getIrrigationEvents } from '@/features/irrigation/api';
import { cn } from '@/shared/lib/cn';
import type { IrrigationEvent } from '@/features/irrigation/api';

interface IrrigationHistoryProps {
  zoneId: number;
  className?: string;
}

export function IrrigationHistory({ zoneId, className }: IrrigationHistoryProps) {
  const { t } = useTranslation();
  const [events, setEvents] = useState<IrrigationEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const res = await getIrrigationEvents({ zone_id: zoneId });
      if (res.success && res.data) setEvents(res.data);
      setLoading(false);
    })();
  }, [zoneId]);

  const stats = useMemo(() => {
    const completed = events.filter((e) => e.status === 'completed');
    const totalWater = completed.reduce((sum, e) => sum + (e.water_usage_liters || 0), 0);
    const avgDuration = completed.length > 0 ? Math.round(completed.reduce((sum, e) => sum + (e.duration_minutes || 0), 0) / completed.length) : 0;
    const failedCount = events.filter((e) => e.status === 'failed').length;

    return { totalWater, avgDuration, failedCount, completedCount: completed.length };
  }, [events]);

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const days = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
    if (days === 0) return t('common.today');
    if (days === 1) return t('common.yesterday');
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  if (loading) return <div className={cn('rounded-lg border border-border-default bg-surface-card p-4', className)}><div className="h-32 animate-pulse bg-surface-hover rounded" /></div>;

  return (
    <div className={cn('rounded-lg border border-border-default bg-surface-card p-4', className)}>
      <h3 className="text-sm font-semibold text-text-primary mb-4">{t('fields.irrigationHistory')}</h3>

      {events.length === 0 ? (
        <p className="text-sm text-text-muted text-center py-8">{t('irrigation.noHistoryYet')}</p>
      ) : (
        <>
          {/* Stats Summary */}
          <div className="grid grid-cols-3 gap-3 mb-6 pb-6 border-b border-border-default">
            <div>
              <p className="text-xs text-text-muted mb-1">{t('irrigation.totalWater')}</p>
              <p className="text-lg font-bold text-text-primary">
                {(stats.totalWater / 1000).toFixed(1)}
                <span className="text-xs text-text-muted ml-1">k L</span>
              </p>
            </div>
            <div>
              <p className="text-xs text-text-muted mb-1">{t('irrigation.avgRuntime')}</p>
              <p className="text-lg font-bold text-text-primary">
                {stats.avgDuration}
                <span className="text-xs text-text-muted ml-1">{t('irrigation.minutes')}</span>
              </p>
            </div>
            <div>
              <p className="text-xs text-text-muted mb-1">{t('irrigation.completed')}</p>
              <p className="text-lg font-bold text-text-primary">
                {stats.completedCount}
                {stats.failedCount > 0 && <span className="text-xs text-critical ml-1">({t('irrigation.failedCount', { count: stats.failedCount })})</span>}
              </p>
            </div>
          </div>

          {/* Timeline */}
          <div className="space-y-3 max-h-[400px] overflow-y-auto">
            {events.map((event) => (
              <div key={event.id} className="flex gap-3 pb-3 border-b border-border-default last:border-b-0">
                <div className="flex flex-col items-center">
                  <div className={cn('w-3 h-3 rounded-full', event.status === 'completed' ? 'bg-success' : event.status === 'failed' ? 'bg-critical' : 'bg-info-bright')} />
                  <div className="w-0.5 h-8 bg-border-default mt-1" />
                </div>
                <div className="flex-1 pt-0.5">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-semibold text-text-primary">{formatDate(event.start_time)}</span>
                    <span className={cn('text-xs font-medium px-2 py-0.5 rounded-full', event.status === 'completed' ? 'bg-success-bg text-success' : event.status === 'failed' ? 'bg-critical-bg text-critical' : 'bg-info-bg text-info-bright')}>
                      {event.status === 'completed' ? '✓' : event.status === 'failed' ? '✕' : '⏱'} {t(`irrigation.${event.status}`)}
                    </span>
                  </div>
                  <p className="text-xs text-text-muted mb-2">
                    {formatTime(event.start_time)}{event.end_time ? ` - ${formatTime(event.end_time)}` : ` - ${t('irrigation.running')}`}
                  </p>
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <span className="text-text-muted">{t('irrigation.durationLabel')}</span>
                      <p className="font-semibold text-text-primary">{event.duration_minutes}m{!event.end_time && event.status === 'running' ? ` ${t('irrigation.ongoing')}` : ''}</p>
                    </div>
                    <div>
                      <span className="text-text-muted">{t('irrigation.waterUsedLabel')}</span>
                      <p className="font-semibold text-text-primary">{event.water_usage_liters} L</p>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
