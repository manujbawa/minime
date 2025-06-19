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
  TextField,
  Button,
  Chip,
  IconButton,
  Collapse,
  CircularProgress,
  Alert,
  InputAdornment,
  Avatar,
  Divider,
  Paper,
  Slider,
} from '@mui/material';
import {
  Search as SearchIcon,
  FilterList as Filter,
  CalendarToday as Calendar,
  LocalOffer as Tag,
  Psychology as Brain,
  Storage as Database,
  AccessTime as Clock,
  ArrowForward,
  ExpandMore,
  ExpandLess,
  Clear,
} from '@mui/icons-material';
import { miniMeAPI } from '../services/api';
import type { Project, Memory, SearchResult, SearchFilters } from '../types';

const Search = () => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  
  // Filter states
  const [selectedProject, setSelectedProject] = useState<string>('');
  const [selectedType, setSelectedType] = useState<string>('');
  const [minImportance, setMinImportance] = useState<number>(0);
  const [dateRange, setDateRange] = useState<string>('');

  useEffect(() => {
    loadProjects();
  }, []);

  const loadProjects = async () => {
    try {
      const response = await miniMeAPI.getProjects(true);
      setProjects(response.projects);
    } catch (error) {
      console.error('Error loading projects:', error);
    }
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;

    try {
      setLoading(true);
      setError(null);

      const filters: SearchFilters = {};
      if (selectedProject) filters.project_name = selectedProject;
      if (selectedType) filters.memory_type = selectedType;
      if (minImportance > 0) filters.min_importance = minImportance;
      filters.limit = 50;

      const response = await miniMeAPI.searchMemories(query, filters);
      setResults(response);
    } catch (error) {
      setError('Search failed. Please try again.');
      console.error('Search error:', error);
    } finally {
      setLoading(false);
    }
  };

  const clearFilters = () => {
    setSelectedProject('');
    setSelectedType('');
    setMinImportance(0);
    setDateRange('');
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const getTypeColor = (type: string): 'primary' | 'secondary' | 'info' | 'warning' | 'error' | 'success' | 'default' => {
    const colors: Record<string, 'primary' | 'secondary' | 'info' | 'warning' | 'error' | 'success' | 'default'> = {
      insight: 'primary',
      code: 'success',
      decision: 'info',
      bug: 'error',
      general: 'default',
      meeting: 'warning',
      documentation: 'secondary',
    };
    return colors[type] || 'default';
  };

  const getImportanceColor = (importance: number): string => {
    if (importance >= 0.8) return 'error.main';
    if (importance >= 0.6) return 'warning.main';
    return 'success.main';
  };

  const memoryTypes = ['insight', 'code', 'decision', 'bug', 'general', 'meeting', 'documentation'];

  return (
    <Box sx={{ p: 4 }}>
      {/* Header */}
      <Box sx={{ mb: 4 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
          <SearchIcon sx={{ fontSize: 32, color: 'primary.main' }} />
          <Typography variant="h2" component="h1" fontWeight="bold">
            Universal Search
          </Typography>
        </Box>
        <Typography variant="body1" color="text.secondary">
          Search across all your memories, projects, and thinking sequences
        </Typography>
      </Box>

      {/* Search Form */}
      <Card sx={{ mb: 4 }}>
        <CardContent>
          <Box component="form" onSubmit={handleSearch}>
            <Grid container spacing={3} alignItems="flex-end">
              {/* Search Input */}
              <Grid item xs={12} md={8}>
                <TextField
                  fullWidth
                  label="Search your digital twin's memory"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="e.g., 'React components', 'debugging strategies', 'project decisions'..."
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <SearchIcon />
                      </InputAdornment>
                    ),
                  }}
                />
              </Grid>

              {/* Search Button */}
              <Grid item xs={12} md={2}>
                <Button
                  fullWidth
                  variant="contained"
                  type="submit"
                  disabled={!query.trim() || loading}
                  sx={{ height: 56 }}
                >
                  {loading ? <CircularProgress size={24} /> : 'Search'}
                </Button>
              </Grid>

              {/* Filter Toggle */}
              <Grid item xs={12} md={2}>
                <IconButton
                  onClick={() => setShowFilters(!showFilters)}
                  sx={{ height: 56, width: '100%', border: '1px solid', borderColor: 'divider' }}
                >
                  <Filter />
                  {showFilters ? <ExpandLess /> : <ExpandMore />}
                </IconButton>
              </Grid>
            </Grid>

            {/* Advanced Filters */}
            <Collapse in={showFilters}>
              <Box sx={{ mt: 3, pt: 3 }}>
                <Divider sx={{ mb: 3 }} />
                <Typography variant="h6" gutterBottom>
                  Advanced Filters
                </Typography>
                <Grid container spacing={3}>
                  <Grid item xs={12} md={3}>
                    <FormControl fullWidth>
                      <InputLabel>Project</InputLabel>
                      <Select
                        value={selectedProject}
                        onChange={(e) => setSelectedProject(e.target.value)}
                        label="Project"
                      >
                        <MenuItem value="">All Projects</MenuItem>
                        {projects.map((project) => (
                          <MenuItem key={project.id} value={project.name}>
                            {project.name}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  </Grid>

                  <Grid item xs={12} md={3}>
                    <FormControl fullWidth>
                      <InputLabel>Memory Type</InputLabel>
                      <Select
                        value={selectedType}
                        onChange={(e) => setSelectedType(e.target.value)}
                        label="Memory Type"
                      >
                        <MenuItem value="">All Types</MenuItem>
                        {memoryTypes.map((type) => (
                          <MenuItem key={type} value={type}>
                            {type.charAt(0).toUpperCase() + type.slice(1)}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  </Grid>

                  <Grid item xs={12} md={3}>
                    <Box>
                      <Typography variant="body2" gutterBottom>
                        Min Importance: {minImportance}/10
                      </Typography>
                      <Slider
                        value={minImportance}
                        onChange={(_, value) => setMinImportance(value as number)}
                        min={0}
                        max={10}
                        step={1}
                        marks
                        valueLabelDisplay="auto"
                      />
                    </Box>
                  </Grid>

                  <Grid item xs={12} md={3}>
                    <Button
                      variant="outlined"
                      startIcon={<Clear />}
                      onClick={clearFilters}
                      fullWidth
                    >
                      Clear Filters
                    </Button>
                  </Grid>
                </Grid>
              </Box>
            </Collapse>
          </Box>
        </CardContent>
      </Card>

      {/* Error Message */}
      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      {/* Search Results */}
      {results && (
        <Card>
          <CardContent>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
              <Typography variant="h6" fontWeight={600}>
                Search Results
              </Typography>
              <Chip
                label={`${results.count} memories found`}
                color="primary"
                variant="outlined"
              />
            </Box>

            {results.memories.length === 0 ? (
              <Paper sx={{ p: 6, textAlign: 'center', bgcolor: 'grey.50' }}>
                <SearchIcon sx={{ fontSize: 48, color: 'text.disabled', mb: 2 }} />
                <Typography variant="h6" gutterBottom color="text.secondary">
                  No memories found
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Try adjusting your search terms or filters
                </Typography>
              </Paper>
            ) : (
              <Box sx={{ mt: 2 }}>
                {results.memories.map((memory, index) => (
                  <Box key={memory.id}>
                    {index > 0 && <Divider sx={{ my: 3 }} />}
                    <Box sx={{ py: 2 }}>
                      {/* Memory Header */}
                      <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2, mb: 2 }}>
                        <Avatar sx={{ bgcolor: 'primary.main' }}>
                          <Database />
                        </Avatar>
                        <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                            <Chip
                              label={memory.memory_type}
                              color={getTypeColor(memory.memory_type)}
                              size="small"
                              variant="outlined"
                            />
                            {memory.importance_score && (
                              <Chip
                                label={`${Math.round(memory.importance_score * 10)}/10`}
                                size="small"
                                sx={{ color: getImportanceColor(memory.importance_score) }}
                                variant="outlined"
                              />
                            )}
                            {memory.similarity && (
                              <Chip
                                label={`${Math.round(memory.similarity * 100)}% match`}
                                size="small"
                                color="info"
                                variant="outlined"
                              />
                            )}
                          </Box>
                          
                          {/* Memory Content */}
                          <Typography variant="body1" sx={{ mb: 2, lineHeight: 1.6 }}>
                            {memory.content}
                          </Typography>

                          {/* Tags */}
                          {memory.tags && memory.tags.length > 0 && (
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 2 }}>
                              <Tag sx={{ fontSize: 16, color: 'text.secondary' }} />
                              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                                {memory.tags.map((tag, tagIndex) => (
                                  <Chip
                                    key={tagIndex}
                                    label={tag}
                                    size="small"
                                    variant="outlined"
                                    sx={{ fontSize: '0.7rem' }}
                                  />
                                ))}
                              </Box>
                            </Box>
                          )}

                          {/* Metadata */}
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                              <Clock sx={{ fontSize: 16, color: 'text.secondary' }} />
                              <Typography variant="caption" color="text.secondary">
                                {formatDate(memory.created_at)}
                              </Typography>
                            </Box>
                            {memory.metadata && Object.keys(memory.metadata).length > 0 && (
                              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                                {Object.entries(memory.metadata).slice(0, 3).map(([key, value]) => (
                                  <Chip
                                    key={key}
                                    label={`${key}: ${String(value)}`}
                                    size="small"
                                    variant="outlined"
                                    sx={{ fontSize: '0.7rem' }}
                                  />
                                ))}
                                {Object.keys(memory.metadata).length > 3 && (
                                  <Chip
                                    label={`+${Object.keys(memory.metadata).length - 3} more`}
                                    size="small"
                                    variant="outlined"
                                    sx={{ fontSize: '0.7rem' }}
                                  />
                                )}
                              </Box>
                            )}
                          </Box>
                        </Box>
                        
                        {/* View Details Button */}
                        <Button
                          variant="outlined"
                          size="small"
                          endIcon={<ArrowForward />}
                        >
                          View Details
                        </Button>
                      </Box>
                    </Box>
                  </Box>
                ))}
              </Box>
            )}
          </CardContent>
        </Card>
      )}

      {/* Initial State */}
      {!results && !loading && (
        <Paper sx={{ p: 6, textAlign: 'center' }}>
          <SearchIcon sx={{ fontSize: 64, color: 'text.disabled', mb: 2 }} />
          <Typography variant="h5" gutterBottom>
            Search Your Digital Twin
          </Typography>
          <Typography variant="body1" color="text.secondary" sx={{ mb: 3, maxWidth: 600, mx: 'auto' }}>
            Find memories, insights, and decisions from across all your projects. 
            Use natural language to discover relevant information from your past work.
          </Typography>
          <Grid container spacing={2} justifyContent="center" sx={{ maxWidth: 800, mx: 'auto' }}>
            <Grid item xs={12} sm={6} md={3}>
              <Paper sx={{ p: 2, bgcolor: 'primary.50', border: '1px solid', borderColor: 'primary.200' }}>
                <Brain sx={{ color: 'primary.main', mb: 1 }} />
                <Typography variant="subtitle2" color="primary.main">
                  Semantic Search
                </Typography>
                <Typography variant="caption" color="primary.dark">
                  Find by meaning, not just keywords
                </Typography>
              </Paper>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Paper sx={{ p: 2, bgcolor: 'success.50', border: '1px solid', borderColor: 'success.200' }}>
                <Database sx={{ color: 'success.main', mb: 1 }} />
                <Typography variant="subtitle2" color="success.main">
                  Cross-Project
                </Typography>
                <Typography variant="caption" color="success.dark">
                  Search across all projects
                </Typography>
              </Paper>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Paper sx={{ p: 2, bgcolor: 'warning.50', border: '1px solid', borderColor: 'warning.200' }}>
                <Filter sx={{ color: 'warning.main', mb: 1 }} />
                <Typography variant="subtitle2" color="warning.main">
                  Smart Filters
                </Typography>
                <Typography variant="caption" color="warning.dark">
                  Filter by type, importance, date
                </Typography>
              </Paper>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Paper sx={{ p: 2, bgcolor: 'info.50', border: '1px solid', borderColor: 'info.200' }}>
                <Tag sx={{ color: 'info.main', mb: 1 }} />
                <Typography variant="subtitle2" color="info.main">
                  Rich Metadata
                </Typography>
                <Typography variant="caption" color="info.dark">
                  Context-aware results
                </Typography>
              </Paper>
            </Grid>
          </Grid>
        </Paper>
      )}
    </Box>
  );
}

export default Search;