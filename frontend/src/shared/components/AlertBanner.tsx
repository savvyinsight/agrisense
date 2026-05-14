import { useTranslation } from 'react-i18next';
import { cn } from '@/shared/lib/cn';
import type { AlertSeverity } from '@/shared/types';

interface AlertBannerProps {
  title: string; message?: string; severity: AlertSeverity; timestamp?: string;
  recommendedAction?: string; onClick?: () => void; onAcknowledge?: () => void;
}

const severityConfig: Record<AlertSeverity, { border: string; bg: string; icon: string; labelKey: string }> = {
  critical: { border: 'border-l-critical', bg: 'bg-critical-bg', icon: '🔴', labelKey: 'component.critical' },
  high: { border: 'border-l-warning', bg: 'bg-warning-bg', icon: '🟠', labelKey: 'component.high' },
  medium: { border: 'border-l-warning', bg: 'bg-warning-bg', icon: '🟡', labelKey: 'component.medium' },
  low: { border: 'border-l-info', bg: 'bg-info-bg', icon: '🔵', labelKey: 'component.low' },
};

export function AlertBanner({ title, message, severity, recommendedAction, onClick, onAcknowledge }: AlertBannerProps) {
  const { t } = useTranslation();
  const config = severityConfig[severity];

  return (
    <div onClick={onClick} className={cn('flex items-start gap-3 p-4 md:p-3 rounded-lg border border-border-default border-l-[3px] min-h-[56px] md:min-h-0', config.border, config.bg, onClick && 'cursor-pointer hover:bg-surface-hover transition-colors')}>
      <span className="text-base mt-0.5">{config.icon}</span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-text-muted">{t(config.labelKey)}</span>
        </div>
        <p className="text-sm font-medium text-text-primary mt-0.5">{title}</p>
        {message && <p className="text-xs text-text-secondary mt-0.5">{message}</p>}
        {recommendedAction && (
          <p className="text-xs text-warning mt-1.5"><span className="font-medium">{t('component.recommendation')}</span> {recommendedAction}</p>
        )}
      </div>
      {onAcknowledge && (
        <button onClick={(e) => { e.stopPropagation(); onAcknowledge(); }} className="shrink-0 text-xs px-4 py-2 md:px-2.5 md:py-1 min-h-[44px] md:min-h-0 rounded-md bg-surface-hover text-text-secondary hover:text-text-primary hover:bg-border-default transition-colors">
          {t('component.acknowledge')}
        </button>
      )}
    </div>
  );
}
