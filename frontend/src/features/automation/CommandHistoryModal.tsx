import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal } from '@/shared/components/Modal';
import { CommandStatusStepper } from '@/shared/components/CommandStatusStepper';
import { toast } from '@/shared/components/Toast';
import { getCommandHistory, retryCommand } from '@/features/automation/api';
import type { Command, CommandStatus } from '@/shared/types/api';

interface CommandHistoryModalProps {
  open: boolean;
  onClose: () => void;
  ruleId: number;
  ruleName: string;
}

const statusColor: Record<CommandStatus, string> = {
  pending: 'bg-surface-hover text-text-muted border-border-default',
  sent: 'bg-info-bg text-info border-info/30',
  delivered: 'bg-warning-bg text-warning border-warning/30',
  executed: 'bg-success-bg text-success border-success/30',
  failed: 'bg-critical-bg text-critical border-critical/30',
};

function formatTime(dateStr?: string): string {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function formatDate(dateStr?: string): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

export function CommandHistoryModal({ open, onClose, ruleId, ruleName }: CommandHistoryModalProps) {
  const { t } = useTranslation();
  const [commands, setCommands] = useState<Command[]>([]);
  const [loading, setLoading] = useState(true);
  const [retryingId, setRetryingId] = useState<number | null>(null);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    getCommandHistory(ruleId).then((res) => {
      if (res.success && res.data) setCommands(res.data.commands || []);
      setLoading(false);
    });
  }, [open, ruleId]);

  const handleRetry = async (cmd: Command) => {
    setRetryingId(cmd.id);
    const res = await retryCommand(cmd.id);
    if (res.success) {
      toast('success', t('automation.commandRetried'));
      const refreshed = await getCommandHistory(ruleId);
      if (refreshed.success && refreshed.data) setCommands(refreshed.data.commands || []);
    } else {
      toast('error', res.error || t('automation.retryFailed'));
    }
    setRetryingId(null);
  };

  return (
    <Modal open={open} onClose={onClose} title={`${t('automation.commandHistory')} — ${ruleName}`}>
      {loading ? (
        <div className="space-y-3">{[1, 2, 3].map((i) => <div key={i} className="h-16 rounded-lg bg-surface-card border border-border-default animate-pulse" />)}</div>
      ) : commands.length === 0 ? (
        <div className="text-center py-8">
          <span className="text-2xl block mb-2">📋</span>
          <p className="text-sm text-text-muted">{t('automation.noCommandHistory')}</p>
        </div>
      ) : (
        <div className="space-y-2 max-h-96 overflow-y-auto">
          {commands.map((cmd) => (
            <div key={cmd.id} className="flex items-center justify-between p-3 rounded-lg bg-surface-card border border-border-default">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-mono text-accent">{cmd.command}</span>
                  <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full border ${statusColor[cmd.status]}`}>
                    {t(`automation.${cmd.status}`)}
                  </span>
                </div>
                <div className="flex items-center gap-3 text-[10px] text-text-muted">
                  <span>{formatDate(cmd.created_at)} {formatTime(cmd.created_at)}</span>
                  {cmd.sent_at && <span>→ {formatTime(cmd.sent_at)}</span>}
                  {cmd.executed_at && <span>✓ {formatTime(cmd.executed_at)}</span>}
                </div>
                <CommandStatusStepper status={cmd.status} className="mt-1.5" />
              </div>
              {cmd.status === 'failed' && (
                <button
                  onClick={() => handleRetry(cmd)}
                  disabled={retryingId === cmd.id}
                  className="ml-3 px-2.5 py-1.5 text-xs rounded-lg bg-critical/10 text-critical border border-critical/30 hover:bg-critical/20 transition-colors disabled:opacity-50"
                >
                  {retryingId === cmd.id ? (
                    <span className="inline-block w-3 h-3 border-2 border-critical border-t-transparent rounded-full animate-spin" />
                  ) : (
                    t('automation.retry')
                  )}
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </Modal>
  );
}
