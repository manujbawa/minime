import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  Chip,
  Avatar,
  IconButton,
  Tabs,
  Tab,
  CircularProgress,
  Alert,
  Paper,
  Divider,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  ListItemSecondaryAction,
  LinearProgress,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Switch,
  FormControlLabel,
} from '@mui/material';
import { DataGrid, GridColDef, GridRenderCellParams } from '@mui/x-data-grid';
import {
  ArrowBack as ArrowBackIcon,
  FolderOpen as FolderOpenIcon,
  Description as DocumentIcon,
  Timeline as TimelineIcon,
  Assignment as TaskIcon,
  TrendingUp as ProgressIcon,
  Code as CodeIcon,
  Psychology as ThinkingIcon,
  Add as AddIcon,
  Edit as EditIcon,
  CheckCircle as CompletedIcon,
  RadioButtonUnchecked as PendingIcon,
  PlayArrow as InProgressIcon,
  Block as BlockedIcon,
  BugReport as BugIcon,
  Build as FeatureIcon,
  Speed as OptimizationIcon,
  School as DocumentationIcon,
  Memory as MemoryIcon,
  Create as CreateIcon,
  Update as UpdateIcon,
  FilterList as FilterIcon,
  Search as SearchIcon,
  AccessTime as ClockIcon,
} from '@mui/icons-material';
import {
  Timeline,
  TimelineItem,
  TimelineSeparator,
  TimelineConnector,
  TimelineContent,
  TimelineDot,
  TimelineOppositeContent,
} from '@mui/lab';
import { useNavigate, useParams } from 'react-router-dom';
import { miniMeAPI } from '../services/api';
import { MarkdownModal } from '../components/MarkdownModal';
import type { Project, ProjectBrief, ProgressEntry, TaskItem, Memory, ThinkingSequence, TimelineActivity, TimelineFilters } from '../types';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel({ children, value, index, ...other }: TabPanelProps) {
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`project-tabpanel-${index}`}
      aria-labelledby={`project-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ py: 3 }}>{children}</Box>}
    </div>
  );
}

const ProjectDetails = () => {
  const navigate = useNavigate();
  const { projectName } = useParams<{ projectName: string }>();
  
  const [project, setProject] = useState<Project | null>(null);
  const [briefs, setBriefs] = useState<ProjectBrief[]>([]);
  const [progress, setProgress] = useState<ProgressEntry[]>([]);
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [memories, setMemories] = useState<Memory[]>([]);
  const [thinking, setThinking] = useState<ThinkingSequence[]>([]);
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tabValue, setTabValue] = useState(0);
  
  // Dialog states
  const [showBriefDialog, setShowBriefDialog] = useState(false);
  const [showProgressDialog, setShowProgressDialog] = useState(false);
  const [showTaskDialog, setShowTaskDialog] = useState(false);
  
  // Modal states for detailed content viewing
  const [modalContent, setModalContent] = useState<{
    open: boolean;
    title: string;
    content: string;
    metadata?: any;
  }>({
    open: false,
    title: '',
    content: '',
    metadata: undefined
  });
  
  // Form states
  const [briefForm, setBriefForm] = useState({
    description: '',
    includeTasks: true,
    includeTechnical: true,
    sections: ['planning', 'technical', 'progress']
  });
  
  const [progressForm, setProgressForm] = useState({
    description: '',
    version: '',
    milestoneType: 'feature',
    completionPercentage: 0,
    blockers: '',
    nextSteps: '',
    tags: ''
  });
  
  const [taskForm, setTaskForm] = useState({
    title: '',
    description: '',
    category: 'feature',
    priority: {
      urgency: 'medium',
      impact: 'medium',
      effort: 'medium'
    },
    estimatedHours: 8,
    tags: ''
  });

  // Timeline states
  const [timelineActivities, setTimelineActivities] = useState<TimelineActivity[]>([]);
  const [timelineFilters, setTimelineFilters] = useState<TimelineFilters>({
    types: ['memory', 'progress', 'task', 'thinking', 'brief'],
    dateRange: {},
    searchQuery: ''
  });
  const [timelineView, setTimelineView] = useState<'all' | 'week' | 'month'>('all');

  useEffect(() => {
    if (projectName) {
      loadProjectData();
    }
  }, [projectName]);

  const loadProjectData = async () => {
    if (!projectName) return;
    
    try {
      setLoading(true);
      setError(null);
      
      const [
        projectOverview,
        briefsResponse,
        progressResponse,
        tasksResponse
      ] = await Promise.allSettled([
        miniMeAPI.getProjectOverview(projectName),
        miniMeAPI.getProjectBriefs(projectName),
        miniMeAPI.getProjectProgress(projectName),
        miniMeAPI.getProjectTasks(projectName)
      ]);

      if (projectOverview.status === 'fulfilled') {
        setProject(projectOverview.value.project);
        setMemories(projectOverview.value.recentMemories);
        setThinking(projectOverview.value.thinkingSequences);
      }
      
      if (briefsResponse.status === 'fulfilled') {
        setBriefs(briefsResponse.value.briefs);
      }
      
      if (progressResponse.status === 'fulfilled') {
        setProgress(progressResponse.value.progress);
      }
      
      if (tasksResponse.status === 'fulfilled') {
        setTasks(tasksResponse.value.tasks);
      }

    } catch (error) {
      setError('Failed to load project details');
      console.error('Error loading project:', error);
    } finally {
      setLoading(false);
    }
  };

  // Modal helper functions
  const openContentModal = (title: string, content: string, metadata?: any) => {
    setModalContent({
      open: true,
      title,
      content,
      metadata
    });
  };

  const closeContentModal = () => {
    setModalContent({
      open: false,
      title: '',
      content: '',
      metadata: undefined
    });
  };

  const handleThinkingSequenceClick = async (sequence: ThinkingSequence) => {
    try {
      // Fetch detailed sequence with all thoughts
      const response = await miniMeAPI.getThinkingSequence(sequence.id, {
        format: 'detailed',
        branches: true
      });
      
      const detailedSequence = response.sequence;
      
      // Format the sequence for display
      const formattedContent = formatThinkingSequenceForModal(detailedSequence);
      
      setModalContent({
        open: true,
        title: `Thinking Sequence: ${detailedSequence.sequence_name}`,
        content: formattedContent,
        metadata: {
          sequence_id: detailedSequence.id,
          project_id: detailedSequence.project_id,
          is_complete: detailedSequence.is_complete,
          goal: detailedSequence.goal,
          description: detailedSequence.description,
          created_at: detailedSequence.created_at,
          updated_at: detailedSequence.updated_at,
          thought_count: detailedSequence.thoughts?.length || 0
        }
      });
    } catch (error) {
      console.error('Error loading thinking sequence:', error);
      // Fallback to basic sequence info
      setModalContent({
        open: true,
        title: `Thinking Sequence: ${sequence.sequence_name}`,
        content: `**Goal:** ${sequence.goal || 'Not specified'}\n\n` +
        `**Description:** ${sequence.description || 'No description provided'}\n\n` +
        `**Status:** ${sequence.is_complete ? 'Complete' : 'Active'}\n\n` +
        `**Created:** ${formatDate(sequence.created_at)}\n\n` +
        `*Error loading detailed thoughts. Please try again.*`,
        metadata: sequence
      });
    }
  };

  const formatThinkingSequenceForModal = (sequence: ThinkingSequence): string => {
    let content = '';
    
    // Header information
    content += `# ${sequence.sequence_name}\n\n`;
    
    if (sequence.goal) {
      content += `**🎯 Goal:** ${sequence.goal}\n\n`;
    }
    
    if (sequence.description) {
      content += `**📝 Description:** ${sequence.description}\n\n`;
    }
    
    content += `**📊 Status:** ${sequence.is_complete ? '✅ Complete' : '🔄 Active'}\n\n`;
    content += `**📅 Created:** ${formatDate(sequence.created_at)}\n\n`;
    
    if (sequence.thoughts && sequence.thoughts.length > 0) {
      content += `**🧠 Total Thoughts:** ${sequence.thoughts.length}\n\n`;
      content += `---\n\n`;
      content += `## 💭 Reasoning Process\n\n`;
      
      // Sort thoughts by thought_number
      const sortedThoughts = [...sequence.thoughts].sort((a, b) => a.thought_number - b.thought_number);
      
      sortedThoughts.forEach((thought, index) => {
        const thoughtTypeEmoji = getThoughtTypeEmoji(thought.thought_type);
        const confidenceBar = getConfidenceBar(thought.confidence || 0);
        
        content += `### ${thoughtTypeEmoji} Thought ${thought.thought_number}\n\n`;
        
        if (thought.thought_type) {
          content += `**Type:** ${thought.thought_type.charAt(0).toUpperCase() + thought.thought_type.slice(1)}\n\n`;
        }
        
        if (thought.confidence !== undefined) {
          content += `**Confidence:** ${confidenceBar} ${Math.round((thought.confidence || 0) * 100)}%\n\n`;
        }
        
        content += `${thought.content}\n\n`;
        
        if (thought.is_revision) {
          content += `*🔄 This is a revision of an earlier thought*\n\n`;
        }
        
        if (thought.branch_from_thought_id) {
          content += `*🌿 This thought branches from thought #${thought.branch_from_thought_id}*\n\n`;
        }
        
        content += `---\n\n`;
      });
      
      // Summary section if complete
      if (sequence.is_complete) {
        const conclusions = sortedThoughts.filter(t => t.thought_type === 'decision');
        const decisions = sortedThoughts.filter(t => t.thought_type === 'action');
        
        if (conclusions.length > 0 || decisions.length > 0) {
          content += `## 🎯 Key Outcomes\n\n`;
          
          if (conclusions.length > 0) {
            content += `**Conclusions:**\n`;
            conclusions.forEach((thought, i) => {
              content += `${i + 1}. ${thought.content.substring(0, 200)}${thought.content.length > 200 ? '...' : ''}\n`;
            });
            content += `\n`;
          }
          
          if (decisions.length > 0) {
            content += `**Decisions:**\n`;
            decisions.forEach((thought, i) => {
              content += `${i + 1}. ${thought.content.substring(0, 200)}${thought.content.length > 200 ? '...' : ''}\n`;
            });
            content += `\n`;
          }
        }
      }
      
    } else {
      content += `*No thoughts recorded yet.*\n\n`;
    }
    
    return content;
  };

  const getThoughtTypeEmoji = (type?: string): string => {
    const emojiMap: Record<string, string> = {
      'reasoning': '🤔',
      'analysis': '🔍',
      'hypothesis': '💡',
      'decision': '⚡',
      'action': '🎯',
      'reflection': '🪞',
      'conclusion': '✅',
      'question': '❓',
      'observation': '👁️',
      'assumption': '💭'
    };
    return emojiMap[type || 'reasoning'] || '💭';
  };

  const getConfidenceBar = (confidence: number): string => {
    const level = Math.round(confidence * 5);
    const filled = '█'.repeat(level);
    const empty = '░'.repeat(5 - level);
    return filled + empty;
  };

  // Timeline helper functions
  const aggregateTimelineActivities = (): TimelineActivity[] => {
    const activities: TimelineActivity[] = [];

    // Add memories
    memories.forEach(memory => {
      activities.push({
        id: `memory-${memory.id}`,
        timestamp: memory.created_at,
        type: 'memory',
        title: `Memory: ${memory.memory_type}`,
        description: memory.content.substring(0, 150) + (memory.content.length > 150 ? '...' : ''),
        fullContent: memory.content,
        metadata: { 
          memory_type: memory.memory_type, 
          importance: memory.importance_score,
          created_at: memory.created_at,
          updated_at: memory.updated_at,
          tags: memory.tags
        },
        icon: <MemoryIcon />,
        color: 'primary',
        category: memory.memory_type
      });
    });

    // Add progress entries
    progress.forEach(entry => {
      activities.push({
        id: `progress-${entry.id}`,
        timestamp: entry.created_at,
        type: 'progress',
        title: `Progress: ${entry.version}`,
        description: entry.progress_description,
        metadata: { 
          version: entry.version, 
          milestone_type: entry.milestone_type,
          completion_percentage: entry.completion_percentage,
          blockers: entry.blockers,
          next_steps: entry.next_steps
        },
        icon: <ProgressIcon />,
        color: entry.milestone_type === 'release' ? 'success' : 
               entry.milestone_type === 'bugfix' ? 'error' : 'warning',
        category: entry.milestone_type
      });
    });

    // Add tasks
    tasks.forEach(task => {
      activities.push({
        id: `task-${task.id}`,
        timestamp: task.updated_at,
        type: 'task',
        title: `Task: ${task.title}`,
        description: task.description || 'No description',
        metadata: { 
          category: task.category, 
          status: task.status,
          priority: task.priority,
          estimated_hours: task.estimated_hours
        },
        icon: getCategoryIcon(task.category),
        color: task.status === 'completed' ? 'success' : 
               task.status === 'blocked' ? 'error' : 'info',
        status: task.status
      });
    });

    // Add thinking sequences
    thinking.forEach(sequence => {
      activities.push({
        id: `thinking-${sequence.id}`,
        timestamp: sequence.created_at,
        type: 'thinking',
        title: `Thinking: ${sequence.sequence_name}`,
        description: sequence.description || sequence.goal || 'Reasoning sequence',
        metadata: { 
          is_complete: sequence.is_complete,
          goal: sequence.goal,
          thought_count: sequence.thoughts?.length || 0
        },
        icon: <ThinkingIcon />,
        color: sequence.is_complete ? 'success' : 'primary'
      });
    });

    // Add briefs
    briefs.forEach(brief => {
      activities.push({
        id: `brief-${brief.id}`,
        timestamp: brief.created_at,
        type: 'brief',
        title: `Project Brief`,
        description: brief.content.substring(0, 150) + (brief.content.length > 150 ? '...' : ''),
        fullContent: brief.content,
        metadata: { 
          sections: brief.sections,
          auto_tasks_created: brief.auto_tasks_created,
          technical_analysis_included: brief.technical_analysis_included,
          created_at: brief.created_at,
          updated_at: brief.updated_at
        },
        icon: <DocumentIcon />,
        color: 'secondary'
      });
    });

    // Sort by timestamp (newest first)
    return activities.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  };

  const getFilteredActivities = (): TimelineActivity[] => {
    let filtered = aggregateTimelineActivities();

    // Filter by types
    if (timelineFilters.types.length > 0) {
      filtered = filtered.filter(activity => timelineFilters.types.includes(activity.type));
    }

    // Filter by search query
    if (timelineFilters.searchQuery) {
      const query = timelineFilters.searchQuery.toLowerCase();
      filtered = filtered.filter(activity => 
        activity.title.toLowerCase().includes(query) ||
        activity.description.toLowerCase().includes(query)
      );
    }

    // Filter by date range
    if (timelineView !== 'all') {
      const now = new Date();
      const cutoffDate = new Date();
      
      if (timelineView === 'week') {
        cutoffDate.setDate(now.getDate() - 7);
      } else if (timelineView === 'month') {
        cutoffDate.setMonth(now.getMonth() - 1);
      }
      
      filtered = filtered.filter(activity => 
        new Date(activity.timestamp) >= cutoffDate
      );
    }

    return filtered;
  };

  const getActivityTypeIcon = (type: string) => {
    switch (type) {
      case 'memory': return <MemoryIcon />;
      case 'progress': return <ProgressIcon />;
      case 'task': return <TaskIcon />;
      case 'thinking': return <ThinkingIcon />;
      case 'brief': return <DocumentIcon />;
      default: return <ClockIcon />;
    }
  };

  const getActivityColor = (activity: TimelineActivity): 'primary' | 'secondary' | 'success' | 'error' | 'warning' | 'info' => {
    return activity.color || 'primary';
  };

  const formatRelativeTime = (timestamp: string) => {
    const now = new Date();
    const activityTime = new Date(timestamp);
    const diffInHours = Math.abs(now.getTime() - activityTime.getTime()) / (1000 * 60 * 60);
    
    if (diffInHours < 1) {
      return 'Just now';
    } else if (diffInHours < 24) {
      return `${Math.floor(diffInHours)} hours ago`;
    } else if (diffInHours < 24 * 7) {
      return `${Math.floor(diffInHours / 24)} days ago`;
    } else {
      return formatDate(timestamp);
    }
  };

  // Update timeline activities when data changes
  React.useEffect(() => {
    setTimelineActivities(getFilteredActivities());
  }, [memories, progress, tasks, thinking, briefs, timelineFilters, timelineView]);

  const handleCreateBrief = async () => {
    if (!projectName) return;
    
    try {
      const result = await miniMeAPI.createProjectBrief(
        projectName,
        briefForm.description,
        {
          include_tasks: briefForm.includeTasks,
          include_technical_analysis: briefForm.includeTechnical,
          sections: briefForm.sections
        }
      );
      
      setBriefs(prev => [result.brief, ...prev]);
      setShowBriefDialog(false);
      setBriefForm({
        description: '',
        includeTasks: true,
        includeTechnical: true,
        sections: ['planning', 'technical', 'progress']
      });
    } catch (error) {
      console.error('Error creating brief:', error);
    }
  };

  const handleStoreProgress = async () => {
    if (!projectName) return;
    
    try {
      const result = await miniMeAPI.storeProgress(
        projectName,
        progressForm.description,
        {
          version: progressForm.version,
          milestone_type: progressForm.milestoneType,
          completion_percentage: progressForm.completionPercentage,
          blockers: progressForm.blockers.split(',').map(s => s.trim()).filter(Boolean),
          next_steps: progressForm.nextSteps.split(',').map(s => s.trim()).filter(Boolean),
          tags: progressForm.tags.split(',').map(s => s.trim()).filter(Boolean)
        }
      );
      
      setProgress(prev => [result.progress, ...prev]);
      setShowProgressDialog(false);
      setProgressForm({
        description: '',
        version: '',
        milestoneType: 'feature',
        completionPercentage: 0,
        blockers: '',
        nextSteps: '',
        tags: ''
      });
    } catch (error) {
      console.error('Error storing progress:', error);
    }
  };

  const handleCreateTask = async () => {
    if (!projectName) return;
    
    try {
      const result = await miniMeAPI.createTasks(projectName, [{
        title: taskForm.title,
        description: taskForm.description,
        category: taskForm.category as any,
        priority: taskForm.priority as any,
        estimated_hours: taskForm.estimatedHours,
        tags: taskForm.tags.split(',').map(s => s.trim()).filter(Boolean)
      }]);
      
      setTasks(prev => [...prev, ...result.tasks]);
      setShowTaskDialog(false);
      setTaskForm({
        title: '',
        description: '',
        category: 'feature',
        priority: {
          urgency: 'medium',
          impact: 'medium',
          effort: 'medium'
        },
        estimatedHours: 8,
        tags: ''
      });
    } catch (error) {
      console.error('Error creating task:', error);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed': return <CompletedIcon color="success" />;
      case 'in_progress': return <InProgressIcon color="primary" />;
      case 'blocked': return <BlockedIcon color="error" />;
      default: return <PendingIcon color="disabled" />;
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'bug': return <BugIcon color="error" />;
      case 'feature': return <FeatureIcon color="primary" />;
      case 'optimization': return <OptimizationIcon color="warning" />;
      case 'documentation': return <DocumentationIcon color="info" />;
      default: return <TaskIcon />;
    }
  };

  const getPriorityColor = (priority: any) => {
    if (priority.urgency === 'critical' || priority.impact === 'high') return 'error';
    if (priority.urgency === 'high' || priority.impact === 'medium') return 'warning';
    return 'default';
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

  const getProgressColumns = (): GridColDef[] => [
    {
      field: 'version',
      headerName: 'Version',
      width: 100,
      renderCell: (params: GridRenderCellParams) => (
        <Avatar sx={{ bgcolor: 'primary.main', width: 32, height: 32, fontSize: '0.8rem' }}>
          {params.value}
        </Avatar>
      ),
    },
    {
      field: 'description',
      headerName: 'Description',
      flex: 1,
      minWidth: 200,
      renderCell: (params: GridRenderCellParams) => (
        <Typography variant="body2" sx={{ fontWeight: 500 }}>
          {params.value}
        </Typography>
      ),
    },
    {
      field: 'milestoneType',
      headerName: 'Type',
      width: 120,
      renderCell: (params: GridRenderCellParams) => (
        <Chip
          label={params.value}
          size="small"
          color="primary"
          variant="outlined"
        />
      ),
    },
    {
      field: 'completionPercentage',
      headerName: 'Progress',
      width: 150,
      renderCell: (params: GridRenderCellParams) => (
        <Box sx={{ width: '100%' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <LinearProgress
              variant="determinate"
              value={params.value || 0}
              sx={{ flex: 1, height: 8, borderRadius: 4 }}
            />
            <Typography variant="caption" sx={{ minWidth: 35 }}>
              {params.value || 0}%
            </Typography>
          </Box>
        </Box>
      ),
    },
    {
      field: 'blockers',
      headerName: 'Blockers',
      width: 100,
      renderCell: (params: GridRenderCellParams) => {
        const blockers = params.value as string[];
        return blockers.length > 0 ? (
          <Chip
            label={blockers.length}
            size="small"
            color="error"
            variant="outlined"
          />
        ) : (
          <Typography variant="caption" color="text.disabled">
            None
          </Typography>
        );
      },
    },
    {
      field: 'nextSteps',
      headerName: 'Next Steps',
      width: 120,
      renderCell: (params: GridRenderCellParams) => {
        const steps = params.value as string[];
        return steps.length > 0 ? (
          <Chip
            label={steps.length}
            size="small"
            color="info"
            variant="outlined"
          />
        ) : (
          <Typography variant="caption" color="text.disabled">
            None
          </Typography>
        );
      },
    },
    {
      field: 'createdAt',
      headerName: 'Created',
      width: 150,
      renderCell: (params: GridRenderCellParams) => (
        <Typography variant="caption">
          {formatDate(params.value)}
        </Typography>
      ),
    },
  ];

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '50vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error || !project) {
    return (
      <Box sx={{ p: 4 }}>
        <Alert severity="error">
          {error || 'Project not found'}
        </Alert>
        <Button startIcon={<ArrowBackIcon />} onClick={() => navigate('/projects')} sx={{ mt: 2 }}>
          Back to Projects
        </Button>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 4 }}>
      {/* Header */}
      <Box sx={{ mb: 4 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
          <IconButton onClick={() => navigate('/projects')} sx={{ mr: 1 }}>
            <ArrowBackIcon />
          </IconButton>
          <Avatar sx={{ bgcolor: 'primary.main', mr: 2 }}>
            <FolderOpenIcon />
          </Avatar>
          <Box>
            <Typography variant="h3" component="h1" fontWeight="bold">
              {project.name}
            </Typography>
            <Typography variant="body1" color="text.secondary">
              {project.description}
            </Typography>
          </Box>
        </Box>

        {/* Quick Stats */}
        <Grid container spacing={2} sx={{ mb: 3 }}>
          <Grid size={{ xs: 6, sm: 3 }}>
            <Paper sx={{ p: 2, textAlign: 'center' }}>
              <Typography variant="h4" fontWeight="bold" color="primary">
                {memories.length}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Memories
              </Typography>
            </Paper>
          </Grid>
          <Grid size={{ xs: 6, sm: 3 }}>
            <Paper sx={{ p: 2, textAlign: 'center' }}>
              <Typography variant="h4" fontWeight="bold" color="success.main">
                {tasks.filter(t => t.status === 'completed').length}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Completed Tasks
              </Typography>
            </Paper>
          </Grid>
          <Grid size={{ xs: 6, sm: 3 }}>
            <Paper sx={{ p: 2, textAlign: 'center' }}>
              <Typography variant="h4" fontWeight="bold" color="warning.main">
                {progress.length}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Progress Entries
              </Typography>
            </Paper>
          </Grid>
          <Grid size={{ xs: 6, sm: 3 }}>
            <Paper sx={{ p: 2, textAlign: 'center' }}>
              <Typography variant="h4" fontWeight="bold" color="info.main">
                {thinking.length}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Thinking Sequences
              </Typography>
            </Paper>
          </Grid>
        </Grid>
      </Box>

      {/* Project Brief Section */}
      {briefs.length > 0 ? (
        <Box sx={{ mb: 4 }}>
          <Paper sx={{ p: 3 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
              <Typography variant="h5" fontWeight="bold">
                Project Brief
              </Typography>
              <Button
                variant="outlined"
                size="small"
                onClick={() => setTabValue(0)}
                endIcon={<DocumentIcon />}
              >
                View All Briefs
              </Button>
            </Box>
            
            {/* Display the most recent brief with markdown preview */}
            {(() => {
              const latestBrief = briefs[0]; // Assuming briefs are sorted by date
              return (
                <Box>
                  {/* Brief metadata */}
                  <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 2 }}>
                    {latestBrief.sections?.map((section) => (
                      <Chip key={section} label={section} size="small" variant="outlined" />
                    ))}
                    {latestBrief.auto_tasks_created && (
                      <Chip label="Tasks Created" size="small" color="success" variant="outlined" />
                    )}
                    {latestBrief.technical_analysis_included && (
                      <Chip label="Technical Analysis" size="small" color="primary" variant="outlined" />
                    )}
                  </Box>

                  {/* Brief content preview */}
                  <Paper 
                    sx={{ 
                      p: 3, 
                      backgroundColor: 'grey.50', 
                      border: 1, 
                      borderColor: 'grey.200',
                      maxHeight: '300px',
                      overflow: 'auto',
                      cursor: 'pointer',
                      '&:hover': {
                        borderColor: 'primary.main',
                        backgroundColor: 'primary.50'
                      }
                    }}
                    onClick={() => openContentModal(
                      'Project Brief',
                      latestBrief.content,
                      {
                        created_at: latestBrief.created_at,
                        updated_at: latestBrief.updated_at,
                        sections: latestBrief.sections,
                        auto_tasks_created: latestBrief.auto_tasks_created,
                        technical_analysis_included: latestBrief.technical_analysis_included
                      }
                    )}
                  >
                    <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: 'pre-wrap' }}>
                      {latestBrief.content.substring(0, 500)}{latestBrief.content.length > 500 ? '...' : ''}
                    </Typography>
                    <Box sx={{ mt: 2, textAlign: 'center' }}>
                      <Typography variant="caption" color="primary.main" sx={{ fontWeight: 500 }}>
                        Click to view full project brief
                      </Typography>
                    </Box>
                  </Paper>
                </Box>
              );
            })()}
            
            <Box sx={{ mt: 2, pt: 2, borderTop: 1, borderColor: 'divider' }}>
              <Typography variant="caption" color="text.secondary">
                Last updated: {briefs[0] ? new Date(briefs[0].created_at).toLocaleDateString() : 'N/A'}
              </Typography>
            </Box>
          </Paper>
        </Box>
      ) : (
        <Box sx={{ mb: 4 }}>
          <Paper sx={{ p: 3, textAlign: 'center' }}>
            <DocumentIcon sx={{ fontSize: 48, color: 'text.disabled', mb: 2 }} />
            <Typography variant="h5" fontWeight="bold" gutterBottom>
              No Project Brief Yet
            </Typography>
            <Typography color="text.secondary" sx={{ mb: 3 }}>
              Create comprehensive project documentation with AI assistance to get started.
            </Typography>
            <Button
              variant="contained"
              startIcon={<CreateIcon />}
              onClick={() => setShowBriefDialog(true)}
              size="large"
            >
              Create Project Brief
            </Button>
          </Paper>
        </Box>
      )}

      {/* Tabs */}
      <Box sx={{ width: '100%' }}>
        <Paper sx={{ mb: 0 }}>
          <Tabs
            value={tabValue}
            onChange={(_, newValue) => setTabValue(newValue)}
            variant="scrollable"
            scrollButtons="auto"
            sx={{ borderBottom: 1, borderColor: 'divider' }}
          >
            <Tab icon={<DocumentIcon />} label="Project Briefs" />
            <Tab icon={<ProgressIcon />} label="Progress Tracking" />
            <Tab icon={<TaskIcon />} label="Tasks" />
            <Tab icon={<CodeIcon />} label="Memories" />
            <Tab icon={<ThinkingIcon />} label="Thinking" />
            <Tab icon={<TimelineIcon />} label="Timeline" />
          </Tabs>
        </Paper>

        {/* Project Briefs Tab */}
        <TabPanel value={tabValue} index={0}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
            <Typography variant="h5" fontWeight="bold">
              Project Documentation
            </Typography>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => setShowBriefDialog(true)}
            >
              Create Brief
            </Button>
          </Box>

          {briefs.length === 0 ? (
            <Paper sx={{ p: 4, textAlign: 'center' }}>
              <DocumentIcon sx={{ fontSize: 48, color: 'text.disabled', mb: 2 }} />
              <Typography variant="h6" gutterBottom>
                No project briefs yet
              </Typography>
              <Typography color="text.secondary" sx={{ mb: 2 }}>
                Create comprehensive project documentation with AI assistance
              </Typography>
              <Button
                variant="contained"
                startIcon={<AddIcon />}
                onClick={() => setShowBriefDialog(true)}
              >
                Create First Brief
              </Button>
            </Paper>
          ) : (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {briefs.map((brief) => (
                <Paper 
                  key={brief.id} 
                  sx={{ 
                    p: 3, 
                    border: 1, 
                    borderColor: 'divider',
                    cursor: 'pointer',
                    '&:hover': {
                      borderColor: 'primary.main',
                      backgroundColor: 'primary.50'
                    }
                  }}
                  onClick={() => openContentModal(
                    `Project Brief #${brief.id}`,
                    brief.content,
                    {
                      created_at: brief.created_at,
                      updated_at: brief.updated_at,
                      sections: brief.sections,
                      auto_tasks_created: brief.auto_tasks_created,
                      technical_analysis_included: brief.technical_analysis_included
                    }
                  )}
                >
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                    <Typography variant="h6" fontWeight="bold">
                      Project Brief #{brief.id}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {formatDate(brief.created_at)}
                    </Typography>
                  </Box>
                  
                  <Box sx={{ mb: 2 }}>
                    {brief.sections.map((section) => (
                      <Chip key={section} label={section} size="small" sx={{ mr: 1, mb: 1 }} />
                    ))}
                  </Box>
                  
                  <Typography variant="body2" sx={{ mb: 2, whiteSpace: 'pre-wrap' }}>
                    {brief.content.substring(0, 300)}{brief.content.length > 300 ? '...' : ''}
                  </Typography>
                  
                  <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
                    <Chip
                      label={brief.auto_tasks_created ? 'Tasks Created' : 'No Tasks'}
                      size="small"
                      color={brief.auto_tasks_created ? 'success' : 'default'}
                    />
                    <Chip
                      label={brief.technical_analysis_included ? 'Tech Analysis' : 'Basic'}
                      size="small"
                      color={brief.technical_analysis_included ? 'primary' : 'default'}
                    />
                  </Box>
                  
                  <Typography variant="caption" color="primary.main" sx={{ fontWeight: 500, textAlign: 'center', display: 'block' }}>
                    Click to view full brief
                  </Typography>
                </Paper>
              ))}
            </Box>
          )}
        </TabPanel>

        {/* Progress Tracking Tab */}
        <TabPanel value={tabValue} index={1}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
            <Typography variant="h5" fontWeight="bold">
              Progress History
            </Typography>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => setShowProgressDialog(true)}
            >
              Add Progress
            </Button>
          </Box>

          {progress.length === 0 ? (
            <Paper sx={{ p: 4, textAlign: 'center' }}>
              <ProgressIcon sx={{ fontSize: 48, color: 'text.disabled', mb: 2 }} />
              <Typography variant="h6" gutterBottom>
                No progress entries yet
              </Typography>
              <Typography color="text.secondary" sx={{ mb: 2 }}>
                Track project milestones with automatic versioning
              </Typography>
              <Button
                variant="contained"
                startIcon={<AddIcon />}
                onClick={() => setShowProgressDialog(true)}
              >
                Add First Progress
              </Button>
            </Paper>
          ) : (
            <Paper sx={{ height: 600, width: '100%' }}>
              <DataGrid
                rows={progress.map((entry) => ({
                  id: entry.id,
                  version: entry.version,
                  description: entry.progress_description,
                  milestoneType: entry.milestone_type,
                  completionPercentage: entry.completion_percentage || 0,
                  blockers: entry.blockers || [],
                  nextSteps: entry.next_steps || [],
                  tags: entry.tags || [],
                  createdAt: entry.created_at,
                  updatedAt: entry.updated_at
                }))}
                columns={getProgressColumns()}
                initialState={{
                  pagination: {
                    paginationModel: { page: 0, pageSize: 10 },
                  },
                  sorting: {
                    sortModel: [{ field: 'createdAt', sort: 'desc' }],
                  },
                }}
                pageSizeOptions={[10, 25, 50]}
                disableRowSelectionOnClick
                sx={{
                  '& .MuiDataGrid-cell': {
                    borderColor: 'divider',
                  },
                  '& .MuiDataGrid-columnHeaders': {
                    backgroundColor: 'grey.50',
                    fontWeight: 'bold',
                  },
                  '& .MuiDataGrid-row:hover': {
                    backgroundColor: 'action.hover',
                  },
                }}
                onRowClick={(params) => {
                  const entry = params.row;
                  openContentModal(
                    `Progress v${entry.version}: ${entry.description}`,
                    `**Version:** ${entry.version}\n\n**Description:** ${entry.description}\n\n**Milestone Type:** ${entry.milestoneType}\n\n**Completion:** ${entry.completionPercentage}%\n\n${entry.blockers.length > 0 ? `**Blockers:**\n${entry.blockers.map((b: string) => `- ${b}`).join('\n')}\n\n` : ''}${entry.nextSteps.length > 0 ? `**Next Steps:**\n${entry.nextSteps.map((s: string) => `- ${s}`).join('\n')}\n\n` : ''}${entry.tags.length > 0 ? `**Tags:** ${entry.tags.join(', ')}\n\n` : ''}**Created:** ${formatDate(entry.createdAt)}${entry.updatedAt && entry.updatedAt !== entry.createdAt ? `\n**Updated:** ${formatDate(entry.updatedAt)}` : ''}`,
                    entry
                  );
                }}
              />
            </Paper>
          )}
        </TabPanel>

        {/* Tasks Tab */}
        <TabPanel value={tabValue} index={2}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
            <Typography variant="h5" fontWeight="bold">
              Task Management
            </Typography>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => setShowTaskDialog(true)}
            >
              Create Task
            </Button>
          </Box>

          <Grid container spacing={2}>
            {tasks.map((task) => (
              <Grid size={{ xs: 12, md: 6 }} key={task.id}>
                <Paper 
                  sx={{ 
                    p: 3, 
                    border: 1, 
                    borderColor: 'divider', 
                    height: '100%',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    '&:hover': {
                      borderColor: 'primary.main',
                      backgroundColor: 'primary.50',
                      transform: 'translateY(-2px)',
                      boxShadow: 2
                    }
                  }}
                  onClick={() => openContentModal(
                    `${task.category.toUpperCase()} Task: ${task.title}`,
                    `**Title:** ${task.title}\n\n**Description:** ${task.description}\n\n**Category:** ${task.category}\n\n**Status:** ${task.status}\n\n**Priority:** ${task.priority?.urgency || 'medium'} urgency, ${task.priority?.impact || 'medium'} impact\n\n${task.estimated_hours ? `**Estimated Hours:** ${task.estimated_hours}h\n\n` : ''}${task.tags && task.tags.length > 0 ? `**Tags:** ${task.tags.join(', ')}\n\n` : ''}**Created:** ${formatDate(task.created_at)}${task.updated_at && task.updated_at !== task.created_at ? `\n**Updated:** ${formatDate(task.updated_at)}` : ''}`,
                    {
                      task_id: task.id,
                      category: task.category,
                      status: task.status,
                      priority: task.priority,
                      estimated_hours: task.estimated_hours,
                      tags: task.tags,
                      created_at: task.created_at,
                      updated_at: task.updated_at
                    }
                  )}
                >
                  <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2, mb: 2 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexShrink: 0 }}>
                      {getStatusIcon(task.status)}
                      {getCategoryIcon(task.category)}
                    </Box>
                    <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                      <Typography 
                        variant="h6" 
                        fontWeight="bold" 
                        gutterBottom
                        sx={{
                          wordBreak: 'break-word',
                          display: '-webkit-box',
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: 'vertical',
                          overflow: 'hidden',
                          lineHeight: 1.2,
                          maxHeight: '2.4em'
                        }}
                      >
                        {task.title}
                      </Typography>
                      <Typography 
                        variant="body2" 
                        color="text.secondary" 
                        sx={{ 
                          mb: 1,
                          wordBreak: 'break-word',
                          display: '-webkit-box',
                          WebkitLineClamp: 3,
                          WebkitBoxOrient: 'vertical',
                          overflow: 'hidden',
                          lineHeight: 1.4,
                          maxHeight: '4.2em'
                        }}
                      >
                        {task.description}
                      </Typography>
                      <Box sx={{ display: 'flex', gap: 1, mb: 1 }}>
                        <Chip
                          label={task.category}
                          size="small"
                          color="primary"
                          variant="outlined"
                        />
                        <Chip
                          label={task.status}
                          size="small"
                          color={getPriorityColor(task.priority)}
                        />
                      </Box>
                      <Typography variant="caption" color="text.secondary">
                        Priority: {task.priority.urgency} urgency, {task.priority.impact} impact
                      </Typography>
                      {task.estimated_hours && (
                        <Typography variant="caption" color="text.secondary" sx={{ ml: 2 }}>
                          • Est: {task.estimated_hours}h
                        </Typography>
                      )}
                    </Box>
                  </Box>
                  <Typography variant="caption" color="primary.main" sx={{ fontWeight: 500, textAlign: 'center', display: 'block', mt: 1 }}>
                    Click to view full task details
                  </Typography>
                </Paper>
              </Grid>
            ))}
          </Grid>

          {tasks.length === 0 && (
            <Paper sx={{ p: 4, textAlign: 'center' }}>
              <TaskIcon sx={{ fontSize: 48, color: 'text.disabled', mb: 2 }} />
              <Typography variant="h6" gutterBottom>
                No tasks yet
              </Typography>
              <Typography color="text.secondary" sx={{ mb: 2 }}>
                Create and manage project tasks with intelligent prioritization
              </Typography>
              <Button
                variant="contained"
                startIcon={<AddIcon />}
                onClick={() => setShowTaskDialog(true)}
              >
                Create First Task
              </Button>
            </Paper>
          )}
        </TabPanel>

        {/* Memories Tab */}
        <TabPanel value={tabValue} index={3}>
          <Typography variant="h5" fontWeight="bold" gutterBottom>
            Recent Memories
          </Typography>
          
          <Grid container spacing={2}>
            {memories.map((memory) => (
              <Grid size={{ xs: 12, md: 6 }} key={memory.id}>
                <Paper 
                  sx={{ 
                    p: 3, 
                    border: 1, 
                    borderColor: 'divider', 
                    height: '100%',
                    cursor: 'pointer',
                    '&:hover': {
                      borderColor: 'primary.main',
                      backgroundColor: 'primary.50'
                    }
                  }}
                  onClick={() => openContentModal(
                    `${memory.memory_type.toUpperCase()} Memory`,
                    memory.content,
                    {
                      created_at: memory.created_at,
                      updated_at: memory.updated_at,
                      memory_type: memory.memory_type,
                      importance_score: memory.importance_score,
                      tags: memory.tags,

                    }
                  )}
                >
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
                    <Chip label={memory.memory_type} size="small" color="primary" />
                    <Typography variant="caption" color="text.secondary">
                      {formatDate(memory.created_at)}
                    </Typography>
                  </Box>
                  <Typography variant="body2" sx={{ mt: 1, mb: 2 }}>
                    {memory.content.substring(0, 200)}{memory.content.length > 200 ? '...' : ''}
                  </Typography>
                  <Box sx={{ mt: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                    <LinearProgress
                      variant="determinate"
                      value={memory.importance_score * 100}
                      sx={{ flexGrow: 1, mr: 1 }}
                    />
                    <Typography variant="caption" color="text.secondary">
                      {Math.round(memory.importance_score * 100)}% importance
                    </Typography>
                  </Box>
                  <Typography variant="caption" color="primary.main" sx={{ fontWeight: 500, textAlign: 'center', display: 'block' }}>
                    Click to view full memory
                  </Typography>
                </Paper>
              </Grid>
            ))}
          </Grid>
        </TabPanel>

        {/* Thinking Tab */}
        <TabPanel value={tabValue} index={4}>
          <Typography variant="h5" fontWeight="bold" gutterBottom>
            Thinking Sequences
          </Typography>
          
          <Grid container spacing={2}>
            {thinking.map((sequence) => (
              <Grid size={{ xs: 12, md: 6 }} key={sequence.id}>
                <Paper 
                  sx={{ 
                    p: 3, 
                    border: 1, 
                    borderColor: 'divider', 
                    height: '100%',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    '&:hover': {
                      borderColor: 'primary.main',
                      backgroundColor: 'primary.50',
                      transform: 'translateY(-2px)',
                      boxShadow: 2
                    }
                  }}
                  onClick={() => handleThinkingSequenceClick(sequence)}
                >
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
                    <Typography variant="h6" fontWeight="bold">
                      {sequence.sequence_name}
                    </Typography>
                    <Chip
                      label={sequence.is_complete ? 'Complete' : 'Active'}
                      size="small"
                      color={sequence.is_complete ? 'success' : 'primary'}
                    />
                  </Box>
                  {sequence.description && (
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                      {sequence.description}
                    </Typography>
                  )}
                  {sequence.goal && (
                    <Typography variant="body2" color="text.primary" sx={{ mb: 1, fontStyle: 'italic' }}>
                      Goal: {sequence.goal}
                    </Typography>
                  )}
                  <Typography variant="caption" color="text.secondary">
                    Created {formatDate(sequence.created_at)}
                  </Typography>
                  {sequence.thoughts && (
                    <Typography variant="caption" color="text.secondary" sx={{ ml: 2 }}>
                      • {sequence.thoughts.length} thoughts
                    </Typography>
                  )}
                  <Typography variant="caption" color="primary.main" sx={{ fontWeight: 500, textAlign: 'center', display: 'block', mt: 2 }}>
                    Click to view complete reasoning process
                  </Typography>
                </Paper>
              </Grid>
            ))}
          </Grid>

          {thinking.length === 0 && (
            <Paper sx={{ p: 4, textAlign: 'center' }}>
              <Typography variant="h6" gutterBottom>
                No thinking sequences yet
              </Typography>
              <Typography color="text.secondary" sx={{ mb: 2 }}>
                Create structured reasoning processes to track complex decisions and analysis
              </Typography>
            </Paper>
          )}
        </TabPanel>

        {/* Timeline Tab */}
        <TabPanel value={tabValue} index={5}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
            <Typography variant="h5" fontWeight="bold">
              Project Timeline
            </Typography>
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Button
                variant={timelineView === 'all' ? 'contained' : 'outlined'}
                size="small"
                onClick={() => setTimelineView('all')}
              >
                All Time
              </Button>
              <Button
                variant={timelineView === 'month' ? 'contained' : 'outlined'}
                size="small"
                onClick={() => setTimelineView('month')}
              >
                Month
              </Button>
              <Button
                variant={timelineView === 'week' ? 'contained' : 'outlined'}
                size="small"
                onClick={() => setTimelineView('week')}
              >
                Week
              </Button>
            </Box>
          </Box>

          {/* Timeline Filters */}
          <Paper sx={{ p: 2, mb: 3 }}>
            <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
              <TextField
                size="small"
                placeholder="Search activities..."
                value={timelineFilters.searchQuery}
                onChange={(e) => setTimelineFilters(prev => ({ ...prev, searchQuery: e.target.value }))}
                InputProps={{
                  startAdornment: <SearchIcon sx={{ mr: 1, color: 'text.disabled' }} />
                }}
                sx={{ minWidth: 200 }}
              />
              
              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                {['memory', 'progress', 'task', 'thinking', 'brief'].map((type) => (
                  <Chip
                    key={type}
                    label={type}
                    onClick={() => {
                      setTimelineFilters(prev => ({
                        ...prev,
                        types: prev.types.includes(type)
                          ? prev.types.filter(t => t !== type)
                          : [...prev.types, type]
                      }));
                    }}
                    color={timelineFilters.types.includes(type) ? 'primary' : 'default'}
                    variant={timelineFilters.types.includes(type) ? 'filled' : 'outlined'}
                    size="small"
                    icon={getActivityTypeIcon(type)}
                  />
                ))}
              </Box>
            </Box>
          </Paper>

          {/* Timeline Content */}
          {timelineActivities.length === 0 ? (
            <Paper sx={{ p: 4, textAlign: 'center' }}>
              <TimelineIcon sx={{ fontSize: 48, color: 'text.disabled', mb: 2 }} />
              <Typography variant="h6" gutterBottom>
                No timeline activities found
              </Typography>
              <Typography color="text.secondary">
                {timelineFilters.searchQuery || timelineFilters.types.length < 5 
                  ? 'Try adjusting your filters or search query'
                  : 'Project activities will appear here as you add memories, tasks, and progress'}
              </Typography>
            </Paper>
          ) : (
            <Timeline position="alternate">
              {timelineActivities.map((activity, index) => (
                <TimelineItem key={activity.id}>
                  <TimelineOppositeContent sx={{ m: 'auto 0' }} align="right" variant="body2" color="text.secondary">
                    <Typography variant="caption" fontWeight="bold">
                      {formatRelativeTime(activity.timestamp)}
                    </Typography>
                    <br />
                    <Typography variant="caption">
                      {formatDate(activity.timestamp)}
                    </Typography>
                  </TimelineOppositeContent>
                  
                  <TimelineSeparator>
                    <TimelineDot color={getActivityColor(activity)} sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {activity.icon || getActivityTypeIcon(activity.type)}
                    </TimelineDot>
                    {index < timelineActivities.length - 1 && <TimelineConnector />}
                  </TimelineSeparator>
                  
                  <TimelineContent sx={{ py: '12px', px: 2 }}>
                    <Paper 
                      sx={{ 
                        p: 2, 
                        border: 1, 
                        borderColor: 'divider',
                        cursor: activity.fullContent ? 'pointer' : 'default',
                        '&:hover': activity.fullContent ? {
                          borderColor: 'primary.main',
                          backgroundColor: 'primary.50'
                        } : {}
                      }}
                      onClick={() => {
                        if (activity.fullContent) {
                          openContentModal(
                            activity.title,
                            activity.fullContent,
                            activity.metadata
                          );
                        }
                      }}
                    >
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
                        <Typography variant="h6" component="span" fontWeight="bold">
                          {activity.title}
                        </Typography>
                        <Box sx={{ display: 'flex', gap: 0.5 }}>
                          <Chip label={activity.type} size="small" color={getActivityColor(activity)} variant="outlined" />
                          {activity.status && (
                            <Chip label={activity.status} size="small" color="default" />
                          )}
                          {activity.category && (
                            <Chip label={activity.category} size="small" color="default" variant="outlined" />
                          )}
                        </Box>
                      </Box>
                      
                      <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                        {activity.description}
                      </Typography>
                      
                      {/* Activity-specific metadata */}
                      {activity.type === 'progress' && activity.metadata?.completion_percentage && (
                        <Box sx={{ mt: 1, mb: 1 }}>
                          <Typography variant="caption" color="text.secondary" gutterBottom>
                            Completion Progress:
                          </Typography>
                          <LinearProgress
                            variant="determinate"
                            value={activity.metadata.completion_percentage}
                            sx={{ height: 6, borderRadius: 3 }}
                          />
                          <Typography variant="caption" color="text.secondary">
                            {activity.metadata.completion_percentage}%
                          </Typography>
                        </Box>
                      )}
                      
                      {activity.type === 'memory' && activity.metadata?.importance && (
                        <Box sx={{ mt: 1 }}>
                          <Typography variant="caption" color="text.secondary">
                            Importance: {Math.round(activity.metadata.importance * 100)}%
                          </Typography>
                          <LinearProgress
                            variant="determinate"
                            value={activity.metadata.importance * 100}
                            sx={{ height: 4, borderRadius: 2, mt: 0.5 }}
                          />
                        </Box>
                      )}
                      
                      {activity.type === 'task' && activity.metadata?.estimated_hours && (
                        <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                          Estimated: {activity.metadata.estimated_hours} hours
                        </Typography>
                      )}
                      
                      {activity.type === 'thinking' && activity.metadata?.thought_count && (
                        <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                          {activity.metadata.thought_count} thoughts • {activity.metadata.is_complete ? 'Complete' : 'Active'}
                        </Typography>
                      )}
                      
                      {activity.type === 'progress' && (activity.metadata?.blockers?.length > 0 || activity.metadata?.next_steps?.length > 0) && (
                        <Box sx={{ mt: 1 }}>
                          {activity.metadata?.blockers?.length > 0 && (
                            <Box sx={{ mb: 1 }}>
                              <Typography variant="caption" color="error.main" fontWeight="bold">
                                Blockers:
                              </Typography>
                              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 0.5 }}>
                                {activity.metadata?.blockers?.map((blocker: string, idx: number) => (
                                  <Chip key={idx} label={blocker} size="small" color="error" variant="outlined" />
                                ))}
                              </Box>
                            </Box>
                          )}
                          {activity.metadata?.next_steps?.length > 0 && (
                            <Box>
                              <Typography variant="caption" color="primary.main" fontWeight="bold">
                                Next Steps:
                              </Typography>
                              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 0.5 }}>
                                {activity.metadata?.next_steps?.slice(0, 3).map((step: string, idx: number) => (
                                  <Chip key={idx} label={step} size="small" color="primary" variant="outlined" />
                                ))}
                                {(activity.metadata?.next_steps?.length || 0) > 3 && (
                                  <Chip label={`+${(activity.metadata?.next_steps?.length || 0) - 3} more`} size="small" variant="outlined" />
                                )}
                              </Box>
                            </Box>
                          )}
                        </Box>
                      )}
                      
                      {/* Click indicator for items with full content */}
                      {activity.fullContent && (
                        <Typography variant="caption" color="primary.main" sx={{ fontWeight: 500, textAlign: 'center', display: 'block', mt: 1 }}>
                          Click to view full content
                        </Typography>
                      )}
                    </Paper>
                  </TimelineContent>
                </TimelineItem>
              ))}
            </Timeline>
          )}
        </TabPanel>
      </Box>

      {/* Create Brief Dialog */}
      <Dialog open={showBriefDialog} onClose={() => setShowBriefDialog(false)} maxWidth="md" fullWidth>
        <DialogTitle>Create Project Brief</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            multiline
            rows={4}
            label="Project Description"
            value={briefForm.description}
            onChange={(e) => setBriefForm(prev => ({ ...prev, description: e.target.value }))}
            sx={{ mb: 2, mt: 1 }}
          />
          <FormControlLabel
            control={
              <Switch
                checked={briefForm.includeTasks}
                onChange={(e) => setBriefForm(prev => ({ ...prev, includeTasks: e.target.checked }))}
              />
            }
            label="Auto-create tasks from brief"
            sx={{ mb: 1, display: 'block' }}
          />
          <FormControlLabel
            control={
              <Switch
                checked={briefForm.includeTechnical}
                onChange={(e) => setBriefForm(prev => ({ ...prev, includeTechnical: e.target.checked }))}
              />
            }
            label="Include technical analysis"
            sx={{ mb: 2, display: 'block' }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowBriefDialog(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleCreateBrief}>
            Create Brief
          </Button>
        </DialogActions>
      </Dialog>

      {/* Store Progress Dialog */}
      <Dialog open={showProgressDialog} onClose={() => setShowProgressDialog(false)} maxWidth="md" fullWidth>
        <DialogTitle>Record Progress</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            multiline
            rows={3}
            label="Progress Description"
            value={progressForm.description}
            onChange={(e) => setProgressForm(prev => ({ ...prev, description: e.target.value }))}
            sx={{ mb: 2, mt: 1 }}
          />
          <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
            <TextField
              label="Version"
              value={progressForm.version}
              onChange={(e) => setProgressForm(prev => ({ ...prev, version: e.target.value }))}
              placeholder="1.0.0"
            />
            <FormControl sx={{ minWidth: 150 }}>
              <InputLabel>Milestone Type</InputLabel>
              <Select
                value={progressForm.milestoneType}
                onChange={(e) => setProgressForm(prev => ({ ...prev, milestoneType: e.target.value }))}
                label="Milestone Type"
              >
                <MenuItem value="feature">Feature</MenuItem>
                <MenuItem value="bugfix">Bug Fix</MenuItem>
                <MenuItem value="deployment">Deployment</MenuItem>
                <MenuItem value="testing">Testing</MenuItem>
                <MenuItem value="documentation">Documentation</MenuItem>
                <MenuItem value="release">Release</MenuItem>
              </Select>
            </FormControl>
            <TextField
              label="Completion %"
              type="number"
              value={progressForm.completionPercentage}
              onChange={(e) => setProgressForm(prev => ({ ...prev, completionPercentage: Number(e.target.value) }))}
              inputProps={{ min: 0, max: 100 }}
            />
          </Box>
          <TextField
            fullWidth
            label="Blockers (comma-separated)"
            value={progressForm.blockers}
            onChange={(e) => setProgressForm(prev => ({ ...prev, blockers: e.target.value }))}
            sx={{ mb: 2 }}
          />
          <TextField
            fullWidth
            label="Next Steps (comma-separated)"
            value={progressForm.nextSteps}
            onChange={(e) => setProgressForm(prev => ({ ...prev, nextSteps: e.target.value }))}
            sx={{ mb: 2 }}
          />
          <TextField
            fullWidth
            label="Tags (comma-separated)"
            value={progressForm.tags}
            onChange={(e) => setProgressForm(prev => ({ ...prev, tags: e.target.value }))}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowProgressDialog(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleStoreProgress}>
            Store Progress
          </Button>
        </DialogActions>
      </Dialog>

      {/* Create Task Dialog */}
      <Dialog open={showTaskDialog} onClose={() => setShowTaskDialog(false)} maxWidth="md" fullWidth>
        <DialogTitle>Create Task</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            label="Task Title"
            value={taskForm.title}
            onChange={(e) => setTaskForm(prev => ({ ...prev, title: e.target.value }))}
            sx={{ mb: 2, mt: 1 }}
          />
          <TextField
            fullWidth
            multiline
            rows={3}
            label="Description"
            value={taskForm.description}
            onChange={(e) => setTaskForm(prev => ({ ...prev, description: e.target.value }))}
            sx={{ mb: 2 }}
          />
          <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
            <FormControl sx={{ minWidth: 120 }}>
              <InputLabel>Category</InputLabel>
              <Select
                value={taskForm.category}
                onChange={(e) => setTaskForm(prev => ({ ...prev, category: e.target.value }))}
                label="Category"
              >
                <MenuItem value="feature">Feature</MenuItem>
                <MenuItem value="bug">Bug</MenuItem>
                <MenuItem value="optimization">Optimization</MenuItem>
                <MenuItem value="documentation">Documentation</MenuItem>
                <MenuItem value="testing">Testing</MenuItem>
              </Select>
            </FormControl>
            <TextField
              label="Estimated Hours"
              type="number"
              value={taskForm.estimatedHours}
              onChange={(e) => setTaskForm(prev => ({ ...prev, estimatedHours: Number(e.target.value) }))}
              inputProps={{ min: 1, max: 100 }}
            />
          </Box>
          <TextField
            fullWidth
            label="Tags (comma-separated)"
            value={taskForm.tags}
            onChange={(e) => setTaskForm(prev => ({ ...prev, tags: e.target.value }))}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowTaskDialog(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleCreateTask}>
            Create Task
          </Button>
        </DialogActions>
      </Dialog>

      {/* Markdown Modal for detailed content viewing */}
      <MarkdownModal
        open={modalContent.open}
        onClose={closeContentModal}
        title={modalContent.title}
        content={modalContent.content}
        metadata={modalContent.metadata}
      />
    </Box>
  );
}

export default ProjectDetails;