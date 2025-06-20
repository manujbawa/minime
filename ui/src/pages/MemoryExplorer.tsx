import React, { useState, useEffect, useCallback } from 'react';
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
  TextField,
  Button,
  Chip,
  CircularProgress,
  InputAdornment,
  Avatar,
  Divider,
  ListSubheader,
} from '@mui/material';
import {
  Search,
  CalendarToday as Calendar,
  LocalOffer as Tag,
  Storage as Database,
  AccessTime as Clock,
} from '@mui/icons-material';
import { miniMeAPI } from '../services/api';
import type { Memory, Project, SearchFilters } from '../types';
import { format } from 'date-fns';
import { getMemoryTypesForUI, getMemoryTypeColor as getTypeColor, getMemoryTypesByCategories } from '../utils/memoryTypes';

const MemoryExplorer = () => {
  const [memories, setMemories] = useState<Memory[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProject, setSelectedProject] = useState('');
  const [filters, setFilters] = useState<SearchFilters>({});

  const loadProjects = async () => {
    try {
      const response = await miniMeAPI.getProjects();
      setProjects(response.projects);
      if (response.projects.length > 0) {
        setSelectedProject(response.projects[0].name);
      }
    } catch (error) {
      console.error('Failed to load projects:', error);
    }
  };

  const loadMemories = useCallback(async () => {
    if (!selectedProject) return;
    
    try {
      setLoading(true);
      if (selectedProject === '__ALL__') {
        // Search across all projects
        const response = await miniMeAPI.searchMemories('', {
          memory_type: filters.memory_type,
          limit: 50,
        });
        setMemories(response.memories);
      } else {
        const response = await miniMeAPI.getProjectMemories(selectedProject, {
          memory_type: filters.memory_type,
          limit: 50,
          order_by: 'created_at',
          order_direction: 'DESC',
        });
        setMemories(response.memories);
      }
    } catch (error) {
      console.error('Failed to load memories:', error);
    } finally {
      setLoading(false);
    }
  }, [selectedProject, filters.memory_type]);

  useEffect(() => {
    loadProjects();
  }, []);

  useEffect(() => {
    if (selectedProject) {
      loadMemories();
    }
  }, [selectedProject, filters, loadMemories]);

  const handleSearch = async () => {
    if (!selectedProject) return;

    try {
      setLoading(true);
      // If no search query, load memories for the project (or all projects)
      if (!searchQuery.trim()) {
        if (selectedProject === '__ALL__') {
          // Load recent memories across all projects
          const response = await miniMeAPI.searchMemories('', {
            memory_type: filters.memory_type,
            limit: 50,
          });
          setMemories(response.memories);
        } else {
          // Load project memories using existing loadMemories logic
          await loadMemories();
          return;
        }
      } else {
        // Perform search with query
        const response = await miniMeAPI.searchMemories(searchQuery, {
          project_name: selectedProject === '__ALL__' ? undefined : selectedProject,
          memory_type: filters.memory_type,
          limit: 50,
        });
        setMemories(response.memories);
      }
    } catch (error) {
      console.error('Search failed:', error);
    } finally {
      setLoading(false);
    }
  };

  const getMemoryTypeColor = (type: string): 'primary' | 'secondary' | 'info' | 'error' | 'default' => {
    return getTypeColor(type) as 'primary' | 'secondary' | 'info' | 'error' | 'default';
  };

  const getImportanceColor = (importance?: number): string => {
    if (!importance) return 'text.disabled';
    if (importance >= 8) return 'error.main';
    if (importance >= 6) return 'warning.main';
    if (importance >= 4) return 'info.main';
    return 'success.main';
  };

  const memoryTypesByCategory = getMemoryTypesByCategories();

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom fontWeight={600}>
          Memory Explorer
        </Typography>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
        Search and explore memories within a specific project or across all projects using semantic similarity
        </Typography>

      {/* Search Controls */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Grid container spacing={3} alignItems="center">
            {/* Project Selection */}
            <Grid size={{ xs: 12, lg: 3 }}>
              <FormControl fullWidth>
                <InputLabel>Project</InputLabel>
                <Select
                  value={selectedProject}
                  onChange={(e) => setSelectedProject(e.target.value)}
                  label="Project"
                >
                  <MenuItem value="">Select a project</MenuItem>
                  <MenuItem value="__ALL__">All Projects</MenuItem>
                  <Divider />
                  {projects.map((project) => (
                    <MenuItem key={project.id} value={project.name}>
                      {project.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            {/* Search */}
            <Grid size={{ xs: 12, lg: 6 }}>
              <TextField
                fullWidth
                label="Search Memories (optional)"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                placeholder="Search memories by content or leave empty to browse all..."
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <Search />
                    </InputAdornment>
                  ),
                }}
              />
            </Grid>

            <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
              <Button
                fullWidth
                variant="contained"
                onClick={handleSearch}
                disabled={!selectedProject}
                sx={{ height: 56 }}
              >
                {searchQuery.trim() ? 'Search' : 'Load Memories'}
              </Button>
            </Grid>
          </Grid>

          {/* Always Visible Filters */}
          <Box sx={{ mt: 3, pt: 3 }}>
            <Divider sx={{ mb: 3 }} />
            <Typography variant="h6" gutterBottom fontWeight={600}>
              Filters
            </Typography>
            <Grid container spacing={3}>
              <Grid size={{ xs: 12, sm: 6, md: 4 }}>
                <FormControl fullWidth>
                  <InputLabel>Memory Type</InputLabel>
                  <Select
                    value={filters.memory_type || ''}
                    onChange={(e) => setFilters({ ...filters, memory_type: e.target.value || undefined })}
                    label="Memory Type"
                  >
                    <MenuItem value="">All Types</MenuItem>
                    {Object.entries(memoryTypesByCategory).map(([category, types]) => [
                      <ListSubheader key={category} sx={{ textTransform: 'capitalize' }}>
                        {category.replace('_', ' ')}
                      </ListSubheader>,
                      ...types.map((type) => (
                        <MenuItem key={type.value} value={type.value}>
                          {type.label}
                        </MenuItem>
                      ))
                    ])}
                  </Select>
                </FormControl>
              </Grid>
              <Grid size={{ xs: 12, sm: 6, md: 4 }}>
                <FormControl fullWidth>
                  <InputLabel>Min Importance</InputLabel>
                  <Select
                    value={filters.importance_min || ''}
                    onChange={(e) => setFilters({ ...filters, importance_min: e.target.value ? parseInt(e.target.value.toString()) : undefined })}
                    label="Min Importance"
                  >
                    <MenuItem value="">Any</MenuItem>
                    <MenuItem value="5">5+ (High)</MenuItem>
                    <MenuItem value="7">7+ (Very High)</MenuItem>
                    <MenuItem value="9">9+ (Critical)</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid size={{ xs: 12, sm: 6, md: 4 }}>
                <FormControl fullWidth>
                  <InputLabel>Date Range</InputLabel>
                  <Select
                    value={filters.date_from || ''}
                    onChange={(e) => {
                      const value = e.target.value;
                      const date = value ? new Date(Date.now() - parseInt(value.toString()) * 24 * 60 * 60 * 1000).toISOString().split('T')[0] : undefined;
                      setFilters({ ...filters, date_from: date });
                    }}
                    label="Date Range"
                  >
                    <MenuItem value="">All Time</MenuItem>
                    <MenuItem value="1">Last Day</MenuItem>
                    <MenuItem value="7">Last Week</MenuItem>
                    <MenuItem value="30">Last Month</MenuItem>
                    <MenuItem value="90">Last 3 Months</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
            </Grid>
          </Box>
        </CardContent>
      </Card>

      {/* Results */}
      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom fontWeight={600}>
            {searchQuery ? `Search Results for "${searchQuery}"` : 'Recent Memories'}
            {selectedProject === '__ALL__' ? ' (All Projects)' : selectedProject ? ` (${selectedProject})` : ''}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            {memories.length} memories found{selectedProject === '__ALL__' ? ' across all projects' : ''}
          </Typography>

          {loading ? (
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', py: 6 }}>
              <CircularProgress sx={{ mb: 2 }} />
              <Typography color="text.secondary">Loading memories...</Typography>
            </Box>
          ) : memories.length === 0 ? (
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', py: 6 }}>
              <Database sx={{ fontSize: 48, color: 'text.disabled', mb: 2 }} />
              <Typography color="text.secondary">
                {searchQuery ? 'No memories found for your search.' : 'No memories in this project yet.'}
              </Typography>
            </Box>
          ) : (
            <Box sx={{ mt: 2 }}>
              {memories.map((memory, index) => (
                <Box key={memory.id}>
                  {index > 0 && <Divider sx={{ my: 2 }} />}
                  <Box sx={{ py: 2, '&:hover': { bgcolor: 'action.hover' }, borderRadius: 1, px: 1 }}>
                    <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2, mb: 2 }}>
                      <Chip
                        label={memory.memory_type}
                        color={getMemoryTypeColor(memory.memory_type)}
                        size="small"
                        variant="outlined"
                      />
                      {selectedProject === '__ALL__' && (memory as any).project_name && (
                        <Chip
                          label={(memory as any).project_name}
                          size="small"
                          color="secondary"
                          variant="outlined"
                        />
                      )}
                      {(memory.importance || memory.importance_score) && (
                        <Chip
                          label={`Importance: ${memory.importance || memory.importance_score}/10`}
                          size="small"
                          sx={{ color: getImportanceColor(memory.importance || memory.importance_score) }}
                          variant="outlined"
                        />
                      )}
                      {memory.tags && memory.tags.length > 0 && (
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                          <Tag sx={{ fontSize: 14, color: 'text.secondary' }} />
                          <Typography variant="caption" color="text.secondary">
                            {memory.tags.join(', ')}
                          </Typography>
                        </Box>
                      )}
                    </Box>
                    <Typography variant="body1" sx={{ mb: 2, lineHeight: 1.6 }}>
                      {memory.content}
                    </Typography>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <Clock sx={{ fontSize: 14, color: 'text.secondary' }} />
                        <Typography variant="caption" color="text.secondary">
                          {format(new Date(memory.created_at), 'MMM d, yyyy at h:mm a')}
                        </Typography>
                      </Box>
                      {memory.similarity && (
                        <Typography variant="caption" color="text.secondary">
                          Similarity: {Math.round(memory.similarity * 100)}%
                        </Typography>
                      )}
                    </Box>
                  </Box>
                </Box>
              ))}
            </Box>
          )}
        </CardContent>
      </Card>
    </Box>
  );
}

export default MemoryExplorer;