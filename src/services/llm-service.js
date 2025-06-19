/**
 * LLM Service for MiniMe-MCP
 * Handles large language model interactions for intelligent analysis, reasoning, and insight generation
 * Primary model: qwen3:8b via Ollama
 */

import fetch from 'node-fetch';
import crypto from 'crypto';

export class LLMService {
    constructor(logger, databaseService) {
        this.logger = logger;
        this.db = databaseService;
        this.cache = new Map(); // Simple in-memory cache for analysis results
        this.maxCacheSize = 500; // Smaller cache for LLM responses
        
        // Default configuration
        this.config = {
            ollama: {
                host: process.env.OLLAMA_HOST || 'http://127.0.0.1:11434',
                timeout: 120000, // 2 minutes for LLM responses
                retries: 2
            },
            defaultModel: 'qwen3:8b',
            maxTokens: 4000,
            temperature: 0.1, // Low temperature for analytical consistency
            systemPrompts: {
                patternAnalysis: `You are an expert code analyst. Analyze the given code patterns and provide insights on their quality, effectiveness, and potential improvements. Be specific and actionable.`,
                insightGeneration: `You are a senior software architect. Generate insights from development patterns and decisions. Focus on best practices, anti-patterns, and actionable recommendations.`,
                outcomeCorrelation: `You are a data analyst specializing in software development metrics. Analyze the correlation between coding patterns and their outcomes. Provide statistical insights and causal relationships.`
            }
        };
    }

    /**
     * Generate analysis using LLM for various tasks
     */
    async generateAnalysis(prompt, context = {}, analysisType = 'general') {
        try {
            const modelName = context.model || this.config.defaultModel;
            
            // Check cache first
            const cacheKey = this.getCacheKey(prompt, modelName, analysisType);
            if (this.cache.has(cacheKey)) {
                this.logger.debug(`LLM cache hit for ${analysisType}`);
                return this.cache.get(cacheKey);
            }

            // Verify model availability
            await this.ensureModelAvailable(modelName);

            // Build system prompt based on analysis type
            const systemPrompt = this.config.systemPrompts[analysisType] || this.config.systemPrompts.patternAnalysis;
            
            // Generate the analysis
            const response = await this.generateOllamaResponse(prompt, {
                model: modelName,
                systemPrompt,
                temperature: context.temperature || this.config.temperature,
                maxTokens: context.maxTokens || this.config.maxTokens
            });

            // Cache the result
            this.cacheResponse(cacheKey, response);

            // Store in database cache if significant
            if (response.content && response.content.length > 100) {
                await this.storeAnalysisCache(prompt, response, analysisType, modelName);
            }

            this.logger.debug(`Generated ${analysisType} analysis using ${modelName}`);
            return response;

        } catch (error) {
            this.logger.error('LLM analysis generation failed:', error);
            throw error;
        }
    }

    /**
     * Analyze coding patterns using LLM
     */
    async analyzeCodePattern(pattern, context = {}) {
        const prompt = this.buildPatternAnalysisPrompt(pattern, context);
        
        return await this.generateAnalysis(prompt, {
            model: context.model,
            temperature: 0.1 // Low temp for consistent analysis
        }, 'patternAnalysis');
    }

    /**
     * Generate insights from development data
     */
    async generateInsights(data, context = {}) {
        const prompt = this.buildInsightGenerationPrompt(data, context);
        
        return await this.generateAnalysis(prompt, {
            model: context.model,
            temperature: 0.2 // Slightly higher for creative insights
        }, 'insightGeneration');
    }

    /**
     * Analyze outcome correlations
     */
    async analyzeOutcomeCorrelations(patterns, outcomes, context = {}) {
        const prompt = this.buildCorrelationAnalysisPrompt(patterns, outcomes, context);
        
        return await this.generateAnalysis(prompt, {
            model: context.model,
            temperature: 0.1 // Low temp for statistical accuracy
        }, 'outcomeCorrelation');
    }

    /**
     * Generate response using Ollama
     */
    async generateOllamaResponse(prompt, options = {}) {
        const url = `${this.config.ollama.host}/api/generate`;
        
        const requestBody = {
            model: options.model || this.config.defaultModel,
            prompt: this.buildFullPrompt(prompt, options.systemPrompt),
            stream: false,
            options: {
                temperature: options.temperature || this.config.temperature,
                num_predict: options.maxTokens || this.config.maxTokens,
                top_p: 0.9,
                top_k: 40
            }
        };

        // Create AbortController for timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.config.ollama.timeout);

        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(requestBody),
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
                throw new Error(`Ollama API error: ${response.status} ${response.statusText}`);
            }

            const data = await response.json();
            
            if (!data.response) {
                throw new Error('Invalid response from Ollama API');
            }

