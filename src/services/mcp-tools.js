/**
 * MCP Tools Service for MiniMe-MCP
 * Manages outward-facing tools for MCP client discovery and execution
 */

export class MCPToolsService {
    constructor(logger, dbPool, embeddingService, learningPipeline, sequentialThinkingService = null) {
        this.logger = logger;
        this.db = dbPool;
        this.embeddingService = embeddingService;
        this.learningPipeline = learningPipeline;
        this.sequentialThinking = sequentialThinkingService;
    }

    /**
     * Get all outward-facing tools for MCP discovery
     * These are the tools that external clients can discover and use
     */
    getPublicTools() {
        return [
            {
                name: "store_memory",
                description: "Store a new memory in the MiniMe system with automatic embedding generation",
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
                            description: "Type of memory (e.g., 'code', 'decision', 'insight', 'general', 'progress', 'summary', 'release_version', 'prd')",
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
                description: "Search for memories using semantic similarity based on vector embeddings",
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
                            description: "Filter by memory type (e.g., 'code', 'decision', 'insight', 'general', 'progress', 'summary', 'release_version', 'prd') (optional)"
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
                            default: 0.7,
                            description: "Minimum similarity threshold"
                        }
                    },
                    required: ["query"]
                }
            },
            {
                name: "get_projects",
                description: "List all projects with their memory counts and activity",
                inputSchema: {
                    type: "object",
                    properties: {
                        include_stats: {
                            type: "boolean",
                            default: true,
                            description: "Include memory counts and last activity"
                        }
                    }
                }
            },
            {
                name: "get_project_sessions",
                description: "Get all sessions within a specific project",
                inputSchema: {
                    type: "object",
                    properties: {
                        project_name: {
                            type: "string",
                            description: "Name of the project"
                        },
                        active_only: {
                            type: "boolean",
                            default: false,
                            description: "Only return active sessions"
                        }
                    },
                    required: ["project_name"]
                }
            },
            {
                name: "get_insights",
                description: "Retrieve meta-learning insights and patterns discovered across projects",
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
                            default: 0.7,
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
                description: "Get coding patterns that have been detected across projects",
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
                description: "Start a new sequential thinking process for complex reasoning",
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
                description: "Add a thought to an existing thinking sequence",
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
                description: "Retrieve a thinking sequence with all its thoughts",
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
                description: "List thinking sequences for a project",
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
                description: "Complete a thinking sequence and generate a summary",
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
            }
        ];
    }

    /**
     * Execute a tool by name with given arguments
     * This is the main dispatcher for tool execution
     */
    async executeTool(toolName, args) {
        this.logger.info(`Executing tool: ${toolName}`, { args });

        try {
            switch (toolName) {
                case "store_memory":
                    return await this._storeMemory(args);
                case "search_memories":
                    return await this._searchMemories(args);
                case "get_projects":
                    return await this._getProjects(args);
                case "get_project_sessions":
                    return await this._getProjectSessions(args);
                case "get_insights":
                    return await this._getInsights(args);
                case "get_coding_patterns":
                    return await this._getCodingPatterns(args);
                case "start_thinking_sequence":
                    return await this._startThinkingSequence(args);
                case "add_thought":
                    return await this._addThought(args);
                case "get_thinking_sequence":
                    return await this._getThinkingSequence(args);
                case "list_thinking_sequences":
                    return await this._listThinkingSequences(args);
                case "complete_thinking_sequence":
                    return await this._completeThinkingSequence(args);
                default:
                    throw new Error(`Unknown tool: ${toolName}`);
            }
        } catch (error) {
            this.logger.error(`Tool execution failed: ${toolName}`, error);
            return {
                content: [{ 
                    type: "text", 
                    text: `Error executing ${toolName}: ${error.message}` 
                }],
                isError: true
            };
        }
    }

    /**
     * PRIVATE TOOL IMPLEMENTATIONS
     * These are not exposed in MCP discovery but handle the actual tool logic
     */

    async _storeMemory(args) {
        const { 
            content, 
            project_name, 
            session_name = "default", 
            memory_type = "general",
            importance_score = 0.5,
            tags = []
        } = args;

        // Get or create project
        const project = await this._getOrCreateProject(project_name);
        
        // Get or create session
        const session = await this._getOrCreateSession(project.id, session_name);

        // Generate embedding
        const embedding = await this.embeddingService.generateEmbedding(content);
        const defaultModel = await this.embeddingService.getDefaultModel();
        const modelConfig = await this.embeddingService.getModelConfig(defaultModel);

        // Store memory
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
            importance_score,
            tags
        ]);

        const memoryId = result.rows[0].id;

        // Trigger learning pipeline (real-time processing)
        if (this.learningPipeline) {
            await this.learningPipeline.onMemoryAdded(memoryId, project.id, content);
        }

        return {
            content: [{
                type: "text",
                text: `Memory stored successfully!\n\nDetails:\n- Memory ID: ${memoryId}\n- Project: ${project_name}\n- Session: ${session_name}\n- Type: ${memory_type}\n- Importance: ${importance_score}\n- Embedding dimensions: ${embedding.length}\n- Created: ${result.rows[0].created_at}`
            }]
        };
    }

    async _searchMemories(args) {
        const { 
            query, 
            project_name, 
            memory_type, 
            limit = 10, 
            min_similarity = 0.7 
        } = args;

        // Generate query embedding
        const queryEmbedding = await this.embeddingService.generateEmbedding(query);

        // Build search query
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

        const results = await this.db.query(searchSQL, params);

        if (results.rows.length === 0) {
            return {
                content: [{
                    type: "text",
                    text: `No memories found matching "${query}" with similarity >= ${min_similarity}`
                }]
            };
        }

        const formattedResults = results.rows.map((row, i) => 
            `${i + 1}. **${row.project_name}/${row.session_name}** (${row.memory_type})\n` +
            `   Similarity: ${(row.similarity * 100).toFixed(1)}% | Importance: ${row.importance_score}\n` +
            `   Content: ${row.content.substring(0, 200)}${row.content.length > 200 ? '...' : ''}\n` +
            `   Tags: ${row.tags?.join(', ') || 'none'}\n` +
            `   Created: ${row.created_at}\n`
        ).join('\n');

        return {
            content: [{
                type: "text",
                text: `Found ${results.rows.length} memories matching "${query}":\n\n${formattedResults}`
            }]
        };
    }

    async _getProjects(args) {
        const { include_stats = true } = args;

        if (include_stats) {
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
}