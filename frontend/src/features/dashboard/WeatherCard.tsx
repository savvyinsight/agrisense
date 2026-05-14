import { useTranslation } from 'react-i18next';
import type { WeatherCurrent } from '@/features/weather/api';
import { cn } from '@/shared/lib/cn';

interface WeatherCardProps {
  weather: WeatherCurrent | null;
  onClick?: () => void;
}

export function WeatherCard({ weather, onClick }: WeatherCardProps) {
  const { t } = useTranslation();

  if (!weather) {
    return (
      <div className="rounded-lg border border-border-default bg-surface-card p-4 text-center text-text-muted">
        {t('common.loading')}...
      </div>
    );
  }

  // Risk calculation logic
  const getRiskLevel = (): { level: 'safe' | 'caution' | 'critical'; color: string; label: string } => {
    const temp = weather.temperature || 0;
    const forecast = weather.forecast?.toLowerCase() || '';

    if (forecast === 'storm') {
      return { level: 'critical', color: 'bg-critical text-white', label: t('dashboard.riskCritical') };
    }

    if (temp > 35) {
      return { level: 'critical', color: 'bg-critical text-white', label: t('dashboard.riskCritical') };
    }

    if (temp > 32) {
      return { level: 'caution', color: 'bg-warning text-white', label: t('dashboard.riskCaution') };
    }

    return { level: 'safe', color: 'bg-success text-white', label: t('dashboard.riskSafe') };
  };

  // Get forecast emoji
  const getForecastEmoji = (): string => {
    const forecast = weather.forecast?.toLowerCase() || '';
    switch (forecast) {
      case 'sunny':
        return '☀';
      case 'cloudy':
        return '☁';
      case 'rainy':
        return '🌧';
      case 'storm':
        return '⛈';
      default:
        return '☀';
    }
  };

  const risk = getRiskLevel();
  const statusStyles: Record<string, string> = {
    safe: 'border-l-success bg-success-bg',
    caution: 'border-l-warning bg-warning-bg',
    critical: 'border-l-critical bg-critical-bg',
  };

  return (
    <button
      onClick={onClick}
      className={cn(
        'flex flex-col gap-3 p-4 md:p-4 rounded-lg border border-border-default border-l-[3px] text-left transition-colors hover:bg-surface-hover',
        'min-h-[120px]',
        statusStyles[risk.level],
        onClick && 'cursor-pointer',
      )}
    >
      {/* Header: Icon, Temp, Risk Badge */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-3xl">{getForecastEmoji()}</span>
          <div>
            <span className="text-xs font-medium text-text-secondary uppercase tracking-wider block">{t('dashboard.weatherRisk')}</span>
            <span className="text-2xl font-bold tabular-nums text-text-primary">
              {weather.temperature ? `${Math.round(weather.temperature)}°C` : '--'}
            </span>
          </div>
        </div>
        <div className={cn('px-2 py-1 rounded text-xs font-semibold whitespace-nowrap', risk.color)}>
          {risk.label}
        </div>
      </div>

      {/* Details: Humidity, Rain, Heat Index */}
      <div className="grid grid-cols-3 gap-2 text-xs">
        <div>
          <span className="text-text-muted block">{t('weather.humidity')}</span>
          <span className="font-semibold text-text-primary">
            {weather.humidity ? `${weather.humidity}%` : '--'}
          </span>
        </div>
        <div>
          <span className="text-text-muted block">{t('weather.rainfall')}</span>
          <span className="font-semibold text-text-primary">
            {`${weather.rainfall_mm} ${t('weather.mm')}`}
          </span>
        </div>
        {weather.heat_index !== undefined && (
          <div>
            <span className="text-text-muted block">{t('dashboard.heatIndex')}</span>
            <span className="font-semibold text-text-primary">{Math.round(weather.heat_index)}°C</span>
          </div>
        )}
      </div>

      {/* UV Index if available */}
      {weather.uv_index !== undefined && (
        <div className="pt-2 border-t border-border-default">
          <div className="flex items-center justify-between text-xs">
            <span className="text-text-muted">{t('dashboard.uvIndex')}</span>
            <span className={cn(
              'font-semibold',
              weather.uv_index >= 8 ? 'text-critical' :
              weather.uv_index >= 6 ? 'text-warning' :
              'text-success'
            )}>
              {Math.round(weather.uv_index)} / 11
            </span>
          </div>
        </div>
      )}
    </button>
  );
}
