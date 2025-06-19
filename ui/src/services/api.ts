import axios from 'axios';
import type { 
  HealthStatus, 
  Project, 
  Session, 
  Memory, 
  ThinkingSequence,
  EmbeddingModel,
  Analytics,
  SearchFilters,
  SearchResult,
  ProjectBrief,
  ProgressEntry,
  TaskItem
} from '../types';

// Use relative URL since UI is served from the same server
const API_BASE_URL = '';

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  }
});

// Add request interceptor for logging
api.interceptors.request.use(
  (config) => {
    console.log(`[API] ${config.method?.toUpperCase()} ${config.url}`, config.data);
    return config;
  },
  (error) => {
    console.error('[API] Request error:', error);
    return Promise.reject(error);
  }
);

// Add response interceptor for error handling
api.interceptors.response.use(
  (response) => {
    console.log(`[API] Response ${response.status}:`, response.data);
    return response;
  },
  (error) => {
    console.error('[API] Response error:', error.response?.status, error.response?.data || error.message);
    throw error;
  }
);

export class MiniMeAPI {
  // Health & Status
  async getHealth(): Promise<HealthStatus> {
    const response = await api.get('/health');
    return response.data;
  }

  async getMCPStatus() {
    const response = await api.get('/mcp/status');
    return response.data;
  }

  // Projects
  async getProjects(includeStats = true): Promise<{ projects: Project[]; count: number }> {
    const response = await api.get(`/api/projects?stats=${includeStats}`);
    return response.data;
  }

  async createProject(name: string, description?: string, settings?: Record<string, any>): Promise<{ project: Project }> {
    const response = await api.post('/api/projects', { name, description, settings });
    return response.data;
  }

  async updateProject(name: string, updates: { name?: string; description?: string; settings?: Record<string, any> }): Promise<{ project: Project }> {
    const response = await api.put(`/api/projects/${encodeURIComponent(name)}`, updates);
    return response.data;
  }

  async getProject(name: string): Promise<{ project: Project }> {
    const response = await api.get(`/api/projects/${encodeURIComponent(name)}`);
    return response.data;
  }

  // Sessions
  async getProjectSessions(projectName: string, activeOnly = false): Promise<{ sessions: Session[]; count: number }> {
    const response = await api.get(`/api/projects/${encodeURIComponent(projectName)}/sessions?active=${activeOnly}`);
    return response.data;
  }

  async createSession(
    projectName: string, 
    sessionName: string, 
    sessionType = 'mixed',
    description?: string,
    metadata?: Record<string, any>
  ): Promise<{ session: Session }> {
    const response = await api.post(`/api/projects/${encodeURIComponent(projectName)}/sessions`, {
      session_name: sessionName,
      session_type: sessionType,
      description,
      metadata,
    });
    return response.data;
  }

  // Memories
  async getProjectMemories(
    projectName: string,
    options: {
      session_name?: string;
      memory_type?: string;
      limit?: number;
      offset?: number;
      order_by?: string;
      order_direction?: 'ASC' | 'DESC';
    } = {}
  ): Promise<{ memories: Memory[]; count: number }> {
    const params = new URLSearchParams();
    Object.entries(options).forEach(([key, value]) => {
      if (value !== undefined) {
        params.append(key, String(value));
      }
    });
    
    const response = await api.get(`/api/projects/${encodeURIComponent(projectName)}/memories?${params}`);
    return response.data;
  }

  async searchMemories(
    query: string,
    filters: SearchFilters = {}
  ): Promise<SearchResult> {
    const params = new URLSearchParams();
    if (filters.memory_type) params.append('memory_type', filters.memory_type);
    if (filters.limit) params.append('limit', String(filters.limit));

    let endpoint: string;
    if (filters.project_name) {
      // Project-specific search
      if (query) params.append('q', query);
      endpoint = `/api/projects/${encodeURIComponent(filters.project_name)}/memories?${params}`;
    } else {
      // Cross-project search using the global endpoint
      if (query) params.append('search_query', query);
      endpoint = `/api/memories?${params}`;
    }

    const response = await api.get(endpoint);
    return {
      memories: response.data.memories,
      count: response.data.count,
      total: response.data.total || response.data.memories.length,
      query,
      filters,
    };
  }

  // Sequential Thinking
  async getProjectThinking(
    projectName: string,
    includeCompleted = true
  ): Promise<{ sequences: ThinkingSequence[]; count: number }> {
    const response = await api.get(`/api/projects/${encodeURIComponent(projectName)}/thinking?completed=${includeCompleted}`);
    return response.data;
  }

