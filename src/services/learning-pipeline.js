/**
 * Learning Pipeline for MiniMe-MCP
 * Handles continuous learning from memories and scheduled analysis
 */

import { EmbeddingService } from './embedding-service.js';

export class LearningPipeline {
    constructor(logger, databaseService, embeddingService, llmService = null) {
        this.logger = logger;
        this.db = databaseService;
        this.embeddingService = embeddingService;
        this.llmService = llmService;
        
        // Learning configuration
        this.config = {
            // Real-time triggers
            realTime: {
                enabled: true,
                batchSize: 10,          // Process N memories at once
                triggerThreshold: 5,    // Trigger after N new memories
                minConfidence: 0.6      // Minimum confidence for pattern detection
            },
            
            // Scheduled processing
            scheduled: {
                enabled: true,
                intervals: {
                    patternDetection: '0 */6 * * *',    // Every 6 hours
                    insightGeneration: '0 2 * * *',     // Daily at 2 AM
                    preferenceAnalysis: '0 3 * * 0',    // Weekly on Sunday
                    evolutionTracking: '0 1 * * *'      // Daily at 1 AM
                }
            },
            
            // Learning thresholds
            thresholds: {
                patternMinFrequency: 3,     // Pattern must appear 3+ times
                insightMinEvidence: 5,      // Insight needs 5+ supporting memories
                preferenceMinProjects: 2,   // Tech preference needs 2+ projects
                evolutionMinChange: 0.1     // Minimum change to track evolution
            }
        };
        
        // Processing state
        this.isProcessing = false;
        this.lastProcessed = {
            patternDetection: null,
            insightGeneration: null,
            preferenceAnalysis: null
        };
        
        // Memory buffer for real-time processing
        this.memoryBuffer = [];
    }

    /**
     * Initialize the learning pipeline
     */
    async initialize() {
        try {
            this.logger.info('Initializing learning pipeline...');
            
            // Set up real-time triggers if enabled
            if (this.config.realTime.enabled) {
                await this.setupRealTimeTriggers();
            }
            
            // Set up scheduled processing if enabled
            if (this.config.scheduled.enabled) {
                await this.setupScheduledProcessing();
            }
            
            // Clean up stale processing queue items
            await this.cleanupProcessingQueue();
            
            this.logger.info('Learning pipeline initialized successfully');
            return true;
        } catch (error) {
            this.logger.error('Failed to initialize learning pipeline:', error);
            throw error;
        }
    }

    /**
     * Real-time learning trigger when new memories are added
     */
    async onMemoryAdded(memoryId, projectId, content) {
        if (!this.config.realTime.enabled) return;

        try {
            // Add to processing buffer
            this.memoryBuffer.push({
                id: memoryId,
                projectId,
                content,
                timestamp: new Date()
            });

            this.logger.debug(`Memory ${memoryId} added to learning buffer`);

            // Trigger processing if threshold reached
            if (this.memoryBuffer.length >= this.config.realTime.triggerThreshold) {
                await this.processMemoryBuffer();
            }
        } catch (error) {
            this.logger.error('Error in real-time memory processing:', error);
        }
    }

    /**
     * Process accumulated memories for patterns
     */
    async processMemoryBuffer() {
        if (this.memoryBuffer.length === 0 || this.isProcessing) return;

        try {
            this.isProcessing = true;
            this.logger.info(`Processing ${this.memoryBuffer.length} memories for patterns`);

            // Take batch from buffer
            const batch = this.memoryBuffer.splice(0, this.config.realTime.batchSize);
            
            // Queue pattern detection tasks
            for (const memory of batch) {
                await this.queueLearningTask('pattern_detection', {
                    memoryId: memory.id,
                    projectId: memory.projectId,
                    content: memory.content,
                    trigger: 'real_time'
                }, 3); // Medium priority
            }

            // If significant activity, queue insight generation
            if (batch.length >= this.config.realTime.batchSize) {
                await this.queueLearningTask('insight_generation', {
                    triggerType: 'activity_spike',
                    memoryCount: batch.length,
                    projectIds: [...new Set(batch.map(m => m.projectId))]
                }, 4); // Lower priority
            }

        } catch (error) {
            this.logger.error('Error processing memory buffer:', error);
        } finally {
            this.isProcessing = false;
        }
    }

    /**
     * Queue a learning task for scheduled processing
     */
    async queueLearningTask(taskType, payload, priority = 5) {
        try {
            await this.db.query(`
                INSERT INTO learning_processing_queue 
                (task_type, task_priority, task_payload, scheduled_for)
                VALUES ($1, $2, $3, NOW())
            `, [taskType, priority, JSON.stringify(payload)]);

            this.logger.debug(`Queued ${taskType} task with priority ${priority}`);
        } catch (error) {
            this.logger.error(`Failed to queue ${taskType} task:`, error);
        }
    }

    /**
     * Process pending learning tasks from queue
     */
    async processLearningQueue(maxTasks = 10) {
        try {
            // Get pending tasks ordered by priority and schedule
            const result = await this.db.query(`
                SELECT id, task_type, task_payload, retry_count
                FROM learning_processing_queue
                WHERE status = 'pending' 
                  AND scheduled_for <= NOW()
                ORDER BY task_priority ASC, scheduled_for ASC
                LIMIT $1
                FOR UPDATE SKIP LOCKED
            `, [maxTasks]);

            if (result.rows.length === 0) {
                this.logger.debug('No pending learning tasks to process');
                return 0;
            }

            this.logger.info(`Processing ${result.rows.length} learning tasks`);
            let processedCount = 0;

            for (const task of result.rows) {
                try {
                    // Mark as processing
                    await this.db.query(`
                        UPDATE learning_processing_queue 
                        SET status = 'processing', started_at = NOW()
                        WHERE id = $1
                    `, [task.id]);

                    const startTime = Date.now();
                    let result;

                    // Process based on task type
                    switch (task.task_type) {
                        case 'pattern_detection':
                            result = await this.detectCodingPatterns(task.task_payload);
                            break;
                        case 'insight_generation':
                            result = await this.generateInsights(task.task_payload);
                            break;
                        case 'preference_analysis':
                            result = await this.analyzePreferences(task.task_payload);
                            break;
                        case 'evolution_tracking':
                            result = await this.trackEvolution(task.task_payload);
                            break;
                        default:
                            throw new Error(`Unknown task type: ${task.task_type}`);
                    }

                    const duration = Date.now() - startTime;

                    // Mark as completed
                    await this.db.query(`
                        UPDATE learning_processing_queue 
                        SET status = 'completed', 
                            completed_at = NOW(),
                            processing_duration_ms = $2,
                            result_summary = $3
                        WHERE id = $1
                    `, [task.id, duration, JSON.stringify(result)]);

                    processedCount++;
                    this.logger.debug(`Completed ${task.task_type} task ${task.id} in ${duration}ms`);

                } catch (error) {
                    this.logger.error(`Failed to process task ${task.id}:`, error);
                    
                    // Handle retry logic
                    const newRetryCount = task.retry_count + 1;
                    const maxRetries = 3;
                    
                    if (newRetryCount <= maxRetries) {
                        // Schedule retry with exponential backoff
                        const retryDelay = Math.pow(2, newRetryCount) * 60000; // 2^n minutes
                        const retryTime = new Date(Date.now() + retryDelay);
                        
                        await this.db.query(`
                            UPDATE learning_processing_queue 
                            SET status = 'retry',
                                retry_count = $2,
                                scheduled_for = $3,
                                error_message = $4
                            WHERE id = $1
                        `, [task.id, newRetryCount, retryTime, error.message]);
                    } else {
                        // Mark as failed
                        await this.db.query(`
                            UPDATE learning_processing_queue 
                            SET status = 'failed',
                                completed_at = NOW(),
                                error_message = $2
                            WHERE id = $1
                        `, [task.id, error.message]);
                    }
                }
            }

            return processedCount;
        } catch (error) {
            this.logger.error('Error processing learning queue:', error);
            return 0;
        }
    }

    /**
     * Detect coding patterns from memories
     */
    async detectCodingPatterns(payload) {
        const { memoryId, projectId, content, trigger } = payload;
        
        try {
            let memory;
            let memories = [];
            
            if (memoryId && memoryId !== 'undefined') {
                // Get specific memory details
                const memoryResult = await this.db.query(`
                    SELECT m.*, p.name as project_name
                    FROM memories m
                    JOIN projects p ON m.project_id = p.id
                    WHERE m.id = $1
                `, [memoryId]);

                if (memoryResult.rows.length === 0) {
                    throw new Error(`Memory ${memoryId} not found`);
                }
                
                memory = memoryResult.rows[0];
                memories = [memory];
            } else if (trigger === 'scheduled' || !memoryId || memoryId === 'undefined') {
                // For scheduled runs, analyze recent memories without patterns
                const recentMemoriesResult = await this.db.query(`
                    SELECT m.*, p.name as project_name
                    FROM memories m
                    JOIN projects p ON m.project_id = p.id
                    WHERE m.created_at > NOW() - INTERVAL '24 hours'
                      AND m.memory_type IN ('code', 'implementation_notes', 'architecture', 'design_decisions')
                    ORDER BY m.created_at DESC
                    LIMIT 50
                `);
                
                memories = recentMemoriesResult.rows;
                if (memories.length === 0) {
                    return {
                        patternsFound: 0,
                        patternsCreated: 0,
                        patternsUpdated: 0,
                        memoriesProcessed: 0,
                        trigger: 'scheduled'
                    };
                }
            } else {
                throw new Error('Either memoryId or trigger=scheduled must be provided');
            }
            
            let totalCreatedPatterns = 0;
            let totalUpdatedPatterns = 0;
            
            // Use LLM-enhanced pattern analysis if available
            if (this.llmService && memories.length > 0) {
                try {
                    const llmEnhancedResults = await this.performLLMEnhancedPatternDetection(memories);
                    totalCreatedPatterns += llmEnhancedResults.patternsCreated;
                    totalUpdatedPatterns += llmEnhancedResults.patternsUpdated;
                } catch (error) {
                    this.logger.warn(`LLM-enhanced pattern detection failed, continuing with traditional approach: ${error.message}`);
                }
            }
            let totalPatternsFound = 0;
            
            // Process each memory
            for (const currentMemory of memories) {
                // Enhanced pattern detection based on memory type
                const patterns = await this.extractPatternsEnhanced(currentMemory);
                totalPatternsFound += patterns.length;
                
                for (const pattern of patterns) {
                    // Check if pattern already exists
                    const existingResult = await this.db.query(`
                        SELECT id, frequency_count, projects_seen, metadata
                        FROM coding_patterns
                        WHERE pattern_signature = $1
                    `, [pattern.signature]);

                    if (existingResult.rows.length > 0) {
                        // Update existing pattern
                        const existing = existingResult.rows[0];
                        const newProjectsSeen = [...new Set([...existing.projects_seen, currentMemory.project_name])];
                        const existingMetadata = existing.metadata || {};
                        const existingExampleMemories = existingMetadata.example_memories || [];
                        const newExampleMemories = [...new Set([...existingExampleMemories, currentMemory.id])];
                        const updatedMetadata = { ...existingMetadata, example_memories: newExampleMemories };
                        
                        await this.db.query(`
                            UPDATE coding_patterns 
                            SET frequency_count = frequency_count + 1,
                                projects_seen = $2,
                                metadata = $3,
                                last_reinforced = NOW(),
                                confidence_score = LEAST(confidence_score + $4, 1.0)
                            WHERE id = $1
                        `, [existing.id, newProjectsSeen, JSON.stringify(updatedMetadata), pattern.confidenceBoost || 0.1]);
                        
                        totalUpdatedPatterns++;
                        
                        // Store pattern occurrence in metadata instead of separate table (table doesn't exist)
                        // Track this in the pattern's metadata for future reference
                        this.logger.debug(`Pattern ${pattern.name} reinforced in memory ${currentMemory.id}`);
                    } else {
                        // Create new pattern
                        const embedding = await this.embeddingService.generateEmbedding(pattern.description);
                        
                        const patternMetadata = { 
                            ...(pattern.metadata || {}), 
                            example_memories: [currentMemory.id] 
                        };
                        
                        const result = await this.db.query(`
                            INSERT INTO coding_patterns 
                            (pattern_category, pattern_type, pattern_name, pattern_signature, pattern_description,
                             languages, projects_seen, pattern_embedding, example_code,
                             confidence_score, metadata)
                            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
                            RETURNING id
                        `, [
                            pattern.category,
                            this.mapPatternType(pattern.type),
                            pattern.name,
                            pattern.signature,
                            pattern.description,
                            pattern.languages || [],
                            [currentMemory.project_name],
                            JSON.stringify(embedding),
                            pattern.example,
                            pattern.confidence || 0.5,
                            JSON.stringify({
                                ...patternMetadata,
                                detection_method: pattern.detectionMethod || 'keyword'
                            })
                        ]);
                        
                        totalCreatedPatterns++;
                        
                        // Store pattern occurrence in metadata instead of separate table (table doesn't exist)
                        // Track this in the pattern's metadata for future reference  
                        this.logger.debug(`New pattern ${pattern.name} created from memory ${currentMemory.id}`);
                    }
                }
                
                // Create tasks for significant patterns
                if (patterns.length > 0) {
                    await this.createPatternRelatedTasks(currentMemory, patterns);
                }
            }

            return {
                patternsFound: totalPatternsFound,
                patternsCreated: totalCreatedPatterns,
                patternsUpdated: totalUpdatedPatterns,
                memoriesProcessed: memories.length,
                memoryId: memoryId || 'batch',
                projectId: projectId || 'multiple',
                trigger: trigger || 'real_time'
            };
        } catch (error) {
            this.logger.error('Pattern detection failed:', error);
            throw error;
        }
    }

