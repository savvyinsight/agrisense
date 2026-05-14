import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { DataTable } from '@/shared/components/DataTable';
import { Modal } from '@/shared/components/Modal';
import { toast } from '@/shared/components/Toast';
import { getAutomationRules, createAutomationRule, deleteAutomationRule } from '@/features/automation/api';
import { getDevices } from '@/features/devices/api';
import type { AutomationRule, Device } from '@/shared/types/api';

const sensorTypes = [
  { id: 1, nameKey: 'alertRules.temperature' as const },
  { id: 2, nameKey: 'alertRules.humidity' as const },
  { id: 3, nameKey: 'alertRules.soilMoisture' as const },
  { id: 4, nameKey: 'alertRules.light' as const },
];

const cmds = [
  { value: 'turn_on', labelKey: 'automation.turnOn' as const },
  { value: 'turn_off', labelKey: 'automation.turnOff' as const },
  { value: 'set_power', labelKey: 'automation.setPower' as const },
];

const emptyRule = {
  name: '', target_device_id: 0, trigger_type: 'sensor',
  trigger_sensor_type_id: 1, trigger_condition: '>',
  trigger_value: '', trigger_duration_seconds: 60,
  action_command: 'turn_on', action_parameters: { duration: 300, power: 100 }, enabled: true,
};