  async getThinkingSequence(
    sequenceId: number,
    options: {
      format?: string;
      branches?: boolean;
    } = {}
  ): Promise<{ sequence: ThinkingSequence }> {
    const params = new URLSearchParams();
    if (options.format) params.append('format', options.format);
    if (options.branches !== undefined) params.append('branches', String(options.branches));

    const response = await api.get(`/api/thinking/${sequenceId}?${params}`);
    return response.data;
  }

  // Embeddings
  async getEmbeddingModels(): Promise<{ models: EmbeddingModel[]; count: number }> {
    const response = await api.get('/api/embeddings/models');
    return response.data;
  }

  async generateEmbedding(text: string, model?: string): Promise<{
    embedding: number[];
    dimensions: number;
    model: string;
    provider: string;
  }> {
    const response = await api.post('/api/embeddings/generate', { text, model });
    return response.data;
  }

  async calculateSimilarity(textA: string, textB: string, model?: string): Promise<{
    similarity: number;
    textA: string;
    textB: string;
    model: string;
  }> {
    const response = await api.post('/api/embeddings/similarity', { textA, textB, model });
    return response.data;
  }

  // Analytics
  async getAnalytics(
    timeframe = '30 days',
    projectName?: string
  ): Promise<Analytics> {
    const params = new URLSearchParams();
    params.append('timeframe', timeframe);
    if (projectName) params.append('project_name', projectName);

    const response = await api.get(`/api/analytics?${params}`);
    return response.data;
  }

  // Time-series analytics
  async getTimeSeriesAnalytics(
    metric: string,
    projectName?: string,
    timeRange = '24 hours',
    granularity = 'minute'
  ): Promise<{ success: boolean; metric: string; project: string; timeRange: string; granularity: string; data: Array<{ time: string; value: any }> }> {
    const params = new URLSearchParams();
    params.append('metric', metric);
    params.append('timeRange', timeRange);
    params.append('granularity', granularity);
    if (projectName) params.append('project_name', projectName);

    const response = await api.get(`/api/analytics/timeseries?${params}`);
    return response.data;
  }

  // Dashboard analytics (multiple metrics combined)
  async getDashboardAnalytics(
    projectName?: string,
    timeRange = '24 hours'
  ): Promise<{ success: boolean; project: string; timeRange: string; dashboard: any }> {
    const params = new URLSearchParams();
    params.append('timeRange', timeRange);
    if (projectName) params.append('project_name', projectName);

    const response = await api.get(`/api/analytics/dashboard?${params}`);
    return response.data;
  }

  // Data Administration
  async deleteProjectData(projectName: string, dataType: 'memories'): Promise<{ stats: Record<string, number> }> {
    const response = await api.delete(`/api/projects/${encodeURIComponent(projectName)}/${dataType}`);
    return response.data;
  }

  async deleteProject(projectName: string): Promise<{ stats: Record<string, number> }> {
    const response = await api.delete(`/api/projects/${encodeURIComponent(projectName)}`);
    return response.data;
  }

  async deleteAllLearnings(): Promise<{ stats: Record<string, number> }> {
    const response = await api.delete('/api/learnings');
    return response.data;
  }

  async deleteAllData(): Promise<{ stats: Record<string, number> }> {
    const response = await api.delete('/api/data');
    return response.data;
  }

  // Meta-Learning & Patterns
  async getLearningInsights(options?: {
    category?: string;
    actionableOnly?: boolean;
    limit?: number;
  }): Promise<any> {
    const params = new URLSearchParams();
    if (options?.category) params.append('category', options.category);
    if (options?.actionableOnly) params.append('actionable_only', 'true');
    if (options?.limit) params.append('limit', String(options.limit));
    
    // Note: This endpoint may not exist yet - using mock data in component for now
    const response = await api.get(`/api/learning/insights?${params}`);
    return response.data;
  }

  async getCodingPatterns(options?: {
    category?: string;
    minConfidence?: number;
    limit?: number;
  }): Promise<any> {
    const params = new URLSearchParams();
    if (options?.category) params.append('category', options.category);
    if (options?.minConfidence) params.append('min_confidence', String(options.minConfidence));
    if (options?.limit) params.append('limit', String(options.limit));
    
    // Note: This endpoint may not exist yet - using mock data in component for now
    const response = await api.get(`/api/learning/patterns?${params}`);
    return response.data;
  }