    /**
     * Generate insights from accumulated patterns and decisions
     */
    async generateInsights(payload) {
        try {
            this.logger.info('Generating insights from patterns and decisions');
            
            const insights = [];
            
            // 1. Best Practice Insights - patterns used successfully across projects
            const bestPractices = await this.generateBestPracticeInsights();
            insights.push(...bestPractices);
            
            // 2. Anti-pattern Insights - patterns associated with bugs
            const antiPatterns = await this.generateAntiPatternInsights();
            insights.push(...antiPatterns);
            
            // 3. Technology Preference Insights
            const techPreferences = await this.generateTechPreferenceInsights();
            insights.push(...techPreferences);
            
            // 4. Evolution Insights - how patterns change over time
            const evolutionInsights = await this.generateEvolutionInsights();
            insights.push(...evolutionInsights);
            
            // 5. Team Pattern Insights - patterns specific to team practices
            const teamPatterns = await this.generateTeamPatternInsights();
            insights.push(...teamPatterns);
            
            // 6. Quality Metric Insights
            const qualityInsights = await this.generateQualityInsights();
            insights.push(...qualityInsights);
            
            // Create tasks for actionable insights
            const actionableInsights = insights.filter(i => i.actionable);
            if (actionableInsights.length > 0) {
                await this.createInsightRelatedTasks(actionableInsights);
            }

            return {
                insightsGenerated: insights.length,
                byType: this.groupInsightsByType(insights),
                actionable: actionableInsights.length,
                insights: insights.slice(0, 10) // Return first 10 for summary
            };
        } catch (error) {
            this.logger.error('Insight generation failed:', error);
            throw error;
        }
    }
    
    async generateBestPracticeInsights() {
        const insights = [];
        
        // Find patterns used successfully across multiple projects
        const result = await this.db.query(`
            SELECT cp.*, ARRAY_LENGTH(cp.projects_seen, 1) as project_count,
                   cp.projects_seen as project_names
            FROM coding_patterns cp
            WHERE cp.confidence_score >= 0.7
              AND cp.frequency_count >= $1
              AND ARRAY_LENGTH(cp.projects_seen, 1) >= $2
              AND cp.pattern_category NOT IN ('anti_pattern')
            ORDER BY project_count DESC, cp.confidence_score DESC
            LIMIT 20
        `, [this.config.thresholds.patternMinFrequency || 5, this.config.thresholds.preferenceMinProjects || 2]);
        
        for (const pattern of result.rows) {
            let insight;
            
            // Use LLM analysis if available, otherwise fall back to rule-based approach
            if (this.llmService) {
                try {
                    const llmAnalysis = await this.llmService.analyzeCodePattern(pattern, {
                        analysisType: 'best_practice',
                        focusAreas: ['effectiveness', 'maintainability', 'reusability']
                    });
                    
                    insight = {
                        insight_type: 'best_practice',
                        insight_category: pattern.pattern_category,
                        insight_title: `${pattern.pattern_name} - LLM-Analyzed Best Practice`,
                        insight_description: llmAnalysis.content,
                        confidence_level: Math.min(pattern.confidence_score, llmAnalysis.confidence || 0.8),
                        evidence_strength: Math.min(pattern.frequency_count / 10.0, 1.0),
                        projects_involved: pattern.project_names,
                        supporting_patterns: [pattern.id],
                        metadata: {
                            pattern_details: {
                                category: pattern.pattern_category,
                                type: pattern.pattern_type,
                                detection_method: 'llm_analysis'
                            },
                            llm_analysis: {
                                model: llmAnalysis.model,
                                tokens: llmAnalysis.tokens,
                                analysis_confidence: llmAnalysis.confidence
                            }
                        },
                        actionable: true,
                        priority: (llmAnalysis.confidence > 0.8 && pattern.project_count >= 3) ? 'high' : 'medium'
                    };
                } catch (error) {
                    this.logger.warn(`LLM analysis failed for pattern ${pattern.id}, falling back to rule-based: ${error.message}`);
                    insight = this.generateRuleBasedInsight(pattern, 'best_practice');
                }
            } else {
                insight = this.generateRuleBasedInsight(pattern, 'best_practice');
            }
            
            const existingId = await this.saveInsight(insight);
            insight.id = existingId;
            insights.push(insight);
        }
        
        return insights;
    }

    /**
     * Generate rule-based insight (fallback when LLM is not available)
     */
    generateRuleBasedInsight(pattern, type = 'best_practice') {
        return {
            insight_type: type,
            insight_category: pattern.pattern_category,
            insight_title: `${pattern.pattern_name} - ${type === 'best_practice' ? 'Successful Pattern' : 'Pattern Analysis'}`,
            insight_description: `The ${pattern.pattern_name} has been successfully used in ${pattern.project_count || pattern.projects_seen?.length || 0} projects. ` +
                               `It appears ${pattern.frequency_count} times with ${Math.round(pattern.confidence_score * 100)}% confidence.`,
            confidence_level: pattern.confidence_score,
            evidence_strength: Math.min(pattern.frequency_count / 10.0, 1.0),
            projects_involved: pattern.project_names || pattern.projects_seen,
            supporting_patterns: [pattern.id],
            metadata: {
                pattern_details: {
                    category: pattern.pattern_category,
                    type: pattern.pattern_type,
                    detection_method: 'rule_based'
                }
            },
            actionable: true,
            priority: (pattern.project_count || pattern.projects_seen?.length || 0) >= 3 ? 'high' : 'medium'
        };
    }

    /**
     * Perform LLM-enhanced pattern detection
     */
    async performLLMEnhancedPatternDetection(memories) {
        let patternsCreated = 0;
        let patternsUpdated = 0;

        try {
            // Group memories by project for contextual analysis
            const memoriesByProject = memories.reduce((acc, memory) => {
                const projectName = memory.project_name || 'unknown';
                if (!acc[projectName]) acc[projectName] = [];
                acc[projectName].push(memory);
                return acc;
            }, {});

            for (const [projectName, projectMemories] of Object.entries(memoriesByProject)) {
                if (projectMemories.length === 0) continue;

                // Prepare context for LLM analysis
                const analysisContext = {
                    project: projectName,
                    memoryCount: projectMemories.length,
                    timespan: this.getTimespan(projectMemories),
                    memoryTypes: [...new Set(projectMemories.map(m => m.memory_type))]
                };

                // Group memories by type for focused analysis
                const codeMemories = projectMemories.filter(m => 
                    ['code', 'implementation_notes', 'architecture'].includes(m.memory_type)
                );

                if (codeMemories.length >= 2) {
                    const patterns = await this.analyzeCodePatternsWithLLM(codeMemories, analysisContext);
                    for (const pattern of patterns) {
                        const saved = await this.saveOrUpdatePattern(pattern);
                        if (saved.created) patternsCreated++;
                        else patternsUpdated++;
                    }
                }

                // Analyze decision patterns
                const decisionMemories = projectMemories.filter(m => 
                    ['design_decisions', 'architecture', 'tech_context'].includes(m.memory_type)
                );

                if (decisionMemories.length >= 2) {
                    const decisionPatterns = await this.analyzeDecisionPatternsWithLLM(decisionMemories, analysisContext);
                    for (const pattern of decisionPatterns) {
                        const saved = await this.saveOrUpdateDecisionPattern(pattern);
                        if (saved.created) patternsCreated++;
                        else patternsUpdated++;
                    }
                }
            }

            return { patternsCreated, patternsUpdated };

        } catch (error) {
            this.logger.error('LLM-enhanced pattern detection failed:', error);
            throw error;
        }
    }

    /**
     * Analyze code patterns using LLM
     */
    async analyzeCodePatternsWithLLM(memories, context) {
        const patterns = [];

        try {
            // Build analysis prompt
            const memoryContent = memories.map(m => ({
                type: m.memory_type,
                content: m.content,
                created: m.created_at
            }));

            const analysisPrompt = `
Analyze the following development memories from project "${context.project}" and identify recurring coding patterns:

${JSON.stringify(memoryContent, null, 2)}

Please identify:
1. **Coding Patterns**: Recurring approaches, structures, or techniques
2. **Architecture Patterns**: Design patterns and architectural decisions
3. **Implementation Patterns**: Common implementation strategies

For each pattern found, provide:
- Pattern name and category
- Description of the pattern
- Code example (if available)
- Confidence level (0.0-1.0)
- Why this is a significant pattern

Focus on patterns that appear multiple times or represent important architectural decisions.
            `.trim();

            const llmResponse = await this.llmService.generateAnalysis(analysisPrompt, {
                temperature: 0.2 // Lower temperature for consistent pattern identification
            }, 'patternAnalysis');

            // Parse LLM response and convert to pattern objects
            const detectedPatterns = this.parseLLMPatternResponse(llmResponse.content, context);
            
            for (const pattern of detectedPatterns) {
                patterns.push({
                    pattern_type: pattern.category || 'general',
                    pattern_name: pattern.name,
                    pattern_description: pattern.description,
                    example_code: pattern.example || null,
                    confidence_score: pattern.confidence || 0.7,
                    languages: this.extractLanguages(memories),
                    projects_seen: [context.project],
                    metadata: {
                        detection_method: 'llm_analysis',
                        llm_model: llmResponse.model,
                        analysis_confidence: llmResponse.confidence,
                        source_memories: memories.length
                    }
                });
            }

        } catch (error) {
            this.logger.error('LLM code pattern analysis failed:', error);
        }

        return patterns;
    }

    /**
     * Analyze decision patterns using LLM
     */
    async analyzeDecisionPatternsWithLLM(memories, context) {
        const patterns = [];

        try {
            const memoryContent = memories.map(m => ({
                type: m.memory_type,
                content: m.content,
                created: m.created_at
            }));

            const analysisPrompt = `
Analyze the following development decisions from project "${context.project}" and identify decision patterns:

${JSON.stringify(memoryContent, null, 2)}

Please identify:
1. **Decision Patterns**: Recurring types of decisions and approaches
2. **Technology Choices**: Patterns in technology selection
3. **Design Approaches**: Common design decision patterns

For each decision pattern found, provide:
- Decision type and rationale pattern
- Context where this pattern applies
- Outcome indicators (if mentioned)
- Confidence level (0.0-1.0)

Focus on decisions that represent reusable approaches or significant architectural choices.
            `.trim();

            const llmResponse = await this.llmService.generateAnalysis(analysisPrompt, {
                temperature: 0.2
            }, 'patternAnalysis');

            // Parse and convert to decision pattern objects
            const detectedPatterns = this.parseLLMDecisionResponse(llmResponse.content, context);
            
            for (const pattern of detectedPatterns) {
                patterns.push({
                    decision_context: pattern.context,
                    decision_taken: pattern.decision,
                    decision_category: pattern.category || 'architecture',
                    decision_rationale: pattern.rationale,
                    confidence_score: pattern.confidence || 0.7,
                    technologies_involved: this.extractTechnologies(memories),
                    project_contexts: [context.project],
                    metadata: {
                        detection_method: 'llm_analysis',
                        llm_model: llmResponse.model,
                        source_memories: memories.length
                    }
                });
            }

        } catch (error) {
            this.logger.error('LLM decision pattern analysis failed:', error);
        }

        return patterns;
    }

    /**
     * Parse LLM pattern response into structured objects
     */
    parseLLMPatternResponse(content, context) {
        const patterns = [];
        
        try {
            // Simple pattern parsing - looks for pattern indicators
            const lines = content.split('\n');
            let currentPattern = null;
            
            for (const line of lines) {
                const trimmed = line.trim();
                
                // Look for pattern headers
                if (trimmed.match(/^\d+\.\s*\*\*(.+?)\*\*/)) {
                    if (currentPattern) patterns.push(currentPattern);
                    const match = trimmed.match(/^\d+\.\s*\*\*(.+?)\*\*/);
                    currentPattern = {
                        name: match[1],
                        description: '',
                        category: 'general',
                        confidence: 0.7
                    };
                } else if (currentPattern && trimmed) {
                    // Accumulate description
                    currentPattern.description += trimmed + ' ';
                    
                    // Look for confidence indicators
                    const confMatch = trimmed.match(/confidence.*?(\d+(?:\.\d+)?)/i);
                    if (confMatch) {
                        currentPattern.confidence = Math.min(parseFloat(confMatch[1]), 1.0);
                    }
                    
                    // Look for category indicators
                    if (trimmed.toLowerCase().includes('architecture')) currentPattern.category = 'architectural';
                    if (trimmed.toLowerCase().includes('design')) currentPattern.category = 'design';
                    if (trimmed.toLowerCase().includes('performance')) currentPattern.category = 'performance';
                }
            }
            
            if (currentPattern) patterns.push(currentPattern);
            
        } catch (error) {
            this.logger.warn('Failed to parse LLM pattern response:', error);
        }
        
        return patterns;
    }

