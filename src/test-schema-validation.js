#!/usr/bin/env node

/**
 * Database Schema Validation Test
 * Run this to validate database schema consistency
 */

import { DatabaseSchemaValidator } from './utils/database-schema-validator.js';
import { DatabaseService } from './services/database-service.js';
import winston from 'winston';

// Setup logger
const logger = winston.createLogger({
    level: 'info',
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.printf(({ timestamp, level, message, ...meta }) => {
            return `${timestamp} [${level.toUpperCase()}] ${message} ${Object.keys(meta).length ? JSON.stringify(meta) : ''}`;
        })
    ),
    transports: [
        new winston.transports.Console()
    ]
});

async function runSchemaValidation() {
    let dbService = null;
    
    try {
        logger.info('Starting database schema validation...');

        // Initialize database service
        dbService = new DatabaseService(logger);
        await dbService.initialize();

        // Create validator
        const validator = new DatabaseSchemaValidator(dbService.getPool(), logger);

        // Run quick validation first
        logger.info('Running quick validation...');
        const quickResult = await validator.quickValidation();
        
        console.log('\n=== QUICK VALIDATION RESULTS ===');
        console.log(`Status: ${quickResult.status}`);
        
        if (quickResult.issues.length > 0) {
            console.log('\nIssues found:');
            quickResult.issues.forEach(issue => console.log(`  ❌ ${issue}`));
        } else {
            console.log('  ✅ No critical issues detected');
        }

        // Run comprehensive validation
        logger.info('Running comprehensive validation...');
        const fullResult = await validator.validateSchema();

        console.log('\n=== COMPREHENSIVE VALIDATION RESULTS ===');
        console.log(`Status: ${fullResult.status}`);
        console.log(`Timestamp: ${fullResult.timestamp}`);
        console.log(`Errors: ${fullResult.summary.total_errors}`);
        console.log(`Warnings: ${fullResult.summary.total_warnings}`);
        console.log(`Critical Issues: ${fullResult.summary.critical_issues}`);

        if (fullResult.errors.length > 0) {
            console.log('\n=== ERRORS ===');
            fullResult.errors.forEach(error => console.log(`  ❌ ${error}`));
        }

        if (fullResult.warnings.length > 0) {
            console.log('\n=== WARNINGS ===');
            fullResult.warnings.forEach(warning => console.log(`  ⚠️  ${warning}`));
        }

        if (fullResult.recommendations.length > 0) {
            console.log('\n=== RECOMMENDATIONS ===');
            fullResult.recommendations.forEach(rec => {
                console.log(`  🔧 [${rec.priority}] ${rec.action}`);
                console.log(`     Command: ${rec.command}`);
            });
        }

        // Summary
        console.log('\n=== SUMMARY ===');
        if (fullResult.status === 'PASS') {
            console.log('  ✅ Database schema is consistent and healthy');
        } else {
            console.log('  ❌ Database schema has issues that need attention');
            console.log(`     ${fullResult.summary.critical_issues} critical issues require immediate action`);
        }

        // Save detailed report
        const reportPath = `schema-validation-report-${Date.now()}.json`;
        const fs = await import('fs');
        fs.writeFileSync(reportPath, JSON.stringify(fullResult, null, 2));
        console.log(`\nDetailed report saved to: ${reportPath}`);

        process.exit(fullResult.status === 'PASS' ? 0 : 1);

    } catch (error) {
        logger.error('Schema validation failed:', error);
        console.error('\n❌ Schema validation failed:', error.message);
        process.exit(1);
    } finally {
        if (dbService) {
            await dbService.close();
        }
    }
}

// Handle script execution
if (process.argv[1].includes('test-schema-validation.js')) {
    runSchemaValidation();
}

export { runSchemaValidation }; 