import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { Alert as AlertType } from '../types/api';

import {
  Box,
  Drawer,
  AppBar,
  Toolbar,
  List,
  Typography,
  Divider,
  IconButton,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Avatar,
  Menu,
  MenuItem,
  Badge,
  useTheme,
  useMediaQuery,
} from '@mui/material';
import {
  Menu as MenuIcon,
  Dashboard as DashboardIcon,
  Devices as DevicesIcon,
  NotificationsActive as AlertsIcon,
  Settings as AlertRulesIcon,
  Settings as AutomationIcon,
  Analytics as AnalyticsIcon,
  Map as MapIcon,
  AccountCircle,
  Logout,
  Notifications,
  Language,
} from '@mui/icons-material';
import { useAuth } from '../store/AuthContext';
import { logout } from '../api/auth';
import { getActiveAlerts } from '../api/devices';

const drawerWidth = 280;

interface LayoutProps {
  children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [mobileOpen, setMobileOpen] = useState(false);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [alerts, setAlerts] = useState<AlertType[]>([]);
  const navigate = useNavigate();
  const location = useLocation();
  const { user, isAdmin, setUser } = useAuth();
  const { t, i18n } = useTranslation();

  const navigationItems = [
    { text: t('nav.dashboard'), icon: <DashboardIcon />, path: '/dashboard' },
    { text: t('nav.devices'), icon: <DevicesIcon />, path: '/devices' },
    { text: t('nav.alerts'), icon: <AlertsIcon />, path: '/alerts' },
    { text: t('nav.alertRules'), icon: <AlertRulesIcon />, path: '/alert-rules' },
    { text: t('nav.automation'), icon: <AutomationIcon />, path: '/automation' },
    { text: t('nav.analytics'), icon: <AnalyticsIcon />, path: '/analytics' },
    { text: t('nav.map'), icon: <MapIcon />, path: '/map' },
  ];

  const filteredNavigationItems = navigationItems.filter((item) => {
    if (isAdmin()) return true;
    return ['/dashboard', '/analytics', '/map'].includes(item.path);
  });

  const handleDrawerToggle = () => {
    setMobileOpen(!mobileOpen);
  };

  const handleProfileMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleProfileMenuClose = () => {
    setAnchorEl(null);
  };

  const handleAlertsClick = async () => {
    try {
      const result = await getActiveAlerts();
      if (result.success) {
        setAlerts(result.data?.alerts || []);
      }
    } catch (error) {
      console.error('Failed to load alerts:', error);
    }
    navigate('/alerts');
  };

  const handleLogout = () => {
    logout();
    setUser(null);
    navigate('/login');
    handleProfileMenuClose();
  };

  const handleLanguageChange = (language: string) => {
    i18n.changeLanguage(language);
  };

  useEffect(() => {
    const loadAlerts = async () => {
      try {
        const result = await getActiveAlerts();
        if (result.success) {
          setAlerts(result.data?.alerts || []);
        }
      } catch (error) {
        console.error('Failed to load alerts:', error);
      }
    };

    if (user) {
      void loadAlerts();
    }
  }, [user]);

  const drawer = (
    <Box>
      <Toolbar>
        <Typography variant="h6" noWrap component="div" sx={{ fontWeight: 700 }}>
          AgriSenseIoT
        </Typography>
      </Toolbar>
      <Divider />
      <List>
        {filteredNavigationItems.map((item) => (
          <ListItem key={item.text} disablePadding>
            <ListItemButton
              selected={location.pathname === item.path}
              onClick={() => {
                navigate(item.path);
                if (isMobile) setMobileOpen(false);
              }}
              sx={{
                '&.Mui-selected': {
                  backgroundColor: theme.palette.primary.main + '20',
                  '&:hover': {
                    backgroundColor: theme.palette.primary.main + '30',
                  },
                },
              }}
            >
              <ListItemIcon sx={{ color: location.pathname === item.path ? theme.palette.primary.main : 'inherit' }}>
                {item.icon}
              </ListItemIcon>
              <ListItemText primary={item.text} />
            </ListItemButton>
          </ListItem>
        ))}
      </List>
    </Box>
  );

  return (
    <Box sx={{ display: 'flex' }}>
      <AppBar
        position="fixed"
        sx={{
          width: { md: `calc(100% - ${drawerWidth}px)` },
          ml: { md: `${drawerWidth}px` },
        }}
      >
        <Toolbar>
          <IconButton
            color="inherit"
            aria-label="open drawer"
            edge="start"
            onClick={handleDrawerToggle}
            sx={{ mr: 2, display: { md: 'none' } }}
          >
            <MenuIcon />
          </IconButton>
          <Typography variant="h6" noWrap component="div" sx={{ flexGrow: 1 }}>
            {navigationItems.find((item) => item.path === location.pathname)?.text || 'Dashboard'}
          </Typography>

          <IconButton color="inherit" size="large" onClick={handleAlertsClick}>
            <Badge badgeContent={alerts.length} color="error">
              <Notifications />
            </Badge>
          </IconButton>

          <IconButton
            color="inherit"
            size="large"
            onClick={() => handleLanguageChange(i18n.language === 'en' ? 'zh' : 'en')}
            title={t('language.chinese')}
          >
            <Language />
          </IconButton>

          <IconButton
            size="large"
            aria-label="account of current user"
            aria-controls="primary-search-account-menu"
            aria-haspopup="true"
            onClick={handleProfileMenuOpen}
            color="inherit"
          >
            <Avatar sx={{ width: 32, height: 32 }}>
              {user?.username?.charAt(0).toUpperCase()}
            </Avatar>
          </IconButton>
        </Toolbar>
      </AppBar>

      <Box
        component="nav"
        sx={{ width: { md: drawerWidth }, flexShrink: { md: 0 } }}
        aria-label="mailbox folders"
      >
        <Drawer
          variant="temporary"
          open={mobileOpen}
          onClose={handleDrawerToggle}
          ModalProps={{
            keepMounted: true,
          }}
          sx={{
            display: { xs: 'block', md: 'none' },
            '& .MuiDrawer-paper': { boxSizing: 'border-box', width: drawerWidth },
          }}
        >
          {drawer}
        </Drawer>
        <Drawer
          variant="permanent"
          sx={{
            display: { xs: 'none', md: 'block' },
            '& .MuiDrawer-paper': { boxSizing: 'border-box', width: drawerWidth },
          }}
          open
        >
          {drawer}
        </Drawer>
      </Box>

      <Box
        component="main"
        sx={{
          flexGrow: 1,
          p: 3,
          width: { md: `calc(100% - ${drawerWidth}px)` },
          minHeight: '100vh',
          backgroundColor: theme.palette.background.default,
        }}
      >
        <Toolbar />
        {children}
      </Box>

      <Menu
        id="primary-search-account-menu"
        anchorEl={anchorEl}
        anchorOrigin={{
          vertical: 'top',
          horizontal: 'right',
        }}
        keepMounted
        transformOrigin={{
          vertical: 'top',
          horizontal: 'right',
        }}
        open={Boolean(anchorEl)}
        onClose={handleProfileMenuClose}
      >
        <MenuItem disabled>
          <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
            {user?.username} ({user?.role || 'user'})
          </Typography>
        </MenuItem>
        <MenuItem onClick={handleProfileMenuClose}>
          <AccountCircle sx={{ mr: 1 }} />
          {t('user.profile')}
        </MenuItem>
        <MenuItem onClick={handleLogout}>
          <Logout sx={{ mr: 1 }} />
          {t('user.logout')}
        </MenuItem>
      </Menu>
    </Box>
  );
};

export default Layout;