    /**
     * Parse LLM decision response into structured objects
     */
    parseLLMDecisionResponse(content, context) {
        const patterns = [];
        
        try {
            // Simple decision parsing
            const lines = content.split('\n');
            let currentDecision = null;
            
            for (const line of lines) {
                const trimmed = line.trim();
                
                if (trimmed.match(/^\d+\.\s*\*\*(.+?)\*\*/)) {
                    if (currentDecision) patterns.push(currentDecision);
                    const match = trimmed.match(/^\d+\.\s*\*\*(.+?)\*\*/);
                    currentDecision = {
                        decision: match[1],
                        context: '',
                        rationale: '',
                        category: 'architecture',
                        confidence: 0.7
                    };
                } else if (currentDecision && trimmed) {
                    if (trimmed.toLowerCase().includes('context')) {
                        currentDecision.context += trimmed + ' ';
                    } else if (trimmed.toLowerCase().includes('rationale')) {
                        currentDecision.rationale += trimmed + ' ';
                    }
                    
                    const confMatch = trimmed.match(/confidence.*?(\d+(?:\.\d+)?)/i);
                    if (confMatch) {
                        currentDecision.confidence = Math.min(parseFloat(confMatch[1]), 1.0);
                    }
                }
            }
            
            if (currentDecision) patterns.push(currentDecision);
            
        } catch (error) {
            this.logger.warn('Failed to parse LLM decision response:', error);
        }
        
        return patterns;
    }

    /**
     * Helper methods
     */
    getTimespan(memories) {
        if (memories.length === 0) return 'unknown';
        const dates = memories.map(m => new Date(m.created_at)).sort();
        const days = Math.ceil((dates[dates.length - 1] - dates[0]) / (1000 * 60 * 60 * 24));
        return `${days} days`;
    }

    extractLanguages(memories) {
        const languages = new Set();
        memories.forEach(m => {
            const content = m.content.toLowerCase();
            if (content.includes('javascript') || content.includes('js')) languages.add('JavaScript');
            if (content.includes('python') || content.includes('py')) languages.add('Python');
            if (content.includes('typescript') || content.includes('ts')) languages.add('TypeScript');
            if (content.includes('java')) languages.add('Java');
            if (content.includes('react')) languages.add('React');
            if (content.includes('node')) languages.add('Node.js');
        });
        return Array.from(languages);
    }

    extractTechnologies(memories) {
        const technologies = new Set();
        memories.forEach(m => {
            const content = m.content.toLowerCase();
            if (content.includes('postgresql') || content.includes('postgres')) technologies.add('PostgreSQL');
            if (content.includes('redis')) technologies.add('Redis');
            if (content.includes('docker')) technologies.add('Docker');
            if (content.includes('express')) technologies.add('Express');
            if (content.includes('react')) technologies.add('React');
        });
        return Array.from(technologies);
    }
    
    async generateAntiPatternInsights() {
        const insights = [];
        
        // Find patterns that appear near bug reports
        const result = await this.db.query(`
            SELECT cp.pattern_name, cp.pattern_category, cp.id as pattern_id,
                   COUNT(DISTINCT bug_mem.id) as bug_count,
                   array_agg(DISTINCT p.name) as affected_projects
            FROM coding_patterns cp
            JOIN pattern_occurrences po ON cp.id = po.pattern_id
            JOIN memories m ON po.memory_id = m.id
            JOIN memories bug_mem ON bug_mem.project_id = m.project_id 
                AND bug_mem.memory_type = 'bug'
                AND bug_mem.created_at BETWEEN m.created_at - INTERVAL '7 days' 
                                            AND m.created_at + INTERVAL '7 days'
            JOIN projects p ON m.project_id = p.id
            GROUP BY cp.id
            HAVING COUNT(DISTINCT bug_mem.id) >= 3
            ORDER BY bug_count DESC
            LIMIT 10
        `);
        
        for (const antiPattern of result.rows) {
            const insight = {
                insight_type: 'antipattern',
                insight_category: antiPattern.pattern_category,
                insight_title: `${antiPattern.pattern_name} - Potential Issue`,
                insight_description: `The ${antiPattern.pattern_name} appears to be associated with ${antiPattern.bug_count} bug reports ` +
                                   `across projects: ${antiPattern.affected_projects.join(', ')}. Consider reviewing its usage.`,
                confidence_level: Math.min(antiPattern.bug_count * 0.15, 0.9),
                evidence_strength: Math.min(antiPattern.bug_count / 10.0, 1.0),
                projects_involved: antiPattern.affected_projects,
                supporting_patterns: [antiPattern.pattern_id],
                metadata: {
                    bug_correlation: antiPattern.bug_count,
                    recommendation: 'Review pattern usage and consider refactoring'
                },
                actionable: true,
                priority: antiPattern.bug_count >= 5 ? 'high' : 'medium'
            };
            
            const existingId = await this.saveInsight(insight);
            insight.id = existingId;
            insights.push(insight);
        }
        
        return insights;
    }
    
    async generateTechPreferenceInsights() {
        const insights = [];
        
        // Analyze technology preferences from design decisions and tech context
        const result = await this.db.query(`
            SELECT 
                CASE 
                    WHEN content ILIKE '%react%' THEN 'React'
                    WHEN content ILIKE '%vue%' THEN 'Vue'
                    WHEN content ILIKE '%angular%' THEN 'Angular'
                    WHEN content ILIKE '%node%' THEN 'Node.js'
                    WHEN content ILIKE '%python%' THEN 'Python'
                    WHEN content ILIKE '%java%' AND content NOT ILIKE '%javascript%' THEN 'Java'
                    WHEN content ILIKE '%golang%' OR content ILIKE '% go %' THEN 'Go'
                    WHEN content ILIKE '%rust%' THEN 'Rust'
                    WHEN content ILIKE '%postgresql%' OR content ILIKE '%postgres%' THEN 'PostgreSQL'
                    WHEN content ILIKE '%mysql%' THEN 'MySQL'
                    WHEN content ILIKE '%mongodb%' THEN 'MongoDB'
                    WHEN content ILIKE '%redis%' THEN 'Redis'
                    WHEN content ILIKE '%docker%' THEN 'Docker'
                    WHEN content ILIKE '%kubernetes%' OR content ILIKE '%k8s%' THEN 'Kubernetes'
                    WHEN content ILIKE '%aws%' THEN 'AWS'
                    WHEN content ILIKE '%azure%' THEN 'Azure'
                    WHEN content ILIKE '%gcp%' OR content ILIKE '%google cloud%' THEN 'GCP'
                END as technology,
                COUNT(*) as usage_count,
                COUNT(DISTINCT project_id) as project_count,
                array_agg(DISTINCT p.name) as projects,
                AVG(m.importance_score) as avg_importance
            FROM memories m
            JOIN projects p ON m.project_id = p.id
            WHERE m.memory_type IN ('tech_context', 'design_decisions', 'architecture')
              AND m.created_at > NOW() - INTERVAL '90 days'
            GROUP BY technology
            HAVING COUNT(*) >= 3
            ORDER BY usage_count DESC, project_count DESC
        `);
        
        for (const tech of result.rows) {
            if (!tech.technology) continue;
            
            const insight = {
                insight_type: 'preference',
                insight_category: this.categorizeTechnology(tech.technology),
                insight_title: `${tech.technology} - Technology Preference`,
                insight_description: `${tech.technology} is frequently used across ${tech.project_count} projects ` +
                                   `(${tech.projects.slice(0, 3).join(', ')}${tech.projects.length > 3 ? '...' : ''}). ` +
                                   `It appears in ${tech.usage_count} technical decisions with average importance of ${tech.avg_importance.toFixed(1)}.`,
                confidence_level: Math.min(tech.usage_count * 0.1, 0.9),
                evidence_strength: Math.min(tech.usage_count / 10.0, 1.0),
                projects_involved: tech.projects,
                metadata: {
                    technology_category: this.categorizeTechnology(tech.technology),
                    usage_metrics: {
                        total_mentions: tech.usage_count,
                        project_count: tech.project_count,
                        avg_importance: tech.avg_importance
                    }
                },
                actionable: false,
                priority: 'low'
            };
            
            const existingId = await this.saveInsight(insight);
            insight.id = existingId;
            insights.push(insight);
        }
        
        return insights;
    }
    
    async generateEvolutionInsights() {
        const insights = [];
        
        // Track pattern adoption over time
        const result = await this.db.query(`
            SELECT 
                cp.pattern_name,
                cp.pattern_category,
                cp.id as pattern_id,
                DATE_TRUNC('month', po.detected_at) as month,
                COUNT(*) as monthly_count,
                AVG(cp.confidence_score) as avg_confidence
            FROM coding_patterns cp
            JOIN pattern_occurrences po ON cp.id = po.pattern_id
            WHERE po.detected_at > NOW() - INTERVAL '6 months'
            GROUP BY cp.id, month
            HAVING COUNT(*) >= 2
            ORDER BY cp.pattern_name, month
        `);
        
        // Group by pattern and analyze trends
        const patternTrends = {};
        for (const row of result.rows) {
            if (!patternTrends[row.pattern_id]) {
                patternTrends[row.pattern_id] = {
                    name: row.pattern_name,
                    category: row.pattern_category,
                    data: []
                };
            }
            patternTrends[row.pattern_id].data.push({
                month: row.month,
                count: row.monthly_count,
                confidence: row.avg_confidence
            });
        }
        
        // Analyze trends
        for (const trend of Object.values(patternTrends)) {
            if (trend.data.length >= 3) {
                const isGrowing = trend.data[trend.data.length - 1].count > trend.data[0].count * 1.5;
                const isDeclining = trend.data[trend.data.length - 1].count < trend.data[0].count * 0.5;
                
                if (isGrowing || isDeclining) {
                    const insight = {
                        insight_type: 'trend',
                        insight_category: trend.category,
                        insight_title: `${trend.name} - ${isGrowing ? 'Growing' : 'Declining'} Pattern`,
                        insight_description: `The usage of ${trend.name} is ${isGrowing ? 'increasing' : 'decreasing'}. ` +
                                           `Monthly occurrences changed from ${trend.data[0].count} to ${trend.data[trend.data.length - 1].count} ` +
                                           `over the last ${trend.data.length} months.`,
                        confidence_level: 0.7,
                        evidence_strength: Math.min(trend.data.length / 6.0, 1.0),
                        metadata: {
                            trend_direction: isGrowing ? 'growing' : 'declining',
                            trend_data: trend.data
                        },
                        actionable: isDeclining,
                        priority: isDeclining ? 'medium' : 'low'
                    };
                    
                    const existingId = await this.saveInsight(insight);
                    insight.id = existingId;
                    insights.push(insight);
                }
            }
        }
        
        return insights;
    }
    
    async generateTeamPatternInsights() {
        const insights = [];
        
        // Find patterns in how the team works
        const result = await this.db.query(`
            SELECT 
                memory_type,
                COUNT(*) as type_count,
                COUNT(DISTINCT project_id) as project_count,
                AVG(importance_score) as avg_importance,
                array_agg(DISTINCT p.name) as projects
            FROM memories m
            JOIN projects p ON m.project_id = p.id
            WHERE m.created_at > NOW() - INTERVAL '30 days'
            GROUP BY memory_type
            HAVING COUNT(*) >= 10
            ORDER BY type_count DESC
        `);
        
        // Analyze memory type usage patterns
        const totalMemories = result.rows.reduce((sum, row) => sum + parseInt(row.type_count), 0);
        
        for (const usage of result.rows) {
            const percentage = (usage.type_count / totalMemories * 100).toFixed(1);
            
            if (percentage > 20) {
                const insight = {
                    insight_type: 'trend',
                    insight_category: 'process',
                    insight_title: `Heavy Use of ${usage.memory_type} Memories`,
                    insight_description: `The team creates ${usage.memory_type} memories frequently (${percentage}% of all memories). ` +
                                       `This pattern appears across ${usage.project_count} projects with average importance ${usage.avg_importance.toFixed(1)}.`,
                    confidence_level: 0.8,
                    evidence_strength: Math.min(usage.type_count / 50.0, 1.0),
                    projects_involved: usage.projects,
                    metadata: {
                        usage_stats: {
                            memory_type: usage.memory_type,
                            percentage: percentage,
                            total_count: usage.type_count
                        }
                    },
                    actionable: false,
                    priority: 'low'
                };
                
                const existingId = await this.saveInsight(insight);
                insight.id = existingId;
                insights.push(insight);
            }
        }
        
        return insights;
    }
    
