import { useRef, useState, useEffect, useCallback } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { MapContainer, TileLayer, GeoJSON, Marker, Popup, useMap } from 'react-leaflet';
import { cn } from '@/shared/lib/cn';

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

type MapMode = 'health' | 'moisture' | 'irrigation' | 'diagnostics';

interface FieldGeo {
  id: number; name: string; health: 'healthy' | 'warning' | 'critical';
  soil_moisture?: number; geometry: { type: 'Polygon'; coordinates: number[][][] };
  zoneCount?: number; alerts?: number;
}

interface DeviceMarker {
  id: number | string;
  device_id: string;
  name: string;
  latitude: number;
  longitude: number;
  status: string;
  latestTemp?: number | null;
}

interface FarmMapProps {
  fields: FieldGeo[];
  devices?: DeviceMarker[];
  center?: [number, number];
  zoom?: number;
  height?: number;
  onFieldClick?: (field: FieldGeo) => void;
  onMapClick?: (latlng: { lat: number; lng: number }) => void;
  focusedAlertId?: number | null;
  className?: string;
}

const modeConfig: Record<MapMode, { label: string; icon: string; desc: string }> = {
  health: { label: 'Health', icon: '🌾', desc: 'Field health overview' },
  moisture: { label: 'Moisture', icon: '💧', desc: 'Soil moisture analysis' },
  irrigation: { label: 'Irrigation', icon: '🔄', desc: 'Irrigation status' },
  diagnostics: { label: 'Devices', icon: '📡', desc: 'Sensor & device health' },
};

const healthColor: Record<string, string> = {
  healthy: '#4caf50', warning: '#f59e0b', critical: '#ef4444',
};

const healthFill: Record<string, string> = {
  healthy: '#4caf5020', warning: '#f59e0b20', critical: '#ef444420',
};

function MapController({ focusedAlertId, fields }: { focusedAlertId?: number | null; fields: FieldGeo[] }) {
  const map = useMap();
  useEffect(() => {
    if (focusedAlertId && fields.length > 0) {
      const f = fields.find((x) => x.id === focusedAlertId);
      if (f && f.geometry.coordinates[0].length > 0) {
        const coords = f.geometry.coordinates[0] as [number, number][];
        const bounds = L.latLngBounds(coords);
        map.fitBounds(bounds, { padding: [50, 50], maxZoom: 16 });
      }
    }
  }, [focusedAlertId, fields, map]);
  return null;
}

