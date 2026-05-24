import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { DataTable } from '@/shared/components/DataTable';
import { Modal } from '@/shared/components/Modal';
import { toast } from '@/shared/components/Toast';
import type { EscalationRule, EscalationLevel, NotificationChannel } from '@/shared/types/api';
import { getEscalationRules, createEscalationRule, updateEscalationRule, deleteEscalationRule } from '@/features/alerts/escalationApi';
import { getNotificationSettings } from '@/features/settings/notificationApi';

const severityColors: Record<string, string> = {
  info: 'bg-accent/15 text-accent',
  warning: 'bg-warning/15 text-warning',
  critical: 'bg-critical/15 text-critical',
};

export default function EscalationRules() {
  const { t } = useTranslation();

  const [rules, setRules] = useState<EscalationRule[]>([]);
  const [channels, setChannels] = useState<NotificationChannel[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [editingRule, setEditingRule] = useState<EscalationRule | null>(null);
  const [name, setName] = useState('');
  const [triggerSeverity, setTriggerSeverity] = useState<'info' | 'warning' | 'critical'>('critical');
  const [levels, setLevels] = useState<EscalationLevel[]>([{ delay_minutes: 15, severity: 'warning', channel_ids: [] }]);
  const [enabled, setEnabled] = useState(true);
  const [saving, setSaving] = useState(false);

  // Delete confirmation
  const [deleteTarget, setDeleteTarget] = useState<EscalationRule | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [rulesRes, settingsRes] = await Promise.all([getEscalationRules(), getNotificationSettings()]);
    if (rulesRes.success && rulesRes.data) setRules(rulesRes.data.rules || []);
    if (settingsRes.success && settingsRes.data) setChannels(settingsRes.data.channels || []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const resetForm = () => {
    setEditingRule(null);
    setName('');
    setTriggerSeverity('critical');
    setLevels([{ delay_minutes: 15, severity: 'warning', channel_ids: [] }]);
    setEnabled(true);
  };

  const openAdd = () => {
    resetForm();
    setShowModal(true);
  };

  const openEdit = (rule: EscalationRule) => {
    setEditingRule(rule);
    setName(rule.name);
    setTriggerSeverity(rule.trigger_severity);
    const ruleLevels = rule.levels || [];
    setLevels(ruleLevels.length > 0 ? ruleLevels.map((l) => ({ ...l })) : [{ delay_minutes: 15, severity: 'warning', channel_ids: [] }]);
    setEnabled(rule.enabled);
    setShowModal(true);
  };

  const addLevel = () => {
    setLevels([...levels, { delay_minutes: 30, severity: 'critical', channel_ids: [] }]);
  };

  const removeLevel = (idx: number) => {
    setLevels(levels.filter((_, i) => i !== idx));
  };

  const updateLevel = (idx: number, updates: Partial<EscalationLevel>) => {
    setLevels(levels.map((l, i) => i === idx ? { ...l, ...updates } : l));
  };

  const toggleLevelChannel = (levelIdx: number, channelId: number) => {
    const level = levels[levelIdx];
    const ids = level.channel_ids.includes(channelId)
      ? level.channel_ids.filter((id) => id !== channelId)
      : [...level.channel_ids, channelId];
    updateLevel(levelIdx, { channel_ids: ids });
  };

  const handleSave = async () => {
    if (!name.trim() || levels.length === 0) return;
    setSaving(true);
    const payload = { name: name.trim(), trigger_severity: triggerSeverity, levels, enabled };
    const res = editingRule
      ? await updateEscalationRule(editingRule.id, payload)
      : await createEscalationRule(payload);
    if (res.success) {
      toast('success', editingRule ? t('escalation.updated') : t('escalation.created'));
      setShowModal(false);
      resetForm();
      load();
    } else {
      toast('error', res.error || t('common.failedToSave'));
    }
    setSaving(false);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    const res = await deleteEscalationRule(deleteTarget.id);
    if (res.success) {
      toast('success', t('escalation.deleted'));
      setDeleteTarget(null);
      load();
    } else {
      toast('error', res.error || t('common.failedToDelete'));
    }
  };

  const handleToggle = async (rule: EscalationRule) => {
    const res = await updateEscalationRule(rule.id, { enabled: !rule.enabled });
    if (res.success) load();
  };

  const columns = [
    {
      key: 'name',
      header: t('escalation.ruleName'),
      render: (rule: EscalationRule) => <span className="font-medium">{rule.name}</span>,
    },
    {
      key: 'trigger_severity',
      header: t('escalation.triggerSeverity'),
      render: (rule: EscalationRule) => (
        <span className={`px-2 py-0.5 rounded text-xs font-medium capitalize ${severityColors[rule.trigger_severity] || ''}`}>
          {t(`common.${rule.trigger_severity}`)}
        </span>
      ),
    },
    {
      key: 'levels',
      header: t('escalation.levels'),
      render: (rule: EscalationRule) => (
        <span className="text-text-secondary">{(rule.levels || []).length} {(rule.levels || []).length === 1 ? t('escalation.level') : t('escalation.levels')}</span>
      ),
    },
    {
      key: 'enabled',
      header: t('common.status'),
      render: (rule: EscalationRule) => (
        <span className={`px-2 py-0.5 rounded text-xs font-medium ${rule.enabled ? 'bg-success/15 text-success' : 'bg-surface-hover text-text-muted'}`}>
          {rule.enabled ? t('common.enabled') : t('common.disabled')}
        </span>
      ),
    },
  ];

  if (loading) {
    return <div className="text-sm text-text-muted">{t('common.loading')}</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-text-primary">{t('escalation.title')}</h1>
          <p className="text-sm text-text-muted mt-0.5">{t('escalation.subtitle')}</p>
        </div>
        <button onClick={openAdd} className="px-4 py-2 rounded-lg bg-accent text-white text-sm font-medium hover:bg-accent/90 transition-colors min-h-[44px]">
          + {t('escalation.addRule')}
        </button>
      </div>

      <DataTable
        columns={columns}
        data={rules}
        keyExtractor={(r) => r.id}
        onEdit={openEdit}
        onDelete={(r) => setDeleteTarget(r)}
        renderActions={(rule) => (
          <button
            onClick={() => handleToggle(rule)}
            className={`px-2 py-1 rounded text-xs font-medium min-h-[44px] flex items-center ${rule.enabled ? 'bg-warning/15 text-warning' : 'bg-success/15 text-success'}`}
          >
            {rule.enabled ? t('common.disable') : t('common.enable')}
          </button>
        )}
        emptyMessage={t('escalation.noRules')}
      />

      {/* Create/Edit Modal */}
      <Modal
        open={showModal}
        onClose={() => { setShowModal(false); resetForm(); }}
        title={editingRule ? t('escalation.editRule') : t('escalation.addRule')}
        actions={
          <>
            <button onClick={() => { setShowModal(false); resetForm(); }} className="px-4 py-2 rounded-lg text-sm text-text-secondary hover:text-text-primary border border-border-default min-h-[44px]">{t('common.cancel')}</button>
            <button onClick={handleSave} disabled={saving || !name.trim() || levels.length === 0} className="px-4 py-2 rounded-lg text-sm font-medium bg-accent text-white hover:bg-accent/90 disabled:opacity-50 min-h-[44px]">{saving ? t('common.saving') : t('common.save')}</button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1.5">{t('escalation.ruleName')}</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('escalation.ruleNamePlaceholder')}
              className="w-full px-3 py-2 rounded-lg border border-border-default bg-surface-base text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent/50 min-h-[44px]"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1.5">{t('escalation.triggerSeverity')}</label>
            <div className="flex gap-2">
              {(['info', 'warning', 'critical'] as const).map((sev) => (
                <button
                  key={sev}
                  onClick={() => setTriggerSeverity(sev)}
                  className={`px-3 py-2 rounded-lg text-sm font-medium capitalize transition-colors min-h-[44px] ${triggerSeverity === sev ? `${severityColors[sev]} ring-2 ring-offset-1 ring-current` : 'bg-surface-base text-text-secondary border border-border-default hover:text-text-primary'}`}
                >
                  {t(`common.${sev}`)}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1.5">{t('escalation.levels')}</label>
            <p className="text-xs text-text-muted mb-3">{t('escalation.levelsHint')}</p>
            <div className="space-y-3">
              {levels.map((level, idx) => (
                <div key={idx} className="p-3 rounded-lg border border-border-default bg-surface-base space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-text-primary">{t('escalation.level')} {idx + 1}</span>
                    {levels.length > 1 && (
                      <button onClick={() => removeLevel(idx)} className="text-xs text-critical hover:text-critical/80 min-h-[44px] px-2">{t('common.delete')}</button>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-text-muted mb-1">{t('escalation.delayMinutes')}</label>
                      <input
                        type="number"
                        min={1}
                        value={level.delay_minutes}
                        onChange={(e) => updateLevel(idx, { delay_minutes: parseInt(e.target.value) || 1 })}
                        className="w-full px-3 py-2 rounded-lg border border-border-default bg-surface-card text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent/50 min-h-[44px]"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-text-muted mb-1">{t('escalation.escalateTo')}</label>
                      <select
                        value={level.severity}
                        onChange={(e) => updateLevel(idx, { severity: e.target.value as 'info' | 'warning' | 'critical' })}
                        className="w-full px-3 py-2 rounded-lg border border-border-default bg-surface-card text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent/50 min-h-[44px]"
                      >
                        {(['info', 'warning', 'critical'] as const).map((s) => (
                          <option key={s} value={s}>{t(`common.${s}`)}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs text-text-muted mb-1">{t('escalation.channels')}</label>
                    <div className="flex flex-wrap gap-2">
                      {(channels || []).filter((c) => c.enabled).map((ch) => {
                        const active = level.channel_ids.includes(ch.id);
                        return (
                          <button
                            key={ch.id}
                            onClick={() => toggleLevelChannel(idx, ch.id)}
                            className={`px-2.5 py-1.5 rounded text-xs font-medium transition-colors min-h-[36px] ${active ? 'bg-accent/15 text-accent border border-accent/30' : 'bg-surface-hover text-text-secondary border border-border-default hover:text-text-primary'}`}
                          >
                            {ch.name}
                          </button>
                        );
                      })}
                      {(channels || []).filter((c) => c.enabled).length === 0 && (
                        <span className="text-xs text-text-muted">{t('escalation.noChannels')}</span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <button onClick={addLevel} className="mt-3 text-sm text-accent hover:text-accent/80 min-h-[44px] flex items-center gap-1">
              + {t('escalation.addLevel')}
            </button>
          </div>

          <div className="flex items-center gap-3">
            <label className="text-xs font-medium text-text-secondary">{t('common.enabled')}</label>
            <button
              onClick={() => setEnabled(!enabled)}
              className={`relative w-11 h-6 rounded-full transition-colors ${enabled ? 'bg-accent' : 'bg-surface-hover'}`}
            >
              <span className={`block w-4 h-4 rounded-full bg-white shadow transition-transform ${enabled ? 'translate-x-2.5' : '-translate-x-2.5'}`} />
            </button>
          </div>
        </div>
      </Modal>

      {/* Delete Confirmation */}
      <Modal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title={t('escalation.deleteRule')}
        actions={
          <>
            <button onClick={() => setDeleteTarget(null)} className="px-4 py-2 rounded-lg text-sm text-text-secondary hover:text-text-primary border border-border-default min-h-[44px]">{t('common.cancel')}</button>
            <button onClick={handleDelete} className="px-4 py-2 rounded-lg text-sm font-medium bg-critical text-white hover:bg-critical/90 min-h-[44px]">{t('common.delete')}</button>
          </>
        }
      >
        <p className="text-sm text-text-secondary">{t('escalation.deleteConfirm', { name: deleteTarget?.name })}</p>
      </Modal>
    </div>
  );
}