    async generateQualityInsights() {
        const insights = [];
        
        // Analyze bug patterns and quality metrics
        const result = await this.db.query(`
            SELECT 
                p.name as project_name,
                p.id as project_id,
                COUNT(CASE WHEN m.memory_type = 'bug' THEN 1 END) as bug_count,
                COUNT(CASE WHEN m.memory_type = 'lessons_learned' THEN 1 END) as lessons_count,
                COUNT(CASE WHEN m.memory_type IN ('code', 'implementation_notes') THEN 1 END) as code_memories,
                COUNT(*) as total_memories
            FROM projects p
            JOIN memories m ON p.id = m.project_id
            WHERE m.created_at > NOW() - INTERVAL '90 days'
            GROUP BY p.id
            HAVING COUNT(*) >= 20
        `);
        
        for (const project of result.rows) {
            const bugRatio = project.bug_count / project.total_memories;
            const lessonsRatio = project.lessons_count / project.total_memories;
            
            if (bugRatio > 0.15) {
                const insight = {
                    insight_type: 'warning',
                    insight_category: 'quality',
                    insight_title: `${project.project_name} - High Bug Rate`,
                    insight_description: `Project ${project.project_name} has a high bug-to-memory ratio (${(bugRatio * 100).toFixed(1)}%). ` +
                                       `Consider implementing additional quality measures or code reviews.`,
                    confidence_level: 0.7,
                    evidence_strength: Math.min(project.bug_count / 20.0, 1.0),
                    projects_involved: [project.project_name],
                    metadata: {
                        metrics: {
                            bug_count: project.bug_count,
                            total_memories: project.total_memories,
                            bug_ratio: bugRatio
                        }
                    },
                    actionable: true,
                    priority: 'high'
                };
                
                const existingId = await this.saveInsight(insight);
                insight.id = existingId;
                insights.push(insight);
            }
            
            if (lessonsRatio > 0.05) {
                const insight = {
                    insight_type: 'best_practice',
                    insight_category: 'learning',
                    insight_title: `${project.project_name} - Active Learning Culture`,
                    insight_description: `Project ${project.project_name} demonstrates good learning practices with ${project.lessons_count} lessons learned documented.`,
                    confidence_level: 0.8,
                    evidence_strength: Math.min(project.lessons_count / 10.0, 1.0),
                    projects_involved: [project.project_name],
                    metadata: {
                        metrics: {
                            lessons_count: project.lessons_count,
                            lessons_ratio: lessonsRatio
                        }
                    },
                    actionable: false,
                    priority: 'low'
                };
                
                const existingId = await this.saveInsight(insight);
                insight.id = existingId;
                insights.push(insight);
            }
        }
        
        return insights;
    }
    
    async saveInsight(insight) {
        try {
            // Generate embedding for insight
            const embedding = await this.embeddingService.generateEmbedding(
                `${insight.insight_title} ${insight.insight_description}`
            );
            
            // First check if insight with this title already exists
            const existingInsight = await this.db.query(`
                SELECT id, evidence_strength, confidence_level, metadata 
                FROM meta_insights 
                WHERE insight_title = $1
            `, [insight.insight_title]);
            
            let result;
            if (existingInsight.rows.length > 0) {
                // Update existing insight
                const existing = existingInsight.rows[0];
                result = await this.db.query(`
                    UPDATE meta_insights 
                    SET evidence_strength = GREATEST($1::float, $2::float),
                        confidence_level = (COALESCE($3::float, 0.5) + COALESCE($4::float, 0.5)) / 2,
                        last_reinforced = NOW(),
                        metadata = $5 || $6::jsonb
                    WHERE id = $7
                    RETURNING id
                `, [
                    existing.evidence_strength,
                    insight.evidence_strength,
                    existing.confidence_level,
                    insight.confidence_level,
                    existing.metadata,
                    JSON.stringify(insight.metadata || {}),
                    existing.id
                ]);
            } else {
                // Insert new insight
                result = await this.db.query(`
                    INSERT INTO meta_insights 
                    (insight_type, insight_category, insight_title, insight_description,
                     confidence_level, evidence_strength, projects_involved, supporting_patterns,
                     metadata, actionable, priority, insight_embedding)
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
                    RETURNING id
                `, [
                    insight.insight_type,
                    insight.insight_category,
                    insight.insight_title,
                    insight.insight_description,
                    insight.confidence_level,
                    insight.evidence_strength,
                    insight.projects_involved || [],
                    JSON.stringify(insight.supporting_patterns || []),
                    JSON.stringify(insight.metadata || {}),
                    insight.actionable,
                    insight.priority,
                    JSON.stringify(embedding)
                ]);
            }
            
            return result.rows[0].id;
        } catch (error) {
            this.logger.error('Failed to save insight:', error);
            return null;
        }
    }
    
    async createInsightRelatedTasks(insights) {
        try {
            for (const insight of insights) {
                if (!insight.actionable || insight.priority === 'low') continue;
                
                // Create task based on insight type
                let taskTitle, taskDescription;
                
                switch (insight.insight_type) {
                    case 'antipattern':
                        taskTitle = `Review and fix ${insight.insight_title}`;
                        taskDescription = insight.insight_description + ' This pattern has been identified as problematic.';
                        break;
                    case 'warning':
                        taskTitle = `Improve code quality for ${insight.projects_involved[0]}`;
                        taskDescription = insight.insight_description;
                        break;
                    case 'best_practice':
                        taskTitle = `Document ${insight.insight_title}`;
                        taskDescription = `Create documentation for this successful pattern: ${insight.insight_description}`;
                        break;
                    default:
                        continue;
                }
                
                // Create task memory
                await this.db.query(`
                    INSERT INTO memories (project_id, content, memory_type, metadata)
                    SELECT p.id, $2, 'task', $3
                    FROM projects p
                    WHERE p.name = ANY($1)
                    LIMIT 1
                `, [
                    insight.projects_involved,
                    JSON.stringify({
                        title: taskTitle,
                        description: taskDescription,
                        priority: insight.priority,
                        status: 'pending',
                        source: 'learning_insights',
                        insightId: insight.id,
                        impact: insight.priority === 'high' ? 8 : 6,
                        urgency: insight.priority === 'high' ? 7 : 5,
                        effort: 5
                    }),
                    JSON.stringify({
                        title: taskTitle,
                        source: 'learning_insights',
                        insight_type: insight.insight_type
                    })
                ]);
            }
        } catch (error) {
            this.logger.error('Failed to create insight-related tasks:', error);
        }
    }
    
    groupInsightsByType(insights) {
        const grouped = {};
        for (const insight of insights) {
            if (!grouped[insight.insight_type]) {
                grouped[insight.insight_type] = 0;
            }
            grouped[insight.insight_type]++;
        }
        return grouped;
    }

    /**
     * Analyze technology preferences from memories and decisions
     */
    async analyzePreferences() {
        try {
            this.logger.info('Analyzing technology preferences');
            
            // Get memories that mention technologies
            const techMemoriesResult = await this.db.query(`
                SELECT m.*, p.name as project_name
                FROM memories m
                JOIN projects p ON m.project_id = p.id
                WHERE m.content ~* '(react|vue|angular|node|python|java|postgres|mysql|docker|kubernetes)'
                  AND m.created_at > NOW() - INTERVAL '30 days'
                ORDER BY m.created_at DESC
                LIMIT 100
            `);

            // Simple technology extraction (can be enhanced with NLP)
            const techMentions = {};

            for (const memory of techMemoriesResult.rows) {
                const techs = this.extractTechnologies(memory.content);
                for (const tech of techs) {
                    if (!techMentions[tech]) {
                        techMentions[tech] = { count: 0, projects: new Set(), positive: 0, negative: 0 };
                    }
                    techMentions[tech].count++;
                    techMentions[tech].projects.add(memory.project_name);
                    
                    // Simple sentiment analysis
                    if (this.isPositiveMention(memory.content, tech)) {
                        techMentions[tech].positive++;
                    } else if (this.isNegativeMention(memory.content, tech)) {
                        techMentions[tech].negative++;
                    }
                }
            }

            // Update or create tech preferences
            let updatedPreferences = 0;
            for (const [tech, data] of Object.entries(techMentions)) {
                if (data.count >= 3 && data.projects.size >= 1) {
                    const preferenceStrength = Math.min(
                        (data.positive - data.negative + data.count) / (data.count * 2),
                        1.0
                    );
                    
                    const category = this.categorizeTechnology(tech);
                    
                    await this.db.query(`
                        INSERT INTO tech_preferences 
                        (technology_category, preferred_technology, preference_strength, 
                         projects_count, last_used)
                        VALUES ($1, $2, $3, $4, NOW())
                        ON CONFLICT (technology_category, preferred_technology)
                        DO UPDATE SET 
                            preference_strength = (tech_preferences.preference_strength + $3) / 2,
                            projects_count = GREATEST(tech_preferences.projects_count, $4),
                            last_used = NOW()
                    `, [category, tech, preferenceStrength, data.projects.size]);
                    
                    updatedPreferences++;
                }
            }

            return {
                technologiesAnalyzed: Object.keys(techMentions).length,
                preferencesUpdated: updatedPreferences,
                memoriesProcessed: techMemoriesResult.rows.length
            };
        } catch (error) {
            this.logger.error('Preference analysis failed:', error);
            throw error;
        }
    }

    /**
     * Track evolution of learning over time
     */
    async trackEvolution() {
        try {
            this.logger.info('Tracking learning evolution');
            
            // Track changes in pattern confidence
            const patternChanges = await this.db.query(`
                SELECT cp.*, le.previous_state
                FROM coding_patterns cp
                LEFT JOIN learning_evolution le ON le.subject_type = 'coding_pattern' 
                    AND le.subject_id = cp.id
                    AND le.timestamp > NOW() - INTERVAL '7 days'
                WHERE cp.last_reinforced > NOW() - INTERVAL '24 hours'
                ORDER BY cp.last_reinforced DESC
                LIMIT 20
            `);

            let evolutionRecords = 0;
            for (const pattern of patternChanges.rows) {
                if (pattern.previous_state) {
                    const prevConfidence = pattern.previous_state.confidence_score || 0;
                    const confidenceChange = pattern.confidence_score - prevConfidence;
                    
                    if (Math.abs(confidenceChange) >= this.config.thresholds.evolutionMinChange) {
                        await this.db.query(`
                            INSERT INTO learning_evolution
                            (subject_type, subject_id, change_type, previous_state, 
                             new_state, change_magnitude, change_reason)
                            VALUES ($1, $2, $3, $4, $5, $6, $7)
                        `, [
                            'coding_pattern',
                            pattern.id,
                            confidenceChange > 0 ? 'confidence_increase' : 'confidence_decrease',
                            JSON.stringify({ confidence_score: prevConfidence }),
                            JSON.stringify({ confidence_score: pattern.confidence_score }),
                            Math.abs(confidenceChange),
                            'Pattern reinforcement from new evidence'
                        ]);
                        
                        evolutionRecords++;
                    }
                }
            }

            return {
                patternsTracked: patternChanges.rows.length,
                evolutionRecords,
                trackingPeriod: '24 hours'
            };
        } catch (error) {
            this.logger.error('Evolution tracking failed:', error);
            throw error;
        }
    }

    /**
     * Enhanced pattern extraction using memory types
     */
    async extractPatternsEnhanced(memory) {
        const patterns = [];
        
        // Memory type-specific pattern extraction
        switch (memory.memory_type) {
            case 'system_patterns':
                // High confidence - user explicitly documented a pattern
                const explicitPatterns = await this.extractExplicitPatterns(memory);
                patterns.push(...explicitPatterns.map(p => ({
                    ...p,
                    confidence: 0.9,
                    confidenceBoost: 0.2,
                    detectionMethod: 'user_explicit'
                })));
                break;
                
            case 'architecture':
                // Architecture decisions often contain patterns
                const archPatterns = await this.extractArchitecturalPatterns(memory);
                patterns.push(...archPatterns.map(p => ({
                    ...p,
                    confidence: 0.8,
                    detectionMethod: 'memory_type'
                })));
                break;
                
            case 'design_decisions':
                // Design patterns from decisions
                const designPatterns = await this.extractDesignPatterns(memory);
                patterns.push(...designPatterns.map(p => ({
                    ...p,
                    confidence: 0.8,
                    detectionMethod: 'memory_type'
                })));
                break;
                
            case 'code':
            case 'implementation_notes':
                // Code patterns from implementation
                const codePatterns = await this.extractCodePatterns(memory);
                patterns.push(...codePatterns.map(p => ({
                    ...p,
                    confidence: 0.7,
                    detectionMethod: 'keyword'
                })));
                break;
                
            case 'tech_context':
                // Technology stack patterns
                const techPatterns = await this.extractTechnologyPatterns(memory);
                patterns.push(...techPatterns.map(p => ({
                    ...p,
                    confidence: 0.7,
                    detectionMethod: 'memory_type'
                })));
                break;
                
            case 'bug':
                // Anti-patterns from bugs
                const antiPatterns = await this.extractAntiPatterns(memory);
                patterns.push(...antiPatterns.map(p => ({
                    ...p,
                    confidence: 0.6,
                    detectionMethod: 'memory_type',
                    metadata: { sourceType: 'bug_report' }
                })));
                break;
                
            case 'lessons_learned':
                // Patterns from retrospectives
                const lessonPatterns = await this.extractLessonPatterns(memory);
                patterns.push(...lessonPatterns.map(p => ({
                    ...p,
                    confidence: 0.8,
                    detectionMethod: 'memory_type'
                })));
                break;
        }
        
        // Always run keyword-based extraction as fallback
        const keywordPatterns = await this.extractPatterns(memory);
        patterns.push(...keywordPatterns.filter(kp => 
            !patterns.some(p => p.signature === kp.signature)
        ));
        
        return patterns;
    }
    
