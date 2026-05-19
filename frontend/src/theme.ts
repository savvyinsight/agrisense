import { createTheme, type CSSObject } from '@mui/material/styles';

const theme = createTheme({
  palette: {
    mode: 'dark',
    primary: { main: '#2e7d32' },
    background: {
      default: '#0f1117',
      paper: '#1e2130',
    },
    text: {
      primary: '#e8eaed',
      secondary: '#9ca3af',
    },
    divider: '#2a2e3e',
    error: { main: '#ef4444' },
    warning: { main: '#f59e0b' },
    success: { main: '#4caf50' },
    info: { main: '#38bdf8' },
  },
  shape: { borderRadius: 8 },
  components: {
    MuiCard: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
          border: '1px solid #2a2e3e',
        },
      },
    },
    MuiDialog: {
      styleOverrides: {
        paper: {
          backgroundImage: 'none',
          border: '1px solid #2a2e3e',
        },
      },
    },
    MuiPaper: {
      styleOverrides: { root: { backgroundImage: 'none' } },
    },
    MuiTableCell: {
      styleOverrides: {
        root: { borderBottomColor: '#2a2e3e' },
        head: { color: '#6b7280', fontWeight: 500 },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: { fontWeight: 500 },
        outlined: { borderColor: '#2a2e3e' },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: ({ ownerState }: { ownerState: { variant?: string; color?: string } }) => {
          const base: CSSObject = { textTransform: 'none', fontWeight: 500 };
          if (ownerState.variant === 'contained' && ownerState.color === 'primary') {
            base.color = '#ffffff';
          }
          return base;
        },
      },
    },
    MuiSelect: {
      styleOverrides: {
        icon: { color: '#9ca3af' },
      },
    },
    MuiInputBase: {
      styleOverrides: {
        root: { color: '#e8eaed' },
      },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        notchedOutline: { borderColor: '#2a2e3e' },
      },
    },
    MuiTab: {
      styleOverrides: {
        root: { textTransform: 'none', color: '#9ca3af' },
        textColorPrimary: { '&.Mui-selected': { color: '#2e7d32' } },
      },
    },
    MuiAlert: {
      styleOverrides: {
        root: ({ ownerState }: { ownerState: { severity?: string; variant?: string } }) => {
          const base: CSSObject = {};
          if ((ownerState.variant === 'standard' || !ownerState.variant) && ownerState.severity === 'error') {
            base.backgroundColor = '#2a1115'; base.color = '#ef4444';
          }
          if ((ownerState.variant === 'standard' || !ownerState.variant) && ownerState.severity === 'info') {
            base.backgroundColor = '#0f172a'; base.color = '#38bdf8';
          }
          if ((ownerState.variant === 'standard' || !ownerState.variant) && ownerState.severity === 'success') {
            base.backgroundColor = '#132a1a'; base.color = '#4caf50';
          }
          if ((ownerState.variant === 'standard' || !ownerState.variant) && ownerState.severity === 'warning') {
            base.backgroundColor = '#2a1f0e'; base.color = '#f59e0b';
          }
          return base;
        },
      },
    },
  },
});

export default theme;
