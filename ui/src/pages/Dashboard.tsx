import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  Paper,
  Chip,
  Avatar,
  LinearProgress,
  Alert,
  CircularProgress,
  Button,
  Divider,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  SelectChangeEvent,
} from '@mui/material';
import {
  TrendingUp,
  Storage,
  Psychology,
  FolderOpen,
  CheckCircle,
  Warning,
  Error as ErrorIcon,
  Analytics,
  Refresh,
  FilterList,
} from '@mui/icons-material';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell } from 'recharts';
import { miniMeAPI } from '../services/api';
import type { HealthStatus, Project } from '../types';

const CHART_COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#06B6D4'];

export function Dashboard() {
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [filteredProjects, setFilteredProjects] = useState<Project[]>([]);
  const [selectedProject, setSelectedProject] = useState<string>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  useEffect(() => {
    loadDashboardData();
    // Refresh every 30 seconds
    const interval = setInterval(loadDashboardData, 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    // Filter projects when selection changes
    if (selectedProject === 'all') {
      setFilteredProjects(projects);
    } else {
      setFilteredProjects(projects.filter(p => p.id.toString() === selectedProject));
    }
  }, [projects, selectedProject]);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [healthResponse, projectsResponse] = await Promise.all([
        miniMeAPI.getHealth(),
        miniMeAPI.getProjects(true),
      ]);
      setHealth(healthResponse);
      setProjects(projectsResponse.projects);
      setLastRefresh(new Date());
    } catch (error) {
      setError('Failed to load dashboard data');
      console.error('Dashboard error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = () => {
    loadDashboardData();
  };

  const handleProjectFilter = (event: SelectChangeEvent) => {
    setSelectedProject(event.target.value);
  };

  const getFilteredStats = () => {
    if (selectedProject === 'all') {
      return health?.statistics;
    }
    
    // Calculate filtered stats for selected project
    const projectData = filteredProjects[0];
    if (!projectData) return health?.statistics;
    
    return {
      database: {
        projects: 1,
        memories: {
          total_memories: projectData.memory_count?.toString() || '0',
          memories_with_embeddings: '0', // Would need API enhancement
          avg_importance: 0.5, // Would need API enhancement
          unique_memory_types: '0' // Would need API enhancement
        },
        thinking: {
          total_sequences: projectData.thinking_sequence_count?.toString() || '0',
          active_sequences: '0', // Would need API enhancement
          total_thoughts: '0' // Would need API enhancement
        }
      },
      thinking: health?.statistics.thinking || {
        total_sequences: 0,
        completed_sequences: 0,
        total_thoughts: 0,
        avg_confidence: 0,
        total_branches: 0,
        total_revisions: 0,
        avg_completion_hours: 0,
        completion_rate: 0
      }
    };
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy': return 'success';
      case 'degraded': return 'warning';
      case 'error': return 'error';
      default: return 'default';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy': return <CheckCircle />;
      case 'degraded': return <Warning />;
      case 'error': return <ErrorIcon />;
      default: return <Warning />;
    }
  };

  // Sample chart data
  const memoryGrowthData = [
    { date: 'Week 1', memories: 2, sequences: 1 },
    { date: 'Week 2', memories: 5, sequences: 2 },
    { date: 'Week 3', memories: 8, sequences: 3 },
    { date: 'Week 4', memories: 12, sequences: 5 },
  ];

  const memoryTypeData = [
    { name: 'Insights', value: 5, color: CHART_COLORS[0] },
    { name: 'Code', value: 3, color: CHART_COLORS[1] },
    { name: 'Decisions', value: 2, color: CHART_COLORS[2] },
    { name: 'Bugs', value: 2, color: CHART_COLORS[3] },
  ];

  if (loading && !health) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '50vh' }}>
        <CircularProgress />
      </Box>
    );
  }


  return (
    <Box sx={{ p: 4 }}>
      {/* Header */}
      <Box sx={{ mb: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <Box>
          <Typography variant="h2" component="h1" gutterBottom fontWeight="bold">
            Dashboard
          </Typography>
          <Typography variant="body1" color="text.secondary">
            {selectedProject === 'all' 
              ? 'Welcome to your Digital Developer Twin' 
              : `Project: ${projects.find(p => p.id.toString() === selectedProject)?.name || 'Unknown'}`
            }
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <FormControl size="small" sx={{ minWidth: 200 }}>
            <InputLabel id="project-filter-label">
              <FilterList sx={{ mr: 1, fontSize: 16 }} />
              Filter by Project
            </InputLabel>
            <Select
              labelId="project-filter-label"
              value={selectedProject}
              label="Filter by Project"
              onChange={handleProjectFilter}
              startAdornment={<FilterList sx={{ mr: 1, fontSize: 16 }} />}
            >
              <MenuItem value="all">
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                  <Analytics sx={{ mr: 1, fontSize: 16 }} />
                  All Projects
                </Box>
              </MenuItem>
              {projects.map((project) => (
                <MenuItem key={project.id} value={project.id.toString()}>
                  <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    <FolderOpen sx={{ mr: 1, fontSize: 16 }} />
                    {project.name}
                  </Box>
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <Typography variant="caption" color="text.secondary">
            Last updated: {lastRefresh.toLocaleTimeString()}
          </Typography>
          <Button
            variant="outlined"
            size="small"
            startIcon={<Refresh />}
            onClick={handleRefresh}
            disabled={loading}
          >
            Refresh
          </Button>
        </Box>
      </Box>

      {/* Error Alert */}
      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      {/* System Status Cards */}
      {health && (
        <Grid container spacing={3} sx={{ mb: 4 }}>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Box>
                    <Typography variant="h4" fontWeight="bold" color="primary.main">
                      {getFilteredStats()?.database.memories.total_memories}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {selectedProject === 'all' ? 'Total Memories' : 'Project Memories'}
                    </Typography>
                  </Box>
                  <Avatar sx={{ bgcolor: 'primary.main' }}>
                    <Storage />
                  </Avatar>
                </Box>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Box>
                    <Typography variant="h4" fontWeight="bold" color="secondary.main">
                      {getFilteredStats()?.database.thinking.total_sequences}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {selectedProject === 'all' ? 'Thinking Sequences' : 'Project Sequences'}
                    </Typography>
                  </Box>
                  <Avatar sx={{ bgcolor: 'secondary.main' }}>
                    <Psychology />
                  </Avatar>
                </Box>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Box>
                    <Typography variant="h4" fontWeight="bold" color="info.main">
                      {selectedProject === 'all' ? projects.length : filteredProjects.length}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {selectedProject === 'all' ? 'Active Projects' : 'Selected Project'}
                    </Typography>
                  </Box>
                  <Avatar sx={{ bgcolor: 'info.main' }}>
                    <FolderOpen />
                  </Avatar>
                </Box>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Box>
                    <Typography variant="h4" fontWeight="bold" color="warning.main">
                      {Math.round(getFilteredStats()?.thinking?.completion_rate || 0)}%
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Completion Rate
                    </Typography>
                  </Box>
                  <Avatar sx={{ bgcolor: 'warning.main' }}>
                    <TrendingUp />
                  </Avatar>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      {/* System Health Section */}
      {health && (
        <Card sx={{ mb: 4 }}>
          <CardContent>
            <Typography variant="h5" gutterBottom fontWeight="600">
              System Health
            </Typography>
            <Grid container spacing={3}>
              <Grid item xs={12} md={6}>
                <Box sx={{ mb: 2 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                    <Typography variant="body2">Overall Status</Typography>
                    <Chip
                      icon={getStatusIcon(health.status)}
                      label={health.status.toUpperCase()}
                      color={getStatusColor(health.status)}
                      size="small"
                    />
                  </Box>
                </Box>

                <Box sx={{ mb: 2 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                    <Typography variant="body2">Database</Typography>
                    <Chip
                      label={health.services.database}
                      color={getStatusColor(health.services.database)}
                      size="small"
                    />
                  </Box>
                </Box>

                <Box sx={{ mb: 2 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                    <Typography variant="body2">Embeddings</Typography>
                    <Chip
                      label={health.services.embeddings}
                      color={getStatusColor(health.services.embeddings)}
                      size="small"
                    />
                  </Box>
                </Box>
              </Grid>

              <Grid item xs={12} md={6}>
                <Typography variant="subtitle2" gutterBottom>
                  Embedding Model
                </Typography>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  {health.services.defaultEmbeddingModel}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {health.services.availableEmbeddingModels} models available
                </Typography>
              </Grid>
            </Grid>
          </CardContent>
        </Card>
      )}

      {/* Charts Section */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} lg={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom fontWeight="600">
                Memory & Sequence Growth
              </Typography>
              <Box sx={{ height: 300 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={memoryGrowthData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip />
                    <Line type="monotone" dataKey="memories" stroke={CHART_COLORS[0]} strokeWidth={2} name="Memories" />
                    <Line type="monotone" dataKey="sequences" stroke={CHART_COLORS[1]} strokeWidth={2} name="Sequences" />
                  </LineChart>
                </ResponsiveContainer>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} lg={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom fontWeight="600">
                Memory Types Distribution
              </Typography>
              <Box sx={{ height: 300 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={memoryTypeData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {memoryTypeData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Projects Overview */}
      <Card>
        <CardContent>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography variant="h6" gutterBottom fontWeight="600">
              {selectedProject === 'all' ? 'Projects Overview' : 'Project Details'}
            </Typography>
            {selectedProject !== 'all' && filteredProjects.length > 0 && (
              <Chip 
                label={`Focused View: ${filteredProjects[0].name}`}
                color="primary"
                variant="outlined"
                size="small"
              />
            )}
          </Box>
          <Grid container spacing={2}>
            {(selectedProject === 'all' ? projects.slice(0, 6) : filteredProjects).map((project) => (
              <Grid item xs={12} sm={6} md={4} key={project.id}>
                <Paper 
                  variant="outlined" 
                  sx={{ 
                    p: selectedProject === 'all' ? 2 : 3,
                    height: selectedProject === 'all' ? 'auto' : '100%',
                    minHeight: selectedProject === 'all' ? 'auto' : 200
                  }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: selectedProject === 'all' ? 1 : 2 }}>
                    <Avatar sx={{ 
                      bgcolor: 'primary.main', 
                      width: selectedProject === 'all' ? 32 : 48, 
                      height: selectedProject === 'all' ? 32 : 48, 
                      mr: 1.5 
                    }}>
                      <FolderOpen fontSize={selectedProject === 'all' ? 'small' : 'medium'} />
                    </Avatar>
                    <Box sx={{ minWidth: 0, flexGrow: 1 }}>
                      <Typography 
                        variant={selectedProject === 'all' ? 'subtitle2' : 'h6'} 
                        noWrap 
                        fontWeight="600"
                      >
                        {project.name}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {selectedProject === 'all' 
                          ? `${project.memory_count || 0} memories`
                          : `Created: ${new Date(project.created_at).toLocaleDateString()}`
                        }
                      </Typography>
                    </Box>
                  </Box>

                  {/* Enhanced details for single project view */}
                  {selectedProject !== 'all' && (
                    <Box sx={{ mb: 2 }}>
                      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                        {project.description || 'No description available'}
                      </Typography>
                      
                      {/* Detailed Statistics */}
                      <Grid container spacing={1} sx={{ mb: 2 }}>
                        <Grid item xs={4}>
                          <Box sx={{ textAlign: 'center', p: 1, bgcolor: 'grey.50', borderRadius: 1 }}>
                            <Typography variant="h6" fontWeight="bold" color="primary.main">
                              {project.memory_count || 0}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              Memories
                            </Typography>
                          </Box>
                        </Grid>
                        <Grid item xs={4}>
                          <Box sx={{ textAlign: 'center', p: 1, bgcolor: 'grey.50', borderRadius: 1 }}>
                            <Typography variant="h6" fontWeight="bold" color="secondary.main">
                              {project.session_count || 0}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              Sessions
                            </Typography>
                          </Box>
                        </Grid>
                        <Grid item xs={4}>
                          <Box sx={{ textAlign: 'center', p: 1, bgcolor: 'grey.50', borderRadius: 1 }}>
                            <Typography variant="h6" fontWeight="bold" color="warning.main">
                              {project.thinking_sequence_count || 0}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              Sequences
                            </Typography>
                          </Box>
                        </Grid>
                      </Grid>

                      {/* Activity Indicator */}
                      <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                        <Box
                          sx={{
                            width: 8,
                            height: 8,
                            borderRadius: '50%',
                            bgcolor: 'success.main',
                            mr: 1
                          }}
                        />
                        <Typography variant="caption" color="text.secondary">
                          Last activity: {new Date(project.last_activity || project.updated_at).toLocaleDateString()}
                        </Typography>
                      </Box>
                    </Box>
                  )}
                  
                  {project.settings?.tech_stack && (
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                      {project.settings.tech_stack.slice(0, selectedProject === 'all' ? 2 : 4).map((tech: string, index: number) => (
                        <Chip
                          key={index}
                          label={tech}
                          size="small"
                          variant="outlined"
                          sx={{ fontSize: '0.7rem', height: 20 }}
                        />
                      ))}
                      {project.settings.tech_stack.length > (selectedProject === 'all' ? 2 : 4) && (
                        <Chip
                          label={`+${project.settings.tech_stack.length - (selectedProject === 'all' ? 2 : 4)}`}
                          size="small"
                          variant="outlined"
                          sx={{ fontSize: '0.7rem', height: 20 }}
                        />
                      )}
                    </Box>
                  )}
                </Paper>
              </Grid>
            ))}
          </Grid>
          
          {projects.length === 0 && (
            <Box sx={{ textAlign: 'center', py: 4 }}>
              <FolderOpen sx={{ fontSize: 48, color: 'text.disabled', mb: 2 }} />
              <Typography variant="body1" color="text.secondary">
                No projects found. Create your first project to get started.
              </Typography>
            </Box>
          )}
        </CardContent>
      </Card>
    </Box>
  );
}