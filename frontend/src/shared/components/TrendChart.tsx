import { LineChart, Line, AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

type ChartType = 'line' | 'area' | 'bar';

interface TrendChartProps {
  data: { label: string; value: number; secondary?: number }[];
  type?: ChartType;
  color?: string;
  secondaryColor?: string;
  unit?: string;
  height?: number;
  showGrid?: boolean;
  showSecondary?: boolean;
}

const tooltipStyle = {
  contentStyle: { background: '#1e2130', border: '1px solid #2a2e3e', borderRadius: 8, fontSize: 13 },
  labelStyle: { color: '#e8eaed' },
  itemStyle: { color: '#9ca3af' },
};

export function TrendChart({ data, type = 'line', color = '#2E7D32', secondaryColor = '#64748b', unit = '', height = 180, showGrid = true, showSecondary = false }: TrendChartProps) {
  if (data.length === 0) {
    return (
      <div className="h-full flex items-center justify-center text-xs text-text-muted">
        No data available
      </div>
    );
  }

  const axisProps = { stroke: '#6b7280', fontSize: 11, tickLine: false, axisLine: false };

  const renderChart = () => {
    switch (type) {
      case 'area':
        return (
          <AreaChart data={data}>
            {showGrid && <CartesianGrid strokeDasharray="3 3" stroke="#2a2e3e" vertical={false} />}
            <XAxis dataKey="label" {...axisProps} />
            <YAxis {...axisProps} unit={unit} width={40} />
            <Tooltip {...tooltipStyle} />
            <Area type="monotone" dataKey="value" stroke={color} fill={color + '20'} strokeWidth={2} dot={false} />
            {showSecondary && <Area type="monotone" dataKey="secondary" stroke={secondaryColor} fill={secondaryColor + '20'} strokeWidth={2} dot={false} />}
          </AreaChart>
        );
      case 'bar':
        return (
          <BarChart data={data}>
            {showGrid && <CartesianGrid strokeDasharray="3 3" stroke="#2a2e3e" vertical={false} />}
            <XAxis dataKey="label" {...axisProps} />
            <YAxis {...axisProps} unit={unit} width={40} />
            <Tooltip {...tooltipStyle} />
            <Bar dataKey="value" fill={color} radius={[3, 3, 0, 0]} />
          </BarChart>
        );
      default:
        return (
          <LineChart data={data}>
            {showGrid && <CartesianGrid strokeDasharray="3 3" stroke="#2a2e3e" vertical={false} />}
            <XAxis dataKey="label" {...axisProps} />
            <YAxis {...axisProps} unit={unit} width={40} />
            <Tooltip {...tooltipStyle} />
            <Line type="monotone" dataKey="value" stroke={color} strokeWidth={2} dot={false} />
            {showSecondary && <Line type="monotone" dataKey="secondary" stroke={secondaryColor} strokeWidth={2} dot={false} />}
          </LineChart>
        );
    }
  };

  return (
    <ResponsiveContainer width="100%" height={height}>
      {renderChart()}
    </ResponsiveContainer>
  );
}

// Generate mock time-series data
export function generateTrendData(days: number, baseValue: number, variance: number, opts?: { secondary?: { base: number; variance: number } }): { label: string; value: number; secondary?: number }[] {
  const now = new Date();
  const data: { label: string; value: number; secondary?: number }[] = [];
  for (let i = days; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const label = days <= 1 ? d.getHours() + ':00' : d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    const value = Math.round((baseValue + (Math.random() - 0.5) * variance) * 10) / 10;
    const secondary = opts?.secondary ? Math.round((opts.secondary.base + (Math.random() - 0.5) * opts.secondary.variance) * 10) / 10 : undefined;
    data.push({ label, value, secondary });
  }
  return data;
}
