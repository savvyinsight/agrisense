import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Box,
  Card,
  CardContent,
  CardHeader,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  
  Select,
  MenuItem,
  Button,
  CircularProgress,
  Alert,
  Chip,
} from '@mui/material';
import { useAuth } from '@/features/auth/AuthContext';
import usePermission from '@/hooks/usePermission';

interface AuditLogEntry {
  id: number;
  user_id: number;
  action: string;
  resource_type: string;
  resource_id: string;
  resource_name: string;
  status: string;
  created_at: string;
  ip_address?: string;
}

export const AuditLogViewer: React.FC = () => {
  const { t } = useTranslation();
  const { account } = useAuth();
  const { canViewAuditLog } = usePermission();

  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);
  const [total, setTotal] = useState(0);

  // Filters
  const [resourceType, setResourceType] = useState('');
  const [action, setAction] = useState('');

  const resourceTypes = ['user', 'device', 'alert', 'farm', 'irrigation_schedule', 'user_permission'];
  const actions = ['create', 'read', 'update', 'delete'];

  useEffect(() => {
    if (account?.id && canViewAuditLog()) {
      loadAuditLogs();
    }
  }, [account, page, rowsPerPage, resourceType, action]);

  const loadAuditLogs = async () => {
    if (!account?.id) return;

    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        account_id: String(account.id),
        limit: String(rowsPerPage),
        offset: String(page * rowsPerPage),
      });

      if (resourceType) params.append('resource_type', resourceType);
      if (action) params.append('action', action);

      const response = await fetch(`/api/v1/accounts/${account.id}/audit?${params}`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
      });

      if (!response.ok) throw new Error(t('auditLog.failedToLoad'));

      const data = await response.json();
      setLogs(data.logs || []);
      setTotal(data.total || 0);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleChangePage = (_event: unknown, newPage: number) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  const getActionColor = (a: string): any => {
    const colors: { [key: string]: any } = {
      create: 'success',
      read: 'info',
      update: 'warning',
      delete: 'error',
    };
    return colors[a] || 'default';
  };

  if (!canViewAuditLog()) {
    return (
      <Alert severity="error">
        {t('auditLog.noPermission')}
      </Alert>
    );
  }

  return (
    <Box sx={{ width: '100%' }}>
      <Card>
        <CardHeader title={t('auditLog.title')} subtitle={t('auditLog.subtitle')} />

        <CardContent>
          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}

          {/* Filters */}
          <Box sx={{ display: 'flex', gap: 2, mb: 2, flexWrap: 'wrap' }}>
            <Select
              value={resourceType}
              onChange={(e) => {
                setResourceType(e.target.value);
                setPage(0);
              }}
              displayEmpty
              sx={{ minWidth: 150 }}
            >
              <MenuItem value="">{t('auditLog.allResources')}</MenuItem>
              {resourceTypes.map((rt) => {
                const labelMap: Record<string, string> = {
                  user: t('auditLog.resourceUser'),
                  device: t('auditLog.resourceDevice'),
                  alert: t('auditLog.resourceAlert'),
                  farm: t('auditLog.resourceFarm'),
                  irrigation_schedule: t('auditLog.resourceIrrigation'),
                  user_permission: t('auditLog.resourcePermission'),
                };
                return (
                  <MenuItem key={rt} value={rt}>
                    {labelMap[rt] || rt}
                  </MenuItem>
                );
              })}
            </Select>

            <Select
              value={action}
              onChange={(e) => {
                setAction(e.target.value);
                setPage(0);
              }}
              displayEmpty
              sx={{ minWidth: 150 }}
            >
              <MenuItem value="">{t('auditLog.allActions')}</MenuItem>
              {actions.map((a) => {
                const actionLabelMap: Record<string, string> = {
                  create: t('auditLog.actionCreate'),
                  read: t('auditLog.actionRead'),
                  update: t('auditLog.actionUpdate'),
                  delete: t('auditLog.actionDelete'),
                };
                return (
                  <MenuItem key={a} value={a}>
                    {actionLabelMap[a] || a.toUpperCase()}
                  </MenuItem>
                );
              })}
            </Select>

            <Button
              variant="outlined"
              onClick={() => {
                setResourceType('');
                setAction('');
                setPage(0);
              }}
            >
              {t('auditLog.resetFilters')}
            </Button>
          </Box>

          {/* Table */}
          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
              <CircularProgress />
            </Box>
          ) : (
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow sx={{ backgroundColor: '#262a3a' }}>
                    <TableCell>{t('auditLog.action')}</TableCell>
                    <TableCell>{t('auditLog.resourceType')}</TableCell>
                    <TableCell>{t('auditLog.resourceName')}</TableCell>
                    <TableCell>{t('auditLog.userId')}</TableCell>
                    <TableCell>{t('common.status')}</TableCell>
                    <TableCell>{t('auditLog.timestamp')}</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {logs.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} align="center">
                        {t('auditLog.noLogs')}
                      </TableCell>
                    </TableRow>
                  ) : (
                    logs.map((log) => (
                      <TableRow key={log.id}>
                        <TableCell>
                          <Chip
                            label={log.action}
                            color={getActionColor(log.action)}
                            size="small"
                            variant="outlined"
                          />
                        </TableCell>
                        <TableCell>{log.resource_type}</TableCell>
                        <TableCell>{log.resource_name}</TableCell>
                        <TableCell>{log.user_id}</TableCell>
                        <TableCell>
                          <Chip
                            label={log.status}
                            color={log.status === 'success' ? 'success' : 'error'}
                            size="small"
                            variant="filled"
                          />
                        </TableCell>
                        <TableCell>
                          {new Date(log.created_at).toLocaleString()}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          )}

          {/* Pagination */}
          <TablePagination
            rowsPerPageOptions={[10, 25, 50]}
            component="div"
            count={total}
            rowsPerPage={rowsPerPage}
            page={page}
            onPageChange={handleChangePage}
            onRowsPerPageChange={handleChangeRowsPerPage}
          />
        </CardContent>
      </Card>
    </Box>
  );
};

export default AuditLogViewer;
