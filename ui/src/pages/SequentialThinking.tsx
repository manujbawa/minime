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
  Chip,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  CircularProgress,
  Alert,
  Avatar,
  Paper,
  Divider,
  Tooltip,
  LinearProgress,
} from '@mui/material';
import {
  Psychology as Brain,
  PlayArrow as Play,
  CheckCircle,
  Schedule as Clock,
  ArrowForward,
  Lightbulb,
  Visibility as Eye,
  TrendingUp,
  Close,
  AccountTree,
  Timeline,
} from '@mui/icons-material';
// Removed ReactFlow due to persistent compatibility issues
// Using custom SVG-based flow diagram instead
import { miniMeAPI } from '../services/api';
import type { Project, ThinkingSequence, Thought } from '../types';

// Custom SVG node types for different thought types
const thoughtTypeConfig = {
  reasoning: { color: '#2196F3', icon: '🔍', label: 'Reasoning' },
  conclusion: { color: '#4CAF50', icon: '⚖️', label: 'Conclusion' },
  question: { color: '#FF9800', icon: '❓', label: 'Question' },
  hypothesis: { color: '#9C27B0', icon: '💡', label: 'Hypothesis' },
  observation: { color: '#F44336', icon: '👁️', label: 'Observation' },
  assumption: { color: '#795548', icon: '🤔', label: 'Assumption' },
  default: { color: '#757575', icon: '💭', label: 'Thought' }
};

// Simple SVG flow diagram component
interface FlowDiagramProps {
  thoughts: Thought[];
  width?: number;
  height?: number;
}

const FlowDiagram: React.FC<FlowDiagramProps> = ({ thoughts, width = 800, height = 600 }) => {
  if (!thoughts || thoughts.length === 0) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height, border: '1px solid #e0e0e0', borderRadius: 2 }}>
        <Typography color="text.secondary">No thoughts to visualize</Typography>
      </Box>
    );
  }

  const sortedThoughts = [...thoughts].sort((a, b) => a.thought_number - b.thought_number);
  const nodeWidth = 200;
  const nodeHeight = 80;
  const horizontalSpacing = 250;
  const verticalSpacing = 120;
  const nodesPerRow = 3;

  return (
    <Box sx={{ width: '100%', height, overflow: 'auto', border: '1px solid #e0e0e0', borderRadius: 2 }}>
      <svg width={Math.max(width, nodesPerRow * horizontalSpacing)} height={Math.max(height, Math.ceil(sortedThoughts.length / nodesPerRow) * verticalSpacing + 100)}>
        {/* Draw connections first (behind nodes) */}
        {sortedThoughts.map((thought, index) => {
          if (index === 0) return null;
          
          const currentRow = Math.floor(index / nodesPerRow);
          const currentCol = index % nodesPerRow;
          const currentX = currentCol * horizontalSpacing + nodeWidth / 2 + 50;
          const currentY = currentRow * verticalSpacing + nodeHeight / 2 + 50;
          
          const prevRow = Math.floor((index - 1) / nodesPerRow);
          const prevCol = (index - 1) % nodesPerRow;
          const prevX = prevCol * horizontalSpacing + nodeWidth / 2 + 50;
          const prevY = prevRow * verticalSpacing + nodeHeight / 2 + 50;
          
          return (
            <g key={`edge-${thought.id}`}>
              <line
                x1={prevX}
                y1={prevY}
                x2={currentX}
                y2={currentY}
                stroke="#666"
                strokeWidth="2"
                markerEnd="url(#arrowhead)"
              />
            </g>
          );
        })}
        
        {/* Arrow marker definition */}
        <defs>
          <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
            <polygon points="0 0, 10 3.5, 0 7" fill="#666" />
          </marker>
        </defs>
        
        {/* Draw nodes */}
        {sortedThoughts.map((thought, index) => {
          const row = Math.floor(index / nodesPerRow);
          const col = index % nodesPerRow;
          const x = col * horizontalSpacing + 50;
          const y = row * verticalSpacing + 50;
                     const thoughtConfig = thoughtTypeConfig[thought.thought_type as keyof typeof thoughtTypeConfig] || thoughtTypeConfig.default;
          
          return (
            <g key={thought.id}>
              {/* Node background */}
              <rect
                x={x}
                y={y}
                width={nodeWidth}
                height={nodeHeight}
                rx="8"
                fill={thoughtConfig.color}
                stroke="#fff"
                strokeWidth="2"
              />
              
              {/* Node text */}
              <foreignObject x={x + 10} y={y + 10} width={nodeWidth - 20} height={nodeHeight - 20}>
                <Box sx={{ color: 'white', fontSize: '12px', fontWeight: 600, overflow: 'hidden' }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 0.5 }}>
                    <span style={{ marginRight: '4px' }}>{thoughtConfig.icon}</span>
                    <span>#{thought.thought_number}</span>
                  </Box>
                  <Box sx={{ fontSize: '10px', opacity: 0.9, lineHeight: 1.2 }}>
                    {thought.content.substring(0, 80)}...
                  </Box>
                </Box>
              </foreignObject>
              
              {/* Confidence indicator */}
              {thought.confidence_level && (
                <circle
                  cx={x + nodeWidth - 15}
                  cy={y + 15}
                  r="8"
                  fill={thought.confidence_level > 0.7 ? '#4CAF50' : thought.confidence_level > 0.4 ? '#FF9800' : '#F44336'}
                  stroke="#fff"
                  strokeWidth="1"
                />
              )}
            </g>
          );
        })}
      </svg>
    </Box>
  );
};

