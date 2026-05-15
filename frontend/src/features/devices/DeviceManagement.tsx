import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@/shared/stores/authStore';
import { DataTable } from '@/shared/components/DataTable';
import { Modal } from '@/shared/components/Modal';
import { toast } from '@/shared/components/Toast';
import { getDevices, createDevice, updateDevice, deleteDevice, claimDevice, unclaimDevice } from '@/features/devices/api';
import type { Device } from '@/shared/types/api';

const generateDeviceId = () => {
  const d = new Date();
  const day = String(d.getFullYear()).slice(-2) +
    String(d.getMonth() + 1).padStart(2, '0') +
    String(d.getDate()).padStart(2, '0');
  const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `D${day}-${rand}`;
};

const emptyForm = {
  device_id: generateDeviceId(), name: '', type: 'sensor', location: '',
  latitude: '', longitude: '',
  config: { reporting_interval: 60, temperature_unit: 'celsius' as 'celsius' | 'fahrenheit' },
};

export default function DeviceManagement() {
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [deleteTarget, setDeleteTarget] = useState<Device | null>(null);
  const [unclaimTarget, setUnclaimTarget] = useState<Device | null>(null);
  const [showClaim, setShowClaim] = useState(false);
  const [claimDeviceId, setClaimDeviceId] = useState('');
  const [claimError, setClaimError] = useState('');
  const [claiming, setClaiming] = useState(false);

  const load = async () => {
    setLoading(true);
    const res = await getDevices();
    if (res.success) setDevices(res.data?.devices || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const openNew = () => { setEditId(null); setForm({ ...emptyForm, device_id: generateDeviceId() }); setOpen(true); };
  const openEdit = (d: Device) => {
    setEditId(d.id);
    setForm({ device_id: d.device_id, name: d.name, type: d.type, location: d.location || '', latitude: d.latitude?.toString() ?? '', longitude: d.longitude?.toString() ?? '', config: { reporting_interval: d.config?.reporting_interval ?? 60, temperature_unit: (d.config?.temperature_unit as 'celsius' | 'fahrenheit') ?? 'celsius' } });
    setOpen(true);
  };

  const save = async () => {
    if (!form.name) { setError(t('devices.nameRequired')); return; }
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

  const handleClaim = async () => {
    setClaiming(true);
    setClaimError('');
    const res = await claimDevice(claimDeviceId);
    if (res.success) {
      toast('success', 'Device claimed successfully');
      setShowClaim(false);
      setClaimDeviceId('');
      load();
    } else {
      setClaimError(res.error || 'Failed to claim device');
    }
    setClaiming(false);
  };

  const confirmUnclaim = (device: Device) => setUnclaimTarget(device);

  const handleUnclaim = async () => {
    if (!unclaimTarget) return;
    const dId = unclaimTarget.device_id;
    const res = await unclaimDevice(dId);
    setUnclaimTarget(null);
    if (res.success) {
      toast('success', 'Device unclaimed');
      load();
    } else {
      toast('error', res.error || 'Failed to unclaim');
    }
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
        <div className="flex gap-2">
          <button onClick={() => setShowClaim(true)} className="px-3 py-2 rounded-lg border border-border-default text-text-secondary hover:bg-surface-hover text-sm font-medium transition-colors">Claim Device</button>
          <button onClick={openNew} className="px-3 py-2 rounded-lg bg-accent hover:bg-accent-hover text-white text-sm font-medium transition-colors">+ {t('devices.addDevice')}</button>
        </div>
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
          renderActions={(d: Device) =>
            (user?.role === 'admin' || d.user_id === user?.id) ? (
              <button onClick={() => confirmUnclaim(d)} className="p-3 md:p-1.5 min-h-[44px] min-w-[44px] flex items-center justify-center text-text-muted hover:text-warning rounded-md hover:bg-warning-bg transition-colors" title="Unclaim">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                </svg>
              </button>
            ) : null
          }
          emptyMessage={t('devices.noDevices')}
        />
      )}

      <Modal open={open} onClose={() => setOpen(false)} title={editId ? t('devices.editDevice') : t('devices.addDevice')} actions={
        <><button onClick={() => setOpen(false)} className="px-4 py-2 rounded-lg text-sm text-text-secondary hover:text-text-primary hover:bg-surface-hover transition-colors">{t('devices.cancel')}</button><button onClick={save} className="px-4 py-2 rounded-lg bg-accent hover:bg-accent-hover text-white text-sm font-medium transition-colors">{t('devices.save')}</button></>
      }>
        <div>
          <label className="block text-xs font-medium text-text-secondary mb-1.5">{t('devices.deviceId')} <span className="text-text-muted">(auto)</span></label>
          <input value={form.device_id} readOnly className="w-full px-3 py-2 rounded-lg bg-surface-hover border border-border-default text-text-muted text-sm cursor-not-allowed" />
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

      {/* Unclaim confirmation modal */}
      <Modal open={unclaimTarget !== null} onClose={() => setUnclaimTarget(null)} title="Unclaim Device" actions={
        <><button onClick={() => setUnclaimTarget(null)} className="px-4 py-2 rounded-lg text-sm text-text-secondary hover:text-text-primary hover:bg-surface-hover transition-colors">Cancel</button><button onClick={handleUnclaim} className="px-4 py-2 rounded-lg bg-warning hover:bg-warning-muted text-white text-sm font-medium transition-colors">Unclaim</button></>
      }>
        <div className="text-center py-2">
          <span className="text-3xl block mb-3">⚠️</span>
          <p className="text-sm text-text-primary font-medium mb-1">Unclaim {unclaimTarget?.name || unclaimTarget?.device_id}?</p>
          <p className="text-xs text-text-muted">This device will be released and available for others to claim.</p>
        </div>
      </Modal>

      {/* Claim device modal */}
      <Modal open={showClaim} onClose={() => { setShowClaim(false); setClaimError(''); }} title="Claim Device" actions={
        <><button onClick={() => { setShowClaim(false); setClaimError(''); }} className="px-4 py-2 rounded-lg text-sm text-text-secondary hover:text-text-primary hover:bg-surface-hover transition-colors">Cancel</button><button onClick={handleClaim} disabled={claiming || !claimDeviceId} className="px-4 py-2 rounded-lg bg-accent hover:bg-accent-hover text-white text-sm font-medium transition-colors disabled:opacity-50">{claiming ? 'Claiming...' : 'Claim'}</button></>
      }>
        <div>
          {claimError && <div className="text-sm text-red-600 bg-red-50 p-2 rounded mb-3">{claimError}</div>}
          <label className="block text-xs font-medium text-text-secondary mb-1.5">Device ID</label>
          <input value={claimDeviceId} onChange={(e) => setClaimDeviceId(e.target.value)} placeholder="e.g. ESP32-AABBCCDD" className="w-full px-3 py-2 rounded-lg bg-surface-base border border-border-default text-text-primary text-sm font-mono focus:outline-none focus:border-accent" />
          <p className="text-xs text-text-muted mt-2">Enter the device ID from the physical device label or MQTT log. The device must not be already claimed by another user.</p>
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
