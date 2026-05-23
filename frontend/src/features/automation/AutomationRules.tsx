import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { DataTable } from '@/shared/components/DataTable';
import { Modal } from '@/shared/components/Modal';
import { CommandStatusStepper } from '@/shared/components/CommandStatusStepper';
import { CommandHistoryModal } from '@/features/automation/CommandHistoryModal';
import { toast } from '@/shared/components/Toast';
import {
  getAutomationRules, createAutomationRule, updateAutomationRule,
  deleteAutomationRule, pauseAutomationRule, resumeAutomationRule, runAutomationRuleNow,
} from '@/features/automation/api';
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
  schedule_cron: '', timezone: 'UTC',
  action_command: 'turn_on', action_parameters: { duration: 300, power: 100 }, enabled: true,
};

const commonTimezones = [
  'UTC', 'America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles',
  'Europe/London', 'Europe/Paris', 'Europe/Berlin', 'Asia/Tokyo', 'Asia/Shanghai',
  'Asia/Kolkata', 'Australia/Sydney',
];

const weekDays = [
  { value: '*', label: 'Every day' },
  { value: '1-5', label: 'Weekdays' },
  { value: '0,6', label: 'Weekends' },
  { value: '0', label: 'Sun' },
  { value: '1', label: 'Mon' },
  { value: '2', label: 'Tue' },
  { value: '3', label: 'Wed' },
  { value: '4', label: 'Thu' },
  { value: '5', label: 'Fri' },
  { value: '6', label: 'Sat' },
];

function parseCron(cron: string) {
  const parts = (cron || '* * * * *').split(' ');
  return { minute: parts[0] || '*', hour: parts[1] || '*', day: parts[2] || '*', month: parts[3] || '*', weekday: parts[4] || '*' };
}

function buildCron(minute: string, hour: string, day: string, month: string, weekday: string) {
  return `${minute} ${hour} ${day} ${month} ${weekday}`;
}

function describeCron(cron: string): string {
  if (!cron) return '';
  const p = parseCron(cron);
  const parts: string[] = [];
  if (p.minute === '*') parts.push('every minute');
  else if (p.minute.startsWith('*/')) parts.push(`every ${p.minute.slice(2)} minutes`);
  else parts.push(`at minute ${p.minute}`);
  if (p.hour === '*') parts.push('every hour');
  else if (p.hour.startsWith('*/')) parts.push(`every ${p.hour.slice(2)} hours`);
  else parts.push(`at hour ${p.hour}`);
  if (p.weekday !== '*') {
    const dayName = weekDays.find((w) => w.value === p.weekday);
    parts.push(dayName ? `on ${dayName.label}` : `on day ${p.weekday}`);
  }
  return parts.join(', ');
}

