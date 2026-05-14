import { useState } from 'react';
import type { Alert2, AlertRule } from '@/shared/types';
import { cn } from '@/shared/lib/cn';
import { Modal } from '@/shared/components/Modal';

interface AlertRuleDetailProps {
  alert: Alert2;
  rules: AlertRule[];
  className?: string;
}

export function AlertRuleDetail({ alert, rules, className }: AlertRuleDetailProps) {
  const [showRuleDetail, setShowRuleDetail] = useState(false);

  // Find the rule that triggered this alert
  const rule = rules.find(
    (r) => r.name === alert.rule_name || (r.enabled && r.sensor_type_id)
  );

  if (!rule) {
    return (
      <div className={cn('text-xs text-text-muted', className)}>
        {alert.rule_name ? `Rule: ${alert.rule_name}` : 'No rule associated'}
      </div>
    );
  }

  return (
    <>
      <button
        onClick={() => setShowRuleDetail(true)}
        className={cn(
          'text-xs font-medium text-accent hover:underline cursor-pointer',
          className
        )}
      >
        📋 Rule: {rule.name}
      </button>

      {/* Rule Detail Modal */}
      {showRuleDetail && (
        <Modal
          title={`Alert Rule: ${rule.name}`}
          open={showRuleDetail}
          onClose={() => setShowRuleDetail(false)}
        >
          <div className="space-y-4">
            {/* Rule Name & Status */}
            <div>
              <p className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-1">
                Rule Name
              </p>
              <p className="text-sm font-medium text-text-primary">{rule.name}</p>
              <p className="text-xs text-text-muted mt-1">
                {rule.enabled ? '🟢 Enabled' : '🔴 Disabled'}
              </p>
            </div>

            {/* Condition */}
            <div>
              <p className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-1">
                Condition
              </p>
              <div className="bg-surface-elevated rounded-md p-3 border border-border-default">
                <p className="text-sm text-text-primary font-mono">
                  {getSensorTypeName(rule.sensor_type_id)} {rule.condition} {rule.threshold_value}
                </p>
              </div>
            </div>

            {/* Duration */}
            <div>
              <p className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-1">
                Duration
              </p>
              <p className="text-sm text-text-primary">
                {rule.duration_seconds} seconds
              </p>
            </div>

            {/* Severity */}
            <div>
              <p className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-1">
                Severity
              </p>
              <span
                className={cn(
                  'inline-block px-2 py-1 rounded text-xs font-medium',
                  rule.severity === 'critical'
                    ? 'bg-critical-bg text-critical'
                    : rule.severity === 'warning'
                      ? 'bg-warning-bg text-warning'
                      : 'bg-info-bg text-info-bright'
                )}
              >
                {rule.severity.charAt(0).toUpperCase() + rule.severity.slice(1)}
              </span>
            </div>

            {/* Applicable Device */}
            {rule.device_id && (
              <div>
                <p className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-1">
                  Device
                </p>
                <p className="text-sm text-text-primary">Device ID: {rule.device_id}</p>
              </div>
            )}

            {/* Created Date */}
            {rule.created_at && (
              <div>
                <p className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-1">
                  Created
                </p>
                <p className="text-sm text-text-muted">
                  {new Date(rule.created_at).toLocaleString()}
                </p>
              </div>
            )}

            {/* Action Buttons */}
            <div className="pt-4 border-t border-border-default flex gap-2">
              <button
                onClick={() => setShowRuleDetail(false)}
                className="flex-1 px-4 py-2 text-sm font-medium rounded-md bg-surface-hover text-text-secondary hover:text-text-primary transition-colors"
              >
                Close
              </button>
              <button
                className="flex-1 px-4 py-2 text-sm font-medium rounded-md bg-accent text-white hover:opacity-90 transition-opacity"
              >
                Edit Rule
              </button>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}

function getSensorTypeName(sensorTypeId: number): string {
  const names: Record<number, string> = {
    1: 'Temperature',
    2: 'Moisture',
    3: 'Humidity',
    4: 'pH',
    5: 'EC (Conductivity)',
  };
  return names[sensorTypeId] || `Sensor ${sensorTypeId}`;
}
