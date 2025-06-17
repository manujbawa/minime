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
import {
  ReactFlow,
  Node,
  Edge,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  Position,
  MarkerType,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { miniMeAPI } from '../services/api';
import type { Project, ThinkingSequence, Thought } from '../types';

// Custom node types for different thought types
const thoughtTypeConfig = {
  analysis: { color: '#2196F3', icon: '🔍', label: 'Analysis' },
  hypothesis: { color: '#FF9800', icon: '💡', label: 'Hypothesis' },
  decision: { color: '#4CAF50', icon: '⚖️', label: 'Decision' },
  action: { color: '#F44336', icon: '⚡', label: 'Action' },
  reflection: { color: '#9C27B0', icon: '🤔', label: 'Reflection' },
  default: { color: '#757575', icon: '💭', label: 'Thought' }
};

export function SequentialThinking() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProject, setSelectedProject] = useState<string>('');
  const [sequences, setSequences] = useState<ThinkingSequence[]>([]);
  const [loading, setLoading] = useState(true);
  const [sequencesLoading, setSequencesLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedSequence, setSelectedSequence] = useState<ThinkingSequence | null>(null);
  const [sequenceDetails, setSequenceDetails] = useState<ThinkingSequence | null>(null);
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
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
      // In a real implementation, you'd fetch detailed thoughts here
      // For now, we'll use the sequence data we have
      setSequenceDetails(sequence);
      generateFlowDiagram(sequence);
    } catch (error) {
      console.error('Error loading sequence details:', error);
    } finally {
      setDetailsLoading(false);
    }
  };

  const generateFlowDiagram = (sequence: ThinkingSequence) => {
    if (!sequence.thoughts || sequence.thoughts.length === 0) {
      // Generate sample flow for demonstration
      const sampleNodes = generateSampleFlow(sequence);
      setNodes(sampleNodes.nodes);
      setEdges(sampleNodes.edges);
      return;
    }

    const newNodes: Node[] = [];
    const newEdges: Edge[] = [];
    const nodePositions = new Map<number, { x: number; y: number }>();

    // Sort thoughts by thought_number
    const sortedThoughts = [...sequence.thoughts].sort((a, b) => a.thought_number - b.thought_number);

    // Calculate positions
    sortedThoughts.forEach((thought, index) => {
      const row = Math.floor(index / 3);
      const col = index % 3;
      const x = col * 250;
      const y = row * 150;
      nodePositions.set(thought.id, { x, y });

      const thoughtConfig = thoughtTypeConfig[thought.thought_type || 'default'];
      
      newNodes.push({
        id: thought.id.toString(),
        type: 'default',
        position: { x, y },
        data: {
          label: (
            <Box sx={{ p: 1, textAlign: 'center', minWidth: 200 }}>
              <Typography variant="caption" sx={{ display: 'block', mb: 0.5 }}>
                {thoughtConfig.icon} {thoughtConfig.label}
              </Typography>
              <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5 }}>
                #{thought.thought_number}
              </Typography>
              <Typography variant="caption" sx={{ display: 'block', wordBreak: 'break-word' }}>
                {thought.content.length > 60 ? `${thought.content.substring(0, 60)}...` : thought.content}
              </Typography>
              {thought.confidence && (
                <LinearProgress
                  variant="determinate"
                  value={thought.confidence * 100}
                  sx={{ mt: 1, height: 4, borderRadius: 2 }}
                />
              )}
            </Box>
          )
        },
        style: {
          background: thoughtConfig.color,
          color: 'white',
          border: '2px solid #fff',
          borderRadius: '8px',
          width: 220,
        }
      });

      // Add edges for sequential flow
      if (index > 0 && !thought.branch_from_thought_id && !thought.is_revision) {
        const prevThought = sortedThoughts[index - 1];
        newEdges.push({
          id: `e${prevThought.id}-${thought.id}`,
          source: prevThought.id.toString(),
          target: thought.id.toString(),
          type: 'smoothstep',
          markerEnd: { type: MarkerType.ArrowClosed },
          style: { stroke: '#666' }
        });
      }

      // Add edges for branching
      if (thought.branch_from_thought_id) {
        newEdges.push({
          id: `branch-${thought.branch_from_thought_id}-${thought.id}`,
          source: thought.branch_from_thought_id.toString(),
          target: thought.id.toString(),
          type: 'smoothstep',
          markerEnd: { type: MarkerType.ArrowClosed },
          style: { stroke: '#FF9800', strokeWidth: 2 },
          label: 'Branch'
        });
      }

      // Add edges for revisions
      if (thought.revises_thought_id) {
        newEdges.push({
          id: `revision-${thought.revises_thought_id}-${thought.id}`,
          source: thought.revises_thought_id.toString(),
          target: thought.id.toString(),
          type: 'smoothstep',
          markerEnd: { type: MarkerType.ArrowClosed },
          style: { stroke: '#9C27B0', strokeWidth: 2, strokeDasharray: '5,5' },
          label: 'Revision'
        });
      }
    });

    setNodes(newNodes);
    setEdges(newEdges);
  };

  const generateSampleFlow = (sequence: ThinkingSequence) => {
    // Generate a sample flow diagram for demonstration
    const nodes: Node[] = [
      {
        id: '1',
        position: { x: 0, y: 0 },
        data: {
          label: (
            <Box sx={{ p: 1, textAlign: 'center' }}>
              <Typography variant="caption">🔍 Analysis</Typography>
              <Typography variant="body2" sx={{ fontWeight: 600 }}>Problem Identification</Typography>
              <Typography variant="caption">Understanding the core issue</Typography>
            </Box>
          )
        },
        style: { background: '#2196F3', color: 'white', borderRadius: '8px', width: 200 }
      },
      {
        id: '2',
        position: { x: 250, y: 0 },
        data: {
          label: (
            <Box sx={{ p: 1, textAlign: 'center' }}>
              <Typography variant="caption">💡 Hypothesis</Typography>
              <Typography variant="body2" sx={{ fontWeight: 600 }}>Initial Theory</Typography>
              <Typography variant="caption">Forming preliminary solution</Typography>
            </Box>
          )
        },
        style: { background: '#FF9800', color: 'white', borderRadius: '8px', width: 200 }
      },
      {
        id: '3',
        position: { x: 500, y: 0 },
        data: {
          label: (
            <Box sx={{ p: 1, textAlign: 'center' }}>
              <Typography variant="caption">⚖️ Decision</Typography>
              <Typography variant="body2" sx={{ fontWeight: 600 }}>Path Selection</Typography>
              <Typography variant="caption">Choosing best approach</Typography>
            </Box>
          )
        },
        style: { background: '#4CAF50', color: 'white', borderRadius: '8px', width: 200 }
      },
      {
        id: '4',
        position: { x: 250, y: 150 },
        data: {
          label: (
            <Box sx={{ p: 1, textAlign: 'center' }}>
              <Typography variant="caption">⚡ Action</Typography>
              <Typography variant="body2" sx={{ fontWeight: 600 }}>Implementation</Typography>
              <Typography variant="caption">Executing the plan</Typography>
            </Box>
          )
        },
        style: { background: '#F44336', color: 'white', borderRadius: '8px', width: 200 }
      },
      {
        id: '5',
        position: { x: 500, y: 150 },
        data: {
          label: (
            <Box sx={{ p: 1, textAlign: 'center' }}>
              <Typography variant="caption">🤔 Reflection</Typography>
              <Typography variant="body2" sx={{ fontWeight: 600 }}>Outcome Analysis</Typography>
              <Typography variant="caption">Evaluating results</Typography>
            </Box>
          )
        },
        style: { background: '#9C27B0', color: 'white', borderRadius: '8px', width: 200 }
      }
    ];

    const edges: Edge[] = [
      { id: 'e1-2', source: '1', target: '2', markerEnd: { type: MarkerType.ArrowClosed } },
      { id: 'e2-3', source: '2', target: '3', markerEnd: { type: MarkerType.ArrowClosed } },
      { id: 'e3-4', source: '3', target: '4', markerEnd: { type: MarkerType.ArrowClosed } },
      { id: 'e4-5', source: '4', target: '5', markerEnd: { type: MarkerType.ArrowClosed } }
    ];

    return { nodes, edges };
  };

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
              <strong>Tip:</strong> Use the "start_thinking_sequence" MCP tool in your IDE to begin structured reasoning
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
                <ReactFlow
                  nodes={nodes}
                  edges={edges}
                  onNodesChange={onNodesChange}
                  onEdgesChange={onEdgesChange}
                  fitView
                  fitViewOptions={{ padding: 0.2 }}
                >
                  <Controls />
                  <Background />
                </ReactFlow>
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