    async extractExplicitPatterns(memory) {
        const patterns = [];
        const content = memory.content.toLowerCase();
        
        // Look for explicit pattern declarations
        const patternMatches = content.match(/pattern:\s*([^\n]+)/gi) || [];
        for (const match of patternMatches) {
            const patternName = match.replace(/pattern:\s*/i, '').trim();
            patterns.push({
                category: 'architectural',
                type: 'documented_pattern',
                name: patternName,
                signature: `explicit_${patternName.replace(/\s+/g, '_').toLowerCase()}`,
                description: `Explicitly documented pattern: ${patternName}`,
                languages: ['any'],
                example: memory.content.substring(0, 500),
                context: memory.content
            });
        }
        
        return patterns;
    }
    
    async extractArchitecturalPatterns(memory) {
        const patterns = [];
        const content = memory.content.toLowerCase();
        
        // Enhanced architectural pattern detection
        const archKeywords = {
            'microservices': ['microservice', 'micro-service', 'service-oriented'],
            'monolithic': ['monolith', 'single application'],
            'serverless': ['serverless', 'lambda', 'functions as a service'],
            'event_driven': ['event-driven', 'event sourcing', 'cqrs'],
            'layered': ['layered architecture', 'n-tier', 'three-tier'],
            'hexagonal': ['hexagonal', 'ports and adapters', 'clean architecture']
        };
        
        for (const [pattern, keywords] of Object.entries(archKeywords)) {
            if (keywords.some(kw => content.includes(kw))) {
                patterns.push({
                    category: 'architectural',
                    type: pattern,
                    name: `${pattern.charAt(0).toUpperCase() + pattern.slice(1).replace(/_/g, ' ')} Architecture`,
                    signature: `arch_${pattern}`,
                    description: `${pattern.replace(/_/g, ' ')} architectural pattern`,
                    languages: ['any'],
                    example: memory.content.substring(0, 500),
                    context: this.extractContext(memory.content, keywords[0])
                });
            }
        }
        
        return patterns;
    }
    
    async extractDesignPatterns(memory) {
        const patterns = [];
        const content = memory.content.toLowerCase();
        
        // Common design patterns with better context
        const designPatterns = {
            'singleton': { keywords: ['singleton', 'single instance'], category: 'creational' },
            'factory': { keywords: ['factory pattern', 'object creation'], category: 'creational' },
            'builder': { keywords: ['builder pattern', 'fluent interface'], category: 'creational' },
            'adapter': { keywords: ['adapter pattern', 'wrapper'], category: 'structural' },
            'decorator': { keywords: ['decorator pattern', 'wrapper with interface'], category: 'structural' },
            'observer': { keywords: ['observer pattern', 'publish-subscribe'], category: 'behavioral' },
            'strategy': { keywords: ['strategy pattern', 'algorithm family'], category: 'behavioral' },
            'repository': { keywords: ['repository pattern', 'data access layer'], category: 'data_access' }
        };
        
        for (const [pattern, config] of Object.entries(designPatterns)) {
            if (config.keywords.some(kw => content.includes(kw))) {
                patterns.push({
                    category: 'design',
                    type: pattern,
                    name: `${pattern.charAt(0).toUpperCase() + pattern.slice(1)} Pattern`,
                    signature: `design_${pattern}`,
                    description: `${config.category} design pattern: ${pattern}`,
                    languages: ['any'],
                    example: memory.content.substring(0, 500),
                    context: this.extractContext(memory.content, config.keywords[0]),
                    metadata: { patternCategory: config.category }
                });
            }
        }
        
        return patterns;
    }
    
    async extractCodePatterns(memory) {
        // Use existing extractPatterns but filter for code-specific patterns
        const allPatterns = await this.extractPatterns(memory);
        return allPatterns.filter(p => 
            ['error_handling', 'performance', 'testing', 'api_design'].includes(p.category)
        );
    }
    
    async extractTechnologyPatterns(memory) {
        const patterns = [];
        const content = memory.content.toLowerCase();
        
        // Technology stack patterns
        const techStacks = {
            'mean': ['mongodb', 'express', 'angular', 'node'],
            'mern': ['mongodb', 'express', 'react', 'node'],
            'lamp': ['linux', 'apache', 'mysql', 'php'],
            'jamstack': ['javascript', 'apis', 'markup']
        };
        
        for (const [stack, techs] of Object.entries(techStacks)) {
            const matchCount = techs.filter(tech => content.includes(tech)).length;
            if (matchCount >= 2) {
                patterns.push({
                    category: 'tech_stack',
                    type: stack,
                    name: `${stack.toUpperCase()} Stack`,
                    signature: `stack_${stack}`,
                    description: `${stack.toUpperCase()} technology stack`,
                    languages: techs,
                    example: memory.content.substring(0, 500),
                    confidence: matchCount / techs.length
                });
            }
        }
        
        return patterns;
    }
    
    async extractAntiPatterns(memory) {
        const patterns = [];
        const content = memory.content.toLowerCase();
        
        // Common anti-patterns often found in bug reports
        const antiPatterns = {
            'god_object': ['god object', 'too many responsibilities', 'bloated class'],
            'spaghetti_code': ['spaghetti code', 'tangled', 'hard to follow'],
            'copy_paste': ['copy paste', 'duplicate code', 'code duplication'],
            'magic_numbers': ['magic number', 'hardcoded value', 'literal values'],
            'callback_hell': ['callback hell', 'nested callbacks', 'pyramid of doom']
        };
        
        for (const [pattern, keywords] of Object.entries(antiPatterns)) {
            if (keywords.some(kw => content.includes(kw))) {
                patterns.push({
                    category: 'anti_pattern',
                    type: pattern,
                    name: `Anti-pattern: ${pattern.replace(/_/g, ' ')}`,
                    signature: `anti_${pattern}`,
                    description: `Detected anti-pattern: ${pattern.replace(/_/g, ' ')}`,
                    languages: ['any'],
                    example: memory.content.substring(0, 500),
                    context: this.extractContext(memory.content, keywords[0])
                });
            }
        }
        
        return patterns;
    }
    
    async extractLessonPatterns(memory) {
        const patterns = [];
        const content = memory.content.toLowerCase();
        
        // Patterns often mentioned in lessons learned
        if (content.includes('should have') || content.includes('next time')) {
            // Extract improvement patterns
            const improvementMatch = content.match(/should have (.+?)(?:\.|\n|$)/i);
            if (improvementMatch) {
                patterns.push({
                    category: 'best_practice',
                    type: 'improvement',
                    name: 'Improvement Opportunity',
                    signature: `improvement_${Date.now()}`,
                    description: `Lesson learned: ${improvementMatch[1]}`,
                    languages: ['any'],
                    example: memory.content.substring(0, 500)
                });
            }
        }
        
        return patterns;
    }
    
    extractContext(content, keyword, contextSize = 100) {
        const index = content.toLowerCase().indexOf(keyword.toLowerCase());
        if (index === -1) return '';
        
        const start = Math.max(0, index - contextSize);
        const end = Math.min(content.length, index + keyword.length + contextSize);
        return content.substring(start, end);
    }
    
    /**
     * Outcome Correlation System
     * Tracks relationships between coding patterns and project outcomes
     */
    
    /**
     * Record pattern outcome when a project milestone is reached
     */
    async recordPatternOutcome(projectId, patternId, outcomeType, outcomeData = {}) {
        try {
            const outcome = {
                project_id: projectId,
                pattern_id: patternId,
                outcome_type: outcomeType, // 'success', 'failure', 'neutral', 'bug', 'performance_gain'
                outcome_value: outcomeData.value || null, // Numeric value if applicable
                outcome_description: outcomeData.description || null,
                metrics: outcomeData.metrics || {},
                recorded_at: new Date()
            };

            await this.db.query(`
                INSERT INTO pattern_outcomes (
                    project_id, pattern_id, outcome_type, outcome_value, 
                    outcome_description, metrics, recorded_at
                ) VALUES ($1, $2, $3, $4, $5, $6, $7)
            `, [
                outcome.project_id,
                outcome.pattern_id,
                outcome.outcome_type,
                outcome.outcome_value,
                outcome.outcome_description,
                JSON.stringify(outcome.metrics),
                outcome.recorded_at
            ]);

            this.logger.debug(`Recorded pattern outcome for pattern ${patternId} in project ${projectId}: ${outcomeType}`);
            
        } catch (error) {
            this.logger.error('Failed to record pattern outcome:', error);
        }
    }

    /**
     * Analyze pattern-outcome correlations using LLM
     */
    async analyzePatternOutcomeCorrelations(context = {}) {
        try {
            // Get pattern outcome data
            const patterns = await this.getPatternOutcomeData(context);
            if (patterns.length === 0) {
                this.logger.info('No pattern outcome data available for correlation analysis');
                return [];
            }

            // Group outcomes by pattern
            const patternOutcomes = {};
            patterns.forEach(p => {
                if (!patternOutcomes[p.pattern_id]) {
                    patternOutcomes[p.pattern_id] = {
                        pattern: {
                            id: p.pattern_id,
                            name: p.pattern_name,
                            category: p.pattern_category,
                            type: p.pattern_type
                        },
                        outcomes: []
                    };
                }
                patternOutcomes[p.pattern_id].outcomes.push({
                    type: p.outcome_type,
                    value: p.outcome_value,
                    description: p.outcome_description,
                    metrics: p.metrics,
                    project: p.project_name,
                    date: p.recorded_at
                });
            });

            // Use LLM for correlation analysis if available
            if (this.llmService) {
                return await this.performLLMOutcomeCorrelation(patternOutcomes, context);
            } else {
                return await this.performRuleBasedOutcomeCorrelation(patternOutcomes, context);
            }

        } catch (error) {
            this.logger.error('Pattern outcome correlation analysis failed:', error);
            return [];
        }
    }

    /**
     * LLM-powered outcome correlation analysis
     */
    async performLLMOutcomeCorrelation(patternOutcomes, context) {
        const correlations = [];

        for (const [patternId, data] of Object.entries(patternOutcomes)) {
            if (data.outcomes.length < 3) continue; // Need sufficient data

            try {
                const analysisResult = await this.llmService.analyzeOutcomeCorrelations(
                    data.pattern,
                    data.outcomes,
                    {
                        analysisType: 'pattern_outcome_correlation',
                        minimumSampleSize: 3,
                        focusAreas: ['effectiveness', 'reliability', 'maintainability'],
                        ...context
                    }
                );

                const correlation = this.parseCorrelationAnalysis(analysisResult, data);
                if (correlation) {
                    // Store correlation in database
                    await this.storePatternCorrelation(correlation);
                    correlations.push(correlation);
                }

            } catch (error) {
                this.logger.error(`LLM correlation analysis failed for pattern ${patternId}:`, error);
                // Fallback to rule-based analysis for this pattern
                const ruleBasedCorrelation = await this.performRuleBasedOutcomeCorrelation(
                    { [patternId]: data }, 
                    context
                );
                correlations.push(...ruleBasedCorrelation);
            }
        }

        return correlations;
    }

    /**
     * Rule-based outcome correlation analysis (fallback)
     */
    async performRuleBasedOutcomeCorrelation(patternOutcomes, context) {
        const correlations = [];

        for (const [patternId, data] of Object.entries(patternOutcomes)) {
            const outcomes = data.outcomes;
            if (outcomes.length < 2) continue;

            // Calculate success rate
            const successOutcomes = outcomes.filter(o => 
                o.type === 'success' || o.type === 'performance_gain'
            ).length;
            const failureOutcomes = outcomes.filter(o => 
                o.type === 'failure' || o.type === 'bug'
            ).length;
            
            const successRate = successOutcomes / (successOutcomes + failureOutcomes);
            
            // Determine correlation strength
            let correlationStrength = 'neutral';
            let confidence = 0.5;
            
            if (successRate >= 0.8) {
                correlationStrength = 'strong_positive';
                confidence = Math.min(0.9, 0.6 + (outcomes.length * 0.1));
            } else if (successRate <= 0.2) {
                correlationStrength = 'strong_negative';
                confidence = Math.min(0.9, 0.6 + (outcomes.length * 0.1));
            } else if (successRate >= 0.6) {
                correlationStrength = 'moderate_positive';
                confidence = Math.min(0.7, 0.5 + (outcomes.length * 0.05));
            } else if (successRate <= 0.4) {
                correlationStrength = 'moderate_negative';
                confidence = Math.min(0.7, 0.5 + (outcomes.length * 0.05));
            }

            const correlation = {
                pattern_id: patternId,
                pattern_name: data.pattern.name,
                pattern_category: data.pattern.category,
                correlation_strength: correlationStrength,
                confidence_score: confidence,
                success_rate: successRate,
                sample_size: outcomes.length,
                analysis_method: 'rule_based',
                insights: this.generateRuleBasedInsights(data, successRate),
                metadata: {
                    success_outcomes: successOutcomes,
                    failure_outcomes: failureOutcomes,
                    projects_analyzed: [...new Set(outcomes.map(o => o.project))].length
                }
            };

            await this.storePatternCorrelation(correlation);
            correlations.push(correlation);
        }

        return correlations;
    }

