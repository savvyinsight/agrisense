export const mapClickCb: { current: ((latlng: { lat: number; lng: number }, fieldId?: number) => void) | null } = { current: null };
export const drawCancelCb: { current: (() => void) | null } = { current: null };
export const hoveredFieldIdRef: { current: number | null } = { current: null };
