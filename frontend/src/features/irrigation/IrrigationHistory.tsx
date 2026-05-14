import { useEffect, useState, useMemo } from 'react';
import type { IrrigationZone, IrrigationEvent } from '@/shared/types';
import { cn } from '@/shared/lib/cn';

interface IrrigationHistoryProps {
  zone: IrrigationZone;
  zoneId?: number;
  className?: string;
}

export function IrrigationHistory({ zone, zoneId, className }: IrrigationHistoryProps) {
  const [events, setEvents] = useState<IrrigationEvent[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Mock data: In production, fetch from API
    const mockEvents: IrrigationEvent[] = [
      {
        id: 1,
        field_id: zone.field_id || 0,
        zone_id: zoneId || zone.id,
        status: 'completed',
        start_time: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
        end_time: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000 + 45 * 60 * 1000).toISOString(),
        duration_minutes: 45,
        water_usage_liters: 2250,
      },
      {
        id: 2,
        field_id: zone.field_id || 0,
        zone_id: zoneId || zone.id,
        status: 'completed',
        start_time: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
        end_time: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000 + 50 * 60 * 1000).toISOString(),
        duration_minutes: 50,
        water_usage_liters: 2500,
      },
      {
        id: 3,
        field_id: zone.field_id || 0,
        zone_id: zoneId || zone.id,
        status: 'completed',
        start_time: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
        end_time: new Date(Date.now() - 3 * 60 * 60 * 1000 + 60 * 60 * 1000).toISOString(),
        duration_minutes: 60,
        water_usage_liters: 3000,
      },
    ];
    setEvents(mockEvents);
  }, [zone.id, zoneId]);

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

    if (days === 0) return 'Today';
    if (days === 1) return 'Yesterday';
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  return (
    <div className={cn('rounded-lg border border-border-default bg-surface-card p-4', className)}>
      <h3 className="text-sm font-semibold text-text-primary mb-4">Irrigation History (30 days)</h3>

      {/* Stats Summary */}
      <div className="grid grid-cols-3 gap-3 mb-6 pb-6 border-b border-border-default">
        <div>
          <p className="text-xs text-text-muted mb-1">Total Water</p>
          <p className="text-lg font-bold text-text-primary">
            {(stats.totalWater / 1000).toFixed(1)}
            <span className="text-xs text-text-muted ml-1">k L</span>
          </p>
        </div>
        <div>
          <p className="text-xs text-text-muted mb-1">Avg Runtime</p>
          <p className="text-lg font-bold text-text-primary">
            {stats.avgDuration}
            <span className="text-xs text-text-muted ml-1">min</span>
          </p>
        </div>
        <div>
          <p className="text-xs text-text-muted mb-1">Completed</p>
          <p className="text-lg font-bold text-text-primary">
            {stats.completedCount}
            {stats.failedCount > 0 && <span className="text-xs text-critical ml-1">({stats.failedCount} failed)</span>}
          </p>
        </div>
      </div>

      {/* Timeline */}
      <div className="space-y-3 max-h-[400px] overflow-y-auto">
        {events.length === 0 ? (
          <p className="text-sm text-text-muted text-center py-6">No irrigation history available</p>
        ) : (
          events.map((event) => (
            <div key={event.id} className="flex gap-3 pb-3 border-b border-border-default last:border-b-0">
              {/* Timeline dot */}
              <div className="flex flex-col items-center">
                <div
                  className={cn(
                    'w-3 h-3 rounded-full',
                    event.status === 'completed'
                      ? 'bg-success'
                      : event.status === 'failed'
                        ? 'bg-critical'
                        : 'bg-warning'
                  )}
                />
                <div className="w-0.5 h-8 bg-border-default mt-1" />
              </div>

              {/* Event details */}
              <div className="flex-1 pt-0.5">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-semibold text-text-primary">
                    {formatDate(event.start_time)}
                  </span>
                  <span
                    className={cn(
                      'text-xs font-medium px-2 py-0.5 rounded-full',
                      event.status === 'completed'
                        ? 'bg-success-bg text-success'
                        : event.status === 'failed'
                          ? 'bg-critical-bg text-critical'
                          : 'bg-warning-bg text-warning'
                    )}
                  >
                    {event.status === 'completed' ? '✓' : event.status === 'failed' ? '✕' : '⏱'}{' '}
                    {event.status.charAt(0).toUpperCase() + event.status.slice(1)}
                  </span>
                </div>

                <p className="text-xs text-text-muted mb-2">
                  {formatTime(event.start_time)} - {event.end_time ? formatTime(event.end_time) : 'Running'}
                </p>

                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <span className="text-text-muted">Duration</span>
                    <p className="font-semibold text-text-primary">{event.duration_minutes}m</p>
                  </div>
                  <div>
                    <span className="text-text-muted">Water Used</span>
                    <p className="font-semibold text-text-primary">{event.water_usage_liters} L</p>
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
