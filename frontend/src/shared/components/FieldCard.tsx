import { useTranslation } from 'react-i18next';
import { cn } from '@/shared/lib/cn';
import type { Field } from '@/shared/types';

interface FieldCardProps { field: Field; onClick?: () => void }

export function FieldCard({ field, onClick }: FieldCardProps) {
  const { t } = useTranslation();
  const healthColor: Record<string, string> = { healthy: 'text-success', warning: 'text-warning', critical: 'text-critical' };
  const healthBg: Record<string, string> = { healthy: 'bg-success-bg border-l-success', warning: 'bg-warning-bg border-l-warning', critical: 'bg-critical-bg border-l-critical' };

  return (
    <div onClick={onClick} className={cn('p-4 rounded-lg border border-border-default border-l-[3px] transition-colors min-h-[120px] md:min-h-0', healthBg[field.health], onClick && 'cursor-pointer hover:bg-surface-hover')}>
      <div className="flex items-center justify-between mb-3">
        <span className="font-semibold text-text-primary">{field.name}</span>
        {field.crop && <span className="text-xs text-text-muted">{field.crop}</span>}
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div><span className="text-xs text-text-muted block">{t('component.moisture')}</span><span className={cn('text-sm font-bold tabular-nums', healthColor[field.health])}>{field.soil_moisture ?? '--'}%</span></div>
        <div><span className="text-xs text-text-muted block">{t('component.temp')}</span><span className="text-sm font-bold tabular-nums text-text-primary">{field.temperature ?? '--'}°C</span></div>
        <div><span className="text-xs text-text-muted block">{t('component.humidity')}</span><span className="text-sm font-bold tabular-nums text-text-primary">{field.humidity ?? '--'}%</span></div>
      </div>
      {field.last_irrigation && <span className="text-xs text-text-muted block mt-3">{t('component.lastIrrigation', { date: new Date(field.last_irrigation).toLocaleDateString() })}</span>}
    </div>
  );
}
