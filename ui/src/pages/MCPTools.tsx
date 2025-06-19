import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Grid,
  Chip,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Alert,
  CircularProgress,
  Paper,
  Divider,
  Stack,
  IconButton,
  Tooltip,
  Button,
} from '@mui/material';
import {
  ExpandMore,
  ContentCopy,
  Refresh,
  Info,
  Build,
  CheckCircle,
  Error,
} from '@mui/icons-material';
import { miniMeAPI } from '../services/api';

interface MCPTool {
  name: string;
  description: string;
  inputSchema?: {
    type: string;
    properties?: Record<string, any>;
    required?: string[];
  };
}

interface MCPStatus {
  message: string;
  version: string;
  transport: {
    type: string;
    endpoint: string;
    features: string[];
  };
  capabilities: {
    tools: {
      count: number;
      available: MCPTool[];
    };
  };
  services: Record<string, string>;
}

const MCPTools = () => {
  const [mcpStatus, setMCPStatus] = useState<MCPStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedTool, setExpandedTool] = useState<string | false>(false);

  const fetchMCPStatus = async () => {
    try {
      setLoading(true);
      setError(null);
      // Fetch with full schemas for IDE Agent view
      const response = await fetch('/mcp/status?full=true');
      const status = await response.json();
      setMCPStatus(status);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch MCP status');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMCPStatus();
  }, []);

  const handleAccordionChange = (toolName: string) => (event: React.SyntheticEvent, isExpanded: boolean) => {
    setExpandedTool(isExpanded ? toolName : false);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const formatPropertyType = (prop: any): string => {
    if (prop.type === 'array' && prop.items) {
      return `${prop.type}[${prop.items.type || 'any'}]`;
    }
    if (prop.enum) {
      return `enum: ${prop.enum.join(' | ')}`;
    }
    return prop.type || 'any';
  };

  const getToolCategory = (toolName: string): string => {
    if (toolName.includes('memory') || toolName.includes('store') || toolName.includes('search')) {
      return 'Memory Management';
    }
    if (toolName.includes('thinking') || toolName.includes('thought')) {
      return 'Sequential Thinking';
    }
    if (toolName.includes('task')) {
      return 'Task Management';
    }
    if (toolName.includes('learning') || toolName.includes('pattern') || toolName.includes('insight')) {
      return 'Meta-Learning';
    }
    return 'General';
  };

  const getCategoryColor = (category: string): 'primary' | 'secondary' | 'success' | 'warning' | 'info' => {
    switch (category) {
      case 'Memory Management': return 'primary';
      case 'Sequential Thinking': return 'secondary';
      case 'Task Management': return 'warning';
      case 'Meta-Learning': return 'success';
      default: return 'info';
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
            <Button color="inherit" size="small" onClick={fetchMCPStatus}>
              Retry
            </Button>
          }
        >
          {error}
        </Alert>
      </Box>
    );
  }

  if (!mcpStatus) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="info">No MCP status data available</Alert>
      </Box>
    );
  }

  const toolsByCategory = mcpStatus.capabilities.tools.available.reduce((acc, tool) => {
    const category = getToolCategory(tool.name);
    if (!acc[category]) acc[category] = [];
    acc[category].push(tool);
    return acc;
  }, {} as Record<string, MCPTool[]>);

  return (
    <Box sx={{ 
      p: { xs: 2, sm: 3 }, 
      maxWidth: '100vw', 
      overflow: 'hidden',
      width: '100%',
      boxSizing: 'border-box'
    }}>
      {/* Header */}
      <Box sx={{ mb: 4 }}>
        <Box sx={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'space-between', 
          mb: 2,
          flexWrap: 'wrap',
          gap: 2
        }}>
          <Typography variant="h4" component="h1" fontWeight="bold" sx={{ flexShrink: 1 }}>
            MCP Tools
          </Typography>
          <Tooltip title="Refresh tools">
            <IconButton onClick={fetchMCPStatus} color="primary">
              <Refresh />
            </IconButton>
          </Tooltip>
        </Box>
        <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
          Discover and explore all available Model Context Protocol (MCP) tools for interacting with MiniMe.
        </Typography>
      </Box>

      {/* MCP Status Overview */}
      <Paper sx={{ p: { xs: 2, sm: 3 }, mb: 4 }}>
        <Grid container spacing={3}>
          <Grid item xs={12} md={6}>
            <Typography variant="h6" gutterBottom>
              <Build sx={{ mr: 1, verticalAlign: 'middle' }} />
              MCP Server Status
            </Typography>
            <Stack spacing={1}>
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <CheckCircle sx={{ color: 'success.main', mr: 1, fontSize: 20 }} />
                <Typography variant="body2" sx={{ wordBreak: 'break-word' }}>
                  {mcpStatus.message}
                </Typography>
              </Box>
              <Typography variant="body2" color="text.secondary" sx={{ wordBreak: 'break-word' }}>
                Version: {mcpStatus.version}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ wordBreak: 'break-word' }}>
                Transport: {mcpStatus.transport.type}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ wordBreak: 'break-word' }}>
                Endpoint: {mcpStatus.transport.endpoint}
              </Typography>
            </Stack>
          </Grid>
          
          <Grid item xs={12} md={6}>
            <Typography variant="h6" gutterBottom>
              <Info sx={{ mr: 1, verticalAlign: 'middle' }} />
              Quick Stats
            </Typography>
            <Stack spacing={1}>
              <Typography variant="body2">
                <strong>{mcpStatus.capabilities.tools.count}</strong> tools available
              </Typography>
              <Typography variant="body2">
                <strong>{Object.keys(toolsByCategory).length}</strong> categories
              </Typography>
              <Typography variant="body2">
                <strong>{mcpStatus.transport.features.length}</strong> transport features
              </Typography>
            </Stack>
          </Grid>
        </Grid>

        <Divider sx={{ my: 2 }} />

        <Box>
          <Typography variant="subtitle2" gutterBottom>Transport Features</Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
            {mcpStatus.transport.features.map((feature) => (
              <Chip key={feature} label={feature} size="small" variant="outlined" />
            ))}
          </Box>
        </Box>

        <Box sx={{ mt: 2 }}>
          <Typography variant="subtitle2" gutterBottom>Services Status</Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
            {Object.entries(mcpStatus.services).map(([service, status]) => (
              <Chip 
                key={service} 
                label={`${service}: ${status}`} 
                size="small" 
                color={status === 'active' || status === 'available' ? 'success' : 'default'}
                variant="outlined"
              />
            ))}
          </Box>
        </Box>
      </Paper>

      {/* Tools by Category */}
      {Object.entries(toolsByCategory).map(([category, tools]) => (
        <Box key={category} sx={{ mb: 4, maxWidth: '100%', overflow: 'hidden' }}>
          <Typography 
            variant="h5" 
            gutterBottom 
            sx={{ 
              display: 'flex', 
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: 1
            }}
          >
            <Chip 
              label={category} 
              color={getCategoryColor(category)} 
              sx={{ flexShrink: 0 }} 
            />
            <Box sx={{ flexShrink: 0 }}>
              {tools.length} tools
            </Box>
          </Typography>
          
          <Box sx={{ width: '100%', maxWidth: '100%', overflow: 'hidden' }}>
            {tools.map((tool) => (
              <Box key={tool.name} sx={{ mb: 2, width: '100%' }}>
                <Accordion 
                  expanded={expandedTool === tool.name} 
                  onChange={handleAccordionChange(tool.name)}
                  sx={{ 
                    border: '1px solid', 
                    borderColor: 'divider',
                    width: '100%',
                    maxWidth: '100%',
                    overflow: 'hidden'
                  }}
                >
                  <AccordionSummary expandIcon={<ExpandMore />}>
                    <Box sx={{ width: '100%', minWidth: 0 }}>
                      <Box sx={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'space-between', 
                        width: '100%',
                        gap: 1
                      }}>
                        <Typography 
                          variant="h6" 
                          fontFamily="monospace"
                          sx={{ 
                            wordBreak: 'break-word',
                            flexShrink: 1,
                            minWidth: 0
                          }}
                        >
                          {tool.name}
                        </Typography>
                        <Tooltip title="Copy tool name">
                          <IconButton 
                            size="small" 
                            onClick={(e) => {
                              e.stopPropagation();
                              copyToClipboard(tool.name);
                            }}
                            sx={{ flexShrink: 0 }}
                          >
                            <ContentCopy fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </Box>
                      <Typography 
                        variant="body2" 
                        color="text.secondary" 
                        sx={{ 
                          mt: 1,
                          wordBreak: 'break-word'
                        }}
                      >
                        {tool.description}
                      </Typography>
                    </Box>
                  </AccordionSummary>
                  
                  <AccordionDetails>
                    <Box sx={{ maxWidth: '100%', overflow: 'hidden' }}>
                      <Typography variant="subtitle1" gutterBottom>
                        Input Schema
                      </Typography>
                      
                      {tool.inputSchema?.properties && Object.keys(tool.inputSchema.properties).length > 0 ? (
                        <Box sx={{ mb: 2 }}>
                          <Typography variant="subtitle2" gutterBottom>Parameters:</Typography>
                          <Box sx={{ 
                            display: 'grid',
                            gridTemplateColumns: {
                              xs: '1fr',
                              sm: 'repeat(2, 1fr)',
                              lg: 'repeat(3, 1fr)'
                            },
                            gap: 2,
                            width: '100%',
                            maxWidth: '100%'
                          }}>
                            {Object.entries(tool.inputSchema.properties).map(([propName, propDef]: [string, any]) => (
                              <Card 
                                key={propName}
                                variant="outlined" 
                                sx={{ 
                                  p: 2, 
                                  height: 'fit-content',
                                  minWidth: 0,
                                  maxWidth: '100%',
                                  overflow: 'hidden'
                                }}
                              >
                                  <Box sx={{ 
                                    display: 'flex', 
                                    alignItems: 'flex-start', 
                                    justifyContent: 'space-between', 
                                    mb: 1,
                                    flexWrap: 'wrap',
                                    gap: 1
                                  }}>
                                    <Typography 
                                      variant="subtitle2" 
                                      fontFamily="monospace"
                                      sx={{ 
                                        wordBreak: 'break-word',
                                        flexShrink: 1,
                                        minWidth: 0
                                      }}
                                    >
                                      {propName}
                                    </Typography>
                                    <Box sx={{ 
                                      display: 'flex', 
                                      gap: 1, 
                                      flexWrap: 'wrap',
                                      flexShrink: 0
                                    }}>
                                      {tool.inputSchema?.required?.includes(propName) && (
                                        <Chip label="required" size="small" color="error" />
                                      )}
                                      <Chip 
                                        label={formatPropertyType(propDef)} 
                                        size="small" 
                                        variant="outlined"
                                      />
                                    </Box>
                                  </Box>
                                  {propDef.description && (
                                    <Typography 
                                      variant="body2" 
                                      color="text.secondary"
                                      sx={{ wordBreak: 'break-word' }}
                                    >
                                      {propDef.description}
                                    </Typography>
                                  )}
                                  {propDef.default !== undefined && (
                                    <Typography 
                                      variant="caption" 
                                      display="block" 
                                      sx={{ mt: 1, wordBreak: 'break-word' }}
                                    >
                                      Default: {JSON.stringify(propDef.default)}
                                    </Typography>
                                  )}
                                  {propDef.minimum !== undefined && (
                                    <Typography variant="caption" display="block">
                                      Minimum: {propDef.minimum}
                                    </Typography>
                                  )}
                                  {propDef.maximum !== undefined && (
                                    <Typography variant="caption" display="block">
                                      Maximum: {propDef.maximum}
                                    </Typography>
                                  )}
                                </Card>
                            ))}
                          </Box>
                        </Box>
                      ) : (
                        <Alert severity="info" sx={{ mb: 2 }}>
                          {tool.inputSchema ? 'This tool takes no parameters.' : 'Input schema not available.'}
                        </Alert>
                      )}
                      
                      <Divider sx={{ my: 2 }} />
                      
                      <Box sx={{ maxWidth: '100%', overflow: 'hidden' }}>
                        <Typography variant="subtitle2" gutterBottom>Usage Example:</Typography>
                        <Paper sx={{ 
                          p: 2, 
                          backgroundColor: 'grey.50',
                          maxWidth: '100%',
                          overflow: 'auto',
                          width: '100%',
                          boxSizing: 'border-box'
                        }}>
                          <Typography 
                            component="pre"
                            variant="body2" 
                            fontFamily="monospace" 
                            sx={{ 
                              whiteSpace: 'pre-wrap',
                              wordBreak: 'break-all',
                              fontSize: { xs: '0.75rem', sm: '0.875rem' },
                              margin: 0,
                              overflow: 'hidden',
                              maxWidth: '100%'
                            }}
                          >
                            {`// MCP Tool Call
{
  "method": "tools/call",
  "params": {
    "name": "${tool.name}",
    "arguments": {${tool.inputSchema?.properties && Object.keys(tool.inputSchema.properties).length > 0 ? `
      // Add required parameters here
      ${Object.entries(tool.inputSchema.properties)
        .filter(([name]) => tool.inputSchema?.required?.includes(name))
        .map(([name, def]: [string, any]) => `"${name}": ${def.type === 'string' ? '"example"' : def.type === 'number' ? '0' : def.type === 'boolean' ? 'true' : '{}'}`)
        .join(',\n      ')}` : ''}
    }
  }
}`}
                          </Typography>
                        </Paper>
                      </Box>
                    </Box>
                  </AccordionDetails>
                </Accordion>
              </Box>
            ))}
          </Box>
        </Box>
      ))}
    </Box>
  );
}

export default MCPTools;