    /**
     * Parse LLM correlation analysis response
     */
    parseCorrelationAnalysis(analysisResult, patternData) {
        try {
            const content = analysisResult.content || '';
            
            // Extract correlation strength
            let correlationStrength = 'neutral';
            if (content.includes('strong positive') || content.includes('strongly positive')) {
                correlationStrength = 'strong_positive';
            } else if (content.includes('strong negative') || content.includes('strongly negative')) {
                correlationStrength = 'strong_negative';
            } else if (content.includes('moderate positive') || content.includes('moderately positive')) {
                correlationStrength = 'moderate_positive';
            } else if (content.includes('moderate negative') || content.includes('moderately negative')) {
                correlationStrength = 'moderate_negative';
            }

            // Extract confidence score (look for patterns like "confidence: 0.8" or "80% confident")
            let confidence = analysisResult.confidence || 0.5;
            const confidenceMatch = content.match(/confidence[:\s]+([0-9.]+)/i) || 
                                  content.match(/([0-9]+)%\s+confident/i);
            if (confidenceMatch) {
                const value = parseFloat(confidenceMatch[1]);
                confidence = value > 1 ? value / 100 : value;
            }

            return {
                pattern_id: patternData.pattern.id,
                pattern_name: patternData.pattern.name,
                pattern_category: patternData.pattern.category,
                correlation_strength: correlationStrength,
                confidence_score: confidence,
                sample_size: patternData.outcomes.length,
                analysis_method: 'llm_powered',
                insights: content,
                metadata: {
                    llm_model: analysisResult.model,
                    analysis_tokens: analysisResult.tokens,
                    projects_analyzed: [...new Set(patternData.outcomes.map(o => o.project))].length
                }
            };

        } catch (error) {
            this.logger.error('Failed to parse LLM correlation analysis:', error);
            return null;
        }
    }

    /**
     * Generate rule-based insights
     */
    generateRuleBasedInsights(patternData, successRate) {
        const pattern = patternData.pattern;
        const outcomes = patternData.outcomes;
        
        let insights = `Pattern Analysis for ${pattern.name}:\n\n`;
        insights += `Success Rate: ${(successRate * 100).toFixed(1)}%\n`;
        insights += `Sample Size: ${outcomes.length} outcomes\n`;
        insights += `Projects: ${[...new Set(outcomes.map(o => o.project))].join(', ')}\n\n`;
        
        if (successRate >= 0.8) {
            insights += 'RECOMMENDATION: This pattern shows strong positive correlation with success. Consider promoting its use.\n';
        } else if (successRate <= 0.2) {
            insights += 'WARNING: This pattern shows strong negative correlation with success. Review and consider refactoring.\n';
        } else if (successRate >= 0.6) {
            insights += 'OBSERVATION: This pattern shows moderate positive correlation. Generally good but monitor for improvements.\n';
        } else if (successRate <= 0.4) {
            insights += 'CAUTION: This pattern shows moderate negative correlation. Consider reviewing its implementation.\n';
        } else {
            insights += 'NEUTRAL: This pattern shows no clear correlation with success/failure. Context-dependent.\n';
        }

        return insights;
    }

    /**
     * Get pattern outcome data for analysis
     */
    async getPatternOutcomeData(context = {}) {
        try {
            const timeFilter = context.timeRange || '90 days';
            const projectFilter = context.projectId ? 'AND po.project_id = $2' : '';
            const params = context.projectId ? [timeFilter, context.projectId] : [timeFilter];

            const result = await this.db.query(`
                SELECT 
                    po.pattern_id,
                    po.project_id,
                    po.outcome_type,
                    po.outcome_value,
                    po.outcome_description,
                    po.metrics,
                    po.recorded_at,
                    cp.pattern_name,
                    cp.pattern_category,
                    cp.pattern_type,
                    p.name as project_name
                FROM pattern_outcomes po
                JOIN coding_patterns cp ON po.pattern_id = cp.id
                JOIN projects p ON po.project_id = p.id
                WHERE po.recorded_at > NOW() - INTERVAL $1
                ${projectFilter}
                ORDER BY po.recorded_at DESC
            `, params);

            return result.rows;

        } catch (error) {
            this.logger.error('Failed to get pattern outcome data:', error);
            return [];
        }
    }

    /**
     * Store pattern correlation analysis results
     */
    async storePatternCorrelation(correlation) {
        try {
            await this.db.query(`
                INSERT INTO pattern_correlations (
                    pattern_id, correlation_strength, confidence_score, sample_size,
                    analysis_method, insights, metadata, analyzed_at
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
                ON CONFLICT (pattern_id) DO UPDATE SET
                    correlation_strength = EXCLUDED.correlation_strength,
                    confidence_score = EXCLUDED.confidence_score,
                    sample_size = EXCLUDED.sample_size,
                    analysis_method = EXCLUDED.analysis_method,
                    insights = EXCLUDED.insights,
                    metadata = EXCLUDED.metadata,
                    analyzed_at = NOW()
            `, [
                correlation.pattern_id,
                correlation.correlation_strength,
                correlation.confidence_score,
                correlation.sample_size,
                correlation.analysis_method,
                correlation.insights,
                JSON.stringify(correlation.metadata)
            ]);

        } catch (error) {
            this.logger.error('Failed to store pattern correlation:', error);
        }
    }

    /**
     * Trigger outcome correlation analysis for project events
     */
    async triggerOutcomeAnalysis(projectId, eventType, eventData = {}) {
        try {
            // Record outcomes for patterns used in this project
            const patterns = await this.getProjectPatterns(projectId);
            
            for (const pattern of patterns) {
                const outcomeType = this.determineOutcomeType(eventType, eventData);
                if (outcomeType) {
                    await this.recordPatternOutcome(
                        projectId, 
                        pattern.pattern_id, 
                        outcomeType, 
                        eventData
                    );
                }
            }

            // If significant event, trigger correlation analysis
            if (['project_completion', 'major_bug', 'performance_improvement'].includes(eventType)) {
                await this.analyzePatternOutcomeCorrelations({ projectId });
            }

        } catch (error) {
            this.logger.error('Failed to trigger outcome analysis:', error);
        }
    }

    /**
     * Get patterns used in a project
     */
    async getProjectPatterns(projectId) {
        try {
            const result = await this.db.query(`
                SELECT DISTINCT po.pattern_id, cp.pattern_name, cp.pattern_category
                FROM pattern_occurrences po
                JOIN coding_patterns cp ON po.pattern_id = cp.id
                JOIN memories m ON po.memory_id = m.id
                WHERE m.project_id = $1
                  AND po.detected_at > NOW() - INTERVAL '30 days'
            `, [projectId]);

            return result.rows;

        } catch (error) {
            this.logger.error('Failed to get project patterns:', error);
            return [];
        }
    }

    /**
     * Determine outcome type from event
     */
    determineOutcomeType(eventType, eventData) {
        const outcomeMap = {
            'project_completion': 'success',
            'deployment_success': 'success',
            'bug_report': 'bug',
            'major_bug': 'failure',
            'performance_improvement': 'performance_gain',
            'refactor_completion': 'success',
            'test_failure': 'failure',
            'security_issue': 'failure'
        };

        return outcomeMap[eventType] || null;
    }

    /**
     * Create tasks based on detected patterns
     */
    async createPatternRelatedTasks(memory, patterns) {
        try {
            // Only create tasks for significant patterns
            const significantPatterns = patterns.filter(p => 
                p.confidence >= 0.7 || p.detectionMethod === 'user_explicit'
            );
            
            if (significantPatterns.length === 0) return;
            
            // Check if we should create a documentation task
            const undocumentedPatterns = significantPatterns.filter(p => 
                !p.detectionMethod || p.detectionMethod === 'keyword'
            );
            
            if (undocumentedPatterns.length >= 2) {
                await this.db.query(`
                    INSERT INTO memories (project_id, session_id, content, memory_type, metadata)
                    SELECT $1, $2, $3, 'task', $4
                    WHERE NOT EXISTS (
                        SELECT 1 FROM memories 
                        WHERE project_id = $1 
                        AND memory_type = 'task'
                        AND metadata->>'title' = $5
                    )
                `, [
                    memory.project_id,
                    memory.session_id,
                    JSON.stringify({
                        title: 'Document detected patterns',
                        description: `Document ${undocumentedPatterns.length} patterns detected in recent memories`,
                        priority: 'medium',
                        status: 'pending',
                        source: 'learning_pipeline',
                        patterns: undocumentedPatterns.map(p => p.name),
                        relatedMemories: [memory.id]
                    }),
                    JSON.stringify({
                        title: 'Document detected patterns',
                        source: 'learning_pipeline',
                        patternCount: undocumentedPatterns.length
                    }),
                    'Document detected patterns'
                ]);
            }
            
            // Check for anti-patterns that need fixing
            const antiPatterns = patterns.filter(p => p.category === 'anti_pattern');
            if (antiPatterns.length > 0) {
                for (const antiPattern of antiPatterns) {
                    await this.db.query(`
                        INSERT INTO memories (project_id, session_id, content, memory_type, metadata)
                        VALUES ($1, $2, $3, 'task', $4)
                    `, [
                        memory.project_id,
                        memory.session_id,
                        JSON.stringify({
                            title: `Fix ${antiPattern.name}`,
                            description: `Address the ${antiPattern.name} detected in the codebase`,
                            priority: 'high',
                            status: 'pending',
                            source: 'learning_pipeline',
                            pattern: antiPattern.name,
                            relatedMemories: [memory.id],
                            impact: 8,
                            urgency: 7,
                            effort: 5
                        }),
                        JSON.stringify({
                            title: `Fix ${antiPattern.name}`,
                            source: 'learning_pipeline',
                            patternType: 'anti_pattern'
                        })
                    ]);
                }
            }
        } catch (error) {
            this.logger.error('Failed to create pattern-related tasks:', error);
        }
    }
    
