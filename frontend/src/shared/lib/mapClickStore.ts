export const mapClickCb: { current: ((latlng: { lat: number; lng: number }) => void) | null } = { current: null };
export const drawCancelCb: { current: (() => void) | null } = { current: null };
