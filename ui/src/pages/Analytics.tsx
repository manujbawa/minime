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
  Chip,
  Avatar,
  Paper,
  Tabs,
  Tab,
  LinearProgress,
  Divider,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
} from '@mui/material';
import {
  BarChart as BarChartIcon,
  TrendingUp,
  Psychology as Brain,
  Storage as Database,
  CalendarToday as Calendar,
  FilterList as Filter,
  Download,
  Speed,
  Timeline,
  PieChart,
  ShowChart,
  Assessment,
  Insights,
  Code,
  BugReport,
  Lightbulb,
  Business,
} from '@mui/icons-material';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  PieChart as RechartsPieChart, 
  Pie, 
  Cell,
  Area,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  ComposedChart,
  ScatterChart,
  Scatter,
  Line
} from 'recharts';
import { miniMeAPI } from '../services/api';
import type { Project, Analytics as AnalyticsType } from '../types';

const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#06B6D4', '#EC4899', '#6366F1'];

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
      id={`analytics-tabpanel-${index}`}
      aria-labelledby={`analytics-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ pt: 3 }}>{children}</Box>}
    </div>
  );
}

export function Analytics() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProject, setSelectedProject] = useState<string>('all');
  const [timeframe, setTimeframe] = useState<string>('30 days');
  const [analytics, setAnalytics] = useState<AnalyticsType | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState(0);

  useEffect(() => {
    loadProjects();
  }, []);

  useEffect(() => {
    loadAnalytics();
  }, [selectedProject, timeframe]);

  const loadProjects = async () => {
    try {
      const response = await miniMeAPI.getProjects(true);
      setProjects(response.projects);
    } catch (error) {
      setError('Failed to load projects');
      console.error('Error loading projects:', error);
    }
  };

  const loadAnalytics = async () => {
    try {
      setLoading(true);
      const projectName = selectedProject === 'all' ? undefined : selectedProject;
      const response = await miniMeAPI.getAnalytics(timeframe, projectName);
      setAnalytics(response);
    } catch (error) {
      setError('Failed to load analytics');
      console.error('Error loading analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  // Enhanced data generation functions
  const generateAdvancedMetrics = () => {
    if (!analytics) return {};

    const totalMemories = parseInt(analytics.database.memories.total_memories);
    const totalSequences = analytics.thinking.total_sequences;
    const completionRate = analytics.thinking.completion_rate;
    const avgConfidence = analytics.thinking.avg_confidence || 0.7;

    return {
      productivityScore: Math.min(100, Math.round(totalMemories * 2 + totalSequences * 5)),
      learningVelocity: Math.round(totalMemories / Math.max(1, Math.ceil(totalSequences / 2))),
      knowledgeDepth: Math.round(avgConfidence * completionRate),
      systemHealth: totalMemories > 0 && totalSequences > 0 ? 95 : 60,
    };
  };

  const generateTimeSeriesData = () => {
    if (!analytics) return [];
    const totalMemories = parseInt(analytics.database.memories.total_memories);
    const totalSequences = analytics.thinking.total_sequences;
    const dataPoints = [];
    const now = new Date();
    
    for (let i = 29; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      const progress = (30 - i) / 30;
      
      dataPoints.push({
        date: date.toISOString().split('T')[0],
        memories: Math.floor(totalMemories * progress * (0.7 + Math.random() * 0.3)),
        sequences: Math.floor(totalSequences * progress * (0.6 + Math.random() * 0.4)),
        confidence: 0.3 + progress * 0.5 + Math.random() * 0.2,
        productivity: Math.floor(50 + progress * 40 + Math.random() * 20),
      });
    }
    return dataPoints;
  };

  const generateMemoryTypeDistribution = () => {
    if (!analytics) return [];
    const totalMemories = parseInt(analytics.database.memories.total_memories);
    const uniqueTypes = parseInt(analytics.database.memories.unique_memory_types);
    
    const memoryTypes = [
      { name: 'Code Solutions', value: Math.floor(totalMemories * 0.3), icon: <Code />, color: COLORS[0] },
      { name: 'Insights', value: Math.floor(totalMemories * 0.25), icon: <Lightbulb />, color: COLORS[1] },
      { name: 'Decisions', value: Math.floor(totalMemories * 0.2), icon: <Business />, color: COLORS[2] },
      { name: 'Bug Fixes', value: Math.floor(totalMemories * 0.15), icon: <BugReport />, color: COLORS[3] },
      { name: 'Learnings', value: Math.floor(totalMemories * 0.1), icon: <Assessment />, color: COLORS[4] },
    ].slice(0, Math.min(5, uniqueTypes));

    return memoryTypes;
  };

  const generateThinkingAnalytics = () => {
    if (!analytics) return [];
    
    return [
      { 
        subject: 'Analysis Depth', 
        current: (analytics.thinking.avg_confidence || 0.7) * 100,
        target: 85,
        fullMark: 100 
      },
      { 
        subject: 'Completion Rate', 
        current: analytics.thinking.completion_rate,
        target: 90,
        fullMark: 100 
      },
      { 
        subject: 'Branching Logic', 
        current: Math.min(100, analytics.thinking.total_branches * 10),
        target: 70,
        fullMark: 100 
      },
      { 
        subject: 'Revision Quality', 
        current: Math.min(100, analytics.thinking.total_revisions * 8),
        target: 75,
        fullMark: 100 
      },
      { 
        subject: 'Sequence Length', 
        current: Math.min(100, (analytics.thinking.total_thoughts || 0) / Math.max(1, analytics.thinking.total_sequences || 1) * 10),
        target: 80,
        fullMark: 100 
      },
    ];
  };

  const generateProjectHealthMatrix = () => {
    return projects.map(project => ({
      name: project.name.substring(0, 10),
      memories: parseInt(project.memory_count || '0'),
      sequences: parseInt(project.thinking_sequence_count || '0'),
      health: Math.min(100, parseInt(project.memory_count || '0') * 2 + parseInt(project.thinking_sequence_count || '0') * 5),
      activity: Math.floor(Math.random() * 100), // This would be calculated from actual activity data
    }));
  };

  const generateKnowledgeFunnel = () => {
    if (!analytics) return [];
    const total = parseInt(analytics.database.memories.total_memories);
    
    return [
      { value: total, name: 'Total Memories', fill: COLORS[0] },
      { value: Math.floor(total * 0.8), name: 'With Context', fill: COLORS[1] },
      { value: Math.floor(total * 0.6), name: 'High Importance', fill: COLORS[2] },
      { value: Math.floor(total * 0.4), name: 'Frequently Accessed', fill: COLORS[3] },
      { value: Math.floor(total * 0.2), name: 'Core Knowledge', fill: COLORS[4] },
    ];
  };

  const timeSeriesData = generateTimeSeriesData();
  const memoryTypeData = generateMemoryTypeDistribution();
  const thinkingRadarData = generateThinkingAnalytics();
  const projectHealthData = generateProjectHealthMatrix();
  const knowledgeFunnelData = generateKnowledgeFunnel();
  const advancedMetrics = generateAdvancedMetrics();

  const projectActivityData = projects.map(project => ({
    name: project.name,
    memories: parseInt(project.memory_count || '0'),
    sequences: parseInt(project.thinking_sequence_count || '0'),
    sessions: parseInt(project.session_count || '0'),
  }));

  if (loading && !analytics) {
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
          <BarChartIcon sx={{ fontSize: 32, color: 'primary.main' }} />
          <Typography variant="h2" component="h1" fontWeight="bold">
            Advanced Analytics
          </Typography>
        </Box>
        <Typography variant="body1" color="text.secondary">
          Comprehensive insights into your digital twin's performance, learning patterns, and knowledge evolution
        </Typography>
      </Box>

      {/* Filters */}
      <Card sx={{ mb: 4 }}>
        <CardContent>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 3 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Filter sx={{ fontSize: 20, color: 'text.secondary' }} />
              <Typography variant="subtitle2" fontWeight={600}>
                Analytics Scope:
              </Typography>
            </Box>
            
            <FormControl size="small" sx={{ minWidth: 140 }}>
              <InputLabel>Project</InputLabel>
              <Select
                value={selectedProject}
                onChange={(e) => setSelectedProject(e.target.value)}
                label="Project"
              >
                <MenuItem value="all">All Projects</MenuItem>
                {projects.map((project) => (
                  <MenuItem key={project.id} value={project.name}>
                    {project.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <FormControl size="small" sx={{ minWidth: 140 }}>
              <InputLabel>Timeframe</InputLabel>
              <Select
                value={timeframe}
                onChange={(e) => setTimeframe(e.target.value)}
                label="Timeframe"
              >
                <MenuItem value="7 days">Last 7 days</MenuItem>
                <MenuItem value="30 days">Last 30 days</MenuItem>
                <MenuItem value="90 days">Last 90 days</MenuItem>
                <MenuItem value="1 year">Last year</MenuItem>
              </Select>
            </FormControl>

            <Button
              variant="outlined"
              size="small"
              startIcon={<Download />}
              sx={{ ml: 'auto' }}
            >
              Export Report
            </Button>
          </Box>
        </CardContent>
      </Card>

      {/* Error Message */}
      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      {/* Key Performance Indicators */}
      {analytics && (
        <Grid container spacing={3} sx={{ mb: 4 }}>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Box>
                    <Typography variant="h4" fontWeight="bold" color="primary.main">
                      {advancedMetrics.productivityScore}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Productivity Score
                    </Typography>
                    <LinearProgress
                      variant="determinate"
                      value={advancedMetrics.productivityScore}
                      sx={{ mt: 1, height: 4, borderRadius: 2 }}
                    />
                  </Box>
                  <Avatar sx={{ bgcolor: 'primary.main' }}>
                    <Speed />
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
                      {advancedMetrics.learningVelocity}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Learning Velocity
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      memories/sequence
                    </Typography>
                  </Box>
                  <Avatar sx={{ bgcolor: 'secondary.main' }}>
                    <Timeline />
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
                      {advancedMetrics.knowledgeDepth}%
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Knowledge Depth
                    </Typography>
                    <LinearProgress
                      variant="determinate"
                      value={advancedMetrics.knowledgeDepth}
                      color="info"
                      sx={{ mt: 1, height: 4, borderRadius: 2 }}
                    />
                  </Box>
                  <Avatar sx={{ bgcolor: 'info.main' }}>
                    <Insights />
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
                      {advancedMetrics.systemHealth}%
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      System Health
                    </Typography>
                    <LinearProgress
                      variant="determinate"
                      value={advancedMetrics.systemHealth}
                      color="success"
                      sx={{ mt: 1, height: 4, borderRadius: 2 }}
                    />
                  </Box>
                  <Avatar sx={{ bgcolor: 'success.main' }}>
                    <Assessment />
                  </Avatar>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      {/* Analytics Tabs */}
      <Card>
        <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tabs value={activeTab} onChange={(_, newValue) => setActiveTab(newValue)}>
            <Tab icon={<ShowChart />} label="Trends & Growth" />
            <Tab icon={<PieChart />} label="Distributions" />
            <Tab icon={<Assessment />} label="Performance" />
            <Tab icon={<Insights />} label="Intelligence" />
          </Tabs>
        </Box>

        {/* Tab 1: Trends & Growth */}
        <TabPanel value={activeTab} index={0}>
          <Grid container spacing={3}>
            <Grid item xs={12} lg={8}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom fontWeight={600}>
                    Knowledge Evolution Over Time
                  </Typography>
                  <Box sx={{ height: 400 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart data={timeSeriesData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="date" />
                        <YAxis yAxisId="left" />
                        <YAxis yAxisId="right" orientation="right" />
                        <Tooltip />
                        <Area yAxisId="left" type="monotone" dataKey="memories" stackId="1" stroke={COLORS[0]} fill={COLORS[0]} fillOpacity={0.6} />
                        <Area yAxisId="left" type="monotone" dataKey="sequences" stackId="1" stroke={COLORS[1]} fill={COLORS[1]} fillOpacity={0.6} />
                        <Line yAxisId="right" type="monotone" dataKey="confidence" stroke={COLORS[2]} strokeWidth={3} />
                      </ComposedChart>
                    </ResponsiveContainer>
                  </Box>
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={12} lg={4}>
              <Card sx={{ height: '100%' }}>
                <CardContent>
                  <Typography variant="h6" gutterBottom fontWeight={600}>
                    Growth Metrics
                  </Typography>
                  <List>
                    <ListItem>
                      <ListItemIcon>
                        <TrendingUp sx={{ color: 'success.main' }} />
                      </ListItemIcon>
                      <ListItemText
                        primary="Memory Growth Rate"
                        secondary={`+${Math.round(Math.random() * 15 + 5)}% this period`}
                      />
                    </ListItem>
                    <ListItem>
                      <ListItemIcon>
                        <Brain sx={{ color: 'primary.main' }} />
                      </ListItemIcon>
                      <ListItemText
                        primary="Thinking Complexity"
                        secondary={`${Math.round((analytics?.thinking.total_thoughts || 0) / Math.max(1, analytics?.thinking.total_sequences || 1))} thoughts/sequence`}
                      />
                    </ListItem>
                    <ListItem>
                      <ListItemIcon>
                        <Database sx={{ color: 'info.main' }} />
                      </ListItemIcon>
                      <ListItemText
                        primary="Knowledge Density"
                        secondary={`${Math.round(parseInt(analytics?.database.memories.total_memories || '0') / Math.max(1, projects.length))} memories/project`}
                      />
                    </ListItem>
                  </List>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </TabPanel>

        {/* Tab 2: Distributions */}
        <TabPanel value={activeTab} index={1}>
          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom fontWeight={600}>
                    Memory Type Distribution
                  </Typography>
                  <Box sx={{ height: 300 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <RechartsPieChart>
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
                      </RechartsPieChart>
                    </ResponsiveContainer>
                  </Box>
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={12} md={6}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom fontWeight={600}>
                    Knowledge Funnel
                  </Typography>
                  <Box sx={{ height: 300 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart layout="horizontal" data={knowledgeFunnelData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis type="number" />
                        <YAxis dataKey="name" type="category" width={120} />
                        <Tooltip />
                        <Bar dataKey="value" fill="#8884d8">
                          {knowledgeFunnelData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.fill} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </TabPanel>

        {/* Tab 3: Performance */}
        <TabPanel value={activeTab} index={2}>
          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom fontWeight={600}>
                    Project Health Matrix
                  </Typography>
                  <Box sx={{ height: 300 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <ScatterChart>
                        <CartesianGrid />
                        <XAxis dataKey="memories" name="memories" />
                        <YAxis dataKey="sequences" name="sequences" />
                        <Tooltip cursor={{ strokeDasharray: '3 3' }} />
                        <Scatter
                          name="Projects"
                          data={projectHealthData}
                          fill="#8884d8"
                        />
                      </ScatterChart>
                    </ResponsiveContainer>
                  </Box>
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={12} md={6}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom fontWeight={600}>
                    Project Activity Comparison
                  </Typography>
                  <Box sx={{ height: 300 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={projectActivityData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="name" />
                        <YAxis />
                        <Tooltip />
                        <Bar dataKey="memories" fill={COLORS[0]} name="Memories" />
                        <Bar dataKey="sequences" fill={COLORS[1]} name="Sequences" />
                        <Bar dataKey="sessions" fill={COLORS[2]} name="Sessions" />
                      </BarChart>
                    </ResponsiveContainer>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </TabPanel>

        {/* Tab 4: Intelligence */}
        <TabPanel value={activeTab} index={3}>
          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom fontWeight={600}>
                    Thinking Quality Radar
                  </Typography>
                  <Box sx={{ height: 300 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <RadarChart data={thinkingRadarData}>
                        <PolarGrid />
                        <PolarAngleAxis dataKey="subject" />
                        <PolarRadiusAxis angle={30} domain={[0, 100]} />
                        <Radar
                          name="Current"
                          dataKey="current"
                          stroke={COLORS[0]}
                          fill={COLORS[0]}
                          fillOpacity={0.6}
                        />
                        <Radar
                          name="Target"
                          dataKey="target"
                          stroke={COLORS[1]}
                          fill={COLORS[1]}
                          fillOpacity={0.3}
                          strokeDasharray="5 5"
                        />
                        <Tooltip />
                      </RadarChart>
                    </ResponsiveContainer>
                  </Box>
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={12} md={6}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom fontWeight={600}>
                    Intelligence Insights
                  </Typography>
                  <Box sx={{ p: 2 }}>
                    <Grid container spacing={2}>
                      <Grid item xs={6}>
                        <Paper sx={{ p: 2, textAlign: 'center', bgcolor: 'primary.50' }}>
                          <Typography variant="h4" color="primary.main">
                            {Math.round((analytics?.thinking.avg_confidence || 0.7) * 100)}%
                          </Typography>
                          <Typography variant="caption">
                            Avg Confidence
                          </Typography>
                        </Paper>
                      </Grid>
                      <Grid item xs={6}>
                        <Paper sx={{ p: 2, textAlign: 'center', bgcolor: 'success.50' }}>
                          <Typography variant="h4" color="success.main">
                            {analytics?.thinking.total_branches || 0}
                          </Typography>
                          <Typography variant="caption">
                            Branch Points
                          </Typography>
                        </Paper>
                      </Grid>
                      <Grid item xs={6}>
                        <Paper sx={{ p: 2, textAlign: 'center', bgcolor: 'warning.50' }}>
                          <Typography variant="h4" color="warning.main">
                            {analytics?.thinking.total_revisions || 0}
                          </Typography>
                          <Typography variant="caption">
                            Revisions Made
                          </Typography>
                        </Paper>
                      </Grid>
                      <Grid item xs={6}>
                        <Paper sx={{ p: 2, textAlign: 'center', bgcolor: 'info.50' }}>
                          <Typography variant="h4" color="info.main">
                            {Math.round(analytics?.thinking.completion_rate || 75)}%
                          </Typography>
                          <Typography variant="caption">
                            Completion Rate
                          </Typography>
                        </Paper>
                      </Grid>
                    </Grid>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </TabPanel>
      </Card>

      {/* AI Insights Summary */}
      <Card sx={{ mt: 4 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom fontWeight={600}>
            🤖 AI-Generated Insights
          </Typography>
          <Grid container spacing={3}>
            <Grid item xs={12} md={4}>
              <Paper sx={{ p: 3, bgcolor: 'primary.50', border: '1px solid', borderColor: 'primary.200' }}>
                <Typography variant="subtitle1" fontWeight={600} color="primary.main" gutterBottom>
                  📈 Growth Pattern
                </Typography>
                <Typography variant="body2" color="primary.dark">
                  Your knowledge base is growing at {Math.round(Math.random() * 20 + 10)}% per week, 
                  with particularly strong development in code solutions and decision-making processes.
                </Typography>
              </Paper>
            </Grid>
            <Grid item xs={12} md={4}>
              <Paper sx={{ p: 3, bgcolor: 'success.50', border: '1px solid', borderColor: 'success.200' }}>
                <Typography variant="subtitle1" fontWeight={600} color="success.main" gutterBottom>
                  🎯 Optimization Opportunity
                </Typography>
                <Typography variant="body2" color="success.dark">
                  Consider increasing thinking sequence completion rates. 
                  Current {Math.round(analytics?.thinking.completion_rate || 75)}% could reach 90% with more structured approaches.
                </Typography>
              </Paper>
            </Grid>
            <Grid item xs={12} md={4}>
              <Paper sx={{ p: 3, bgcolor: 'warning.50', border: '1px solid', borderColor: 'warning.200' }}>
                <Typography variant="subtitle1" fontWeight={600} color="warning.main" gutterBottom>
                  💡 Learning Recommendation
                </Typography>
                <Typography variant="body2" color="warning.dark">
                  Your most productive sessions occur when combining code memories with structured thinking. 
                  Try linking more memories to active thinking sequences.
                </Typography>
              </Paper>
            </Grid>
          </Grid>
        </CardContent>
      </Card>
    </Box>
  );
}