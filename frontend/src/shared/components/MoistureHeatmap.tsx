import { useMemo } from 'react';
import type { IrrigationZone } from '@/features/irrigation/api';
import { cn } from '@/shared/lib/cn';

interface MoistureHeatmapProps {
  zones: IrrigationZone[];
  height?: number;
  className?: string;
}

export function MoistureHeatmap({ zones, height = 300, className }: MoistureHeatmapProps) {
  // Color gradient: dry (red) → ideal (green) → wet (blue)
  const getMoistureColor = (moisturePct: number): string => {
    if (moisturePct < 30) return '#ef4444'; // red
    if (moisturePct < 50) return '#f97316'; // orange
    if (moisturePct < 70) return '#22c55e'; // green
    if (moisturePct < 85) return '#3b82f6'; // blue
    return '#06b6d4'; // cyan
  };

  const getMoistureLabel = (moisturePct: number): string => {
    if (moisturePct < 30) return 'Critical';
    if (moisturePct < 50) return 'Low';
    if (moisturePct < 70) return 'Ideal';
    if (moisturePct < 85) return 'Good';
    return 'Wet';
  };

  const zonesWithPct = useMemo(
    () =>
      zones.map((z) => ({
        ...z,
        moisturePct: Math.round((z.moisture / z.target_moisture) * 100),
      })),
    [zones]
  );

  // Note: These are calculated for reference but not used in current implementation
  // They can be used when implementing dynamic sizing or advanced features
  void Math.max(...zonesWithPct.map((z) => z.target_moisture), 100);
  void Math.max(60, height / Math.ceil(zonesWithPct.length / 4));

  return (
    <div className={cn('rounded-lg border border-border-default bg-surface-card p-4', className)}>
      <h3 className="text-sm font-semibold text-text-primary mb-4">Soil Moisture Heatmap</h3>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3" style={{ minHeight: `${height}px` }}>
        {zonesWithPct.map((zone) => {
          const moisturePct = Math.min(100, zone.moisturePct);
          const color = getMoistureColor(moisturePct);
          const label = getMoistureLabel(moisturePct);

          return (
            <div
              key={zone.id}
              className="rounded-lg border border-border-default overflow-hidden shadow-sm transition-transform hover:scale-105"
            >
              {/* Visual indicator bar */}
              <div className="flex flex-col h-full">
                {/* Moisture visualization */}
                <div
                  className="flex-1 flex items-end justify-center pb-2 pt-4 px-2 relative"
                  style={{
                    backgroundColor: `${color}20`,
                    borderBottom: `3px solid ${color}`,
                  }}
                >
                  {/* Moisture bar */}
                  <div
                    className="w-1 rounded-full transition-all"
                    style={{
                      height: `${(moisturePct / 100) * 60}px`,
                      backgroundColor: color,
                    }}
                  />
                </div>

                {/* Info section */}
                <div className="bg-surface-card p-2">
                  <p className="text-xs font-semibold text-text-primary truncate">{zone.name}</p>
                  <div className="flex items-center justify-between mt-1">
                    <span className="text-xs font-bold tabular-nums" style={{ color }}>
                      {moisturePct}%
                    </span>
                    <span className="text-xs text-text-muted">{zone.moisture}%</span>
                  </div>
                  <div className="mt-1 pt-1 border-t border-border-default">
                    <span className="text-xs text-text-muted">{label}</span>
                  </div>

                  {/* Status indicator */}
                  {zone.status && (
                    <span
                      className={cn(
                        'text-xs font-medium mt-1 inline-block px-1.5 py-0.5 rounded',
                        zone.status === 'active'
                          ? 'bg-info-bg text-info-bright'
                          : zone.status === 'failed'
                            ? 'bg-critical-bg text-critical'
                            : 'bg-surface-hover text-text-muted'
                      )}
                    >
                      {zone.status}
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="mt-6 pt-4 border-t border-border-default">
        <p className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-3">
          Moisture Levels
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          {[
            { pct: 25, label: 'Critical', color: '#ef4444' },
            { pct: 40, label: 'Low', color: '#f97316' },
            { pct: 60, label: 'Ideal', color: '#22c55e' },
            { pct: 77, label: 'Good', color: '#3b82f6' },
            { pct: 90, label: 'Wet', color: '#06b6d4' },
          ].map((item) => (
            <div key={item.label} className="flex items-center gap-2">
              <div
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: item.color }}
              />
              <span className="text-xs text-text-muted">{item.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Real-time indicator */}
      <div className="mt-3 pt-3 border-t border-border-default text-center">
        <span className="text-xs text-text-muted flex items-center justify-center gap-1">
          <span className="w-2 h-2 rounded-full bg-success animate-pulse" />
          Live updates via WebSocket
        </span>
      </div>
    </div>
  );
}