    /**
     * Helper methods for pattern and technology extraction
     */
    async extractPatterns(memory) {
        // Rule-based pattern extraction using keyword matching
        const patterns = [];
        const content = memory.content.toLowerCase();
        
        // Architectural patterns
        if (content.includes('microservice') || content.includes('micro-service')) {
            patterns.push({
                category: 'architectural',
                type: 'microservices',
                name: 'Microservices Architecture',
                signature: 'microservices_architecture',
                description: 'Distributed architecture with independent services',
                languages: ['any'],
                example: content.substring(0, 200)
            });
        }
        
        if (content.includes('mvc') || (content.includes('model') && content.includes('view') && content.includes('controller'))) {
            patterns.push({
                category: 'architectural',
                type: 'mvc',
                name: 'Model-View-Controller',
                signature: 'mvc_pattern',
                description: 'MVC architectural pattern',
                languages: ['any'],
                example: content.substring(0, 200)
            });
        }
        
        // Creational patterns
        if (content.includes('singleton') || content.includes('single instance')) {
            patterns.push({
                category: 'creational',
                type: 'singleton',
                name: 'Singleton Pattern',
                signature: 'singleton_pattern',
                description: 'Ensures only one instance of a class exists',
                languages: ['any'],
                example: content.substring(0, 200)
            });
        }
        
        if (content.includes('factory') && (content.includes('create') || content.includes('build'))) {
            patterns.push({
                category: 'creational',
                type: 'factory',
                name: 'Factory Pattern',
                signature: 'factory_pattern',
                description: 'Creates objects without specifying exact class',
                languages: ['any'],
                example: content.substring(0, 200)
            });
        }
        
        // API patterns
        if (content.includes('rest') || content.includes('restful')) {
            patterns.push({
                category: 'api_patterns',
                type: 'rest',
                name: 'RESTful API',
                signature: 'rest_api',
                description: 'RESTful API design pattern',
                languages: ['any'],
                example: content.substring(0, 200)
            });
        }
        
        if (content.includes('graphql')) {
            patterns.push({
                category: 'api_patterns',
                type: 'graphql',
                name: 'GraphQL API',
                signature: 'graphql_api',
                description: 'GraphQL API pattern',
                languages: ['any'],
                example: content.substring(0, 200)
            });
        }
        
        // Messaging patterns
        if (content.includes('pub/sub') || content.includes('publish') && content.includes('subscribe')) {
            patterns.push({
                category: 'messaging',
                type: 'pub_sub',
                name: 'Publish-Subscribe',
                signature: 'pub_sub_pattern',
                description: 'Publish-Subscribe messaging pattern',
                languages: ['any'],
                example: content.substring(0, 200)
            });
        }
        
        // Data processing patterns
        if (content.includes('batch') && (content.includes('process') || content.includes('job'))) {
            patterns.push({
                category: 'data_processing',
                type: 'batch_processing',
                name: 'Batch Processing',
                signature: 'batch_processing',
                description: 'Processing data in batches',
                languages: ['any'],
                example: content.substring(0, 200)
            });
        }
        
        if (content.includes('stream') && content.includes('processing')) {
            patterns.push({
                category: 'data_processing',
                type: 'stream_processing',
                name: 'Stream Processing',
                signature: 'stream_processing',
                description: 'Real-time stream data processing',
                languages: ['any'],
                example: content.substring(0, 200)
            });
        }
        
        // Error handling patterns
        if (content.includes('try') && content.includes('catch')) {
            patterns.push({
                category: 'error_handling',
                type: 'try_catch',
                name: 'Try-Catch Error Handling',
                signature: 'try_catch_pattern',
                description: 'Structured error handling using try-catch blocks',
                languages: ['javascript', 'typescript', 'java', 'python', 'csharp'],
                example: content.substring(0, 200)
            });
        }
        
        if (content.includes('retry') && (content.includes('error') || content.includes('fail'))) {
            patterns.push({
                category: 'error_handling',
                type: 'retry_logic',
                name: 'Retry Logic',
                signature: 'retry_pattern',
                description: 'Automatic retry on failure',
                languages: ['any'],
                example: content.substring(0, 200)
            });
        }
        
        // Performance patterns
        if (content.includes('cache') || content.includes('caching')) {
            patterns.push({
                category: 'performance',
                type: 'caching',
                name: 'Caching Pattern',
                signature: 'caching_pattern',
                description: 'Using cache for performance optimization',
                languages: ['any'],
                example: content.substring(0, 200)
            });
        }
        
        // Security patterns
        if (content.includes('jwt') || content.includes('json web token')) {
            patterns.push({
                category: 'security',
                type: 'jwt',
                name: 'JWT Authentication',
                signature: 'jwt_auth',
                description: 'JSON Web Token authentication pattern',
                languages: ['any'],
                example: content.substring(0, 200)
            });
        }
        
        if (content.includes('oauth')) {
            patterns.push({
                category: 'security',
                type: 'oauth',
                name: 'OAuth Authentication',
                signature: 'oauth_pattern',
                description: 'OAuth authentication flow',
                languages: ['any'],
                example: content.substring(0, 200)
            });
        }
        
        // Testing patterns
        if (content.includes('mock') || content.includes('stub')) {
            patterns.push({
                category: 'testing',
                type: 'mock',
                name: 'Mock/Stub Pattern',
                signature: 'mock_stub_pattern',
                description: 'Using mocks or stubs for testing',
                languages: ['any'],
                example: content.substring(0, 200)
            });
        }
        
        if (content.includes('unit test') || content.includes('unittest')) {
            patterns.push({
                category: 'testing',
                type: 'unit_test',
                name: 'Unit Testing',
                signature: 'unit_test_pattern',
                description: 'Unit testing pattern for isolated component testing',
                languages: ['any'],
                example: content.substring(0, 200)
            });
        }
        
        // Frontend patterns
        if (content.includes('component') && (content.includes('react') || content.includes('vue') || content.includes('angular'))) {
            patterns.push({
                category: 'frontend',
                type: 'component',
                name: 'Component-Based Architecture',
                signature: 'component_pattern',
                description: 'Component-based UI architecture',
                languages: ['javascript', 'typescript'],
                example: content.substring(0, 200)
            });
        }
        
        if (content.includes('responsive') && content.includes('design')) {
            patterns.push({
                category: 'user_experience',
                type: 'responsive_design',
                name: 'Responsive Design',
                signature: 'responsive_design_pattern',
                description: 'Responsive web design pattern',
                languages: ['css', 'html', 'javascript'],
                example: content.substring(0, 200)
            });
        }
        
        // Cloud platform patterns
        if (content.includes('aws') || content.includes('amazon web services')) {
            patterns.push({
                category: 'cloud_platforms',
                type: 'aws',
                name: 'AWS Cloud Platform',
                signature: 'aws_platform',
                description: 'Amazon Web Services cloud platform usage',
                languages: ['any'],
                example: content.substring(0, 200)
            });
        }
        
        if (content.includes('lambda') && content.includes('function')) {
            patterns.push({
                category: 'cloud_platforms',
                type: 'serverless_computing',
                name: 'Serverless Computing',
                signature: 'serverless_pattern',
                description: 'Serverless function-as-a-service pattern',
                languages: ['any'],
                example: content.substring(0, 200)
            });
        }
        
        if (content.includes('kubernetes') || content.includes('k8s')) {
            patterns.push({
                category: 'infrastructure_ops',
                type: 'kubernetes',
                name: 'Kubernetes Orchestration',
                signature: 'kubernetes_pattern',
                description: 'Container orchestration with Kubernetes',
                languages: ['yaml', 'any'],
                example: content.substring(0, 200)
            });
        }
        
        // Data engineering patterns
        if (content.includes('kafka')) {
            patterns.push({
                category: 'data_engineering',
                type: 'apache_kafka',
                name: 'Apache Kafka Streaming',
                signature: 'kafka_streaming',
                description: 'Event streaming with Apache Kafka',
                languages: ['any'],
                example: content.substring(0, 200)
            });
        }
        
        if (content.includes('spark')) {
            patterns.push({
                category: 'data_engineering',
                type: 'apache_spark',
                name: 'Apache Spark Processing',
                signature: 'spark_processing',
                description: 'Big data processing with Apache Spark',
                languages: ['scala', 'python', 'java'],
                example: content.substring(0, 200)
            });
        }
        
        // Process methodology patterns
        if (content.includes('agile') || content.includes('scrum')) {
            patterns.push({
                category: 'process_methodology',
                type: 'agile',
                name: 'Agile Methodology',
                signature: 'agile_process',
                description: 'Agile development methodology',
                languages: ['any'],
                example: content.substring(0, 200)
            });
        }
        
        if (content.includes('ci/cd') || content.includes('continuous integration')) {
            patterns.push({
                category: 'process_methodology',
                type: 'continuous_integration',
                name: 'Continuous Integration',
                signature: 'ci_cd_pattern',
                description: 'Continuous integration and deployment',
                languages: ['any'],
                example: content.substring(0, 200)
            });
        }
        
        // Deployment patterns
        if (content.includes('blue') && content.includes('green') && content.includes('deploy')) {
            patterns.push({
                category: 'deployment',
                type: 'blue_green_deployment',
                name: 'Blue-Green Deployment',
                signature: 'blue_green_deploy',
                description: 'Blue-green deployment strategy',
                languages: ['any'],
                example: content.substring(0, 200)
            });
        }
        
        if (content.includes('canary') && content.includes('deploy')) {
            patterns.push({
                category: 'deployment',
                type: 'canary_deployment',
                name: 'Canary Deployment',
                signature: 'canary_deploy',
                description: 'Canary deployment strategy for gradual rollout',
                languages: ['any'],
                example: content.substring(0, 200)
            });
        }
        
        // Observability patterns
        if (content.includes('monitor') || content.includes('observability')) {
            patterns.push({
                category: 'observability',
                type: 'monitoring',
                name: 'Application Monitoring',
                signature: 'monitoring_pattern',
                description: 'Application and infrastructure monitoring',
                languages: ['any'],
                example: content.substring(0, 200)
            });
        }
        
        if (content.includes('distributed tracing') || content.includes('tracing')) {
            patterns.push({
                category: 'observability',
                type: 'distributed_tracing',
                name: 'Distributed Tracing',
                signature: 'distributed_tracing_pattern',
                description: 'Distributed system request tracing',
                languages: ['any'],
                example: content.substring(0, 200)
            });
        }
        
        // Programming paradigm patterns
        if (content.includes('async') && content.includes('await')) {
            patterns.push({
                category: 'programming_paradigms',
                type: 'async_await',
                name: 'Async/Await Pattern',
                signature: 'async_await_pattern',
                description: 'Asynchronous programming with async/await',
                languages: ['javascript', 'typescript', 'python', 'csharp'],
                example: content.substring(0, 200)
            });
        }
        
        if (content.includes('functional') && content.includes('programming')) {
            patterns.push({
                category: 'programming_paradigms',
                type: 'functional_programming',
                name: 'Functional Programming',
                signature: 'functional_paradigm',
                description: 'Functional programming paradigm usage',
                languages: ['javascript', 'haskell', 'scala', 'clojure'],
                example: content.substring(0, 200)
            });
        }
        
        // Network protocol patterns
        if (content.includes('load balance') || content.includes('load balancer')) {
            patterns.push({
                category: 'network_protocols',
                type: 'load_balancing',
                name: 'Load Balancing',
                signature: 'load_balancing_pattern',
                description: 'Traffic distribution across multiple servers',
                languages: ['any'],
                example: content.substring(0, 200)
            });
        }
        
        if (content.includes('service mesh')) {
            patterns.push({
                category: 'network_protocols',
                type: 'service_mesh',
                name: 'Service Mesh',
                signature: 'service_mesh_pattern',
                description: 'Service-to-service communication infrastructure',
                languages: ['any'],
                example: content.substring(0, 200)
            });
        }
        
        // Reliability patterns
        if (content.includes('high availability') || content.includes('ha')) {
            patterns.push({
                category: 'reliability',
                type: 'high_availability',
                name: 'High Availability',
                signature: 'high_availability_pattern',
                description: 'High availability system design',
                languages: ['any'],
                example: content.substring(0, 200)
            });
        }
        
        if (content.includes('disaster recovery') || content.includes('dr')) {
            patterns.push({
                category: 'reliability',
                type: 'disaster_recovery',
                name: 'Disaster Recovery',
                signature: 'disaster_recovery_pattern',
                description: 'Disaster recovery and business continuity',
                languages: ['any'],
                example: content.substring(0, 200)
            });
        }
        
        // Quality assurance patterns
        if (content.includes('code coverage') || content.includes('test coverage')) {
            patterns.push({
                category: 'quality_assurance',
                type: 'code_coverage',
                name: 'Code Coverage Analysis',
                signature: 'code_coverage_pattern',
                description: 'Test coverage measurement and analysis',
                languages: ['any'],
                example: content.substring(0, 200)
            });
        }
        
        if (content.includes('static analysis') || content.includes('linting')) {
            patterns.push({
                category: 'quality_assurance',
                type: 'static_analysis',
                name: 'Static Code Analysis',
                signature: 'static_analysis_pattern',
                description: 'Static code analysis and quality checks',
                languages: ['any'],
                example: content.substring(0, 200)
            });
        }
        
        // Algorithm patterns
        if (content.includes('sorting') && content.includes('algorithm')) {
            patterns.push({
                category: 'algorithms',
                type: 'sorting_algorithms',
                name: 'Sorting Algorithms',
                signature: 'sorting_algorithm_pattern',
                description: 'Data sorting algorithm implementation',
                languages: ['any'],
                example: content.substring(0, 200)
            });
        }
        
        if (content.includes('binary tree') || content.includes('b-tree')) {
            patterns.push({
                category: 'algorithms',
                type: 'binary_trees',
                name: 'Binary Tree Structures',
                signature: 'binary_tree_pattern',
                description: 'Binary tree data structure usage',
                languages: ['any'],
                example: content.substring(0, 200)
            });
        }
        
        return patterns;
    }

    extractTechnologies(content) {
        const techRegex = /\b(react|vue|angular|node|nodejs|python|java|postgres|postgresql|mysql|mongodb|docker|kubernetes|redis|aws|azure|gcp)\b/gi;
        const matches = content.match(techRegex) || [];
        return [...new Set(matches.map(t => t.toLowerCase()))];
    }

    isPositiveMention(content, tech) {
        const positiveWords = ['love', 'great', 'excellent', 'perfect', 'amazing', 'works well', 'prefer'];
        const techIndex = content.toLowerCase().indexOf(tech.toLowerCase());
        if (techIndex === -1) return false;
        
        const context = content.substring(Math.max(0, techIndex - 50), techIndex + 50).toLowerCase();
        return positiveWords.some(word => context.includes(word));
    }

    isNegativeMention(content, tech) {
        const negativeWords = ['hate', 'terrible', 'awful', 'broken', 'issues', 'problems', 'slow'];
        const techIndex = content.toLowerCase().indexOf(tech.toLowerCase());
        if (techIndex === -1) return false;
        
        const context = content.substring(Math.max(0, techIndex - 50), techIndex + 50).toLowerCase();
        return negativeWords.some(word => context.includes(word));
    }

    categorizeTechnology(tech) {
        const categories = {
            'react': 'frontend_framework',
            'vue': 'frontend_framework', 
            'angular': 'frontend_framework',
            'node': 'backend_runtime',
            'nodejs': 'backend_runtime',
            'python': 'programming_language',
            'java': 'programming_language',
            'postgres': 'database',
            'postgresql': 'database',
            'mysql': 'database',
            'mongodb': 'database',
            'docker': 'containerization',
            'kubernetes': 'orchestration',
            'redis': 'cache',
            'aws': 'cloud_platform',
            'azure': 'cloud_platform',
            'gcp': 'cloud_platform'
        };
        
        return categories[tech.toLowerCase()] || 'other';
    }

    mapPatternType(patternType) {
        // Map pattern types to allowed values in database constraint
        const typeMapping = {
            'microservices': 'api_design',
            'architectural': 'api_design',
            'design': 'function_structure',
            'coding': 'function_structure',
            'technology': 'configuration',
            'anti_pattern': 'error_handling',
            'lesson': 'function_structure',
            'explicit': 'function_structure',
            'system': 'performance',
            'infrastructure': 'configuration',
            'deployment': 'configuration',
            'monitoring': 'performance',
            'logging': 'error_handling',
            'testing': 'testing_approach',
            'database': 'data_modeling',
            'api': 'api_design',
            'frontend': 'function_structure',
            'backend': 'function_structure',
            'auth': 'security',
            'authentication': 'security',
            'authorization': 'security'
        };
        
        return typeMapping[patternType.toLowerCase()] || 'function_structure';
    }

