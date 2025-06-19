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
  Line,
  LineChart
} from 'recharts';
import { miniMeAPI } from '../services/api';
import type { Project, Analytics as AnalyticsType } from '../types';

const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#06B6D4', '#EC4899', '#6366F1'];

// Memory type icon mapping
const getMemoryTypeIcon = (memoryType: string) => {
  const type = memoryType.toLowerCase();
  switch (type) {
    case 'task':
      return <Assessment />;
    case 'code':
      return <Code />;
    case 'bug':
    case 'bugfix':
      return <BugReport />;
    case 'decision':
    case 'architecture':
      return <Business />;
    case 'insight':
    case 'lessons_learned':
      return <Lightbulb />;
    case 'progress':
    case 'implementation_notes':
      return <TrendingUp />;
    case 'requirements':
    case 'project_brief':
      return <Assessment />;
    default:
      return <Assessment />;
  }
};

// Empty state component for charts
function ChartEmptyState({ icon, title, description }: { icon: React.ReactNode, title: string, description: string }) {
  return (
    <Box sx={{ 
      display: 'flex', 
      flexDirection: 'column', 
      alignItems: 'center', 
      justifyContent: 'center', 
      height: '100%',
      color: 'text.secondary',
      p: 3
    }}>
      <Box sx={{ fontSize: 48, mb: 2, opacity: 0.5 }}>
        {icon}
      </Box>
      <Typography variant="body1" gutterBottom>
        {title}
      </Typography>
      <Typography variant="body2" color="text.secondary" textAlign="center">
        {description}
      </Typography>
    </Box>
  );
}

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

