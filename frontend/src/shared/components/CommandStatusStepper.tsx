import type { CommandStatus } from '@/shared/types/api';

const steps: { key: CommandStatus; label: string }[] = [
  { key: 'pending', label: 'P' },
  { key: 'sent', label: 'S' },
  { key: 'delivered', label: 'D' },
  { key: 'executed', label: 'E' },
];

const statusOrder: Record<CommandStatus, number> = {
  pending: 0, sent: 1, delivered: 2, executed: 3, failed: -1,
};

interface CommandStatusStepperProps {
  status?: CommandStatus;
  className?: string;
}

export function CommandStatusStepper({ status, className = '' }: CommandStatusStepperProps) {
  if (!status) return <span className={`text-[10px] text-text-muted ${className}`}>—</span>;

  const currentIdx = statusOrder[status];
  const failedAt = status === 'failed' ? Math.max(0, currentIdx) : -1;

  return (
    <div className={`flex items-center gap-0.5 ${className}`}>
      {steps.map((step, idx) => {
        const isActive = currentIdx >= idx;
        const isFailed = failedAt >= 0 && idx <= failedAt;
        return (
          <div key={step.key} className="flex items-center">
            <div className={`w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-bold border ${
              isFailed ? 'bg-critical-bg text-critical border-critical/40' :
              isActive ? 'bg-success-bg text-success border-success/40' :
              'bg-surface-base text-text-muted border-border-default'
            }`}>
              {isFailed && idx === failedAt ? '✕' : step.label}
            </div>
            {idx < steps.length - 1 && (
              <div className={`w-3 h-0.5 ${isActive && !isFailed ? 'bg-success/40' : 'bg-border-default'}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}
