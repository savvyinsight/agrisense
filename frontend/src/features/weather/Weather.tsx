import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StatusCard } from '@/shared/components/StatusCard';
import { getCurrentWeather } from '@/features/weather/api';
import type { WeatherCurrent } from '@/features/weather/api';

const mockHourly = [
  { time: '09:00', temp: 22, rain: 0 }, { time: '10:00', temp: 23, rain: 0 }, { time: '11:00', temp: 24, rain: 0 }, { time: '12:00', temp: 26, rain: 10 },
  { time: '13:00', temp: 25, rain: 30 }, { time: '14:00', temp: 24, rain: 45 }, { time: '15:00', temp: 23, rain: 20 }, { time: '16:00', temp: 22, rain: 5 },
];

const mockDaily = [
  { day: 'Mon', high: 26, low: 18, rain: 30, icon: '⛅' }, { day: 'Tue', high: 28, low: 19, rain: 10, icon: '☀' },
  { day: 'Wed', high: 24, low: 17, rain: 60, icon: '🌧' }, { day: 'Thu', high: 22, low: 15, rain: 80, icon: '🌧' },
  { day: 'Fri', high: 25, low: 16, rain: 20, icon: '⛅' }, { day: 'Sat', high: 27, low: 18, rain: 5, icon: '☀' },
  { day: 'Sun', high: 29, low: 20, rain: 0, icon: '☀' },
];

export default function Weather() {
  const { t } = useTranslation();
  const [current, setCurrent] = useState<WeatherCurrent | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const c = await getCurrentWeather();
      if (c.success && c.data) setCurrent(c.data);
      setLoading(false);
    })();
  }, []);

  if (loading) {
    return <div className="max-w-7xl mx-auto space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">{[1, 2, 3, 4].map((i) => <div key={i} className="h-24 rounded-lg bg-surface-card border border-border-default animate-pulse" />)}</div>
    </div>;
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-lg font-bold text-text-primary">{t('weather.title')}</h1>
        <p className="text-sm text-text-muted mt-0.5">{t('weather.subtitle')}</p>
      </div>

      {current && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatusCard label={t('weather.temperature')} value={current.temperature ? `${current.temperature}°C` : '--'} status="info" icon="🌡" />
          <StatusCard label={t('weather.humidity')} value={current.humidity ? `${current.humidity}%` : '--'} status="info" icon="💧" />
          <StatusCard label={t('weather.rainfall')} value={`${current.rainfall_mm} ${t('weather.mm')}`} status="info" icon="🌧" subtitle={t('weather.today')} />
          <StatusCard label={t('weather.wind')} value={`${current.wind_speed} ${t('weather.kmh')}`} status="info" icon="💨" />
        </div>
      )}

      <div className="rounded-lg border border-border-default bg-surface-card p-4">
        <h2 className="text-sm font-semibold text-text-primary mb-4">{t('weather.todaysForecast')}</h2>
        <div className="flex gap-2 overflow-x-auto pb-2">
          {mockHourly.map((h) => (
            <div key={h.time} className="flex flex-col items-center gap-1.5 min-w-[60px] p-2 rounded-lg bg-surface-elevated">
              <span className="text-xs text-text-muted">{h.time}</span>
              <span className="text-lg">{h.rain > 30 ? '🌧' : h.rain > 0 ? '🌦' : '☀'}</span>
              <span className="text-sm font-bold tabular-nums text-text-primary">{h.temp}°</span>
              <span className="text-xs text-info-bright">{h.rain}%</span>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-lg border border-border-default bg-surface-card p-4">
        <h2 className="text-sm font-semibold text-text-primary mb-4">{t('weather.forecast7day')}</h2>
        <div className="space-y-1">
          {mockDaily.map((d) => (
            <div key={d.day} className="flex items-center gap-3 px-3 py-2 rounded-md hover:bg-surface-hover transition-colors">
              <span className="w-10 text-sm font-medium text-text-primary">{d.day}</span>
              <span className="text-lg w-8 text-center">{d.icon}</span>
              <div className="flex-1 flex items-center gap-2">
                <span className="text-sm font-bold tabular-nums text-text-primary w-8 text-right">{d.high}°</span>
                <div className="flex-1 h-1.5 bg-surface-elevated rounded-full overflow-hidden">
                  <div className="h-full bg-warning rounded-full" style={{ width: `${(d.high - 15) * 5}%` }} />
                </div>
                <span className="text-sm tabular-nums text-text-muted w-8">{d.low}°</span>
              </div>
              <span className="text-xs text-info-bright w-12 text-right">{d.rain}%</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