  async getLearningStatus(): Promise<any> {
    // Note: This endpoint may not exist yet - using mock data in component for now
    const response = await api.get('/api/learning/status');
    return response.data;
  }

  async triggerLearningAnalysis(): Promise<any> {
    const response = await api.post('/api/learning/analyze');
    return response.data;
  }

  // Utility methods for UI
  async getSystemOverview() {
    const [health, projects, analytics] = await Promise.all([
      this.getHealth(),
      this.getProjects(true),
      this.getAnalytics('7 days'),
    ]);

    return {
      health,
      projects: projects.projects,
      projectCount: projects.count,
      analytics,
    };
  }

  async getProjectOverview(projectName: string) {
    const [project, sessions, memories, thinking] = await Promise.all([
      this.getProject(projectName),
      this.getProjectSessions(projectName),
      this.getProjectMemories(projectName, { limit: 10, order_by: 'created_at', order_direction: 'DESC' }),
      this.getProjectThinking(projectName),
    ]);

    return {
      project: project.project,
      sessions: sessions.sessions,
      recentMemories: memories.memories,
      thinkingSequences: thinking.sequences,
      stats: {
        sessionCount: sessions.count,
        memoryCount: memories.count,
        thinkingCount: thinking.count,
      },
    };
  }

  // Project Briefs
  async getProjectBriefs(projectName: string): Promise<{ briefs: ProjectBrief[] }> {
    // Use direct API endpoint for more reliable project brief fetching
    const response = await api.get(`/api/projects/${encodeURIComponent(projectName)}/memories?memory_type=project_brief`);
    
    // Transform memories to ProjectBrief format
    const memories = response.data.memories || [];
    
    const briefs = memories.map((memory: any) => ({
      id: memory.id,
      project_name: projectName,
      content: memory.content,
      sections: memory.tags?.filter((tag: string) => !['project_brief'].includes(tag)) || [],
      auto_tasks_created: memory.metadata?.auto_tasks_created || false,
      technical_analysis_included: memory.metadata?.technical_analysis_included || false,
      created_at: memory.created_at,
      updated_at: memory.updated_at
    }));

    return { briefs };
  }

  async createProjectBrief(
    projectName: string, 
    description: string, 
    options: {
      include_tasks?: boolean;
      include_technical_analysis?: boolean;
      sections?: string[];
    } = {}
  ): Promise<{ brief: ProjectBrief }> {
    const response = await api.post('/mcp', {
      method: 'tools/call',
      params: {
        name: 'create_project_brief',
        arguments: {
          project_name: projectName,
          project_description: description,
          include_tasks: options.include_tasks || true,
          include_technical_analysis: options.include_technical_analysis || true,
          sections: options.sections || ['planning', 'technical', 'progress']
        }
      }
    });

    // Extract the created brief from the response
    const content = response.data.result?.content?.[0]?.text || '';
    
    return {
      brief: {
        id: Date.now(), // Temporary ID
        project_name: projectName,
        content,
        sections: options.sections || ['planning', 'technical', 'progress'],
        auto_tasks_created: options.include_tasks || true,
        technical_analysis_included: options.include_technical_analysis || true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }
    };
  }

  // Progress Tracking
  async getProjectProgress(projectName: string): Promise<{ progress: ProgressEntry[] }> {
    try {
      // Get progress memories directly from the regular API
      const response = await this.getProjectMemories(projectName, {
        memory_type: 'progress',
        limit: 100,
        order_by: 'created_at',
        order_direction: 'DESC'
      });

      // Transform memories to ProgressEntry format
      const progress: ProgressEntry[] = response.memories.map((memory: any) => {
        const metadata = memory.metadata || {};
        
        return {
          id: memory.id,
          project_name: projectName,
          version: metadata.version || 'v1.0.0',
          progress_description: memory.content,
          milestone_type: metadata.milestone_type || memory.tags?.find((tag: string) => 
            ['feature', 'bugfix', 'deployment', 'planning', 'testing', 'documentation', 'refactor', 'optimization', 'release'].includes(tag)
          ) || 'feature',
          completion_percentage: metadata.completion_percentage || metadata.progress || 0,
          blockers: metadata.blockers || [],
          next_steps: metadata.next_steps || [],
          tags: memory.tags || [],
          created_at: memory.created_at,
          updated_at: memory.updated_at
        };
      });

      return { progress };
    } catch (error) {
      console.error('Failed to load progress:', error);
      return { progress: [] };
    }
  }

