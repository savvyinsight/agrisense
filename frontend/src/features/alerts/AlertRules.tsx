import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { DataTable } from '@/shared/components/DataTable';
import { Modal } from '@/shared/components/Modal';
import { toast } from '@/shared/components/Toast';
import { getAlertRules, createAlertRule, updateAlertRule, deleteAlertRule } from '@/features/alerts/api';
import { getFields } from '@/features/fields/api';
import { getDevices } from '@/features/devices/api';
import type { AlertRule, Device } from '@/shared/types/api';
import type { Field } from '@/shared/types';

const sensorTypes = [
  { id: 1, nameKey: 'alertRules.temperature' as const },
  { id: 2, nameKey: 'alertRules.humidity' as const },
  { id: 3, nameKey: 'alertRules.soilMoisture' as const },
  { id: 4, nameKey: 'alertRules.light' as const },
];

const conditions = [
  { value: '>', label: '>' },
  { value: '<', label: '<' },
  { value: '=', label: '=' },
  { value: '>=', label: '>=' },
  { value: '<=', label: '<=' },
  { value: 'between', label: 'between' },
];

const emptyRule = {
  name: '', device_id: null as number | null, field_id: null as number | null,
  sensor_type_id: 1, condition: '>', threshold_value: '', threshold_max: '',
  duration_seconds: 300, severity: 'warning' as 'info' | 'warning' | 'critical', enabled: true,
};

