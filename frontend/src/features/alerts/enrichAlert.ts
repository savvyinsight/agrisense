import type { Alert2, AlertRule } from '@/shared/types';

/**
 * Enriches raw alert data with context, severity, and recommended actions
 * based on alert rules and field context.
 */
export function enrichAlert(
  rawAlert: Partial<Alert2>,
  rules: AlertRule[] = [],
  fieldContext?: { field_id?: number; field_name?: string; crop?: string }
): Alert2 {
  const deviceNum = rawAlert.device_id ? rawAlert.device_id.split('_')[1] : null;
  const rule = rules.find((r) => 
    (r.device_id === null || r.device_id?.toString() === deviceNum) &&
    r.enabled
  );

  let severity: 'critical' | 'high' | 'medium' | 'low' = (rawAlert.severity as any) || 'medium';
  let recommendedAction = rawAlert.recommended_action || 'Monitor situation';

  if (rule) {
    severity = (rule.severity === 'critical') ? (rule.severity as any) : 'medium';
    
    // Generate context-aware recommendations
    if (rule.sensor_type_id === 1) { // Temperature sensor
      recommendedAction = severity === 'critical' 
        ? 'Immediate action required: Check ventilation/cooling system'
        : 'Reduce sun exposure or increase air circulation';
    } else if (rule.sensor_type_id === 2) { // Moisture sensor
      recommendedAction = severity === 'critical'
        ? 'Start irrigation immediately to prevent crop damage'
        : 'Prepare to increase irrigation if trend continues';
    } else if (rule.sensor_type_id === 3) { // Humidity sensor
      recommendedAction = severity === 'critical'
        ? 'Improve ventilation to prevent fungal diseases'
        : 'Monitor for early signs of mold or mildew';
    }
  }

  // Add field context to title if available
  let title = rawAlert.title || 'Unknown alert';
  if (fieldContext?.field_name && !title.includes(fieldContext.field_name)) {
    title = `${fieldContext.field_name}: ${title}`;
  }

  return {
    id: rawAlert.id || Date.now(),
    device_id: rawAlert.device_id || '',
    device_name: rawAlert.device_name,
    field_id: fieldContext?.field_id || rawAlert.field_id,
    field_name: fieldContext?.field_name || rawAlert.field_name,
    rule_name: rule?.name || rawAlert.rule_name,
    title,
    message: rawAlert.message || '',
    severity,
    status: rawAlert.status || 'active',
    confidence: rawAlert.confidence || 85,
    triggered_at: rawAlert.triggered_at || new Date().toISOString(),
    recommended_action: recommendedAction,
  };
}

/**
 * Evaluates if an alert should be triggered based on a value and rule threshold.
 */
export function shouldTriggerAlert(
  value: number,
  rule: AlertRule
): boolean {
  const threshold = typeof rule.threshold_value === 'string' 
    ? parseFloat(rule.threshold_value) 
    : rule.threshold_value;

  switch (rule.condition) {
    case '>=': return value >= threshold;
    case '>': return value > threshold;
    case '<=': return value <= threshold;
    case '<': return value < threshold;
    case '==': return value === threshold;
    case '!=': return value !== threshold;
    default: return false;
  }
}
