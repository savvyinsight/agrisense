import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { FieldCard } from '@/shared/components/FieldCard';
import { StatusCard } from '@/shared/components/StatusCard';
import { Modal } from '@/shared/components/Modal';
import { toast } from '@/shared/components/Toast';
import { getFields, createField, deleteField } from '@/features/fields/api';
import type { Field } from '@/shared/types';

export default function Fields() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [fields, setFields] = useState<Field[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Field | null>(null);
  const [newName, setNewName] = useState('');
  const [newCrop, setNewCrop] = useState('');
  const [newLat, setNewLat] = useState('');
  const [newLng, setNewLng] = useState('');

  const load = async () => {
    setLoading(true);
    const res = await getFields();
    if (res.success && res.data) setFields(res.data);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleCreate = async () => {
    if (!newName) return;
    const res = await createField({
      name: newName, crop: newCrop || undefined,
      latitude: parseFloat(newLat) || undefined,
      longitude: parseFloat(newLng) || undefined,
    });
    if (res.success) toast('success', t('fields.addField'));
    setNewName(''); setNewCrop(''); setNewLat(''); setNewLng(''); setModalOpen(false);
    load();
  };

  const handleDelete = async () => {
    if (!deleteTarget?.id) return;
    const res = await deleteField(deleteTarget.id);
    if (res.success) { toast('success', t('fields.fieldDeleted')); setDeleteTarget(null); load(); }
    else toast('error', t('fields.failedToDeleteField'));
  };

  const sorted = [...fields].sort((a, b) => {
    const rank = { critical: 0, warning: 1, healthy: 2 };
    return rank[a.health] - rank[b.health];
  });

  const healthy = fields.filter((f) => f.health === 'healthy').length;
  const warning = fields.filter((f) => f.health === 'warning').length;
  const critical = fields.filter((f) => f.health === 'critical').length;

  return (
    <div className="max-w-7xl mx-auto space-y-4 md:space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-text-primary">{t('fields.title')}</h1>
          {fields.length > 0 && <p className="text-sm text-text-muted mt-0.5">{t('fields.morningCheck')}</p>}
        </div>
        {fields.length > 0 && <button onClick={() => setModalOpen(true)} className="px-4 py-2 rounded-lg bg-accent hover:bg-accent-hover text-white text-sm font-medium transition-colors min-h-[44px]">+ {t('fields.addField')}</button>}
      </div>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">{[1, 2, 3].map((i) => <div key={i} className="h-32 rounded-lg bg-surface-card border border-border-default animate-pulse" />)}</div>
      ) : sorted.length === 0 ? (
        <div className="rounded-xl border border-border-default bg-surface-card p-10 md:p-14 text-center max-w-lg mx-auto mt-8">
          <div className="w-16 h-16 rounded-full bg-accent/10 flex items-center justify-center mx-auto mb-5">
            <span className="text-3xl">🌾</span>
          </div>
          <h2 className="text-lg font-semibold text-text-primary mb-2">{t('fields.emptyTitle')}</h2>
          <p className="text-sm text-text-muted leading-relaxed mb-2">{t('fields.emptyDesc')}</p>
          <p className="text-xs text-text-muted mb-6">{t('fields.emptyDesc2')}</p>
          <button onClick={() => setModalOpen(true)} className="px-5 py-2.5 rounded-lg bg-accent hover:bg-accent-hover text-white text-sm font-medium transition-colors min-h-[44px]">+ {t('fields.emptyCTA')}</button>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-3">
            <StatusCard label={t('fields.totalFields')} value={fields.length} status="info" icon="🌾" />
            <StatusCard label={t('fields.healthy')} value={healthy} status={healthy > 0 ? 'healthy' : 'info'} icon="✅" />
            <StatusCard label={t('fields.warning')} value={warning} status={warning > 0 ? 'warning' : 'info'} icon="⚠" />
            <StatusCard label={t('fields.critical')} value={critical} status={critical > 0 ? 'critical' : 'info'} icon="🔴" />
          </div>

          {critical > 0 && (
            <div className="rounded-lg border-2 border-critical bg-critical-bg p-3 md:p-4">
              <p className="text-sm font-bold text-critical">{critical} {t('common.critical')}</p>
              <p className="text-xs text-text-secondary mt-1">{t('fields.criticalDetected')}</p>
            </div>
          )}
          {critical === 0 && warning > 0 && (
            <div className="rounded-lg border border-warning bg-warning-bg p-3 md:p-4">
              <p className="text-sm font-medium text-warning">{warning} {t('common.warning')}</p>
              <p className="text-xs text-text-secondary mt-1">{t('fields.monitorNotCritical')}</p>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {sorted.map((field) => (
              <div key={field.id} className="relative group">
                <FieldCard field={field} onClick={() => navigate(`/fields/${field.id}`)} />
                <button
                  onClick={(e) => { e.stopPropagation(); setDeleteTarget(field); }}
                  className="absolute top-2 right-2 p-1.5 rounded-md bg-surface-card/80 text-text-muted hover:text-critical hover:bg-critical-bg opacity-0 group-hover:opacity-100 transition-opacity min-h-[32px] min-w-[32px] flex items-center justify-center"
                  title={t('fields.deleteFieldTitle')}
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                </button>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Delete confirmation */}
      <Modal open={deleteTarget !== null} onClose={() => setDeleteTarget(null)} title={t('fields.deleteFieldTitle')} actions={
        <><button onClick={() => setDeleteTarget(null)} className="px-4 py-2 min-h-[44px] rounded-lg text-sm text-text-secondary hover:text-text-primary hover:bg-surface-hover transition-colors">{t('common.cancel')}</button><button onClick={handleDelete} className="px-4 py-2 min-h-[44px] rounded-lg bg-critical hover:bg-critical/80 text-white text-sm font-medium transition-colors">{t('common.delete')}</button></>
      }>
        <div className="text-center py-2">
          <span className="text-3xl block mb-3">⚠️</span>
          <p className="text-sm text-text-primary font-medium mb-1">{t('fields.deleteFieldConfirm', { name: deleteTarget?.name })}</p>
          <p className="text-xs text-text-muted">{t('fields.deleteFieldDesc')}</p>
        </div>
      </Modal>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={t('fields.newField')} actions={
        <><button onClick={() => setModalOpen(false)} className="px-4 py-2 min-h-[44px] rounded-lg text-sm text-text-secondary hover:text-text-primary hover:bg-surface-hover transition-colors">{t('common.cancel')}</button><button onClick={handleCreate} className="px-4 py-2 min-h-[44px] rounded-lg bg-accent hover:bg-accent-hover text-white text-sm font-medium transition-colors">{t('common.save')}</button></>
      }>
        <div>
          <label className="block text-xs font-medium text-text-secondary mb-1.5">{t('fields.fieldName')}</label>
          <input value={newName} onChange={(e) => setNewName(e.target.value)} className="w-full px-3 py-2 rounded-lg bg-surface-base border border-border-default text-text-primary text-sm focus:outline-none focus:border-accent" />
        </div>
        <div>
          <label className="block text-xs font-medium text-text-secondary mb-1.5">{t('fields.cropType')}</label>
          <input value={newCrop} onChange={(e) => setNewCrop(e.target.value)} className="w-full px-3 py-2 rounded-lg bg-surface-base border border-border-default text-text-primary text-sm focus:outline-none focus:border-accent" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1.5">{t('fields.latitude')}</label>
            <input value={newLat} onChange={(e) => setNewLat(e.target.value)} placeholder={t('fields.latPlaceholder')} className="w-full px-3 py-2 rounded-lg bg-surface-base border border-border-default text-text-primary text-sm font-mono focus:outline-none focus:border-accent" />
          </div>
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1.5">{t('fields.longitude')}</label>
            <input value={newLng} onChange={(e) => setNewLng(e.target.value)} placeholder={t('fields.lngPlaceholder')} className="w-full px-3 py-2 rounded-lg bg-surface-base border border-border-default text-text-primary text-sm font-mono focus:outline-none focus:border-accent" />
          </div>
        </div>
      </Modal>
    </div>
  );
}
