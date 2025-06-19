import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Button,
  Alert,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Avatar,
  Paper,
  Divider,
  Chip,
  Autocomplete,
  TextField,
  Tabs,
  Tab,
  IconButton,
  Tooltip,
  Switch,
  FormControlLabel,
  Slider,
  TextareaAutosize,
} from '@mui/material';
import {
  Delete as Trash2,
  Warning as AlertTriangle,
  Storage as Database,
  Refresh as RefreshCw,
  Security as Shield,
  AdminPanelSettings,
  FolderOpen,
  Add as Plus,
  Edit,
  Settings,
  BarChart,
  Memory,
  Code,
  Assessment,
  Business,
  Save,
  RestartAlt,
} from '@mui/icons-material';
import { miniMeAPI } from '../services/api';
import type { Project } from '../types';

interface DeletionStats {
  projects?: number;
  memories?: number;
  sessions?: number;
  sequences?: number;
  patterns?: number;
  insights?: number;
}

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

interface SystemConfig {
  [category: string]: {
    [key: string]: {
      value: any;
      description: string;
      updated_at: string;
      updated_by: string;
    };
  };
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`admin-tabpanel-${index}`}
      aria-labelledby={`admin-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ pt: 3 }}>{children}</Box>}
    </div>
  );
}

const Administration = () => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string>('');
  const [deletionStats, setDeletionStats] = useState<DeletionStats>({});
  const [message, setMessage] = useState<{ type: 'success' | 'error' | 'warning'; text: string } | null>(null);
  const [activeTab, setActiveTab] = useState(0);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectDescription, setNewProjectDescription] = useState('');
  
  // Configuration state
  const [configs, setConfigs] = useState<SystemConfig>({});
  const [configLoading, setConfigLoading] = useState(false);
  const [configChanges, setConfigChanges] = useState<{ [key: string]: any }>({});
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  useEffect(() => {
    loadProjects();
    if (activeTab === 0) {
      loadConfigurations();
    }
  }, [activeTab]);

  const loadProjects = async () => {
    try {
      const response = await miniMeAPI.getProjects();
      setProjects(response.projects);
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to load projects' });
    }
  };

  const loadConfigurations = async () => {
    try {
      setConfigLoading(true);
      const response = await fetch('/api/config');
      const data = await response.json();
      
      if (data.success) {
        setConfigs(data.configs);
        setConfigChanges({});
        setHasUnsavedChanges(false);
      } else {
        setMessage({ type: 'error', text: 'Failed to load configurations' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to load configurations' });
    } finally {
      setConfigLoading(false);
    }
  };

  const handleConfigChange = (key: string, value: any) => {
    setConfigChanges(prev => ({
      ...prev,
      [key]: value
    }));
    setHasUnsavedChanges(true);
  };

  const saveConfigurations = async () => {
    try {
      setConfigLoading(true);
      const response = await fetch('/api/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ configs: configChanges })
      });
      
      const data = await response.json();
      
      if (data.success) {
        setMessage({ type: 'success', text: `Updated ${Object.keys(configChanges).length} configuration(s)` });
        await loadConfigurations(); // Reload to get fresh values
      } else {
        setMessage({ type: 'error', text: data.error || 'Failed to save configurations' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to save configurations' });
    } finally {
      setConfigLoading(false);
    }
  };

  const resetConfigurations = async (category?: string) => {
    try {
      setConfigLoading(true);
      const response = await fetch('/api/config/reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category })
      });
      
      const data = await response.json();
      
      if (data.success) {
        setMessage({ type: 'success', text: data.message });
        await loadConfigurations();
      } else {
        setMessage({ type: 'error', text: data.error || 'Failed to reset configurations' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to reset configurations' });
    } finally {
      setConfigLoading(false);
    }
  };

  const showConfirmDialog = (action: string) => {
    setConfirmDelete(action);
    setMessage(null);
  };

  const cancelDelete = () => {
    setConfirmDelete('');
    setMessage(null);
  };

  const createProject = async () => {
    if (!newProjectName.trim()) {
      setMessage({ type: 'warning', text: 'Project name is required' });
      return;
    }

    try {
      setLoading(true);
      await miniMeAPI.createProject(newProjectName.trim(), newProjectDescription.trim());
      await loadProjects();
      setShowCreateModal(false);
      setNewProjectName('');
      setNewProjectDescription('');
      setMessage({ 
        type: 'success', 
        text: `Project "${newProjectName}" created successfully` 
      });
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to create project' });
    } finally {
      setLoading(false);
    }
  };

  const deleteProjectMemories = async () => {
    if (!selectedProject) {
      setMessage({ type: 'warning', text: 'Please select a project first' });
      return;
    }

    try {
      setLoading(true);
      const response = await miniMeAPI.deleteProjectData(selectedProject.name, 'memories');
      setDeletionStats(response.stats);
      setMessage({ 
        type: 'success', 
        text: `Deleted ${response.stats.memories || 0} memories from project "${selectedProject.name}"` 
      });
      setConfirmDelete('');
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to delete project memories' });
    } finally {
      setLoading(false);
    }
  };

  const deleteProject = async () => {
    if (!selectedProject) {
      setMessage({ type: 'warning', text: 'Please select a project first' });
      return;
    }

    try {
      setLoading(true);
      const response = await miniMeAPI.deleteProject(selectedProject.name);
      setDeletionStats(response.stats);
      setMessage({ 
        type: 'success', 
        text: `Deleted project "${selectedProject.name}" and all associated data` 
      });
      setConfirmDelete('');
      setSelectedProject(null);
      await loadProjects();
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to delete project' });
    } finally {
      setLoading(false);
    }
  };

  const deleteAllLearnings = async () => {
    try {
      setLoading(true);
      const response = await miniMeAPI.deleteAllLearnings();
      setDeletionStats(response.stats);
      setMessage({ 
        type: 'success', 
        text: `Deleted ${response.stats.patterns || 0} patterns and ${response.stats.insights || 0} insights` 
      });
      setConfirmDelete('');
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to delete learning data' });
    } finally {
      setLoading(false);
    }
  };

  const deleteAllData = async () => {
    try {
      setLoading(true);
      const response = await miniMeAPI.deleteAllData();
      setDeletionStats(response.stats);
      setMessage({ 
        type: 'success', 
        text: 'All user data has been deleted successfully' 
      });
      setConfirmDelete('');
      setSelectedProject(null);
      await loadProjects();
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to delete all data' });
    } finally {
      setLoading(false);
    }
  };

  const executeAction = () => {
    switch (confirmDelete) {
      case 'memories':
        deleteProjectMemories();
        break;
      case 'project':
        deleteProject();
        break;
      case 'learnings':
        deleteAllLearnings();
        break;
      case 'all':
        deleteAllData();
        break;
      default:
        cancelDelete();
    }
  };

  const getActionDetails = (action: string) => {
    switch (action) {
      case 'memories':
        return {
          title: 'Delete Project Memories',
          description: `This will permanently delete all memories from the project "${selectedProject?.name}". Thinking sequences and project metadata will be preserved.`,
          severity: 'warning' as const,
          confirmText: 'Delete Memories'
        };
      case 'project':
        return {
          title: 'Delete Entire Project',
          description: `This will permanently delete the project "${selectedProject?.name}" and ALL associated data including memories, thinking sequences, and metadata.`,
          severity: 'error' as const,
          confirmText: 'Delete Project'
        };
      case 'learnings':
        return {
          title: 'Delete All Learning Data',
          description: 'This will permanently delete all meta-learning patterns and insights across ALL projects. Project data and memories will be preserved.',
          severity: 'warning' as const,
          confirmText: 'Delete Learning Data'
        };
      case 'all':
        return {
          title: 'Delete ALL User Data',
          description: 'This will permanently delete ALL USER DATA: all projects, memories, thinking sequences, patterns, and insights. System configuration (embedding models, etc.) will be preserved to keep MCP functional. This action cannot be undone.',
          severity: 'error' as const,
          confirmText: 'Delete All User Data'
        };
      default:
        return {
          title: 'Confirm Action',
          description: 'Are you sure you want to proceed?',
          severity: 'warning' as const,
          confirmText: 'Confirm'
        };
    }
  };

  const getProjectTypeIcon = (project: Project) => {
    const type = project.settings?.type;
    switch (type) {
      case 'web': return <Code />;
      case 'mobile': return <Memory />;
      case 'api': return <Assessment />;
      case 'data': return <BarChart />;
      case 'ml': return <Assessment />;
      default: return <Business />;
    }
  };

  const renderConfigurationSection = (category: string, categoryConfigs: any) => {
    const categoryLabels: { [key: string]: string } = {
      learning: 'Learning System',
      analytics: 'Analytics Collection',
      features: 'Feature Toggles',
      performance: 'Performance Settings'
    };

    return (
      <Card key={category} sx={{ mb: 3 }}>
        <CardContent>
          <Box sx={{ display: 'flex', justifyContent: 'between', alignItems: 'center', mb: 2 }}>
            <Typography variant="h6" fontWeight={600}>
              {categoryLabels[category] || category}
            </Typography>
            <Button
              size="small"
              onClick={() => resetConfigurations(category)}
              startIcon={<RestartAlt />}
              disabled={configLoading}
            >
              Reset {categoryLabels[category] || category}
            </Button>
          </Box>
          
          <Grid container spacing={3}>
            {Object.entries(categoryConfigs).map(([key, config]: [string, any]) => {
              const currentValue = configChanges[key] !== undefined ? configChanges[key] : config.value;
              
              return (
                <Grid item xs={12} sm={6} md={4} key={key}>
                  <Box sx={{ p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
                    <Typography variant="subtitle2" gutterBottom>
                      {key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ mb: 2, display: 'block' }}>
                      {config.description}
                    </Typography>
                    
                    {typeof config.value === 'boolean' ? (
                      <FormControlLabel
                        control={
                          <Switch
                            checked={currentValue}
                            onChange={(e) => handleConfigChange(key, e.target.checked)}
                            disabled={configLoading}
                          />
                        }
                        label={currentValue ? 'Enabled' : 'Disabled'}
                      />
                    ) : typeof config.value === 'number' ? (
                      <Box>
                        <TextField
                          type="number"
                          value={currentValue}
                          onChange={(e) => handleConfigChange(key, Number(e.target.value))}
                          size="small"
                          fullWidth
                          disabled={configLoading}
                          inputProps={{
                            min: key.includes('confidence') ? 0 : 1,
                            max: key.includes('confidence') ? 1 : key.includes('interval') ? 60 : 1000,
                            step: key.includes('confidence') ? 0.1 : 1
                          }}
                        />
                        {key.includes('confidence') && (
                          <Box sx={{ mt: 1 }}>
                            <Slider
                              value={currentValue}
                              onChange={(_, value) => handleConfigChange(key, value)}
                              min={0}
                              max={1}
                              step={0.1}
                              disabled={configLoading}
                              marks
                              valueLabelDisplay="auto"
                            />
                          </Box>
                        )}
                      </Box>
                    ) : (
                      <TextField
                        value={currentValue}
                        onChange={(e) => handleConfigChange(key, e.target.value)}
                        size="small"
                        fullWidth
                        disabled={configLoading}
                      />
                    )}
                    
                    <Box sx={{ mt: 1, display: 'flex', justifyContent: 'between', alignItems: 'center' }}>
                      <Typography variant="caption" color="text.secondary">
                        Updated by {config.updated_by}
                      </Typography>
                      {configChanges[key] !== undefined && (
                        <Chip label="Modified" size="small" color="warning" />
                      )}
                    </Box>
                  </Box>
                </Grid>
              );
            })}
          </Grid>
        </CardContent>
      </Card>
    );
  };

  const actionDetails = getActionDetails(confirmDelete);

  return (
    <Box sx={{ p: 4 }}>
      {/* Header */}
      <Box sx={{ mb: 4 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
          <AdminPanelSettings sx={{ fontSize: 32, color: 'primary.main' }} />
          <Typography variant="h2" component="h1" fontWeight="bold">
            Administration
          </Typography>
        </Box>
        <Typography variant="body1" color="text.secondary">
          Manage system configuration, projects, and data for your digital developer twin
        </Typography>
      </Box>

      {/* Error Message */}
      {message && (
        <Alert severity={message.type} sx={{ mb: 3 }} onClose={() => setMessage(null)}>
          {message.text}
        </Alert>
      )}

      {/* Administration Tabs */}
      <Card>
        <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tabs value={activeTab} onChange={(_, newValue) => setActiveTab(newValue)}>
            <Tab icon={<Settings />} label="System Configuration" />
            <Tab icon={<FolderOpen />} label="Project Management" />
            <Tab icon={<Database />} label="Data Administration" />
          </Tabs>
        </Box>

        {/* Tab 1: System Configuration */}
        <TabPanel value={activeTab} index={0}>
          <Box sx={{ p: 3 }}>
            <Typography variant="h6" fontWeight={600} sx={{ mb: 2 }}>
              System Configuration
            </Typography>
            
            <Box sx={{ display: 'flex', gap: 2, mb: 3 }}>
              <Button
                variant="outlined"
                onClick={() => loadConfigurations()}
                startIcon={<RefreshCw />}
                disabled={configLoading}
              >
                Refresh
              </Button>
              <Button
                variant="contained"
                onClick={saveConfigurations}
                startIcon={<Save />}
                disabled={configLoading || !hasUnsavedChanges}
              >
                Save Changes
              </Button>
              <Button
                variant="outlined"
                color="warning"
                onClick={() => resetConfigurations()}
                startIcon={<RestartAlt />}
                disabled={configLoading}
              >
                Reset All
              </Button>
            </Box>

            {configLoading && !Object.keys(configs).length ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                <CircularProgress />
              </Box>
            ) : (
              <>
                {Object.entries(configs).map(([category, categoryConfigs]) =>
                  renderConfigurationSection(category, categoryConfigs)
                )}
                
                {hasUnsavedChanges && (
                  <Alert severity="warning" sx={{ mt: 2 }}>
                    You have unsaved configuration changes. Click &quot;Save Changes&quot; to apply them.
                  </Alert>
                )}
              </>
            )}
          </Box>
        </TabPanel>

        {/* Tab 2: Project Management - Keep existing content */}
        <TabPanel value={activeTab} index={1}>
          <Box sx={{ p: 3 }}>
            {/* Project Management Header */}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
              <Typography variant="h6" fontWeight={600}>
                Project Management
              </Typography>
              <Button
                variant="contained"
                startIcon={<Plus />}
                onClick={() => setShowCreateModal(true)}
              >
                Create Project
              </Button>
            </Box>

            {/* Projects List */}
            <Grid container spacing={2}>
              {projects.map((project) => (
                <Grid item xs={12} md={6} key={project.id}>
                  <Card variant="outlined">
                    <CardContent>
                      <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexGrow: 1 }}>
                          <Avatar sx={{ bgcolor: 'primary.main' }}>
                            {getProjectTypeIcon(project)}
                          </Avatar>
                          <Box>
                            <Typography variant="subtitle1" fontWeight={600}>
                              {project.name}
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                              {project.description || 'No description'}
                            </Typography>
                            <Box sx={{ mt: 1, display: 'flex', gap: 2 }}>
                              <Typography variant="caption">
                                {project.memory_count || 0} memories
                              </Typography>
                              <Typography variant="caption">
                                {project.session_count || 0} sessions
                              </Typography>
                            </Box>
                          </Box>
                        </Box>
                        <Box sx={{ display: 'flex', gap: 0.5 }}>
                          <Tooltip title="Edit">
                            <IconButton size="small">
                              <Edit fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Settings">
                            <IconButton size="small">
                              <Settings fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </Box>
                      </Box>
                    </CardContent>
                  </Card>
                </Grid>
              ))}
            </Grid>

            {projects.length === 0 && (
              <Paper sx={{ p: 4, textAlign: 'center', bgcolor: 'grey.50' }}>
                <FolderOpen sx={{ fontSize: 48, color: 'text.disabled', mb: 2 }} />
                <Typography variant="h6" gutterBottom>
                  No projects found
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  Create your first project to get started
                </Typography>
                <Button
                  variant="contained"
                  startIcon={<Plus />}
                  onClick={() => setShowCreateModal(true)}
                >
                  Create Project
                </Button>
              </Paper>
            )}
          </Box>
        </TabPanel>

        {/* Tab 3: Data Administration - Keep existing content */}
        <TabPanel value={activeTab} index={2}>
          <Box sx={{ p: 3 }}>
            {/* Warning Alert */}
            <Alert severity="warning" sx={{ mb: 4 }}>
              <Typography variant="subtitle2" gutterBottom>
                ⚠️ Data Management Warning
              </Typography>
              <Typography variant="body2">
                These operations permanently delete data and cannot be undone. 
                Always ensure you have backups before proceeding with any deletion operations.
              </Typography>
            </Alert>

            {/* Project Selection with Autocomplete */}
            <Card sx={{ mb: 4 }}>
              <CardContent>
                <Typography variant="h6" gutterBottom fontWeight={600}>
                  Project Selection
                </Typography>
                <Autocomplete
                  options={projects}
                  getOptionLabel={(option) => option.name}
                  value={selectedProject}
                  onChange={(_, newValue) => setSelectedProject(newValue)}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      label="Select Project"
                      placeholder="Choose a project to manage..."
                      helperText="Select a project to enable project-specific operations"
                    />
                  )}
                  renderOption={(props, option) => (
                    <Box component="li" {...props}>
                      <Avatar sx={{ mr: 2, bgcolor: 'primary.main' }}>
                        {getProjectTypeIcon(option)}
                      </Avatar>
                      <Box>
                        <Typography variant="body2" fontWeight={600}>
                          {option.name}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {option.memory_count || 0} memories • {option.session_count || 0} sessions
                        </Typography>
                      </Box>
                    </Box>
                  )}
                  sx={{ maxWidth: 500 }}
                />
                {selectedProject && (
                  <Box sx={{ mt: 2, p: 2, bgcolor: 'primary.50', borderRadius: 1 }}>
                    <Typography variant="body2" color="primary.main">
                      Selected: <strong>{selectedProject.name}</strong>
                    </Typography>
                    <Typography variant="caption" color="primary.dark">
                      {selectedProject.description || 'No description available'}
                    </Typography>
                  </Box>
                )}
              </CardContent>
            </Card>

            {/* Deletion Operations */}
            <Grid container spacing={3}>
              {/* Project-Specific Operations */}
              <Grid item xs={12} md={6}>
                <Card sx={{ height: '100%' }}>
                  <CardContent>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                      <Avatar sx={{ bgcolor: 'warning.main' }}>
                        <Database />
                      </Avatar>
                      <Typography variant="h6" fontWeight={600}>
                        Project-Specific Operations
                      </Typography>
                    </Box>
                    
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                      Operations that affect the selected project only
                    </Typography>

                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                      <Button
                        variant="outlined"
                        color="warning"
                        startIcon={<Trash2 />}
                        onClick={() => showConfirmDialog('memories')}
                        disabled={!selectedProject || loading}
                        fullWidth
                      >
                        Delete Project Memories
                      </Button>
                      
                      <Button
                        variant="outlined"
                        color="error"
                        startIcon={<Trash2 />}
                        onClick={() => showConfirmDialog('project')}
                        disabled={!selectedProject || loading}
                        fullWidth
                      >
                        Delete Entire Project
                      </Button>
                    </Box>

                    {!selectedProject && (
                      <Alert severity="info" sx={{ mt: 2 }}>
                        Select a project to enable these operations
                      </Alert>
                    )}
                  </CardContent>
                </Card>
              </Grid>

              {/* System-Wide Operations */}
              <Grid item xs={12} md={6}>
                <Card sx={{ height: '100%' }}>
                  <CardContent>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                      <Avatar sx={{ bgcolor: 'error.main' }}>
                        <AlertTriangle />
                      </Avatar>
                      <Typography variant="h6" fontWeight={600}>
                        System-Wide Operations
                      </Typography>
                    </Box>
                    
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                      Operations that affect ALL data across the system
                    </Typography>

                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                      <Button
                        variant="outlined"
                        color="warning"
                        startIcon={<Trash2 />}
                        onClick={() => showConfirmDialog('learnings')}
                        disabled={loading}
                        fullWidth
                      >
                        Delete All Learning Data
                      </Button>
                      
                      <Button
                        variant="contained"
                        color="error"
                        startIcon={<Trash2 />}
                        onClick={() => showConfirmDialog('all')}
                        disabled={loading}
                        fullWidth
                      >
                        Delete ALL User Data
                      </Button>
                    </Box>

                    <Alert severity="error" sx={{ mt: 2 }}>
                      <Typography variant="caption">
                        ⚠️ These operations affect all projects and cannot be undone. System configuration is preserved.
                      </Typography>
                    </Alert>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>
          </Box>
        </TabPanel>
      </Card>

      {/* Deletion Statistics */}
      {Object.keys(deletionStats).length > 0 && (
        <Card sx={{ mt: 3 }}>
          <CardContent>
            <Typography variant="h6" gutterBottom fontWeight={600}>
              Last Operation Results
            </Typography>
            <Grid container spacing={2}>
              {Object.entries(deletionStats).map(([key, value]) => (
                <Grid item key={key}>
                  <Chip
                    label={`${key}: ${value}`}
                    color="info"
                    variant="outlined"
                  />
                </Grid>
              ))}
            </Grid>
          </CardContent>
        </Card>
      )}

      {/* Create Project Modal */}
      <Dialog
        open={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Plus />
            <Typography variant="h6">
              Create New Project
            </Typography>
          </Box>
        </DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 2 }}>
            <TextField
              fullWidth
              label="Project Name"
              value={newProjectName}
              onChange={(e) => setNewProjectName(e.target.value)}
              placeholder="My Awesome Project"
              required
              sx={{ mb: 3 }}
            />
            <TextField
              fullWidth
              label="Description"
              value={newProjectDescription}
              onChange={(e) => setNewProjectDescription(e.target.value)}
              placeholder="Describe what this project is about..."
              multiline
              rows={3}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowCreateModal(false)} color="inherit">
            Cancel
          </Button>
          <Button
            onClick={createProject}
            variant="contained"
            disabled={loading || !newProjectName.trim()}
            startIcon={loading ? <CircularProgress size={16} /> : <Plus />}
          >
            {loading ? 'Creating...' : 'Create Project'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Confirmation Dialog */}
      <Dialog
        open={Boolean(confirmDelete)}
        onClose={cancelDelete}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <AlertTriangle color="error" />
            <Typography variant="h6">
              {actionDetails.title}
            </Typography>
          </Box>
        </DialogTitle>
        <DialogContent>
          <Alert severity={actionDetails.severity} sx={{ mb: 2 }}>
            <Typography variant="body2">
              {actionDetails.description}
            </Typography>
          </Alert>
          <Typography variant="body2" color="text.secondary">
            This action cannot be undone. Please confirm that you want to proceed.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={cancelDelete} color="inherit">
            Cancel
          </Button>
          <Button
            onClick={executeAction}
            color={actionDetails.severity}
            variant="contained"
            disabled={loading}
            startIcon={loading ? <CircularProgress size={16} /> : <Trash2 />}
          >
            {loading ? 'Processing...' : actionDetails.confirmText}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Help Section */}
      <Paper sx={{ mt: 4, p: 3, bgcolor: 'grey.50' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
          <Shield sx={{ color: 'primary.main' }} />
          <Typography variant="h6" fontWeight={600}>
            Administration Guidelines
          </Typography>
        </Box>
        <Grid container spacing={2}>
          <Grid item xs={12} md={4}>
            <Typography variant="subtitle2" color="primary.main" gutterBottom>
              System Configuration:
            </Typography>
            <Typography variant="body2" color="text.secondary" component="ul" sx={{ pl: 2 }}>
              <li>Changes take effect immediately when saved</li>
              <li>Analytics collection restarts when interval changes</li>
              <li>Learning system can be toggled on/off safely</li>
              <li>Performance settings require restart for full effect</li>
            </Typography>
          </Grid>
          <Grid item xs={12} md={4}>
            <Typography variant="subtitle2" color="secondary.main" gutterBottom>
              Data Management:
            </Typography>
            <Typography variant="body2" color="text.secondary" component="ul" sx={{ pl: 2 }}>
              <li>System configuration is always preserved</li>
              <li>MCP server functionality remains intact</li>
              <li>Database schema and structure maintained</li>
              <li>Essential reference data protected</li>
            </Typography>
          </Grid>
          <Grid item xs={12} md={4}>
            <Typography variant="subtitle2" color="info.main" gutterBottom>
              Best Practices:
            </Typography>
            <Typography variant="body2" color="text.secondary" component="ul" sx={{ pl: 2 }}>
              <li>Review configuration changes before saving</li>
              <li>Test with non-critical data first</li>
              <li>Monitor system performance after changes</li>
              <li>Keep backups before major operations</li>
            </Typography>
          </Grid>
        </Grid>
      </Paper>
    </Box>
  );
}

export default Administration;