/**
 * MCP Tools Service for MiniMe-MCP
 * Manages outward-facing tools for MCP client discovery and execution
 * Compatible with Streamable HTTP transport (MCP SDK 1.12.3+)
 * 
 * Transport: Streamable HTTP at /mcp endpoint
 * Features: Session management, resumability, unified GET/POST
 */

import { getMemoryTypeImportance, getAllMemoryTypesArray } from '../constants/memory-types.js';

export class MCPToolsService {
    constructor(logger, dbPool, embeddingService, learningPipeline, sequentialThinkingService = null) {
        this.logger = logger;
        this.db = dbPool;
        this.embeddingService = embeddingService;
        this.learningPipeline = learningPipeline;
        this.sequentialThinking = sequentialThinkingService;
        
        // Debug mode - can be controlled by environment variable
        this.debugMode = process.env.MCP_DEBUG === 'true' || process.env.NODE_ENV !== 'production';
        
        if (this.debugMode) {
            this.logger.info('MCPToolsService initialized with debug mode enabled');
        }
    }
    
    _debugLog(toolName, stage, data = {}) {
        if (this.debugMode) {
            this.logger.debug(`[${toolName.toUpperCase()}] ${stage}:`, data);
        }
    }
    
    // Wrapper to add debugging and timeout to any tool method
    async _executeWithDebug(toolName, methodName, args, method) {
        this._debugLog(toolName, 'START', { args });
        const start = Date.now();
        
        // Add timeout protection (60 seconds per tool)
        const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => {
                reject(new Error(`Tool '${toolName}' timed out after 60 seconds`));
            }, 60000);
        });
        
        try {
            const result = await Promise.race([
                method.call(this, args),
                timeoutPromise
            ]);
            const duration = Date.now() - start;
            this._debugLog(toolName, 'COMPLETE', { 
                duration,
                hasResult: !!result,
                resultType: result?.content?.[0]?.type 
            });
            return result;
        } catch (error) {
            const duration = Date.now() - start;
            this._debugLog(toolName, 'ERROR', { 
                duration,
                error: error.message 
            });
            throw error;
        }
    }

    /**
     * Get all outward-facing tools for MCP discovery
     * These are the tools that external clients can discover and use
     */
    getPublicTools() {
        return [
            {
                name: "store_memory",
                description: "Store development information, code insights, decisions, and project context in a searchable knowledge base. Use memory_type='task' for actionable items needing completion tracking.",
                inputSchema: {
                    type: "object",
                    properties: {
                        content: {
                            type: "string",
                            description: "The content of the memory to store"
                        },
                        project_name: {
                            type: "string",
                            description: "Name of the project this memory belongs to (will be created if doesn't exist)"
                        },
                        session_name: {
                            type: "string",
                            description: "Name of the session within the project (optional)",
                            default: "default"
                        },
                        memory_type: {
                            type: "string",
                            enum: ["code", "decision", "insight", "general", "progress", "summary", "release_version", "prd", "bug", "project_brief", "product_context", "active_context", "system_patterns", "tech_context", "architecture", "requirements", "design_decisions", "implementation_notes", "lessons_learned", "task"],
                            description: "Type of memory - use 'general' for most content, 'code' for code snippets, 'decision' for decisions, 'task' for tasks",
                            default: "general"
                        },
                        importance_score: {
                            type: "number",
                            minimum: 0,
                            maximum: 1,
                            description: "Importance score from 0.0 to 1.0",
                            default: 0.5
                        },
                        tags: {
                            type: "array",
                            items: { type: "string" },
                            description: "Optional tags for categorization"
                        }
                    },
                    required: ["content", "project_name"]
                }
            },
            {
                name: "search_memories",
                description: "Search development history using AI-powered semantic search to find solutions, patterns, and past decisions. Example: search_memories(query=\"API rate limiting implementation\", memory_type=\"code\")",
                inputSchema: {
                    type: "object",
                    properties: {
                        query: {
                            type: "string",
                            description: "Search query text"
                        },
                        project_name: {
                            type: "string",
                            description: "Limit search to specific project (optional)"
                        },
                        memory_type: {
                            type: "string",
                            enum: ["code", "decision", "insight", "general", "progress", "summary", "release_version", "prd", "bug", "project_brief", "product_context", "active_context", "system_patterns", "tech_context", "architecture", "requirements", "design_decisions", "implementation_notes", "lessons_learned", "task"],
                            description: "Filter by memory type (optional)"
                        },
                        limit: {
                            type: "number",
                            minimum: 1,
                            maximum: 50,
                            default: 10,
                            description: "Maximum number of results to return"
                        },
                        min_similarity: {
                            type: "number",
                            minimum: 0,
                            maximum: 1,
                            default: 0.5,
                            description: "Minimum similarity threshold"
                        }
                    },
                    required: ["query"]
                }
            },
            {
                name: "manage_project_brief",
                description: "Create or update project briefs with intelligent analysis of PRD, architecture, tech context, and requirements. Auto-detects if brief exists and handles creation/updates intelligently.",
                inputSchema: {
                    type: "object",
                    properties: {
                        project_name: {
                            type: "string",
                            description: "Name of the project to create or update brief for"
                        },
                        project_description: {
                            type: "string",
                            description: "Project description (required for new briefs, optional for updates)"
                        },
                        input_documents: {
                            type: "object",
                            description: "Raw documents to intelligently analyze and incorporate",
                            properties: {
                                prd: { type: "string", description: "Product Requirements Document content" },
                                architecture_doc: { type: "string", description: "Architecture documentation" },
                                tech_spec: { type: "string", description: "Technical specifications" },
                                requirements: { type: "string", description: "Requirements document" },
                                design_doc: { type: "string", description: "Design documentation" }
                            }
                        },
                        include_tasks: {
                            type: "boolean",
                            default: true,
                            description: "Whether to automatically create tasks from the brief"
                        },
                        sections_to_update: {
                            type: "array",
                            items: {
                                type: "string",
                                enum: ["planning", "technical", "progress", "requirements", "architecture", "timeline", "risks", "all"]
                            },
                            default: ["all"],
                            description: "Which sections to regenerate/update. Use 'all' to update entire brief."
                        },
                        section_updates: {
                            type: "object",
                            description: "Specific content updates for individual sections (optional)",
                            properties: {
                                planning: { type: "string", description: "Updated planning content" },
                                technical: { type: "string", description: "Updated technical content" },
                                requirements: { type: "string", description: "Updated requirements content" },
                                architecture: { type: "string", description: "Updated architecture content" },
                                timeline: { type: "string", description: "Updated timeline content" },
                                risks: { type: "string", description: "Updated risks content" }
                            }
                        },
                        update_reason: {
                            type: "string",
                            description: "Reason for the update (e.g., 'Architecture change', 'New requirements', 'Technology pivot')"
                        },
                        include_technical_analysis: {
                            type: "boolean",
                            default: true,
                            description: "Whether to include updated technology recommendations"
                        },
                        preserve_history: {
                            type: "boolean",
                            default: true,
                            description: "Whether to keep the previous version as historical record"
                        },
                        update_related_memories: {
                            type: "boolean",
                            default: false,
                            description: "Whether to also update related memory types (PRD, product_context, summary, system_patterns)"
                        },
                        related_memory_updates: {
                            type: "object",
                            description: "Specific updates for related memory types",
                            properties: {
                                prd: { type: "string", description: "Updated Product Requirements Document content" },
                                product_context: { type: "string", description: "Updated product context information" },
                                summary: { type: "string", description: "Updated project summary" },
                                system_patterns: { type: "string", description: "Updated system architecture patterns" },
                                tech_context: { type: "string", description: "Updated technical context" }
                            }
                        }
                    },
                    required: ["project_name"]
                }
            },
            {
                name: "store_progress", 
                description: "Record project milestones, version updates, and completion status with automatic versioning and analytics. Creates timeline of project evolution.",
                inputSchema: {
                    type: "object",
                    properties: {
                        project_name: {
                            type: "string",
                            description: "Name of the project"
                        },
                        progress_description: {
                            type: "string", 
                            description: "What was accomplished or current status"
                        },
                        version: {
                            type: "string",
                            description: "Version number (e.g., '1.0.0', '0.2.1') - auto-incremented from last progress entry if not provided"
                        },
                        milestone_type: {
                            type: "string",
                            enum: ["feature", "bugfix", "deployment", "planning", "testing", "documentation", "refactor", "optimization", "release"],
                            default: "feature",
                            description: "Type of progress/milestone"
                        },
                        completion_percentage: {
                            type: "number",
                            minimum: 0,
                            maximum: 100,
                            description: "Overall project completion percentage"
                        },
                        blockers: {
                            type: "array",
                            items: { type: "string" },
                            description: "Current blockers or issues"
                        },
                        next_steps: {
                            type: "array", 
                            items: { type: "string" },
                            description: "Planned next steps"
                        },
                        tags: {
                            type: "array",
                            items: { type: "string" },
                            description: "Tags for categorization"
                        }
                    },
                    required: ["project_name", "progress_description"]
                }
            },
            {
                name: "get_progress_history",
                description: "Generate comprehensive project status reports with trends, analytics, and completion velocity patterns for specified projects.",
                inputSchema: {
                    type: "object",
                    properties: {
                        project_name: {
                            type: "string",
                            description: "Name of the project"
                        },
                        version_filter: {
                            type: "string",
                            description: "Filter by specific version (e.g., '1.x', '2.0.0')"
                        },
                        milestone_filter: {
                            type: "string",
                            enum: ["feature", "bugfix", "deployment", "planning", "testing", "documentation", "refactor", "optimization", "release"],
                            description: "Filter by milestone type"
                        },
                        days_back: {
                            type: "number",
                            default: 30,
                            description: "How many days of history to show"
                        },
                        include_analytics: {
                            type: "boolean",
                            default: true,
                            description: "Include progress analytics and trends"
                        }
                    },
                    required: ["project_name"]
                }
            },
            {
                name: "get_memory_by_id",
                description: "Get exact memory details by ID with full content, metadata, and optional embedding vectors for precise retrieval.",
                inputSchema: {
                    type: "object",
                    properties: {
                        memory_id: {
                            type: "number",
                            description: "The unique ID of the memory to retrieve"
                        },
                        include_embedding: {
                            type: "boolean",
                            default: false,
                            description: "Whether to include the embedding vector in response"
                        }
                    },
                    required: ["memory_id"]
                }
            },
            {
                name: "get_coding_patterns",
                description: "Discover proven coding patterns with usage analytics, success rates, and detailed examples across architectural, structural, and behavioral categories.",
                inputSchema: {
                    type: "object",
                    properties: {
                        pattern_category: {
                            type: "string",
                            enum: ["architectural", "creational", "structural", "behavioral", "concurrency", 
                                   "data_processing", "api_patterns", "messaging", "database", "distributed",
                                   "security", "performance", "error_handling", "testing", "frontend", 
                                   "mobile", "devops", "code_organization", "process_methodology", 
                                   "cloud_platforms", "data_engineering", "algorithms", "reliability",
                                   "observability", "deployment", "programming_paradigms", "network_protocols",
                                   "user_experience", "quality_assurance", "infrastructure_ops"],
                            description: "Category of patterns to filter by (optional)"
                        },
                        pattern_type: {
                            type: "string",
                            description: "Specific pattern type (e.g., 'singleton', 'mvc', 'pub_sub'). See documentation for full list"
                        },
                        language: {
                            type: "string",
                            description: "Programming language filter (optional)"
                        },
                        min_confidence: {
                            type: "number",
                            minimum: 0,
                            maximum: 1,
                            default: 0.6,
                            description: "Minimum confidence score"
                        },
                        min_frequency: {
                            type: "number",
                            minimum: 1,
                            default: 2,
                            description: "Minimum frequency across projects"
                        },
                        limit: {
                            type: "number",
                            minimum: 1,
                            maximum: 50,
                            default: 15,
                            description: "Maximum number of patterns"
                        }
                    }
                }
            },
            {
                name: "start_thinking_sequence",
                description: "Break down complex technical problems into sequential, logical thought processes for architecture decisions, problem analysis, and strategic planning.",
                inputSchema: {
                    type: "object",
                    properties: {
                        project_name: {
                            type: "string",
                            description: "Name of the project for this thinking sequence"
                        },
                        session_name: {
                            type: "string",
                            description: "Name of the session within the project",
                            default: "default"
                        },
                        sequence_name: {
                            type: "string",
                            description: "Name for this thinking sequence"
                        },
                        description: {
                            type: "string",
                            description: "Description of what this thinking sequence is about (optional)"
                        },
                        goal: {
                            type: "string",
                            description: "The goal or objective of this reasoning process (optional)"
                        },
                        initial_thought: {
                            type: "string",
                            description: "The first thought to start the reasoning process (optional)"
                        },
                        estimated_thoughts: {
                            type: "number",
                            minimum: 1,
                            maximum: 50,
                            default: 10,
                            description: "Estimated number of thoughts this sequence will need"
                        }
                    },
                    required: ["project_name", "sequence_name"]
                }
            },
            {
                name: "add_thought",
                description: "Add structured thoughts to ongoing analysis with confidence tracking. If sequence_id is invalid/missing and project context provided, creates new sequence automatically.",
                inputSchema: {
                    type: "object",
                    properties: {
                        sequence_id: {
                            type: "number",
                            description: "ID of the thinking sequence to add to (if invalid and project provided, creates new sequence)"
                        },
                        project_name: {
                            type: "string",
                            description: "Project name (used to create new sequence if sequence_id invalid)"
                        },
                        sequence_name: {
                            type: "string",
                            description: "Name for new sequence (used if sequence_id invalid and project provided)"
                        },
                        goal: {
                            type: "string", 
                            description: "Goal for new sequence (used if creating new sequence)"
                        },
                        content: {
                            type: "string",
                            description: "The content of the thought"
                        },
                        thought_type: {
                            type: "string",
                            enum: ["reasoning", "conclusion", "question", "hypothesis", "observation", "assumption"],
                            default: "reasoning",
                            description: "Type of thought being added"
                        },
                        confidence_level: {
                            type: "number",
                            minimum: 0,
                            maximum: 1,
                            default: 0.5,
                            description: "Confidence level in this thought (0.0 to 1.0)"
                        },
                        next_thought_needed: {
                            type: "boolean",
                            default: true,
                            description: "Whether more thoughts are expected after this one"
                        }
                    },
                    required: ["content"]
                }
            },
            {
                name: "get_thinking_sequence",
                description: "Get complete thought processes with branching logic and decision trails in detailed, summary, or linear formats.",
                inputSchema: {
                    type: "object",
                    properties: {
                        sequence_id: {
                            type: "number",
                            description: "ID of the thinking sequence to retrieve"
                        },
                        format: {
                            type: "string",
                            enum: ["detailed", "summary", "linear"],
                            default: "detailed",
                            description: "Format for returning the sequence"
                        },
                        include_branches: {
                            type: "boolean",
                            default: true,
                            description: "Include alternative reasoning branches"
                        }
                    },
                    required: ["sequence_id"]
                }
            },
            {
                name: "list_thinking_sequences",
                description: "Browse all reasoning processes and decisions for a project with chronological timeline and completion status filtering.",
                inputSchema: {
                    type: "object",
                    properties: {
                        project_name: {
                            type: "string",
                            description: "Name of the project to list sequences for"
                        },
                        include_completed: {
                            type: "boolean",
                            default: true,
                            description: "Include completed sequences in the results"
                        },
                        limit: {
                            type: "number",
                            minimum: 1,
                            maximum: 100,
                            default: 20,
                            description: "Maximum number of sequences to return"
                        }
                    },
                    required: ["project_name"]
                }
            },
            {
                name: "complete_thinking_sequence",
                description: "Complete reasoning processes with executive summaries, key assumptions, action items, and next steps extracted automatically.",
                inputSchema: {
                    type: "object",
                    properties: {
                        sequence_id: {
                            type: "number",
                            description: "ID of the thinking sequence to complete"
                        },
                        completion_summary: {
                            type: "string",
                            description: "Optional summary of the completed reasoning process"
                        }
                    },
                    required: ["sequence_id"]
                }
            },
            {
                name: "create_tasks",
                description: "Convert project requirements and ideas into structured, actionable tasks with automatic prioritization and dependency analysis.",
                inputSchema: {
                    type: "object",
                    properties: {
                        project_name: {
                            type: "string",
                            description: "Project to create tasks for"
                        },
                        source_type: {
                            type: "string",
                            enum: ["user_direct", "project_brief", "prd", "ai_suggested", "requirements"],
                            description: "Source of the tasks"
                        },
                        source_memory_id: {
                            type: "string",
                            description: "Memory ID to extract tasks from (for non-direct sources)"
                        },
                        tasks: {
                            type: "array",
                            description: "Array of tasks to create",
                            items: {
                                type: "object",
                                properties: {
                                    title: { type: "string" },
                                    description: { type: "string" },
                                    category: {
                                        type: "string",
                                        enum: ["feature", "bug", "refactor", "optimization", "documentation", "testing"]
                                    },
                                    priority: {
                                        type: "object",
                                        properties: {
                                            urgency: { enum: ["low", "medium", "high", "critical"] },
                                            impact: { enum: ["low", "medium", "high"] },
                                            effort: { enum: ["low", "medium", "high"] }
                                        }
                                    },
                                    dependencies: {
                                        type: "array",
                                        items: { type: "string" },
                                        description: "Task IDs or titles this depends on"
                                    },
                                    acceptance_criteria: {
                                        type: "array",
                                        items: { type: "string" }
                                    },
                                    estimated_hours: { type: "number" },
                                    due_date: { type: "string", format: "date" },
                                    tags: { type: "array", items: { type: "string" } }
                                },
                                required: ["title", "category"]
                            }
                        },
                        auto_extract: {
                            type: "boolean",
                            default: false,
                            description: "Automatically extract tasks from source memory"
                        }
                    },
                    required: ["project_name", "source_type"]
                }
            },
            {
                name: "get_pending_tasks",
                description: "Get pending tasks in priority order (up to 10) with execution context, relevant memories, and intelligent prioritization.",
                inputSchema: {
                    type: "object",
                    properties: {
                        project_name: {
                            type: "string",
                            description: "Project to get tasks from"
                        },
                        limit: {
                            type: "number",
                            default: 10,
                            minimum: 1,
                            maximum: 50,
                            description: "Maximum number of pending tasks to return (default: 10)"
                        },
                        include_context: {
                            type: "boolean",
                            default: true,
                            description: "Include relevant memories for task execution"
                        },
                        task_type_filter: {
                            type: "string",
                            enum: ["feature", "bug", "refactor", "optimization", "documentation", "testing"],
                            description: "Filter by task type"
                        }
                    },
                    required: ["project_name"]
                }
            },
            {
                name: "update_task",
                description: "Update task status while capturing valuable learning data including time estimates, patterns used, and lessons learned.",
                inputSchema: {
                    type: "object",
                    properties: {
                        task_id: { 
                            type: "string",
                            description: "The memory ID of the task to update (returned when task was created via store_memory or create_tasks). Must be a numeric string (e.g., '123')."
                        },
                        status: {
                            type: "string",
                            enum: ["pending", "in_progress", "completed", "blocked"]
                        },
                        outcome: {
                            type: "object",
                            properties: {
                                summary: { type: "string" },
                                lessons_learned: { type: "string" },
                                patterns_used: { type: "array" },
                                time_taken_hours: { type: "number" }
                            }
                        }
                    },
                    required: ["task_id", "status"]
                }
            },
            {
                name: "get_learning_insights",
                description: "Discover patterns and insights from development history showing best practices, anti-patterns to avoid, technology preferences, and actionable improvements.",
                inputSchema: {
                    type: "object",
                    properties: {
                        project_name: {
                            type: "string",
                            description: "Filter insights by project (optional)"
                        },
                        insight_type: {
                            type: "string",
                            enum: ["best_practice", "anti_pattern", "technology_preference", "evolution", "team_pattern", "productivity", "quality_metric"],
                            description: "Type of insights to retrieve (optional)"
                        },
                        min_confidence: {
                            type: "number",
                            minimum: 0,
                            maximum: 1,
                            default: 0.6,
                            description: "Minimum confidence level"
                        },
                        actionable_only: {
                            type: "boolean",
                            default: false,
                            description: "Return only actionable insights"
                        },
                        limit: {
                            type: "number",
                            minimum: 1,
                            maximum: 100,
                            default: 20,
                            description: "Maximum number of insights"
                        }
                    }
                }
            },
            {
                name: "get_pattern_analysis",
                description: "Advanced analytics on coding patterns with success metrics, evolution tracking, and usage frequency across architectural, design, security, and performance categories.",
                inputSchema: {
                    type: "object",
                    properties: {
                        project_name: {
                            type: "string",
                            description: "Filter patterns by project (optional)"
                        },
                        pattern_category: {
                            type: "string",
                            enum: ["architectural", "design", "security", "performance", "testing", "error_handling", "data_access", "api_design", "configuration"],
                            description: "Category of patterns to analyze"
                        },
                        time_range: {
                            type: "string",
                            enum: ["7days", "30days", "90days", "all"],
                            default: "30days",
                            description: "Time range for pattern analysis"
                        },
                        include_examples: {
                            type: "boolean",
                            default: true,
                            description: "Include code examples in results"
                        },
                        min_confidence: {
                            type: "number",
                            minimum: 0,
                            maximum: 1,
                            default: 0.5,
                            description: "Minimum confidence threshold"
                        }
                    }
                }
            },
            {
                name: "analyze_pattern_outcomes",
                description: "Analyze correlations between coding patterns and project outcomes using AI to identify which patterns lead to success or failure.",
                inputSchema: {
                    type: "object",
                    properties: {
                        project_name: {
                            type: "string",
                            description: "Filter analysis to specific project (optional)"
                        },
                        time_range: {
                            type: "string",
                            default: "90 days",
                            description: "Time range for outcome analysis (e.g., '30 days', '90 days')"
                        },
                        pattern_category: {
                            type: "string",
                            enum: ["architectural", "design", "security", "performance", "testing", "error_handling", "data_access", "api_design", "configuration"],
                            description: "Filter by pattern category (optional)"
                        },
                        min_sample_size: {
                            type: "number",
                            minimum: 2,
                            default: 3,
                            description: "Minimum number of outcomes required for correlation analysis"
                        }
                    }
                }
            },
            {
                name: "record_pattern_outcome",
                description: "Record the outcome of a coding pattern when project milestones or events occur to build correlation data.",
                inputSchema: {
                    type: "object",
                    properties: {
                        project_name: {
                            type: "string",
                            description: "Name of the project"
                        },
                        pattern_name: {
                            type: "string",
                            description: "Name of the coding pattern that had an outcome"
                        },
                        outcome_type: {
                            type: "string",
                            enum: ["success", "failure", "neutral", "bug", "performance_gain"],
                            description: "Type of outcome observed"
                        },
                        outcome_description: {
                            type: "string",
                            description: "Description of what happened"
                        },
                        outcome_value: {
                            type: "number",
                            description: "Numeric value if applicable (e.g., performance improvement %)"
                        },
                        metrics: {
                            type: "object",
                            description: "Additional metrics related to the outcome"
                        }
                    },
                    required: ["project_name", "pattern_name", "outcome_type", "outcome_description"]
                }
            },
            {
                name: "trigger_outcome_analysis",
                description: "Trigger pattern-outcome correlation analysis for project events like deployments, bug reports, or completions.",
                inputSchema: {
                    type: "object",
                    properties: {
                        project_name: {
                            type: "string",
                            description: "Name of the project"
                        },
                        event_type: {
                            type: "string",
                            enum: ["project_completion", "deployment_success", "bug_report", "major_bug", "performance_improvement", "refactor_completion", "test_failure", "security_issue"],
                            description: "Type of project event that occurred"
                        },
                        event_description: {
                            type: "string",
                            description: "Description of the event"
                        },
                        event_data: {
                            type: "object",
                            description: "Additional data about the event (metrics, impact, etc.)"
                        }
                    },
                    required: ["project_name", "event_type", "event_description"]
                }
            },
        ];
    }

    /**
     * Execute a tool by name with given arguments
     * This is the main dispatcher for tool execution
     */
    async executeTool(toolName, args) {
        const executionStart = Date.now();
        this._debugLog(toolName, 'EXECUTION_START', { 
            args: args ? Object.keys(args) : [],
            timestamp: new Date().toISOString()
        });
        
        this.logger.info(`Executing tool: ${toolName}`, { 
            hasArgs: !!args,
            argKeys: args ? Object.keys(args) : []
        });

        // Validate tool exists
        const availableTools = this.getPublicTools().map(t => t.name);
        if (!availableTools.includes(toolName)) {
            this._debugLog(toolName, 'VALIDATION_FAILED', { availableTools });
            return {
                content: [{ 
                    type: "text", 
                    text: `[TOOL_NOT_FOUND] Tool '${toolName}' is not available. Available tools: ${availableTools.join(', ')}. (Do not retry)` 
                }],
                isError: true,
                errorCode: 'TOOL_NOT_FOUND',
                retryable: false
            };
        }
        
        this._debugLog(toolName, 'VALIDATION_PASSED');

        // Check database availability for tools that need it
        const databaseTools = [
            'store_memory', 'search_memories', 'get_memory_by_id', 'manage_project_brief', 'store_progress', 'get_progress_history', 'get_coding_patterns',
            'start_thinking_sequence', 'add_thought', 'get_thinking_sequence', 
            'list_thinking_sequences', 'complete_thinking_sequence', 'create_tasks',
            'get_pending_tasks', 'update_task', 'get_learning_insights',
            'get_pattern_analysis', 'analyze_pattern_outcomes', 'record_pattern_outcome', 'trigger_outcome_analysis'
        ];
        
        if (databaseTools.includes(toolName)) {
            this._debugLog(toolName, 'DB_CHECK', { 
                hasDb: !!this.db,
                hasPool: !!(this.db && this.db.pool),
                isDbTool: true
            });
            
            if (!this.db || !this.db.pool) {
                this._debugLog(toolName, 'DB_UNAVAILABLE');
                return {
                    content: [{ 
                        type: "text", 
                        text: `[SERVICE_UNAVAILABLE] Database service is unavailable for tool '${toolName}'. Please check database connection and try again. (Retryable)` 
                    }],
                    isError: true,
                    errorCode: 'SERVICE_UNAVAILABLE',
                    retryable: true
                };
            }
        }

        try {
            this._debugLog(toolName, 'DISPATCHING');
            let result;
            
            switch (toolName) {
                case "store_memory":
                    this._debugLog(toolName, 'CALLING_STORE_MEMORY', { 
                        content_length: args?.content?.length,
                        project_name: args?.project_name 
                    });
                    result = await this._executeWithDebug('store_memory', '_storeMemory', args, this._storeMemory);
                    break;
                case "search_memories":
                    result = await this._executeWithDebug('search_memories', '_searchMemories', args, this._searchMemories);
                    break;
                case "get_memory_by_id":
                    result = await this._executeWithDebug('get_memory_by_id', '_getMemoryById', args, this._getMemoryById);
                    break;
                case "manage_project_brief":
                    result = await this._executeWithDebug('manage_project_brief', '_manageProjectBrief', args, this._manageProjectBrief);
                    break;
                case "store_progress":
                    result = await this._executeWithDebug('store_progress', '_storeProgress', args, this._storeProgress);
                    break;
                case "get_progress_history":
                    result = await this._executeWithDebug('get_progress_history', '_getProgressHistory', args, this._getProgressHistory);
                    break;
                case "get_coding_patterns":
                    result = await this._executeWithDebug('get_coding_patterns', '_getCodingPatterns', args, this._getCodingPatterns);
                    break;
                case "start_thinking_sequence":
                    result = await this._executeWithDebug('start_thinking_sequence', '_startThinkingSequence', args, this._startThinkingSequence);
                    break;
                case "add_thought":
                    result = await this._executeWithDebug('add_thought', '_addThought', args, this._addThought);
                    break;
                case "get_thinking_sequence":
                    result = await this._executeWithDebug('get_thinking_sequence', '_getThinkingSequence', args, this._getThinkingSequence);
                    break;
                case "list_thinking_sequences":
                    result = await this._executeWithDebug('list_thinking_sequences', '_listThinkingSequences', args, this._listThinkingSequences);
                    break;
                case "complete_thinking_sequence":
                    result = await this._executeWithDebug('complete_thinking_sequence', '_completeThinkingSequence', args, this._completeThinkingSequence);
                    break;
                case "create_tasks":
                    result = await this._executeWithDebug('create_tasks', '_createTasks', args, this._createTasks);
                    break;
                case "get_pending_tasks":
                    result = await this._executeWithDebug('get_pending_tasks', '_getPendingTasks', args, this._getPendingTasks);
                    break;
                case "update_task":
                    result = await this._executeWithDebug('update_task', '_updateTask', args, this._updateTask);
                    break;
                case "get_learning_insights":
                    result = await this._executeWithDebug('get_learning_insights', '_getLearningInsights', args, this._getLearningInsights);
                    break;
                case "get_pattern_analysis":
                    result = await this._executeWithDebug('get_pattern_analysis', '_getPatternAnalysis', args, this._getPatternAnalysis);
                    break;
                case "analyze_pattern_outcomes":
                    result = await this._executeWithDebug('analyze_pattern_outcomes', '_analyzePatternOutcomes', args, this._analyzePatternOutcomes);
                    break;
                case "record_pattern_outcome":
                    result = await this._executeWithDebug('record_pattern_outcome', '_recordPatternOutcome', args, this._recordPatternOutcome);
                    break;
                case "trigger_outcome_analysis":
                    result = await this._executeWithDebug('trigger_outcome_analysis', '_triggerOutcomeAnalysis', args, this._triggerOutcomeAnalysis);
                    break;
                default:
                    this._debugLog(toolName, 'UNKNOWN_TOOL');
                    throw new Error(`TOOL_NOT_FOUND: Unknown tool: ${toolName}`);
            }
            
            const duration = Date.now() - executionStart;
            this._debugLog(toolName, 'EXECUTION_COMPLETE', { 
                duration,
                hasResult: !!result,
                resultType: result?.content?.[0]?.type,
                isError: result?.isError
            });
            
            this.logger.info(`Tool execution completed: ${toolName} (${duration}ms)`, {
                success: !result?.isError,
                resultType: result?.content?.[0]?.type
            });
            
            return result;
        } catch (error) {
            const duration = Date.now() - executionStart;
            this._debugLog(toolName, 'EXECUTION_FAILED', { 
                duration,
                error: error.message,
                stack: this.debugMode ? error.stack : undefined
            });
            
            this.logger.error(`Tool execution failed: ${toolName} (${duration}ms)`, {
                error: error.message,
                stack: error.stack
            });
            
            // Categorize errors for better agent handling
            let errorCode = 'EXECUTION_ERROR';
            let retryable = false;
            let message = error.message;
            
            if (error.message.includes('required') || error.message.includes('validation')) {
                errorCode = 'INVALID_PARAMETERS';
                retryable = false;
                message = `Invalid parameters: ${error.message}`;
            } else if (error.message.includes('ECONNREFUSED') || error.message.includes('database')) {
                errorCode = 'SERVICE_UNAVAILABLE';
                retryable = true;
                message = 'Database connection failed. Please try again.';
            } else if (error.message.includes('timeout')) {
                errorCode = 'TIMEOUT';
                retryable = true;
                message = 'Operation timed out. Please try again.';
            } else if (error.message.includes('not found')) {
                errorCode = 'NOT_FOUND';
                retryable = false;
                message = error.message;
            }
            
            return {
                content: [{ 
                    type: "text", 
                    text: `[${errorCode}] Error executing ${toolName}: ${message} ${retryable ? '(Retryable)' : '(Do not retry)'}` 
                }],
                isError: true,
                errorCode,
                retryable
            };
        }
    }

    /**
     * PRIVATE TOOL IMPLEMENTATIONS
     * These are not exposed in MCP discovery but handle the actual tool logic
     */

    async _storeMemory(args) {
        this._debugLog('store_memory', 'START', { args });
        
        const { 
            content, 
            project_name, 
            session_name = "default", 
            memory_type = "general",
            importance_score,
            tags = []
        } = args;

        this._debugLog('store_memory', 'PARAMS_PARSED', { 
            content_length: content?.length,
            project_name,
            session_name,
            memory_type,
            importance_score,
            tags_count: tags?.length
        });

        // Use default importance score for Memory Bank types if not provided
        const finalImportanceScore = importance_score !== undefined 
            ? importance_score 
            : getMemoryTypeImportance(memory_type);

        this._debugLog('store_memory', 'IMPORTANCE_CALCULATED', { finalImportanceScore });

        // Get or create project
        this._debugLog('store_memory', 'GETTING_PROJECT');
        const project = await this._getOrCreateProject(project_name);
        this._debugLog('store_memory', 'PROJECT_OBTAINED', { project_id: project.id });
        
        // Get or create session
        this._debugLog('store_memory', 'GETTING_SESSION');
        const session = await this._getOrCreateSession(project.id, session_name);
        this._debugLog('store_memory', 'SESSION_OBTAINED', { session_id: session.id });

        // Generate embedding
        this._debugLog('store_memory', 'GENERATING_EMBEDDING');
        const embedding = await this.embeddingService.generateEmbedding(content);
        this._debugLog('store_memory', 'EMBEDDING_GENERATED', { 
            embedding_length: embedding?.length,
            embedding_sample: this.debugMode ? embedding?.slice(0, 5) : undefined
        });
        
        const defaultModel = await this.embeddingService.getDefaultModel();
        const modelConfig = await this.embeddingService.getModelConfig(defaultModel);
        this._debugLog('store_memory', 'MODEL_CONFIG', { 
            model_name: modelConfig.model_name,
            embedding_dimensions: embedding.length 
        });

        // Store as memory (including task-type memories with metadata)
        this._debugLog('store_memory', 'STORING_TO_DB');
        let result, memoryId;
        
        // Prepare task-specific metadata if this is a task-type memory
        let metadata = {};
        if (memory_type === 'task') {
            const taskDetails = this._parseTaskContent(content);
            this._debugLog('store_memory', 'PARSED_TASK_DETAILS', taskDetails);
            
            // Enrich metadata with task-specific fields
            metadata = {
                status: taskDetails.status || 'pending',
                priority: taskDetails.priority || 'medium',
                task_type: taskDetails.type || 'task',
                estimated_effort: taskDetails.estimated_hours || null,
                actual_effort: null,
                completed_at: null,
                // Additional metadata
                embedding_model: modelConfig.model_name,
                embedding_dimensions: embedding.length,
                importance_score: finalImportanceScore,
                session_id: session.id
            };
        }
        
        // Store as memory with optional metadata
        result = await this.db.query(`
            INSERT INTO memories 
            (project_id, session_id, content, memory_type, embedding, 
             embedding_model, embedding_dimensions, importance_score, tags, metadata)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
            RETURNING id, created_at
        `, [
            project.id,
            session.id,
            content,
            memory_type,
            JSON.stringify(embedding),
            modelConfig.model_name,
            embedding.length,
            finalImportanceScore,
            tags,
            JSON.stringify(metadata)
        ]);

        memoryId = result.rows[0].id;
        this._debugLog('store_memory', 'MEMORY_CREATED', { 
            memory_id: memoryId,
            memory_type,
            has_metadata: Object.keys(metadata).length > 0
        });

        // Trigger learning pipeline (real-time processing)
        this._debugLog('store_memory', 'TRIGGERING_LEARNING');
        if (this.learningPipeline) {
            try {
                await this.learningPipeline.onMemoryAdded(memoryId, project.id, content);
                this._debugLog('store_memory', 'LEARNING_PIPELINE_COMPLETE');
            } catch (error) {
                this._debugLog('store_memory', 'LEARNING_PIPELINE_ERROR', { error: error.message });
                this.logger.warn('Learning pipeline error (non-critical):', error.message);
            }
        } else {
            this._debugLog('store_memory', 'LEARNING_PIPELINE_UNAVAILABLE');
        }

        // Check for critical patterns and trigger event-driven learning
        this._debugLog('store_memory', 'CHECKING_CRITICAL_PATTERNS');
        try {
            const memoryForPatternCheck = {
                id: memoryId,
                project_id: project.id,
                memory_type: memory_type,
                importance_score: finalImportanceScore,
                tags: tags,
                content: content
            };
            
            // Call the global critical pattern checker (if available)
            if (global.checkCriticalPatterns && typeof global.checkCriticalPatterns === 'function') {
                await global.checkCriticalPatterns(memoryForPatternCheck);
                this._debugLog('store_memory', 'CRITICAL_PATTERN_CHECK_COMPLETE');
            }
        } catch (error) {
            this._debugLog('store_memory', 'CRITICAL_PATTERN_CHECK_ERROR', { error: error.message });
            this.logger.warn('Critical pattern check error (non-critical):', error.message);
        }

        this._debugLog('store_memory', 'COMPLETE', { 
            memory_id: memoryId,
            project: project_name,
            session: session_name 
        });

        // Generate appropriate response message
        let responseText;
        if (memory_type === 'task') {
            responseText = `Task stored successfully!\n\nDetails:\n- Memory ID: ${memoryId}\n- Project: ${project_name}\n- Session: ${session_name}\n- Type: ${memory_type}\n- Status: ${metadata.status}\n- Priority: ${metadata.priority}\n- Task Type: ${metadata.task_type}\n- Importance: ${finalImportanceScore}\n- Embedding dimensions: ${embedding.length}\n- Created: ${result.rows[0].created_at}\n\n✅ Task is now trackable via task management tools and searchable via semantic search.\n🧠 Task will be analyzed by the learning system for pattern insights.`;
        } else {
            responseText = `Memory stored successfully!\n\nDetails:\n- Memory ID: ${memoryId}\n- Project: ${project_name}\n- Session: ${session_name}\n- Type: ${memory_type}\n- Importance: ${finalImportanceScore}\n- Embedding dimensions: ${embedding.length}\n- Created: ${result.rows[0].created_at}`;
        }

        return {
            content: [{
                type: "text",
                text: responseText
            }]
        };
    }

    async _searchMemories(args) {
        this._debugLog('search_memories', 'START', { args });
        
        const { 
            query, 
            project_name, 
            memory_type, 
            limit = 10, 
            min_similarity = 0.5 
        } = args;

        this._debugLog('search_memories', 'PARAMS_PARSED', { 
            query_length: query?.length,
            project_name,
            memory_type,
            limit,
            min_similarity
        });

        // Generate query embedding
        this._debugLog('search_memories', 'GENERATING_QUERY_EMBEDDING');
        const queryEmbedding = await this.embeddingService.generateEmbedding(query);
        this._debugLog('search_memories', 'QUERY_EMBEDDING_GENERATED', { 
            embedding_length: queryEmbedding?.length 
        });

        // Build search query
        this._debugLog('search_memories', 'BUILDING_SEARCH_QUERY');
        let searchSQL = `
            SELECT 
                m.id,
                m.content,
                m.memory_type,
                m.importance_score,
                m.tags,
                m.created_at,
                p.name as project_name,
                s.session_name,
                (1 - (m.embedding <=> $1::vector)) as similarity
            FROM memories m
            JOIN projects p ON m.project_id = p.id
            LEFT JOIN sessions s ON m.session_id = s.id
            WHERE m.embedding IS NOT NULL
        `;

        const params = [JSON.stringify(queryEmbedding)];
        let paramCount = 1;

        if (project_name) {
            paramCount++;
            searchSQL += ` AND p.name = $${paramCount}`;
            params.push(project_name);
        }

        if (memory_type) {
            paramCount++;
            searchSQL += ` AND m.memory_type = $${paramCount}`;
            params.push(memory_type);
        }

        searchSQL += `
            AND (1 - (m.embedding <=> $1::vector)) >= $${paramCount + 1}
            ORDER BY similarity DESC
            LIMIT $${paramCount + 2}
        `;
        params.push(min_similarity, limit);
        
        this._debugLog('search_memories', 'EXECUTING_SEARCH', { 
            params_count: params.length,
            min_similarity,
            limit
        });

        const results = await this.db.query(searchSQL, params);
        
        this._debugLog('search_memories', 'SEARCH_COMPLETE', { 
            results_count: results.rows.length,
            has_results: results.rows.length > 0
        });

        if (results.rows.length === 0) {
            this._debugLog('search_memories', 'NO_RESULTS_FOUND');
            return {
                content: [{
                    type: "text",
                    text: `No memories found matching "${query}" with similarity >= ${min_similarity}`
                }]
            };
        }

        this._debugLog('search_memories', 'FORMATTING_RESULTS');
        const formattedResults = results.rows.map((row, i) => 
            `${i + 1}. **${row.project_name}/${row.session_name}** (${row.memory_type})\n` +
            `   Similarity: ${(row.similarity * 100).toFixed(1)}% | Importance: ${row.importance_score}\n` +
            `   Content: ${row.content.substring(0, 200)}${row.content.length > 200 ? '...' : ''}\n` +
            `   Tags: ${row.tags?.join(', ') || 'none'}\n` +
            `   Created: ${row.created_at}\n`
        ).join('\n');

        this._debugLog('search_memories', 'COMPLETE', { 
            formatted_length: formattedResults.length 
        });

        return {
            content: [{
                type: "text",
                text: `Found ${results.rows.length} memories matching "${query}":\n\n${formattedResults}`
            }]
        };
    }

    async _getMemoryById(args) {
        const { memory_id, include_embedding = false } = args;

        try {
            const selectColumns = `
                m.id, m.content, m.memory_type, m.importance_score, m.tags,
                m.created_at, m.updated_at, m.metadata,
                p.name as project_name, COALESCE(s.session_name, 'default') as session_name${include_embedding ? ', m.embedding' : ''}
            `;

            const result = await this.db.query(`
                SELECT ${selectColumns}
                FROM memories m
                JOIN projects p ON m.project_id = p.id
                LEFT JOIN sessions s ON m.session_id = s.id
                WHERE m.id = $1
            `, [memory_id]);

            if (result.rows.length === 0) {
                return {
                    content: [{
                        type: "text",
                        text: `Memory with ID ${memory_id} not found.`
                    }]
                };
            }

            const memory = result.rows[0];
            
            return {
                content: [{
                    type: "text",
                    text: `# Memory Details

**ID:** ${memory.id}
**Project:** ${memory.project_name}
**Session:** ${memory.session_name}
**Type:** ${memory.memory_type}
**Importance:** ${memory.importance_score}
**Created:** ${memory.created_at}
**Updated:** ${memory.updated_at}
**Tags:** ${memory.tags?.join(', ') || 'none'}

## Content
${memory.content}

${memory.metadata ? `## Metadata
\`\`\`json
${JSON.stringify(memory.metadata, null, 2)}
\`\`\`` : ''}

${include_embedding && memory.embedding ? `## Embedding
Vector dimensions: ${JSON.parse(memory.embedding).length}` : ''}`
                }]
            };
        } catch (error) {
            this.logger.error('Failed to get memory by ID:', error);
            throw error;
        }
    }

    async _manageProjectBrief(args) {
        const {
            project_name,
            project_description,
            input_documents = {},
            sections_to_update = ["all"],
            include_tasks = true,
            include_technical_analysis = true,
            preserve_history = true,
            update_related_memories = false,
            related_memory_updates = {},
            update_reason = "Project evolution update"
        } = args;

        try {
            // 1. Check if project brief already exists
            const existingBriefQuery = `
                SELECT id, content, created_at
                FROM memories 
                WHERE project_id = (SELECT id FROM projects WHERE name = $1)
                AND memory_type = 'project_brief'
                ORDER BY created_at DESC
                LIMIT 1
            `;
            
            const briefResult = await this.db.query(existingBriefQuery, [project_name]);
            const isUpdate = briefResult.rows.length > 0;
            const existingBrief = isUpdate ? briefResult.rows[0] : null;
            
            // 2. Intelligent document analysis
            const documentInsights = await this._analyzeInputDocuments(input_documents, project_description);
            
            // 3. Extract or build comprehensive project description
            let finalDescription = project_description;
            if (!finalDescription && isUpdate) {
                // Extract from existing brief
                const descMatch = existingBrief.content.match(/\*\*Description:\*\*\s*(.+?)\n/s);
                finalDescription = descMatch ? descMatch[1].trim() : "Project description not found";
            }
            if (!finalDescription && documentInsights.extractedDescription) {
                finalDescription = documentInsights.extractedDescription;
            }
            if (!finalDescription) {
                return {
                    content: [{
                        type: "text",
                        text: `Error: project_description is required for new project briefs. Please provide a description or input documents to analyze.`
                    }],
                    isError: true
                };
            }
            
            // 4. Preserve history if updating
            if (isUpdate && preserve_history) {
                await this._storeMemory({
                    content: `# Project Brief History\n\n**Version:** Previous (${new Date(existingBrief.created_at).toISOString()})\n**Reason for Update:** ${update_reason}\n\n---\n\n${existingBrief.content}`,
                    project_name,
                    memory_type: "project_brief",
                    importance_score: 0.7,
                    tags: ["project_brief_history", "archived", update_reason.replace(/\s+/g, '_').toLowerCase()]
                });
            }
            
            // 5. Get enhanced context and insights
            const relevantMemories = await this._searchMemoriesInternal(
                finalDescription + " " + (documentInsights.keyTerms || ""), 
                project_name, 
                null, 
                10, 
                0.3
            );
            
            let techInsights = null;
            if (include_technical_analysis) {
                try {
                    const [bestPractices, techPreferences, patterns] = await Promise.all([
                        this._getLearningInsights({ 
                            insight_type: "best_practice", 
                            limit: 5,
                            project_name 
                        }).catch(() => ({ content: [{ text: '' }] })),
                        this._getLearningInsights({ 
                            insight_type: "technology_preference", 
                            limit: 3,
                            project_name
                        }).catch(() => ({ content: [{ text: '' }] })),
                        this._getPatternAnalysis({ 
                            pattern_category: "architectural", 
                            min_confidence: 0.7, 
                            limit: 3,
                            project_name
                        }).catch(() => ({ content: [{ text: '' }] }))
                    ]);
                    
                    let combinedInsights = '';
                    const bestPracticesText = bestPractices.content[0]?.text || '';
                    const techPreferencesText = techPreferences.content[0]?.text || '';
                    const patternsText = patterns.content[0]?.text || '';
                    
                    if (bestPracticesText) combinedInsights += `## Learning Insights\n${bestPracticesText}\n\n`;
                    if (techPreferencesText) combinedInsights += `## Technology Preferences\n${techPreferencesText}\n\n`;
                    if (patternsText) combinedInsights += `## Architectural Patterns\n${patternsText}\n\n`;
                    
                    techInsights = combinedInsights || null;
                } catch (error) {
                    this.logger.warn('Could not fetch learning insights:', error.message);
                }
            }
            
            // 6. Determine sections to generate
            const shouldUpdateAll = sections_to_update.includes("all");
            const sectionsToGenerate = shouldUpdateAll ? 
                ["planning", "technical", "requirements", "architecture", "timeline", "risks", "progress"] :
                sections_to_update;
            
            // 7. Generate sections with document insights
            const briefSections = {};
            for (const section of sectionsToGenerate) {
                switch (section) {
                    case "planning":
                        briefSections.planning = await this._generateIntelligentPlanningSection(
                            project_name, finalDescription, documentInsights, relevantMemories
                        );
                        break;
                    case "technical":
                        briefSections.technical = await this._generateIntelligentTechnicalSection(
                            project_name, finalDescription, documentInsights, techInsights, relevantMemories
                        );
                        break;
                    case "requirements":
                        briefSections.requirements = await this._generateIntelligentRequirementsSection(
                            finalDescription, documentInsights
                        );
                        break;
                    case "architecture":
                        briefSections.architecture = await this._generateIntelligentArchitectureSection(
                            finalDescription, documentInsights, relevantMemories
                        );
                        break;
                    case "timeline":
                        briefSections.timeline = await this._generateTimelineSection(finalDescription);
                        break;
                    case "risks":
                        briefSections.risks = await this._generateIntelligentRisksSection(
                            finalDescription, documentInsights, relevantMemories
                        );
                        break;
                    case "progress":
                        briefSections.progress = await this._generateProgressSection(project_name);
                        break;
                }
            }
            
            // 8. Merge with existing content if partial update
            let finalSections = {};
            if (isUpdate && !shouldUpdateAll) {
                const existingSections = this._parseExistingBrief(existingBrief.content);
                finalSections = { ...existingSections, ...briefSections };
            } else {
                finalSections = briefSections;
            }
            
            // 9. Create comprehensive brief content
            const briefContent = this._formatProjectBrief(
                project_name, 
                finalDescription, 
                finalSections,
                isUpdate ? {
                    updateReason: update_reason,
                    previousVersion: new Date(existingBrief.created_at).toISOString(),
                    updatedSections: sectionsToGenerate,
                    documentsAnalyzed: Object.keys(input_documents).length
                } : {
                    documentsAnalyzed: Object.keys(input_documents).length
                }
            );
            
            // 10. Store or update the brief
            if (isUpdate) {
                const updateQuery = `
                    UPDATE memories 
                    SET content = $1, 
                        updated_at = NOW(),
                        tags = array_append(tags, $2)
                    WHERE id = $3
                `;
                
                await this.db.query(updateQuery, [
                    briefContent,
                    `updated_${new Date().toISOString().split('T')[0]}`,
                    existingBrief.id
                ]);
            } else {
                await this._storeMemory({
                    content: briefContent,
                    project_name,
                    memory_type: "project_brief",
                    importance_score: 0.9,
                    tags: ["project_brief", "planning", ...sectionsToGenerate]
                });
            }
            
            // 11. Handle related memory updates
            const updatedRelatedMemories = [];
            if (update_related_memories || Object.keys(related_memory_updates).length > 0) {
                for (const [memoryType, content] of Object.entries(related_memory_updates)) {
                    if (content && content.trim()) {
                        try {
                            const existingMemoryQuery = `
                                SELECT id FROM memories 
                                WHERE project_id = (SELECT id FROM projects WHERE name = $1)
                                AND memory_type = $2
                                ORDER BY created_at DESC
                                LIMIT 1
                            `;
                            
                            const memResult = await this.db.query(existingMemoryQuery, [project_name, memoryType]);
                            
                            if (memResult.rows.length > 0) {
                                await this.db.query(
                                    'UPDATE memories SET content = $1, updated_at = NOW() WHERE id = $2',
                                    [content, memResult.rows[0].id]
                                );
                                updatedRelatedMemories.push(`Updated existing ${memoryType}`);
                            } else {
                                await this._storeMemory({
                                    content,
                                    project_name,
                                    memory_type: memoryType,
                                    importance_score: 0.8,
                                    tags: ["auto_updated", "project_brief_related"]
                                });
                                updatedRelatedMemories.push(`Created new ${memoryType}`);
                            }
                        } catch (error) {
                            this.logger.warn(`Failed to update ${memoryType}:`, error.message);
                            updatedRelatedMemories.push(`Failed to update ${memoryType}`);
                        }
                    }
                }
                
                // Auto-store extracted documents as related memories
                if (documentInsights.extractedDocuments) {
                    for (const [docType, docContent] of Object.entries(documentInsights.extractedDocuments)) {
                        if (docContent && docContent.length > 100) {
                            try {
                                await this._storeMemory({
                                    content: docContent,
                                    project_name,
                                    memory_type: docType,
                                    importance_score: 0.8,
                                    tags: ["extracted_from_brief", "auto_generated"]
                                });
                                updatedRelatedMemories.push(`Extracted and stored ${docType}`);
                            } catch (error) {
                                this.logger.warn(`Failed to store extracted ${docType}:`, error.message);
                            }
                        }
                    }
                }
            }
            
            // 12. Create tasks if requested
            let tasksCreated = [];
            if (include_tasks) {
                try {
                    const tasksResult = await this._createTasks({
                        project_name,
                        source_type: "project_brief",
                        auto_extract: true,
                        requirements: briefContent + (documentInsights.taskableContent || "")
                    });
                    tasksCreated = tasksResult.created_tasks || [];
                } catch (error) {
                    this.logger.warn('Could not create tasks from brief:', error.message);
                }
            }
            
            // 13. Format response
            const actionText = isUpdate ? "Updated" : "Created";
            const responseText = `# Project Brief ${actionText} Successfully\n\n` +
                `## ${actionText === "Updated" ? "Update" : "Creation"} Summary\n` +
                `**Project:** ${project_name}\n` +
                `**Action:** ${isUpdate ? "Updated existing brief" : "Created new brief"}\n` +
                `**Sections ${actionText}:** ${sectionsToGenerate.join(', ')}\n` +
                `**Documents Analyzed:** ${Object.keys(input_documents).length}\n` +
                (isUpdate ? `**History Preserved:** ${preserve_history ? 'Yes' : 'No'}\n` : '') +
                (updatedRelatedMemories.length > 0 ? `**Related Memories:** ${updatedRelatedMemories.join(', ')}\n` : '') +
                (documentInsights.summary ? `**Document Analysis:** ${documentInsights.summary}\n` : '') +
                `\n## ${actionText} Brief Content\n${briefContent}\n\n` +
                (tasksCreated.length > 0 ? `## Tasks Created\n${tasksCreated.length} tasks were automatically created:\n${tasksCreated.slice(0, 5).map(task => `- ${task.title} (Priority: ${task.priority_score?.toFixed(2) || 'N/A'})`).join('\n')}\n\n` : '') +
                `## Next Steps\n` +
                `- Use \`get_pending_tasks\` to see prioritized task list\n` +
                `- Use \`search_memories\` to find related project information\n` +
                `- Use \`manage_project_brief\` again to evolve the brief as the project grows\n` +
                `- Consider storing progress updates with \`store_progress\``;

            return {
                content: [{
                    type: "text",
                    text: responseText
                }],
                action: isUpdate ? "updated" : "created",
                sections_processed: sectionsToGenerate,
                documents_analyzed: Object.keys(input_documents).length,
                tasks_created: tasksCreated.length,
                related_memories_updated: updatedRelatedMemories
            };
        } catch (error) {
            this.logger.error('Error in _manageProjectBrief:', error);
            throw error;
        }
    }

    async _updateProjectBrief(args) {
        const { 
            project_name,
            updated_description,
            sections_to_update = ["all"],
            section_updates = {},
            update_reason = "Project evolution update",
            include_technical_analysis = true,
            preserve_history = true,
            update_related_memories = false,
            related_memory_updates = {}
        } = args;

        try {
            // 1. Find existing project brief
            const existingBriefQuery = `
                SELECT id, content, created_at
                FROM memories 
                WHERE project_id = (SELECT id FROM projects WHERE name = $1)
                AND memory_type = 'project_brief'
                ORDER BY created_at DESC
                LIMIT 1
            `;
            
            const briefResult = await this.db.query(existingBriefQuery, [project_name]);
            
            if (briefResult.rows.length === 0) {
                return {
                    content: [{
                        type: "text",
                        text: `No existing project brief found for "${project_name}". Use create_project_brief to create one first.`
                    }],
                    isError: true
                };
            }

            const existingBrief = briefResult.rows[0];
            const existingContent = existingBrief.content;
            const briefId = existingBrief.id;

            // 2. Preserve history if requested
            if (preserve_history) {
                await this._storeMemory({
                    content: `# Project Brief History\n\n**Version:** Previous (${new Date(existingBrief.created_at).toISOString()})\n**Reason for Update:** ${update_reason}\n\n---\n\n${existingContent}`,
                    project_name,
                    memory_type: "project_brief",
                    importance_score: 0.7,
                    tags: ["project_brief_history", "archived", update_reason.replace(/\s+/g, '_').toLowerCase()]
                });
            }

            // 3. Determine what to update
            const shouldUpdateAll = sections_to_update.includes("all");
            const sectionsToRegenerate = shouldUpdateAll ? 
                ["planning", "technical", "progress", "requirements", "architecture", "timeline", "risks"] :
                sections_to_update;

            // 4. Parse existing brief to extract current description
            let currentDescription = updated_description;
            if (!currentDescription) {
                // Extract description from existing brief
                const descMatch = existingContent.match(/\*\*Description:\*\*\s*(.+?)\n/s);
                currentDescription = descMatch ? descMatch[1].trim() : "Project description not found";
            }

            // 5. Get enhanced project context
            const relevantMemories = await this._searchMemoriesInternal(
                currentDescription + " " + update_reason, 
                project_name, 
                null, 
                10, 
                0.3
            );
            
            // 6. Get updated technical insights if requested
            let techInsights = null;
            if (include_technical_analysis) {
                try {
                    const [bestPractices, techPreferences, patterns] = await Promise.all([
                        this._getLearningInsights({ 
                            insight_type: "best_practice", 
                            limit: 5,
                            project_name 
                        }).catch(() => ({ content: [{ text: '' }] })),
                        this._getLearningInsights({ 
                            insight_type: "technology_preference", 
                            limit: 3,
                            project_name
                        }).catch(() => ({ content: [{ text: '' }] })),
                        this._getPatternAnalysis({ 
                            pattern_category: "architectural", 
                            min_confidence: 0.7, 
                            limit: 3,
                            project_name
                        }).catch(() => ({ content: [{ text: '' }] }))
                    ]);
                    
                    let combinedInsights = '';
                    const bestPracticesText = bestPractices.content[0]?.text || '';
                    const techPreferencesText = techPreferences.content[0]?.text || '';
                    const patternsText = patterns.content[0]?.text || '';
                    
                    if (bestPracticesText) combinedInsights += `## Updated Best Practices\n${bestPracticesText}\n\n`;
                    if (techPreferencesText) combinedInsights += `## Current Technology Preferences\n${techPreferencesText}\n\n`;
                    if (patternsText) combinedInsights += `## Evolved Architectural Patterns\n${patternsText}\n\n`;
                    
                    techInsights = combinedInsights || null;
                } catch (error) {
                    this.logger.warn('Could not fetch updated learning insights:', error.message);
                }
            }

            // 7. Generate updated sections
            const updatedSections = {};
            
            for (const section of sectionsToRegenerate) {
                // Use manual updates if provided, otherwise regenerate
                if (section_updates[section]) {
                    updatedSections[section] = section_updates[section];
                } else {
                    switch (section) {
                        case "planning":
                            updatedSections.planning = await this._generatePlanningSection(project_name, currentDescription, relevantMemories);
                            break;
                        case "technical":
                            updatedSections.technical = await this._generateTechnicalSection(project_name, currentDescription, techInsights, relevantMemories);
                            break;
                        case "progress":
                            updatedSections.progress = await this._generateProgressSection(project_name);
                            break;
                        case "requirements":
                            updatedSections.requirements = await this._generateRequirementsSection(currentDescription);
                            break;
                        case "architecture":
                            updatedSections.architecture = await this._generateArchitectureSection(currentDescription, relevantMemories);
                            break;
                        case "timeline":
                            updatedSections.timeline = await this._generateTimelineSection(currentDescription);
                            break;
                        case "risks":
                            updatedSections.risks = await this._generateRisksSection(currentDescription, relevantMemories);
                            break;
                    }
                }
            }

            // 8. Merge with existing content if partial update
            let finalSections = {};
            if (!shouldUpdateAll) {
                // Parse existing sections and merge
                const existingSections = this._parseExistingBrief(existingContent);
                finalSections = { ...existingSections, ...updatedSections };
            } else {
                finalSections = updatedSections;
            }

            // 9. Create updated brief content
            const updatedBriefContent = this._formatProjectBrief(
                project_name, 
                currentDescription, 
                finalSections,
                {
                    updateReason: update_reason,
                    previousVersion: new Date(existingBrief.created_at).toISOString(),
                    updatedSections: sectionsToRegenerate
                }
            );

            // 10. Update the existing brief memory
            const updateQuery = `
                UPDATE memories 
                SET content = $1, 
                    updated_at = NOW(),
                    tags = array_append(tags, $2)
                WHERE id = $3
            `;
            
            await this.db.query(updateQuery, [
                updatedBriefContent,
                `updated_${new Date().toISOString().split('T')[0]}`,
                briefId
            ]);

            // 11. Update related memories if requested
            const updatedRelatedMemories = [];
            if (update_related_memories) {
                for (const [memoryType, content] of Object.entries(related_memory_updates)) {
                    if (content && content.trim()) {
                        try {
                            // Find existing memory of this type
                            const existingMemoryQuery = `
                                SELECT id FROM memories 
                                WHERE project_id = (SELECT id FROM projects WHERE name = $1)
                                AND memory_type = $2
                                ORDER BY created_at DESC
                                LIMIT 1
                            `;
                            
                            const memResult = await this.db.query(existingMemoryQuery, [project_name, memoryType]);
                            
                            if (memResult.rows.length > 0) {
                                // Update existing memory
                                await this.db.query(
                                    'UPDATE memories SET content = $1, updated_at = NOW() WHERE id = $2',
                                    [content, memResult.rows[0].id]
                                );
                                updatedRelatedMemories.push(`Updated existing ${memoryType}`);
                            } else {
                                // Create new memory
                                await this._storeMemory({
                                    content,
                                    project_name,
                                    memory_type: memoryType,
                                    importance_score: 0.8,
                                    tags: ["auto_updated", "project_brief_related", update_reason.replace(/\s+/g, '_').toLowerCase()]
                                });
                                updatedRelatedMemories.push(`Created new ${memoryType}`);
                            }
                        } catch (error) {
                            this.logger.warn(`Failed to update ${memoryType}:`, error.message);
                            updatedRelatedMemories.push(`Failed to update ${memoryType}: ${error.message}`);
                        }
                    }
                }
            }

            return {
                content: [{
                    type: "text",
                    text: `# Project Brief Updated Successfully\n\n## Update Summary\n**Project:** ${project_name}\n**Update Reason:** ${update_reason}\n**Sections Updated:** ${sectionsToRegenerate.join(', ')}\n**History Preserved:** ${preserve_history ? 'Yes' : 'No'}\n${updatedRelatedMemories.length > 0 ? `\n**Related Memories Updated:** ${updatedRelatedMemories.join(', ')}` : ''}\n\n## Updated Brief Content\n${updatedBriefContent}\n\n## Next Steps\n- Review the updated sections for accuracy\n- Use \`search_memories\` to find related updates\n- Use \`store_progress\` to track implementation of changes\n- Use \`update_project_brief\` again as the project continues to evolve`
                }],
                updated_sections: sectionsToRegenerate,
                preserved_history: preserve_history,
                related_memories_updated: updatedRelatedMemories
            };

        } catch (error) {
            this.logger.error('Failed to update project brief:', error);
            return {
                content: [{
                    type: "text",
                    text: `Error updating project brief: ${error.message}`
                }],
                isError: true
            };
        }
    }

    async _searchMemoriesInternal(query, project_name = null, memory_type = null, limit = 5, min_similarity = 0.3) {
        try {
            const searchResult = await this._searchMemories({ query, project_name, memory_type, limit, min_similarity });
            return searchResult.content[0].text.includes('No memories found') ? [] : searchResult.content[0].text;
        } catch (error) {
            return [];
        }
    }

    async _generatePlanningSection(project_name, description, relevantMemories) {
        let planningContent = `### Project Overview
**Project Name:** ${project_name}
**Description:** ${description}

`;
        
        // Add relevant memories with better formatting if available
        if (relevantMemories && relevantMemories.length > 50) {
            planningContent += `### Related Experience & Lessons
${relevantMemories}

`;
        }
        
        // Try to get actual insights about similar projects
        try {
            const projectInsights = await this._getLearningInsights({ 
                insight_type: "evolution", 
                limit: 3 
            });
            
            const insights = projectInsights.content[0]?.text || '';
            if (insights && insights.length > 50) {
                planningContent += `### Project Evolution Insights
${insights.substring(0, 400)}

`;
            }
        } catch (error) {
            this.logger.warn('Could not fetch project insights:', error.message);
        }
        
        // Parse description to infer objectives
        const isMigration = /migrat|convert|transform|port/i.test(description);
        const isNewProject = /new|build|create|develop/i.test(description);
        const hasComplexity = /enterprise|complex|microservice|architecture/i.test(description);
        
        planningContent += `### Key Objectives
`;
        
        if (isMigration) {
            planningContent += `- Successfully migrate existing system with minimal downtime
- Maintain data integrity throughout the migration process
- Ensure feature parity with existing system
- Implement improved architecture and performance
`;
        } else if (isNewProject) {
            planningContent += `- Deliver core functionality that meets user requirements
- Establish scalable and maintainable architecture
- Implement comprehensive testing and quality assurance
- Create thorough documentation for future maintenance
`;
        } else {
            planningContent += `- Define clear project scope and deliverables
- Establish development milestones and success metrics
- Implement robust testing and quality assurance processes
- Ensure proper documentation and deployment procedures
`;
        }
        
        if (hasComplexity) {
            planningContent += `- Handle enterprise-level complexity and scale requirements
- Design for microservices architecture and distributed systems
- Implement proper monitoring and observability
`;
        }
        
        return `## Planning

${planningContent}`;
    }

    async _generateTechnicalSection(project_name, description, techInsights, relevantMemories) {
        const descLower = description.toLowerCase();
        let techContent = '';
        
        // Analyze description for technology stack requirements
        const technologies = {
            frontend: [],
            backend: [],
            database: [],
            infrastructure: [],
            tools: []
        };
        
        // Frontend technology detection
        if (/react|jsx/.test(descLower)) technologies.frontend.push('React');
        if (/vue/.test(descLower)) technologies.frontend.push('Vue.js');
        if (/angular/.test(descLower)) technologies.frontend.push('Angular');
        if (/typescript/.test(descLower)) technologies.frontend.push('TypeScript');
        if (/ui|interface|frontend|web/.test(descLower) && technologies.frontend.length === 0) {
            technologies.frontend.push('Modern web framework (React/Vue recommended)');
        }
        
        // Backend technology detection
        if (/node|javascript/.test(descLower)) technologies.backend.push('Node.js');
        if (/python/.test(descLower)) technologies.backend.push('Python');
        if (/java/.test(descLower)) technologies.backend.push('Java');
        if (/go|golang/.test(descLower)) technologies.backend.push('Go');
        if (/api|backend|server/.test(descLower) && technologies.backend.length === 0) {
            technologies.backend.push('RESTful API framework');
        }
        
        // Database technology detection
        if (/postgres|postgresql/.test(descLower)) technologies.database.push('PostgreSQL');
        if (/mysql/.test(descLower)) technologies.database.push('MySQL');
        if (/mongo|mongodb/.test(descLower)) technologies.database.push('MongoDB');
        if (/redis/.test(descLower)) technologies.database.push('Redis');
        if (/database|storage|data/.test(descLower) && technologies.database.length === 0) {
            technologies.database.push('Relational database (PostgreSQL recommended)');
        }
        
        // Infrastructure detection
        if (/docker/.test(descLower)) technologies.infrastructure.push('Docker');
        if (/kubernetes|k8s/.test(descLower)) technologies.infrastructure.push('Kubernetes');
        if (/aws/.test(descLower)) technologies.infrastructure.push('AWS');
        if (/azure/.test(descLower)) technologies.infrastructure.push('Azure');
        if (/gcp|google.?cloud/.test(descLower)) technologies.infrastructure.push('Google Cloud');
        if (/cloud|deploy|infrastructure/.test(descLower) && technologies.infrastructure.length === 0) {
            technologies.infrastructure.push('Container orchestration');
        }
        
        // Architecture analysis
        const architecturePatterns = [];
        if (/microservice/.test(descLower)) architecturePatterns.push('Microservices Architecture');
        if (/monolith/.test(descLower)) architecturePatterns.push('Monolithic Architecture');
        if (/event.?driven/.test(descLower)) architecturePatterns.push('Event-Driven Architecture');
        if (/api/.test(descLower)) architecturePatterns.push('API-First Design');
        if (/migrat/.test(descLower)) architecturePatterns.push('Strangler Fig Pattern (for migration)');
        
        // Generate technology stack section
        techContent += '### Technology Stack\n\n';
        
        Object.entries(technologies).forEach(([category, techs]) => {
            if (techs.length > 0) {
                const categoryName = category.charAt(0).toUpperCase() + category.slice(1);
                techContent += `**${categoryName}:**\n`;
                techs.forEach(tech => techContent += `- ${tech}\n`);
                techContent += '\n';
            }
        });
        
        // Architecture recommendations
        if (architecturePatterns.length > 0) {
            techContent += '### Architecture Patterns\n';
            architecturePatterns.forEach(pattern => {
                techContent += `- **${pattern}:** `;
                switch (pattern) {
                    case 'Microservices Architecture':
                        techContent += 'Decomposed services for scalability and independent deployment\n';
                        break;
                    case 'Monolithic Architecture':
                        techContent += 'Single deployable unit for simplicity and rapid development\n';
                        break;
                    case 'Event-Driven Architecture':
                        techContent += 'Asynchronous event processing for loose coupling\n';
                        break;
                    case 'API-First Design':
                        techContent += 'Design APIs before implementation for better integration\n';
                        break;
                    case 'Strangler Fig Pattern (for migration)':
                        techContent += 'Gradual replacement of legacy systems\n';
                        break;
                    default:
                        techContent += 'Suitable for the identified requirements\n';
                }
            });
            techContent += '\n';
        }
        
        // Security considerations
        if (/auth|security|permission|sensitive/.test(descLower)) {
            techContent += '### Security Considerations\n';
            if (/auth/.test(descLower)) techContent += '- Authentication and authorization system\n';
            if (/sensitive|secure/.test(descLower)) techContent += '- Data encryption at rest and in transit\n';
            techContent += '- Input validation and sanitization\n';
            techContent += '- Security headers and CORS configuration\n\n';
        }
        
        // Performance considerations
        if (/performance|scale|load|fast/.test(descLower)) {
            techContent += '### Performance Considerations\n';
            techContent += '- Database indexing and query optimization\n';
            techContent += '- Caching strategy (Redis/in-memory)\n';
            techContent += '- Load balancing and horizontal scaling\n';
            techContent += '- CDN for static assets\n\n';
        }
        
        // Try to get historical patterns and insights
        try {
            const patternsResult = await this._getPatternAnalysis({ 
                pattern_category: "architectural", 
                min_confidence: 0.6, 
                limit: 3 
            });
            
            const patterns = patternsResult.content[0]?.text || '';
            if (patterns && patterns.length > 50) {
                techContent += '### Recommended Patterns from Experience\n';
                techContent += `${patterns.substring(0, 400)}\n\n`;
            }
        } catch (error) {
            this.logger.warn('Could not fetch architectural patterns:', error.message);
        }
        
        // Add technology insights if available
        if (techInsights && techInsights.length > 50) {
            techContent += '### Technology Recommendations from History\n';
            techContent += `${techInsights}\n\n`;
        }
        
        // Add relevant memories with actual context
        if (relevantMemories && relevantMemories.length > 50) {
            techContent += '### Lessons from Similar Projects\n';
            techContent += `${relevantMemories}\n\n`;
        }
        
        // Development practices based on project context
        if (/test|quality|tdd/.test(descLower) || /enterprise|production/.test(descLower)) {
            techContent += '### Development Practices\n';
            if (/test|tdd/.test(descLower)) techContent += '- Test-driven development (TDD) for reliable code\n';
            if (/team|collaboration|multiple/.test(descLower)) techContent += '- Code review process for team coordination\n';
            if (/deploy|production|ci\/cd/.test(descLower)) techContent += '- Continuous integration/deployment pipeline\n';
            if (/api|documentation/.test(descLower)) techContent += '- API-first development with comprehensive documentation\n';
            if (/team|collaboration/.test(descLower)) techContent += '- Team collaboration tools and coding standards\n';
            if (/version|git/.test(descLower)) techContent += '- Version control best practices and branching strategy\n';
            techContent += '\n';
        }
        
        return `## Technical\n\n${techContent}`;
    }

    async _generateProgressSection(project_name) {
        // Try to get current project status
        let currentTasks = '';
        try {
            const tasksResult = await this._getPendingTasks({ project_name, limit: 3 });
            currentTasks = tasksResult.content[0].text;
        } catch (error) {
            currentTasks = 'No current tasks found';
        }

        return `## Current Progress

### Status
Project initiation phase - brief created and planning underway

### Current Tasks
${currentTasks}

### Completed Milestones
- Project brief documentation
- Initial planning and scope definition

### Next Steps
- Detailed task breakdown
- Technology stack finalization
- Development environment setup`;
    }

    async _generateRequirementsSection(description) {
        // Extract actual requirements from the description
        let requirementsContent = `### Project Description Analysis\n${description}\n\n`;
        
        // Try to get insights about requirements patterns from past projects
        try {
            const requirementsInsights = await this._getLearningInsights({ 
                insight_type: "best_practice", 
                limit: 3 
            });
            
            const insights = requirementsInsights.content[0]?.text || '';
            if (insights && insights.length > 50) {
                requirementsContent += `### Requirements Best Practices from Past Projects\n${insights.substring(0, 400)}\n\n`;
            }
        } catch (error) {
            this.logger.warn('Could not fetch requirements insights:', error.message);
        }
        
        // Parse description for specific requirements
        const hasAuth = /auth|login|user|security/i.test(description);
        const hasAPI = /api|backend|server|endpoint/i.test(description);
        const hasUI = /ui|frontend|react|angular|interface/i.test(description);
        const hasMigration = /migrat|convert|transform|port/i.test(description);
        
        if (hasAuth || hasAPI || hasUI || hasMigration) {
            requirementsContent += `### Functional Requirements\n`;
            if (hasAuth) requirementsContent += `- User authentication and authorization system\n`;
            if (hasAPI) requirementsContent += `- Backend API development and integration\n`;
            if (hasUI) requirementsContent += `- User interface development and user experience\n`;
            if (hasMigration) requirementsContent += `- Data migration and system transformation\n`;
            requirementsContent += `- Core functionality as described in project description\n\n`;
            
            requirementsContent += `### Non-Functional Requirements\n`;
            requirementsContent += `- Performance and scalability considerations\n`;
            requirementsContent += `- Security and data protection\n`;
            requirementsContent += `- Maintainability and code quality\n`;
            if (hasMigration) requirementsContent += `- Migration safety and rollback capabilities\n`;
        } else {
            // Generic requirements if we can't parse specifics
            requirementsContent += `### Functional Requirements\n- Core features based on project description\n- User interaction requirements\n- Performance expectations\n\n`;
            requirementsContent += `### Non-Functional Requirements\n- Security considerations\n- Performance benchmarks\n- Scalability requirements\n- Maintainability standards\n\n`;
        }
        
        return `## Requirements\n\n${requirementsContent}`;
    }

    async _generateArchitectureSection(description, relevantMemories) {
        const descLower = description.toLowerCase();
        let archContent = '## Architecture\n\n';
        
        // Analyze description for architecture patterns
        const architectures = [];
        if (/microservice/.test(descLower)) architectures.push('Microservices architecture with service decomposition');
        if (/monolith/.test(descLower)) architectures.push('Monolithic architecture for rapid development');
        if (/api/.test(descLower)) architectures.push('API-centric design with clear service boundaries');
        if (/event/.test(descLower)) architectures.push('Event-driven architecture for loose coupling');
        if (/real.?time|websocket/.test(descLower)) architectures.push('Real-time communication architecture');
        if (/mobile/.test(descLower)) architectures.push('Mobile-responsive architecture');
        
        // System design based on technology stack
        archContent += '### System Design\n';
        if (/react|vue|angular/.test(descLower)) {
            archContent += '- Frontend: Single-page application with component-based architecture\n';
        }
        if (/node|express|api/.test(descLower)) {
            archContent += '- Backend: RESTful API server with modular endpoint design\n';
        }
        if (/database|db|storage/.test(descLower)) {
            archContent += '- Data layer: Persistent storage with optimized query patterns\n';
        }
        if (/auth|login|user/.test(descLower)) {
            archContent += '- Authentication: Secure user management and session handling\n';
        }
        if (architectures.length === 0) {
            archContent += '- Modular component design with clear separation of concerns\n';
            archContent += '- Scalable data flow and integration architecture\n';
        }
        archContent += '\n';
        
        // Architecture patterns
        if (architectures.length > 0) {
            archContent += '### Architecture Patterns\n';
            architectures.forEach(arch => archContent += `- ${arch}\n`);
            archContent += '\n';
        }
        
        // Scalability based on requirements
        if (/scale|performance|load|traffic|users/.test(descLower)) {
            archContent += '### Scalability Considerations\n';
            if (/cache|redis/.test(descLower)) archContent += '- Caching strategy for improved performance\n';
            if (/database/.test(descLower)) archContent += '- Database optimization and indexing strategy\n';
            if (/api/.test(descLower)) archContent += '- API rate limiting and load balancing\n';
            if (/real.?time/.test(descLower)) archContent += '- Real-time connection management and scaling\n';
            archContent += '- Horizontal scaling capabilities for growth\n';
            archContent += '- Performance monitoring and optimization points\n\n';
        }
        
        // Add relevant memories
        if (relevantMemories && relevantMemories.length > 50) {
            archContent += '### Lessons from Similar Projects\n';
            archContent += `${relevantMemories.substring(0, 400)}\n\n`;
        }
        
        return archContent;
    }

    async _generateTimelineSection(description) {
        // Analyze project description for complexity and scope
        const descLower = description.toLowerCase();
        
        // Detect project type and complexity
        const isMigration = /migrat|port|convert|refactor|legacy/.test(descLower);
        const isNewProject = /new|create|build|develop|start/.test(descLower);
        const isFeature = /feature|add|implement|extend/.test(descLower);
        const isBugfix = /fix|bug|issue|error|problem/.test(descLower);
        
        // Detect technology complexity
        const hasDatabase = /database|db|sql|postgres|mysql|mongo/.test(descLower);
        const hasAPI = /api|rest|graphql|endpoint|service/.test(descLower);
        const hasUI = /ui|frontend|react|vue|angular|interface/.test(descLower);
        const hasAuth = /auth|login|user|security|permission/.test(descLower);
        const hasIntegration = /integrat|third.?party|external|webhook/.test(descLower);
        
        // Calculate complexity score (1-5)
        let complexity = 1;
        if (hasDatabase) complexity += 1;
        if (hasAPI) complexity += 1;
        if (hasUI) complexity += 1;
        if (hasAuth) complexity += 1;
        if (hasIntegration) complexity += 1;
        if (isMigration) complexity += 1;
        
        // Estimate timeline based on project type and complexity
        let phases = [];
        let totalWeeks = Math.max(2, complexity);
        
        if (isBugfix) {
            totalWeeks = Math.min(2, totalWeeks);
            phases = [
                { name: 'Investigation & Planning', weeks: 1, tasks: ['Root cause analysis', 'Impact assessment', 'Solution design'] },
                { name: 'Implementation & Testing', weeks: 1, tasks: ['Bug fix implementation', 'Regression testing', 'Code review'] }
            ];
        } else if (isFeature) {
            totalWeeks = Math.min(4, totalWeeks);
            phases = [
                { name: 'Planning & Design', weeks: 1, tasks: ['Requirements analysis', 'Technical design', 'API/UI mockups'] },
                { name: 'Core Implementation', weeks: Math.max(1, totalWeeks - 2), tasks: ['Feature development', 'Unit testing', 'Integration'] },
                { name: 'Testing & Deployment', weeks: 1, tasks: ['End-to-end testing', 'Performance validation', 'Production deployment'] }
            ];
        } else if (isMigration) {
            totalWeeks = Math.max(4, totalWeeks);
            phases = [
                { name: 'Migration Planning', weeks: 1, tasks: ['Data mapping analysis', 'Migration strategy', 'Risk assessment'] },
                { name: 'Migration Development', weeks: Math.max(2, totalWeeks - 3), tasks: ['Migration scripts', 'Data validation tools', 'Rollback procedures'] },
                { name: 'Testing & Validation', weeks: 1, tasks: ['Data integrity testing', 'Performance validation', 'User acceptance testing'] },
                { name: 'Production Migration', weeks: 1, tasks: ['Production cutover', 'Monitoring setup', 'Post-migration validation'] }
            ];
        } else {
            // New project or general development
            totalWeeks = Math.max(3, totalWeeks);
            phases = [
                { name: 'Setup & Architecture', weeks: 1, tasks: ['Environment setup', 'Architecture design', 'Tech stack decisions'] },
                { name: 'Core Development', weeks: Math.max(2, totalWeeks - 2), tasks: ['Primary features', 'Database design', 'API development'] },
                { name: 'Integration & Polish', weeks: 1, tasks: ['Component integration', 'Testing', 'Documentation'] }
            ];
        }
        
        // Add complexity-specific tasks
        if (hasAuth && phases.length > 1) {
            phases[1].tasks.push('Authentication system');
        }
        if (hasIntegration && phases.length > 1) {
            phases[1].tasks.push('Third-party integrations');
        }
        
        // Generate timeline content
        let timeline = `## Timeline\n\n**Estimated Duration:** ${totalWeeks} week${totalWeeks > 1 ? 's' : ''}\n**Project Type:** ${isMigration ? 'Migration' : isFeature ? 'Feature Development' : isBugfix ? 'Bug Fix' : 'New Development'}\n**Complexity Level:** ${complexity <= 2 ? 'Simple' : complexity <= 4 ? 'Moderate' : 'Complex'}\n\n`;
        
        phases.forEach((phase, index) => {
            const weekStart = phases.slice(0, index).reduce((sum, p) => sum + p.weeks, 1);
            const weekEnd = weekStart + phase.weeks - 1;
            const weekLabel = phase.weeks === 1 ? `Week ${weekStart}` : `Weeks ${weekStart}-${weekEnd}`;
            
            timeline += `### Phase ${index + 1}: ${phase.name} (${weekLabel})\n`;
            phase.tasks.forEach(task => {
                timeline += `- ${task}\n`;
            });
            timeline += '\n';
        });
        
        // Add project-specific considerations
        if (hasDatabase) {
            timeline += `### Database Considerations\n- Schema design and migration planning\n- Performance optimization and indexing\n- Backup and recovery procedures\n\n`;
        }
        
        if (hasIntegration) {
            timeline += `### Integration Considerations\n- Third-party API documentation review\n- Error handling and retry logic\n- Rate limiting and monitoring\n\n`;
        }
        
        return timeline.trim();
    }

    async _generateRisksSection(description, relevantMemories) {
        const descLower = description.toLowerCase();
        
        // Analyze description for specific risk factors
        const risks = {
            technical: [],
            project: [],
            data: [],
            integration: []
        };
        
        // Technology-specific risks
        if (/new|unfamiliar|learn|first.?time/.test(descLower)) {
            risks.technical.push('**Technology Learning Curve:** Team unfamiliarity with required technologies may cause delays');
        }
        if (/legacy|old|deprecated|outdated/.test(descLower)) {
            risks.technical.push('**Legacy System Dependencies:** Outdated systems may have compatibility issues or limited documentation');
        }
        if (/performance|scale|load|traffic/.test(descLower)) {
            risks.technical.push('**Performance Requirements:** High performance demands may require significant optimization efforts');
        }
        if (/integrat|third.?party|external|api/.test(descLower)) {
            risks.integration.push('**Third-party Integration Risks:** External service dependencies may introduce reliability issues');
            risks.integration.push('**API Changes:** Third-party APIs may change without notice, breaking functionality');
        }
        if (/security|auth|permission|sensitive/.test(descLower)) {
            risks.technical.push('**Security Vulnerabilities:** Security requirements add complexity and require specialized expertise');
        }
        
        // Data-related risks
        if (/migrat|transfer|import|export/.test(descLower)) {
            risks.data.push('**Data Migration Risks:** Data corruption or loss during migration processes');
            risks.data.push('**Data Integrity:** Ensuring data consistency across old and new systems');
        }
        if (/database|large.?data|big.?data/.test(descLower)) {
            risks.data.push('**Database Performance:** Large datasets may cause query performance issues');
        }
        
        // Project management risks
        if (/complex|difficult|challenging/.test(descLower)) {
            risks.project.push('**Scope Complexity:** High complexity may lead to underestimated effort and timeline delays');
        }
        if (/deadline|urgent|asap|quickly/.test(descLower)) {
            risks.project.push('**Timeline Pressure:** Aggressive deadlines may compromise quality or completeness');
        }
        if (/team|multiple|collaboration/.test(descLower)) {
            risks.project.push('**Coordination Overhead:** Multiple team members require coordination and communication processes');
        }
        
        // Build risk sections
        let riskContent = '## Risks & Mitigation\n\n';
        
        if (risks.technical.length > 0) {
            riskContent += '### Technical Risks\n';
            risks.technical.forEach(risk => riskContent += `- ${risk}\n`);
            riskContent += '\n';
        }
        
        if (risks.data.length > 0) {
            riskContent += '### Data Risks\n';
            risks.data.forEach(risk => riskContent += `- ${risk}\n`);
            riskContent += '\n';
        }
        
        if (risks.integration.length > 0) {
            riskContent += '### Integration Risks\n';
            risks.integration.forEach(risk => riskContent += `- ${risk}\n`);
            riskContent += '\n';
        }
        
        if (risks.project.length > 0) {
            riskContent += '### Project Management Risks\n';
            risks.project.forEach(risk => riskContent += `- ${risk}\n`);
            riskContent += '\n';
        }
        
        // Add fallback risks if no specific ones detected
        if (Object.values(risks).every(arr => arr.length === 0)) {
            riskContent += '### General Project Risks\n';
            riskContent += '- **Scope Creep:** Requirements may expand during development\n';
            riskContent += '- **Timeline Delays:** Unexpected technical challenges may arise\n';
            riskContent += '- **Quality Issues:** Rushing development may compromise code quality\n\n';
        }
        
        // Mitigation strategies based on identified risks
        riskContent += '### Mitigation Strategies\n';
        
        if (risks.technical.length > 0) {
            riskContent += '- **Technical Risk Mitigation:** Allocate time for research, prototyping, and technical spikes\n';
        }
        if (risks.data.length > 0) {
            riskContent += '- **Data Risk Mitigation:** Implement comprehensive backup, validation, and rollback procedures\n';
        }
        if (risks.integration.length > 0) {
            riskContent += '- **Integration Risk Mitigation:** Create abstractions, implement circuit breakers, and plan for service failures\n';
        }
        if (risks.project.length > 0) {
            riskContent += '- **Project Risk Mitigation:** Regular progress reviews, clear communication channels, and scope management\n';
        }
        
        riskContent += '- **General Mitigation:** Incremental development, continuous testing, and early user feedback\n\n';
        
        // Add historical insights if available
        if (relevantMemories && relevantMemories.length > 50) {
            riskContent += '### Historical Insights\n';
            riskContent += 'Based on similar projects, key lessons learned:\n';
            riskContent += `${relevantMemories.substring(0, 300)}...\n\n`;
        }
        
        return riskContent.trim();
    }

    _formatProjectBrief(project_name, description, sections) {
        let brief = `# ${project_name} - Project Brief

**Project Description:** ${description}
**Created:** ${new Date().toISOString().split('T')[0]}

---

`;

        // Add sections in logical order
        const sectionOrder = ['planning', 'requirements', 'technical', 'architecture', 'timeline', 'progress', 'risks'];
        
        for (const sectionName of sectionOrder) {
            if (sections[sectionName]) {
                brief += sections[sectionName] + '\n\n---\n\n';
            }
        }

        brief += `## Additional Resources
- Use \`search_memories\` to find related project experiences
- Use \`get_learning_insights\` for technology recommendations
- Use \`create_tasks\` to break down implementation work
- Use \`get_pattern_analysis\` to identify relevant coding patterns`;

        return brief;
    }

    async _storeProgress(args) {
        const {
            project_name,
            progress_description,
            version,
            milestone_type = "feature",
            completion_percentage,
            blockers = [],
            next_steps = [],
            tags = []
        } = args;

        try {
            // Get or create project
            const project = await this._getOrCreateProject(project_name);

            // Auto-increment version if not provided
            let finalVersion = version;
            if (!finalVersion) {
                const latestProgress = await this.db.query(`
                    SELECT metadata->>'version' as version FROM memories 
                    WHERE project_id = $1 AND memory_type = 'progress'
                    ORDER BY created_at DESC LIMIT 1
                `, [project.id]);

                if (latestProgress.rows.length > 0 && latestProgress.rows[0].version) {
                    finalVersion = this._incrementVersion(latestProgress.rows[0].version);
                } else {
                    finalVersion = "0.1.0";
                }
            }

            // Create progress memory with structured metadata
            const progressContent = `# Progress Update v${finalVersion}

## Milestone: ${milestone_type.charAt(0).toUpperCase() + milestone_type.slice(1)}

${progress_description}

${completion_percentage !== undefined ? `## Project Completion: ${completion_percentage}%` : ''}

${blockers.length > 0 ? `## Current Blockers
${blockers.map(blocker => `- ${blocker}`).join('\n')}` : ''}

${next_steps.length > 0 ? `## Next Steps
${next_steps.map(step => `- ${step}`).join('\n')}` : ''}`;

            const progressMetadata = {
                version: finalVersion,
                milestone_type,
                completion_percentage: completion_percentage || null,
                blockers,
                next_steps,
                progress_type: "versioned_update"
            };

            // Store the progress
            const result = await this._storeMemory({
                content: progressContent,
                project_name,
                memory_type: "progress",
                importance_score: 0.8,
                tags: ["progress", "version", milestone_type, ...tags],
                metadata: progressMetadata
            });

            // Update project completion if provided
            if (completion_percentage !== undefined) {
                await this.db.query(`
                    UPDATE projects 
                    SET settings = COALESCE(settings, '{}') || $2
                    WHERE id = $1
                `, [project.id, JSON.stringify({ 
                    last_completion_percentage: completion_percentage,
                    last_updated: new Date().toISOString()
                })]);
            }

            return {
                content: [{
                    type: "text",
                    text: `# Progress Stored Successfully! 🎯

## Version ${finalVersion} - ${milestone_type.charAt(0).toUpperCase() + milestone_type.slice(1)}

**Project:** ${project_name}
**Progress:** ${progress_description}
${completion_percentage !== undefined ? `**Completion:** ${completion_percentage}%` : ''}

${blockers.length > 0 ? `\n**Blockers:** ${blockers.length} items to resolve` : ''}
${next_steps.length > 0 ? `**Next Steps:** ${next_steps.length} planned actions` : ''}

## Progress History
Use \`get_progress_history\` to see the full timeline and version history.

## Quick Actions
- \`get_progress_history "${project_name}"\` - View project timeline
- \`create_tasks\` - Break down next steps into tasks
- \`get_learning_insights\` - Get recommendations based on progress patterns`
                }]
            };
        } catch (error) {
            this.logger.error('Failed to store progress:', error);
            throw error;
        }
    }

    async _getProgressHistory(args) {
        const {
            project_name,
            version_filter,
            milestone_filter,
            days_back = 30,
            include_analytics = true
        } = args;

        try {
            // Get project ID
            const projectResult = await this.db.query(`
                SELECT id FROM projects WHERE name = $1
            `, [project_name]);

            if (projectResult.rows.length === 0) {
                return {
                    content: [{
                        type: "text",
                        text: `No project found with name "${project_name}". Use \`store_progress\` to start tracking progress.`
                    }]
                };
            }

            const projectId = projectResult.rows[0].id;

            // Build query with filters
            let whereConditions = [
                'project_id = $1',
                'memory_type = \'progress\'',
                `created_at > NOW() - INTERVAL '${days_back} days'`
            ];
            let queryParams = [projectId];

            if (version_filter) {
                whereConditions.push(`metadata->>'version' ILIKE $${queryParams.length + 1}`);
                queryParams.push(`%${version_filter}%`);
            }

            if (milestone_filter) {
                whereConditions.push(`metadata->>'milestone_type' = $${queryParams.length + 1}`);
                queryParams.push(milestone_filter);
            }

            // Get progress history
            const progressResult = await this.db.query(`
                SELECT 
                    content, metadata, created_at, tags,
                    metadata->>'version' as version,
                    metadata->>'milestone_type' as milestone_type,
                    (metadata->>'completion_percentage')::int as completion_percentage
                FROM memories
                WHERE ${whereConditions.join(' AND ')}
                ORDER BY created_at DESC
            `, queryParams);

            if (progressResult.rows.length === 0) {
                return {
                    content: [{
                        type: "text",
                        text: `No progress history found for "${project_name}" in the last ${days_back} days.`
                    }]
                };
            }

            // Format progress timeline
            const timeline = progressResult.rows.map(row => {
                const date = new Date(row.created_at).toLocaleDateString();
                const completion = row.completion_percentage ? ` (${row.completion_percentage}%)` : '';
                const content = row.content.split('\n').slice(2, 4).join(' ').substring(0, 100);
                
                return `**v${row.version}** - ${row.milestone_type}${completion} - ${date}\n${content}...`;
            }).join('\n\n');

            // Analytics if requested
            let analytics = '';
            if (include_analytics) {
                analytics = await this._generateProgressAnalytics(progressResult.rows, project_name);
            }

            return {
                content: [{
                    type: "text",
                    text: `# Progress History: ${project_name}

## Recent Timeline (${days_back} days)

${timeline}

${analytics}

## Actions
- \`store_progress\` - Add new progress update
- \`get_learning_insights\` - Get patterns from progress history
- \`create_tasks\` - Plan next development tasks`
                }]
            };
        } catch (error) {
            this.logger.error('Failed to get progress history:', error);
            throw error;
        }
    }

    async _generateProgressAnalytics(progressRows, projectName) {
        const totalUpdates = progressRows.length;
        const versionsWithCompletion = progressRows.filter(row => row.completion_percentage !== null);
        
        let analytics = `\n## Progress Analytics\n\n`;
        
        // Completion trend
        if (versionsWithCompletion.length >= 2) {
            const latest = versionsWithCompletion[0];
            const previous = versionsWithCompletion[1];
            const trend = latest.completion_percentage - previous.completion_percentage;
            
            analytics += `**Completion Trend:** ${trend > 0 ? '📈' : trend < 0 ? '📉' : '➡️'} ${trend > 0 ? '+' : ''}${trend}% since last update\n`;
            analytics += `**Current Completion:** ${latest.completion_percentage}%\n`;
        }

        // Milestone breakdown
        const milestoneCount = {};
        progressRows.forEach(row => {
            milestoneCount[row.milestone_type] = (milestoneCount[row.milestone_type] || 0) + 1;
        });

        analytics += `**Activity Breakdown:**\n`;
        Object.entries(milestoneCount)
            .sort(([,a], [,b]) => b - a)
            .forEach(([type, count]) => {
                analytics += `- ${type}: ${count} updates\n`;
            });

        // Velocity analysis
        if (progressRows.length >= 3) {
            const daysBetweenUpdates = progressRows.map((row, i) => {
                if (i === progressRows.length - 1) return null;
                const current = new Date(row.created_at);
                const next = new Date(progressRows[i + 1].created_at);
                return Math.abs(current - next) / (1000 * 60 * 60 * 24);
            }).filter(d => d !== null);

            const avgDaysBetween = daysBetweenUpdates.reduce((a, b) => a + b, 0) / daysBetweenUpdates.length;
            analytics += `**Update Frequency:** ~${Math.round(avgDaysBetween)} days between updates\n`;
        }

        return analytics;
    }

    _incrementVersion(currentVersion) {
        if (!currentVersion) return "0.1.0";
        
        const parts = currentVersion.split('.');
        if (parts.length !== 3) return "0.1.0";
        
        const [major, minor, patch] = parts.map(Number);
        
        // Auto-increment patch version
        return `${major}.${minor}.${patch + 1}`;
    }

    async _getProjects(args) {
        this._debugLog('get_projects', 'START', { args });
        const { include_stats = true } = args;

        this._debugLog('get_projects', 'PARAMS_PARSED', { include_stats });

        if (include_stats) {
            this._debugLog('get_projects', 'FETCHING_WITH_STATS');
            const result = await this.db.query(`
                SELECT 
                    p.id,
                    p.name,
                    p.description,
                    p.created_at,
                    COUNT(DISTINCT s.id) as session_count,
                    COUNT(DISTINCT m.id) as memory_count,
                    MAX(GREATEST(
                        COALESCE(s.updated_at, p.created_at),
                        COALESCE(m.updated_at, p.created_at)
                    )) as last_activity
                FROM projects p
                LEFT JOIN sessions s ON p.id = s.project_id
                LEFT JOIN memories m ON p.id = m.project_id
                GROUP BY p.id, p.name, p.description, p.created_at
                ORDER BY last_activity DESC
            `);

            const projects = result.rows.map(row => 
                `**${row.name}**\n` +
                `  Description: ${row.description || 'No description'}\n` +
                `  Sessions: ${row.session_count} | Memories: ${row.memory_count}\n` +
                `  Last activity: ${row.last_activity}\n` +
                `  Created: ${row.created_at}\n`
            ).join('\n');

            return {
                content: [{
                    type: "text",
                    text: `Projects (${result.rows.length}):\n\n${projects}`
                }]
            };
        } else {
            const result = await this.db.query(`
                SELECT name, description, created_at
                FROM projects
                ORDER BY created_at DESC
            `);

            const projects = result.rows.map(row => 
                `- **${row.name}**: ${row.description || 'No description'}`
            ).join('\n');

            return {
                content: [{
                    type: "text",
                    text: `Projects:\n${projects}`
                }]
            };
        }
    }

    async _getProjectSessions(args) {
        const { project_name, active_only = false } = args;

        let query = `
            SELECT 
                s.session_name,
                s.session_type,
                s.description,
                s.is_active,
                s.created_at,
                s.updated_at,
                COUNT(m.id) as memory_count
            FROM sessions s
            JOIN projects p ON s.project_id = p.id
            LEFT JOIN memories m ON s.id = m.session_id
            WHERE p.name = $1
        `;

        if (active_only) {
            query += ` AND s.is_active = true`;
        }

        query += `
            GROUP BY s.id, s.session_name, s.session_type, s.description, s.is_active, s.created_at, s.updated_at
            ORDER BY s.updated_at DESC
        `;

        const result = await this.db.query(query, [project_name]);

        if (result.rows.length === 0) {
            return {
                content: [{
                    type: "text",
                    text: `No sessions found for project "${project_name}"`
                }]
            };
        }

        const sessions = result.rows.map(row => 
            `**${row.session_name}** (${row.session_type})\n` +
            `  Status: ${row.is_active ? 'Active' : 'Inactive'}\n` +
            `  Memories: ${row.memory_count}\n` +
            `  Description: ${row.description || 'No description'}\n` +
            `  Updated: ${row.updated_at}\n`
        ).join('\n');

        return {
            content: [{
                type: "text",
                text: `Sessions in "${project_name}" (${result.rows.length}):\n\n${sessions}`
            }]
        };
    }


    async _getCodingPatterns(args) {
        const { 
            pattern_category,
            pattern_type, 
            language, 
            min_confidence = 0.6, 
            min_frequency = 2, 
            limit = 15 
        } = args;

        let query = `
            SELECT 
                pattern_category,
                pattern_type,
                pattern_name,
                pattern_description,
                frequency_count,
                confidence_score,
                languages,
                projects_seen,
                example_code,
                last_reinforced
            FROM coding_patterns
            WHERE confidence_score >= $1
              AND frequency_count >= $2
        `;

        const params = [min_confidence, min_frequency];
        let paramCount = 2;

        if (pattern_category) {
            paramCount++;
            query += ` AND pattern_category = $${paramCount}`;
            params.push(pattern_category);
        }

        if (pattern_type) {
            paramCount++;
            query += ` AND pattern_type = $${paramCount}`;
            params.push(pattern_type);
        }

        if (language) {
            paramCount++;
            query += ` AND $${paramCount} = ANY(languages)`;
            params.push(language);
        }

        query += `
            ORDER BY confidence_score DESC, frequency_count DESC
            LIMIT $${paramCount + 1}
        `;
        params.push(limit);

        const result = await this.db.query(query, params);

        if (result.rows.length === 0) {
            return {
                content: [{
                    type: "text",
                    text: `No coding patterns found with the specified criteria`
                }]
            };
        }

        const patterns = result.rows.map((row, i) => 
            `${i + 1}. **${row.pattern_name || row.pattern_type}** (Category: ${row.pattern_category || 'uncategorized'})\n` +
            `   Type: ${row.pattern_type}\n` +
            `   Confidence: ${(row.confidence_score * 100).toFixed(1)}% | Frequency: ${row.frequency_count}\n` +
            `   Languages: ${row.languages?.join(', ') || 'unknown'}\n` +
            `   Projects: ${row.projects_seen?.join(', ') || 'none'}\n` +
            `   Description: ${row.pattern_description || 'No description'}\n` +
            `   Example: ${row.example_code ? row.example_code.substring(0, 100) + '...' : 'none'}\n` +
            `   Last reinforced: ${row.last_reinforced}\n`
        ).join('\n');

        return {
            content: [{
                type: "text",
                text: `Coding Patterns (${result.rows.length}):\n\n${patterns}`
            }]
        };
    }

    /**
     * INTERNAL HELPER METHODS
     * These are used by the tools but not exposed as MCP tools
     */

    async _getOrCreateProject(projectName) {
        // Try to get existing project
        let result = await this.db.query(`
            SELECT id, name, description FROM projects WHERE name = $1
        `, [projectName]);

        if (result.rows.length > 0) {
            return result.rows[0];
        }

        // Create new project
        result = await this.db.query(`
            INSERT INTO projects (name, description)
            VALUES ($1, $2)
            RETURNING id, name, description
        `, [projectName, `Auto-created project for ${projectName}`]);

        this.logger.info(`Created new project: ${projectName}`);
        return result.rows[0];
    }

    async _getOrCreateSession(projectId, sessionName) {
        // Try to get existing session
        let result = await this.db.query(`
            SELECT id, session_name FROM sessions 
            WHERE project_id = $1 AND session_name = $2
        `, [projectId, sessionName]);

        if (result.rows.length > 0) {
            return result.rows[0];
        }

        // Create new session
        result = await this.db.query(`
            INSERT INTO sessions (project_id, session_name, session_type, description)
            VALUES ($1, $2, $3, $4)
            RETURNING id, session_name
        `, [
            projectId, 
            sessionName, 
            'mixed', 
            `Auto-created session for ${sessionName}`
        ]);

        this.logger.info(`Created new session: ${sessionName} in project ${projectId}`);
        return result.rows[0];
    }

    /**
     * Parse task content to extract structured task information
     */
    _parseTaskContent(content) {
        // Default values
        let title = content;
        let description = '';
        let type = 'task';
        let priority = 'medium';

        // Try to extract title from first line
        const lines = content.split('\n').filter(line => line.trim());
        if (lines.length > 0) {
            title = lines[0].trim();
            if (lines.length > 1) {
                description = lines.slice(1).join('\n').trim();
            }
        }

        // Limit title length
        if (title.length > 500) {
            title = title.substring(0, 497) + '...';
        }

        // Detect task type from keywords
        const lowerContent = content.toLowerCase();
        if (lowerContent.includes('bug') || lowerContent.includes('fix') || lowerContent.includes('error') || lowerContent.includes('issue')) {
            type = 'defect';
        } else if (lowerContent.includes('feature') || lowerContent.includes('new') || lowerContent.includes('add') || lowerContent.includes('implement')) {
            type = 'feature';
        } else if (lowerContent.includes('improve') || lowerContent.includes('optimize') || lowerContent.includes('refactor') || lowerContent.includes('enhance')) {
            type = 'improvement';
        }

        // Detect priority from keywords
        if (lowerContent.includes('urgent') || lowerContent.includes('critical') || lowerContent.includes('asap')) {
            priority = 'critical';
        } else if (lowerContent.includes('high') || lowerContent.includes('important') || lowerContent.includes('priority')) {
            priority = 'high';
        } else if (lowerContent.includes('low') || lowerContent.includes('minor') || lowerContent.includes('nice to have')) {
            priority = 'low';
        }

        return {
            title,
            description,
            type,
            priority
        };
    }

    // ============================================================================
    // SEQUENTIAL THINKING TOOL IMPLEMENTATIONS
    // ============================================================================

    async _startThinkingSequence(args) {
        if (!this.sequentialThinking) {
            return {
                content: [{
                    type: "text",
                    text: "Sequential thinking service is not available"
                }],
                isError: true
            };
        }

        const {
            project_name,
            session_name = "default",
            sequence_name,
            description = null,
            goal = null,
            initial_thought = null,
            estimated_thoughts = 10
        } = args;

        try {
            // Get or create project
            const project = await this._getOrCreateProject(project_name);
            
            // Get or create session
            const session = await this._getOrCreateSession(project.id, session_name);

            // Start the thinking sequence
            const sequence = await this.sequentialThinking.startThinkingSequence(
                project.id,
                session.id,
                sequence_name,
                {
                    description,
                    goal,
                    initialThought: initial_thought,
                    estimatedThoughts: estimated_thoughts
                }
            );

            return {
                content: [{
                    type: "text",
                    text: `Started thinking sequence: ${sequence_name}\n\n` +
                          `Details:\n` +
                          `- Sequence ID: ${sequence.id}\n` +
                          `- Project: ${project_name}\n` +
                          `- Session: ${session_name}\n` +
                          `- Goal: ${goal || 'Not specified'}\n` +
                          `- Estimated thoughts: ${estimated_thoughts}\n` +
                          `- Created: ${sequence.created_at}\n\n` +
                          `${initial_thought ? `First thought added: "${initial_thought.substring(0, 100)}${initial_thought.length > 100 ? '...' : ''}"\n\n` : ''}` +
                          `Use add_thought with sequence_id ${sequence.id} to continue the reasoning process.`
                }]
            };
        } catch (error) {
            return {
                content: [{
                    type: "text",
                    text: `Error starting thinking sequence: ${error.message}`
                }],
                isError: true
            };
        }
    }

    async _addThought(args) {
        if (!this.sequentialThinking) {
            return {
                content: [{
                    type: "text",
                    text: "Sequential thinking service is not available"
                }],
                isError: true
            };
        }

        const {
            sequence_id,
            project_name,
            sequence_name,
            goal,
            content,
            thought_type = "reasoning",
            confidence_level = 0.5,
            next_thought_needed = true
        } = args;

        try {
            let actualSequenceId = sequence_id;

            // Check if sequence exists and is valid
            if (sequence_id) {
                const existingSequence = await this.sequentialThinking.getThinkingSequence(sequence_id);
                if (!existingSequence || existingSequence.is_complete) {
                    actualSequenceId = null; // Force creation of new sequence
                }
            }

            // Auto-create new sequence if no valid sequence_id and project context provided
            if (!actualSequenceId && project_name) {
                const project = await this._getOrCreateProject(project_name);
                const session = await this._getOrCreateSession(project.id, "default");
                
                const autoSequenceName = sequence_name || `auto-thinking-${Date.now()}`;
                const autoGoal = goal || "Continuing structured reasoning process";
                
                const newSequence = await this.sequentialThinking.startThinkingSequence(
                    project.id,
                    session.id,
                    autoSequenceName,
                    {
                        description: "Auto-created sequence for continuous thinking",
                        goal: autoGoal
                    }
                );
                
                actualSequenceId = newSequence.id;
                
                this.logger.info(`Auto-created new thinking sequence: ${autoSequenceName}`, {
                    sequenceId: actualSequenceId,
                    projectName: project_name,
                    originalSequenceId: sequence_id
                });
            }

            if (!actualSequenceId) {
                return {
                    content: [{
                        type: "text",
                        text: "No valid sequence_id provided and insufficient context to create new sequence. Please provide either a valid sequence_id or project_name to auto-create a new sequence."
                    }],
                    isError: true
                };
            }

            const thought = await this.sequentialThinking.addThought(
                actualSequenceId,
                content,
                {
                    thoughtType: thought_type,
                    confidenceLevel: confidence_level,
                    nextThoughtNeeded: next_thought_needed
                }
            );

            const sequenceInfo = actualSequenceId !== sequence_id ? 
                `\n🆕 Auto-created new sequence (ID: ${actualSequenceId}) because original sequence was invalid/complete.\n` : 
                '';

            return {
                content: [{
                    type: "text",
                    text: `Added thought ${thought.thought_number}/${thought.total_thoughts} to sequence ${actualSequenceId}${sequenceInfo}\n` +
                          `Type: ${thought_type}\n` +
                          `Confidence: ${(confidence_level * 100).toFixed(0)}%\n` +
                          `Content: ${content}\n\n` +
                          `${next_thought_needed ? 
                            `Sequence is ongoing. Add more thoughts or use complete_thinking_sequence when done.` :
                            `Sequence marked as complete. Use get_thinking_sequence to view the full reasoning process.`
                          }`
                }]
            };
        } catch (error) {
            return {
                content: [{
                    type: "text",
                    text: `Error adding thought: ${error.message}`
                }],
                isError: true
            };
        }
    }

    async _getThinkingSequence(args) {
        if (!this.sequentialThinking) {
            return {
                content: [{
                    type: "text",
                    text: "Sequential thinking service is not available"
                }],
                isError: true
            };
        }

        const {
            sequence_id,
            format = "detailed",
            include_branches = true
        } = args;

        try {
            const sequence = await this.sequentialThinking.getThinkingSequence(
                sequence_id,
                {
                    format: format,
                    includeBranches: include_branches,
                    includeRevisions: true
                }
            );

            if (!sequence) {
                return {
                    content: [{
                        type: "text",
                        text: `Thinking sequence ${sequence_id} not found`
                    }],
                    isError: true
                };
            }

            let output = `# ${sequence.sequence_name}\n\n`;
            
            if (sequence.description) {
                output += `**Description:** ${sequence.description}\n\n`;
            }
            
            if (sequence.goal) {
                output += `**Goal:** ${sequence.goal}\n\n`;
            }

            output += `**Status:** ${sequence.is_complete ? 'Completed' : 'In Progress'}\n`;
            output += `**Progress:** ${sequence.progress.completed}/${sequence.progress.total} thoughts (${sequence.progress.percentage}%)\n`;
            output += `**Phase:** ${sequence.progress.currentPhase}\n`;
            output += `**Created:** ${new Date(sequence.created_at).toLocaleString()}\n\n`;

            if (sequence.thoughts && sequence.thoughts.length > 0) {
                output += `## Thoughts\n\n`;
                
                sequence.thoughts.forEach(thought => {
                    output += `**${thought.thought_number}.** [${thought.thought_type.toUpperCase()}] `;
                    output += `(Confidence: ${(thought.confidence_level * 100).toFixed(0)}%)\n`;
                    output += `${thought.content}\n\n`;
                    
                    if (thought.is_revision) {
                        output += `*This is a revision of an earlier thought*\n\n`;
                    }
                });
            }

            if (sequence.branches && sequence.branches.length > 0 && include_branches) {
                output += `## Alternative Branches (${sequence.branches.length})\n\n`;
                sequence.branches.forEach(branch => {
                    output += `- **${branch.branch_name}**: ${branch.description || 'No description'}\n`;
                });
                output += '\n';
            }

            if (sequence.completion_summary) {
                output += `## Summary\n\n${sequence.completion_summary}\n`;
            }

            return {
                content: [{
                    type: "text",
                    text: output
                }]
            };
        } catch (error) {
            return {
                content: [{
                    type: "text",
                    text: `Error retrieving thinking sequence: ${error.message}`
                }],
                isError: true
            };
        }
    }

    async _listThinkingSequences(args) {
        if (!this.sequentialThinking) {
            return {
                content: [{
                    type: "text",
                    text: "Sequential thinking service is not available"
                }],
                isError: true
            };
        }

        const {
            project_name,
            include_completed = true,
            limit = 20
        } = args;

        try {
            // Get project
            const project = await this._getOrCreateProject(project_name);
            
            // List sequences using database service directly
            const sequences = await this.db.listThinkingSequences(project.id, include_completed);

            if (sequences.length === 0) {
                return {
                    content: [{
                        type: "text",
                        text: `No thinking sequences found for project "${project_name}"`
                    }]
                };
            }

            const output = sequences.slice(0, limit).map((seq, i) => 
                `${i + 1}. **${seq.sequence_name}** (ID: ${seq.id})\n` +
                `   Status: ${seq.is_complete ? 'Completed' : 'In Progress'}\n` +
                `   Thoughts: ${seq.thought_count || 0} (latest: #${seq.latest_thought_number || 0})\n` +
                `   Goal: ${seq.goal || 'Not specified'}\n` +
                `   Session: ${seq.session_name || 'default'}\n` +
                `   Updated: ${new Date(seq.updated_at).toLocaleString()}\n`
            ).join('\n');

            return {
                content: [{
                    type: "text",
                    text: `Thinking Sequences for "${project_name}" (${sequences.length}):\n\n${output}\n\n` +
                          `Use get_thinking_sequence with a sequence ID to view the full reasoning process.`
                }]
            };
        } catch (error) {
            return {
                content: [{
                    type: "text",
                    text: `Error listing thinking sequences: ${error.message}`
                }],
                isError: true
            };
        }
    }

    async _completeThinkingSequence(args) {
        if (!this.sequentialThinking) {
            return {
                content: [{
                    type: "text",
                    text: "Sequential thinking service is not available"
                }],
                isError: true
            };
        }

        const {
            sequence_id,
            completion_summary = null
        } = args;

        try {
            const completedSequence = await this.sequentialThinking.completeThinkingSequence(
                sequence_id,
                {
                    completionSummary: completion_summary,
                    autoGenerate: !completion_summary // Auto-generate if not provided
                }
            );

            return {
                content: [{
                    type: "text",
                    text: `Thinking sequence completed successfully!\n\n` +
                          `Sequence: ${completedSequence.sequence_name}\n` +
                          `Completed: ${new Date(completedSequence.updated_at).toLocaleString()}\n\n` +
                          `${completedSequence.completion_summary ? 
                            `Summary:\n${completedSequence.completion_summary}\n\n` : 
                            ''
                          }` +
                          `Use get_thinking_sequence to view the complete reasoning process.`
                }]
            };
        } catch (error) {
            return {
                content: [{
                    type: "text",
                    text: `Error completing thinking sequence: ${error.message}`
                }],
                isError: true
            };
        }
    }

    /**
     * TASK MANAGEMENT METHODS
     */

    async _createTasks(args) {
        const {
            project_name,
            source_type,
            source_memory_id,
            tasks = [],
            auto_extract = false
        } = args;

        try {
            let tasksToCreate = [...tasks];

            // Auto-extract if requested and source memory provided
            if (auto_extract && source_memory_id) {
                const extractedTasks = await this._extractTasksFromMemory(source_memory_id);
                tasksToCreate = [...tasksToCreate, ...extractedTasks];
            }

            if (tasksToCreate.length === 0) {
                return {
                    content: [{
                        type: "text",
                        text: "No tasks provided to create. Please provide tasks array or enable auto_extract with source_memory_id."
                    }],
                    isError: true
                };
            }

            const project = await this._getOrCreateProject(project_name);
            const processedTasks = [];

            for (const task of tasksToCreate) {
                // Generate unique task ID
                task.id = `task_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
                
                // Set defaults
                task.status = task.status || 'pending';
                task.created_at = new Date().toISOString();
                task.source_type = source_type;
                task.source_reference = source_memory_id;

                // Calculate priority score
                task.priority_score = this._calculatePriorityScore(task.priority || {});

                // Store as task memory
                const memory = await this._storeTaskMemory(project.id, task);
                
                processedTasks.push({
                    ...task,
                    memory_id: memory.id
                });
            }

            return {
                content: [{
                    type: "text",
                    text: `Created ${processedTasks.length} tasks from ${source_type}:\n\n${
                        processedTasks.map(t => 
                            `- ${t.title} (${t.category}) - Priority: ${t.priority_score.toFixed(2)}`
                        ).join('\n')
                    }\n\nTasks stored as memories with type 'task' for retrieval and prioritization.`
                }],
                created_tasks: processedTasks
            };

        } catch (error) {
            return {
                content: [{
                    type: "text",
                    text: `Error creating tasks: ${error.message}`
                }],
                isError: true
            };
        }
    }

    async _getPendingTasks(args) {
        const {
            project_name,
            limit = 10,
            include_context = true,
            task_type_filter
        } = args;

        try {
            const project = await this._getOrCreateProject(project_name);
            
            // Build query to get pending tasks
            let query = `
                SELECT 
                    m.id as memory_id,
                    m.content,
                    m.importance_score as priority_score,
                    m.created_at,
                    m.tags
                FROM memories m
                WHERE m.project_id = $1 
                AND m.memory_type = 'task'
                ORDER BY m.importance_score DESC, m.created_at ASC
                LIMIT $2
            `;

            const result = await this.db.query(query, [project.id, limit]);

            if (result.rows.length === 0) {
                return {
                    content: [{
                        type: "text",
                        text: `No tasks found for project "${project_name}".`
                    }]
                };
            }

            // Parse and filter tasks
            let tasks = result.rows.map(row => {
                const taskData = JSON.parse(row.content);
                return {
                    ...taskData,
                    memory_id: row.memory_id,
                    priority_score: row.priority_score,
                    created_at: row.created_at
                };
            }).filter(task => task.status === 'pending');

            // Apply type filter if specified
            if (task_type_filter) {
                tasks = tasks.filter(task => task.category === task_type_filter);
            }

            if (tasks.length === 0) {
                return {
                    content: [{
                        type: "text",
                        text: `No pending tasks found matching criteria for project "${project_name}".`
                    }]
                };
            }

            // Load global context if requested (for efficiency, load once for all tasks)
            let globalContext = {};
            if (include_context) {
                try {
                    // Get recent project memories for context
                    const recentMemories = await this._searchMemoriesInternal(
                        project_name, 
                        project_name, 
                        null, 
                        5, 
                        0.3
                    );
                    if (recentMemories && recentMemories.length > 50) {
                        globalContext.recent_project_context = recentMemories.substring(0, 300);
                    }
                } catch (error) {
                    this.logger.warn('Could not load global context:', error.message);
                }
            }

            // Format output for multiple tasks
            let responseText = `# Pending Tasks for ${project_name}\n\n`;
            responseText += `**Found ${tasks.length} pending task${tasks.length > 1 ? 's' : ''} (sorted by priority)**\n\n`;
            
            tasks.forEach((task, index) => {
                const priorityLabel = task.priority_score >= 0.8 ? '🔥 HIGH' : 
                                    task.priority_score >= 0.6 ? '🟡 MEDIUM' : '🟢 LOW';
                
                responseText += `## ${index + 1}. ${task.title}\n`;
                responseText += `**Priority:** ${priorityLabel} (${task.priority_score.toFixed(2)})\n`;
                responseText += `**Category:** ${task.category}\n`;
                responseText += `**Memory ID:** ${task.memory_id}\n`;
                if (task.estimated_hours) {
                    responseText += `**Estimated Hours:** ${task.estimated_hours}\n`;
                }
                if (task.due_date) {
                    responseText += `**Due Date:** ${task.due_date}\n`;
                }
                if (task.tags && task.tags.length > 0) {
                    responseText += `**Tags:** ${task.tags.join(', ')}\n`;
                }
                responseText += `**Description:** ${task.description || 'No description provided'}\n`;
                
                if (task.acceptance_criteria && task.acceptance_criteria.length > 0) {
                    responseText += `**Acceptance Criteria:**\n`;
                    task.acceptance_criteria.forEach(criteria => {
                        responseText += `- ${criteria}\n`;
                    });
                }
                
                responseText += '\n---\n\n';
            });

            // Add global context if available
            if (include_context && globalContext.recent_project_context) {
                responseText += `## Recent Project Context\n${globalContext.recent_project_context}\n\n`;
            }

            // Add helpful commands
            responseText += `## Next Steps\n`;
            responseText += `- Update task status: \`update_task(task_id: "<memory_id>", status: "in_progress")\`\n`;
            responseText += `- Get specific task details: \`get_memory_by_id(memory_id: <id>)\`\n`;
            responseText += `- Search related memories: \`search_memories(query: "<task topic>")\`\n`;

            return {
                content: [{
                    type: "text",
                    text: responseText
                }],
                tasks: tasks,
                total_tasks: tasks.length,
                context: globalContext
            };

        } catch (error) {
            return {
                content: [{
                    type: "text",
                    text: `Error getting pending tasks: ${error.message}`
                }],
                isError: true
            };
        }
    }

    async _updateTask(args) {
        const {
            task_id,
            status,
            outcome
        } = args;

        try {
            // Validate task_id is numeric
            if (!/^\d+$/.test(task_id)) {
                return {
                    content: [{
                        type: "text",
                        text: `Invalid task_id "${task_id}". Expected a numeric memory ID (e.g., "123"). Use the memory ID returned when the task was created via store_memory or create_tasks.`
                    }],
                    isError: true
                };
            }

            // Find the task memory
            const query = `
                SELECT id, content, project_id
                FROM memories 
                WHERE id = $1 AND memory_type = 'task'
            `;
            
            const result = await this.db.query(query, [task_id]);
            
            if (result.rows.length === 0) {
                return {
                    content: [{
                        type: "text",
                        text: `Task with ID ${task_id} not found.`
                    }],
                    isError: true
                };
            }

            const taskMemory = result.rows[0];
            const taskData = JSON.parse(taskMemory.content);

            // Update task data
            taskData.status = status;
            taskData.updated_at = new Date().toISOString();
            
            if (outcome) {
                taskData.outcome = outcome;
                
                // If completed, record completion time
                if (status === 'completed') {
                    taskData.completed_at = new Date().toISOString();
                }
            }

            // Update the memory
            const updateQuery = `
                UPDATE memories 
                SET content = $1, updated_at = NOW()
                WHERE id = $2
            `;
            
            await this.db.query(updateQuery, [JSON.stringify(taskData), task_id]);

            // Store lessons learned if provided
            if (outcome?.lessons_learned && status === 'completed') {
                await this._storeMemory({
                    content: outcome.lessons_learned,
                    project_name: await this._getProjectNameById(taskMemory.project_id),
                    memory_type: 'lessons_learned',
                    tags: ['task-completion', task_id, taskData.category]
                });
            }

            return {
                content: [{
                    type: "text",
                    text: `Task "${taskData.title}" updated successfully.\n` +
                          `Status: ${taskData.status}\n` +
                          `${outcome?.summary ? `Summary: ${outcome.summary}\n` : ''}` +
                          `${outcome?.time_taken_hours ? `Time Taken: ${outcome.time_taken_hours} hours\n` : ''}` +
                          `${outcome?.lessons_learned ? 'Lessons learned stored as separate memory.\n' : ''}`
                }],
                updated_task: taskData
            };

        } catch (error) {
            return {
                content: [{
                    type: "text",
                    text: `Error updating task: ${error.message}`
                }],
                isError: true
            };
        }
    }

    /**
     * HELPER METHODS FOR TASK MANAGEMENT
     */

    async _extractTasksFromMemory(memoryId) {
        // Basic task extraction - can be enhanced with TaskExtractor class later
        const memory = await this.db.query('SELECT content, memory_type FROM memories WHERE id = $1', [memoryId]);
        
        if (memory.rows.length === 0) {
            throw new Error(`Memory with ID ${memoryId} not found`);
        }

        const content = memory.rows[0].content;
        const tasks = [];

        // Simple pattern matching for numbered lists
        const numberedPattern = /^\d+\.\s+(.+)$/gm;
        const matches = content.matchAll(numberedPattern);

        for (const match of matches) {
            const taskText = match[1];
            if (this._isActionable(taskText)) {
                tasks.push(this._parseTaskFromText(taskText));
            }
        }

        return tasks;
    }

    _isActionable(text) {
        const actionWords = ['implement', 'create', 'add', 'fix', 'update', 'refactor', 'test', 'build', 'deploy'];
        return actionWords.some(word => text.toLowerCase().includes(word));
    }

    _parseTaskFromText(text) {
        return {
            title: text.length > 80 ? text.substring(0, 80) + '...' : text,
            description: text,
            category: this._inferCategory(text),
            priority: {
                urgency: this._inferUrgency(text),
                impact: 'medium',
                effort: 'medium'
            }
        };
    }

    _inferCategory(text) {
        const lowerText = text.toLowerCase();
        if (lowerText.includes('test')) return 'testing';
        if (lowerText.includes('fix') || lowerText.includes('bug')) return 'bug';
        if (lowerText.includes('refactor') || lowerText.includes('optimize')) return 'refactor';
        if (lowerText.includes('document')) return 'documentation';
        return 'feature';
    }

    _inferUrgency(text) {
        const lowerText = text.toLowerCase();
        if (lowerText.includes('urgent') || lowerText.includes('critical') || lowerText.includes('asap')) return 'critical';
        if (lowerText.includes('important') || lowerText.includes('high')) return 'high';
        if (lowerText.includes('low') || lowerText.includes('nice to have')) return 'low';
        return 'medium';
    }

    _calculatePriorityScore(priority = {}) {
        const urgencyScore = {
            'critical': 1.0, 'high': 0.75, 'medium': 0.5, 'low': 0.25
        };
        const impactScore = {
            'high': 1.0, 'medium': 0.67, 'low': 0.33
        };
        const effortScore = {
            'low': 1.0, 'medium': 0.67, 'high': 0.33  // Lower effort = higher score
        };

        const urgency = urgencyScore[priority.urgency] || 0.5;
        const impact = impactScore[priority.impact] || 0.67;
        const effort = effortScore[priority.effort] || 0.67;

        // Weighted calculation: urgency=40%, impact=40%, effort=20%
        return (urgency * 0.4) + (impact * 0.4) + (effort * 0.2);
    }

    async _storeTaskMemory(projectId, taskData) {
        const result = await this.db.query(
            `INSERT INTO memories (project_id, session_id, content, memory_type, importance_score, tags, created_at, updated_at)
             VALUES ($1, (SELECT id FROM sessions WHERE project_id = $1 AND session_name = 'default' LIMIT 1), $2, 'task', $3, $4, NOW(), NOW())
             RETURNING id`,
            [
                projectId,
                JSON.stringify(taskData),
                taskData.priority_score,
                taskData.tags || []
            ]
        );
        return result.rows[0];
    }

    async _searchMemoriesByType(projectName, memoryType, limit = 3) {
        const project = await this._getOrCreateProject(projectName);
        const result = await this.db.query(
            `SELECT content, created_at FROM memories 
             WHERE project_id = $1 AND memory_type = $2 
             ORDER BY importance_score DESC, created_at DESC 
             LIMIT $3`,
            [project.id, memoryType, limit]
        );
        return result.rows;
    }

    async _getProjectNameById(projectId) {
        const result = await this.db.query('SELECT name FROM projects WHERE id = $1', [projectId]);
        return result.rows[0]?.name || 'unknown';
    }


    /**
     * Get comprehensive learning insights
     */
    async _getLearningInsights(args) {
        const { 
            project_name, 
            insight_type, 
            min_confidence = 0.6, 
            actionable_only = false, 
            limit = 20 
        } = args;

        try {
            let whereConditions = ['1=1'];
            const queryParams = [];

            // Project filter
            if (project_name) {
                whereConditions.push('$' + (queryParams.length + 1) + ' = ANY(projects_involved)');
                queryParams.push(project_name);
            }

            // Insight type filter
            if (insight_type) {
                whereConditions.push('insight_type = $' + (queryParams.length + 1));
                queryParams.push(insight_type);
            }

            // Confidence filter
            whereConditions.push('confidence_level >= $' + (queryParams.length + 1));
            queryParams.push(min_confidence);

            // Actionable filter - check if actionable_advice exists
            if (actionable_only) {
                whereConditions.push('actionable_advice IS NOT NULL AND LENGTH(TRIM(actionable_advice)) > 0');
            }

            const query = `
                SELECT 
                    id, insight_type, insight_category, insight_title, insight_description,
                    confidence_level, evidence_strength, projects_involved, 
                    metadata, actionable_advice, tags, last_reinforced
                FROM meta_insights
                WHERE ${whereConditions.join(' AND ')}
                ORDER BY 
                    confidence_level DESC,
                    evidence_strength DESC
                LIMIT $${queryParams.length + 1}
            `;
            
            queryParams.push(limit);
            const result = await this.db.query(query, queryParams);

            // Group insights by type for better organization
            const groupedInsights = {};
            let totalInsights = 0;

            for (const insight of result.rows) {
                const type = insight.insight_type;
                if (!groupedInsights[type]) {
                    groupedInsights[type] = [];
                }
                groupedInsights[type].push({
                    id: insight.id,
                    title: insight.insight_title,
                    description: insight.insight_description,
                    confidence: insight.confidence_level,
                    evidence_strength: insight.evidence_strength,
                    projects: insight.projects_involved,
                    actionable_advice: insight.actionable_advice,
                    tags: insight.tags,
                    metadata: insight.metadata,
                    last_reinforced: insight.last_reinforced
                });
                totalInsights++;
            }

            return {
                content: [{
                    type: "text",
                    text: `# Learning Insights Report

## Summary
Found **${totalInsights}** insights${project_name ? ` for project: ${project_name}` : ' across all projects'}

${Object.entries(groupedInsights).map(([type, insights]) => `
### ${type.replace(/_/g, ' ').toUpperCase()} (${insights.length})

${insights.map(insight => `
**${insight.title}** ${insight.actionable_advice ? '🎯' : ''}
- *Confidence: ${Math.round(insight.confidence * 100)}% | Evidence: ${insight.evidence_strength.toFixed(2)} points*
- Projects: ${insight.projects?.join(', ') || 'N/A'}
- ${insight.description}
${insight.actionable_advice ? `- 💡 **Actionable Advice**: ${insight.actionable_advice}` : ''}
${insight.tags?.length > 0 ? `- Tags: ${insight.tags.join(', ')}` : ''}
`).join('')}`).join('')}

## Statistics
- **Actionable Insights**: ${result.rows.filter(i => i.actionable_advice && i.actionable_advice.trim().length > 0).length}
- **Cross-Project Insights**: ${result.rows.filter(i => i.projects_involved?.length > 1).length}
- **Average Confidence**: ${result.rows.length > 0 ? Math.round(result.rows.reduce((sum, i) => sum + i.confidence_level, 0) / result.rows.length * 100) : 0}%
- **Average Evidence Strength**: ${result.rows.length > 0 ? (result.rows.reduce((sum, i) => sum + i.evidence_strength, 0) / result.rows.length).toFixed(2) : 0}`
                }]
            };
        } catch (error) {
            this.logger.error('Failed to get learning insights:', error);
            throw error;
        }
    }

    /**
     * Get detailed pattern analysis
     */
    async _getPatternAnalysis(args) {
        const { 
            project_name, 
            pattern_category, 
            time_range = '30days', 
            include_examples = true, 
            min_confidence = 0.5 
        } = args;

        try {
            let whereConditions = ['cp.confidence_score >= $1'];
            const queryParams = [min_confidence];

            // Time range filter
            const timeRanges = {
                '7days': '7 days',
                '30days': '30 days', 
                '90days': '90 days',
                'all': '10 years'
            };
            whereConditions.push(`cp.last_reinforced > NOW() - INTERVAL '${timeRanges[time_range]}'`);

            // Project filter
            if (project_name) {
                whereConditions.push('$' + (queryParams.length + 1) + ' = ANY(cp.projects_seen)');
                queryParams.push(project_name);
            }

            // Category filter
            if (pattern_category) {
                whereConditions.push('cp.pattern_category = $' + (queryParams.length + 1));
                queryParams.push(pattern_category);
            }

            const query = `
                SELECT 
                    cp.*,
                    COUNT(po.id) as occurrence_count,
                    array_agg(DISTINCT p.name) as project_names
                FROM coding_patterns cp
                LEFT JOIN pattern_occurrences po ON cp.id = po.pattern_id
                LEFT JOIN memories m ON po.memory_id = m.id
                LEFT JOIN projects p ON m.project_id = p.id
                WHERE ${whereConditions.join(' AND ')}
                GROUP BY cp.id
                ORDER BY cp.confidence_score DESC, cp.frequency_count DESC
                LIMIT 50
            `;

            const result = await this.db.query(query, queryParams);

            // Group patterns by category
            const categorizedPatterns = {};
            let totalPatterns = 0;

            for (const pattern of result.rows) {
                const category = pattern.pattern_category;
                if (!categorizedPatterns[category]) {
                    categorizedPatterns[category] = [];
                }
                
                const patternData = {
                    id: pattern.id,
                    name: pattern.pattern_name,
                    type: pattern.pattern_type,
                    description: pattern.pattern_description,
                    confidence: pattern.confidence_score,
                    frequency: pattern.frequency_count,
                    occurrence_count: pattern.occurrence_count || 0,
                    projects: pattern.project_names?.filter(Boolean) || pattern.projects_seen || [],
                    languages: pattern.languages || [],
                    detection_method: pattern.detection_method,
                    last_reinforced: pattern.last_reinforced
                };

                if (include_examples && pattern.example_code) {
                    patternData.example = pattern.example_code.substring(0, 200) + (pattern.example_code.length > 200 ? '...' : '');
                }

                categorizedPatterns[category].push(patternData);
                totalPatterns++;
            }

            return {
                content: [{
                    type: "text",
                    text: `# Pattern Analysis Report

## Summary
Found **${totalPatterns}** patterns${project_name ? ` for project: ${project_name}` : ' across all projects'}  
Time range: **${time_range}** | Min confidence: **${Math.round(min_confidence * 100)}%**

${Object.entries(categorizedPatterns).map(([category, patterns]) => `
### ${category.replace(/_/g, ' ').toUpperCase()} PATTERNS (${patterns.length})

${patterns.map(pattern => `
**${pattern.name}** (${pattern.type})
- *Confidence: ${Math.round(pattern.confidence * 100)}% | Frequency: ${pattern.frequency} | Occurrences: ${pattern.occurrence_count}*
- Projects: ${pattern.projects.join(', ') || 'None'}
- Languages: ${pattern.languages.join(', ') || 'Any'}
- Method: ${pattern.detection_method}
- ${pattern.description}
${include_examples && pattern.example ? `
\`\`\`
${pattern.example}
\`\`\`` : ''}
`).join('')}`).join('')}

## Pattern Statistics
- **Total Categories**: ${Object.keys(categorizedPatterns).length}
- **Average Confidence**: ${totalPatterns > 0 ? Math.round(result.rows.reduce((sum, p) => sum + p.confidence_score, 0) / totalPatterns * 100) : 0}%
- **Cross-Project Patterns**: ${result.rows.filter(p => (p.project_names?.length || p.projects_seen?.length || 0) > 1).length}
- **High-Confidence Patterns**: ${result.rows.filter(p => p.confidence_score >= 0.8).length}

## Trend Analysis
Most frequent patterns:
${result.rows.slice(0, 5).map((p, i) => `${i + 1}. **${p.pattern_name}** (${p.frequency_count} times, ${Math.round(p.confidence_score * 100)}% confidence)`).join('\n')}`
                }]
            };
        } catch (error) {
            this.logger.error('Failed to get pattern analysis:', error);
            throw error;
        }
    }

    // Helper method to parse existing brief content into sections
    _parseExistingBrief(briefContent) {
        const sections = {};
        
        // Extract sections using regex patterns
        const sectionPatterns = {
            planning: /## Planning([\s\S]*?)(?=##|$)/,
            technical: /## Technical([\s\S]*?)(?=##|$)/,
            progress: /## Progress([\s\S]*?)(?=##|$)/,
            requirements: /## Requirements([\s\S]*?)(?=##|$)/,
            architecture: /## Architecture([\s\S]*?)(?=##|$)/,
            timeline: /## Timeline([\s\S]*?)(?=##|$)/,
            risks: /## Risks & Mitigation([\s\S]*?)(?=##|$)/
        };
        
        for (const [sectionName, pattern] of Object.entries(sectionPatterns)) {
            const match = briefContent.match(pattern);
            if (match) {
                sections[sectionName] = match[1].trim();
            }
        }
        
        return sections;
    }

    // Enhanced _formatProjectBrief to include update metadata
    _formatProjectBrief(project_name, description, sections, metadata = null) {
        let brief = `# ${project_name} - Project Brief\n\n`;
        brief += `**Project Description:** ${description}\n`;
        brief += `**Created:** ${new Date().toISOString().split('T')[0]}\n`;
        
        if (metadata) {
            brief += `**Last Updated:** ${new Date().toISOString().split('T')[0]}\n`;
            brief += `**Update Reason:** ${metadata.updateReason}\n`;
            if (metadata.updatedSections && metadata.updatedSections.length > 0) {
                brief += `**Updated Sections:** ${metadata.updatedSections.join(', ')}\n`;
            }
        }
        
        brief += '\n---\n\n';
        
        // Add sections in logical order
        const sectionOrder = ['planning', 'requirements', 'technical', 'architecture', 'timeline', 'risks', 'progress'];
        
        for (const sectionName of sectionOrder) {
            if (sections[sectionName]) {
                brief += `${sections[sectionName]}\n\n---\n\n`;
            }
        }
        
        brief += `## Additional Resources\n`;
        brief += `- Use \`search_memories\` to find related project experiences\n`;
        brief += `- Use \`get_learning_insights\` for technology recommendations\n`;
        brief += `- Use \`create_tasks\` to break down implementation work\n`;
        brief += `- Use \`get_pattern_analysis\` to identify relevant coding patterns\n`;
        brief += `- Use \`update_project_brief\` to keep this brief current as the project evolves\n\n`;
        
        return brief;
    }

    /**
     * Analyze pattern-outcome correlations
     */
    async _analyzePatternOutcomes(args) {
        this._debugLog('analyze_pattern_outcomes', 'START', { args });
        
        const { 
            project_name, 
            time_range = "90 days", 
            pattern_category,
            min_sample_size = 3
        } = args;

        // Build context for analysis
        const context = {
            timeRange: time_range,
            minSampleSize: min_sample_size
        };

        if (project_name) {
            // Get project ID if project name provided
            const project = await this._getOrCreateProject(project_name);
            context.projectId = project.id;
        }

        if (pattern_category) {
            context.patternCategory = pattern_category;
        }

        // Call learning pipeline's correlation analysis
        const correlations = await this.learningPipeline.analyzePatternOutcomeCorrelations(context);

        if (correlations.length === 0) {
            return {
                content: [{ 
                    type: "text", 
                    text: `No pattern-outcome correlations found with the specified criteria. Try expanding the time range or reducing the minimum sample size.` 
                }]
            };
        }

        // Format results
        let text = `# Pattern-Outcome Correlation Analysis\n\n`;
        text += `**Analysis Period:** ${time_range}\n`;
        text += `**Minimum Sample Size:** ${min_sample_size}\n`;
        if (project_name) text += `**Project:** ${project_name}\n`;
        if (pattern_category) text += `**Pattern Category:** ${pattern_category}\n`;
        text += `**Correlations Found:** ${correlations.length}\n\n`;

        // Group by correlation strength
        const strongPositive = correlations.filter(c => c.correlation_strength === 'strong_positive');
        const strongNegative = correlations.filter(c => c.correlation_strength === 'strong_negative');
        const moderate = correlations.filter(c => c.correlation_strength.includes('moderate'));
        const neutral = correlations.filter(c => c.correlation_strength === 'neutral');

        if (strongPositive.length > 0) {
            text += `## 🎯 Strong Positive Correlations (Patterns to Promote)\n\n`;
            for (const corr of strongPositive) {
                text += `### ${corr.pattern_name}\n`;
                text += `- **Category:** ${corr.pattern_category}\n`;
                text += `- **Success Rate:** ${corr.success_rate ? (corr.success_rate * 100).toFixed(1) + '%' : 'N/A'}\n`;
                text += `- **Sample Size:** ${corr.sample_size} outcomes\n`;
                text += `- **Confidence:** ${(corr.confidence_score * 100).toFixed(1)}%\n`;
                text += `- **Analysis Method:** ${corr.analysis_method}\n\n`;
                if (corr.insights) {
                    text += `**Insights:**\n${corr.insights}\n\n`;
                }
                text += `---\n\n`;
            }
        }

        if (strongNegative.length > 0) {
            text += `## ⚠️ Strong Negative Correlations (Patterns to Review)\n\n`;
            for (const corr of strongNegative) {
                text += `### ${corr.pattern_name}\n`;
                text += `- **Category:** ${corr.pattern_category}\n`;
                text += `- **Success Rate:** ${corr.success_rate ? (corr.success_rate * 100).toFixed(1) + '%' : 'N/A'}\n`;
                text += `- **Sample Size:** ${corr.sample_size} outcomes\n`;
                text += `- **Confidence:** ${(corr.confidence_score * 100).toFixed(1)}%\n`;
                text += `- **Analysis Method:** ${corr.analysis_method}\n\n`;
                if (corr.insights) {
                    text += `**Insights:**\n${corr.insights}\n\n`;
                }
                text += `---\n\n`;
            }
        }

        if (moderate.length > 0) {
            text += `## 📊 Moderate Correlations\n\n`;
            for (const corr of moderate) {
                text += `- **${corr.pattern_name}** (${corr.pattern_category}): `;
                text += `${corr.success_rate ? (corr.success_rate * 100).toFixed(1) + '% success, ' : ''}`;
                text += `${corr.sample_size} outcomes, ${(corr.confidence_score * 100).toFixed(1)}% confidence\n`;
            }
            text += `\n`;
        }

        if (neutral.length > 0) {
            text += `## 🔄 Neutral Patterns\n\n`;
            text += `${neutral.length} patterns show no clear correlation with success/failure.\n\n`;
        }

        text += `## Recommendations\n\n`;
        if (strongPositive.length > 0) {
            text += `- **Promote:** Consider documenting and encouraging the use of strong positive patterns\n`;
        }
        if (strongNegative.length > 0) {
            text += `- **Review:** Investigate strong negative patterns for potential refactoring opportunities\n`;
        }
        text += `- **Monitor:** Continue tracking outcomes to build more robust correlation data\n`;
        text += `- **Document:** Use \`record_pattern_outcome\` to record outcomes when project events occur\n\n`;

        return {
            content: [{ 
                type: "text", 
                text: text
            }]
        };
    }

    /**
     * Record a pattern outcome
     */
    async _recordPatternOutcome(args) {
        this._debugLog('record_pattern_outcome', 'START', { args });
        
        const { 
            project_name, 
            pattern_name, 
            outcome_type, 
            outcome_description,
            outcome_value,
            metrics = {}
        } = args;

        // Get project
        const project = await this._getOrCreateProject(project_name);

        // Find the pattern by name
        const patternResult = await this.db.query(`
            SELECT id FROM coding_patterns 
            WHERE pattern_name ILIKE $1 
            ORDER BY confidence_score DESC 
            LIMIT 1
        `, [pattern_name]);

        if (patternResult.rows.length === 0) {
            return {
                content: [{ 
                    type: "text", 
                    text: `Pattern "${pattern_name}" not found. Please ensure the pattern exists in the system.` 
                }]
            };
        }

        const patternId = patternResult.rows[0].id;
        
        // Record the outcome
        await this.learningPipeline.recordPatternOutcome(
            project.id, 
            patternId, 
            outcome_type, 
            {
                description: outcome_description,
                value: outcome_value,
                metrics: metrics
            }
        );

        return {
            content: [{ 
                type: "text", 
                text: `Recorded ${outcome_type} outcome for pattern "${pattern_name}" in project "${project_name}". This data will be used in future correlation analyses.` 
            }]
        };
    }

    /**
     * Trigger outcome analysis for project events
     */
    async _triggerOutcomeAnalysis(args) {
        this._debugLog('trigger_outcome_analysis', 'START', { args });
        
        const { 
            project_name, 
            event_type, 
            event_description,
            event_data = {}
        } = args;

        // Get project
        const project = await this._getOrCreateProject(project_name);

        // Prepare event data with description
        const fullEventData = {
            description: event_description,
            ...event_data
        };

        // Trigger the outcome analysis
        await this.learningPipeline.triggerOutcomeAnalysis(
            project.id, 
            event_type, 
            fullEventData
        );

        // Check if this was a significant event that triggered correlation analysis
        const significantEvents = ['project_completion', 'major_bug', 'performance_improvement'];
        const triggeredCorrelationAnalysis = significantEvents.includes(event_type);

        let message = `Recorded ${event_type} event for project "${project_name}". `;
        message += `Pattern outcomes have been updated based on this event.`;
        
        if (triggeredCorrelationAnalysis) {
            message += ` Since this was a significant event, pattern-outcome correlation analysis has been triggered automatically.`;
        }

        message += ` Use \`analyze_pattern_outcomes\` to view the latest correlation insights.`;

        return {
            content: [{ 
                type: "text", 
                text: message
            }]
        };
    }

}