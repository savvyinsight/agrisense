import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { TrendChart } from '@/shared/components/TrendChart';
import { cn } from '@/shared/lib/cn';

interface WaterEfficiencyMetricsProps {
  className?: string;
}

interface EfficiencyData {
  date: string;
  used: number;
  expected: number;
}

export function WaterEfficiencyMetrics({ className }: WaterEfficiencyMetricsProps) {
  const { t } = useTranslation();
  // Generate 90-day trend data
  const efficiencyData = useMemo(() => {
    const data: EfficiencyData[] = [];
    for (let i = 89; i >= 0; i--) {
      const date = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
      const expected = 2500 + Math.random() * 500; // 2500-3000L expected
      const used = expected * (0.85 + Math.random() * 0.15); // 85-100% of expected
      data.push({
        date: date.toLocaleDateString([], { month: 'short', day: 'numeric' }),
        used: Math.round(used),
        expected: Math.round(expected),
      });
    }
    return data;
  }, []);

  // Calculate metrics
  const metrics = useMemo(() => {
    const totalUsed = efficiencyData.reduce((sum, d) => sum + d.used, 0);
    const totalExpected = efficiencyData.reduce((sum, d) => sum + d.expected, 0);
    const efficiency = Math.round((totalUsed / totalExpected) * 100);
    const saved = totalExpected - totalUsed;
    const costPerLiter = 0.02; // $0.02 per liter (example)
    const costSavings = saved * costPerLiter;

    // Week-over-week comparison
    const recentWeek = efficiencyData.slice(-7).reduce((sum, d) => sum + d.used, 0);
    const previousWeek = efficiencyData.slice(-14, -7).reduce((sum, d) => sum + d.used, 0);
    const weekTrend = ((recentWeek - previousWeek) / previousWeek) * 100;

    return {
      totalUsed,
      totalExpected,
      efficiency,
      saved,
      costSavings,
      weekTrend,
      waterPerHectare: Math.round(totalUsed / 5), // Assume 5 hectares
    };
  }, [efficiencyData]);

  // Prepare chart data
  const chartData = useMemo(() => {
    return efficiencyData.map((d) => ({
      label: d.date,
      value: d.used,
      secondary: d.expected,
    }));
  }, [efficiencyData]);

  return (
    <div className={cn('rounded-lg border border-border-default bg-surface-card p-6', className)}>
      <h2 className="text-base font-semibold text-text-primary mb-6">{t('irrigation.efficiencyDashboard')}</h2>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
        {[
          {
            label: t('irrigation.efficiencyLabel'),
            value: `${metrics.efficiency}%`,
            unit: t('irrigation.vsExpected'),
            status: metrics.efficiency > 95 ? 'warning' : metrics.efficiency > 90 ? 'healthy' : 'critical',
            icon: '📊',
          },
          {
            label: t('irrigation.waterSaved'),
            value: `${(metrics.saved / 1000).toFixed(1)}k`,
            unit: t('irrigation.liters'),
            status: metrics.saved > 10000 ? 'healthy' : 'info',
            icon: '💰',
          },
          {
            label: t('irrigation.costSavings'),
            value: `$${metrics.costSavings.toFixed(0)}`,
            unit: t('irrigation.days90'),
            status: 'healthy',
            icon: '💵',
          },
          {
            label: t('irrigation.weekTrend'),
            value: metrics.weekTrend.toFixed(1) + '%',
            unit: weekTrendSign(metrics.weekTrend, t),
            status: metrics.weekTrend < 0 ? 'healthy' : 'warning',
            icon: metrics.weekTrend < 0 ? '↓' : '↑',
          },
        ].map((kpi) => (
          <div key={kpi.label} className="rounded-lg border border-border-default p-4 bg-surface-elevated">
            <div className="flex items-start justify-between mb-2">
              <span className="text-xs font-semibold text-text-muted uppercase tracking-wider">{kpi.label}</span>
              <span className="text-xl">{kpi.icon}</span>
            </div>
            <span className="text-2xl font-bold text-text-primary block">{kpi.value}</span>
            <span className="text-xs text-text-muted">{kpi.unit}</span>
          </div>
        ))}
      </div>

      {/* Trend Chart */}
      <div className="mb-8">
        <h3 className="text-sm font-semibold text-text-primary mb-4">{t('irrigation.waterUsageTrend')}</h3>
        <TrendChart
          data={chartData}
          type="area"
          color="#3b82f6"
          secondaryColor="#ef4444"
          showSecondary={true}
          unit="L"
          height={250}
        />
        <div className="flex gap-4 mt-4 text-xs">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-blue-500" />
            <span className="text-text-muted">{t('irrigation.actualUsage')}</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-red-500" />
            <span className="text-text-muted">{t('irrigation.expectedUsage')}</span>
          </div>
        </div>
      </div>

      {/* Weekly Breakdown Table */}
      <div>
        <h3 className="text-sm font-semibold text-text-primary mb-4">{t('irrigation.weeklySummary')}</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border-default">
                <th className="text-left py-2 px-3 font-semibold text-text-secondary">{t('irrigation.week')}</th>
                <th className="text-right py-2 px-3 font-semibold text-text-secondary">{t('irrigation.used')}</th>
                <th className="text-right py-2 px-3 font-semibold text-text-secondary">{t('irrigation.expected')}</th>
                <th className="text-right py-2 px-3 font-semibold text-text-secondary">{t('irrigation.efficiencyLabel')}</th>
                <th className="text-right py-2 px-3 font-semibold text-text-secondary">{t('irrigation.savings')}</th>
              </tr>
            </thead>
            <tbody>
              {[
                { week: t('irrigation.last7days'), used: efficiencyData.slice(-7).reduce((s, d) => s + d.used, 0), expected: efficiencyData.slice(-7).reduce((s, d) => s + d.expected, 0) },
                { week: t('irrigation.week2'), used: efficiencyData.slice(-14, -7).reduce((s, d) => s + d.used, 0), expected: efficiencyData.slice(-14, -7).reduce((s, d) => s + d.expected, 0) },
                { week: t('irrigation.week3'), used: efficiencyData.slice(-21, -14).reduce((s, d) => s + d.used, 0), expected: efficiencyData.slice(-21, -14).reduce((s, d) => s + d.expected, 0) },
                { week: t('irrigation.week4'), used: efficiencyData.slice(-28, -21).reduce((s, d) => s + d.used, 0), expected: efficiencyData.slice(-28, -21).reduce((s, d) => s + d.expected, 0) },
              ].map((row) => {
                const eff = Math.round((row.used / row.expected) * 100);
                const savings = row.expected - row.used;
                return (
                  <tr key={row.week} className="border-b border-border-default hover:bg-surface-hover">
                    <td className="py-2 px-3 text-text-primary">{row.week}</td>
                    <td className="text-right py-2 px-3 text-text-primary font-semibold">
                      {(row.used / 1000).toFixed(1)}k L
                    </td>
                    <td className="text-right py-2 px-3 text-text-muted">
                      {(row.expected / 1000).toFixed(1)}k L
                    </td>
                    <td
                      className={cn('text-right py-2 px-3 font-semibold', eff > 95 ? 'text-warning' : eff > 90 ? 'text-success' : 'text-critical')}
                    >
                      {eff}%
                    </td>
                    <td className="text-right py-2 px-3 text-success font-semibold">
                      ${(savings * 0.02).toFixed(0)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function weekTrendSign(trend: number, t: (key: string) => string): string {
  if (trend < 0) return `${Math.abs(trend).toFixed(1)}% ${t('irrigation.less')}`;
  if (trend > 0) return `${trend.toFixed(1)}% ${t('irrigation.more')}`;
  return t('irrigation.noChange');
}
