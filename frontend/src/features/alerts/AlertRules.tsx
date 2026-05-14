import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { DataTable } from '@/shared/components/DataTable';
import { Modal } from '@/shared/components/Modal';
import { toast } from '@/shared/components/Toast';
import { getAlertRules, createAlertRule, deleteAlertRule } from '@/features/alerts/api';
import { getDevices } from '@/features/devices/api';
import type { AlertRule, Device } from '@/shared/types/api';

const sensorTypes = [
  { id: 1, nameKey: 'alertRules.temperature' as const },
  { id: 2, nameKey: 'alertRules.humidity' as const },
  { id: 3, nameKey: 'alertRules.soilMoisture' as const },
  { id: 4, nameKey: 'alertRules.light' as const },
];

const emptyRule = {
  name: '', device_id: null as number | null, sensor_type_id: 1,
  condition: '>', threshold_value: '', duration_seconds: 300,
  severity: 'warning' as 'info' | 'warning' | 'critical', enabled: true,
};

export default function AlertRules() {
  const { t } = useTranslation();
  const [rules, setRules] = useState<AlertRule[]>([]);
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyRule);

  const load = async () => {
    setLoading(true);
    const [r, d] = await Promise.all([getAlertRules(), getDevices()]);
    if (r.success && r.data) setRules(r.data.rules || []);
    if (d.success && d.data) setDevices(d.data.devices || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const save = async () => {
    if (!form.name || !form.threshold_value) { setError(t('alertRules.nameAndThresholdRequired')); return; }
    setError('');
    const res = await createAlertRule({ ...form, threshold_value: parseFloat(form.threshold_value), duration_seconds: Number(form.duration_seconds), device_id: form.device_id });
    if (res.success) { toast('success', t('alertRules.saved')); setOpen(false); setForm(emptyRule); load(); }
    else setError(res.error || t('common.failedToSave'));
  };

  const remove = async (rule: AlertRule) => {
    if (!rule.id) return;
    const res = await deleteAlertRule(rule.id);
    if (res.success) { toast('success', t('alertRules.deleted')); load(); }
    else setError(res.error || t('common.failedToDelete'));
  };

  const severityColor = (s: string) => {
    switch (s) {
      case 'critical': return 'bg-critical-bg text-critical border-critical/30';
      case 'warning': return 'bg-warning-bg text-warning border-warning/30';
      default: return 'bg-info-bg text-info-bright border-info/30';
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-text-primary">{t('alertRules.title')}</h1>
          <p className="text-sm text-text-muted mt-0.5">{t('alertRules.subtitle')}</p>
        </div>
        <button onClick={() => { setForm(emptyRule); setOpen(true); }} className="px-3 py-2 rounded-lg bg-accent hover:bg-accent-hover text-white text-sm font-medium transition-colors">+ {t('alertRules.addRule')}</button>
      </div>

      {error && <div className="text-sm p-3 rounded-lg bg-critical-bg text-critical border border-critical/30">{error}</div>}

      {loading ? (
        <div className="space-y-2">{[1, 2, 3].map((i) => <div key={i} className="h-12 rounded-lg bg-surface-card border border-border-default animate-pulse" />)}</div>
      ) : (
        <DataTable
          columns={[
            { key: 'name', header: t('alertRules.ruleName') },
            { key: 'sensor', header: t('alertRules.sensorType'), render: (r: AlertRule) => t(sensorTypes.find((s) => s.id === r.sensor_type_id)?.nameKey || 'alertRules.unknown') },
            { key: 'condition', header: t('alertRules.condition'), render: (r: AlertRule) => `${r.condition} ${r.threshold_value} / ${r.duration_seconds}s` },
            { key: 'severity', header: t('alertRules.severity'), render: (r: AlertRule) => <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${severityColor(r.severity)}`}>{t(`alertRules.${r.severity}`)}</span> },
            { key: 'enabled', header: t('alertRules.active'), render: (r: AlertRule) => <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${r.enabled ? 'bg-success-bg text-success border-success/30' : 'bg-surface-hover text-text-muted border-border-default'}`}>{r.enabled ? t('alertRules.enabled') : t('alertRules.disabled')}</span> },
          ]}
          data={rules}
          keyExtractor={(r) => r.id ?? r.name}
          onDelete={remove}
          emptyMessage={t('alertRules.noRules')}
        />
      )}

      <Modal open={open} onClose={() => setOpen(false)} title={t('alertRules.alertRule')} actions={
        <><button onClick={() => setOpen(false)} className="px-4 py-2 rounded-lg text-sm text-text-secondary hover:text-text-primary hover:bg-surface-hover transition-colors">{t('alertRules.cancel')}</button><button onClick={save} className="px-4 py-2 rounded-lg bg-accent hover:bg-accent-hover text-white text-sm font-medium transition-colors">{t('alertRules.save')}</button></>
      }>
        <div>
          <label className="block text-xs font-medium text-text-secondary mb-1.5">{t('alertRules.ruleName')}</label>
          <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full px-3 py-2 rounded-lg bg-surface-base border border-border-default text-text-primary text-sm focus:outline-none focus:border-accent" />
        </div>
        <div>
          <label className="block text-xs font-medium text-text-secondary mb-1.5">{t('alertRules.device')}</label>
          <select value={form.device_id?.toString() || ''} onChange={(e) => setForm({ ...form, device_id: e.target.value ? Number(e.target.value) : null })} className="w-full px-3 py-2 rounded-lg bg-surface-base border border-border-default text-text-primary text-sm focus:outline-none focus:border-accent">
            <option value="">{t('alertRules.allDevices')}</option>
            {devices.map((d) => <option key={d.id} value={d.id}>{d.device_id} - {d.name}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-text-secondary mb-1.5">{t('alertRules.sensorType')}</label>
          <select value={form.sensor_type_id} onChange={(e) => setForm({ ...form, sensor_type_id: Number(e.target.value) })} className="w-full px-3 py-2 rounded-lg bg-surface-base border border-border-default text-text-primary text-sm focus:outline-none focus:border-accent">
            {sensorTypes.map((s) => <option key={s.id} value={s.id}>{t(s.nameKey)}</option>)}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1.5">{t('alertRules.condition')}</label>
            <select value={form.condition} onChange={(e) => setForm({ ...form, condition: e.target.value })} className="w-full px-3 py-2 rounded-lg bg-surface-base border border-border-default text-text-primary text-sm focus:outline-none focus:border-accent">
              <option value=">">&gt;</option>
              <option value="<">&lt;</option>
              <option value="=">=</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1.5">{t('alertRules.threshold')}</label>
            <input type="number" value={form.threshold_value} onChange={(e) => setForm({ ...form, threshold_value: e.target.value })} className="w-full px-3 py-2 rounded-lg bg-surface-base border border-border-default text-text-primary text-sm focus:outline-none focus:border-accent" />
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium text-text-secondary mb-1.5">{t('alertRules.durationSeconds')}</label>
          <input type="number" value={form.duration_seconds} onChange={(e) => setForm({ ...form, duration_seconds: Number(e.target.value) })} className="w-full px-3 py-2 rounded-lg bg-surface-base border border-border-default text-text-primary text-sm focus:outline-none focus:border-accent" />
        </div>
        <div>
          <label className="block text-xs font-medium text-text-secondary mb-1.5">{t('alertRules.severity')}</label>
          <select value={form.severity} onChange={(e) => setForm({ ...form, severity: e.target.value as 'info' | 'warning' | 'critical' })} className="w-full px-3 py-2 rounded-lg bg-surface-base border border-border-default text-text-primary text-sm focus:outline-none focus:border-accent">
            <option value="info">{t('alertRules.low')}</option>
            <option value="warning">{t('alertRules.medium')}</option>
            <option value="critical">{t('alertRules.high')}</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-text-secondary mb-1.5">{t('alertRules.status')}</label>
          <select value={String(form.enabled)} onChange={(e) => setForm({ ...form, enabled: e.target.value === 'true' })} className="w-full px-3 py-2 rounded-lg bg-surface-base border border-border-default text-text-primary text-sm focus:outline-none focus:border-accent">
            <option value="true">{t('alertRules.enabled')}</option>
            <option value="false">{t('alertRules.disabled')}</option>
          </select>
        </div>
      </Modal>
    </div>
  );
}
