import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal } from '@/shared/components/Modal';
import { toast } from '@/shared/components/Toast';
import type { NotificationChannel, NotificationRoutingRule } from '@/shared/types/api';
import {
  getNotificationSettings,
  createChannel,
  updateChannel,
  deleteChannel,
  updateRoutingRule,
  testNotification,
} from '@/features/settings/notificationApi';

const channelIcons: Record<string, string> = { email: '✉️', sms: '💬', webhook: '🔗' };
const channelFields: Record<string, { key: string; label: string; placeholder: string }[]> = {
  email: [{ key: 'address', label: 'Email Address', placeholder: 'alert@example.com' }],
  sms: [{ key: 'phone', label: 'Phone Number', placeholder: '+1234567890' }],
  webhook: [
    { key: 'url', label: 'Webhook URL', placeholder: 'https://example.com/webhook' },
    { key: 'secret', label: 'Secret (optional)', placeholder: 'Bearer token or secret' },
  ],
};

export default function NotificationSettings() {
  const { t } = useTranslation();

  const [channels, setChannels] = useState<NotificationChannel[]>([]);
  const [routingRules, setRoutingRules] = useState<NotificationRoutingRule[]>([]);
  const [loading, setLoading] = useState(true);

  // Channel modal state
  const [showChannelModal, setShowChannelModal] = useState(false);
  const [editingChannel, setEditingChannel] = useState<NotificationChannel | null>(null);
  const [channelType, setChannelType] = useState<'email' | 'sms' | 'webhook'>('email');
  const [channelName, setChannelName] = useState('');
  const [channelConfig, setChannelConfig] = useState<Record<string, string>>({});
  const [channelEnabled, setChannelEnabled] = useState(true);
  const [saving, setSaving] = useState(false);

  // Delete confirmation
  const [deletingChannel, setDeletingChannel] = useState<NotificationChannel | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    const res = await getNotificationSettings();
    if (res.success && res.data) {
      setChannels(res.data.channels);
      setRoutingRules(res.data.routing_rules);
    }
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const resetForm = () => {
    setEditingChannel(null);
    setChannelType('email');
    setChannelName('');
    setChannelConfig({});
    setChannelEnabled(true);
  };

  const openAdd = () => {
    resetForm();
    setShowChannelModal(true);
  };

  const openEdit = (ch: NotificationChannel) => {
    setEditingChannel(ch);
    setChannelType(ch.type);
    setChannelName(ch.name);
    setChannelConfig({ ...ch.config });
    setChannelEnabled(ch.enabled);
    setShowChannelModal(true);
  };

  const handleSaveChannel = async () => {
    if (!channelName.trim()) return;
    setSaving(true);
    const payload = { type: channelType, name: channelName.trim(), config: channelConfig, enabled: channelEnabled };
    const res = editingChannel
      ? await updateChannel(editingChannel.id, payload)
      : await createChannel(payload);
    if (res.success) {
      toast('success', editingChannel ? t('notification.channelUpdated') : t('notification.channelCreated'));
      setShowChannelModal(false);
      resetForm();
      loadData();
    } else {
      toast('error', res.error || t('common.failedToSave'));
    }
    setSaving(false);
  };

  const handleDeleteChannel = async () => {
    if (!deletingChannel) return;
    const res = await deleteChannel(deletingChannel.id);
    if (res.success) {
      toast('success', t('notification.channelDeleted'));
      setDeletingChannel(null);
      loadData();
    } else {
      toast('error', res.error || t('common.failedToDelete'));
    }
  };

  const handleToggleChannel = async (ch: NotificationChannel) => {
    const res = await updateChannel(ch.id, { enabled: !ch.enabled });
    if (res.success) loadData();
  };

  const handleTestChannel = async (ch: NotificationChannel) => {
    const res = await testNotification(ch.id);
    if (res.success) {
      toast('success', t('notification.testSent'));
    } else {
      toast('error', res.error || t('notification.testFailed'));
    }
  };

  const handleToggleRouting = async (rule: NotificationRoutingRule, channelId: number) => {
    const ids = rule.channel_ids.includes(channelId)
      ? rule.channel_ids.filter((id) => id !== channelId)
      : [...rule.channel_ids, channelId];
    const res = await updateRoutingRule(rule.id, { channel_ids: ids });
    if (res.success) loadData();
  };

  const maskConfig = (config: Record<string, string>) => {
    const entries = Object.entries(config);
    if (entries.length === 0) return t('notification.noConfig');
    return entries.map(([k, v]) => {
      if (k === 'secret' && v) return `${k}: ****`;
      if (k === 'url' && v.length > 40) return `${k}: ${v.slice(0, 37)}...`;
      return `${k}: ${v}`;
    }).join(' · ');
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="text-sm text-text-muted">{t('common.loading')}</div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-lg font-bold text-text-primary">{t('notification.title')}</h1>
        <p className="text-sm text-text-muted mt-0.5">{t('notification.subtitle')}</p>
      </div>

      {/* Section 1: Channels */}
      <div className="rounded-lg border border-border-default bg-surface-card p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-text-primary">{t('notification.channels')}</h2>
          <button onClick={openAdd} className="px-3 py-2 rounded-lg bg-accent text-white text-sm font-medium hover:bg-accent/90 transition-colors min-h-[44px]">
            + {t('notification.addChannel')}
          </button>
        </div>

        {channels.length === 0 ? (
          <p className="text-sm text-text-muted">{t('notification.noChannels')}</p>
        ) : (
          <div className="space-y-3">
            {channels.map((ch) => (
              <div key={ch.id} className="flex items-center gap-4 p-3 rounded-lg border border-border-default bg-surface-base">
                <span className="text-xl">{channelIcons[ch.type] || '📢'}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-text-primary">{ch.name}</span>
                    <span className="text-xs px-1.5 py-0.5 rounded bg-surface-hover text-text-secondary uppercase">{ch.type}</span>
                  </div>
                  <p className="text-xs text-text-muted truncate mt-0.5">{maskConfig(ch.config)}</p>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => handleTestChannel(ch)} className="text-xs text-accent hover:text-accent/80 px-2 py-1 min-h-[44px] flex items-center">{t('notification.test')}</button>
                  <button onClick={() => openEdit(ch)} className="text-xs text-text-secondary hover:text-text-primary px-2 py-1 min-h-[44px] flex items-center">{t('common.edit')}</button>
                  <button onClick={() => setDeletingChannel(ch)} className="text-xs text-critical hover:text-critical/80 px-2 py-1 min-h-[44px] flex items-center">{t('common.delete')}</button>
                  <button
                    onClick={() => handleToggleChannel(ch)}
                    className={`relative w-11 h-6 rounded-full transition-colors min-h-[44px] flex items-center justify-center ${ch.enabled ? 'bg-accent' : 'bg-surface-hover'}`}
                    aria-label={ch.enabled ? t('common.enabled') : t('common.disabled')}
                  >
                    <span className={`block w-4 h-4 rounded-full bg-white shadow transition-transform ${ch.enabled ? 'translate-x-2.5' : '-translate-x-2.5'}`} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Section 2: Severity Routing */}
      <div className="rounded-lg border border-border-default bg-surface-card p-5">
        <h2 className="text-sm font-semibold text-text-primary mb-1">{t('notification.routing')}</h2>
        <p className="text-xs text-text-muted mb-4">{t('notification.routingHint')}</p>

        {channels.length === 0 ? (
          <p className="text-sm text-text-muted">{t('notification.addChannelsFirst')}</p>
        ) : (
          <div className="space-y-4">
            {(['critical', 'warning', 'info'] as const).map((sev) => {
              const rule = routingRules.find((r) => r.severity === sev);
              return (
                <div key={sev} className="p-3 rounded-lg border border-border-default bg-surface-base">
                  <div className="flex items-center gap-2 mb-2">
                    <span className={`w-2 h-2 rounded-full ${sev === 'critical' ? 'bg-critical' : sev === 'warning' ? 'bg-warning' : 'bg-accent'}`} />
                    <span className="text-sm font-medium text-text-primary capitalize">{t(`common.${sev}`)}</span>
                  </div>
                  <div className="flex flex-wrap gap-3">
                    {channels.filter((c) => c.enabled).map((ch) => {
                      const active = rule?.channel_ids.includes(ch.id) ?? false;
                      return (
                        <button
                          key={ch.id}
                          onClick={() => rule && handleToggleRouting(rule, ch.id)}
                          className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors min-h-[44px] ${active ? 'bg-accent/15 text-accent border border-accent/30' : 'bg-surface-hover text-text-secondary border border-border-default hover:text-text-primary'}`}
                        >
                          <span>{channelIcons[ch.type]}</span>
                          <span>{ch.name}</span>
                          {active && <span className="text-accent">✓</span>}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Add/Edit Channel Modal */}
      <Modal
        open={showChannelModal}
        onClose={() => { setShowChannelModal(false); resetForm(); }}
        title={editingChannel ? t('notification.editChannel') : t('notification.addChannel')}
        actions={
          <>
            <button onClick={() => { setShowChannelModal(false); resetForm(); }} className="px-4 py-2 rounded-lg text-sm text-text-secondary hover:text-text-primary border border-border-default min-h-[44px]">{t('common.cancel')}</button>
            <button onClick={handleSaveChannel} disabled={saving || !channelName.trim()} className="px-4 py-2 rounded-lg text-sm font-medium bg-accent text-white hover:bg-accent/90 disabled:opacity-50 min-h-[44px]">{saving ? t('common.saving') : t('common.save')}</button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1.5">{t('notification.channelType')}</label>
            <div className="flex gap-2">
              {(['email', 'sms', 'webhook'] as const).map((type) => (
                <button
                  key={type}
                  onClick={() => { setChannelType(type); setChannelConfig({}); }}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors min-h-[44px] ${channelType === type ? 'bg-accent text-white' : 'bg-surface-base text-text-secondary border border-border-default hover:text-text-primary'}`}
                >
                  <span>{channelIcons[type]}</span>
                  <span className="capitalize">{type}</span>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1.5">{t('notification.channelName')}</label>
            <input
              type="text"
              value={channelName}
              onChange={(e) => setChannelName(e.target.value)}
              placeholder={t('notification.channelNamePlaceholder')}
              className="w-full px-3 py-2 rounded-lg border border-border-default bg-surface-base text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent/50 min-h-[44px]"
            />
          </div>

          {(channelFields[channelType] || []).map((field) => (
            <div key={field.key}>
              <label className="block text-xs font-medium text-text-secondary mb-1.5">{field.label}</label>
              <input
                type={field.key === 'secret' ? 'password' : 'text'}
                value={channelConfig[field.key] || ''}
                onChange={(e) => setChannelConfig({ ...channelConfig, [field.key]: e.target.value })}
                placeholder={field.placeholder}
                className="w-full px-3 py-2 rounded-lg border border-border-default bg-surface-base text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent/50 min-h-[44px]"
              />
            </div>
          ))}

          <div className="flex items-center gap-3">
            <label className="text-xs font-medium text-text-secondary">{t('common.enabled')}</label>
            <button
              onClick={() => setChannelEnabled(!channelEnabled)}
              className={`relative w-11 h-6 rounded-full transition-colors ${channelEnabled ? 'bg-accent' : 'bg-surface-hover'}`}
            >
              <span className={`block w-4 h-4 rounded-full bg-white shadow transition-transform ${channelEnabled ? 'translate-x-2.5' : '-translate-x-2.5'}`} />
            </button>
          </div>
        </div>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        open={!!deletingChannel}
        onClose={() => setDeletingChannel(null)}
        title={t('notification.deleteChannel')}
        actions={
          <>
            <button onClick={() => setDeletingChannel(null)} className="px-4 py-2 rounded-lg text-sm text-text-secondary hover:text-text-primary border border-border-default min-h-[44px]">{t('common.cancel')}</button>
            <button onClick={handleDeleteChannel} className="px-4 py-2 rounded-lg text-sm font-medium bg-critical text-white hover:bg-critical/90 min-h-[44px]">{t('common.delete')}</button>
          </>
        }
      >
        <p className="text-sm text-text-secondary">{t('notification.deleteChannelConfirm', { name: deletingChannel?.name })}</p>
      </Modal>
    </div>
  );
}
