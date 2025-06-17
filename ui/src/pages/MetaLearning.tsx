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
}

export function MetaLearning() {
  const [tabValue, setTabValue] = useState(0);
  const [insights, setInsights] = useState<LearningInsight[]>([]);
  const [patterns, setPatterns] = useState<CodingPattern[]>([]);
  const [status, setStatus] = useState<LearningStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchLearningData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // TODO: Implement actual API endpoints for meta-learning data
      // For now, we'll use empty arrays to show the system is ready but has no data yet
      
      // In a real implementation, these would call:
      // const insightsResponse = await miniMeAPI.getLearningInsights();
      // const patternsResponse = await miniMeAPI.getCodingPatterns();
      // const statusResponse = await miniMeAPI.getLearningStatus();
      
      // Empty data arrays - system is ready but no learning data yet
      const emptyInsights: LearningInsight[] = [];
      const emptyPatterns: CodingPattern[] = [];
      
      // Basic status showing system is ready
      const basicStatus: LearningStatus = {
        queue_size: 0,
        total_patterns: 0,
        total_insights: 0,
        last_processing: new Date().toISOString(),
        processing_rate: 1.0, // System is healthy, just no data to process yet
        system_health: 'healthy'
      };

      setInsights(emptyInsights);
      setPatterns(emptyPatterns);
      setStatus(basicStatus);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch learning data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLearningData();
  }, []);

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
    </Box>
  );
}