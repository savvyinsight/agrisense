import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import type { Alert2, AlertRule } from '@/shared/types';
import { cn } from '@/shared/lib/cn';
import { Modal } from '@/shared/components/Modal';

interface AlertRuleDetailProps {
  alert: Alert2;
  rules: AlertRule[];
  className?: string;
}

export function AlertRuleDetail({ alert, rules, className }: AlertRuleDetailProps) {
  const { t } = useTranslation();
  const [showRuleDetail, setShowRuleDetail] = useState(false);

  const rule = rules.find(
    (r) => r.name === alert.rule_name || (r.enabled && r.sensor_type_id)
  );

  if (!rule) {
    return (
      <div className={cn('text-xs text-text-muted', className)}>
        {alert.rule_name ? t('alertRuleDetail.ruleTrigger', { name: alert.rule_name }) : t('alertRuleDetail.noRule')}
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
        📋 {t('alertRuleDetail.ruleTrigger', { name: rule.name })}
      </button>

      {showRuleDetail && (
        <Modal
          title={t('alertRuleDetail.modalTitle', { name: rule.name })}
          open={showRuleDetail}
          onClose={() => setShowRuleDetail(false)}
        >
          <div className="space-y-4">
            <div>
              <p className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-1">
                {t('alertRuleDetail.ruleName')}
              </p>
              <p className="text-sm font-medium text-text-primary">{rule.name}</p>
              <p className="text-xs text-text-muted mt-1">
                {rule.enabled ? `🟢 ${t('alertRuleDetail.enabled')}` : `🔴 ${t('alertRuleDetail.disabled')}`}
              </p>
            </div>

            <div>
              <p className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-1">
                {t('alertRuleDetail.condition')}
              </p>
              <div className="bg-surface-elevated rounded-md p-3 border border-border-default">
                <p className="text-sm text-text-primary font-mono">
                  {getSensorTypeName(rule.sensor_type_id, t)} {rule.condition} {rule.threshold_value}
                </p>
              </div>
            </div>

            <div>
              <p className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-1">
                {t('alertRuleDetail.duration')}
              </p>
              <p className="text-sm text-text-primary">
                {t('alertRuleDetail.seconds', { count: rule.duration_seconds })}
              </p>
            </div>

            <div>
              <p className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-1">
                {t('alertRuleDetail.severity')}
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

            {rule.device_id && (
              <div>
                <p className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-1">
                  {t('alertRuleDetail.device')}
                </p>
                <p className="text-sm text-text-primary">{t('alertRuleDetail.deviceId', { id: rule.device_id })}</p>
              </div>
            )}

            {rule.created_at && (
              <div>
                <p className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-1">
                  {t('alertRuleDetail.created')}
                </p>
                <p className="text-sm text-text-muted">
                  {new Date(rule.created_at).toLocaleString()}
                </p>
              </div>
            )}

            <div className="pt-4 border-t border-border-default flex gap-2">
              <button
                onClick={() => setShowRuleDetail(false)}
                className="flex-1 px-4 py-2 text-sm font-medium rounded-md bg-surface-hover text-text-secondary hover:text-text-primary transition-colors"
              >
                {t('alertRuleDetail.close')}
              </button>
              <button
                className="flex-1 px-4 py-2 text-sm font-medium rounded-md bg-accent text-white hover:opacity-90 transition-opacity"
              >
                {t('alertRuleDetail.editRule')}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}

function getSensorTypeName(sensorTypeId: number, t: TFunction): string {
  const names: Record<number, string> = {
    1: t('alertRules.sensorTemperature'),
    2: t('alertRules.sensorMoisture'),
    3: t('alertRules.sensorHumidity'),
    4: t('alertRules.sensorPh'),
    5: t('alertRules.sensorEc'),
  };
  return names[sensorTypeId] || t('alertRules.sensorUnknown', { id: sensorTypeId });
}
