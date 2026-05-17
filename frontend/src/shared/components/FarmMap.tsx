import { useState, useEffect, useCallback, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet-draw';
import 'leaflet-draw/dist/leaflet.draw.css';
import { MapContainer, TileLayer, GeoJSON, Marker, Popup, useMap } from 'react-leaflet';
import { cn } from '@/shared/lib/cn';
import { mapClickCb, drawCancelCb, hoveredFieldIdRef } from '@/shared/lib/mapClickStore';


delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

// Geometry utilities
function pointInPolygon(latlng: { lat: number; lng: number }, polygon: number[][][]): boolean {
  const x = latlng.lng, y = latlng.lat;
  const ring = polygon[0];
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0], yi = ring[i][1];
    const xj = ring[j][0], yj = ring[j][1];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

function distToSegment(latlng: { lat: number; lng: number }, a: number[], b: number[]): number {
  const x = latlng.lng, y = latlng.lat;
  const x1 = a[0], y1 = a[1], x2 = b[0], y2 = b[1];
  const dx = x2 - x1, dy = y2 - y1;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return Math.sqrt((x - x1) ** 2 + (y - y1) ** 2);
  let t = ((x - x1) * dx + (y - y1) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  const px = x1 + t * dx, py = y1 + t * dy;
  return Math.sqrt((x - px) ** 2 + (y - py) ** 2);
}

function isOnBoundary(latlng: { lat: number; lng: number }, polygon: number[][][], thresholdDeg = 0.0001): boolean {
  const ring = polygon[0];
  for (let i = 0; i < ring.length - 1; i++) {
    if (distToSegment(latlng, ring[i], ring[i + 1]) < thresholdDeg) return true;
  }
  return false;
}

function findFieldAtPoint(latlng: { lat: number; lng: number }, fields: FieldGeo[]): { field: FieldGeo; onBoundary: boolean } | null {
  for (const field of fields) {
    if (!field.geometry) continue;
    if (isOnBoundary(latlng, field.geometry.coordinates)) {
      return { field, onBoundary: true };
    }
    if (pointInPolygon(latlng, field.geometry.coordinates)) {
      return { field, onBoundary: false };
    }
  }
  return null;
}

type MapMode = 'health' | 'moisture' | 'irrigation' | 'diagnostics';

interface FieldGeo {
  id: number;
  name: string;
  health: 'healthy' | 'warning' | 'critical';
  soil_moisture?: number;
  latitude?: number;
  longitude?: number;
  geometry?: { type: 'Polygon'; coordinates: number[][][] };
  zoneCount?: number;
  alerts?: number;
}

interface DeviceMarker {
  id: number | string;
  device_id: string;
  name: string;
  latitude: number;
  longitude: number;
  status: string;
  type?: string;
  field_id?: number | null;
  last_heartbeat?: string | null;
  latestTemp?: number | null;
}

interface FarmMapProps {
  fields: FieldGeo[];
  devices?: DeviceMarker[];
  center?: [number, number];
  zoom?: number;
  height?: number;
  onFieldClick?: (field: FieldGeo) => void;
  onMapClick?: (latlng: { lat: number; lng: number }, fieldId?: number) => void;
  onFieldDraw?: (coordinates: number[][][]) => void;
  onDeviceMove?: (deviceId: number | string, latlng: { lat: number; lng: number }) => void;
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

function DrawController({ onComplete }: { onComplete: (coords: number[][][]) => void }) {
  const map = useMap();
  useEffect(() => {
    const draw = new (L as any).Draw.Polygon(map, {
      shapeOptions: { color: '#f97316', fillColor: '#f9731633', fillOpacity: 0.2, weight: 2, dashArray: '8, 4' },
    });
    draw.enable();
    const handler = (e: any) => {
      map.removeLayer(e.layer);
      const latlngs = (e.layer as L.Polygon).getLatLngs() as L.LatLng[][];
      const ring = latlngs[0].map((ll: L.LatLng) => [ll.lng, ll.lat]);
      ring.push(ring[0]);
      onComplete([ring]);
    };
    map.on(L.Draw.Event.CREATED, handler);
    return () => {
      draw.disable();
      map.off(L.Draw.Event.CREATED, handler);
    };
  }, [map, onComplete]);
  return null;
}

function MapController({ focusedAlertId, fields }: { focusedAlertId?: number | null; fields: FieldGeo[] }) {
  const map = useMap();
  useEffect(() => {
    if (focusedAlertId && fields.length > 0) {
      const f = fields.find((x) => x.id === focusedAlertId);
      if (f?.geometry?.coordinates?.[0]?.length) {
        const coords = f.geometry.coordinates[0] as [number, number][];
        const bounds = L.latLngBounds(coords);
        map.fitBounds(bounds, { padding: [50, 50], maxZoom: 16 });
      }
    }
  }, [focusedAlertId, fields, map]);
  return null;
}

export function FarmMap({ fields, devices = [], center = [30.5, 114.3], zoom = 12, height = 400, 
  onFieldClick, onMapClick, onFieldDraw, onDeviceMove, focusedAlertId, className }: FarmMapProps) {
  const [mode, setMode] = useState<MapMode>('health');
  const [selectedField, setSelectedField] = useState<FieldGeo | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [drawnCoords, setDrawnCoords] = useState<number[][][] | null>(null);
  const isDrawingRef = useRef(false);

  isDrawingRef.current = isDrawing;

  mapClickCb.current = onMapClick ?? null;

  const fieldsRef = useRef<FieldGeo[]>([]);

  const handleWhenReady = useCallback((m: any) => {
    if (!m?.target) return;
    m.target.on('click', (e: any) => {
      if (isDrawingRef.current) return;
      const latlng = { lat: e.latlng.lat, lng: e.latlng.lng };
      const result = findFieldAtPoint(latlng, fieldsRef.current);
      if (result?.onBoundary) {
        onFieldClickRef.current?.(result.field);
        return;
      }
      if (result && !result.onBoundary) {
        if (mapClickCb.current) {
          mapClickCb.current(latlng, result.field.id);
        } else {
          onFieldClickRef.current?.(result.field);
        }
        return;
      }
      mapClickCb.current?.(latlng);
    });
  }, []);

  const handleDrawComplete = useCallback((coords: number[][][]) => {
    setDrawnCoords(coords);
    onFieldDraw?.(coords);
    setIsDrawing(false);
  }, [onFieldDraw]);

  const cancelDraw = useCallback(() => {
    setDrawnCoords(null);
    setIsDrawing(false);
  }, []);

  drawCancelCb.current = cancelDraw;

  const onFieldClickRef = useRef(onFieldClick);
  onFieldClickRef.current = onFieldClick;
  const onDeviceMoveRef = useRef(onDeviceMove);
  onDeviceMoveRef.current = onDeviceMove;

  const handleFieldClick = useCallback((field: FieldGeo) => {
    setSelectedField(field);
    onFieldClickRef.current?.(field);
  }, []);

  const totalAlerts = fields.reduce((sum, field) => sum + (field.alerts ?? 0), 0);
  const fieldPolygons = fields.filter((field) => field.geometry);
  fieldsRef.current = fieldPolygons;
  const fieldPoints = fields.filter((field) => !field.geometry && field.latitude != null && field.longitude != null);
  const selectedHighlight = (field: FieldGeo) => selectedField?.id === field.id ? { color: '#2563eb', fillColor: '#2563eb33', weight: 4, dashArray: '3' } : {};

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

    layer.on('mouseover', () => {
      hoveredFieldIdRef.current = field.id;
      layer.setStyle({ weight: 3, fillOpacity: 0.5 });
    });
    layer.on('mouseout', () => {
      hoveredFieldIdRef.current = null;
      layer.setStyle({ weight: 2, fillOpacity: 0.3 });
    });
  };

  return (
    <div className={cn('flex flex-col lg:flex-row gap-0 rounded-lg border border-border-default overflow-hidden', className)}>
      <style>{`
        .leaflet-popup-content-wrapper {
          background: #1e293b !important;
          color: #e2e8f0 !important;
          border-radius: 8px !important;
          box-shadow: 0 4px 16px rgba(0,0,0,0.4) !important;
        }
        .leaflet-popup-tip {
          background: #1e293b !important;
        }
        .leaflet-popup-close-button {
          color: #64748b !important;
        }
      `}</style>
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
          <button onClick={() => setIsDrawing(!isDrawing)} className={cn('px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap backdrop-blur-sm', isDrawing ? 'bg-critical text-white' : 'bg-surface-card/90 text-text-secondary hover:text-text-primary border border-border-default')}>
            {isDrawing ? '✕ Cancel' : '✎ Draw Field'}
          </button>
        </div>
        <div className="absolute top-3 right-3 z-[1000] w-72 rounded-2xl border border-border-default bg-surface-card/95 p-3 text-xs shadow-lg backdrop-blur-sm">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[11px] uppercase tracking-[0.22em] text-text-muted">Map summary</p>
              <p className="text-sm font-semibold text-text-primary">{fields.length} fields · {devices.length} devices</p>
            </div>
            <div className="rounded-full bg-success/10 px-2 py-1 text-[11px] font-semibold text-success">{totalAlerts} Alerts</div>
          </div>
          <div className="mt-3 space-y-2 text-[11px] text-text-muted">
            <div>{modeConfig[mode].desc}</div>
            <div className="grid grid-cols-2 gap-2">
              {mode === 'health' && (
                <>
                  <span className="rounded-full bg-[#4caf50] px-2 py-1 text-white">Healthy</span>
                  <span className="rounded-full bg-[#f59e0b] px-2 py-1 text-white">Warning</span>
                  <span className="rounded-full bg-[#ef4444] px-2 py-1 text-white">Critical</span>
                </>
              )}
              {mode === 'moisture' && (
                <>
                  <span className="rounded-full bg-[#ef4444] px-2 py-1 text-white">{'<30%'}</span>
                  <span className="rounded-full bg-[#f59e0b] px-2 py-1 text-white">30-49%</span>
                  <span className="rounded-full bg-[#4caf50] px-2 py-1 text-white">50-69%</span>
                  <span className="rounded-full bg-[#2196f3] px-2 py-1 text-white">70%+</span>
                </>
              )}
              {mode === 'irrigation' && (
                <span className="col-span-2 rounded-full bg-[#2196f3] px-2 py-1 text-white">Irrigation zones</span>
              )}
              {mode === 'diagnostics' && (
                <span className="col-span-2 rounded-full bg-[#64748b] px-2 py-1 text-white">Device diagnostics</span>
              )}
            </div>
          </div>
        </div>

        <MapContainer center={center} zoom={zoom} style={{ height: '100%', width: '100%' }} zoomControl={false} scrollWheelZoom={true} whenReady={handleWhenReady as any}>
          <TileLayer url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}" attribution='&copy; <a href="https://www.esri.com/">Esri</a>' />
          {isDrawing && <DrawController onComplete={handleDrawComplete} />}
          {drawnCoords && <>
            <GeoJSON key="draw-outline" data={{ type: 'Polygon', coordinates: drawnCoords } as any} style={{ color: '#ffffff', weight: 5, fillOpacity: 0 }} />
            <GeoJSON key="draw-fill" data={{ type: 'Polygon', coordinates: drawnCoords } as any} style={{ color: '#f97316', weight: 2, dashArray: '8, 4', fillColor: '#f9731633', fillOpacity: 0.2 }} />
          </>}
          <MapController focusedAlertId={focusedAlertId} fields={fieldPolygons} />
          {fieldPolygons.map((field) => (
            <GeoJSON
              key={field.id}
              data={field.geometry as any}
              style={() => ({ ...colorByMode(field), ...selectedHighlight(field) })}
              onEachFeature={(_, layer) => onEachFeature(field, layer as L.Path)}
            />
          ))}
          {fieldPoints.map((field) => (
            <Marker key={`field-${field.id}`} position={[field.latitude!, field.longitude!]} eventHandlers={{ click: () => handleFieldClick(field) }}>
              <Popup>
                <div className="text-sm">
                  <strong>{field.name}</strong><br />
                  <span className="text-xs">Field center</span><br />
                  {field.soil_moisture != null && <>Moisture: {field.soil_moisture}%<br /></>}
                  <span className={field.health === 'healthy' ? 'text-green-600' : field.health === 'warning' ? 'text-yellow-600' : 'text-red-600'}>{field.health}</span>
                </div>
              </Popup>
            </Marker>
          ))}
          {devices.filter(d => d.latitude != null && d.longitude != null).map((d) => {
            const typeIcon = d.type === 'controller' ? '🔧' : d.type === 'both' ? '📡' : '🌡️';
            const fieldName = fields.find(f => f.id === d.field_id)?.name;
            const markerColor = d.status === 'online' ? '#22c55e' : '#ef4444';
            const deviceIcon = L.divIcon({
              className: '',
              html: `<div style="width:14px;height:14px;border-radius:50%;background:${markerColor};border:2px solid white;box-shadow:0 1px 4px rgba(0,0,0,0.4);"></div>`,
              iconSize: [14, 14],
              iconAnchor: [7, 7],
            });
            const lastSeen = d.last_heartbeat ? (() => {
              const diff = Date.now() - new Date(d.last_heartbeat).getTime();
              const mins = Math.floor(diff / 60000);
              if (mins < 1) return 'Just now';
              if (mins < 60) return `${mins} min ago`;
              const hrs = Math.floor(mins / 60);
              if (hrs < 24) return `${hrs} hr ago`;
              return `${Math.floor(hrs / 24)} days ago`;
            })() : null;
            return (
              <Marker key={d.id} position={[d.latitude, d.longitude]} icon={deviceIcon} draggable={!!onDeviceMove} eventHandlers={{
                dragend: (e) => {
                  const pos = e.target.getLatLng();
                  onDeviceMoveRef.current?.(d.id, { lat: pos.lat, lng: pos.lng });
                },
              }}>
                <Popup>
                  <div className="text-sm min-w-[180px]">
                    <div className="flex items-center gap-1.5 mb-1">
                      <span>{typeIcon}</span>
                      <strong className="text-text-primary truncate">{d.name}</strong>
                    </div>
                    <div className="border-t border-border-default my-1" />
                    <div className="flex items-center gap-1.5 text-xs">
                      <span className={cn('w-2 h-2 rounded-full inline-block', d.status === 'online' ? 'bg-green-500' : 'bg-red-500')} />
                      <span className={d.status === 'online' ? 'text-green-600' : 'text-red-600'}>{d.status}</span>
                      <span className="text-text-muted ml-auto">{d.type ?? 'sensor'}</span>
                    </div>
                    {fieldName && <div className="text-xs text-text-muted mt-0.5">📍 {fieldName}</div>}
                    {d.latestTemp != null && <div className="text-xs text-text-secondary mt-0.5">{d.latestTemp}°C</div>}
                    <div className="text-[10px] text-text-muted mt-0.5 font-mono">ID: {d.device_id}</div>
                    {lastSeen && <div className="text-[10px] text-text-muted mt-0.5">Last seen: {lastSeen}</div>}
                    <div className="text-[10px] text-text-muted mt-1 italic">Drag to move</div>
                  </div>
                </Popup>
              </Marker>
            );
          })}
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
