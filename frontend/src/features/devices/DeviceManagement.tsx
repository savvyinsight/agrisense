import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { DataTable } from '@/shared/components/DataTable';
import { Modal } from '@/shared/components/Modal';
import { toast } from '@/shared/components/Toast';
import { getDevices, createDevice, updateDevice, deleteDevice } from '@/features/devices/api';
import type { Device } from '@/shared/types/api';

const emptyForm = {
  device_id: '', name: '', type: 'sensor', location: '',
  latitude: '', longitude: '',
  config: { reporting_interval: 60, temperature_unit: 'celsius' as 'celsius' | 'fahrenheit' },
};

export default function DeviceManagement() {
  const { t } = useTranslation();
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [deleteTarget, setDeleteTarget] = useState<Device | null>(null);

  const load = async () => {
    setLoading(true);
    const res = await getDevices();
    if (res.success) setDevices(res.data?.devices || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const openNew = () => { setEditId(null); setForm(emptyForm); setOpen(true); };
  const openEdit = (d: Device) => {
    setEditId(d.id);
    setForm({ device_id: d.device_id, name: d.name, type: d.type, location: d.location || '', latitude: d.latitude?.toString() ?? '', longitude: d.longitude?.toString() ?? '', config: { reporting_interval: d.config?.reporting_interval ?? 60, temperature_unit: (d.config?.temperature_unit as 'celsius' | 'fahrenheit') ?? 'celsius' } });
    setOpen(true);
  };

  const save = async () => {
    if (!form.device_id || !form.name) { setError(t('devices.idAndNameRequired')); return; }
    setError('');
    const payload = {
      device_id: form.device_id, name: form.name, type: form.type, location: form.location,
      latitude: parseFloat(form.latitude) || 0, longitude: parseFloat(form.longitude) || 0,
      config: { reporting_interval: Number(form.config.reporting_interval), temperature_unit: form.config.temperature_unit },
    };
    const res = editId ? await updateDevice(editId, payload) : await createDevice(payload);
    if (res.success) { toast('success', editId ? t('devices.updated') : t('devices.created')); setOpen(false); load(); }
    else setError(res.error || t('devices.failedToSave'));
  };

  const confirmRemove = (d: Device) => setDeleteTarget(d);

  const executeRemove = async () => {
    if (!deleteTarget?.id) return;
    const res = await deleteDevice(deleteTarget.id);
    if (res.success) { toast('success', t('devices.deleted')); setDeleteTarget(null); load(); }
  };

  const statusColor = (s: string) => {
    switch (s) {
      case 'online': return 'bg-success-bg text-success border-success/30';
      case 'offline': return 'bg-critical-bg text-critical border-critical/30';
      default: return 'bg-surface-hover text-text-muted border-border-default';
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-text-primary">{t('devices.title')}</h1>
          <p className="text-sm text-text-muted mt-0.5">{t('devices.subtitle')}</p>
        </div>
        <button onClick={openNew} className="px-3 py-2 rounded-lg bg-accent hover:bg-accent-hover text-white text-sm font-medium transition-colors">+ {t('devices.addDevice')}</button>
      </div>

      {error && <div className="text-sm p-3 rounded-lg bg-critical-bg text-critical border border-critical/30">{error}</div>}

      {loading ? (
        <div className="space-y-2">{[1, 2, 3].map((i) => <div key={i} className="h-12 rounded-lg bg-surface-card border border-border-default animate-pulse" />)}</div>
      ) : (
        <DataTable
          columns={[
            { key: 'device_id', header: t('devices.deviceId') },
            { key: 'name', header: t('devices.deviceName') },
            { key: 'type', header: t('devices.deviceType') },
            { key: 'location', header: t('devices.location'), render: (d: Device) => d.location || '-' },
            { key: 'status', header: t('devices.status'), render: (d: Device) => <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${statusColor(d.status)}`}>{t(`devices.${d.status}`)}</span> },
          ]}
          data={devices}
          keyExtractor={(d) => d.id ?? d.device_id}
          onEdit={openEdit}
          onDelete={confirmRemove}
          emptyMessage={t('devices.noDevices')}
        />
      )}

      <Modal open={open} onClose={() => setOpen(false)} title={editId ? t('devices.editDevice') : t('devices.addDevice')} actions={
        <><button onClick={() => setOpen(false)} className="px-4 py-2 rounded-lg text-sm text-text-secondary hover:text-text-primary hover:bg-surface-hover transition-colors">{t('devices.cancel')}</button><button onClick={save} className="px-4 py-2 rounded-lg bg-accent hover:bg-accent-hover text-white text-sm font-medium transition-colors">{t('devices.save')}</button></>
      }>
        <div>
          <label className="block text-xs font-medium text-text-secondary mb-1.5">{t('devices.deviceId')}</label>
          <input value={form.device_id} onChange={(e) => setForm({ ...form, device_id: e.target.value })} className="w-full px-3 py-2 rounded-lg bg-surface-base border border-border-default text-text-primary text-sm focus:outline-none focus:border-accent" />
        </div>
        <div>
          <label className="block text-xs font-medium text-text-secondary mb-1.5">{t('devices.deviceName')}</label>
          <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full px-3 py-2 rounded-lg bg-surface-base border border-border-default text-text-primary text-sm focus:outline-none focus:border-accent" />
        </div>
        <div>
          <label className="block text-xs font-medium text-text-secondary mb-1.5">{t('devices.deviceType')}</label>
          <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} className="w-full px-3 py-2 rounded-lg bg-surface-base border border-border-default text-text-primary text-sm focus:outline-none focus:border-accent">
            <option value="sensor">{t('devices.sensor')}</option>
            <option value="controller">{t('devices.controller')}</option>
            <option value="both">{t('devices.gateway')}</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-text-secondary mb-1.5">{t('devices.location')}</label>
          <input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} className="w-full px-3 py-2 rounded-lg bg-surface-base border border-border-default text-text-primary text-sm focus:outline-none focus:border-accent" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1.5">{t('devices.latitude')}</label>
            <input value={form.latitude} onChange={(e) => setForm({ ...form, latitude: e.target.value })} className="w-full px-3 py-2 rounded-lg bg-surface-base border border-border-default text-text-primary text-sm focus:outline-none focus:border-accent" />
          </div>
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1.5">{t('devices.longitude')}</label>
            <input value={form.longitude} onChange={(e) => setForm({ ...form, longitude: e.target.value })} className="w-full px-3 py-2 rounded-lg bg-surface-base border border-border-default text-text-primary text-sm focus:outline-none focus:border-accent" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1.5">{t('devices.reportingInterval')}</label>
            <input type="number" value={form.config.reporting_interval} onChange={(e) => setForm({ ...form, config: { ...form.config, reporting_interval: Number(e.target.value) } })} className="w-full px-3 py-2 rounded-lg bg-surface-base border border-border-default text-text-primary text-sm focus:outline-none focus:border-accent" />
          </div>
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1.5">{t('devices.temperatureUnit')}</label>
            <select value={form.config.temperature_unit} onChange={(e) => setForm({ ...form, config: { ...form.config, temperature_unit: e.target.value as 'celsius' | 'fahrenheit' } })} className="w-full px-3 py-2 rounded-lg bg-surface-base border border-border-default text-text-primary text-sm focus:outline-none focus:border-accent">
              <option value="celsius">{t('devices.celsius')}</option>
              <option value="fahrenheit">{t('devices.fahrenheit')}</option>
            </select>
          </div>
        </div>
      </Modal>

      {/* Delete confirmation modal */}
      <Modal open={deleteTarget !== null} onClose={() => setDeleteTarget(null)} title={t('devices.deleteConfirmTitle')} actions={
        <><button onClick={() => setDeleteTarget(null)} className="px-4 py-2 min-h-[44px] rounded-lg text-sm text-text-secondary hover:text-text-primary hover:bg-surface-hover transition-colors">{t('common.cancel')}</button><button onClick={executeRemove} className="px-4 py-2 min-h-[44px] rounded-lg bg-critical hover:bg-critical/80 text-white text-sm font-medium transition-colors">{t('common.delete')}</button></>
      }>
        <div className="text-center py-2">
          <span className="text-3xl block mb-3">⚠️</span>
          <p className="text-sm text-text-primary font-medium mb-1">{t('common.delete')} {deleteTarget?.name || deleteTarget?.device_id}?</p>
          <p className="text-xs text-text-muted">{t('devices.deleteConfirmDesc')}</p>
        </div>
      </Modal>
    </div>
  );
}
