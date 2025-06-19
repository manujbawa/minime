import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Button,
  Card,
  CardContent,
  CardActions,
  Grid,
  Chip,
  Avatar,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  CircularProgress,
  Alert,
  Paper,
  Divider,
  TextField,
  InputAdornment,
} from '@mui/material';
import {
  Add as AddIcon,
  FolderOpen as FolderOpenIcon,
  BarChart as BarChartIcon,
  TrendingUp as ActivityIcon,
  Search as SearchIcon,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { miniMeAPI } from '../services/api';
import type { Project } from '../types';

const ProjectsMUI = () => {
  const navigate = useNavigate();
  const [projects, setProjects] = useState<Project[]>([]);
  const [filteredProjects, setFilteredProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    loadProjects();
  }, []);

  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredProjects(projects);
    } else {
      const filtered = projects.filter(project => 
        project.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (project.description && project.description.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (project.settings?.tech_stack?.some((tech: string) => 
          tech.toLowerCase().includes(searchQuery.toLowerCase())
        ))
      );
      setFilteredProjects(filtered);
    }
  }, [projects, searchQuery]);

  const loadProjects = async () => {
    try {
      setLoading(true);
      const response = await miniMeAPI.getProjects(true);
      setProjects(response.projects);
    } catch (error) {
      setError('Failed to load projects');
      console.error('Error loading projects:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const getActivityColor = (lastActivity: string) => {
    const daysSince = Math.floor((Date.now() - new Date(lastActivity).getTime()) / (1000 * 60 * 60 * 24));
    if (daysSince <= 1) return 'success';
    if (daysSince <= 7) return 'warning';
    return 'default';
  };

  const getTechStackColors = (index: number) => {
    const colors = ['primary', 'secondary', 'info', 'warning', 'error'] as const;
    return colors[index % colors.length];
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '50vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ p: 4 }}>
      {/* Header */}
      <Box sx={{ mb: 4 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 3 }}>
          <Box>
            <Typography variant="h2" component="h1" gutterBottom fontWeight="bold">
              Projects
            </Typography>
            <Typography variant="body1" color="text.secondary">
              Manage your development projects and their memories
            </Typography>
          </Box>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => setShowCreateModal(true)}
            sx={{ borderRadius: 2 }}
          >
            New Project
          </Button>
        </Box>
        
        {/* Search Field */}
        <TextField
          fullWidth
          placeholder="Search projects by name, description, or technology..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon />
              </InputAdornment>
            ),
          }}
          sx={{ maxWidth: 600 }}
        />
      </Box>

      {/* Error Message */}
      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      {/* Projects Grid - Three Column Layout */}
      <Grid container spacing={3}>
        {filteredProjects.map((project) => (
          <Grid size={{ xs: 12, sm: 6, lg: 4 }} key={project.id}>
            <Card
              sx={{
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                transition: 'transform 0.2s, box-shadow 0.2s',
                '&:hover': {
                  transform: 'translateY(-2px)',
                  boxShadow: 3,
                },
                minHeight: 320, // Reduced height for more compact cards
              }}
            >
              <CardContent sx={{ flexGrow: 1, pb: 1 }}>
                {/* Project Header */}
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                  <Avatar sx={{ bgcolor: 'primary.main', mr: 2 }}>
                    <FolderOpenIcon />
                  </Avatar>
                  <Box sx={{ minWidth: 0, flexGrow: 1 }}>
                    <Typography variant="h6" component="h3" noWrap fontWeight="600">
                      {project.name}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Created {formatDate(project.created_at)}
                    </Typography>
                  </Box>
                </Box>

                {/* Description */}
                <Typography 
                  variant="body2" 
                  color="text.secondary" 
                  sx={{ 
                    mb: 2,
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden',
                  }}
                >
                  {project.description}
                </Typography>

                {/* Tech Stack */}
                {project.settings?.tech_stack && (
                  <Box sx={{ mb: 2 }}>
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                      {project.settings.tech_stack.slice(0, 3).map((tech: string, index: number) => (
                        <Chip
                          key={index}
                          label={tech}
                          size="small"
                          color={getTechStackColors(index)}
                          variant="outlined"
                        />
                      ))}
                      {project.settings.tech_stack.length > 3 && (
                        <Chip
                          label={`+${project.settings.tech_stack.length - 3} more`}
                          size="small"
                          variant="outlined"
                        />
                      )}
                    </Box>
                  </Box>
                )}

                {/* Statistics */}
                <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
                  <Grid container spacing={2}>
                    <Grid size={{ xs: 4 }}>
                      <Box sx={{ textAlign: 'center' }}>
                        <Typography variant="h6" fontWeight="bold">
                          {project.memory_count || 0}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          Memories
                        </Typography>
                      </Box>
                    </Grid>
                    <Grid size={{ xs: 4 }}>
                      <Box sx={{ textAlign: 'center' }}>
                        <Typography variant="h6" fontWeight="bold">
                          {project.session_count || 0}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          Sessions
                        </Typography>
                      </Box>
                    </Grid>
                    <Grid size={{ xs: 4 }}>
                      <Box sx={{ textAlign: 'center' }}>
                        <Typography variant="h6" fontWeight="bold">
                          {project.thinking_sequence_count || 0}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          Sequences
                        </Typography>
                      </Box>
                    </Grid>
                  </Grid>
                </Paper>

                {/* Last Activity */}
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    <ActivityIcon 
                      sx={{ 
                        fontSize: 16, 
                        mr: 0.5,
                        color: getActivityColor(project.last_activity || project.updated_at) === 'success' ? 'success.main' :
                               getActivityColor(project.last_activity || project.updated_at) === 'warning' ? 'warning.main' : 'text.secondary'
                      }} 
                    />
                    <Typography variant="caption" color="text.secondary">
                      Last activity {formatDate(project.last_activity || project.updated_at)}
                    </Typography>
                  </Box>
                </Box>
              </CardContent>

              <Divider />

              {/* Actions */}
              <CardActions sx={{ justifyContent: 'center', px: 2, py: 1.5 }}>
                <Button
                  size="small"
                  startIcon={<BarChartIcon />}
                  color="primary"
                  onClick={() => navigate(`/projects/${encodeURIComponent(project.name)}`)}
                  fullWidth
                >
                  View Details
                </Button>
              </CardActions>
            </Card>
          </Grid>
        ))}
      </Grid>

      {/* Empty State */}
      {!loading && (
        <>
          {projects.length === 0 ? (
            <Paper sx={{ p: 6, textAlign: 'center', mt: 4 }}>
              <FolderOpenIcon sx={{ fontSize: 48, color: 'text.disabled', mb: 2 }} />
              <Typography variant="h5" gutterBottom fontWeight="500">
                No projects yet
              </Typography>
              <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
                Get started by creating your first project
              </Typography>
              <Button
                variant="contained"
                startIcon={<AddIcon />}
                onClick={() => setShowCreateModal(true)}
              >
                Create Project
              </Button>
            </Paper>
          ) : filteredProjects.length === 0 && searchQuery.trim() ? (
            <Paper sx={{ p: 6, textAlign: 'center', mt: 4 }}>
              <SearchIcon sx={{ fontSize: 48, color: 'text.disabled', mb: 2 }} />
              <Typography variant="h5" gutterBottom fontWeight="500">
                No projects found
              </Typography>
              <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
                No projects match your search criteria &ldquo;{searchQuery}&rdquo;
              </Typography>
              <Button
                variant="outlined"
                onClick={() => setSearchQuery('')}
              >
                Clear Search
              </Button>
            </Paper>
          ) : null}
        </>
      )}

      {/* Create Project Modal */}
      <Dialog 
        open={showCreateModal} 
        onClose={() => setShowCreateModal(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Create New Project</DialogTitle>
        <DialogContent>
          <Typography color="text.secondary">
            Project creation functionality will be implemented soon.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowCreateModal(false)}>
            Cancel
          </Button>
          <Button 
            variant="contained" 
            onClick={() => setShowCreateModal(false)}
          >
            Coming Soon
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export default ProjectsMUI;