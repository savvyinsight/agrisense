import React, { useState, useEffect } from 'react';
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

      if (!response.ok) throw new Error('Failed to load audit logs');

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
        Only account owners can view audit logs.
      </Alert>
    );
  }

  return (
    <Box sx={{ width: '100%' }}>
      <Card>
        <CardHeader title="Audit Log" subtitle="All account activities and changes" />

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
              <MenuItem value="">All Resources</MenuItem>
              {resourceTypes.map((rt) => (
                <MenuItem key={rt} value={rt}>
                  {rt}
                </MenuItem>
              ))}
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
              <MenuItem value="">All Actions</MenuItem>
              {actions.map((a) => (
                <MenuItem key={a} value={a}>
                  {a.toUpperCase()}
                </MenuItem>
              ))}
            </Select>

            <Button
              variant="outlined"
              onClick={() => {
                setResourceType('');
                setAction('');
                setPage(0);
              }}
            >
              Reset Filters
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
                    <TableCell>Action</TableCell>
                    <TableCell>Resource Type</TableCell>
                    <TableCell>Resource Name</TableCell>
                    <TableCell>User ID</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell>Timestamp</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {logs.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} align="center">
                        No audit logs found
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
