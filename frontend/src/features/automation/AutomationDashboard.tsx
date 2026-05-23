import { useEffect, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useWebSocket } from '@/shared/hooks/useWebSocket';
import { useAuthStore } from '@/shared/stores/authStore';
import { StatusCard } from '@/shared/components/StatusCard';
import { CommandStatusStepper } from '@/shared/components/CommandStatusStepper';
import { toast } from '@/shared/components/Toast';
import { getAutomationDashboard, setGlobalAutomation } from '@/features/automation/api';
import type { AutomationDashboardData, AutomationExecution, FieldAutomationSummary, WebSocketMessage, CommandStatus } from '@/shared/types/api';

const statusColor: Record<CommandStatus, string> = {
  pending: 'text-text-muted', sent: 'text-info', delivered: 'text-warning',
  executed: 'text-success', failed: 'text-critical',
};

function timeAgo(dateStr?: string): string {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function AutomationDashboard() {
  const { t } = useTranslation();
  const token = useAuthStore((s) => s.token);
  const [data, setData] = useState<AutomationDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await getAutomationDashboard();
    if (res.success && res.data) setData(res.data);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  useWebSocket(token, useCallback((msg: WebSocketMessage) => {
    if (msg.type === 'automation_executed') {
      load(); // Refresh dashboard on execution
    }
  }, [load]));

  const handleGlobalToggle = async () => {
    if (!data) return;
    const newValue = !data.global_automation_enabled;
    setToggling(true);
    const res = await setGlobalAutomation(newValue);
    if (res.success) {
      setData({ ...data, global_automation_enabled: newValue });
      toast('success', newValue ? t('automationDashboard.enabled') : t('automationDashboard.disabled'));
    } else {
      toast('error', res.error || 'Failed to toggle');
    }
    setToggling(false);
  };

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="h-8 w-48 rounded-lg bg-surface-card border border-border-default animate-pulse" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">{[1, 2, 3, 4].map((i) => <div key={i} className="h-24 rounded-lg bg-surface-card border border-border-default animate-pulse" />)}</div>
        <div className="h-64 rounded-lg bg-surface-card border border-border-default animate-pulse" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="max-w-6xl mx-auto">
        <div className="rounded-lg border border-border-default bg-surface-card p-8 text-center">
          <span className="text-3xl block mb-3">🔄</span>
          <p className="text-sm text-text-muted">Failed to load dashboard</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-text-primary">{t('automationDashboard.title')}</h1>
          <p className="text-sm text-text-muted mt-0.5">{t('automationDashboard.subtitle')}</p>
        </div>
        <button
          onClick={handleGlobalToggle}
          disabled={toggling}
          className={`relative inline-flex h-8 w-36 items-center rounded-full border transition-colors ${
            data.global_automation_enabled
              ? 'bg-success/20 border-success/40 text-success'
              : 'bg-surface-hover border-border-default text-text-muted'
          }`}
        >
          <span className={`inline-block h-6 w-6 rounded-full transition-transform ${data.global_automation_enabled ? 'translate-x-[120px] bg-success' : 'translate-x-1 bg-text-muted'}`} />
          <span className="absolute inset-0 flex items-center justify-center text-xs font-medium">
            {data.global_automation_enabled ? t('automationDashboard.globalOn') : t('automationDashboard.globalOff')}
          </span>
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatusCard label={t('automationDashboard.totalRules')} value={data.total_rules} icon="📋" />
        <StatusCard label={t('automationDashboard.activeRules')} value={data.active_rules} icon="✅" status="healthy" />
        <StatusCard label={t('automationDashboard.pausedRules')} value={data.paused_rules} icon="⏸" status={data.paused_rules > 0 ? 'warning' : undefined} />
        <StatusCard label={t('automationDashboard.failedCommands')} value={data.failed_rules} icon="❌" status={data.failed_rules > 0 ? 'critical' : undefined} />
      </div>

      {/* Recent Executions */}
      <div className="rounded-lg border border-border-default bg-surface-card p-5">
        <h2 className="text-sm font-semibold text-text-primary mb-4">{t('automationDashboard.recentExecutions')}</h2>
        {data.recent_executions.length === 0 ? (
          <p className="text-sm text-text-muted text-center py-4">{t('automationDashboard.noExecutions')}</p>
        ) : (
          <div className="space-y-2 max-h-80 overflow-y-auto">
            {data.recent_executions.map((exec) => (
              <ExecutionRow key={exec.id} execution={exec} t={t} />
            ))}
          </div>
        )}
      </div>

      {/* Per-Field Summary */}
      {data.field_summaries.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-text-primary mb-3">{t('automationDashboard.fieldSummary')}</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {data.field_summaries.map((field) => (
              <FieldCard key={field.field_id} field={field} t={t} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function ExecutionRow({ execution: e, t }: { execution: AutomationExecution; t: (k: string) => string }) {
  const triggeredByKey: Record<string, string> = {
    sensor: 'automationDashboard.triggeredBySensor',
    schedule: 'automationDashboard.triggeredBySchedule',
    manual: 'automationDashboard.triggeredByManual',
  };
  return (
    <div className="flex items-center justify-between p-3 rounded-lg bg-surface-base border border-border-default">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-text-primary truncate">{e.rule_name}</span>
          <span className={`text-[10px] font-medium ${statusColor[e.status]}`}>{e.status}</span>
        </div>
        <div className="flex items-center gap-3 mt-0.5">
          <span className="text-xs text-text-muted">{e.command}</span>
          {e.device_name && <span className="text-xs text-text-muted">→ {e.device_name}</span>}
          <span className="text-[10px] text-text-muted">{t(triggeredByKey[e.triggered_by] || 'automationDashboard.triggeredByManual')}</span>
        </div>
      </div>
      <div className="flex items-center gap-3 shrink-0">
        <CommandStatusStepper status={e.status} />
        <span className="text-[10px] text-text-muted">{timeAgo(e.triggered_at)}</span>
      </div>
    </div>
  );
}

function FieldCard({ field: f, t }: { field: FieldAutomationSummary; t: (k: string) => string }) {
  const statusDot = f.last_execution_status === 'executed' ? 'bg-success' :
    f.last_execution_status === 'failed' ? 'bg-critical' :
    f.last_execution_status === 'sent' ? 'bg-info' : 'bg-text-muted';

  return (
    <div className="rounded-lg border border-border-default bg-surface-card p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium text-text-primary">{f.field_name}</span>
        <div className={`w-2 h-2 rounded-full ${statusDot}`} />
      </div>
      <div className="grid grid-cols-2 gap-2 text-xs">
        <div>
          <span className="text-text-muted">{t('automationDashboard.activeRules')}: </span>
          <span className="text-text-primary font-medium">{f.active_rules}</span>
        </div>
        <div>
          <span className="text-text-muted">{t('automationDashboard.todayRuns')}: </span>
          <span className="text-text-primary font-medium">{f.total_executions_today}</span>
        </div>
      </div>
      {f.last_execution_at && (
        <p className="text-[10px] text-text-muted mt-2">{t('automationDashboard.lastRun')}: {timeAgo(f.last_execution_at)}</p>
      )}
    </div>
  );
}
