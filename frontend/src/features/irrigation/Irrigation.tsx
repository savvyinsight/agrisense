import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StatusCard } from '@/shared/components/StatusCard';
import { cn } from '@/shared/lib/cn';
import { getZones, startZone, stopZone, retryZone, deleteZone } from '@/features/irrigation/api';
import { IrrigationZoneFormModal } from '@/features/irrigation/IrrigationZoneFormModal';
import { toast } from '@/shared/components/Toast';
import type { IrrigationZone } from '@/features/irrigation/api';

const statusConfig: Record<string, { color: string; bg: string }> = {
  active: { color: 'text-info-bright', bg: 'bg-info-bg' },
  scheduled: { color: 'text-warning', bg: 'bg-warning-bg' },
  idle: { color: 'text-text-muted', bg: 'bg-surface-hover' },
  failed: { color: 'text-critical', bg: 'bg-critical-bg' },
};

export default function Irrigation() {
  const { t } = useTranslation();
  const [zones, setZones] = useState<IrrigationZone[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoadingId, setActionLoadingId] = useState<number | null>(null);
  const [filter, setFilter] = useState<string>('all');
  const [zoneFormOpen, setZoneFormOpen] = useState(false);
  const [editingZone, setEditingZone] = useState<IrrigationZone | null>(null);
  const [deletingZoneId, setDeletingZoneId] = useState<number | null>(null);

  const load = async () => {
    setLoading(true);
    const res = await getZones();
    if (res.success && res.data) setZones(res.data);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const withAction = async (id: number, action: () => Promise<any>, successMsg: string, errorMsg: string) => {
    setActionLoadingId(id);
    const r = await action();
    if (r.success) toast('success', successMsg); else toast('error', errorMsg);
    setActionLoadingId(null);
    load();
  };
  const handleStart = (id: number) => withAction(id, () => startZone(id), t('irrigation.started'), t('common.failedToSave'));
  const handleStop = (id: number) => withAction(id, () => stopZone(id), t('irrigation.stopped'), t('common.failedToSave'));
  const handleRetry = (id: number) => withAction(id, () => retryZone(id), t('irrigation.retryScheduled'), t('common.failedToSave'));

  const filtered = filter === 'all' ? zones : zones.filter((z) => z.status === filter);
  const totalWater = zones.reduce((sum, z) => sum + z.runtime_minutes * z.flow_rate_lpm, 0);
  const activeZones = zones.filter((z) => z.status === 'active').length;
  const failedZones = zones.filter((z) => z.status === 'failed').length;
  const dryZones = zones.filter((z) => (z.moisture / z.target_moisture) < 0.5).length;

  // Sort: failed first, then active, then by dryness
  const sorted = [...filtered].sort((a, b) => {
    const rank = { failed: 0, active: 1, scheduled: 2, idle: 3 };
    if (rank[a.status] !== rank[b.status]) return rank[a.status] - rank[b.status];
    return (a.moisture / a.target_moisture) - (b.moisture / b.target_moisture);
  });

  return (
    <div className="max-w-7xl mx-auto space-y-4 md:space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-text-primary">{t('irrigation.title')}</h1>
          <p className="text-sm text-text-muted mt-0.5">{t('irrigation.subtitle')}</p>
        </div>
        <button
          onClick={() => { setEditingZone(null); setZoneFormOpen(true); }}
          className="text-xs font-medium text-accent hover:text-accent-hover flex items-center gap-1 min-h-[44px] px-3 py-2 rounded-lg border border-accent/30 hover:bg-accent/5 transition-colors"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
          {t('irrigation.addZone')}
        </button>
      </div>

      {/* Tier 1: Failed zones banner */}
      {failedZones > 0 && (
        <div className="rounded-lg border-2 border-critical bg-critical-bg p-3 md:p-4">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-lg">🔴</span>
            <span className="text-sm font-bold text-critical">{failedZones} {failedZones === 1 ? t('irrigation.zoneFailed') : t('irrigation.zonesFailed')}</span>
          </div>
          <p className="text-xs text-text-secondary">{t('irrigation.checkWaterSupply')}</p>
        </div>
      )}

      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-3">
        <StatusCard label={t('irrigation.activeZones')} value={activeZones} status={activeZones > 0 ? 'info' : 'healthy'} icon="💧" />
        <StatusCard label={t('irrigation.waterUsed')} value={`${(totalWater / 1000).toFixed(1)}k L`} status="info" icon="📊" subtitle={t('irrigation.today')} />
        <StatusCard label={t('irrigation.efficiency')} value="87%" status="healthy" icon="⚡" />
        <StatusCard label={t('irrigation.dryZones')} value={dryZones} status={dryZones > 0 ? 'warning' : 'healthy'} icon="🏜" />
      </div>

      {/* Filters */}
      <div className="flex gap-1 rounded-lg bg-surface-card p-1 border border-border-default w-fit overflow-x-auto">
        {['all', 'failed', 'active', 'scheduled', 'idle'].map((f) => (
          <button key={f} onClick={() => setFilter(f)} className={cn('px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap', filter === f ? 'bg-accent text-white' : 'text-text-secondary hover:text-text-primary')}>
            {t('irrigation.' + f)} {f === 'all' ? `(${zones.length})` : f === 'failed' ? `(${failedZones})` : ''}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">{[1, 2, 3].map((i) => <div key={i} className="h-40 rounded-lg bg-surface-card border border-border-default animate-pulse" />)}</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {sorted.map((zone) => {
            const cfg = statusConfig[zone.status];
            const hasMoisture = zone.moisture > 0;
            const moisturePct = hasMoisture ? Math.round((zone.moisture / zone.target_moisture) * 100) : 0;
            const needsAttention = (hasMoisture && moisturePct < 50) || zone.status === 'failed';
            return (
              <div key={zone.id} className={cn('rounded-lg border p-4 transition-colors', zone.status === 'active' ? 'bg-info-bg border-l-[3px] border-l-info-bright' : zone.status === 'failed' ? 'bg-critical-bg border-l-[3px] border-l-critical' : needsAttention ? 'bg-warning-bg border-l-[3px] border-l-warning' : 'bg-surface-card border-border-default')}>
                <div className="flex items-center justify-between mb-2">
                  <span className="font-semibold text-sm text-text-primary truncate">{zone.name}</span>
                  <div className="flex items-center gap-0.5 shrink-0">
                    <button
                      onClick={() => { setEditingZone(zone); setZoneFormOpen(true); }}
                      className="text-text-muted hover:text-text-primary min-h-[36px] min-w-[36px] flex items-center justify-center"
                      title={t('irrigation.editZone')}
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                    </button>
                    <button
                      onClick={() => setDeletingZoneId(zone.id)}
                      className="text-text-muted hover:text-critical min-h-[36px] min-w-[36px] flex items-center justify-center"
                      title={t('irrigation.deleteZone')}
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                    </button>
                    <span className={cn('text-xs font-medium px-2 py-0.5 rounded-full', cfg.color, cfg.bg)}>{t(`irrigation.${zone.status}`)}</span>
                  </div>
                </div>

                {/* Moisture bar with target indicator */}
                <div className="mb-3">
                  <div className="flex justify-between text-xs text-text-muted mb-1">
                    <span className={cn('font-medium', hasMoisture ? (moisturePct < 50 ? 'text-critical' : moisturePct < 80 ? 'text-warning' : 'text-success') : 'text-text-muted')}>{hasMoisture ? `${zone.moisture}%` : t('fields.noMoistureData')}</span>
                    <span>{t('irrigation.target')} {zone.target_moisture}%</span>
                  </div>
                  {hasMoisture && (
                    <div className="h-2.5 bg-surface-elevated rounded-full overflow-hidden">
                      <div className={cn('h-full rounded-full transition-all', moisturePct < 50 ? 'bg-critical' : moisturePct < 80 ? 'bg-warning' : 'bg-success')} style={{ width: `${moisturePct}%` }} />
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs text-text-muted">
                  <span>{t('irrigation.runtime', { minutes: zone.runtime_minutes })}</span>
                  <span>{t('irrigation.flow', { rate: zone.flow_rate_lpm })}</span>
                  {zone.device_name ? <span className="text-accent">{zone.device_name}</span> : zone.device_id ? <span className="text-accent">{t('fields.deviceNumber', { id: zone.device_id })}</span> : <span className="italic">{t('fields.noController')}</span>}
                </div>

                {/* Action buttons with loading state */}
                {zone.status === 'active' && (
                  <button onClick={() => handleStop(zone.id)} disabled={actionLoadingId === zone.id} className="mt-3 w-full py-2 rounded-md bg-critical/20 text-critical text-xs font-medium hover:bg-critical/30 transition-colors min-h-[44px] disabled:opacity-50 disabled:cursor-not-allowed">
                    {actionLoadingId === zone.id ? <span className="flex items-center justify-center gap-2"><span className="w-3 h-3 border-2 border-critical border-t-transparent rounded-full animate-spin" /> {t('irrigation.stopping')}</span> : t('irrigation.stopIrrigation')}
                  </button>
                )}
                {zone.status === 'failed' && (
                  <button onClick={() => handleRetry(zone.id)} disabled={actionLoadingId === zone.id} className="mt-3 w-full py-2 rounded-md bg-warning/20 text-warning text-xs font-medium hover:bg-warning/30 transition-colors min-h-[44px] disabled:opacity-50 disabled:cursor-not-allowed">
                    {actionLoadingId === zone.id ? <span className="flex items-center justify-center gap-2"><span className="w-3 h-3 border-2 border-warning border-t-transparent rounded-full animate-spin" /> {t('irrigation.retrying')}</span> : t('irrigation.retry')}
                  </button>
                )}
                {zone.status === 'scheduled' && (
                  <button onClick={() => handleStart(zone.id)} disabled={actionLoadingId === zone.id} className="mt-3 w-full py-2 rounded-md bg-accent/20 text-accent text-xs font-medium hover:bg-accent/30 transition-colors min-h-[44px] disabled:opacity-50 disabled:cursor-not-allowed">
                    {actionLoadingId === zone.id ? <span className="flex items-center justify-center gap-2"><span className="w-3 h-3 border-2 border-accent border-t-transparent rounded-full animate-spin" /> {t('irrigation.starting')}</span> : t('irrigation.startNow')}
                  </button>
                )}
                {zone.status === 'idle' && zone.device_id && (
                  <button onClick={() => handleStart(zone.id)} disabled={actionLoadingId === zone.id} className="mt-3 w-full py-2 rounded-md bg-accent/20 text-accent text-xs font-medium hover:bg-accent/30 transition-colors min-h-[44px] disabled:opacity-50 disabled:cursor-not-allowed">
                    {actionLoadingId === zone.id ? <span className="flex items-center justify-center gap-2"><span className="w-3 h-3 border-2 border-accent border-t-transparent rounded-full animate-spin" /> {t('irrigation.starting')}</span> : t('irrigation.startNow')}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Zone Form Modal */}
      <IrrigationZoneFormModal
        open={zoneFormOpen}
        onClose={() => { setZoneFormOpen(false); setEditingZone(null); }}
        onSaved={load}
        zone={editingZone}
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
                if (res.success) { toast('success', t('fields.zoneDeleted')); load(); }
                else { toast('error', res.error || t('fields.failedToDeleteZone')); }
                setDeletingZoneId(null);
              }} className="flex-1 py-2.5 rounded-lg bg-critical text-white text-sm font-medium hover:bg-critical/80 transition-colors min-h-[44px]">{t('common.delete')}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
