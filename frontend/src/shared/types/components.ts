import { ReactNode } from 'react';
import { User } from './api';

// Auth Context Types
export interface AuthContextType {
  user: User | null;
  setUser: (user: User | null) => void;
  loading: boolean;
  isAdmin: () => boolean;
  isViewer: () => boolean;
}

// Component Props Types
export interface PrivateRouteProps {
  children: ReactNode;
}

export interface AdminRouteProps {
  children: ReactNode;
}

export interface ComingSoonProps {
  title: string;
}

export interface LayoutProps {
  children: ReactNode;
}

export interface DeviceCardProps {
  device: any;
  liveTemp?: number;
  onClick?: () => void;
}

export interface SensorChartProps {
  deviceId: string;
  deviceName: string;
}

export interface SensorSelectorProps {
  selected: string;
  onSelect: (sensorType: string) => void;
}

export interface AlertPanelProps {
  open: boolean;
  onClose: () => void;
  liveAlert?: any;
}

export interface SkeletonProps {
  variant?: 'text' | 'rectangular';
  width?: string | number;
  height?: string | number;
}

export interface ErrorBoundaryProps {
  children: ReactNode;
}

export interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}