export function FarmMap({ fields, devices = [], center = [30.5, 114.3], zoom = 12, height = 400, 
  onFieldClick, onMapClick, focusedAlertId, className }: FarmMapProps) {
  const [mode, setMode] = useState<MapMode>('health');
  const [selectedField, setSelectedField] = useState<FieldGeo | null>(null);
  const mapRef = useRef<L.Map | null>(null);

  const handleFieldClick = useCallback((field: FieldGeo) => {
    setSelectedField(field);
    onFieldClick?.(field);
  }, [onFieldClick]);

  // Map click → place device (bound in whenReady via ref to always use latest callback)
  const onClickRef = useRef(onMapClick);
  onClickRef.current = onMapClick;

  const colorByMode = (field: FieldGeo) => {
    if (mode === 'health') {
      return { color: healthColor[field.health], fillColor: healthFill[field.health], fillOpacity: 0.3, weight: 2 };
    }
    if (mode === 'moisture') {
      const m = field.soil_moisture ?? 50;
      const c = m < 30 ? '#ef4444' : m < 50 ? '#f59e0b' : m < 70 ? '#4caf50' : '#2196f3';
      return { color: c, fillColor: c + '30', fillOpacity: 0.3, weight: 2 };
    }
    if (mode === 'irrigation') {
      return { color: '#2196f3', fillColor: '#2196f330', fillOpacity: 0.3, weight: 2 };
    }
    return { color: '#64748b', fillColor: '#64748b20', fillOpacity: 0.15, weight: 1, dashArray: '4' };
  };

  const onEachFeature = (field: FieldGeo, layer: L.Path) => {
    const tooltipContent = `
      <div style="font-size:12px;line-height:1.4">
        <strong>${field.name}</strong><br/>
        ${mode === 'health' ? `Status: <span style="color:${healthColor[field.health]}">${field.health}</span>` : ''}
        ${mode === 'moisture' ? `Moisture: <strong>${field.soil_moisture ?? '--'}%</strong>` : ''}
        ${field.alerts ? `Alerts: ${field.alerts}` : ''}
      </div>`;
    layer.bindTooltip(tooltipContent, { sticky: true, className: 'rounded-lg shadow-lg border border-border-default bg-surface-card p-2 text-xs' });

    layer.on('click', () => handleFieldClick(field));

    layer.on('mouseover', () => {
      layer.setStyle({ weight: 3, fillOpacity: 0.5 });
      if (mapRef.current) mapRef.current.getContainer().style.cursor = 'pointer';
    });
    layer.on('mouseout', () => {
      layer.setStyle({ weight: 2, fillOpacity: 0.3 });
      if (mapRef.current) mapRef.current.getContainer().style.cursor = '';
    });
  };

  return (
    <div className={cn('flex flex-col lg:flex-row gap-0 rounded-lg border border-border-default overflow-hidden', className)}>
      {/* Map area */}
      <div className="flex-1 relative" style={{ height }}>
        <div className="absolute top-3 left-3 right-3 z-[1000] flex gap-1 overflow-x-auto">
          {(Object.keys(modeConfig) as MapMode[]).map((m) => {
            const cfg = modeConfig[m];
            return (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={cn(
                  'px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap backdrop-blur-sm',
                  mode === m ? 'bg-accent text-white' : 'bg-surface-card/90 text-text-secondary hover:text-text-primary border border-border-default',
                )}
              >
                {cfg.icon} {cfg.label}
              </button>
            );
          })}
        </div>

        <MapContainer center={center} zoom={zoom} style={{ height: '100%', width: '100%' }} ref={mapRef} zoomControl={false} whenReady={(m) => {
          const leafletMap = m.target;
          mapRef.current = leafletMap;
          leafletMap.on('click', (e: L.LeafletMouseEvent) => {
            onClickRef.current?.({ lat: e.latlng.lat, lng: e.latlng.lng });
          });
        }}>
          <TileLayer url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}" attribution='&copy; <a href="https://www.esri.com/">Esri</a>' />
          <MapController focusedAlertId={focusedAlertId} fields={fields} />
          {fields.map((field) => (
            <GeoJSON
              key={field.id}
              data={field.geometry as any}
              style={() => colorByMode(field)}
              onEachFeature={(_, layer) => onEachFeature(field, layer as L.Path)}
            />
          ))}
          {devices.filter(d => d.latitude && d.longitude).map((d) => (
            <Marker key={d.id} position={[d.latitude, d.longitude]}>
              <Popup>
                <div className="text-sm">
                  <strong>{d.name}</strong><br />
                  <span className="text-xs">{d.device_id}</span><br />
                  <span className={d.status === 'online' ? 'text-green-600' : 'text-red-600'}>{d.status}</span>
                  {d.latestTemp != null && <><br />{d.latestTemp}°C</>}
                </div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      </div>

      {/* Side panel */}
      {selectedField && (
        <div className="w-full lg:w-72 border-t lg:border-t-0 lg:border-l border-border-default bg-surface-card p-4 overflow-y-auto max-h-[300px] lg:max-h-none">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-text-primary">{selectedField.name}</h3>
            <button onClick={() => setSelectedField(null)} className="p-1 text-text-muted hover:text-text-primary min-h-[44px] min-w-[44px] flex items-center justify-center">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>

          {mode === 'health' && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <span className={cn('w-3 h-3 rounded-full', selectedField.health === 'healthy' ? 'bg-success' : selectedField.health === 'warning' ? 'bg-warning' : 'bg-critical')} />
                <span className="text-sm capitalize">{selectedField.health}</span>
              </div>
              <div className="text-xs text-text-muted">
                <span className="block">Moisture: {selectedField.soil_moisture ?? '--'}%</span>
                {selectedField.alerts ? <span className="block text-critical mt-1">⚠ {selectedField.alerts} active alert{selectedField.alerts > 1 ? 's' : ''}</span> : null}
                {selectedField.alerts && selectedField.alerts > 0 && (
                  <p className="text-xs text-warning mt-2">→ Inspect field. Check moisture levels and irrigation system.</p>
                )}
              </div>
              <button className="w-full py-2 mt-2 rounded-md bg-accent hover:bg-accent-hover text-white text-xs font-medium transition-colors">
                Open Detail View
              </button>
            </div>
          )}

          {mode === 'moisture' && (
            <div className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-text-muted">Soil Moisture</span>
                <span className={cn('font-bold', (selectedField.soil_moisture ?? 0) < 30 ? 'text-critical' : (selectedField.soil_moisture ?? 0) < 50 ? 'text-warning' : 'text-success')}>
                  {selectedField.soil_moisture ?? '--'}%
                </span>
              </div>
              <div className="h-2 bg-surface-elevated rounded-full overflow-hidden">
                <div className="h-full rounded-full bg-success" style={{ width: `${selectedField.soil_moisture ?? 0}%` }} />
              </div>
              {(selectedField.soil_moisture ?? 100) < 40 && (
                <p className="text-xs text-warning">→ Low moisture. Consider irrigation within 4 hours.</p>
              )}
              <button className="w-full py-2 mt-2 rounded-md bg-accent hover:bg-accent-hover text-white text-xs font-medium transition-colors">
                View Trend
              </button>
            </div>
          )}

          {mode === 'irrigation' && (
            <div className="space-y-3">
              <p className="text-xs text-text-muted">No active irrigation in this field.</p>
              <button className="w-full py-2 rounded-md bg-info-bright/20 text-info-bright text-xs font-medium hover:bg-info-bright/30 transition-colors">
                Start Irrigation
              </button>
            </div>
          )}

          {mode === 'diagnostics' && (
            <div className="space-y-3 text-xs">
              <div className="flex justify-between"><span className="text-text-muted">Sensors</span><span>3 online, 0 offline</span></div>
              <div className="flex justify-between"><span className="text-text-muted">Battery</span><span className="text-success">85% average</span></div>
              <div className="flex justify-between"><span className="text-text-muted">Connectivity</span><span className="text-success">Stable</span></div>
              <button className="w-full py-2 mt-2 rounded-md bg-accent hover:bg-accent-hover text-white text-xs font-medium transition-colors">
                View Devices
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
