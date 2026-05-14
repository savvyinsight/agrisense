import type { Alert2 } from '@/shared/types';

export interface AlertGroup {
  key: string;
  field_id?: number;
  field_name?: string;
  severity: string;
  issue_type: string;
  count: number;
  alerts: Alert2[];
  latest: Alert2;
  first_triggered: string;
  last_triggered: string;
}

/**
 * Groups related alerts to reduce clutter and show patterns
 */
export function groupAlerts(alerts: Alert2[]): AlertGroup[] {
  const grouped = new Map<string, AlertGroup>();

  alerts.forEach((alert) => {
    // Create grouping key: field_id + severity + issue_type
    const issueType = inferIssueType(alert.title);
    const fieldId = alert.field_id || 0;
    const key = `${fieldId}:${alert.severity}:${issueType}`;

    if (!grouped.has(key)) {
      grouped.set(key, {
        key,
        field_id: alert.field_id,
        field_name: alert.field_name,
        severity: alert.severity,
        issue_type: issueType,
        count: 0,
        alerts: [],
        latest: alert,
        first_triggered: alert.triggered_at,
        last_triggered: alert.triggered_at,
      });
    }

    const group = grouped.get(key)!;
    group.count++;
    group.alerts.push(alert);
    group.latest = alert;
    group.last_triggered = alert.triggered_at;
  });

  // Convert to array and sort by severity then count
  return Array.from(grouped.values()).sort((a, b) => {
    const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
    if (severityOrder[a.severity as keyof typeof severityOrder] !== severityOrder[b.severity as keyof typeof severityOrder]) {
      return severityOrder[a.severity as keyof typeof severityOrder] - severityOrder[b.severity as keyof typeof severityOrder];
    }
    return b.count - a.count;
  });
}

/**
 * Infer issue type from alert title for grouping
 */
function inferIssueType(title: string): string {
  const lower = title.toLowerCase();

  if (lower.includes('temperature') || lower.includes('heat')) return 'temperature';
  if (lower.includes('moisture') || lower.includes('dry')) return 'moisture';
  if (lower.includes('humidity')) return 'humidity';
  if (lower.includes('irrigation') || lower.includes('water')) return 'irrigation';
  if (lower.includes('device') || lower.includes('offline') || lower.includes('connected')) return 'device';
  if (lower.includes('battery') || lower.includes('power')) return 'power';
  if (lower.includes('sensor')) return 'sensor';

  return 'other';
}

/**
 * Get emoji for issue type
 */
export function getIssueTypeEmoji(issueType: string): string {
  const emojis: Record<string, string> = {
    temperature: '🌡',
    moisture: '💧',
    humidity: '💨',
    irrigation: '🚿',
    device: '📡',
    power: '🔋',
    sensor: '📊',
    other: '⚠',
  };
  return emojis[issueType] || '⚠';
}

/**
 * Get description for issue type
 */
export function getIssueTypeLabel(issueType: string): string {
  const labels: Record<string, string> = {
    temperature: 'Temperature Alert',
    moisture: 'Soil Moisture Alert',
    humidity: 'Humidity Alert',
    irrigation: 'Irrigation Alert',
    device: 'Device Alert',
    power: 'Power Alert',
    sensor: 'Sensor Alert',
    other: 'System Alert',
  };
  return labels[issueType] || 'Alert';
}
