/**
 * Learning Pipeline for MiniMe-MCP
 * Handles continuous learning from memories and scheduled analysis
 */

import { EmbeddingService } from './embedding-service.js';

export class LearningPipeline {
    constructor(logger, databaseService, embeddingService) {
        this.logger = logger;
        this.db = databaseService;
        this.embeddingService = embeddingService;
        
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
        const { memoryId, projectId, content } = payload;
        
        try {
            // Get memory details
            const memoryResult = await this.db.query(`
                SELECT m.*, p.name as project_name
                FROM memories m
                JOIN projects p ON m.project_id = p.id
                WHERE m.id = $1
            `, [memoryId]);

            if (memoryResult.rows.length === 0) {
                throw new Error(`Memory ${memoryId} not found`);
            }

            const memory = memoryResult.rows[0];
            
            // Simple pattern detection logic (can be enhanced with LLM analysis)
            const patterns = await this.extractPatterns(memory);
            
            let createdPatterns = 0;
            for (const pattern of patterns) {
                // Check if pattern already exists
                const existingResult = await this.db.query(`
                    SELECT id, frequency_count, projects_seen
                    FROM coding_patterns
                    WHERE pattern_signature = $1
                `, [pattern.signature]);

                if (existingResult.rows.length > 0) {
                    // Update existing pattern
                    const existing = existingResult.rows[0];
                    const newProjectsSeen = [...new Set([...existing.projects_seen, memory.project_name])];
                    
                    await this.db.query(`
                        UPDATE coding_patterns 
                        SET frequency_count = frequency_count + 1,
                            projects_seen = $2,
                            last_reinforced = NOW(),
                            confidence_score = LEAST(confidence_score + 0.1, 1.0)
                        WHERE id = $1
                    `, [existing.id, newProjectsSeen]);
                } else {
                    // Create new pattern
                    const embedding = await this.embeddingService.generateEmbedding(pattern.description);
                    
                    await this.db.query(`
                        INSERT INTO coding_patterns 
                        (pattern_category, pattern_type, pattern_name, pattern_signature, pattern_description,
                         languages, projects_seen, pattern_embedding, example_code)
                        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
                    `, [
                        pattern.category,
                        pattern.type,
                        pattern.name,
                        pattern.signature,
                        pattern.description,
                        pattern.languages || [],
                        [memory.project_name],
                        JSON.stringify(embedding),
                        pattern.example
                    ]);
                    
                    createdPatterns++;
                }
            }

            return {
                patternsFound: patterns.length,
                patternsCreated: createdPatterns,
                memoryId,
                projectId
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
            
            // Get high-confidence patterns
            const patternsResult = await this.db.query(`
                SELECT * FROM coding_patterns 
                WHERE confidence_score >= $1 
                  AND frequency_count >= $2
                ORDER BY confidence_score DESC, frequency_count DESC
                LIMIT 50
            `, [this.config.thresholds.patternMinFrequency, this.config.thresholds.patternMinFrequency]);

            const insights = [];
            
            // Analyze patterns for insights
            for (const pattern of patternsResult.rows) {
                if (pattern.frequency_count >= 5 && pattern.projects_seen.length >= 2) {
                    // This is a strong pattern - create best practice insight
                    const insight = await this.createInsightFromPattern(pattern, 'best_practice');
                    if (insight) insights.push(insight);
                }
                
                if (pattern.confidence_score < 0.4 && pattern.frequency_count > 3) {
                    // Low confidence but high frequency - potential antipattern
                    const insight = await this.createInsightFromPattern(pattern, 'antipattern');
                    if (insight) insights.push(insight);
                }
            }

            return {
                insightsGenerated: insights.length,
                totalPatterns: patternsResult.rows.length,
                insights: insights.slice(0, 10) // Return first 10 for summary
            };
        } catch (error) {
            this.logger.error('Insight generation failed:', error);
            throw error;
        }
    }

    /**
     * Analyze technology preferences from memories and decisions
     */
    async analyzePreferences(payload) {
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
            const projectTechMap = {};

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
    async trackEvolution(payload) {
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
     * Helper methods for pattern and technology extraction
     */
    async extractPatterns(memory) {
        // Simplified pattern extraction - in reality, this would use LLM analysis
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
            const scheduledFor = new Date(Date.now() + task.delay);
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
     * Get learning pipeline status
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
                    AVG(confidence_score) as avg_confidence,
                    COUNT(DISTINCT unnest(projects_seen)) as unique_projects
                FROM coding_patterns
            `);

            const insightStats = await this.db.query(`
                SELECT insight_type, COUNT(*) as count
                FROM meta_insights
                GROUP BY insight_type
            `);

            return {
                status: this.isProcessing ? 'processing' : 'idle',
                realTimeEnabled: this.config.realTime.enabled,
                scheduledEnabled: this.config.scheduled.enabled,
                memoryBufferSize: this.memoryBuffer.length,
                queue: queueStats.rows,
                patterns: patternStats.rows[0] || {},
                insights: insightStats.rows,
                lastProcessed: this.lastProcessed
            };
        } catch (error) {
            this.logger.error('Failed to get learning pipeline status:', error);
            return { status: 'error', error: error.message };
        }
    }
}

export default LearningPipeline;