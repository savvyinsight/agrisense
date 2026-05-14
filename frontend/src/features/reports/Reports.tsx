import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

const reports = [
  { id: 1, titleKey: 'reports.dailyField', descKey: 'reports.dailyFieldDesc', icon: '📋', path: '/analytics' },
  { id: 2, titleKey: 'reports.irrigationSummary', descKey: 'reports.irrigationSummaryDesc', icon: '💧', path: '/irrigation' },
  { id: 3, titleKey: 'reports.envTrends', descKey: 'reports.envTrendsDesc', icon: '📈', path: '/analytics' },
  { id: 4, titleKey: 'reports.alertHistory', descKey: 'reports.alertHistoryDesc', icon: '⚡', path: '/alerts' },
  { id: 5, titleKey: 'reports.deviceHealth', descKey: 'reports.deviceHealthDesc', icon: '📡', path: '/devices' },
  { id: 6, titleKey: 'reports.weatherReport', descKey: 'reports.weatherReportDesc', icon: '☀', path: '/weather' },
];

export default function Reports() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-lg font-bold text-text-primary">{t('nav.reports')}</h1>
        <p className="text-sm text-text-muted mt-0.5">{t('analytics.subtitle')}</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {reports.map((r) => (
          <button
            key={r.id}
            onClick={() => navigate(r.path)}
            className="rounded-lg border border-border-default bg-surface-card p-5 text-left hover:bg-surface-hover transition-colors"
          >
            <span className="text-2xl block mb-3">{r.icon}</span>
            <h3 className="text-sm font-semibold text-text-primary mb-1">{t(r.titleKey)}</h3>
            <p className="text-xs text-text-muted">{t(r.descKey)}</p>
          </button>
        ))}
      </div>
    </div>
  );
}