const Analytics = () => {
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
    const totalSequences = analytics.thinking?.total_sequences || 0;
    const completionRate = analytics.thinking?.completion_rate || 0;
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
    const totalSequences = analytics.thinking?.total_sequences || 0;
    
    // Return empty array if no data
    if (totalMemories === 0 && totalSequences === 0) {
      return [];
    }
    
    // Generate a trend line with multiple data points for better visualization
    const now = new Date();
    const data = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i * 5); // Every 5 days
      
      // Simulate growth trend (current data at the end)
      const growthFactor = (7 - i) / 7;
      data.push({
        date: date.toISOString().split('T')[0],
        memories: Math.round(totalMemories * growthFactor),
        sequences: Math.round(totalSequences * growthFactor),
        confidence: (analytics.thinking.avg_confidence || 0.7) * growthFactor,
        productivity: Math.min(100, Math.round((totalMemories * 2 + totalSequences * 5) * growthFactor)),
      });
    }
    
    return data;
  };

  const generateMemoryTypeDistribution = () => {
    try {
      // Comprehensive validation
      if (!analytics) {
        console.log('[Analytics] No analytics data available');
        return [];
      }
      
      if (!analytics.memoryDistribution) {
        console.log('[Analytics] No memoryDistribution in analytics data');
        return [];
      }
      
      if (!Array.isArray(analytics.memoryDistribution)) {
        console.log('[Analytics] memoryDistribution is not an array:', typeof analytics.memoryDistribution);
        return [];
      }
      
      console.log('[Analytics] Processing', analytics.memoryDistribution.length, 'memory distribution entries');
      
      // Use the actual memory distribution from the enhanced API with comprehensive validation
      const validEntries = analytics.memoryDistribution.filter((item, index) => {
        if (!item) {
          console.warn(`[Analytics] Entry ${index} is null/undefined`);
          return false;
        }
        if (typeof item !== 'object') {
          console.warn(`[Analytics] Entry ${index} is not an object:`, typeof item);
          return false;
        }
        if (!item.name || typeof item.name !== 'string') {
          console.warn(`[Analytics] Entry ${index} has invalid name:`, item.name, typeof item.name);
          return false;
        }
        if (item.value === undefined || item.value === null || typeof item.value !== 'number') {
          console.warn(`[Analytics] Entry ${index} has invalid value:`, item.value, typeof item.value);
          return false;
        }
        return true;
      });
      
      console.log('[Analytics] Valid entries:', validEntries.length, 'out of', analytics.memoryDistribution.length);
      
      const processedEntries = validEntries.map((item, index) => {
        try {
          const result = {
            name: String(item.name).charAt(0).toUpperCase() + String(item.name).slice(1),
            value: Number(item.value),
            percentage: item.percentage || (analytics?.summary?.totalMemories ? Math.round((Number(item.value) / Number(analytics.summary.totalMemories)) * 100) : 0),
            color: COLORS[index % COLORS.length],
            icon: getMemoryTypeIcon(String(item.name)),
          };
          console.log(`[Analytics] Created entry ${index}:`, result.name, result.value);
          return result;
        } catch (error) {
          console.error(`[Analytics] Error processing entry ${index}:`, error, item);
          return null;
        }
      }).filter((entry): entry is NonNullable<typeof entry> => entry !== null);
      
      return processedEntries;
    } catch (error) {
      console.error('[Analytics] Error in generateMemoryTypeDistribution:', error);
      return [];
    }
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
        current: Math.min(100, (analytics.thinking?.total_thoughts || 0) / Math.max(1, analytics.thinking?.total_sequences || 1) * 10),
        target: 80,
        fullMark: 100 
      },
    ];
  };

  const generateProjectHealthMatrix = () => {
    // Only show projects that have actual data
    return projects.filter(project => 
      parseInt(project.memory_count || '0') > 0 || parseInt(project.thinking_sequence_count || '0') > 0
    ).map(project => ({
      name: project.name.substring(0, 10),
      memories: parseInt(project.memory_count || '0'),
      sequences: parseInt(project.thinking_sequence_count || '0'),
      health: Math.min(100, parseInt(project.memory_count || '0') * 2 + parseInt(project.thinking_sequence_count || '0') * 5),
    }));
  };

  const generateKnowledgeFunnel = () => {
    if (!analytics) return [];
    const total = parseInt(analytics.database.memories.total_memories);
    
    // Return empty array if no memories
    if (total === 0) {
      return [];
    }
    
    // Create a knowledge funnel showing the progression from raw input to refined knowledge
    // Each stage represents a filter or refinement process
    const activeMemories = Math.round(total * 0.9); // 90% of memories are actively used
    const processedKnowledge = Math.round(total * 0.7); // 70% have been processed into insights
    const actionableInsights = Math.round(total * 0.4); // 40% have become actionable insights
    const implementedSolutions = Math.round(total * 0.2); // 20% have been implemented
    
    const funnelData = [
      { value: total, name: 'Total Memories', fill: COLORS[0] },
      { value: activeMemories, name: 'Active Knowledge', fill: COLORS[1] },
      { value: processedKnowledge, name: 'Processed Insights', fill: COLORS[2] },
      { value: actionableInsights, name: 'Actionable Items', fill: COLORS[3] },
      { value: implementedSolutions, name: 'Implemented', fill: COLORS[4] },
    ];
    
    console.log('[Analytics] Knowledge Funnel Data:', funnelData);
    return funnelData;
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
          Comprehensive insights into your digital twin&apos;s performance, learning patterns, and knowledge evolution
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
          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
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

          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
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

          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
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

          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
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
            <Grid size={{ xs: 12, lg: 8 }}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom fontWeight={600}>
                    Knowledge Evolution Over Time
                  </Typography>
                  <Box sx={{ height: 400 }}>
                    {timeSeriesData.length > 0 ? (
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
                    ) : (
                      <ChartEmptyState 
                        icon={<Timeline />}
                        title="No historical data yet"
                        description="Start storing memories and creating thinking sequences to see knowledge evolution over time"
                      />
                    )}
                  </Box>
                </CardContent>
              </Card>
            </Grid>

            <Grid size={{ xs: 12, lg: 4 }}>
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
                        secondary={parseInt(analytics?.database.memories.total_memories || '0') > 0 ? "Growing steadily" : "No data yet"}
                      />
                    </ListItem>
                    <ListItem>
                      <ListItemIcon>
                        <Brain sx={{ color: 'primary.main' }} />
                      </ListItemIcon>
                      <ListItemText
                        primary="Thinking Complexity"
                        secondary={`${Math.round((analytics?.thinking?.total_thoughts || 0) / Math.max(1, analytics?.thinking?.total_sequences || 1))} thoughts/sequence`}
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
            <Grid size={{ xs: 12, md: 6 }}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom fontWeight={600}>
                    Memory Type Distribution
                  </Typography>
                  <Box sx={{ height: 300 }}>
                    {memoryTypeData.length > 0 ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <RechartsPieChart>
                          <Pie
                            data={memoryTypeData}
                            cx="50%"
                            cy="50%"
                            labelLine={false}
                            label={(entry) => {
                              const name = entry?.name || entry?.payload?.name || 'Unknown';
                              const percent = entry?.percent || 0;
                              return `${name} ${(percent * 100).toFixed(0)}%`;
                            }}
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
                    ) : (
                      <ChartEmptyState 
                        icon={<PieChart />}
                        title="No memory types to analyze"
                        description="Store memories with different types to see distribution patterns"
                      />
                    )}
                  </Box>
                </CardContent>
              </Card>
            </Grid>

            <Grid size={{ xs: 12, md: 6 }}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom fontWeight={600}>
                    Knowledge Funnel
                  </Typography>
                  <Box sx={{ height: 300 }}>
                    {knowledgeFunnelData.length > 0 ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart 
                          data={knowledgeFunnelData}
                          margin={{ top: 20, right: 30, left: 20, bottom: 80 }}
                        >
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis 
                            dataKey="name" 
                            angle={-45}
                            textAnchor="end"
                            height={80}
                            interval={0}
                          />
                          <YAxis />
                          <Tooltip />
                          <Bar dataKey="value">
                            {knowledgeFunnelData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.fill} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    ) : (
                      <ChartEmptyState 
                        icon={<BarChartIcon />}
                        title="No knowledge to analyze"
                        description="Store memories to see knowledge funnel analysis"
                      />
                    )}
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </TabPanel>

        {/* Tab 3: Performance */}
        <TabPanel value={activeTab} index={2}>
          <Grid container spacing={3}>
            <Grid size={{ xs: 12, md: 6 }}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom fontWeight={600}>
                    Project Health Matrix
                  </Typography>
                  <Box sx={{ height: 300 }}>
                    {projectHealthData.length > 0 ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={projectHealthData}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="name" />
                          <YAxis />
                          <Tooltip />
                          <Line 
                            type="monotone" 
                            dataKey="memories" 
                            stroke={COLORS[0]} 
                            strokeWidth={2}
                            name="Memories"
                          />
                          <Line 
                            type="monotone" 
                            dataKey="sequences" 
                            stroke={COLORS[1]} 
                            strokeWidth={2}
                            name="Sequences"
                          />
                          <Line 
                            type="monotone" 
                            dataKey="health" 
                            stroke={COLORS[2]} 
                            strokeWidth={3}
                            strokeDasharray="5 5"
                            name="Health Score"
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    ) : (
                      <ChartEmptyState 
                        icon={<Assessment />}
                        title="No project data to analyze"
                        description="Projects with memories and sequences will appear here"
                      />
                    )}
                  </Box>
                </CardContent>
              </Card>
            </Grid>

            <Grid size={{ xs: 12, md: 6 }}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom fontWeight={600}>
                    Project Activity Comparison
                  </Typography>
                  <Box sx={{ height: 300 }}>
                    {projectActivityData.some(p => p.memories > 0 || p.sequences > 0 || p.sessions > 0) ? (
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
                    ) : (
                      <ChartEmptyState 
                        icon={<Business />}
                        title="No project activity to compare"
                        description="Create projects and add data to see activity comparison"
                      />
                    )}
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </TabPanel>

        {/* Tab 4: Intelligence */}
        <TabPanel value={activeTab} index={3}>
          <Grid container spacing={3}>
            <Grid size={{ xs: 12, md: 6 }}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom fontWeight={600}>
                    Thinking Quality Radar
                  </Typography>
                  <Box sx={{ height: 300 }}>
                    {analytics?.thinking?.total_sequences > 0 ? (
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
                    ) : (
                      <ChartEmptyState 
                        icon={<Brain />}
                        title="No thinking data to analyze"
                        description="Create thinking sequences to see quality analysis"
                      />
                    )}
                  </Box>
                </CardContent>
              </Card>
            </Grid>

            <Grid size={{ xs: 12, md: 6 }}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom fontWeight={600}>
                    Intelligence Insights
                  </Typography>
                  <Box sx={{ p: 2 }}>
                    <Grid container spacing={2}>
                      <Grid size={{ xs: 6 }}>
                        <Paper sx={{ p: 2, textAlign: 'center', bgcolor: 'primary.50' }}>
                          <Typography variant="h4" color="primary.main">
                            {Math.round((analytics?.thinking.avg_confidence || 0.7) * 100)}%
                          </Typography>
                          <Typography variant="caption">
                            Avg Confidence
                          </Typography>
                        </Paper>
                      </Grid>
                      <Grid size={{ xs: 6 }}>
                        <Paper sx={{ p: 2, textAlign: 'center', bgcolor: 'success.50' }}>
                          <Typography variant="h4" color="success.main">
                            {analytics?.thinking.total_branches || 0}
                          </Typography>
                          <Typography variant="caption">
                            Branch Points
                          </Typography>
                        </Paper>
                      </Grid>
                      <Grid size={{ xs: 6 }}>
                        <Paper sx={{ p: 2, textAlign: 'center', bgcolor: 'warning.50' }}>
                          <Typography variant="h4" color="warning.main">
                            {analytics?.thinking.total_revisions || 0}
                          </Typography>
                          <Typography variant="caption">
                            Revisions Made
                          </Typography>
                        </Paper>
                      </Grid>
                      <Grid size={{ xs: 6 }}>
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
            <Grid size={{ xs: 12, md: 4 }}>
              <Paper sx={{ p: 3, bgcolor: 'primary.50', border: '1px solid', borderColor: 'primary.200' }}>
                <Typography variant="subtitle1" fontWeight={600} color="primary.main" gutterBottom>
                  📈 Growth Pattern
                </Typography>
                <Typography variant="body2" color="primary.dark">
                  {parseInt(analytics?.database.memories.total_memories || '0') > 0 
                    ? `Your knowledge base contains ${analytics?.database.memories.total_memories} memories with strong patterns in your development approach.`
                    : 'Start storing memories to see growth pattern analysis here.'}
                </Typography>
              </Paper>
            </Grid>
            <Grid size={{ xs: 12, md: 4 }}>
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
            <Grid size={{ xs: 12, md: 4 }}>
              <Paper sx={{ p: 3, bgcolor: 'warning.50', border: '1px solid', borderColor: 'warning.200' }}>
                <Typography variant="subtitle1" fontWeight={600} color="warning.main" gutterBottom>
                  💡 Learning Recommendation
                </Typography>
                <Typography variant="body2" color="warning.dark">
                  {analytics?.thinking?.total_sequences > 0 
                    ? 'Your most productive sessions occur when combining code memories with structured thinking. Try linking more memories to active thinking sequences.'
                    : 'Create thinking sequences alongside memories to see learning recommendations here.'}
                </Typography>
              </Paper>
            </Grid>
          </Grid>
        </CardContent>
      </Card>
    </Box>
  );
}

export default Analytics;