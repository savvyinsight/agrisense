import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';

/**
 * farmStore - Centralized store for farm context selection
 * 
 * Enables cross-feature consistency:
 * - Dashboard can select a field → Irrigation page shows that field's zones
 * - Alerts can filter by field → Dashboard highlights the same field
 * - Map click selects field → Navigation updates, components re-render
 * 
 * Usage:
 *   const { selectedFieldId, selectedZoneId, setSelectedField } = useFarmStore();
 */

interface FarmStore {
  // Selected context for cross-feature consistency
  selectedFieldId: number | null;
  selectedZoneId: number | null;
  
  // Set selected field (e.g., from dashboard click)
  setSelectedField: (fieldId: number) => void;
  
  // Set selected zone (e.g., from irrigation heatmap click)
  setSelectedZone: (zoneId: number) => void;
  
  // Clear selection
  clearSelection: () => void;
  
  // View mode (affects dashboard layout)
  viewMode: 'overview' | 'detail';
  setViewMode: (mode: 'overview' | 'detail') => void;
}

export const useFarmStore = create<FarmStore>()(
  subscribeWithSelector((set) => ({
    selectedFieldId: null,
    selectedZoneId: null,
    viewMode: 'overview',

    setSelectedField: (fieldId: number) =>
      set((state) => ({
        selectedFieldId: state.selectedFieldId === fieldId ? null : fieldId,
        selectedZoneId: null, // Clear zone when field changes
      })),

    setSelectedZone: (zoneId: number) =>
      set((state) => ({
        selectedZoneId: state.selectedZoneId === zoneId ? null : zoneId,
      })),

    clearSelection: () =>
      set({
        selectedFieldId: null,
        selectedZoneId: null,
        viewMode: 'overview',
      }),

    setViewMode: (mode: 'overview' | 'detail') =>
      set({ viewMode: mode }),
  }))
);

export default useFarmStore;