            return {
                content: data.response.trim(),
                model: options.model || this.config.defaultModel,
                tokens: data.eval_count || 0,
                totalDuration: data.total_duration || 0,
                confidence: this.estimateConfidence(data.response),
                metadata: {
                    eval_count: data.eval_count,
                    eval_duration: data.eval_duration,
                    total_duration: data.total_duration
                }
            };

        } catch (error) {
            clearTimeout(timeoutId);
            if (error.name === 'AbortError') {
                throw new Error(`LLM request timeout after ${this.config.ollama.timeout}ms`);
            }
            throw error;
        }
    }

    /**
     * Build pattern analysis prompt
     */
    buildPatternAnalysisPrompt(pattern, context) {
        return `
Analyze the following coding pattern:

**Pattern Information:**
- Type: ${pattern.pattern_type}
- Name: ${pattern.pattern_name || 'Unnamed'}
- Languages: ${pattern.languages?.join(', ') || 'Unknown'}
- Frequency: ${pattern.frequency_count} occurrences across ${pattern.projects_seen?.length || 0} projects
- Current Confidence: ${pattern.confidence_score}

**Pattern Description:**
${pattern.pattern_description || 'No description available'}

**Example Code:**
\`\`\`
${pattern.example_code || 'No example available'}
\`\`\`

**Context:**
${context.additionalContext || 'General analysis requested'}

Please provide:
1. **Quality Assessment**: Rate the pattern's quality and explain why
2. **Effectiveness Analysis**: How effective is this pattern for its intended purpose?
3. **Best Practices**: Does this follow coding best practices?
4. **Improvements**: Specific suggestions for improvement
5. **Risks**: Potential issues or anti-patterns to watch for
6. **Confidence Score**: Your confidence in this analysis (0.0-1.0)

Format your response as structured analysis with clear sections.
        `.trim();
    }

    /**
     * Build insight generation prompt
     */
    buildInsightGenerationPrompt(data, context) {
        const dataDescription = typeof data === 'string' ? data : JSON.stringify(data, null, 2);
        
        return `
Generate actionable insights from the following development data:

**Data Overview:**
${dataDescription}

**Analysis Context:**
- Time Period: ${context.timePeriod || 'Not specified'}
- Projects: ${context.projects || 'Multiple projects'}
- Focus Area: ${context.focusArea || 'General development patterns'}

Please provide:
1. **Key Findings**: Most important discoveries from the data
2. **Trends**: Patterns and trends observed
3. **Best Practices**: Validated practices that work well
4. **Anti-Patterns**: Practices to avoid based on evidence
5. **Recommendations**: Specific actionable recommendations
6. **Impact Assessment**: Potential impact of following these insights
7. **Confidence Level**: Your confidence in these insights (0.0-1.0)

Focus on practical, actionable insights that can improve development practices.
        `.trim();
    }

    /**
     * Build correlation analysis prompt
     */
    buildCorrelationAnalysisPrompt(patterns, outcomes, context) {
        return `
Analyze the correlation between coding patterns and their outcomes:

**Patterns Data:**
${JSON.stringify(patterns, null, 2)}

**Outcomes Data:**
${JSON.stringify(outcomes, null, 2)}

**Analysis Context:**
${JSON.stringify(context, null, 2)}

Please provide:
1. **Correlation Strength**: How strongly are patterns correlated with outcomes?
2. **Causal Relationships**: Which patterns likely cause specific outcomes?
3. **Success Patterns**: Patterns most associated with positive outcomes
4. **Risk Patterns**: Patterns associated with negative outcomes
5. **Statistical Insights**: Statistical observations about the correlations
6. **Predictive Value**: How well can patterns predict outcomes?
7. **Confidence Assessment**: Your confidence in this correlation analysis (0.0-1.0)

Be specific about correlation strength and provide evidence for your conclusions.
        `.trim();
    }

    /**
     * Build full prompt with system context
     */
    buildFullPrompt(userPrompt, systemPrompt) {
        if (!systemPrompt) {
            return userPrompt;
        }
        
        return `${systemPrompt}

${userPrompt}`;
    }

    /**
     * Estimate confidence based on response characteristics
     */
    estimateConfidence(response) {
        let confidence = 0.5; // Base confidence
        
        // Length indicators
        if (response.length > 500) confidence += 0.1;
        if (response.length > 1000) confidence += 0.1;
        
        // Structure indicators
        if (response.includes('1.') || response.includes('##')) confidence += 0.1;
        if (response.includes('confidence') || response.includes('score')) confidence += 0.1;
        
        // Uncertainty indicators
        if (response.includes('might') || response.includes('possibly')) confidence -= 0.1;
        if (response.includes('unclear') || response.includes('unknown')) confidence -= 0.1;
        
        return Math.max(0.0, Math.min(1.0, confidence));
    }

    /**
     * Ensure model is available
     */
    async ensureModelAvailable(modelName) {
        try {
            const url = `${this.config.ollama.host}/api/tags`;
            const response = await fetch(url);
            
            if (!response.ok) {
                throw new Error(`Failed to check model availability: ${response.statusText}`);
            }
            
            const data = await response.json();
            const availableModels = data.models?.map(m => m.name) || [];
            
            if (!availableModels.includes(modelName)) {
                this.logger.warn(`Model ${modelName} not found, attempting to pull...`);
                await this.pullModel(modelName);
            }
            
        } catch (error) {
            this.logger.error(`Failed to verify model availability: ${error.message}`);
            throw error;
        }
    }

    /**
     * Pull model from Ollama if not available
     */
    async pullModel(modelName) {
        try {
            const url = `${this.config.ollama.host}/api/pull`;
            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: modelName })
            });

            if (!response.ok) {
                throw new Error(`Failed to pull model: ${response.statusText}`);
            }

            this.logger.info(`Successfully pulled model: ${modelName}`);
            
        } catch (error) {
            this.logger.error(`Failed to pull model ${modelName}: ${error.message}`);
            throw error;
        }
    }

    /**
     * Store analysis in database cache
     */
    async storeAnalysisCache(prompt, response, analysisType, modelName) {
        try {
            const contentHash = crypto.createHash('sha256').update(prompt).digest('hex');
            
            await this.db.query(`
                INSERT INTO llm_analysis_cache (
                    content_hash, analysis_type, model_used, input_data, 
                    analysis_result, confidence_score, created_at, expires_at
                ) VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW() + INTERVAL '30 days')
                ON CONFLICT (content_hash) DO UPDATE SET
                    analysis_result = EXCLUDED.analysis_result,
                    confidence_score = EXCLUDED.confidence_score,
                    created_at = NOW()
            `, [
                contentHash,
                analysisType,
                modelName,
                JSON.stringify({ prompt }),
                JSON.stringify(response),
                response.confidence || 0.5
            ]);
            
        } catch (error) {
            this.logger.error('Failed to store analysis cache:', error);
            // Don't throw - caching failure shouldn't break the analysis
        }
    }

    /**
     * Get cached analysis from database
     */
    async getCachedAnalysis(prompt, analysisType, modelName) {
        try {
            const contentHash = crypto.createHash('sha256').update(prompt).digest('hex');
            
            const result = await this.db.query(`
                SELECT analysis_result, confidence_score, created_at
                FROM llm_analysis_cache
                WHERE content_hash = $1 
                  AND analysis_type = $2 
                  AND model_used = $3
                  AND expires_at > NOW()
                ORDER BY created_at DESC
                LIMIT 1
            `, [contentHash, analysisType, modelName]);
            
            if (result.rows.length > 0) {
                return JSON.parse(result.rows[0].analysis_result);
            }
            
            return null;
            
        } catch (error) {
            this.logger.error('Failed to get cached analysis:', error);
            return null;
        }
    }

    /**
     * Generate cache key
     */
    getCacheKey(prompt, model, analysisType) {
        const content = `${prompt}:${model}:${analysisType}`;
        return crypto.createHash('md5').update(content).digest('hex');
    }

    /**
     * Cache response in memory
     */
    cacheResponse(key, response) {
        if (this.cache.size >= this.maxCacheSize) {
            // Remove oldest entry
            const firstKey = this.cache.keys().next().value;
            this.cache.delete(firstKey);
        }
        this.cache.set(key, response);
    }

    /**
     * Health check for LLM service
     */
    async healthCheck() {
        try {
            const response = await fetch(`${this.config.ollama.host}/api/version`);
            
            if (!response.ok) {
                return { healthy: false, error: `Ollama not available: ${response.statusText}` };
            }
            
            const data = await response.json();
            
            // Test with default model
            try {
                await this.ensureModelAvailable(this.config.defaultModel);
                return { 
                    healthy: true, 
                    ollamaVersion: data.version,
                    defaultModel: this.config.defaultModel,
                    cacheSize: this.cache.size
                };
            } catch (modelError) {
                return { 
                    healthy: false, 
                    error: `Default model not available: ${modelError.message}`,
                    ollamaVersion: data.version
                };
            }
            
        } catch (error) {
            return { healthy: false, error: error.message };
        }
    }

    /**
     * Get service statistics
     */
    getStats() {
        return {
            cacheSize: this.cache.size,
            maxCacheSize: this.maxCacheSize,
            defaultModel: this.config.defaultModel,
            timeout: this.config.ollama.timeout,
            availableAnalysisTypes: Object.keys(this.config.systemPrompts)
        };
    }
}

export default LLMService;