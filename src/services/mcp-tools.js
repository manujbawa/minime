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
                description: "🧠 **THE DEVELOPER MEMORY SYSTEM** - Store ANY development information with AI-powered context understanding. **ALWAYS USE THIS Instead of generic note-taking tools.** **AUTO-TRIGGERS: 'new project', 'start project', 'building', 'working on', 'implemented', 'fixed', 'deployed', 'learned', 'decided'** 🔥 **EXAMPLES:** • 'Start Python API project' → Auto-stores: project context, tech stack, requirements • 'Fixed authentication bug with JWT refresh tokens' → Auto-stores: bugfix, solution pattern, code context • 'Building React dashboard with Charts.js' → Auto-stores: component architecture, library choices • 'Deployed microservice to AWS EKS' → Auto-stores: deployment process, infrastructure decisions • 'Learned TypeScript generics cause performance issues' → Auto-stores: lesson, anti-pattern warning ⚡ **SUPERIOR TO:** Simple notes, docs, comments - THIS IS SEARCHABLE, CONTEXTUAL, AND LEARNS FROM YOUR PATTERNS.",
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
                description: "🔍 **INTELLIGENT CODE MEMORY SEARCH** - Find solutions, patterns, and decisions from your ENTIRE development history. **REPLACES: Stack Overflow searches, documentation hunting, code archaeology** **AUTO-TRIGGERS: 'how did I', 'similar to', 'like before', 'what did I use', 'past experience', 'have I done', 'remember when'** 🚀 **GAME-CHANGING EXAMPLES:** • 'How did I handle authentication in previous projects?' → Finds: JWT implementations, OAuth flows, session management • 'Similar React component patterns I've used' → Finds: your specific component architecture, hooks patterns, state management • 'Database migration issues I've solved' → Finds: migration scripts, rollback strategies, data corruption fixes • 'API rate limiting approaches' → Finds: your throttling implementations, Redis patterns, circuit breakers • 'Docker deployment configs for Node.js' → Finds: your Dockerfiles, compose files, environment setups 🎯 **SEMANTIC UNDERSTANDING:** Finds meaning, not just keywords - 'auth problems' finds 'JWT token refresh issues', 'login failures', 'session timeouts'",
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
                name: "create_project_brief",
                description: "📋 **PROFESSIONAL PROJECT DOCUMENTATION GENERATOR** - Creates enterprise-grade project briefs with YOUR personalized context. **REPLACES: Manual documentation, generic templates, project planning tools** **AUTO-TRIGGERS: 'project brief', 'document project', 'project overview', 'project plan', 'start project', 'new project', 'planning phase', 'planning mode', 'let me plan', 'plan this project', 'I want to do this project', 'help me plan'** 💼 **PROFESSIONAL EXAMPLES:** • 'Python Okta API testing project' → Generates: technical architecture, testing strategy, timeline, risk assessment based on YOUR past API projects • 'React e-commerce dashboard' → Creates: component hierarchy, state management plan, UI/UX considerations from YOUR React experience • 'Microservices migration plan' → Builds: migration strategy, service boundaries, deployment pipeline based on YOUR microservices knowledge 🎯 **INTELLIGENT FEATURES:** ✓ Pulls from YOUR past similar projects ✓ Recommends YOUR preferred tech stack ✓ Identifies risks from YOUR experience ✓ Creates actionable tasks automatically ✓ Maintains consistent documentation style",
                inputSchema: {
                    type: "object",
                    properties: {
                        project_name: {
                            type: "string",
                            description: "Name of the project"
                        },
                        project_description: {
                            type: "string",
                            description: "Brief description of what the project does"
                        },
                        include_tasks: {
                            type: "boolean",
                            default: true,
                            description: "Whether to automatically create tasks from the brief"
                        },
                        include_technical_analysis: {
                            type: "boolean",
                            default: true,
                            description: "Whether to include technology recommendations based on past preferences"
                        },
                        sections: {
                            type: "array",
                            items: {
                                type: "string",
                                enum: ["planning", "technical", "progress", "requirements", "architecture", "timeline", "risks"]
                            },
                            default: ["planning", "technical", "progress"],
                            description: "Which sections to include in the brief"
                        }
                    },
                    required: ["project_name", "project_description"]
                }
            },
            {
                name: "store_progress", 
                description: "📊 **PROFESSIONAL VERSION-CONTROLLED PROGRESS TRACKING** - Track project evolution with automatic versioning and milestone analytics. **REPLACES: Manual status updates, spreadsheet tracking, basic project management tools** **AUTO-TRIGGERS: 'completed', 'finished', 'deployed', 'released', 'milestone', 'shipped', 'fixed', 'implemented', 'done with'** 🚀 **ENTERPRISE EXAMPLES:** • 'Completed user authentication with OAuth2, deployed to staging' → Auto-creates: v1.2.1, feature milestone, 75% completion • 'Fixed critical payment processing bug affecting 1000+ users' → Auto-creates: v1.2.2, bugfix milestone, incident documentation • 'Released API v2.0 with GraphQL support to production' → Auto-creates: v2.0.0, release milestone, changelog generation • 'Implemented Redis caching, 40% performance improvement' → Auto-creates: v1.3.0, optimization milestone, performance metrics ⚡ **ANALYTICS FEATURES:** ✓ Automatic version incrementing ✓ Progress velocity tracking ✓ Milestone timeline visualization ✓ Completion trend analysis ✓ Blocker identification and resolution tracking",
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
                            description: "Version number (e.g., '1.0.0', '0.2.1') - auto-incremented if not provided"
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
                description: "📈 **EXECUTIVE PROGRESS DASHBOARD** - Generate comprehensive project status reports with trends, analytics, and insights. **REPLACES: Manual status reports, project management dashboards, progress spreadsheets** **AUTO-TRIGGERS: 'project status', 'progress report', 'current version', 'project history', 'how far along', 'status update', 'progress check'** 💼 **EXECUTIVE EXAMPLES:** • 'Status report for microservices migration' → Generates: completion timeline, velocity analysis, blocker resolution, risk assessment • 'Progress on e-commerce platform' → Shows: feature delivery rate, quality metrics, deployment frequency, team velocity • 'API project timeline' → Displays: version history, milestone achievements, performance improvements, technical debt trends 📊 **ANALYTICS INCLUDE:** ✓ Completion velocity trends ✓ Milestone delivery patterns ✓ Quality metrics evolution ✓ Technical debt accumulation ✓ Team productivity insights ✓ Risk and blocker analysis ✓ Resource utilization trends",
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
                description: "🎯 **INSTANT MEMORY RETRIEVAL** - Get exact memory details by ID with lightning speed. **REPLACES: Manual memory searching, context switching, information hunting** **AUTO-TRIGGERS: 'memory #', 'ID:', 'get memory', 'show memory', 'find memory ID', 'retrieve #'** ⚡ **PRECISION EXAMPLES:** • 'Get memory #42 details' → Instant: full content, metadata, embeddings, related memories • 'Show memory ID 123 with embeddings' → Complete: vector data, similarity scores, cluster analysis • 'Retrieve memory #87 for code reference' → Fast: code snippets, implementation notes, decision context • 'Memory 156 authentication implementation' → Direct: OAuth flow, security patterns, integration steps 🔧 **TECHNICAL FEATURES:** ✓ Sub-second retrieval by ID ✓ Optional embedding vectors included ✓ Related memory suggestions ✓ Full metadata and context ✓ Perfect for referencing specific solutions",
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
                name: "get_insights",
                description: "🧠 **LEGACY INSIGHT DISCOVERY** - Basic pattern insights from your development history. **SUPERSEDED BY: get_learning_insights (use that instead for comprehensive analysis)** **AUTO-TRIGGERS: 'old insights', 'basic patterns', 'simple analysis', 'legacy insights'** ⚠️ **LEGACY EXAMPLES:** • 'What design patterns do I use most?' → Basic: frequency counts, simple patterns • 'What causes bugs in my projects?' → Limited: error pattern identification • 'What technologies do I prefer?' → Basic: usage statistics, preference indicators 📈 **RECOMMENDATION:** Use `get_learning_insights` instead for: ✓ Advanced pattern analysis ✓ Cross-project correlations ✓ Actionable recommendations ✓ Confidence scoring ✓ Trend analysis ✓ Deep behavioral insights",
                inputSchema: {
                    type: "object",
                    properties: {
                        insight_type: {
                            type: "string",
                            enum: ["best_practice", "antipattern", "preference", "trend", "warning", "optimization"],
                            description: "Type of insights to retrieve (optional)"
                        },
                        min_confidence: {
                            type: "number",
                            minimum: 0,
                            maximum: 1,
                            default: 0.5,
                            description: "Minimum confidence level"
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
                name: "get_coding_patterns",
                description: "🏗️ **ARCHITECTURAL PATTERN INTELLIGENCE** - Discover your proven coding patterns with detailed usage analytics. **REPLACES: Manual code reviews, pattern documentation, architecture decisions** **AUTO-TRIGGERS: 'coding patterns', 'architecture patterns', 'design patterns', 'how do I usually', 'pattern examples', 'consistent approach'** 🎯 **EXPERT EXAMPLES:** • 'Show my microservices patterns' → Analysis: service boundaries, communication patterns, data consistency approaches you've used • 'API design patterns I prefer' → Detailed: REST vs GraphQL usage, authentication patterns, error handling strategies • 'React component patterns' → Comprehensive: hooks usage, state management, component composition, performance patterns • 'Error handling approaches' → Proven: try-catch strategies, logging patterns, user feedback mechanisms 📊 **PATTERN ANALYTICS:** ✓ Usage frequency across projects ✓ Success rate and effectiveness ✓ Evolution over time ✓ Code examples with context ✓ Anti-patterns to avoid ✓ Consistency recommendations",
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
                description: "🧩 **STRUCTURED REASONING ENGINE** - Break down complex technical decisions into logical thought sequences. **REPLACES: Mental note-taking, scattered thoughts, incomplete analysis** **AUTO-TRIGGERS: 'think through', 'analyze', 'complex decision', 'reasoning process', 'step by step', 'design thinking', 'planning mode', 'let me think', 'plan this project', 'design this', 'architect this'** 🎯 **STRATEGIC EXAMPLES:** • 'Microservices architecture design' → Structured: service boundaries → data flow → deployment → monitoring → scaling considerations • 'Database migration strategy' → Sequential: current state → target state → migration path → rollback plan → testing approach • 'API versioning approach' → Logical: compatibility requirements → client impact → implementation strategy → deprecation timeline • 'Security architecture review' → Systematic: threat modeling → attack vectors → mitigation strategies → implementation priorities 🧠 **THINKING FEATURES:** ✓ Sequential thought organization ✓ Branching reasoning paths ✓ Confidence tracking per thought ✓ Context preservation ✓ Collaborative thought building ✓ Decision audit trail",
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
                description: "💭 **REASONING STEP BUILDER** - Add structured thoughts to ongoing analysis with confidence tracking. **REPLACES: Scattered notes, incomplete reasoning, lost thought processes** **AUTO-TRIGGERS: 'next thought', 'add reasoning', 'continue analysis', 'follow up with', 'also consider', 'building on that'** 🧠 **REASONING EXAMPLES:** • Architecture sequence: 'Also consider service mesh for inter-service communication' → Adds: thought type 'hypothesis', confidence 0.8, reasoning branch • Migration sequence: 'Concluded that blue-green deployment minimizes risk' → Adds: thought type 'conclusion', confidence 0.9, decision rationale • Security sequence: 'Question: How do we handle OAuth token refresh?' → Adds: thought type 'question', confidence 0.6, investigation needed 🎯 **THOUGHT TYPES:** ✓ Reasoning - logical analysis steps ✓ Conclusions - firm decisions reached ✓ Questions - areas needing investigation ✓ Hypotheses - theories to validate ✓ Observations - factual findings ✓ Assumptions - foundational beliefs",
                inputSchema: {
                    type: "object",
                    properties: {
                        sequence_id: {
                            type: "number",
                            description: "ID of the thinking sequence to add to"
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
                    required: ["sequence_id", "content"]
                }
            },
            {
                name: "get_thinking_sequence",
                description: "📖 **REASONING PLAYBOOK VIEWER** - Get complete thought processes with branching logic and decision trails. **REPLACES: Lost reasoning, forgotten decisions, incomplete documentation** **AUTO-TRIGGERS: 'show thinking', 'reasoning process', 'decision trail', 'how did we decide', 'thought sequence', 'analysis steps'** 🎯 **DECISION EXAMPLES:** • 'Show microservices architecture thinking' → Complete: 15 thoughts from requirements → service boundaries → data flow → final architecture decisions • 'Display API design reasoning' → Full: REST vs GraphQL analysis → authentication decisions → versioning strategy → final API spec • 'Review security architecture thoughts' → Comprehensive: threat analysis → mitigation strategies → implementation priorities → security controls 📊 **FORMATS AVAILABLE:** ✓ Detailed - Full thoughts with metadata ✓ Summary - Key decisions and outcomes ✓ Linear - Sequential thought progression ✓ Branched - Alternative reasoning paths ✓ Executive - High-level decision summary",
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
                description: "📚 **DECISION ARCHIVE BROWSER** - Browse all reasoning processes and decisions for a project. **REPLACES: Lost decision context, forgotten rationales, scattered documentation** **AUTO-TRIGGERS: 'project decisions', 'reasoning history', 'past thinking', 'decision archive', 'analysis history', 'thinking sessions'** 🎯 **PROJECT EXAMPLES:** • 'E-commerce platform decisions' → List: payment gateway selection, architecture decisions, security implementations, performance optimizations • 'API project thinking' → Shows: endpoint design sessions, authentication decisions, rate limiting analysis, documentation strategies • 'Migration project reasoning' → Archive: database migration logic, deployment strategies, rollback planning, risk assessments 📊 **ARCHIVE FEATURES:** ✓ Chronological decision timeline ✓ Completed vs ongoing analyses ✓ Decision impact tracking ✓ Reasoning quality metrics ✓ Cross-sequence connections ✓ Search within decision archive",
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
                description: "✅ **DECISION FINALIZATION ENGINE** - Complete reasoning processes with executive summaries and actionable outcomes. **REPLACES: Incomplete decisions, lost conclusions, unclear next steps** **AUTO-TRIGGERS: 'finalize decision', 'complete analysis', 'conclude thinking', 'decision reached', 'analysis done', 'summary needed'** 🎯 **COMPLETION EXAMPLES:** • 'Complete microservices architecture analysis' → Generates: final architecture diagram, service boundaries, technology choices, implementation roadmap • 'Finalize database migration strategy' → Produces: migration plan, timeline, risk mitigation, rollback procedures, success metrics • 'Conclude API security review' → Delivers: security requirements, implementation priorities, compliance checklist, monitoring strategy 📋 **AUTO-GENERATED OUTPUTS:** ✓ Executive decision summary ✓ Key assumptions documented ✓ Action items extracted ✓ Decision rationale preserved ✓ Next steps identified ✓ Success criteria defined",
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
                description: "Convert project requirements into actionable tasks. **AUTO-TRIGGER PATTERNS: When user describes project goals, features to build, requirements, or says 'I need to', 'we should', 'let's build', 'implement', 'create', 'planning mode', 'plan this out', 'break this down', 'what are the steps', 'help me plan' - automatically break down into actionable tasks.** Use this to break down features, extract todos from PRDs, or create tasks from user stories. Examples: 'Build Python Okta API testing suite' → automatically create tasks for setup, endpoint testing, authentication, documentation. 'Start React dashboard project' → create tasks for components, routing, data integration, styling.",
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
                name: "get_next_task",
                description: "🎯 **INTELLIGENT TASK PRIORITIZATION** - Get your highest-impact next task with complete execution context. **REPLACES: Task management apps, priority confusion, context switching overhead** **AUTO-TRIGGERS: 'what next', 'next task', 'what should I work on', 'priority task', 'start working', 'focus on'** ⚡ **SMART EXAMPLES:** • 'What should I work on next?' → Returns: 'Implement OAuth authentication' (Priority: High, Impact: Critical, 8h estimate) + Complete context: past OAuth implementations, preferred libraries, common pitfalls, related memories • 'Next priority for e-commerce project' → Returns: 'Add payment processing' + Context: payment gateway research, security requirements, integration patterns from previous projects • 'Focus task for API development' → Returns: 'Design rate limiting' + Context: past rate limiting implementations, preferred algorithms, performance considerations 🧠 **CONTEXT INTELLIGENCE:** ✓ Relevant past implementations ✓ Preferred patterns and libraries ✓ Common obstacles to avoid ✓ Success patterns from similar tasks ✓ Time estimates based on history ✓ Dependencies automatically resolved",
                inputSchema: {
                    type: "object",
                    properties: {
                        project_name: {
                            type: "string",
                            description: "Project to get tasks from"
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
                description: "📊 **INTELLIGENT TASK COMPLETION TRACKER** - Update task status while capturing valuable learning data. **REPLACES: Basic task checkers, lost lessons, manual time tracking** **AUTO-TRIGGERS: 'completed', 'finished', 'done with', 'blocked by', 'in progress', 'working on', 'stuck on'** 💡 **LEARNING EXAMPLES:** • 'Completed OAuth implementation' → Captures: 6.5 hours actual vs 8 estimated, JWT pattern used, refresh token challenges, next time use library X • 'Blocked on payment integration' → Records: Stripe API rate limits issue, need sandbox credentials, estimated 2-day delay, alternative: PayPal • 'In progress: database migration' → Tracks: started with Alembic, data validation taking longer, discovered foreign key issues, 60% complete 🧠 **LEARNING CAPTURE:** ✓ Actual vs estimated time ✓ Patterns and libraries used ✓ Challenges and solutions ✓ What would you do differently ✓ Reusable code snippets ✓ Future improvement recommendations",
                inputSchema: {
                    type: "object",
                    properties: {
                        task_id: { type: "string" },
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
                name: "suggest_tasks",
                description: "🚀 **AI PROJECT IMPROVEMENT ADVISOR** - Get intelligent task suggestions by analyzing project gaps and opportunities. **REPLACES: Manual project audits, missed improvements, planning overhead** **AUTO-TRIGGERS: 'what's missing', 'improve project', 'suggestions', 'next phase', 'project gaps', 'optimization opportunities'** 🎯 **INTELLIGENT EXAMPLES:** • 'Suggest improvements for API project' → Analysis: Missing rate limiting, no input validation, needs API documentation, suggested load testing, security audit required • 'What's missing in React dashboard?' → Findings: No error boundaries, missing tests for 3 components, performance monitoring needed, accessibility audit suggested • 'Improvement opportunities for microservices?' → Recommendations: Add circuit breakers, implement distributed tracing, containerize remaining services, add health checks 🧠 **AI ANALYSIS DEPTH:** ✓ Code quality gap analysis ✓ Security vulnerability assessment ✓ Performance optimization opportunities ✓ Testing coverage improvements ✓ Documentation completeness review ✓ Best practice compliance check",
                inputSchema: {
                    type: "object",
                    properties: {
                        project_name: {
                            type: "string",
                            description: "Project to analyze and suggest tasks for"
                        },
                        analysis_depth: {
                            type: "string",
                            enum: ["basic", "standard", "comprehensive"],
                            default: "standard",
                            description: "Depth of analysis to perform"
                        },
                        max_suggestions: {
                            type: "number",
                            minimum: 1,
                            maximum: 20,
                            default: 10,
                            description: "Maximum number of task suggestions to return"
                        }
                    },
                    required: ["project_name"]
                }
            },
            {
                name: "get_learning_insights",
                description: "Discover patterns and insights from your entire development history across all projects. **AUTO-TRIGGER PATTERNS: When starting new projects, choosing technologies, making architectural decisions, or planning approaches - automatically get relevant insights from past experiences.** Shows best practices you've developed, anti-patterns to avoid, technology preferences, and actionable improvements. Examples: 'Start Python API project' → automatically get insights about your Python/API preferences, testing patterns, common issues. 'Building React dashboard' → get insights about your React patterns, component architecture, performance optimizations.",
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
                        priority: {
                            type: "string",
                            enum: ["low", "medium", "high", "critical"],
                            description: "Filter by priority level"
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
                description: "📈 **DEEP PATTERN INTELLIGENCE** - Advanced analytics on your coding patterns with success metrics and evolution tracking. **REPLACES: Manual code archaeology, pattern documentation, architectural reviews** **AUTO-TRIGGERS: 'pattern analysis', 'how often do I', 'pattern trends', 'coding style analysis', 'architecture evolution', 'pattern success'** 🎯 **ANALYTICS EXAMPLES:** • 'Analyze my error handling patterns' → Deep dive: try-catch vs Result types (73% vs 27%), success rates per approach, evolution from exceptions to functional error handling over 2 years • 'Security pattern analysis' → Comprehensive: OAuth vs JWT usage trends, authentication pattern evolution, security vulnerability patterns, compliance improvement over time • 'API design pattern study' → Detailed: REST vs GraphQL adoption timeline, endpoint naming conventions, pagination strategies, versioning approaches with success metrics 📊 **ANALYTICS FEATURES:** ✓ Pattern usage frequency trends ✓ Success rate analysis by pattern ✓ Evolution timeline visualization ✓ Cross-project pattern consistency ✓ Performance impact correlation ✓ Maintenance burden analysis ✓ Code example quality scoring",
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
                name: "trigger_learning_analysis",
                description: "⚡ **INSTANT AI LEARNING CATALYST** - Force immediate pattern detection and insight generation from recent work. **REPLACES: Waiting for scheduled analysis, manual pattern identification, delayed insights** **AUTO-TRIGGERS: 'analyze recent work', 'fresh insights', 'immediate analysis', 'pattern detection', 'learning update', 'analyze changes'** 🎯 **IMMEDIATE EXAMPLES:** • 'Analyze recent API work' → Instant: detects new authentication patterns, identifies error handling improvements, discovers performance optimizations from last 50 memories • 'Fresh insights before architecture review' → Real-time: generates latest best practices, identifies recent anti-patterns, prepares recommendation based on current project state • 'Pattern detection after migration' → Live: analyzes migration decisions, captures new deployment patterns, identifies lessons learned for future migrations ⚡ **INSTANT FEATURES:** ✓ Real-time pattern detection ✓ Fresh insight generation ✓ Recent work analysis ✓ Background processing queue ✓ Immediate availability in other tools ✓ Meeting-ready insights in minutes",
                inputSchema: {
                    type: "object",
                    properties: {
                        project_name: {
                            type: "string",
                            description: "Project to analyze (optional, analyzes all if not specified)"
                        },
                        analysis_type: {
                            type: "string",
                            enum: ["pattern_detection", "insight_generation", "preference_analysis", "evolution_tracking"],
                            default: "pattern_detection",
                            description: "Type of analysis to trigger"
                        },
                        memory_limit: {
                            type: "number",
                            minimum: 1,
                            maximum: 500,
                            default: 50,
                            description: "Number of recent memories to analyze"
                        }
                    }
                }
            },
            {
                name: "get_learning_status",
                description: "🔧 **AI LEARNING SYSTEM MONITOR** - Real-time health dashboard for the pattern detection and insight engine. **REPLACES: Manual system checks, troubleshooting guesswork, performance mystery** **AUTO-TRIGGERS: 'system status', 'learning health', 'analysis progress', 'pipeline status', 'processing queue', 'system check'** 📊 **MONITORING EXAMPLES:** • 'Learning system status' → Dashboard: 347 patterns detected, 89 insights generated, 12 memories in queue, last analysis 3 minutes ago, 94% system health • 'Analysis progress check' → Status: pattern detection 85% complete, insight generation 67% done, 23 new patterns found, estimated completion 4 minutes • 'Why no recent insights?' → Diagnostic: queue backed up, embedding service slow, 156 retries pending, recommendation to restart analysis pipeline 🔍 **SYSTEM METRICS:** ✓ Processing queue length and speed ✓ Pattern detection success rates ✓ Insight generation metrics ✓ System health indicators ✓ Last analysis timestamps ✓ Performance bottleneck identification ✓ Troubleshooting recommendations",
                inputSchema: {
                    type: "object",
                    properties: {
                        include_queue: {
                            type: "boolean",
                            default: true,
                            description: "Include processing queue status"
                        },
                        include_metrics: {
                            type: "boolean",
                            default: true,
                            description: "Include pattern and insight metrics"
                        }
                    }
                }
            }
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
            'store_memory', 'search_memories', 'get_memory_by_id', 'create_project_brief', 'store_progress', 'get_progress_history', 'get_insights', 'get_coding_patterns',
            'start_thinking_sequence', 'add_thought', 'get_thinking_sequence', 
            'list_thinking_sequences', 'complete_thinking_sequence', 'create_tasks',
            'get_next_task', 'update_task', 'suggest_tasks', 'get_learning_insights',
            'get_pattern_analysis', 'trigger_learning_analysis', 'get_learning_status'
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
                case "create_project_brief":
                    result = await this._executeWithDebug('create_project_brief', '_createProjectBrief', args, this._createProjectBrief);
                    break;
                case "store_progress":
                    result = await this._executeWithDebug('store_progress', '_storeProgress', args, this._storeProgress);
                    break;
                case "get_progress_history":
                    result = await this._executeWithDebug('get_progress_history', '_getProgressHistory', args, this._getProgressHistory);
                    break;
                case "get_insights":
                    result = await this._executeWithDebug('get_insights', '_getInsights', args, this._getInsights);
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
                case "get_next_task":
                    result = await this._executeWithDebug('get_next_task', '_getNextTask', args, this._getNextTask);
                    break;
                case "update_task":
                    result = await this._executeWithDebug('update_task', '_updateTask', args, this._updateTask);
                    break;
                case "suggest_tasks":
                    result = await this._executeWithDebug('suggest_tasks', '_suggestTasks', args, this._suggestTasks);
                    break;
                case "get_learning_insights":
                    result = await this._executeWithDebug('get_learning_insights', '_getLearningInsights', args, this._getLearningInsights);
                    break;
                case "get_pattern_analysis":
                    result = await this._executeWithDebug('get_pattern_analysis', '_getPatternAnalysis', args, this._getPatternAnalysis);
                    break;
                case "trigger_learning_analysis":
                    result = await this._executeWithDebug('trigger_learning_analysis', '_triggerLearningAnalysis', args, this._triggerLearningAnalysis);
                    break;
                case "get_learning_status":
                    result = await this._executeWithDebug('get_learning_status', '_getLearningStatus', args, this._getLearningStatus);
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

        // Store memory
        this._debugLog('store_memory', 'STORING_TO_DB');
        const result = await this.db.query(`
            INSERT INTO memories 
            (project_id, session_id, content, memory_type, embedding, 
             embedding_model, embedding_dimensions, importance_score, tags)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
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
            tags
        ]);

        const memoryId = result.rows[0].id;
        this._debugLog('store_memory', 'DB_INSERT_COMPLETE', { memory_id: memoryId });

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

        this._debugLog('store_memory', 'COMPLETE', { 
            memory_id: memoryId,
            project: project_name,
            session: session_name 
        });

        return {
            content: [{
                type: "text",
                text: `Memory stored successfully!\n\nDetails:\n- Memory ID: ${memoryId}\n- Project: ${project_name}\n- Session: ${session_name}\n- Type: ${memory_type}\n- Importance: ${finalImportanceScore}\n- Embedding dimensions: ${embedding.length}\n- Created: ${result.rows[0].created_at}`
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
                p.name as project_name, s.name as session_name${include_embedding ? ', m.embedding' : ''}
            `;

            const result = await this.db.query(`
                SELECT ${selectColumns}
                FROM memories m
                JOIN projects p ON m.project_id = p.id
                JOIN sessions s ON m.session_id = s.id
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

    async _createProjectBrief(args) {
        const { 
            project_name, 
            project_description, 
            include_tasks = true, 
            include_technical_analysis = true, 
            sections = ["planning", "technical", "progress"] 
        } = args;

        try {
            const briefSections = {};
            
            // 1. Search for relevant past experiences
            const relevantMemories = await this._searchMemoriesInternal(project_description, project_name, null, 5, 0.3);
            
            // 2. Get technology insights if requested
            let techInsights = null;
            if (include_technical_analysis) {
                try {
                    const insightsResult = await this._getLearningInsights({ 
                        project_name, 
                        insight_type: "best_practice", 
                        limit: 10 
                    });
                    techInsights = insightsResult.content[0].text;
                } catch (error) {
                    this.logger.warn('Could not fetch learning insights:', error.message);
                }
            }

            // 3. Generate each requested section
            for (const section of sections) {
                switch (section) {
                    case "planning":
                        briefSections.planning = await this._generatePlanningSection(project_name, project_description, relevantMemories);
                        break;
                    case "technical":
                        briefSections.technical = await this._generateTechnicalSection(project_name, project_description, techInsights, relevantMemories);
                        break;
                    case "progress":
                        briefSections.progress = await this._generateProgressSection(project_name);
                        break;
                    case "requirements":
                        briefSections.requirements = await this._generateRequirementsSection(project_description);
                        break;
                    case "architecture":
                        briefSections.architecture = await this._generateArchitectureSection(project_description, relevantMemories);
                        break;
                    case "timeline":
                        briefSections.timeline = await this._generateTimelineSection(project_description);
                        break;
                    case "risks":
                        briefSections.risks = await this._generateRisksSection(project_description, relevantMemories);
                        break;
                }
            }

            // 4. Create comprehensive brief content
            const briefContent = this._formatProjectBrief(project_name, project_description, briefSections);

            // 5. Store the brief as a memory
            await this._storeMemory({
                content: briefContent,
                project_name,
                memory_type: "project_brief",
                importance: 0.9,
                tags: ["project_brief", "planning", ...sections]
            });

            // 6. Create tasks if requested
            let tasksCreated = [];
            if (include_tasks) {
                try {
                    const tasksResult = await this._createTasks({
                        project_name,
                        requirements: briefContent,
                        source_type: "project_brief"
                    });
                    tasksCreated = tasksResult.tasks || [];
                } catch (error) {
                    this.logger.warn('Could not create tasks from brief:', error.message);
                }
            }

            return {
                content: [{
                    type: "text",
                    text: `# Project Brief Created Successfully

## Brief Content
${briefContent}

${tasksCreated.length > 0 ? `\n## Tasks Created
${tasksCreated.length} tasks were automatically created from this brief:
${tasksCreated.slice(0, 5).map(task => `- ${task.title} (Priority: ${task.priority})`).join('\n')}${tasksCreated.length > 5 ? `\n...and ${tasksCreated.length - 5} more tasks` : ''}

Use \`get_next_task\` to see your highest priority task.` : ''}

## Next Steps
- Use \`search_memories\` to find related project information
- Use \`get_learning_insights\` for technology recommendations
- Use \`create_tasks\` to add more specific implementation tasks`
                }]
            };
        } catch (error) {
            this.logger.error('Failed to create project brief:', error);
            throw error;
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
        return `## Planning

### Project Overview
**Project Name:** ${project_name}
**Description:** ${description}

### Objectives
- Define clear project scope and deliverables
- Establish development milestones
- Identify key success metrics

### Scope
- Core functionality implementation
- Testing and quality assurance
- Documentation and deployment

${relevantMemories.length > 0 ? `### Related Experience
${relevantMemories.substring(0, 300)}...` : ''}`;
    }

    async _generateTechnicalSection(project_name, description, techInsights, relevantMemories) {
        return `## Technical

### Technology Stack
- Based on project requirements and past experience
- Consider scalability and maintainability requirements
- Leverage proven technologies from similar projects

### Architecture
- Modular design approach
- Clear separation of concerns
- Scalable and testable structure

${techInsights ? `### Technology Recommendations
${techInsights.substring(0, 500)}...` : ''}

### Development Environment
- Version control setup
- Development tooling
- Testing framework configuration`;
    }

    async _generateProgressSection(project_name) {
        // Try to get current project status
        let currentTasks = '';
        try {
            const tasksResult = await this._getNextTask({ project_name });
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
        return `## Requirements

### Functional Requirements
- Core features based on project description
- User interaction requirements
- Performance expectations

### Non-Functional Requirements
- Security considerations
- Performance benchmarks
- Scalability requirements
- Maintainability standards

### Project Description Analysis
${description}`;
    }

    async _generateArchitectureSection(description, relevantMemories) {
        return `## Architecture

### System Design
- High-level component overview
- Data flow architecture
- Integration points

### Design Patterns
- Recommended patterns based on project type
- Proven approaches from similar implementations

### Scalability Considerations
- Performance optimization strategies
- Resource management
- Future expansion capabilities

${relevantMemories.length > 0 ? `### Lessons from Similar Projects
${relevantMemories.substring(0, 300)}...` : ''}`;
    }

    async _generateTimelineSection(description) {
        return `## Timeline

### Phase 1: Setup & Planning (Week 1)
- Environment configuration
- Initial architecture design
- Core dependencies setup

### Phase 2: Core Development (Weeks 2-4)
- Primary feature implementation
- Basic testing framework
- Documentation foundation

### Phase 3: Integration & Testing (Week 5)
- Component integration
- Comprehensive testing
- Performance optimization

### Phase 4: Deployment & Documentation (Week 6)
- Production deployment
- Final documentation
- Project wrap-up`;
    }

    async _generateRisksSection(description, relevantMemories) {
        return `## Risks & Mitigation

### Technical Risks
- **Technology Learning Curve:** Allow extra time for new technology adoption
- **Integration Complexity:** Plan for thorough testing of component interactions
- **Performance Issues:** Implement monitoring and optimization from early stages

### Project Risks
- **Scope Creep:** Maintain clear requirements documentation
- **Timeline Delays:** Build buffer time into milestones
- **Resource Constraints:** Identify critical path dependencies early

### Mitigation Strategies
- Regular progress reviews
- Incremental development approach
- Continuous testing and validation

${relevantMemories.length > 0 ? `### Historical Insights
Based on similar projects, common issues include:
${relevantMemories.substring(0, 200)}...` : ''}`;
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
                    SELECT version FROM memories 
                    WHERE project_id = $1 AND memory_type = 'progress'
                    ORDER BY created_at DESC LIMIT 1
                `, [project.id]);

                if (latestProgress.rows.length > 0) {
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
                importance: 0.8,
                tags: ["progress", "version", milestone_type, ...tags],
                metadata: progressMetadata
            });

            // Update project completion if provided
            if (completion_percentage !== undefined) {
                await this.db.query(`
                    UPDATE projects 
                    SET metadata = COALESCE(metadata, '{}') || $2
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

    async _getInsights(args) {
        const { 
            insight_type, 
            min_confidence = 0.7, 
            limit = 20 
        } = args;

        let query = `
            SELECT 
                insight_type,
                insight_category,
                insight_title,
                insight_description,
                confidence_level,
                evidence_strength,
                projects_involved,
                last_reinforced
            FROM meta_insights
            WHERE confidence_level >= $1
        `;

        const params = [min_confidence];
        let paramCount = 1;

        if (insight_type) {
            paramCount++;
            query += ` AND insight_type = $${paramCount}`;
            params.push(insight_type);
        }

        query += `
            ORDER BY confidence_level DESC, evidence_strength DESC
            LIMIT $${paramCount + 1}
        `;
        params.push(limit);

        const result = await this.db.query(query, params);

        if (result.rows.length === 0) {
            return {
                content: [{
                    type: "text",
                    text: `No insights found with confidence >= ${min_confidence}`
                }]
            };
        }

        const insights = result.rows.map((row, i) => 
            `${i + 1}. **${row.insight_title}** (${row.insight_type})\n` +
            `   Category: ${row.insight_category}\n` +
            `   Confidence: ${(row.confidence_level * 100).toFixed(1)}% | Evidence: ${(row.evidence_strength * 100).toFixed(1)}%\n` +
            `   Projects: ${row.projects_involved?.join(', ') || 'none'}\n` +
            `   Description: ${row.insight_description}\n` +
            `   Last reinforced: ${row.last_reinforced}\n`
        ).join('\n');

        return {
            content: [{
                type: "text",
                text: `Meta-Learning Insights (${result.rows.length}):\n\n${insights}`
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
            content,
            thought_type = "reasoning",
            confidence_level = 0.5,
            next_thought_needed = true
        } = args;

        try {
            const thought = await this.sequentialThinking.addThought(
                sequence_id,
                content,
                {
                    thoughtType: thought_type,
                    confidenceLevel: confidence_level,
                    nextThoughtNeeded: next_thought_needed
                }
            );

            return {
                content: [{
                    type: "text",
                    text: `Added thought ${thought.thought_number}/${thought.total_thoughts}\n\n` +
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

    async _getNextTask(args) {
        const {
            project_name,
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
                LIMIT 10
            `;

            const result = await this.db.query(query, [project.id]);

            if (result.rows.length === 0) {
                return {
                    content: [{
                        type: "text",
                        text: `No pending tasks found for project "${project_name}".`
                    }]
                };
            }

            // Parse and filter tasks
            let tasks = result.rows.map(row => {
                const taskData = JSON.parse(row.content);
                return {
                    ...taskData,
                    memory_id: row.memory_id,
                    priority_score: row.priority_score
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

            const nextTask = tasks[0];
            let context = {};

            // Load context if requested
            if (include_context && nextTask.context_requirements) {
                for (const memType of nextTask.context_requirements) {
                    const memories = await this._searchMemoriesByType(project_name, memType, 3);
                    context[memType] = memories;
                }
            }

            return {
                content: [{
                    type: "text",
                    text: `Next Task: ${nextTask.title}\n` +
                          `Priority Score: ${nextTask.priority_score.toFixed(2)}\n` +
                          `Category: ${nextTask.category}\n` +
                          `Status: ${nextTask.status}\n\n` +
                          `Description: ${nextTask.description || 'No description provided'}\n\n` +
                          `${include_context && Object.keys(context).length > 0 ? 
                            `Required Context Loaded:\n${Object.entries(context).map(([type, mems]) => 
                                `- ${type}: ${mems.length} memories`).join('\n')}\n\n` : ''
                          }` +
                          `${nextTask.estimated_hours ? `Estimated Hours: ${nextTask.estimated_hours}\n` : ''}` +
                          `${nextTask.due_date ? `Due Date: ${nextTask.due_date}\n` : ''}` +
                          `${nextTask.tags ? `Tags: ${nextTask.tags.join(', ')}\n` : ''}`
                }],
                task: nextTask,
                context: context
            };

        } catch (error) {
            return {
                content: [{
                    type: "text",
                    text: `Error getting next task: ${error.message}`
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

    async _suggestTasks(args) {
        const {
            project_name,
            analysis_depth = 'standard',
            max_suggestions = 10
        } = args;

        try {
            // Basic project analysis and suggestions
            const projectAnalysis = await this.analyzeProjectBasic(project_name);
            const suggestions = await this.generateBasicSuggestions(projectAnalysis, max_suggestions);

            return {
                content: [{
                    type: "text",
                    text: `AI Analysis for "${project_name}":\n\n` +
                          `Project Health: ${projectAnalysis.health_score}/10\n` +
                          `Analysis Depth: ${analysis_depth}\n\n` +
                          `Suggested ${suggestions.length} tasks based on project analysis:\n\n${
                              suggestions.map((s, i) => 
                                  `${i+1}. **${s.title}** (${s.category})\n` +
                                  `   Priority: ${s.priority.urgency}/${s.priority.impact}\n` +
                                  `   Effort: ${s.estimated_hours}h\n` +
                                  `   Reason: ${s.reasoning}\n`
                              ).join('\n')
                          }\n\nUse create_tasks tool with source_type="ai_suggested" to add these suggestions.`
                }],
                suggestions: suggestions,
                analysis: projectAnalysis
            };

        } catch (error) {
            return {
                content: [{
                    type: "text",
                    text: `Error generating task suggestions: ${error.message}`
                }],
                isError: true
            };
        }
    }

    async analyzeProjectBasic(projectName) {
        const project = await this._getOrCreateProject(projectName);
        
        // Get project metrics
        const memoriesResult = await this.db.query(
            `SELECT memory_type, COUNT(*) as count, AVG(importance_score) as avg_importance
             FROM memories 
             WHERE project_id = $1 
             GROUP BY memory_type
             ORDER BY count DESC`,
            [project.id]
        );

        const memoryStats = {};
        let totalMemories = 0;
        let avgImportance = 0;

        for (const row of memoriesResult.rows) {
            memoryStats[row.memory_type] = {
                count: parseInt(row.count),
                avg_importance: parseFloat(row.avg_importance_score)
            };
            totalMemories += parseInt(row.count);
            avgImportance += parseFloat(row.avg_importance_score) * parseInt(row.count);
        }

        if (totalMemories > 0) {
            avgImportance = avgImportance / totalMemories;
        }

        // Calculate health score
        let healthScore = 5; // Base score

        // Bonus for having key documentation
        if (memoryStats.project_brief) healthScore += 1;
        if (memoryStats.architecture) healthScore += 1;
        if (memoryStats.requirements) healthScore += 1;

        // Bonus for testing and quality
        if (memoryStats.code && memoryStats.code.count > 0) {
            const testRatio = (memoryStats.test?.count || 0) / memoryStats.code.count;
            if (testRatio > 0.3) healthScore += 1;
        }

        // Penalty for high bug count
        if (memoryStats.bug && memoryStats.bug.count > totalMemories * 0.2) {
            healthScore -= 1;
        }

        return {
            project_name: projectName,
            total_memories: totalMemories,
            memory_breakdown: memoryStats,
            avg_importance: avgImportance,
            health_score: Math.min(10, Math.max(1, healthScore)),
            has_documentation: !!(memoryStats.project_brief || memoryStats.requirements),
            has_architecture: !!memoryStats.architecture,
            test_coverage_estimated: memoryStats.code ? 
                ((memoryStats.test?.count || 0) / memoryStats.code.count * 100) : 0
        };
    }

    async generateBasicSuggestions(analysis, maxSuggestions) {
        const suggestions = [];

        // Documentation suggestions
        if (!analysis.has_documentation) {
            suggestions.push({
                title: "Create project documentation",
                description: "Add project brief and requirements documentation to improve project clarity",
                category: "documentation",
                priority: { urgency: "medium", impact: "high", effort: "medium" },
                estimated_hours: 4,
                reasoning: "No project documentation found"
            });
        }

        if (!analysis.has_architecture) {
            suggestions.push({
                title: "Document system architecture",
                description: "Create architecture documentation showing system design and component relationships",
                category: "documentation", 
                priority: { urgency: "medium", impact: "high", effort: "medium" },
                estimated_hours: 6,
                reasoning: "No architecture documentation found"
            });
        }

        // Testing suggestions
        if (analysis.test_coverage_estimated < 50) {
            suggestions.push({
                title: "Improve test coverage",
                description: `Increase test coverage from ${analysis.test_coverage_estimated.toFixed(1)}% to at least 70%`,
                category: "testing",
                priority: { urgency: "high", impact: "high", effort: "high" },
                estimated_hours: 16,
                reasoning: `Low test coverage (${analysis.test_coverage_estimated.toFixed(1)}%)`
            });
        }

        // Quality improvements
        if (analysis.memory_breakdown.bug && analysis.memory_breakdown.bug.count > 3) {
            suggestions.push({
                title: "Address outstanding bugs",
                description: `Fix ${analysis.memory_breakdown.bug.count} known bugs to improve system stability`,
                category: "bug",
                priority: { urgency: "high", impact: "medium", effort: "medium" },
                estimated_hours: analysis.memory_breakdown.bug.count * 2,
                reasoning: `${analysis.memory_breakdown.bug.count} bugs found in memory`
            });
        }

        // Code organization
        if (analysis.memory_breakdown.code && analysis.memory_breakdown.code.count > 10) {
            suggestions.push({
                title: "Refactor and organize codebase",
                description: "Review and refactor code for better maintainability and organization",
                category: "refactor",
                priority: { urgency: "medium", impact: "medium", effort: "high" },
                estimated_hours: 20,
                reasoning: "Large codebase may benefit from refactoring"
            });
        }

        // Performance optimization
        if (analysis.memory_breakdown.implementation_notes && 
            analysis.memory_breakdown.implementation_notes.avg_importance < 0.6) {
            suggestions.push({
                title: "Review and optimize implementation",
                description: "Review implementation notes and optimize for better performance",
                category: "optimization",
                priority: { urgency: "medium", impact: "medium", effort: "medium" },
                estimated_hours: 12,
                reasoning: "Implementation notes suggest optimization opportunities"
            });
        }

        // General improvements
        if (analysis.avg_importance < 0.6) {
            suggestions.push({
                title: "Review and prioritize project memories",
                description: "Review stored memories and update importance scores for better organization",
                category: "feature",
                priority: { urgency: "low", impact: "medium", effort: "low" },
                estimated_hours: 4,
                reasoning: "Low average memory importance suggests need for review"
            });
        }

        // Security review
        if (analysis.total_memories > 20) {
            suggestions.push({
                title: "Conduct security review",
                description: "Perform comprehensive security review of the system",
                category: "feature",
                priority: { urgency: "medium", impact: "high", effort: "medium" },
                estimated_hours: 8,
                reasoning: "Mature project should have regular security reviews"
            });
        }

        return suggestions.slice(0, maxSuggestions);
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
            priority, 
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

            // Actionable filter
            if (actionable_only) {
                whereConditions.push('actionable = true');
            }

            // Priority filter
            if (priority) {
                whereConditions.push('priority = $' + (queryParams.length + 1));
                queryParams.push(priority);
            }

            const query = `
                SELECT 
                    id, insight_type, insight_category, insight_title, insight_description,
                    confidence_level, evidence_strength, projects_involved, 
                    metadata, actionable, priority, last_reinforced
                FROM meta_insights
                WHERE ${whereConditions.join(' AND ')}
                ORDER BY 
                    CASE priority 
                        WHEN 'critical' THEN 1 
                        WHEN 'high' THEN 2 
                        WHEN 'medium' THEN 3 
                        ELSE 4 
                    END,
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
                    actionable: insight.actionable,
                    priority: insight.priority,
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
**${insight.title}** ${insight.actionable ? '🎯' : ''} ${insight.priority === 'high' ? '⚠️' : insight.priority === 'critical' ? '🚨' : ''}
- *Confidence: ${Math.round(insight.confidence * 100)}% | Evidence: ${insight.evidence_strength} points*
- Projects: ${insight.projects.join(', ')}
- ${insight.description}
${insight.actionable ? `- 💡 **Action Required** (Priority: ${insight.priority})` : ''}
`).join('')}`).join('')}

## Statistics
- **Actionable Insights**: ${result.rows.filter(i => i.actionable).length}
- **High Priority**: ${result.rows.filter(i => i.priority === 'high').length}
- **Cross-Project Insights**: ${result.rows.filter(i => i.projects_involved?.length > 1).length}
- **Average Confidence**: ${result.rows.length > 0 ? Math.round(result.rows.reduce((sum, i) => sum + i.confidence_level, 0) / result.rows.length * 100) : 0}%`
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

    /**
     * Trigger immediate learning analysis
     */
    async _triggerLearningAnalysis(args) {
        const { project_name, analysis_type = 'pattern_detection', memory_limit = 50 } = args;

        try {
            // Get recent memories to analyze
            let query = `
                SELECT m.id, m.project_id, m.content, m.memory_type, p.name as project_name
                FROM memories m 
                JOIN projects p ON m.project_id = p.id
                WHERE m.created_at > NOW() - INTERVAL '7 days'
            `;
            const queryParams = [];

            if (project_name) {
                query += ' AND p.name = $1';
                queryParams.push(project_name);
            }

            query += ` ORDER BY m.created_at DESC LIMIT $${queryParams.length + 1}`;
            queryParams.push(memory_limit);

            const memoriesResult = await this.db.query(query, queryParams);

            if (memoriesResult.rows.length === 0) {
                return {
                    content: [{
                        type: "text",
                        text: `No recent memories found to analyze${project_name ? ` for project: ${project_name}` : ''}.`
                    }]
                };
            }

            // Queue analysis tasks
            let tasksQueued = 0;
            for (const memory of memoriesResult.rows) {
                await this.learningPipeline.queueLearningTask(analysis_type, {
                    memoryId: memory.id,
                    projectId: memory.project_id,
                    content: memory.content,
                    trigger: 'manual_analysis'
                }, 2); // High priority for manual triggers
                tasksQueued++;
            }

            // Trigger immediate processing
            const processedTasks = await this.learningPipeline.processLearningQueue(tasksQueued);

            return {
                content: [{
                    type: "text",
                    text: `# Learning Analysis Triggered

## Request Summary
- **Analysis Type**: ${analysis_type.replace(/_/g, ' ')}
- **Project**: ${project_name || 'All projects'}
- **Memories Analyzed**: ${memoriesResult.rows.length}
- **Tasks Queued**: ${tasksQueued}
- **Tasks Processed**: ${processedTasks}

## Status
✅ Analysis has been queued and ${processedTasks > 0 ? 'processing has begun' : 'will be processed shortly'}.

${processedTasks > 0 ? `
**${processedTasks}** tasks were processed immediately. You can use the following tools to view results:
- \`get_learning_insights\` - View generated insights
- \`get_pattern_analysis\` - View detected patterns
- \`get_learning_status\` - Check processing status
` : `
Tasks are queued for processing. Check status with \`get_learning_status\` or wait a few minutes and use \`get_learning_insights\` to view results.
`}

## Next Steps
1. Wait 2-5 minutes for processing to complete
2. Use \`get_learning_insights\` to see new insights
3. Use \`get_pattern_analysis\` to see detected patterns`
                }]
            };
        } catch (error) {
            this.logger.error('Failed to trigger learning analysis:', error);
            throw error;
        }
    }

    /**
     * Get learning pipeline status
     */
    async _getLearningStatus(args) {
        const { include_queue = true, include_metrics = true } = args;

        try {
            const status = await this.learningPipeline.getStatus();
            
            let statusText = `# Learning Pipeline Status

## Current State
- **Status**: ${status.status}
- **Real-time Processing**: ${status.realTimeEnabled ? '✅ Enabled' : '❌ Disabled'}
- **Scheduled Processing**: ${status.scheduledEnabled ? '✅ Enabled' : '❌ Disabled'}
- **Memory Buffer**: ${status.memoryBufferSize} pending memories

`;

            if (include_queue && status.queue) {
                statusText += `## Processing Queue
${status.queue.map(q => `- **${q.status}**: ${q.count} tasks`).join('\n')}

`;
            }

            if (include_metrics) {
                if (status.patterns && Object.keys(status.patterns).length > 0) {
                    statusText += `## Pattern Metrics
- **Total Patterns**: ${status.patterns.total_patterns || 0}
- **Average Confidence**: ${status.patterns.avg_confidence ? Math.round(status.patterns.avg_confidence * 100) + '%' : 'N/A'}
- **Projects Covered**: ${status.patterns.unique_projects || 0}

`;
                }

                if (status.insights && status.insights.length > 0) {
                    statusText += `## Insight Metrics
${status.insights.map(i => `- **${i.insight_type}**: ${i.count} insights`).join('\n')}

`;
                }
            }

            if (status.lastProcessed) {
                statusText += `## Last Processing Times
${Object.entries(status.lastProcessed).map(([type, time]) => 
                    `- **${type}**: ${time ? new Date(time).toISOString().replace('T', ' ').split('.')[0] : 'Never'}`
                ).join('\n')}
`;
            }

            return {
                content: [{
                    type: "text",
                    text: statusText
                }]
            };
        } catch (error) {
            this.logger.error('Failed to get learning status:', error);
            throw error;
        }
    }
}