const SequentialThinking = () => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProject, setSelectedProject] = useState<string>('');
  const [sequences, setSequences] = useState<ThinkingSequence[]>([]);
  const [loading, setLoading] = useState(true);
  const [sequencesLoading, setSequencesLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedSequence, setSelectedSequence] = useState<ThinkingSequence | null>(null);
  const [sequenceDetails, setSequenceDetails] = useState<ThinkingSequence | null>(null);
  const [detailsLoading, setDetailsLoading] = useState(false);

  useEffect(() => {
    loadProjects();
  }, []);

  useEffect(() => {
    if (selectedProject) {
      loadSequences();
    }
  }, [selectedProject]);

  const loadProjects = async () => {
    try {
      setLoading(true);
      const response = await miniMeAPI.getProjects(true);
      setProjects(response.projects);
      if (response.projects.length > 0) {
        setSelectedProject(response.projects[0].name);
      }
    } catch (error) {
      setError('Failed to load projects');
      console.error('Error loading projects:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadSequences = async () => {
    if (!selectedProject) return;
    
    try {
      setSequencesLoading(true);
      const response = await miniMeAPI.getProjectThinking(selectedProject, true);
      setSequences(response.sequences);
    } catch (error) {
      setError('Failed to load thinking sequences');
      console.error('Error loading sequences:', error);
    } finally {
      setSequencesLoading(false);
    }
  };

  const loadSequenceDetails = async (sequence: ThinkingSequence) => {
    try {
      setDetailsLoading(true);
      console.log('Loading sequence details for:', sequence.id, sequence.sequence_name);
      
      // Fetch detailed sequence data with thoughts
      const response = await miniMeAPI.getThinkingSequence(sequence.id, {
        format: 'detailed',
        branches: true
      });
      
      console.log('API response:', response);
      console.log('Sequence thoughts:', response.sequence.thoughts);
      
      setSequenceDetails(response.sequence);
      generateFlowDiagram(response.sequence);
    } catch (error) {
      console.error('Error loading sequence details:', error);
      console.log('Falling back to original sequence data:', sequence);
      // Fallback to the sequence data we have
      setSequenceDetails(sequence);
      generateFlowDiagram(sequence);
    } finally {
      setDetailsLoading(false);
    }
  };

  // Simplified flow diagram approach - no more ReactFlow dependencies
  const generateFlowDiagram = (sequence: ThinkingSequence) => {
    console.log('Generating flow diagram for sequence:', sequence);
    console.log('Sequence has thoughts:', sequence.thoughts ? sequence.thoughts.length : 0);
    // Flow diagram will be handled by the FlowDiagram component directly
  };

// Removed generateSampleFlow - using FlowDiagram component directly

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const handleSequenceClick = (sequence: ThinkingSequence) => {
    setSelectedSequence(sequence);
    loadSequenceDetails(sequence);
  };

  const selectedProjectData = projects.find(p => p.name === selectedProject);

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
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
          <Brain sx={{ fontSize: 32, color: 'primary.main' }} />
          <Typography variant="h2" component="h1" fontWeight="bold">
            Sequential Thinking
          </Typography>
        </Box>
        <Typography variant="body1" color="text.secondary">
          Explore your structured reasoning processes and thought sequences
        </Typography>
      </Box>

      {/* Project Selection */}
      {projects.length > 0 && (
        <Box sx={{ mb: 4 }}>
          <FormControl sx={{ minWidth: 300 }}>
            <InputLabel>Select Project</InputLabel>
            <Select
              value={selectedProject}
              onChange={(e) => setSelectedProject(e.target.value)}
              label="Select Project"
            >
              {projects.map((project) => (
                <MenuItem key={project.id} value={project.name}>
                  {project.name} ({project.thinking_sequence_count || 0} sequences)
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Box>
      )}

      {/* Error Message */}
      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      {/* Project Stats */}
      {selectedProjectData && (
        <Grid container spacing={3} sx={{ mb: 4 }}>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Box>
                    <Typography variant="h4" fontWeight="bold" color="primary.main">
                      {selectedProjectData.thinking_sequence_count || 0}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Total Sequences
                    </Typography>
                  </Box>
                  <Avatar sx={{ bgcolor: 'primary.main' }}>
                    <Brain />
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
                    <Typography variant="h4" fontWeight="bold" color="success.main">
                      {sequences.filter(s => s.is_complete).length}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Completed
                    </Typography>
                  </Box>
                  <Avatar sx={{ bgcolor: 'success.main' }}>
                    <CheckCircle />
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
                      {sequences.filter(s => !s.is_complete).length}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      In Progress
                    </Typography>
                  </Box>
                  <Avatar sx={{ bgcolor: 'warning.main' }}>
                    <Clock />
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
                      {selectedProjectData.memory_count || 0}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Related Memories
                    </Typography>
                  </Box>
                  <Avatar sx={{ bgcolor: 'info.main' }}>
                    <TrendingUp />
                  </Avatar>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      {/* Thinking Sequences */}
      {sequencesLoading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
          <CircularProgress />
        </Box>
      ) : (
        <Grid container spacing={3}>
          {sequences.map((sequence) => (
            <Grid item xs={12} key={sequence.id}>
              <Card
                sx={{
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  '&:hover': {
                    transform: 'translateY(-2px)',
                    boxShadow: 3,
                  }
                }}
                onClick={() => handleSequenceClick(sequence)}
              >
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', mb: 2 }}>
                    <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2, flexGrow: 1 }}>
                      <Avatar sx={{ bgcolor: sequence.is_complete ? 'success.main' : 'warning.main' }}>
                        {sequence.is_complete ? <CheckCircle /> : <Clock />}
                      </Avatar>
                      <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                        <Typography variant="h6" fontWeight={600} gutterBottom>
                          {sequence.sequence_name}
                        </Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                          {sequence.description}
                        </Typography>
                        {sequence.goal && (
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 2 }}>
                            <Lightbulb sx={{ fontSize: 16, color: 'primary.main' }} />
                            <Typography variant="body2" color="primary.main">
                              Goal: {sequence.goal}
                            </Typography>
                          </Box>
                        )}
                      </Box>
                    </Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Chip
                        label={sequence.is_complete ? 'Completed' : 'In Progress'}
                        color={sequence.is_complete ? 'success' : 'warning'}
                        size="small"
                        variant="outlined"
                      />
                    </Box>
                  </Box>

                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                      <Typography variant="caption" color="text.secondary">
                        Created: {formatDate(sequence.created_at)}
                      </Typography>
                      {sequence.updated_at !== sequence.created_at && (
                        <Typography variant="caption" color="text.secondary">
                          Updated: {formatDate(sequence.updated_at)}
                        </Typography>
                      )}
                    </Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      <Eye sx={{ fontSize: 16 }} />
                      <Typography variant="caption" color="text.secondary">
                        Click to explore
                      </Typography>
                      <ArrowForward sx={{ fontSize: 16 }} />
                    </Box>
                  </Box>

                  {/* Metadata */}
                  {sequence.metadata && Object.keys(sequence.metadata).length > 0 && (
                    <Box sx={{ mt: 2, pt: 2 }}>
                      <Divider sx={{ mb: 2 }} />
                      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                        {Object.entries(sequence.metadata).map(([key, value]) => (
                          <Chip
                            key={key}
                            label={`${key}: ${String(value)}`}
                            size="small"
                            variant="outlined"
                            sx={{ fontSize: '0.7rem' }}
                          />
                        ))}
                      </Box>
                    </Box>
                  )}
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}

      {/* Empty State */}
      {!sequencesLoading && sequences.length === 0 && selectedProject && (
        <Paper sx={{ p: 6, textAlign: 'center' }}>
          <Brain sx={{ fontSize: 48, color: 'text.disabled', mb: 2 }} />
          <Typography variant="h6" gutterBottom>
            No thinking sequences yet
          </Typography>
          <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
            Thinking sequences will appear here as you use the MCP tools to structure your reasoning
          </Typography>
          <Paper sx={{ p: 3, bgcolor: 'primary.50', border: '1px solid', borderColor: 'primary.200', maxWidth: 400, mx: 'auto' }}>
            <Typography variant="body2" color="primary.dark">
              <strong>Tip:</strong> Use the &quot;start_thinking_sequence&quot; MCP tool in your IDE to begin structured reasoning
            </Typography>
          </Paper>
        </Paper>
      )}

      {/* Sequence Detail Modal with Flow Diagram */}
      <Dialog
        open={Boolean(selectedSequence)}
        onClose={() => setSelectedSequence(null)}
        maxWidth="lg"
        fullWidth
        PaperProps={{ sx: { height: '80vh' } }}
      >
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <AccountTree />
              <Typography variant="h6">
                {selectedSequence?.sequence_name}
              </Typography>
            </Box>
            <IconButton onClick={() => setSelectedSequence(null)}>
              <Close />
            </IconButton>
          </Box>
        </DialogTitle>
        <DialogContent sx={{ p: 0, height: '100%' }}>
          {detailsLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
              <CircularProgress />
            </Box>
          ) : (
            <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
              <Box sx={{ p: 3, borderBottom: '1px solid', borderColor: 'divider' }}>
                <Typography variant="body1" color="text.secondary" gutterBottom>
                  {selectedSequence?.description}
                </Typography>
                {selectedSequence?.goal && (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1 }}>
                    <Lightbulb sx={{ color: 'primary.main' }} />
                    <Typography variant="body2" color="primary.main">
                      <strong>Goal:</strong> {selectedSequence.goal}
                    </Typography>
                  </Box>
                )}
              </Box>
              <Box sx={{ flexGrow: 1, position: 'relative' }}>
                <FlowDiagram 
                  thoughts={sequenceDetails?.thoughts || []} 
                  width={800} 
                  height={500} 
                />
              </Box>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSelectedSequence(null)}>
            Close
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export default SequentialThinking;