export default function AlertRules() {
  const { t } = useTranslation();
  const [rules, setRules] = useState<AlertRule[]>([]);
  const [devices, setDevices] = useState<Device[]>([]);
  const [fields, setFields] = useState<Field[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [open, setOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<AlertRule | null>(null);
  const [form, setForm] = useState(emptyRule);

  const resetForm = () => {
    setForm(emptyRule);
    setEditingRule(null);
    setError('');
  };

  const load = async () => {
    setLoading(true);
    const [r, d, f] = await Promise.all([getAlertRules(), getDevices(), getFields()]);
    if (r.success && r.data) setRules(r.data.rules || []);
    if (d.success && d.data) setDevices(d.data.devices || []);
    if (f.success && f.data) setFields(Array.isArray(f.data) ? f.data : []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const openCreate = () => {
    resetForm();
    setOpen(true);
  };

  const openEdit = (rule: AlertRule) => {
    setEditingRule(rule);
    setForm({
      name: rule.name,
      device_id: rule.device_id,
      field_id: (rule as any).field_id ?? null,
      sensor_type_id: rule.sensor_type_id,
      condition: rule.condition,
      threshold_value: String(rule.threshold_value ?? ''),
      threshold_max: '',
      duration_seconds: rule.duration_seconds,
      severity: rule.severity,
      enabled: rule.enabled,
    });
    setError('');
    setOpen(true);
  };

  const save = async () => {
    if (!form.name || !form.threshold_value) { setError(t('alertRules.nameAndThresholdRequired')); return; }
    setError('');

    const payload: any = {
      name: form.name,
      sensor_type_id: form.sensor_type_id,
      condition: form.condition,
      threshold_value: parseFloat(form.threshold_value),
      duration_seconds: Number(form.duration_seconds),
      severity: form.severity,
      enabled: form.enabled,
    };

    if (form.device_id) {
      payload.device_id = form.device_id;
      payload.field_id = null;
    } else if (form.field_id) {
      payload.field_id = form.field_id;
      payload.device_id = null;
    } else {
      payload.device_id = null;
      payload.field_id = null;
    }

    if (form.condition === 'between' && form.threshold_max) {
      payload.threshold_max = parseFloat(form.threshold_max);
    }

    let res;
    if (editingRule?.id) {
      res = await updateAlertRule(editingRule.id, payload);
    } else {
      res = await createAlertRule(payload);
    }

    if (res.success) {
      toast('success', editingRule ? t('alertRules.updated') : t('alertRules.saved'));
      setOpen(false);
      resetForm();
      load();
    } else {
      setError(res.error || t('common.failedToSave'));
    }
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
        <button onClick={openCreate} className="px-3 py-2 rounded-lg bg-accent hover:bg-accent-hover text-white text-sm font-medium transition-colors">+ {t('alertRules.addRule')}</button>
      </div>

      {error && <div className="text-sm p-3 rounded-lg bg-critical-bg text-critical border border-critical/30">{error}</div>}

      {loading ? (
        <div className="space-y-2">{[1, 2, 3].map((i) => <div key={i} className="h-12 rounded-lg bg-surface-card border border-border-default animate-pulse" />)}</div>
      ) : (
        <DataTable
          columns={[
            { key: 'name', header: t('alertRules.ruleName') },
            {
              key: 'sensor', header: t('alertRules.sensorType'),
              render: (r: AlertRule) => t(sensorTypes.find((s) => s.id === r.sensor_type_id)?.nameKey || 'alertRules.unknown'),
            },
            {
              key: 'condition', header: t('alertRules.condition'),
              render: (r: AlertRule) => {
                const val = typeof r.threshold_value === 'number' ? r.threshold_value : parseFloat(r.threshold_value as string);
                if (r.condition === 'between') {
                  return `between ${val} - ${(r as any).threshold_max ?? '?'}`;
                }
                return `${r.condition} ${val} / ${r.duration_seconds}s`;
              },
            },
            {
              key: 'severity', header: t('alertRules.severity'),
              render: (r: AlertRule) => <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${severityColor(r.severity)}`}>{t(`alertRules.${r.severity}`)}</span>,
            },
            {
              key: 'enabled', header: t('alertRules.active'),
              render: (r: AlertRule) => <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${r.enabled ? 'bg-success-bg text-success border-success/30' : 'bg-surface-hover text-text-muted border-border-default'}`}>{r.enabled ? t('alertRules.enabled') : t('alertRules.disabled')}</span>,
            },
          ]}
          data={rules}
          keyExtractor={(r) => r.id ?? r.name}
          onEdit={openEdit}
          onDelete={remove}
          emptyMessage={t('alertRules.noRules')}
        />
      )}

      <Modal open={open} onClose={() => { setOpen(false); resetForm(); }} title={editingRule ? t('alertRules.editRule') : t('alertRules.alertRule')} actions={
        <><button onClick={() => { setOpen(false); resetForm(); }} className="px-4 py-2 rounded-lg text-sm text-text-secondary hover:text-text-primary hover:bg-surface-hover transition-colors">{t('alertRules.cancel')}</button><button onClick={save} className="px-4 py-2 rounded-lg bg-accent hover:bg-accent-hover text-white text-sm font-medium transition-colors">{t('alertRules.save')}</button></>
      }>
        <div>
          <label className="block text-xs font-medium text-text-secondary mb-1.5">{t('alertRules.ruleName')}</label>
          <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full px-3 py-2 rounded-lg bg-surface-base border border-border-default text-text-primary text-sm focus:outline-none focus:border-accent" />
        </div>
        <div>
          <label className="block text-xs font-medium text-text-secondary mb-1.5">{t('alertRules.scope')}</label>
          <div className="grid grid-cols-2 gap-2">
            <select value={form.device_id?.toString() || ''} onChange={(e) => setForm({ ...form, device_id: e.target.value ? Number(e.target.value) : null, field_id: e.target.value ? null : form.field_id })} className="w-full px-3 py-2 rounded-lg bg-surface-base border border-border-default text-text-primary text-sm focus:outline-none focus:border-accent">
              <option value="">{t('alertRules.deviceNone')}</option>
              {devices.map((d) => <option key={d.id} value={d.id}>{d.device_id} - {d.name}</option>)}
            </select>
            <select value={form.field_id?.toString() || ''} onChange={(e) => setForm({ ...form, field_id: e.target.value ? Number(e.target.value) : null, device_id: e.target.value ? null : form.device_id })} className="w-full px-3 py-2 rounded-lg bg-surface-base border border-border-default text-text-primary text-sm focus:outline-none focus:border-accent">
              <option value="">{t('alertRules.fieldNone')}</option>
              {fields.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
            </select>
          </div>
          <p className="text-[10px] text-text-muted mt-1">{t('alertRules.scopeHint')}</p>
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
              {conditions.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1.5">{t('alertRules.threshold')}</label>
            <input type="number" value={form.threshold_value} onChange={(e) => setForm({ ...form, threshold_value: e.target.value })} className="w-full px-3 py-2 rounded-lg bg-surface-base border border-border-default text-text-primary text-sm focus:outline-none focus:border-accent" />
          </div>
        </div>
        {form.condition === 'between' && (
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1.5">{t('alertRules.thresholdMax')}</label>
            <input type="number" value={form.threshold_max} onChange={(e) => setForm({ ...form, threshold_max: e.target.value })} className="w-full px-3 py-2 rounded-lg bg-surface-base border border-border-default text-text-primary text-sm focus:outline-none focus:border-accent" />
          </div>
        )}
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