  async storeProgress(
    projectName: string,
    description: string,
    options: {
      version?: string;
      milestone_type?: string;
      completion_percentage?: number;
      blockers?: string[];
      next_steps?: string[];
      tags?: string[];
    } = {}
  ): Promise<{ progress: ProgressEntry }> {
    const response = await api.post('/mcp', {
      method: 'tools/call',
      params: {
        name: 'store_progress',
        arguments: {
          project_name: projectName,
          progress_description: description,
          version: options.version,
          milestone_type: options.milestone_type || 'feature',
          completion_percentage: options.completion_percentage,
          blockers: options.blockers || [],
          next_steps: options.next_steps || [],
          tags: options.tags || []
        }
      }
    });

    return {
      progress: {
        id: Date.now(),
        project_name: projectName,
        version: options.version || '1.0.0',
        progress_description: description,
        milestone_type: (options.milestone_type || 'feature') as any,
        completion_percentage: options.completion_percentage,
        blockers: options.blockers,
        next_steps: options.next_steps,
        tags: options.tags,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }
    };
  }

  // Task Management
  async getProjectTasks(projectName: string): Promise<{ tasks: TaskItem[] }> {
    const response = await api.get(`/api/projects/${encodeURIComponent(projectName)}/tasks`);
    
    if (!response.data.success) {
      throw new Error(response.data.error || 'Failed to fetch tasks');
    }
    
    // Transform database tasks to match UI TaskItem interface
    const transformedTasks: TaskItem[] = response.data.tasks.map((task: any) => ({
      id: task.id.toString(),
      title: task.title,
      description: task.description || '',
      category: task.type, // Database uses 'type', UI uses 'category'
      status: task.status,
      priority: {
        urgency: task.priority,
        impact: task.priority, // Using same priority for all fields for now
        effort: task.priority
      },
      estimated_hours: task.metadata?.estimated_hours || 8,
      tags: task.metadata?.tags || [],
      created_at: task.created_at,
      updated_at: task.updated_at
    }));
    
    return {
      tasks: transformedTasks
    };
  }

  async createTasks(
    projectName: string,
    tasks: Partial<TaskItem>[],
    sourceType: string = 'user_direct'
  ): Promise<{ tasks: TaskItem[] }> {
    await api.post('/mcp', {
      method: 'tools/call',
      params: {
        name: 'create_tasks',
        arguments: {
          project_name: projectName,
          source_type: sourceType,
          tasks: tasks.map(task => ({
            title: task.title,
            description: task.description,
            category: task.category,
            priority: task.priority,
            dependencies: task.dependencies,
            acceptance_criteria: task.acceptance_criteria,
            estimated_hours: task.estimated_hours,
            due_date: task.due_date,
            tags: task.tags
          }))
        }
      }
    });

    // Return the created tasks
    return {
      tasks: tasks.map((task, index) => ({
        id: `task-${Date.now()}-${index}`,
        title: task.title || 'Untitled Task',
        description: task.description,
        category: task.category || 'feature',
        status: 'pending' as const,
        priority: task.priority || {
          urgency: 'medium',
          impact: 'medium',
          effort: 'medium'
        },
        dependencies: task.dependencies,
        acceptance_criteria: task.acceptance_criteria,
        estimated_hours: task.estimated_hours,
        due_date: task.due_date,
        tags: task.tags,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }))
    };
  }

  async updateTask(taskId: string, updates: Partial<TaskItem>): Promise<{ task: TaskItem }> {
    await api.post('/mcp', {
      method: 'tools/call',
      params: {
        name: 'update_task',
        arguments: {
          task_id: taskId,
          status: updates.status,
          outcome: {
            summary: updates.description,
            lessons_learned: '',
            patterns_used: [],
            time_taken_hours: updates.estimated_hours
          }
        }
      }
    });

    // Return the updated task
    return {
      task: {
        id: taskId,
        title: updates.title || 'Updated Task',
        description: updates.description,
        category: updates.category || 'feature',
        status: updates.status || 'pending',
        priority: updates.priority || {
          urgency: 'medium',
          impact: 'medium',
          effort: 'medium'
        },
        dependencies: updates.dependencies,
        acceptance_criteria: updates.acceptance_criteria,
        estimated_hours: updates.estimated_hours,
        due_date: updates.due_date,
        tags: updates.tags,
        created_at: updates.created_at || new Date().toISOString(),
        updated_at: new Date().toISOString()
      }
    };
  }
}

export const miniMeAPI = new MiniMeAPI();