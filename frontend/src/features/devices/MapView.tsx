import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { FarmMap } from '@/shared/components/FarmMap';
import { Modal } from '@/shared/components/Modal';
import { toast } from '@/shared/components/Toast';
import { getDevices, createDevice } from '@/features/devices/api';
import { getFields } from '@/features/fields/api';
import type { Device } from '@/shared/types/api';
import type { Field } from '@/shared/types';

const generateDeviceId = () => {
  const d = new Date();
  const day = String(d.getFullYear()).slice(-2) +
    String(d.getMonth() + 1).padStart(2, '0') +
    String(d.getDate()).padStart(2, '0');
  const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `D${day}-${rand}`;
};

export default function MapView() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [fields, setFields] = useState<Field[]>([]);
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);

  // Place device dialog
  const [placeLat, setPlaceLat] = useState(0);
  const [placeLng, setPlaceLng] = useState(0);
  const [placeName, setPlaceName] = useState('');
  const [placeType, setPlaceType] = useState('sensor');
  const [placing, setPlacing] = useState(false);
  const [showPlaceDialog, setShowPlaceDialog] = useState(false);
  const [placeDeviceId, setPlaceDeviceId] = useState(generateDeviceId());

  useEffect(() => {
    (async () => {
      const [fieldRes, deviceRes] = await Promise.all([getFields(), getDevices()]);
      if (fieldRes.success && fieldRes.data) setFields(fieldRes.data);
      if (deviceRes.success && deviceRes.data) setDevices(deviceRes.data.devices);
      setLoading(false);
    })();
  }, []);

  const handleMapClick = (latlng: { lat: number; lng: number }) => {
    setPlaceLat(latlng.lat);
    setPlaceLng(latlng.lng);
    setPlaceName('');
    setPlaceType('sensor');
    setPlaceDeviceId(generateDeviceId());
    setShowPlaceDialog(true);
  };

  const handlePlaceDevice = async () => {
    if (!placeName) return;
    setPlacing(true);
    const res = await createDevice({
      device_id: placeDeviceId,
      name: placeName,
      type: placeType,
      latitude: placeLat,
      longitude: placeLng,
    });
    setPlacing(false);
    if (res.success) {
      toast('success', 'Device placed on map');
      setShowPlaceDialog(false);
      const deviceRes = await getDevices();
      if (deviceRes.success && deviceRes.data) setDevices(deviceRes.data.devices);
    } else {
      toast('error', res.error || 'Failed to create device');
    }
  };

  // Build field polygons from real coordinates
  const fieldGeo = fields
    .filter(f => f.latitude && f.longitude)
    .map((f) => {
    const size = 0.015;
    return {
      id: f.id, name: f.name, health: f.health, soil_moisture: f.soil_moisture,
      alerts: f.health === 'critical' ? 1 : f.health === 'warning' ? 1 : undefined,
      zoneCount: f.zones?.length || 0,
      geometry: {
        type: 'Polygon' as const,
        coordinates: [[
          [f.longitude! - size, f.latitude! - size],
          [f.longitude! + size, f.latitude! - size],
          [f.longitude! + size * 1.3, f.latitude! + size],
          [f.longitude! - size * 0.8, f.latitude! + size * 1.3],
          [f.longitude! - size, f.latitude! - size],
        ]],
      },
    };
  });

  return (
    <div className="max-w-7xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-text-primary">{t('map.title')}</h1>
          <p className="text-sm text-text-muted">{t('map.subtitle')}</p>
        </div>
        <div className="text-xs text-text-muted">
          {t('map.devicesOnMap', { count: devices.filter((d) => d.latitude).length })}
        </div>
      </div>

      {loading ? (
        <div className="h-[500px] rounded-lg bg-surface-card border border-border-default animate-pulse" />
      ) : (
        <FarmMap
          fields={fieldGeo}
          devices={devices.map(d => ({
            id: d.id ?? d.device_id,
            device_id: d.device_id,
            name: d.name,
            latitude: d.latitude ?? 0,
            longitude: d.longitude ?? 0,
            status: d.status,
            latestTemp: d.latestTemp,
          })).filter(d => d.latitude && d.longitude)}
          height={520}
          onFieldClick={(f) => navigate(`/fields/${f.id}`)}
          onMapClick={handleMapClick}
          className="shadow-elevated"
        />
      )}

      {/* Place Device dialog */}
      <Modal open={showPlaceDialog} onClose={() => setShowPlaceDialog(false)} title="Place Device" actions={
        <><button onClick={() => setShowPlaceDialog(false)} className="px-4 py-2 rounded-lg text-sm text-text-secondary hover:text-text-primary hover:bg-surface-hover transition-colors">Cancel</button><button onClick={handlePlaceDevice} disabled={placing || !placeName} className="px-4 py-2 rounded-lg bg-accent hover:bg-accent-hover text-white text-sm font-medium transition-colors disabled:opacity-50">{placing ? 'Placing...' : 'Place Device'}</button></>
      }>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-text-muted mb-1">Latitude</label>
              <input value={placeLat.toFixed(6)} readOnly className="w-full px-3 py-2 rounded-lg bg-surface-hover border border-border-default text-text-muted text-sm cursor-not-allowed" />
            </div>
            <div>
              <label className="block text-xs text-text-muted mb-1">Longitude</label>
              <input value={placeLng.toFixed(6)} readOnly className="w-full px-3 py-2 rounded-lg bg-surface-hover border border-border-default text-text-muted text-sm cursor-not-allowed" />
            </div>
          </div>
          <div>
            <label className="block text-xs text-text-muted mb-1">Device ID <span className="text-text-muted">(auto)</span></label>
            <input value={placeDeviceId} readOnly className="w-full px-3 py-2 rounded-lg bg-surface-hover border border-border-default text-text-muted text-sm cursor-not-allowed" />
          </div>
          <div>
            <label className="block text-xs text-text-muted mb-1">Name</label>
            <input value={placeName} onChange={e => setPlaceName(e.target.value)} className="w-full px-3 py-2 rounded-lg bg-surface-base border border-border-default text-text-primary text-sm" />
          </div>
          <div>
            <label className="block text-xs text-text-muted mb-1">Type</label>
            <select value={placeType} onChange={e => setPlaceType(e.target.value)} className="w-full px-3 py-2 rounded-lg bg-surface-base border border-border-default text-text-primary text-sm">
              <option value="sensor">Sensor</option>
              <option value="controller">Controller</option>
              <option value="both">Gateway</option>
            </select>
          </div>
        </div>
      </Modal>
    </div>
  );
}