function timeAgo(dateStr: string | null | undefined): string {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function AutomationRules() {
  const { t } = useTranslation();
  const [rules, setRules] = useState<AutomationRule[]>([]);
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [open, setOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<AutomationRule | null>(null);
  const [form, setForm] = useState(emptyRule);
  const [runningId, setRunningId] = useState<number | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AutomationRule | null>(null);
  const [historyRule, setHistoryRule] = useState<AutomationRule | null>(null);

  const load = async () => {
    setLoading(true);
    const [r, d] = await Promise.all([getAutomationRules(), getDevices()]);
    if (r.success) setRules(r.data?.rules || []);
    if (d.success) setDevices(d.data?.devices || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const resetForm = () => {
    setForm(emptyRule);
    setEditingRule(null);
    setError('');
  };

  const openCreate = () => {
    resetForm();
    setOpen(true);
  };

  const openEdit = (rule: AutomationRule) => {
    setEditingRule(rule);
    setForm({
      name: rule.name,
      target_device_id: rule.target_device_id,
      trigger_type: rule.trigger_type || 'sensor',
      trigger_sensor_type_id: rule.trigger_sensor_type_id,
      trigger_condition: rule.trigger_condition,
      trigger_value: String(rule.trigger_value ?? ''),
      trigger_duration_seconds: rule.trigger_duration_seconds,
      schedule_cron: rule.schedule_cron || '',
      timezone: rule.timezone || 'UTC',
      action_command: rule.action_command,
      action_parameters: {
        duration: Number((rule.action_parameters as Record<string, unknown>)?.duration ?? 300),
        power: Number((rule.action_parameters as Record<string, unknown>)?.power ?? 100),
      },
      enabled: rule.enabled,
    });
    setOpen(true);
  };

  const save = async () => {
    if (!form.name) { setError(t('automation.validationError')); return; }
    if (form.trigger_type === 'sensor' && !form.trigger_value) { setError(t('automation.validationError')); return; }
    setError('');
    const payload: any = {
      ...form,
      trigger_value: form.trigger_type === 'sensor' ? parseFloat(form.trigger_value) : 0,
      trigger_duration_seconds: Number(form.trigger_duration_seconds),
      target_device_id: Number(form.target_device_id),
      action_parameters: {
        ...form.action_parameters,
        duration: Number(form.action_parameters.duration),
        power: Number(form.action_parameters.power),
      },
    };
    if (form.trigger_type === 'schedule') {
      payload.schedule_cron = form.schedule_cron || buildCron('*', '*', '*', '*', '*');
      payload.timezone = form.timezone;
    } else {
      payload.schedule_cron = null;
    }
    const res = editingRule?.id
      ? await updateAutomationRule(editingRule.id, payload)
      : await createAutomationRule(payload);
    if (res.success) {
      toast('success', editingRule ? t('automation.updated') : t('automation.saved'));
      setOpen(false);
      resetForm();
      load();
    } else {
      setError(res.error || t('common.failedToSave'));
    }
  };

  const remove = async () => {
    if (!deleteTarget?.id) return;
    const res = await deleteAutomationRule(deleteTarget.id);
    if (res.success) { toast('success', t('automation.deleted')); setDeleteTarget(null); load(); }
    else toast('error', res.error || t('common.failedToDelete'));
  };

  const togglePause = async (rule: AutomationRule) => {
    if (!rule.id) return;
    const fn = rule.paused ? resumeAutomationRule : pauseAutomationRule;
    const res = await fn(rule.id);
    if (res.success) { toast('success', rule.paused ? t('automation.resume') : t('automation.pause')); load(); }
    else toast('error', res.error || (rule.paused ? t('automation.resumeFailed') : t('automation.pauseFailed')));
  };

  const handleRunNow = async (rule: AutomationRule) => {
    if (!rule.id) return;
    setRunningId(rule.id);
    const res = await runAutomationRuleNow(rule.id);
    if (res.success) toast('success', t('automation.runNowSuccess'));
    else toast('error', res.error || t('automation.runNowFailed'));
    setRunningId(null);
  };

  const getDeviceLabel = (id: number) => {
    const d = devices.find((dev) => dev.id === id);
    return d ? `${d.device_id} - ${d.name}` : t('automation.allDevices');
  };

  const getModeBadge = (rule: AutomationRule) => {
    if (!rule.enabled) return { label: t('automation.modeManual'), cls: 'bg-surface-hover text-text-muted border-border-default' };
    if (rule.paused) return { label: t('automation.modePaused'), cls: 'bg-warning-bg text-warning border-warning/30' };
    return { label: t('automation.modeAuto'), cls: 'bg-success-bg text-success border-success/30' };
  };

  const cronParts = parseCron(form.schedule_cron);

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-text-primary">{t('automation.title')}</h1>
          <p className="text-sm text-text-muted mt-0.5">{t('automation.subtitle')}</p>
        </div>
        <button onClick={openCreate} className="px-3 py-2 rounded-lg bg-accent hover:bg-accent-hover text-white text-sm font-medium transition-colors">+ {t('automation.addRule')}</button>
      </div>

      {error && <div className="text-sm p-3 rounded-lg bg-critical-bg text-critical border border-critical/30">{error}</div>}

      {loading ? (
        <div className="space-y-2">{[1, 2, 3].map((i) => <div key={i} className="h-12 rounded-lg bg-surface-card border border-border-default animate-pulse" />)}</div>
      ) : (
        <DataTable
          columns={[
            { key: 'mode', header: '', render: (r: AutomationRule) => {
              const m = getModeBadge(r);
              return <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full border ${m.cls}`}>{m.label}</span>;
            }},
            { key: 'name', header: t('common.name') },
            { key: 'device', header: t('automation.targetDevice'), render: (r: AutomationRule) => getDeviceLabel(r.target_device_id) },
            { key: 'trigger', header: t('automation.trigger'), render: (r: AutomationRule) => {
              if (r.trigger_type === 'schedule') return `${t('automation.schedule')}: ${r.schedule_cron || '* * * * *'}`;
              return `${t(sensorTypes.find((s) => s.id === r.trigger_sensor_type_id)?.nameKey || 'automation.unknownSensor')} ${r.trigger_condition} ${r.trigger_value}${r.trigger_duration_seconds > 0 ? ` / ${r.trigger_duration_seconds}s` : ''}`;
            }},
            { key: 'action', header: t('automation.action'), render: (r: AutomationRule) => t(cmds.find((c) => c.value === r.action_command)?.labelKey || 'automation.turnOn') },
            { key: 'lastTriggered', header: t('automation.lastTriggered'), render: (r: AutomationRule) => (
              <span className="text-xs text-text-muted">{r.last_triggered_at ? timeAgo(r.last_triggered_at) : t('automation.neverTriggered')}</span>
            )},
            { key: 'lastStatus', header: t('automation.lastStatus'), render: (r: AutomationRule) => (
              <CommandStatusStepper status={r.last_command_status} />
            )},
          ]}
          data={rules}
          keyExtractor={(r) => String(r.id ?? r.name)}
          onEdit={openEdit}
          onDelete={(r) => setDeleteTarget(r)}
          renderActions={(r: AutomationRule) => (
            <div className="flex items-center gap-1">
              <button
                onClick={() => togglePause(r)}
                className={`px-2 py-1 text-xs rounded border transition-colors ${r.paused ? 'bg-success-bg text-success border-success/30 hover:bg-success/20' : 'bg-warning-bg text-warning border-warning/30 hover:bg-warning/20'}`}
                title={r.paused ? t('automation.resume') : t('automation.pause')}
              >
                {r.paused ? '▶' : '⏸'}
              </button>
              <button
                onClick={() => handleRunNow(r)}
                disabled={runningId === r.id}
                className="px-2 py-1 text-xs rounded border bg-accent/10 text-accent border-accent/30 hover:bg-accent/20 transition-colors disabled:opacity-50"
                title={t('automation.runNow')}
              >
                {runningId === r.id ? <span className="inline-block w-3 h-3 border-2 border-accent border-t-transparent rounded-full animate-spin" /> : '▶▶'}
              </button>
              {r.id && (
                <button
                  onClick={() => setHistoryRule(r)}
                  className="px-2 py-1 text-xs rounded border bg-surface-hover text-text-muted border-border-default hover:text-text-secondary transition-colors"
                  title={t('automation.commandHistory')}
                >
                  📋
                </button>
              )}
            </div>
          )}
          emptyMessage={t('automation.noRulesFound')}
        />
      )}

      {/* Create / Edit Modal */}
      <Modal open={open} onClose={() => { setOpen(false); resetForm(); }} title={editingRule ? t('automation.editRule') : t('automation.addRule')} actions={
        <><button onClick={() => { setOpen(false); resetForm(); }} className="px-4 py-2 rounded-lg text-sm text-text-secondary hover:text-text-primary hover:bg-surface-hover transition-colors">{t('automation.cancel')}</button><button onClick={save} className="px-4 py-2 rounded-lg bg-accent hover:bg-accent-hover text-white text-sm font-medium transition-colors">{t('automation.save')}</button></>
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

        {/* Trigger Type Selector */}
        <div className="pt-2">
          <label className="block text-xs font-medium text-text-secondary mb-1.5">{t('automation.triggerType')}</label>
          <div className="flex gap-2">
            <button type="button" onClick={() => setForm({ ...form, trigger_type: 'sensor' })} className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium border transition-colors ${form.trigger_type === 'sensor' ? 'bg-accent/15 text-accent border-accent/40' : 'bg-surface-base text-text-muted border-border-default hover:text-text-secondary'}`}>
              {t('automation.sensorTrigger')}
            </button>
            <button type="button" onClick={() => setForm({ ...form, trigger_type: 'schedule' })} className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium border transition-colors ${form.trigger_type === 'schedule' ? 'bg-accent/15 text-accent border-accent/40' : 'bg-surface-base text-text-muted border-border-default hover:text-text-secondary'}`}>
              {t('automation.scheduleTrigger')}
            </button>
          </div>
        </div>

        {/* Sensor Trigger Fields */}
        {form.trigger_type === 'sensor' && (
          <>
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
          </>
        )}

        {/* Schedule Trigger Fields */}
        {form.trigger_type === 'schedule' && (
          <>
            <div className="text-sm font-medium text-text-secondary pt-2">{t('automation.schedule')}</div>
            <div className="grid grid-cols-5 gap-2">
              <div>
                <label className="block text-[10px] font-medium text-text-muted mb-1">{t('automation.cronMinute')}</label>
                <select value={cronParts.minute} onChange={(e) => setForm({ ...form, schedule_cron: buildCron(e.target.value, cronParts.hour, cronParts.day, cronParts.month, cronParts.weekday) })} className="w-full px-2 py-1.5 rounded-lg bg-surface-base border border-border-default text-text-primary text-xs focus:outline-none focus:border-accent">
                  <option value="*">*</option>
                  {[0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55].map((m) => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-medium text-text-muted mb-1">{t('automation.cronHour')}</label>
                <select value={cronParts.hour} onChange={(e) => setForm({ ...form, schedule_cron: buildCron(cronParts.minute, e.target.value, cronParts.day, cronParts.month, cronParts.weekday) })} className="w-full px-2 py-1.5 rounded-lg bg-surface-base border border-border-default text-text-primary text-xs focus:outline-none focus:border-accent">
                  <option value="*">*</option>
                  {Array.from({ length: 24 }, (_, i) => <option key={i} value={i}>{i}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-medium text-text-muted mb-1">{t('automation.cronDay')}</label>
                <select value={cronParts.day} onChange={(e) => setForm({ ...form, schedule_cron: buildCron(cronParts.minute, cronParts.hour, e.target.value, cronParts.month, cronParts.weekday) })} className="w-full px-2 py-1.5 rounded-lg bg-surface-base border border-border-default text-text-primary text-xs focus:outline-none focus:border-accent">
                  <option value="*">*</option>
                  {Array.from({ length: 31 }, (_, i) => <option key={i + 1} value={i + 1}>{i + 1}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-medium text-text-muted mb-1">{t('automation.cronMonth')}</label>
                <select value={cronParts.month} onChange={(e) => setForm({ ...form, schedule_cron: buildCron(cronParts.minute, cronParts.hour, cronParts.day, e.target.value, cronParts.weekday) })} className="w-full px-2 py-1.5 rounded-lg bg-surface-base border border-border-default text-text-primary text-xs focus:outline-none focus:border-accent">
                  <option value="*">*</option>
                  {Array.from({ length: 12 }, (_, i) => <option key={i + 1} value={i + 1}>{i + 1}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-medium text-text-muted mb-1">{t('automation.cronWeekday')}</label>
                <select value={cronParts.weekday} onChange={(e) => setForm({ ...form, schedule_cron: buildCron(cronParts.minute, cronParts.hour, cronParts.day, cronParts.month, e.target.value) })} className="w-full px-2 py-1.5 rounded-lg bg-surface-base border border-border-default text-text-primary text-xs focus:outline-none focus:border-accent">
                  {weekDays.map((w) => <option key={w.value} value={w.value}>{w.label}</option>)}
                </select>
              </div>
            </div>
            <div className="text-xs text-text-muted bg-surface-base rounded-lg px-3 py-2 border border-border-default">
              <span className="font-medium">{t('automation.cronGenerated')}:</span> <code className="text-accent">{form.schedule_cron || '* * * * *'}</code>
              <span className="ml-2 text-text-muted">— {describeCron(form.schedule_cron || '* * * * *')}</span>
            </div>
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1.5">{t('automation.timezone')}</label>
              <select value={form.timezone} onChange={(e) => setForm({ ...form, timezone: e.target.value })} className="w-full px-3 py-2 rounded-lg bg-surface-base border border-border-default text-text-primary text-sm focus:outline-none focus:border-accent">
                {commonTimezones.map((tz) => <option key={tz} value={tz}>{tz}</option>)}
              </select>
            </div>
          </>
        )}

        {/* Action Fields */}
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

      {/* Delete Confirmation Modal */}
      <Modal open={deleteTarget !== null} onClose={() => setDeleteTarget(null)} title={t('automation.deleteRule')} actions={
        <><button onClick={() => setDeleteTarget(null)} className="px-4 py-2 rounded-lg text-sm text-text-secondary hover:text-text-primary hover:bg-surface-hover transition-colors">{t('automation.cancel')}</button><button onClick={remove} className="px-4 py-2 rounded-lg bg-critical hover:bg-critical-hover text-white text-sm font-medium transition-colors">{t('common.delete')}</button></>
      }>
        <div className="text-center py-2">
          <span className="text-3xl block mb-3">⚠️</span>
          <p className="text-sm text-text-secondary">{t('automation.confirmDelete')}</p>
          {deleteTarget && <p className="text-sm font-medium text-text-primary mt-1">{deleteTarget.name}</p>}
        </div>
      </Modal>

      {/* Command History Modal */}
      {historyRule?.id && (
        <CommandHistoryModal
          open={historyRule !== null}
          onClose={() => setHistoryRule(null)}
          ruleId={historyRule.id}
          ruleName={historyRule.name}
        />
      )}
    </div>
  );
}
