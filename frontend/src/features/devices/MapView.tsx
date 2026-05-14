import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { FarmMap } from '@/shared/components/FarmMap';
import { getDevices } from '@/features/devices/api';
import { getFields } from '@/features/fields/api';
import type { Device } from '@/shared/types/api';
import type { Field } from '@/shared/types';

export default function MapView() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [fields, setFields] = useState<Field[]>([]);
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const [fieldRes, deviceRes] = await Promise.all([getFields(), getDevices()]);
      if (fieldRes.success && fieldRes.data) setFields(fieldRes.data);
      if (deviceRes.success && deviceRes.data) setDevices(deviceRes.data.devices);
      setLoading(false);
    })();
  }, []);

  // Generate mock field polygons from field coordinates
  const fieldGeo = fields.map((f, i) => {
    const baseLat = 30.5 + i * 0.03;
    const baseLng = 114.3 + (i % 3) * 0.04;
    const alerts = Math.floor(Math.random() * 3);
    return {
      id: f.id, name: f.name, health: f.health, soil_moisture: f.soil_moisture,
      alerts: alerts > 0 ? alerts : undefined,
      zoneCount: f.zones?.length || 0,
      geometry: {
        type: 'Polygon' as const,
        coordinates: [[
          [baseLng - 0.02, baseLat - 0.015],
          [baseLng + 0.02, baseLat - 0.015],
          [baseLng + 0.025, baseLat + 0.015],
          [baseLng - 0.015, baseLat + 0.02],
          [baseLng - 0.02, baseLat - 0.015],
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
          height={520}
          onFieldClick={(f) => navigate(`/fields/${f.id}`)}
          className="shadow-elevated"
        />
      )}
    </div>
  );
}
