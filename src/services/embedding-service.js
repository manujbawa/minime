/**
 * Embedding Service for MiniMe-MCP
 * Handles vector embedding generation using various providers (Ollama, OpenAI, etc.)
 */

import fetch from 'node-fetch';
import crypto from 'crypto';

export class EmbeddingService {
    constructor(logger, databaseService) {
        this.logger = logger;
        this.db = databaseService;
        this.cache = new Map(); // Simple in-memory cache
        this.maxCacheSize = 1000;
        
        // Default configuration
        this.config = {
            ollama: {
                host: process.env.OLLAMA_HOST || 'http://127.0.0.1:11434',
                timeout: 30000,
                retries: 3
            },
            openai: {
                apiKey: process.env.OPENAI_API_KEY,
                baseUrl: 'https://api.openai.com/v1',
                timeout: 30000
            }
        };
    }

    /**
     * Generate embedding for given text using specified model
     */
    async generateEmbedding(text, modelName = null) {
        try {
            // Get default model if not specified
            if (!modelName) {
                modelName = await this.getDefaultModel();
            }

            // Check cache first
            const cacheKey = this.getCacheKey(text, modelName);
            if (this.cache.has(cacheKey)) {
                this.logger.debug(`Cache hit for embedding: ${modelName}`);
                return this.cache.get(cacheKey);
            }

            // Get model configuration
            const modelConfig = await this.getModelConfig(modelName);
            if (!modelConfig) {
                throw new Error(`Embedding model not found: ${modelName}`);
            }

            if (!modelConfig.is_available) {
                throw new Error(`Embedding model not available: ${modelName}`);
            }

            let embedding;
            
            // Generate embedding based on provider
            switch (modelConfig.provider) {
                case 'ollama':
                    embedding = await this.generateOllamaEmbedding(text, modelName);
                    break;
                case 'openai':
                    embedding = await this.generateOpenAIEmbedding(text, modelName);
                    break;
                default:
                    throw new Error(`Unsupported embedding provider: ${modelConfig.provider}`);
            }

            // Validate embedding
            if (!Array.isArray(embedding) || embedding.length !== modelConfig.dimensions) {
                throw new Error(`Invalid embedding dimensions: expected ${modelConfig.dimensions}, got ${embedding.length}`);
            }

            // Cache the result
            this.cacheEmbedding(cacheKey, embedding);

            this.logger.debug(`Generated ${modelConfig.dimensions}D embedding using ${modelName}`);
            return embedding;

        } catch (error) {
            this.logger.error('Embedding generation failed:', error);
            throw error;
        }
    }

