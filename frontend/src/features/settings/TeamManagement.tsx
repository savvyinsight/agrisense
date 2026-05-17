import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Box,
  Card,
  CardContent,
  CardHeader,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Select,
  MenuItem,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  IconButton,
  Alert,
  CircularProgress,
  Tabs,
  Tab,
} from '@mui/material';
import {
  Edit as EditIcon,
  Delete as DeleteIcon,
  Mail as MailIcon,
  Check as CheckIcon,
} from '@mui/icons-material';
import { useAuth } from '@/features/auth/AuthContext';
import usePermission from '@/hooks/usePermission';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      {...other}
    >
      {value === index && <Box sx={{ p: 2 }}>{children}</Box>}
    </div>
  );
}

interface TeamMember {
  id: number;
  email: string;
  username: string;
  permissions: Array<{
    id: number;
    role: string;
    farm_id?: number;
  }>;
  created_at: string;
}

interface Invitation {
  id: number;
  email: string;
  role: string;
  farm_id?: number;
  invitation_token: string;
  created_at: string;
  expires_at: string;
}

export const TeamManagement: React.FC = () => {
  const { t } = useTranslation();
  const { account } = useAuth();
  const { canInviteUsers } = usePermission();

  const [tabValue, setTabValue] = useState(0);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [loading, setLoading] = useState(false);
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Invite modal state
  const [openInviteDialog, setOpenInviteDialog] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('operator');
  const [inviteFarmId, setInviteFarmId] = useState<number | ''>('');

  // Edit permission modal state
  const [openEditDialog, setOpenEditDialog] = useState(false);
  const [editingPermission, setEditingPermission] = useState<any>(null);
  const [newRole, setNewRole] = useState('');

  useEffect(() => {
    if (account?.id) {
      loadTeamData();
    }
  }, [account]);

  const loadTeamData = async () => {
    if (!account?.id) return;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/v1/accounts/${account.id}/users?account_id=${account.id}`,
        {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`,
          },
        }
      );

      if (!response.ok) throw new Error(t('teamManagement.failedToLoad'));

      const data = await response.json();
      setTeamMembers(data.users || []);
      setInvitations(data.invitations || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('common.error'));
    } finally {
      setLoading(false);
    }
  };

  const copyInviteLink = (inv: Invitation) => {
    const link = `${window.location.origin}/accept-invitation?token=${inv.invitation_token}`;
    navigator.clipboard.writeText(link);
    setCopiedId(inv.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleInviteUser = async () => {
    if (!account?.id || !inviteEmail) {
      setError(t('teamManagement.emailRequired'));
      return;
    }

    try {
      const response = await fetch(
        `/api/v1/accounts/${account.id}/users/invite?account_id=${account.id}`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            email: inviteEmail,
            role: inviteRole,
            farm_id: inviteFarmId || null,
          }),
        }
      );

      if (!response.ok) throw new Error(t('teamManagement.failedToInvite'));

      setOpenInviteDialog(false);
      setInviteEmail('');
      setInviteRole('operator');
      setInviteFarmId('');
      await loadTeamData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    }
  };

  const handleEditPermission = async () => {
    if (!account?.id || !editingPermission) return;

    try {
      const response = await fetch(
        `/api/v1/accounts/${account.id}/users/${editingPermission.user_id}/permission/${editingPermission.id}?account_id=${account.id}&permission_id=${editingPermission.id}`,
        {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            role: newRole,
          }),
        }
      );

      if (!response.ok) throw new Error(t('teamManagement.failedToUpdate'));

      setOpenEditDialog(false);
      setEditingPermission(null);
      setNewRole('');
      await loadTeamData();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('common.error'));
    }
  };

  const handleRevokeAccess = async (permissionId: number) => {
    if (!account?.id || !window.confirm(t('teamManagement.revokeConfirm'))) return;

    try {
      const response = await fetch(
        `/api/v1/accounts/${account.id}/users?account_id=${account.id}&permission_id=${permissionId}`,
        {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`,
          },
        }
      );

      if (!response.ok) throw new Error(t('teamManagement.failedToRevoke'));

      await loadTeamData();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('common.error'));
    }
  };

  const getRoleColor = (role: string): any => {
    const colors: { [key: string]: any } = {
      account_owner: 'error',
      farm_manager: 'warning',
      operator: 'info',
      technician: 'success',
    };
    return colors[role] || 'default';
  };

  if (!canInviteUsers()) {
    return (
      <Alert severity="error">
        {t('teamManagement.noPermission')}
      </Alert>
    );
  }

  return (
    <Box sx={{ width: '100%' }}>
      <Card>
        <CardHeader
          title={t('teamManagement.title')}
          action={
            <Button
              variant="contained"
              color="primary"
              onClick={() => setOpenInviteDialog(true)}
            >
              {t('teamManagement.inviteUser')}
            </Button>
          }
        />

        <CardContent>
          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}

          <Tabs
            value={tabValue}
            onChange={(_e, newValue) => setTabValue(newValue)}
            sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}
          >
            <Tab label={t('teamManagement.teamMembers', { count: teamMembers.length })} />
            <Tab label={t('teamManagement.pendingInvitations', { count: invitations.length })} />
          </Tabs>

          <TabPanel value={tabValue} index={0}>
            {loading ? (
              <CircularProgress />
            ) : teamMembers.length === 0 ? (
              <Alert severity="info">{t('teamManagement.noMembers')}</Alert>
            ) : (
              <TableContainer>
                <Table>
                  <TableHead>
                    <TableRow sx={{ backgroundColor: '#262a3a' }}>
                      <TableCell>{t('teamManagement.email')}</TableCell>
                      <TableCell>{t('auth.username')}</TableCell>
                      <TableCell>{t('teamManagement.roles')}</TableCell>
                      <TableCell>{t('teamManagement.joined')}</TableCell>
                      <TableCell align="right">{t('common.actions')}</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {teamMembers.map((member) => (
                      <TableRow key={member.id}>
                        <TableCell>{member.email}</TableCell>
                        <TableCell>{member.username}</TableCell>
                        <TableCell>
                          {member.permissions.map((perm) => (
                            <Chip
                              key={perm.id}
                              label={perm.role}
                              size="small"
                              color={getRoleColor(perm.role)}
                              variant="outlined"
                              sx={{ mr: 1 }}
                            />
                          ))}
                        </TableCell>
                        <TableCell>
                          {new Date(member.created_at).toLocaleDateString()}
                        </TableCell>
                        <TableCell align="right">
                          {member.permissions.map((perm) => (
                            <IconButton
                              key={perm.id}
                              size="small"
                              onClick={() => {
                                setEditingPermission({ ...perm, user_id: member.id });
                                setNewRole(perm.role);
                                setOpenEditDialog(true);
                              }}
                            >
                              <EditIcon fontSize="small" />
                            </IconButton>
                          ))}
                          {member.permissions.map((perm) => (
                            <IconButton
                              key={`delete-${perm.id}`}
                              size="small"
                              onClick={() => handleRevokeAccess(perm.id)}
                            >
                              <DeleteIcon fontSize="small" />
                            </IconButton>
                          ))}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </TabPanel>

          <TabPanel value={tabValue} index={1}>
            {invitations.length === 0 ? (
              <Alert severity="info">{t('teamManagement.noInvitations')}</Alert>
            ) : (
              <TableContainer>
                <Table>
                  <TableHead>
                    <TableRow sx={{ backgroundColor: '#262a3a' }}>
                      <TableCell>{t('teamManagement.email')}</TableCell>
                      <TableCell>{t('settings.role')}</TableCell>
                      <TableCell>{t('teamManagement.sent')}</TableCell>
                      <TableCell>{t('teamManagement.expires')}</TableCell>
                      <TableCell align="right">{t('common.actions')}</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {invitations.map((inv) => (
                      <TableRow key={inv.id}>
                        <TableCell>{inv.email}</TableCell>
                        <TableCell>
                          <Chip
                            label={inv.role}
                            size="small"
                            color={getRoleColor(inv.role)}
                            variant="outlined"
                          />
                        </TableCell>
                        <TableCell>
                          {new Date(inv.created_at).toLocaleDateString()}
                        </TableCell>
                        <TableCell>
                          {new Date(inv.expires_at).toLocaleDateString()}
                        </TableCell>
                        <TableCell align="right">
                          <IconButton size="small" onClick={() => copyInviteLink(inv)}>
                            {copiedId === inv.id ? <CheckIcon fontSize="small" color="success" /> : <MailIcon fontSize="small" />}
                          </IconButton>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </TabPanel>
        </CardContent>
      </Card>

      {/* Invite Dialog */}
      <Dialog open={openInviteDialog} onClose={() => setOpenInviteDialog(false)}>
        <DialogTitle>{t('teamManagement.inviteTitle')}</DialogTitle>
        <DialogContent sx={{ minWidth: 400 }}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 2 }}>
            <TextField
              label={t('teamManagement.email')}
              type="email"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              fullWidth
            />
            <Select value={inviteRole} onChange={(e) => setInviteRole(e.target.value)} fullWidth>
              <MenuItem value="account_owner">{t('teamManagement.accountOwner')}</MenuItem>
              <MenuItem value="farm_manager">{t('teamManagement.farmManager')}</MenuItem>
              <MenuItem value="operator">{t('teamManagement.operator')}</MenuItem>
              <MenuItem value="technician">{t('teamManagement.technician')}</MenuItem>
            </Select>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenInviteDialog(false)}>{t('common.cancel')}</Button>
          <Button onClick={handleInviteUser} variant="contained">
            {t('teamManagement.sendInvitation')}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Edit Permission Dialog */}
      <Dialog open={openEditDialog} onClose={() => setOpenEditDialog(false)}>
        <DialogTitle>{t('teamManagement.updateRole')}</DialogTitle>
        <DialogContent sx={{ minWidth: 400 }}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 2 }}>
            <Select value={newRole} onChange={(e) => setNewRole(e.target.value)} fullWidth>
              <MenuItem value="farm_manager">{t('teamManagement.farmManager')}</MenuItem>
              <MenuItem value="operator">{t('teamManagement.operator')}</MenuItem>
              <MenuItem value="technician">{t('teamManagement.technician')}</MenuItem>
            </Select>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenEditDialog(false)}>{t('common.cancel')}</Button>
          <Button onClick={handleEditPermission} variant="contained">
            {t('teamManagement.update')}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default TeamManagement;
