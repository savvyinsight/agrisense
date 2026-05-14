import { cn } from '@/shared/lib/cn';

interface StatusCardProps {
  label: string; value: string | number; status?: 'healthy' | 'warning' | 'critical' | 'info';
  icon?: string; subtitle?: string; onClick?: () => void;
}

const statusStyles: Record<string, string> = {
  healthy: 'border-l-success bg-success-bg', warning: 'border-l-warning bg-warning-bg',
  critical: 'border-l-critical bg-critical-bg', info: 'border-l-info bg-info-bg',
};
const valueStyles: Record<string, string> = {
  healthy: 'text-success', warning: 'text-warning', critical: 'text-critical', info: 'text-info-bright',
};

export function StatusCard({ label, value, status = 'info', icon, subtitle, onClick }: StatusCardProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex flex-col gap-1 p-4 md:p-4 rounded-lg border border-border-default border-l-[3px] text-left transition-colors hover:bg-surface-hover',
        'min-h-[88px] md:min-h-0', // larger tap target on mobile
        statusStyles[status], onClick && 'cursor-pointer',
      )}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-text-secondary uppercase tracking-wider">{label}</span>
        {icon && <span className="text-sm">{icon}</span>}
      </div>
      <span className={cn('text-2xl font-bold tabular-nums', valueStyles[status])}>{value}</span>
      {subtitle && <span className="text-xs text-text-muted">{subtitle}</span>}
    </button>
  );
}