    /**
     * Generate embedding using Ollama
     */
    async generateOllamaEmbedding(text, modelName) {
        const url = `${this.config.ollama.host}/api/embeddings`;
        
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: modelName,
                prompt: text
            }),
            timeout: this.config.ollama.timeout
        });

        if (!response.ok) {
            throw new Error(`Ollama API error: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        
        if (!data.embedding) {
            throw new Error('No embedding returned from Ollama');
        }

        return data.embedding;
    }

    /**
     * Generate embedding using OpenAI
     */
    async generateOpenAIEmbedding(text, modelName) {
        if (!this.config.openai.apiKey) {
            throw new Error('OpenAI API key not configured');
        }

        const url = `${this.config.openai.baseUrl}/embeddings`;
        
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${this.config.openai.apiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: modelName,
                input: text
            }),
            timeout: this.config.openai.timeout
        });

        if (!response.ok) {
            throw new Error(`OpenAI API error: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        
        if (!data.data || !data.data[0] || !data.data[0].embedding) {
            throw new Error('No embedding returned from OpenAI');
        }

        return data.data[0].embedding;
    }

    /**
     * Get available embedding models
     */
    async getAvailableModels() {
        try {
            const result = await this.db.query(`
                SELECT model_name, dimensions, provider, description, model_size_mb, is_default
                FROM embedding_models 
                WHERE is_available = true 
                ORDER BY is_default DESC, model_size_mb ASC
            `);
            
            return result.rows;
        } catch (error) {
            this.logger.error('Failed to get available models:', error);
            return [];
        }
    }

    /**
     * Get default embedding model
     */
    async getDefaultModel() {
        try {
            const result = await this.db.query(`
                SELECT model_name 
                FROM embedding_models 
                WHERE is_default = true AND is_available = true 
                LIMIT 1
            `);
            
            if (result.rows.length === 0) {
                // Fallback to first available model
                const fallback = await this.db.query(`
                    SELECT model_name 
                    FROM embedding_models 
                    WHERE is_available = true 
                    ORDER BY model_size_mb ASC 
                    LIMIT 1
                `);
                
                if (fallback.rows.length === 0) {
                    throw new Error('No embedding models available');
                }
                
                return fallback.rows[0].model_name;
            }
            
            return result.rows[0].model_name;
        } catch (error) {
            this.logger.error('Failed to get default model:', error);
            throw error;
        }
    }

    /**
     * Get model configuration
     */
    async getModelConfig(modelName) {
        try {
            const result = await this.db.query(`
                SELECT * FROM embedding_models WHERE model_name = $1
            `, [modelName]);
            
            return result.rows.length > 0 ? result.rows[0] : null;
        } catch (error) {
            this.logger.error('Failed to get model config:', error);
            return null;
        }
    }

    /**
     * Update model availability status
     */
    async updateModelAvailability(modelName, isAvailable) {
        try {
            await this.db.query(`
                UPDATE embedding_models 
                SET is_available = $2, updated_at = NOW() 
                WHERE model_name = $1
            `, [modelName, isAvailable]);
            
            this.logger.info(`Updated model availability: ${modelName} = ${isAvailable}`);
        } catch (error) {
            this.logger.error('Failed to update model availability:', error);
        }
    }

    /**
     * Test embedding model
     */
    async testModel(modelName) {
        try {
            const testText = "This is a test embedding to verify the model is working correctly.";
            const embedding = await this.generateEmbedding(testText, modelName);
            
            this.logger.info(`Model test successful: ${modelName} (${embedding.length} dimensions)`);
            return true;
        } catch (error) {
            this.logger.error(`Model test failed for ${modelName}:`, error);
            return false;
        }
    }

    /**
     * Health check for embedding service
     */
    async healthCheck() {
        try {
            const models = await this.getAvailableModels();
            const defaultModel = models.find(m => m.is_default);
            
            if (!defaultModel) {
                return {
                    status: 'degraded',
                    message: 'No default embedding model available',
                    availableModels: models.length
                };
            }

            // Test default model
            const testResult = await this.testModel(defaultModel.model_name);
            
            return {
                status: testResult ? 'healthy' : 'degraded',
                defaultModel: defaultModel.model_name,
                availableModels: models.length,
                cacheSize: this.cache.size
            };
        } catch (error) {
            return {
                status: 'error',
                message: error.message,
                availableModels: 0
            };
        }
    }

    /**
     * Calculate similarity between two embeddings
     */
    cosineSimilarity(embeddingA, embeddingB) {
        if (embeddingA.length !== embeddingB.length) {
            throw new Error('Embeddings must have the same dimensions');
        }

        let dotProduct = 0;
        let normA = 0;
        let normB = 0;

        for (let i = 0; i < embeddingA.length; i++) {
            dotProduct += embeddingA[i] * embeddingB[i];
            normA += embeddingA[i] * embeddingA[i];
            normB += embeddingB[i] * embeddingB[i];
        }

        return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
    }

    /**
     * Helper methods
     */
    getCacheKey(text, modelName) {
        return crypto.createHash('sha256')
            .update(`${modelName}:${text}`)
            .digest('hex');
    }

    cacheEmbedding(key, embedding) {
        // Simple LRU cache implementation
        if (this.cache.size >= this.maxCacheSize) {
            const firstKey = this.cache.keys().next().value;
            this.cache.delete(firstKey);
        }
        
        this.cache.set(key, embedding);
    }

    /**
     * Clear embedding cache
     */
    clearCache() {
        this.cache.clear();
        this.logger.info('Embedding cache cleared');
    }
}

export default EmbeddingService;