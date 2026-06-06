import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { createZone, updateZone } from '@/features/irrigation/api';
import { getFields } from '@/features/fields/api';
import { getDevices } from '@/features/devices/api';
import { toast } from '@/shared/components/Toast';
import type { IrrigationZone } from '@/features/irrigation/api';
import type { Field } from '@/shared/types';
import type { Device } from '@/shared/types/api';

interface IrrigationZoneFormModalProps {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  zone?: IrrigationZone | null;
  preSelectedFieldId?: number;
}

const typeIcon: Record<string, string> = { controller: '🔧', both: '📡', sensor: '🌡️' };

export function IrrigationZoneFormModal({ open, onClose, onSaved, zone, preSelectedFieldId }: IrrigationZoneFormModalProps) {
  const { t } = useTranslation();
  const [fieldId, setFieldId] = useState(preSelectedFieldId ?? 0);
  const [deviceId, setDeviceId] = useState<number | null>(null);
  const [targetMoisture, setTargetMoisture] = useState(60);
  const [flowRateLPM, setFlowRateLPM] = useState(0);
  const [fields, setFields] = useState<Field[]>([]);
  const [devices, setDevices] = useState<Device[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const isEdit = !!zone;
  const selectedDevice = devices.find(d => d.id === deviceId);

  useEffect(() => {
    if (isEdit && zone) {
      setFieldId(zone.field_id);
      setDeviceId(zone.device_id ?? null);
      setTargetMoisture(zone.target_moisture);
      setFlowRateLPM(zone.flow_rate_lpm);
    } else {
      setFieldId(preSelectedFieldId ?? 0);
      setDeviceId(null);
      setTargetMoisture(60);
      setFlowRateLPM(0);
    }
    setError('');
  }, [open, zone, isEdit, preSelectedFieldId]);

  useEffect(() => {
    (async () => {
      if (!preSelectedFieldId) {
        const res = await getFields();
        if (res.success && res.data) setFields(Array.isArray(res.data) ? res.data : []);
      }
      const devRes = await getDevices();
      if (devRes.success && devRes.data?.devices) setDevices(devRes.data.devices);
    })();
  }, [preSelectedFieldId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fieldId) { setError(t('irrigation.selectField')); return; }
    if (!deviceId) { setError(t('irrigation.selectDevice')); return; }

    setSaving(true);
    setError('');

    const zoneName = selectedDevice?.name || selectedDevice?.device_id || `Zone-${deviceId}`;

    if (isEdit && zone) {
      const payload: Record<string, unknown> = {};
      if (deviceId !== (zone.device_id ?? null)) {
        payload.device_id = deviceId;
        payload.name = zoneName;
      }
      if (targetMoisture !== zone.target_moisture) payload.target_moisture = targetMoisture;
      if (flowRateLPM !== zone.flow_rate_lpm) payload.flow_rate_lpm = flowRateLPM;

      if (Object.keys(payload).length === 0) {
        onClose();
        setSaving(false);
        return;
      }

      const res = await updateZone(zone.id, payload);
      if (res.success) {
        toast('success', t('common.zoneUpdated'));
        onSaved();
        onClose();
      } else {
        setError(res.error || t('common.failedToUpdateZone'));
      }
    } else {
      const res = await createZone({
        name: zoneName,
        field_id: fieldId,
        device_id: deviceId,
        target_moisture: targetMoisture,
        flow_rate_lpm: flowRateLPM,
      });
      if (res.success) {
        toast('success', t('common.zoneCreated'));
        onSaved();
        onClose();
      } else {
        setError(res.error || t('common.failedToCreateZone'));
      }
    }

    setSaving(false);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/50" onClick={onClose}>
      <div className="bg-surface-card rounded-lg border border-border-default w-full max-w-md mx-4 p-6 shadow-xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-bold text-text-primary">{isEdit ? t('irrigation.editZone') : t('irrigation.addZone')}</h2>
          <button onClick={onClose} className="text-text-muted hover:text-text-primary min-h-[44px] min-w-[44px] flex items-center justify-center">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Field selector — hidden when pre-selected */}
          {!preSelectedFieldId && (
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1">{t('irrigation.field')}</label>
              <select
                value={fieldId}
                onChange={e => setFieldId(Number(e.target.value))}
                className="w-full rounded-lg border border-border-default bg-surface-elevated px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent"
              >
                <option value={0}>{t('irrigation.selectField')}</option>
                {fields.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
              </select>
            </div>
          )}

          {/* Controller Device */}
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1">{t('irrigation.controllerDevice')}</label>
            <select
              value={deviceId ?? ''}
              onChange={e => setDeviceId(e.target.value ? Number(e.target.value) : null)}
              className="w-full rounded-lg border border-border-default bg-surface-elevated px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent"
            >
              <option value="">{t('analytics.selectDevice')}</option>
              {devices.filter(d => {
                if (d.type !== 'controller' && d.type !== 'both') return false;
                const curField = fieldId || preSelectedFieldId;
                if (!curField) return true;
                return d.field_id === curField || !d.field_id;
              }).map(d => (
                <option key={d.id} value={d.id}>
                  {typeIcon[d.type] ?? '🌡️'} {d.device_id} — {d.name}{!d.field_id ? ` (${t('map.unplaced')})` : ''}
                </option>
              ))}
            </select>
            {selectedDevice && (
              <p className="text-[10px] text-text-muted mt-1">
                {t('irrigation.zoneName')}: <span className="text-text-primary font-medium">{selectedDevice.name || selectedDevice.device_id}</span>
              </p>
            )}
          </div>

          {/* Target Moisture */}
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1">
              {t('irrigation.targetMoisture')} <span className="text-text-muted">({targetMoisture}%)</span>
            </label>
            <input
              type="range"
              min={10}
              max={100}
              value={targetMoisture}
              onChange={e => setTargetMoisture(Number(e.target.value))}
              className="w-full accent-accent"
            />
            <div className="flex justify-between text-[10px] text-text-muted mt-0.5">
              <span>10%</span>
              <span>100%</span>
            </div>
          </div>

          {/* Flow Rate */}
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1">{t('irrigation.flowRatePerMin')}</label>
            <input
              type="number"
              min={0}
              step={0.5}
              value={flowRateLPM}
              onChange={e => setFlowRateLPM(Number(e.target.value))}
              className="w-full rounded-lg border border-border-default bg-surface-elevated px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent"
              placeholder="e.g. 50"
            />
          </div>

          {error && <p className="text-xs text-critical">{error}</p>}

          {/* Buttons */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 rounded-lg border border-border-default text-sm text-text-secondary hover:text-text-primary hover:bg-surface-hover transition-colors min-h-[44px]"
            >
              {t('common.cancel')}
            </button>
            <button
              type="submit"
              disabled={saving || !deviceId}
              className="flex-1 py-2.5 rounded-lg bg-accent text-white text-sm font-medium hover:bg-accent-hover transition-colors min-h-[44px] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {saving && <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />}
              {isEdit ? t('common.saveChanges') : t('irrigation.createZone')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
