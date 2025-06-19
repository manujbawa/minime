import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Grid,
  Chip,
  Alert,
  CircularProgress,
  Paper,
  Divider,
  Stack,
  IconButton,
  Tooltip,
  Button,
  Tab,
  Tabs,
  LinearProgress,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Badge,
} from '@mui/material';
import {
  Refresh,
  Psychology,
  TrendingUp,
  Code,
  Security,
  Speed,
  BugReport,
  Architecture,
  School,
  Lightbulb,
  Timeline,
  Assessment,
} from '@mui/icons-material';
import { miniMeAPI } from '../services/api';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`meta-learning-tabpanel-${index}`}
      aria-labelledby={`meta-learning-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ py: 3 }}>{children}</Box>}
    </div>
  );
}

interface LearningInsight {
  id: string;
  type: string;
  category: string;
  title: string;
  description: string;
  confidence: number;
  actionable: boolean;
  created_at: string;
  metadata?: Record<string, any>;
}

interface CodingPattern {
  id: string;
  pattern_category: string;
  pattern_type: string;
  pattern_name: string;
  pattern_signature: string;
  description: string;
  frequency_count: number;
  confidence_score: number;
  success_rate: number;
  created_at: string;
  examples?: string[];
}

interface LearningStatus {
  queue_size: number;
  total_patterns: number;
  total_insights: number;
  last_processing: string;
  processing_rate: number;
  system_health: string;
  detailed?: DetailedLearningStatus;
}

interface DetailedLearningStatus {
  status: string;
  realTimeEnabled: boolean;
  scheduledEnabled: boolean;
  memoryBufferSize: number;
  queue: Array<{ status: string; count: number }>;
  patterns: {
    total_patterns: number;
    avg_confidence: number;
    unique_projects: number;
  };
  insights: Array<{ insight_type: string; count: number }>;
  lastProcessed: Record<string, string>;
  scheduling: Record<string, {
    lastRun: string;
    nextScheduled: string;
    intervalMs: number;
    intervalHuman: string;
    pendingTasks: number;
    isOverdue: boolean;
    timeUntilNext?: number;
    timeUntilNextHuman?: string;
  }>;
  memoryCoverage: {
    totalMemories: number;
    memoriesWithPatterns: number;
    memoriesProcessed: number;
    recentMemories: number;
    patternCoveragePercent: number;
    processingCoveragePercent: number;
    memoryTypeBreakdown: Array<{ memory_type: string; count: number }>;
    unprocessedMemories: number;
  };
  processingProgress: {
    queueMetrics: Record<string, { count: number; avgDurationSeconds: number }>;
    taskPerformance: Array<{
      taskType: string;
      totalTasks: number;
      completedTasks: number;
      failedTasks: number;
      successRate: number;
      avgDurationMs: number;
    }>;
    recentActivity: number;
    errorRate: number;
    systemHealth: string;
  };
  currentTime?: string;
}

function MetaLearning() {
  const [tabValue, setTabValue] = useState(0);
  const [insights, setInsights] = useState<LearningInsight[]>([]);
  const [patterns, setPatterns] = useState<CodingPattern[]>([]);
  const [status, setStatus] = useState<LearningStatus | null>(null);
  const [monitoringData, setMonitoringData] = useState<DetailedLearningStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchLearningData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Fetch comprehensive monitoring data
      const monitoringResponse = await fetch('/api/learning/monitoring');
      if (monitoringResponse.ok) {
        const monitoring = await monitoringResponse.json();
        
        // Ensure all required fields have defaults
        const normalizedMonitoring = {
          ...monitoring,
          memoryCoverage: {
            totalMemories: 0,
            memoriesWithPatterns: 0,
            memoriesProcessed: 0,
            recentMemories: 0,
            patternCoveragePercent: 0,
            processingCoveragePercent: 0,
            memoryTypeBreakdown: [],
            unprocessedMemories: 0,
            ...monitoring.memoryCoverage
          },
          processingProgress: {
            queueMetrics: {},
            taskPerformance: [],
            recentActivity: 0,
            errorRate: 0,
            systemHealth: 'healthy',
            ...monitoring.processingProgress
          },
          queue: monitoring.queue || [],
          scheduling: monitoring.scheduling || {},
          patterns: monitoring.patterns || { total_patterns: 0, avg_confidence: 0, unique_projects: 0 },
          insights: monitoring.insights || []
        };
        
        setMonitoringData(normalizedMonitoring);
        
        // Extract basic status for compatibility
        const basicStatus: LearningStatus = {
          queue_size: normalizedMonitoring.queue?.find((q: any) => q.status === 'pending')?.count || 0,
          total_patterns: normalizedMonitoring.patterns?.total_patterns || 0,
          total_insights: normalizedMonitoring.insights?.reduce((sum: number, insight: any) => sum + parseInt(insight.count), 0) || 0,
          last_processing: normalizedMonitoring.scheduling?.learning_queue_processing?.lastRun || new Date().toISOString(),
          processing_rate: normalizedMonitoring.processingProgress?.errorRate ? 
            (100 - normalizedMonitoring.processingProgress.errorRate) / 100 : 1.0,
          system_health: normalizedMonitoring.processingProgress?.systemHealth || 'healthy',
          detailed: normalizedMonitoring
        };
        setStatus(basicStatus);
      } else {
        throw new Error(`Failed to fetch monitoring data: ${monitoringResponse.status}`);
      }
      
      // Fetch insights and patterns independently for better resilience
      console.log('Fetching insights and patterns...');
      
      // Fetch insights
      try {
        const insightsResponse = await miniMeAPI.getLearningInsights({ limit: 20 });
        console.log('Insights response:', insightsResponse);
        setInsights(insightsResponse.insights || []);
      } catch (insightsError) {
        console.error('Failed to fetch insights:', insightsError);
        setInsights([]);
      }

      // Fetch patterns independently 
      try {
        const patternsResponse = await miniMeAPI.getCodingPatterns({ limit: 20 });
        console.log('Patterns response:', patternsResponse);
        console.log('Patterns count:', patternsResponse.patterns?.length || 0);
        setPatterns(patternsResponse.patterns || []);
        console.log('Set patterns state:', patternsResponse.patterns || []);
      } catch (patternsError) {
        console.error('Failed to fetch patterns:', patternsError);
        setPatterns([]);
      }
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch learning data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLearningData();
  }, []);

  useEffect(() => {
    console.log('Patterns state updated:', patterns.length, patterns);
  }, [patterns]);

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'architectural': return <Architecture />;
      case 'error_handling': return <BugReport />;
      case 'performance': return <Speed />;
      case 'security': return <Security />;
      case 'code_quality': return <Code />;
      case 'testing': return <Assessment />;
      case 'architecture': return <Architecture />;
      default: return <Code />;
    }
  };

  const getCategoryColor = (category: string): 'primary' | 'secondary' | 'success' | 'warning' | 'info' | 'error' => {
    switch (category) {
      case 'architectural': return 'primary';
      case 'error_handling': return 'error';
      case 'performance': return 'warning';
      case 'security': return 'error';
      case 'code_quality': return 'success';
      case 'testing': return 'info';
      case 'architecture': return 'primary';
      default: return 'secondary';
    }
  };

  if (loading) {
    return (
      <Box sx={{ p: 3, display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 400 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert 
          severity="error" 
          action={
            <Button color="inherit" size="small" onClick={fetchLearningData}>
              Retry
            </Button>
          }
        >
          {error}
        </Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box sx={{ mb: 4 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'between', mb: 2 }}>
          <Typography variant="h4" component="h1" fontWeight="bold">
            Meta-Learning Insights
          </Typography>
          <Tooltip title="Refresh insights">
            <IconButton onClick={fetchLearningData} color="primary">
              <Refresh />
            </IconButton>
          </Tooltip>
        </Box>
        <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
          AI-discovered patterns and insights from your development history across all projects.
        </Typography>
      </Box>

      {/* Status Overview */}
      {status && (
        <Paper sx={{ p: 3, mb: 4 }}>
          <Typography variant="h6" gutterBottom>
            <Psychology sx={{ mr: 1, verticalAlign: 'middle' }} />
            Learning System Status
          </Typography>
          
          <Grid container spacing={3}>
            <Grid item xs={12} sm={6} md={3}>
              <Box textAlign="center">
                <Typography variant="h3" color="primary.main" fontWeight="bold">
                  {status.total_patterns}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Patterns Detected
                </Typography>
              </Box>
            </Grid>
            
            <Grid item xs={12} sm={6} md={3}>
              <Box textAlign="center">
                <Typography variant="h3" color="success.main" fontWeight="bold">
                  {status.total_insights}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Insights Generated
                </Typography>
              </Box>
            </Grid>
            
            <Grid item xs={12} sm={6} md={3}>
              <Box textAlign="center">
                <Typography variant="h3" color="warning.main" fontWeight="bold">
                  {status.queue_size}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Processing Queue
                </Typography>
              </Box>
            </Grid>
            
            <Grid item xs={12} sm={6} md={3}>
              <Box textAlign="center">
                <Typography variant="h3" color="info.main" fontWeight="bold">
                  {Math.round(status.processing_rate * 100)}%
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  System Health
                </Typography>
                <LinearProgress 
                  variant="determinate" 
                  value={status.processing_rate * 100} 
                  sx={{ mt: 1 }}
                />
              </Box>
            </Grid>
          </Grid>
        </Paper>
      )}

      {/* Tabs */}
      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
        <Tabs value={tabValue} onChange={handleTabChange}>
          <Tab 
            label={
              <Badge badgeContent={insights.length} color="primary">
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                  <Lightbulb sx={{ mr: 1 }} />
                  Insights
                </Box>
              </Badge>
            } 
          />
          <Tab 
            label={
              <Badge badgeContent={patterns.length} color="secondary">
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                  <Timeline sx={{ mr: 1 }} />
                  Patterns
                </Box>
              </Badge>
            } 
          />
          <Tab 
            label={
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <Assessment sx={{ mr: 1 }} />
                Monitoring
              </Box>
            } 
          />
        </Tabs>
      </Box>

      {/* Insights Tab */}
      <TabPanel value={tabValue} index={0}>
        <Grid container spacing={3}>
          {insights.map((insight) => (
            <Grid item xs={12} md={6} key={insight.id}>
              <Card sx={{ height: '100%' }}>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'between', mb: 2 }}>
                    <Box sx={{ flex: 1 }}>
                      <Typography variant="h6" gutterBottom>
                        {insight.title}
                      </Typography>
                      <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
                        <Chip 
                          label={insight.category} 
                          size="small" 
                          color={getCategoryColor(insight.category)}
                        />
                        <Chip 
                          label={`${Math.round(insight.confidence * 100)}% confidence`} 
                          size="small" 
                          variant="outlined"
                        />
                        {insight.actionable && (
                          <Chip label="Actionable" size="small" color="success" />
                        )}
                      </Box>
                    </Box>
                  </Box>
                  
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    {insight.description}
                  </Typography>
                  
                  {insight.metadata && (
                    <Box sx={{ mt: 2, p: 2, backgroundColor: 'grey.50', borderRadius: 1 }}>
                      <Typography variant="caption" color="text.secondary" display="block">
                        Additional Data:
                      </Typography>
                      {Object.entries(insight.metadata).map(([key, value]) => (
                        <Typography key={key} variant="caption" display="block">
                          {key}: {typeof value === 'number' && value < 1 ? `${Math.round(value * 100)}%` : String(value)}
                        </Typography>
                      ))}
                    </Box>
                  )}
                  
                  <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 2 }}>
                    Generated {new Date(insight.created_at).toLocaleDateString()}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
        
        {insights.length === 0 && (
          <Alert severity="info">
            <Typography variant="subtitle2" gutterBottom>
              No learning insights yet
            </Typography>
            <Typography variant="body2">
              The meta-learning system will automatically generate insights as you:
            </Typography>
            <Typography variant="body2" component="ul" sx={{ mt: 1, pl: 2 }}>
              <li>Store code memories with patterns</li>
              <li>Complete thinking sequences</li>
              <li>Work across multiple projects</li>
              <li>Build up a knowledge base over time</li>
            </Typography>
          </Alert>
        )}
      </TabPanel>

      {/* Patterns Tab */}
      <TabPanel value={tabValue} index={1}>
        <Grid container spacing={3}>
          {patterns.map((pattern) => (
            <Grid item xs={12} lg={6} key={pattern.id}>
              <Card sx={{ height: '100%' }}>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                    {getCategoryIcon(pattern.pattern_category)}
                    <Typography variant="h6" sx={{ ml: 1, flex: 1 }}>
                      {pattern.pattern_name}
                    </Typography>
                    <Chip 
                      label={pattern.pattern_category} 
                      size="small" 
                      color={getCategoryColor(pattern.pattern_category)}
                    />
                  </Box>
                  
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    {pattern.description}
                  </Typography>
                  
                  <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
                    <Box textAlign="center">
                      <Typography variant="h6" color="primary.main">
                        {pattern.frequency_count}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        Uses
                      </Typography>
                    </Box>
                    <Box textAlign="center">
                      <Typography variant="h6" color="success.main">
                        {Math.round(pattern.success_rate * 100)}%
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        Success Rate
                      </Typography>
                    </Box>
                    <Box textAlign="center">
                      <Typography variant="h6" color="info.main">
                        {Math.round(pattern.confidence_score * 100)}%
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        Confidence
                      </Typography>
                    </Box>
                  </Box>
                  
                  {pattern.examples && pattern.examples.length > 0 && (
                    <Box sx={{ mt: 2 }}>
                      <Typography variant="subtitle2" gutterBottom>
                        Examples:
                      </Typography>
                      <List dense>
                        {pattern.examples.slice(0, 3).map((example, index) => (
                          <ListItem key={index} sx={{ py: 0 }}>
                            <ListItemText 
                              primary={example} 
                              primaryTypographyProps={{ 
                                variant: 'body2', 
                                fontFamily: 'monospace',
                                color: 'text.secondary'
                              }}
                            />
                          </ListItem>
                        ))}
                      </List>
                    </Box>
                  )}
                  
                  <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 2 }}>
                    Pattern detected {new Date(pattern.created_at).toLocaleDateString()}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
        
        {patterns.length === 0 && (
          <Alert severity="info">
            <Typography variant="subtitle2" gutterBottom>
              No coding patterns detected yet
            </Typography>
            <Typography variant="body2">
              The pattern detection system will automatically identify patterns as you:
            </Typography>
            <Typography variant="body2" component="ul" sx={{ mt: 1, pl: 2 }}>
              <li>Store code-related memories</li>
              <li>Use consistent coding approaches</li>
              <li>Repeat similar solutions across projects</li>
              <li>Document architectural decisions</li>
            </Typography>
          </Alert>
        )}
      </TabPanel>

      {/* Monitoring Tab */}
      <TabPanel value={tabValue} index={2}>
        {monitoringData ? (
          <Grid container spacing={3}>
            {/* Scheduling Information */}
            <Grid item xs={12}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center' }}>
                    <Timeline sx={{ mr: 1 }} />
                    Learning Pipeline Schedule
                  </Typography>
                  <Grid container spacing={2}>
                    {Object.entries(monitoringData.scheduling).map(([taskType, schedule]) => (
                      <Grid item xs={12} sm={6} md={4} key={taskType}>
                        <Paper sx={{ p: 2, backgroundColor: schedule.isOverdue ? 'error.light' : 'background.paper' }}>
                          <Typography variant="subtitle2" gutterBottom>
                            {taskType.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                          </Typography>
                          <Stack spacing={1}>
                            <Typography variant="body2">
                              <strong>Interval:</strong> {schedule.intervalHuman}
                            </Typography>
                            <Typography variant="body2">
                              <strong>Last Run:</strong> {schedule.lastRun ? 
                                new Date(schedule.lastRun).toLocaleString() : 'Never'}
                            </Typography>
                            <Typography variant="body2">
                              <strong>Next Run:</strong> {schedule.timeUntilNextHuman || 'Calculating...'}
                              {schedule.isOverdue && (
                                <Chip label="OVERDUE" size="small" color="error" sx={{ ml: 1 }} />
                              )}
                            </Typography>
                            {schedule.pendingTasks > 0 && (
                              <Typography variant="body2">
                                <strong>Pending Tasks:</strong> {schedule.pendingTasks}
                              </Typography>
                            )}
                          </Stack>
                        </Paper>
                      </Grid>
                    ))}
                  </Grid>
                </CardContent>
              </Card>
            </Grid>

            {/* Memory Coverage Statistics */}
            <Grid item xs={12} md={6}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center' }}>
                    <Psychology sx={{ mr: 1 }} />
                    Memory Coverage
                  </Typography>
                  <Grid container spacing={2}>
                    <Grid item xs={6}>
                      <Box textAlign="center">
                        <Typography variant="h4" color="primary.main">
                          {monitoringData.memoryCoverage.totalMemories}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          Total Memories
                        </Typography>
                      </Box>
                    </Grid>
                    <Grid item xs={6}>
                      <Box textAlign="center">
                        <Typography variant="h4" color="success.main">
                          {monitoringData.memoryCoverage.memoriesWithPatterns}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          With Patterns
                        </Typography>
                      </Box>
                    </Grid>
                    <Grid item xs={12}>
                      <Typography variant="body2" gutterBottom>
                        Pattern Coverage: {monitoringData.memoryCoverage.patternCoveragePercent}%
                      </Typography>
                      <LinearProgress 
                        variant="determinate" 
                        value={monitoringData.memoryCoverage.patternCoveragePercent} 
                        sx={{ mb: 2 }}
                      />
                      <Typography variant="body2" gutterBottom>
                        Processing Coverage: {monitoringData.memoryCoverage.processingCoveragePercent}%
                      </Typography>
                      <LinearProgress 
                        variant="determinate" 
                        value={monitoringData.memoryCoverage.processingCoveragePercent} 
                      />
                    </Grid>
                    <Grid item xs={12}>
                      <Typography variant="body2" sx={{ mt: 2 }}>
                        <strong>Recent Activity:</strong> {monitoringData.memoryCoverage.recentMemories} memories in last 24h
                      </Typography>
                      <Typography variant="body2">
                        <strong>Unprocessed:</strong> {monitoringData.memoryCoverage.unprocessedMemories} memories
                      </Typography>
                    </Grid>
                  </Grid>
                </CardContent>
              </Card>
            </Grid>

            {/* Processing Progress */}
            <Grid item xs={12} md={6}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center' }}>
                    <Speed sx={{ mr: 1 }} />
                    Processing Progress
                  </Typography>
                  <Grid container spacing={2}>
                    <Grid item xs={6}>
                      <Box textAlign="center">
                        <Typography variant="h4" color={
                          monitoringData.processingProgress.systemHealth === 'healthy' ? 'success.main' :
                          monitoringData.processingProgress.systemHealth === 'degraded' ? 'warning.main' : 'error.main'
                        }>
                          {monitoringData.processingProgress.errorRate}%
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          Error Rate
                        </Typography>
                      </Box>
                    </Grid>
                    <Grid item xs={6}>
                      <Box textAlign="center">
                        <Typography variant="h4" color="info.main">
                          {monitoringData.processingProgress.recentActivity}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          Recent Tasks
                        </Typography>
                      </Box>
                    </Grid>
                    <Grid item xs={12}>
                      <Chip 
                        label={`System Health: ${monitoringData.processingProgress.systemHealth.toUpperCase()}`}
                        color={
                          monitoringData.processingProgress.systemHealth === 'healthy' ? 'success' :
                          monitoringData.processingProgress.systemHealth === 'degraded' ? 'warning' : 'error'
                        }
                        sx={{ mb: 2 }}
                      />
                    </Grid>
                  </Grid>
                </CardContent>
              </Card>
            </Grid>

            {/* Task Performance */}
            <Grid item xs={12}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center' }}>
                    <Assessment sx={{ mr: 1 }} />
                    Task Performance (Last 7 Days)
                  </Typography>
                  <Grid container spacing={2}>
                    {monitoringData.processingProgress.taskPerformance.map((task) => (
                      <Grid item xs={12} sm={6} md={3} key={task.taskType}>
                        <Paper sx={{ p: 2 }}>
                          <Typography variant="subtitle2" gutterBottom>
                            {task.taskType.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                          </Typography>
                          <Stack spacing={1}>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                              <Typography variant="body2">Total:</Typography>
                              <Typography variant="body2">{task.totalTasks}</Typography>
                            </Box>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                              <Typography variant="body2">Success Rate:</Typography>
                              <Typography variant="body2" color={task.successRate > 90 ? 'success.main' : task.successRate > 70 ? 'warning.main' : 'error.main'}>
                                {task.successRate}%
                              </Typography>
                            </Box>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                              <Typography variant="body2">Avg Duration:</Typography>
                              <Typography variant="body2">
                                {task.avgDurationMs > 0 ? `${Math.round(task.avgDurationMs)}ms` : 'N/A'}
                              </Typography>
                            </Box>
                            {task.failedTasks > 0 && (
                              <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                                <Typography variant="body2">Failed:</Typography>
                                <Typography variant="body2" color="error.main">{task.failedTasks}</Typography>
                              </Box>
                            )}
                          </Stack>
                        </Paper>
                      </Grid>
                    ))}
                  </Grid>
                </CardContent>
              </Card>
            </Grid>

            {/* Queue Status */}
            <Grid item xs={12} md={6}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center' }}>
                    <TrendingUp sx={{ mr: 1 }} />
                    Processing Queue
                  </Typography>
                  <Grid container spacing={2}>
                    {monitoringData.queue.map((queueItem) => (
                      <Grid item xs={6} key={queueItem.status}>
                        <Box textAlign="center">
                          <Typography variant="h5" color={
                            queueItem.status === 'completed' ? 'success.main' :
                            queueItem.status === 'pending' ? 'info.main' :
                            queueItem.status === 'processing' ? 'warning.main' : 'error.main'
                          }>
                            {queueItem.count}
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            {queueItem.status.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                          </Typography>
                        </Box>
                      </Grid>
                    ))}
                  </Grid>
                </CardContent>
              </Card>
            </Grid>

            {/* Memory Type Breakdown */}
            <Grid item xs={12} md={6}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center' }}>
                    <Code sx={{ mr: 1 }} />
                    Memory Type Breakdown
                  </Typography>
                  <List dense>
                    {monitoringData.memoryCoverage.memoryTypeBreakdown && monitoringData.memoryCoverage.memoryTypeBreakdown.length > 0 ? (
                      monitoringData.memoryCoverage.memoryTypeBreakdown.slice(0, 8).map((type) => (
                        <ListItem key={type.memory_type} sx={{ py: 0.5 }}>
                          <ListItemText 
                            primary={type.memory_type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                            secondary={`${type.count} memories`}
                          />
                          <Typography variant="body2" color="text.secondary">
                            {monitoringData.memoryCoverage.totalMemories > 0 ? 
                              Math.round((type.count / monitoringData.memoryCoverage.totalMemories) * 100) : 0}%
                          </Typography>
                        </ListItem>
                      ))
                    ) : (
                      <ListItem>
                        <ListItemText 
                          primary="No memory types found"
                          secondary="Start storing memories to see breakdown"
                        />
                      </ListItem>
                    )}
                  </List>
                </CardContent>
              </Card>
            </Grid>

            {/* System Status */}
            <Grid item xs={12}>
              <Alert 
                severity={
                  monitoringData.processingProgress.systemHealth === 'healthy' ? 'success' :
                  monitoringData.processingProgress.systemHealth === 'degraded' ? 'warning' : 'error'
                }
              >
                <Typography variant="subtitle2">
                  Meta-Learning System Status: {monitoringData.processingProgress.systemHealth.toUpperCase()}
                </Typography>
                <Typography variant="body2">
                  Last updated: {monitoringData.currentTime ? new Date(monitoringData.currentTime).toLocaleString() : 'Unknown'}
                </Typography>
                {monitoringData.processingProgress.systemHealth !== 'healthy' && (
                  <Typography variant="body2" sx={{ mt: 1 }}>
                    {monitoringData.processingProgress.systemHealth === 'degraded' ? 
                      'Some tasks are experiencing delays. Monitor error rates and processing times.' :
                      'System is experiencing significant issues. Check logs and consider restarting the learning pipeline.'
                    }
                  </Typography>
                )}
              </Alert>
            </Grid>
          </Grid>
        ) : (
          <Alert severity="info">
            Loading monitoring data...
          </Alert>
        )}
      </TabPanel>
    </Box>
  );
}

export default MetaLearning;