export default function AutomationRules() {
  const { t } = useTranslation();
  const [rules, setRules] = useState<AutomationRule[]>([]);
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyRule);

  const load = async () => {
    setLoading(true);
    const [r, d] = await Promise.all([getAutomationRules(), getDevices()]);
    if (r.success) setRules(r.data?.rules || []);
    if (d.success) setDevices(d.data?.devices || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const save = async () => {
    if (!form.name || !form.trigger_value) { setError(t('automation.validationError')); return; }
    setError('');
    const payload = { ...form, trigger_value: parseFloat(form.trigger_value), trigger_duration_seconds: Number(form.trigger_duration_seconds), target_device_id: Number(form.target_device_id), action_parameters: { ...form.action_parameters, duration: Number(form.action_parameters.duration), power: Number(form.action_parameters.power) } };
    const res = await createAutomationRule(payload);
    if (res.success) { toast('success', t('automation.saved')); setOpen(false); setForm(emptyRule); load(); }
    else setError(res.error || t('common.failedToSave'));
  };

  const remove = async (rule: AutomationRule) => {
    if (!rule.id) return;
    const res = await deleteAutomationRule(rule.id);
    if (res.success) { toast('success', t('automation.deleted')); load(); }
  };

  const getLabel = (id: number) => devices.find((d) => d.id === id);

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-text-primary">{t('automation.title')}</h1>
          <p className="text-sm text-text-muted mt-0.5">{t('automation.subtitle')}</p>
        </div>
        <button onClick={() => { setForm(emptyRule); setOpen(true); }} className="px-3 py-2 rounded-lg bg-accent hover:bg-accent-hover text-white text-sm font-medium transition-colors">+ {t('automation.addRule')}</button>
      </div>

      {error && <div className="text-sm p-3 rounded-lg bg-critical-bg text-critical border border-critical/30">{error}</div>}

      {loading ? (
        <div className="space-y-2">{[1, 2, 3].map((i) => <div key={i} className="h-12 rounded-lg bg-surface-card border border-border-default animate-pulse" />)}</div>
      ) : (
        <DataTable
          columns={[
            { key: 'name', header: t('common.name') },
            { key: 'device', header: t('automation.targetDevice'), render: (r: AutomationRule) => { const d = getLabel(r.target_device_id); return d ? `${d.device_id} - ${d.name}` : t('automation.allDevices'); }},
            { key: 'trigger', header: t('automation.trigger'), render: (r: AutomationRule) => `${t(sensorTypes.find((s) => s.id === r.trigger_sensor_type_id)?.nameKey || 'automation.unknownSensor')} ${r.trigger_condition} ${r.trigger_value}${r.trigger_duration_seconds > 0 ? ` / ${r.trigger_duration_seconds}s` : ''}` },
            { key: 'action', header: t('automation.action'), render: (r: AutomationRule) => t(cmds.find((c) => c.value === r.action_command)?.labelKey || 'automation.turnOn') },
            { key: 'enabled', header: t('automation.enabled'), render: (r: AutomationRule) => <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${r.enabled ? 'bg-success-bg text-success border-success/30' : 'bg-surface-hover text-text-muted border-border-default'}`}>{r.enabled ? t('automation.enabled') : t('automation.disabled')}</span> },
          ]}
          data={rules}
          keyExtractor={(r) => r.id ?? r.name}
          onDelete={remove}
          emptyMessage={t('automation.noRulesFound')}
        />
      )}

      <Modal open={open} onClose={() => setOpen(false)} title={t('automation.addRule')} actions={
        <><button onClick={() => setOpen(false)} className="px-4 py-2 rounded-lg text-sm text-text-secondary hover:text-text-primary hover:bg-surface-hover transition-colors">{t('automation.cancel')}</button><button onClick={save} className="px-4 py-2 rounded-lg bg-accent hover:bg-accent-hover text-white text-sm font-medium transition-colors">{t('automation.save')}</button></>
      }>
        <div>
          <label className="block text-xs font-medium text-text-secondary mb-1.5">{t('automation.ruleName')}</label>
          <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full px-3 py-2 rounded-lg bg-surface-base border border-border-default text-text-primary text-sm focus:outline-none focus:border-accent" />
        </div>
        <div>
          <label className="block text-xs font-medium text-text-secondary mb-1.5">{t('automation.targetDevice')}</label>
          <select value={form.target_device_id} onChange={(e) => setForm({ ...form, target_device_id: Number(e.target.value) })} className="w-full px-3 py-2 rounded-lg bg-surface-base border border-border-default text-text-primary text-sm focus:outline-none focus:border-accent">
            <option value={0}>{t('automation.allDevices')}</option>
            {devices.map((d) => <option key={d.id} value={d.id}>{d.device_id} — {d.name}</option>)}
          </select>
        </div>
        <div className="text-sm font-medium text-text-secondary pt-2">{t('automation.triggerConditions')}</div>
        <div>
          <label className="block text-xs font-medium text-text-secondary mb-1.5">{t('automation.sensorType')}</label>
          <select value={form.trigger_sensor_type_id} onChange={(e) => setForm({ ...form, trigger_sensor_type_id: Number(e.target.value) })} className="w-full px-3 py-2 rounded-lg bg-surface-base border border-border-default text-text-primary text-sm focus:outline-none focus:border-accent">
            {sensorTypes.map((s) => <option key={s.id} value={s.id}>{t(s.nameKey)}</option>)}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1.5">{t('automation.condition')}</label>
            <select value={form.trigger_condition} onChange={(e) => setForm({ ...form, trigger_condition: e.target.value })} className="w-full px-3 py-2 rounded-lg bg-surface-base border border-border-default text-text-primary text-sm focus:outline-none focus:border-accent">
              <option value={'>'}>&gt;</option>
              <option value={'<'}>&lt;</option>
              <option value="=">=</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1.5">{t('automation.threshold')}</label>
            <input type="number" value={form.trigger_value} onChange={(e) => setForm({ ...form, trigger_value: e.target.value })} className="w-full px-3 py-2 rounded-lg bg-surface-base border border-border-default text-text-primary text-sm focus:outline-none focus:border-accent" />
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium text-text-secondary mb-1.5">{t('automation.durationSeconds')}</label>
          <input type="number" value={form.trigger_duration_seconds} onChange={(e) => setForm({ ...form, trigger_duration_seconds: Number(e.target.value) })} className="w-full px-3 py-2 rounded-lg bg-surface-base border border-border-default text-text-primary text-sm focus:outline-none focus:border-accent" />
        </div>
        <div className="text-sm font-medium text-text-secondary pt-2">{t('automation.actionHeading')}</div>
        <div>
          <label className="block text-xs font-medium text-text-secondary mb-1.5">{t('automation.action')}</label>
          <select value={form.action_command} onChange={(e) => setForm({ ...form, action_command: e.target.value })} className="w-full px-3 py-2 rounded-lg bg-surface-base border border-border-default text-text-primary text-sm focus:outline-none focus:border-accent">
            {cmds.map((c) => <option key={c.value} value={c.value}>{t(c.labelKey)}</option>)}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1.5">{t('automation.durationS')}</label>
            <input type="number" value={form.action_parameters.duration} onChange={(e) => setForm({ ...form, action_parameters: { ...form.action_parameters, duration: Number(e.target.value) } })} className="w-full px-3 py-2 rounded-lg bg-surface-base border border-border-default text-text-primary text-sm focus:outline-none focus:border-accent" />
          </div>
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1.5">{t('automation.powerPct')}</label>
            <input type="number" value={form.action_parameters.power} onChange={(e) => setForm({ ...form, action_parameters: { ...form.action_parameters, power: Number(e.target.value) } })} className="w-full px-3 py-2 rounded-lg bg-surface-base border border-border-default text-text-primary text-sm focus:outline-none focus:border-accent" />
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium text-text-secondary mb-1.5">{t('automation.status')}</label>
          <select value={String(form.enabled)} onChange={(e) => setForm({ ...form, enabled: e.target.value === 'true' })} className="w-full px-3 py-2 rounded-lg bg-surface-base border border-border-default text-text-primary text-sm focus:outline-none focus:border-accent">
            <option value="true">{t('automation.enabled')}</option>
            <option value="false">{t('automation.disabled')}</option>
          </select>
        </div>
      </Modal>
    </div>
  );
}
