import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  Box,
  Drawer,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Typography,
  Divider,
  Chip,
  Paper,
} from '@mui/material';
import {
  Home,
  FolderOpen,
  Storage,
  Psychology,
  Analytics,
  Search,
  AdminPanelSettings,
  TrendingUp,
  Build,
  School,
} from '@mui/icons-material';

interface LayoutProps {
  children: React.ReactNode;
}

const navigation = [
  { name: 'Dashboard', href: '/', icon: Home },
  { name: 'Projects', href: '/projects', icon: FolderOpen },
  { name: 'Memory Explorer', href: '/memories', icon: Storage },
  { name: 'Sequential Thinking', href: '/thinking', icon: Psychology },
  { name: 'Analytics', href: '/analytics', icon: Analytics },
  { name: 'Search', href: '/search', icon: Search },
  { name: 'MCP Tools', href: '/mcp-tools', icon: Build },
  { name: 'Meta-Learning', href: '/meta-learning', icon: School },
  { name: 'Administer MCP Config', href: '/admin', icon: AdminPanelSettings },
];

const drawerWidth = 280;

export function LayoutMUI({ children }: LayoutProps) {
  const location = useLocation();

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh' }}>
      {/* Sidebar */}
      <Drawer
        variant="permanent"
        sx={{
          width: drawerWidth,
          flexShrink: 0,
          '& .MuiDrawer-paper': {
            width: drawerWidth,
            boxSizing: 'border-box',
            backgroundColor: 'background.paper',
            borderRight: '1px solid',
            borderColor: 'divider',
          },
        }}
      >
        {/* Logo */}
        <Box sx={{ p: 3, borderBottom: '1px solid', borderColor: 'divider' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
            <Box
              component="img"
              src="/ui/images/mini-me-logo.png"
              alt="MiniMe Logo"
              sx={{
                width: 58,
                height: 58,
                mr: 1.5,
                borderRadius: 1,
                border: '2px solid black',
              }}
              onError={(e) => {
                console.error('Logo failed to load in MUI Layout');
                e.currentTarget.style.border = '2px solid red';
              }}
              onLoad={() => {
                console.log('Logo loaded successfully in MUI Layout');
              }}
            />
            <Box>
              <Typography variant="h5" component="h1" fontWeight="bold" color="text.primary">
                MiniMe-MCP
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Digital Developer Twin
              </Typography>
            </Box>
          </Box>
        </Box>

        {/* Navigation */}
        <Box sx={{ flexGrow: 1, p: 2 }}>
          <List sx={{ p: 0 }}>
            {navigation.map((item) => {
              const isActive = location.pathname === item.href || 
                (item.href !== '/' && location.pathname.startsWith(item.href));
              
              return (
                <ListItem key={item.name} disablePadding sx={{ mb: 0.5 }}>
                  <ListItemButton
                    component={Link}
                    to={item.href}
                    sx={{
                      borderRadius: 2,
                      py: 1.5,
                      px: 2,
                      backgroundColor: isActive ? 'action.selected' : 'transparent',
                      color: isActive ? 'primary.main' : 'text.primary',
                      '&:hover': {
                        backgroundColor: isActive ? 'action.selected' : 'action.hover',
                      },
                      ...(isActive && {
                        borderLeft: '3px solid',
                        borderColor: 'primary.main',
                        backgroundColor: 'action.selected',
                        '&:hover': {
                          backgroundColor: 'action.selected',
                        },
                      }),
                    }}
                  >
                    <ListItemIcon
                      sx={{
                        color: isActive ? 'primary.main' : 'text.secondary',
                        minWidth: 40,
                      }}
                    >
                      <item.icon />
                    </ListItemIcon>
                    <ListItemText
                      primary={item.name}
                      primaryTypographyProps={{
                        fontSize: '0.875rem',
                        fontWeight: isActive ? 600 : 500,
                      }}
                    />
                  </ListItemButton>
                </ListItem>
              );
            })}
          </List>
        </Box>

        {/* Footer */}
        <Box sx={{ p: 2, borderTop: '1px solid', borderColor: 'divider' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
            <Box
              sx={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                backgroundColor: 'success.main',
                mr: 1,
              }}
            />
            <Typography variant="caption" color="text.secondary">
              System Healthy
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
            <Chip
              label="MCP v0.1.0"
              size="small"
              variant="outlined"
              sx={{ fontSize: '0.7rem', height: 20 }}
            />
            <Chip
              label="Streamable HTTP"
              size="small"
              variant="outlined"
              sx={{ fontSize: '0.7rem', height: 20 }}
            />
          </Box>
        </Box>
      </Drawer>

      {/* Main content */}
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          backgroundColor: 'background.default',
          minHeight: '100vh',
        }}
      >
        {children}
      </Box>
    </Box>
  );
}