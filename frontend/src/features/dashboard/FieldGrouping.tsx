import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { Field, Device } from '@/shared/types';
import { useFarmStore } from '@/shared/store/farmStore';
import { cn } from '@/shared/lib/cn';

interface FieldGroupingProps {
  fields: Field[];
  devices: Device[];
  onFieldClick?: (field: Field) => void;
  onStartIrrigation?: (fieldId: number) => void;
}

export function FieldGrouping({
  fields,
  devices,
  onFieldClick,
  onStartIrrigation,
}: FieldGroupingProps) {
  const { t } = useTranslation();
  const { selectedFieldId, setSelectedField } = useFarmStore();

  // Group devices by field
  const fieldGroups = useMemo(() => {
    return fields.map(field => ({
      field,
      devices: devices.filter(d => d.field_id === field.id),
      health: field.health || 'unknown',
      moisture: field.soil_moisture || 0,
    })).sort((a, b) => {
      // Sort by health (critical first), then by field name
      const healthOrder = { critical: 0, warning: 1, healthy: 2, unknown: 3 };
      const aOrder = healthOrder[a.health as keyof typeof healthOrder] || 3;
      const bOrder = healthOrder[b.health as keyof typeof healthOrder] || 3;
      return aOrder !== bOrder ? aOrder - bOrder : a.field.name.localeCompare(b.field.name);
    });
  }, [fields, devices]);

  const getHealthColor = (health: string) => {
    switch (health) {
      case 'critical':
        return 'border-l-4 border-l-red-500 bg-red-50';
      case 'warning':
        return 'border-l-4 border-l-amber-500 bg-amber-50';
      case 'healthy':
        return 'border-l-4 border-l-green-500 bg-green-50';
      default:
        return 'border-l-4 border-l-gray-400 bg-gray-50';
    }
  };

  const getHealthIcon = (health: string) => {
    switch (health) {
      case 'critical': return '🔴';
      case 'warning': return '🟡';
      case 'healthy': return '🟢';
      default: return '⚪';
    }
  };

  const getMoistureColor = (moisture: number) => {
    if (moisture < 20) return 'text-red-600';
    if (moisture < 40) return 'text-amber-600';
    if (moisture > 80) return 'text-blue-600';
    return 'text-green-600';
  };

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-text-primary mb-3">{t('fields.fieldsAndZones')}</h3>
      
      {fieldGroups.length === 0 ? (
        <p className="text-sm text-text-secondary text-center py-8">{t('fields.noFieldsConfigured')}</p>
      ) : (
        fieldGroups.map(({ field, devices: fieldDevices, health, moisture }) => (
          <div
            key={field.id}
            onClick={() => {
              setSelectedField(field.id);
              onFieldClick?.(field);
            }}
            className={cn(
              'rounded-lg p-4 cursor-pointer transition-all',
              'border border-border-light hover:shadow-md hover:scale-105',
              selectedFieldId === field.id && 'ring-2 ring-primary shadow-md',
              getHealthColor(health)
            )}
          >
            {/* Header */}
            <div className="flex items-start justify-between mb-3">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-lg">{getHealthIcon(health)}</span>
                  <h4 className="font-semibold text-text-primary">{field.name}</h4>
                </div>
                <p className="text-xs text-text-secondary">
                  {field.crop || t('fields.unknownCrop')} • {t('fields.sensorsCount', { count: fieldDevices.length })}
                </p>
              </div>
              <div className="text-right">
                <p className={cn('text-2xl font-bold', getMoistureColor(moisture))}>
                  {moisture.toFixed(0)}%
                </p>
                <p className="text-xs text-text-secondary">{t('fields.soilMoisture')}</p>
              </div>
            </div>

            {/* Sensors */}
            {fieldDevices.length > 0 && (
              <div className="mb-3 space-y-1">
                {fieldDevices.slice(0, 3).map(device => (
                  <div key={device.id} className="flex items-center justify-between text-xs bg-white bg-opacity-50 rounded px-2 py-1">
                    <span className="text-text-secondary">
                      {device.name}
                    </span>
                    <span className={cn(
                      'px-2 py-0.5 rounded text-white text-xs font-medium',
                      device.status === 'online' ? 'bg-green-500' : 'bg-gray-500'
                    )}>
                      {device.status === 'online' ? `📡 ${t('common.online')}` : `❌ ${t('common.offline')}`}
                    </span>
                  </div>
                ))}
                {fieldDevices.length > 3 && (
                  <p className="text-xs text-text-secondary px-2">{t('fields.moreSensors', { count: fieldDevices.length - 3 })}</p>
                )}
              </div>
            )}

            {/* Quick Actions */}
            <div className="flex gap-2 pt-2 border-t border-border-light border-opacity-50">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onStartIrrigation?.(field.id);
                }}
                className="flex-1 px-3 py-1.5 bg-blue-500 text-white text-xs font-semibold rounded hover:bg-blue-600 transition-colors"
              >
                💧 {t('fields.irrigate')}
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onFieldClick?.(field);
                }}
                className="flex-1 px-3 py-1.5 bg-gray-200 text-text-primary text-xs font-semibold rounded hover:bg-gray-300 transition-colors"
              >
                {t('fields.viewDetails')} →
              </button>
            </div>
          </div>
        ))
      )}
    </div>
  );
}

export default FieldGrouping;
