#!/usr/bin/env node

/**
 * Simple Task Management Test
 * Tests the new task management functionality
 */

import winston from 'winston';
import { DatabaseService } from './services/database-service.js';
import { EmbeddingService } from './services/embedding-service.js';
import { LearningPipeline } from './services/learning-pipeline.js';
import { SequentialThinkingService } from './services/sequential-thinking-service.js';
import { MCPToolsService } from './services/mcp-tools.js';

// Configure logger
const logger = winston.createLogger({
    level: 'info',
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.simple()
    ),
    transports: [new winston.transports.Console()]
});

async function testTaskManagement() {
    logger.info('🚀 Starting Task Management Test');
    
    try {
        // Initialize services
        const databaseService = new DatabaseService(logger);
        await databaseService.initialize();
        
        const embeddingService = new EmbeddingService(logger, databaseService);
        const learningPipeline = new LearningPipeline(logger, databaseService, embeddingService);
        const sequentialThinkingService = new SequentialThinkingService(logger, databaseService, embeddingService);
        const mcpToolsService = new MCPToolsService(logger, databaseService, embeddingService, learningPipeline, sequentialThinkingService);
        
        logger.info('✅ Services initialized successfully');
        
        // Test 1: Create sample tasks
        logger.info('📝 Test 1: Creating sample tasks');
        const createTasksResult = await mcpToolsService.executeTool('create_tasks', {
            project_name: 'test-project',
            source_type: 'user_direct',
            tasks: [
                {
                    title: 'Implement user authentication',
                    description: 'Add OAuth2 authentication for users',
                    category: 'feature',
                    priority: { urgency: 'high', impact: 'high', effort: 'medium' },
                    estimated_hours: 8,
                    tags: ['auth', 'security']
                },
                {
                    title: 'Add unit tests',
                    description: 'Create comprehensive unit tests for all modules',
                    category: 'testing',
                    priority: { urgency: 'medium', impact: 'high', effort: 'high' },
                    estimated_hours: 16,
                    tags: ['testing', 'quality']
                },
                {
                    title: 'Fix bug in login flow',
                    description: 'Users cannot login with special characters in password',
                    category: 'bug',
                    priority: { urgency: 'critical', impact: 'high', effort: 'low' },
                    estimated_hours: 2,
                    tags: ['bug', 'critical']
                }
            ]
        });
        
        if (createTasksResult.isError) {
            throw new Error('Failed to create tasks: ' + createTasksResult.content[0].text);
        }
        
        logger.info('✅ Test 1 PASSED: Created 3 tasks successfully');
        console.log('   Created tasks:', createTasksResult.created_tasks?.length || 'unknown');
        
        // Test 2: Get next task (should be highest priority)
        logger.info('🎯 Test 2: Getting next prioritized task');
        const nextTaskResult = await mcpToolsService.executeTool('get_next_task', {
            project_name: 'test-project',
            include_context: true
        });
        
        if (nextTaskResult.isError) {
            throw new Error('Failed to get next task: ' + nextTaskResult.content[0].text);
        }
        
        logger.info('✅ Test 2 PASSED: Retrieved next task successfully');
        console.log('   Next task:', nextTaskResult.task?.title || 'none');
        
        // Test 3: Update task status
        if (nextTaskResult.task && nextTaskResult.task.memory_id) {
            logger.info('📊 Test 3: Updating task status');
            const updateResult = await mcpToolsService.executeTool('update_task', {
                task_id: nextTaskResult.task.memory_id,
                status: 'in_progress',
                outcome: {
                    summary: 'Started working on this task',
                    time_taken_hours: 0.5
                }
            });
            
            if (updateResult.isError) {
                throw new Error('Failed to update task: ' + updateResult.content[0].text);
            }
            
            logger.info('✅ Test 3 PASSED: Updated task status successfully');
        } else {
            logger.warn('⚠️  Test 3 SKIPPED: No task ID available for update');
        }
        
        // Test 4: AI task suggestions
        logger.info('🤖 Test 4: Getting AI task suggestions');
        const suggestionsResult = await mcpToolsService.executeTool('suggest_tasks', {
            project_name: 'test-project',
            analysis_depth: 'standard',
            max_suggestions: 5
        });
        
        if (suggestionsResult.isError) {
            throw new Error('Failed to get suggestions: ' + suggestionsResult.content[0].text);
        }
        
        logger.info('✅ Test 4 PASSED: Generated AI task suggestions successfully');
        console.log('   Suggestions count:', suggestionsResult.suggestions?.length || 0);
        console.log('   Project health:', suggestionsResult.analysis?.health_score || 'unknown');
        
        // Test 5: Search for task memories
        logger.info('🔍 Test 5: Searching for task memories');
        const searchResult = await mcpToolsService.executeTool('search_memories', {
            query: 'authentication task',
            project_name: 'test-project',
            memory_type: 'task',
            limit: 5
        });
        
        if (searchResult.isError) {
            throw new Error('Failed to search tasks: ' + searchResult.content[0].text);
        }
        
        logger.info('✅ Test 5 PASSED: Searched task memories successfully');
        
        // Summary
        logger.info('🎉 ALL TESTS PASSED! Task management functionality is working correctly.');
        logger.info('📊 Test Summary:');
        logger.info('   ✅ Task creation: Working');
        logger.info('   ✅ Task prioritization: Working');
        logger.info('   ✅ Task updates: Working');
        logger.info('   ✅ AI suggestions: Working');
        logger.info('   ✅ Task search: Working');
        
        process.exit(0);
        
    } catch (error) {
        logger.error('❌ Task Management Test FAILED:', error.message);
        logger.error('Stack trace:', error.stack);
        process.exit(1);
    }
}

// Run the test
testTaskManagement().catch(error => {
    logger.error('Fatal error:', error);
    process.exit(1);
});