    async createInsightFromPattern(pattern, insightType) {
        try {
            const embedding = await this.embeddingService.generateEmbedding(pattern.pattern_description);
            
            const insight = {
                insight_type: insightType,
                insight_category: 'code_quality',
                insight_title: `${pattern.pattern_name} - ${insightType === 'best_practice' ? 'Recommended Practice' : 'Potential Issue'}`,
                insight_description: `Pattern "${pattern.pattern_name}" appears ${pattern.frequency_count} times across ${pattern.projects_seen.length} projects`,
                evidence_strength: Math.min(pattern.confidence_score + 0.2, 1.0),
                source_patterns_count: 1,
                projects_involved: pattern.projects_seen,
                confidence_level: pattern.confidence_score,
                insight_embedding: JSON.stringify(embedding)
            };

            await this.db.query(`
                INSERT INTO meta_insights 
                (insight_type, insight_category, insight_title, insight_description,
                 evidence_strength, source_patterns_count, projects_involved,
                 confidence_level, insight_embedding)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
                ON CONFLICT DO NOTHING
            `, [
                insight.insight_type,
                insight.insight_category, 
                insight.insight_title,
                insight.insight_description,
                insight.evidence_strength,
                insight.source_patterns_count,
                insight.projects_involved,
                insight.confidence_level,
                insight.insight_embedding
            ]);

            return insight;
        } catch (error) {
            this.logger.error('Failed to create insight:', error);
            return null;
        }
    }

    /**
     * Setup and cleanup methods
     */
    async setupRealTimeTriggers() {
        this.logger.info('Setting up real-time learning triggers');
        // Real-time triggers are handled via onMemoryAdded method
    }

    async setupScheduledProcessing() {
        this.logger.info('Setting up scheduled learning processing');
        
        // Queue initial scheduled tasks
        const tasks = [
            { type: 'pattern_detection', priority: 3, delay: 0 },
            { type: 'insight_generation', priority: 4, delay: 3600000 }, // 1 hour delay
            { type: 'preference_analysis', priority: 5, delay: 7200000 }, // 2 hour delay
            { type: 'evolution_tracking', priority: 6, delay: 10800000 }  // 3 hour delay
        ];

        for (const task of tasks) {
            await this.queueLearningTask(task.type, { trigger: 'scheduled' }, task.priority);
        }
    }

    async cleanupProcessingQueue() {
        try {
            // Remove completed tasks older than 7 days
            const result = await this.db.query(`
                DELETE FROM learning_processing_queue
                WHERE status = 'completed' 
                  AND completed_at < NOW() - INTERVAL '7 days'
            `);

            // Reset stuck processing tasks older than 1 hour
            await this.db.query(`
                UPDATE learning_processing_queue
                SET status = 'retry',
                    retry_count = retry_count + 1,
                    scheduled_for = NOW() + INTERVAL '5 minutes'
                WHERE status = 'processing'
                  AND started_at < NOW() - INTERVAL '1 hour'
                  AND retry_count < max_retries
            `);

            this.logger.info(`Cleaned up ${result.rowCount} old learning tasks`);
        } catch (error) {
            this.logger.error('Failed to cleanup processing queue:', error);
        }
    }

    /**
     * Get learning pipeline status with detailed scheduling and coverage info
     */
    async getStatus() {
        try {
            const queueStats = await this.db.query(`
                SELECT status, COUNT(*) as count
                FROM learning_processing_queue
                GROUP BY status
            `);

            const patternStats = await this.db.query(`
                SELECT 
                    COUNT(*) as total_patterns,
                    AVG(confidence_score) as avg_confidence
                FROM coding_patterns
            `);

            const uniqueProjectsResult = await this.db.query(`
                SELECT COUNT(DISTINCT project) as unique_projects 
                FROM (SELECT unnest(projects_seen) as project FROM coding_patterns) AS t
            `);

            const insightStats = await this.db.query(`
                SELECT insight_type, COUNT(*) as count
                FROM meta_insights
                GROUP BY insight_type
            `);

            // Get detailed scheduling information
            const schedulingInfo = await this.getDetailedSchedulingInfo();
            
            // Get memory coverage statistics
            const memoryCoverage = await this.getMemoryCoverageStats();
            
            // Get processing progress metrics
            const processingProgress = await this.getProcessingProgressMetrics();

            return {
                status: this.isProcessing ? 'processing' : 'idle',
                realTimeEnabled: this.config.realTime.enabled,
                scheduledEnabled: this.config.scheduled.enabled,
                memoryBufferSize: this.memoryBuffer.length,
                queue: queueStats.rows,
                patterns: {
                    ...patternStats.rows[0] || {},
                    unique_projects: uniqueProjectsResult.rows[0]?.unique_projects || 0
                },
                insights: insightStats.rows,
                lastProcessed: this.lastProcessed,
                scheduling: schedulingInfo,
                memoryCoverage: memoryCoverage,
                processingProgress: processingProgress
            };
        } catch (error) {
            this.logger.error('Failed to get learning pipeline status:', error);
            return { status: 'error', error: error.message };
        }
    }

    /**
     * Get detailed scheduling information for all learning tasks
     */
    async getDetailedSchedulingInfo() {
        try {
            const taskTypes = ['pattern_detection', 'insight_generation', 'preference_analysis', 'evolution_tracking'];
            const schedulingInfo = {};

            for (const taskType of taskTypes) {
                // Get last run time
                const lastRunResult = await this.db.query(`
                    SELECT MAX(completed_at) as last_run
                    FROM learning_processing_queue
                    WHERE task_type = $1 AND status = 'completed'
                `, [taskType]);

                // Get next scheduled time (estimate based on intervals)
                const intervals = {
                    'pattern_detection': 3600000, // 1 hour
                    'insight_generation': 3600000, // 1 hour  
                    'preference_analysis': 3600000, // 1 hour
                    'evolution_tracking': 3600000 // 1 hour
                };

                const lastRun = lastRunResult.rows[0]?.last_run;
                const interval = intervals[taskType];
                const nextScheduled = lastRun ? 
                    new Date(new Date(lastRun).getTime() + interval) : 
                    new Date(Date.now() + interval);

                // Get pending tasks count for this type
                const pendingResult = await this.db.query(`
                    SELECT COUNT(*) as pending_count
                    FROM learning_processing_queue
                    WHERE task_type = $1 AND status = 'pending'
                `, [taskType]);

                schedulingInfo[taskType] = {
                    lastRun: lastRun,
                    nextScheduled: nextScheduled,
                    intervalMs: interval,
                    intervalHuman: this.formatInterval(interval),
                    pendingTasks: parseInt(pendingResult.rows[0]?.pending_count || 0),
                    isOverdue: nextScheduled < new Date()
                };
            }

            // Add learning queue processing info (every 15 minutes)
            const queueLastRun = await this.db.query(`
                SELECT MAX(completed_at) as last_run
                FROM learning_processing_queue
                WHERE status = 'completed'
            `);
            
            const queueInterval = 900000; // 15 minutes
            const queueLastRunTime = queueLastRun.rows[0]?.last_run;
            const queueNextScheduled = queueLastRunTime ? 
                new Date(new Date(queueLastRunTime).getTime() + queueInterval) : 
                new Date(Date.now() + queueInterval);

            schedulingInfo.learning_queue_processing = {
                lastRun: queueLastRunTime,
                nextScheduled: queueNextScheduled,
                intervalMs: queueInterval,
                intervalHuman: this.formatInterval(queueInterval),
                isOverdue: queueNextScheduled < new Date()
            };

            return schedulingInfo;
        } catch (error) {
            this.logger.error('Failed to get scheduling info:', error);
            return {};
        }
    }

    /**
     * Get memory coverage statistics
     */
    async getMemoryCoverageStats() {
        try {
            // Total memories
            const totalMemoriesResult = await this.db.query(`
                SELECT COUNT(*) as total_memories
                FROM memories
            `);

            // Memories with patterns detected
            const memoriesWithPatternsResult = await this.db.query(`
                SELECT COUNT(DISTINCT m.id) as memories_with_patterns
                FROM memories m
                JOIN coding_patterns cp ON m.project_id = ANY(
                    SELECT unnest(string_to_array(array_to_string(cp.projects_seen, ','), ','))::int
                )
                WHERE cp.created_at >= m.created_at
            `);

            // Memories processed for insights (approximation)
            const memoriesProcessedResult = await this.db.query(`
                SELECT COUNT(DISTINCT m.id) as memories_processed
                FROM memories m
                WHERE m.created_at <= (
                    SELECT MAX(completed_at) 
                    FROM learning_processing_queue 
                    WHERE task_type = 'insight_generation' AND status = 'completed'
                )
            `);

            // Memory types breakdown
            const memoryTypesResult = await this.db.query(`
                SELECT memory_type, COUNT(*) as count
                FROM memories
                GROUP BY memory_type
                ORDER BY count DESC
            `);

            // Recent memories (last 24 hours)
            const recentMemoriesResult = await this.db.query(`
                SELECT COUNT(*) as recent_memories
                FROM memories
                WHERE created_at > NOW() - INTERVAL '24 hours'
            `);

            const totalMemories = parseInt(totalMemoriesResult.rows[0]?.total_memories || 0);
            const memoriesWithPatterns = parseInt(memoriesWithPatternsResult.rows[0]?.memories_with_patterns || 0);
            const memoriesProcessed = parseInt(memoriesProcessedResult.rows[0]?.memories_processed || 0);
            const recentMemories = parseInt(recentMemoriesResult.rows[0]?.recent_memories || 0);

            return {
                totalMemories: totalMemories,
                memoriesWithPatterns: memoriesWithPatterns,
                memoriesProcessed: memoriesProcessed,
                recentMemories: recentMemories,
                patternCoveragePercent: totalMemories > 0 ? Math.round((memoriesWithPatterns / totalMemories) * 100) : 0,
                processingCoveragePercent: totalMemories > 0 ? Math.round((memoriesProcessed / totalMemories) * 100) : 0,
                memoryTypeBreakdown: memoryTypesResult.rows,
                unprocessedMemories: totalMemories - memoriesProcessed
            };
        } catch (error) {
            this.logger.error('Failed to get memory coverage stats:', error);
            return {
                totalMemories: 0,
                memoriesWithPatterns: 0,
                memoriesProcessed: 0,
                patternCoveragePercent: 0,
                processingCoveragePercent: 0
            };
        }
    }

    /**
     * Get processing progress metrics
     */
    async getProcessingProgressMetrics() {
        try {
            // Processing queue metrics
            const queueMetricsResult = await this.db.query(`
                SELECT 
                    status,
                    COUNT(*) as count,
                    AVG(EXTRACT(EPOCH FROM (completed_at - created_at))) as avg_duration_seconds
                FROM learning_processing_queue
                WHERE created_at > NOW() - INTERVAL '24 hours'
                GROUP BY status
            `);

            // Task type performance
            const taskPerformanceResult = await this.db.query(`
                SELECT 
                    task_type,
                    COUNT(*) as total_tasks,
                    COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_tasks,
                    COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed_tasks,
                    AVG(processing_duration_ms) as avg_duration_ms
                FROM learning_processing_queue
                WHERE created_at > NOW() - INTERVAL '7 days'
                GROUP BY task_type
            `);

            // Recent activity (last hour)
            const recentActivityResult = await this.db.query(`
                SELECT COUNT(*) as recent_tasks
                FROM learning_processing_queue
                WHERE created_at > NOW() - INTERVAL '1 hour'
            `);

            // Error rate
            const errorRateResult = await this.db.query(`
                SELECT 
                    COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed_count,
                    COUNT(*) as total_count
                FROM learning_processing_queue
                WHERE created_at > NOW() - INTERVAL '24 hours'
            `);

            const queueMetrics = queueMetricsResult.rows.reduce((acc, row) => {
                acc[row.status] = {
                    count: parseInt(row.count),
                    avgDurationSeconds: parseFloat(row.avg_duration_seconds || 0)
                };
                return acc;
            }, {});

            const taskPerformance = taskPerformanceResult.rows.map(row => ({
                taskType: row.task_type,
                totalTasks: parseInt(row.total_tasks),
                completedTasks: parseInt(row.completed_tasks),
                failedTasks: parseInt(row.failed_tasks),
                successRate: row.total_tasks > 0 ? Math.round((row.completed_tasks / row.total_tasks) * 100) : 0,
                avgDurationMs: parseFloat(row.avg_duration_ms || 0)
            }));

            const recentTasks = parseInt(recentActivityResult.rows[0]?.recent_tasks || 0);
            const errorStats = errorRateResult.rows[0];
            const errorRate = errorStats?.total_count > 0 ? 
                Math.round((errorStats.failed_count / errorStats.total_count) * 100) : 0;

            return {
                queueMetrics: queueMetrics,
                taskPerformance: taskPerformance,
                recentActivity: recentTasks,
                errorRate: errorRate,
                systemHealth: errorRate < 5 ? 'healthy' : errorRate < 15 ? 'degraded' : 'unhealthy'
            };
        } catch (error) {
            this.logger.error('Failed to get processing progress metrics:', error);
            return {
                queueMetrics: {},
                taskPerformance: [],
                recentActivity: 0,
                errorRate: 0,
                systemHealth: 'unknown'
            };
        }
    }

    /**
     * Format interval milliseconds to human readable string
     */
    formatInterval(intervalMs) {
        const minutes = Math.floor(intervalMs / 60000);
        const hours = Math.floor(minutes / 60);
        const days = Math.floor(hours / 24);

        if (days > 0) return `${days} day${days > 1 ? 's' : ''}`;
        if (hours > 0) return `${hours} hour${hours > 1 ? 's' : ''}`;
        return `${minutes} minute${minutes > 1 ? 's' : ''}`;
    }
}

export default LearningPipeline;