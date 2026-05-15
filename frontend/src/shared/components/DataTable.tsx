import { useTranslation } from 'react-i18next';
import { cn } from '@/shared/lib/cn';

interface Column<T> {
  key: string;
  header: string;
  render?: (_item: T) => React.ReactNode;
  className?: string;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  keyExtractor: (_item: T) => string | number;
  onEdit?: (_item: T) => void;
  onDelete?: (_item: T) => void;
  renderActions?: (_item: T) => React.ReactNode;
  emptyMessage?: string;
}

export function DataTable<T>({ columns, data, keyExtractor, onEdit, onDelete, renderActions, emptyMessage }: DataTableProps<T>) {
  const { t } = useTranslation();

  if (data.length === 0) {
    return (
      <div className="rounded-lg border border-border-default bg-surface-card p-8 text-center">
        <span className="text-2xl block mb-2">📋</span>
        <p className="text-sm text-text-muted">{emptyMessage || t('component.noData')}</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border-default bg-surface-card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border-default bg-surface-elevated">
              {columns.map((col) => (
                <th key={col.key} className={cn('px-4 py-3 text-left text-xs font-medium text-text-muted uppercase tracking-wider', col.className)}>
                  {col.header}
                </th>
              ))}
              {(onEdit || onDelete) && (
                <th className="px-4 py-3 text-right text-xs font-medium text-text-muted uppercase tracking-wider">{t('component.actions')}</th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-border-default">
            {data.map((item) => (
              <tr key={keyExtractor(item)} className="hover:bg-surface-hover transition-colors">
                {columns.map((col) => (
                  <td key={col.key} className={cn('px-4 py-3 text-text-primary', col.className)}>
                    {col.render ? col.render(item) : String((item as any)[col.key] ?? '')}
                  </td>
                ))}
                {(onEdit || onDelete || renderActions) && (
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      {renderActions && renderActions(item)}
                      {onEdit && (
                        <button onClick={() => onEdit(item)} className="p-3 md:p-1.5 min-h-[44px] min-w-[44px] flex items-center justify-center text-text-muted hover:text-text-primary rounded-md hover:bg-surface-hover transition-colors" title={t('component.edit')}>
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                      )}
                      {onDelete && (
                        <button onClick={() => onDelete(item)} className="p-3 md:p-1.5 min-h-[44px] min-w-[44px] flex items-center justify-center text-text-muted hover:text-critical rounded-md hover:bg-critical-bg transition-colors" title={t('component.delete')}>
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      )}
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
