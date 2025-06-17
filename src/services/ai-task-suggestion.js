/**
 * AI Task Suggestion Service for MiniMe-MCP
 * Analyzes projects and suggests tasks based on code patterns, missing components, and best practices
 */

export class AITaskSuggestionService {
    constructor(logger, databaseService, taskExtractor) {
        this.logger = logger;
        this.db = databaseService;
        this.taskExtractor = taskExtractor;
        
        // Task suggestion rules and patterns
        this.suggestionRules = {
            // Code quality improvements
            codeQuality: [
                {
                    trigger: 'missing_tests',
                    priority: { urgency: 'high', impact: 'high', effort: 'medium' },
                    category: 'testing',
                    template: 'Add unit tests for {component}'
                },
                {
                    trigger: 'low_test_coverage',
                    priority: { urgency: 'medium', impact: 'high', effort: 'medium' },
                    category: 'testing',
                    template: 'Increase test coverage from {current}% to 80%'
                },
                {
                    trigger: 'missing_documentation',
                    priority: { urgency: 'medium', impact: 'medium', effort: 'low' },
                    category: 'documentation',
                    template: 'Add documentation for {component}'
                }
            ],
            
            // Security and best practices
            security: [
                {
                    trigger: 'hardcoded_secrets',
                    priority: { urgency: 'critical', impact: 'high', effort: 'low' },
                    category: 'bug',
                    template: 'Remove hardcoded secrets and use environment variables'
                },
                {
                    trigger: 'missing_input_validation',
                    priority: { urgency: 'high', impact: 'high', effort: 'medium' },
                    category: 'feature',
                    template: 'Add input validation for {endpoint}'
                },
                {
                    trigger: 'insecure_dependencies',
                    priority: { urgency: 'high', impact: 'medium', effort: 'low' },
                    category: 'bug',
                    template: 'Update vulnerable dependencies: {packages}'
                }
            ],
            
            // Performance optimizations
            performance: [
                {
                    trigger: 'slow_queries',
                    priority: { urgency: 'medium', impact: 'high', effort: 'medium' },
                    category: 'optimization',
                    template: 'Optimize slow database queries in {module}'
                },
                {
                    trigger: 'large_bundle_size',
                    priority: { urgency: 'medium', impact: 'medium', effort: 'medium' },
                    category: 'optimization',
                    template: 'Reduce bundle size through code splitting and optimization'
                },
                {
                    trigger: 'memory_leaks',
                    priority: { urgency: 'high', impact: 'high', effort: 'high' },
                    category: 'bug',
                    template: 'Fix memory leaks in {component}'
                }
            ],
            
            // Architecture improvements
            architecture: [
                {
                    trigger: 'code_duplication',
                    priority: { urgency: 'medium', impact: 'medium', effort: 'medium' },
                    category: 'refactor',
                    template: 'Extract common code into reusable utilities'
                },
                {
                    trigger: 'tight_coupling',
                    priority: { urgency: 'medium', impact: 'high', effort: 'high' },
                    category: 'refactor',
                    template: 'Decouple {component} from {dependency}'
                },
                {
                    trigger: 'missing_error_handling',
                    priority: { urgency: 'medium', impact: 'high', effort: 'low' },
                    category: 'feature',
                    template: 'Add proper error handling to {component}'
                }
            ]
        };
        
        // Analysis patterns
        this.analysisPatterns = {
            testCoverage: /coverage.*?(\d+)%/i,
            todoComments: /(?:TODO|FIXME|HACK|XXX|NOTE):\s*(.+)/gi,
            securityIssues: /(?:password|secret|key|token)\s*[:=]\s*["']([^"']+)["']/gi,
            errorPatterns: /(?:try|catch|throw|error|exception)/gi,
            performancePatterns: /(?:slow|optimize|performance|bottleneck|cache)/gi
        };
    }

    /**
     * Suggest tasks for a project based on AI analysis
     */
    async suggestTasks(projectName, options = {}) {
        try {
            const analysisDepth = options.analysisDepth || 'standard';
            const maxSuggestions = options.maxSuggestions || 10;
            
            this.logger.info(`Starting AI task suggestion for project: ${projectName}`);
            
            // 1. Analyze current project state
            const projectAnalysis = await this.analyzeProject(projectName, analysisDepth);
            
            // 2. Generate suggestions based on analysis
            const suggestions = await this.generateSuggestions(projectAnalysis, maxSuggestions);
            
            // 3. Prioritize and rank suggestions
            const rankedSuggestions = this.rankSuggestions(suggestions);
            
            this.logger.info(`Generated ${rankedSuggestions.length} task suggestions for ${projectName}`);
            
            return {
                project_name: projectName,
                analysis_summary: projectAnalysis.summary,
                suggestions: rankedSuggestions,
                generated_at: new Date().toISOString()
            };

        } catch (error) {
            this.logger.error('Error generating task suggestions:', error);
            throw error;
        }
    }

    /**
     * Analyze project to identify improvement opportunities
     */
    async analyzeProject(projectName, depth = 'standard') {
        const analysis = {
            project_name: projectName,
            depth: depth,
            findings: {
                codeQuality: [],
                security: [],
                performance: [],
                architecture: [],
                documentation: []
            },
            metrics: {},
            summary: {}
        };

        // Get project data
        const project = await this.getProject(projectName);
        if (!project) {
            throw new Error(`Project "${projectName}" not found`);
        }

        // Analyze based on existing memories
        await this.analyzeFromMemories(project.id, analysis);
        
        // Look for common patterns and anti-patterns
        await this.analyzePatterns(project.id, analysis);
        
        // Check for missing components
        await this.analyzeMissingComponents(project.id, analysis);
        
        // Generate summary
        analysis.summary = this.generateAnalysisSummary(analysis);
        
        return analysis;
    }

    /**
     * Analyze project based on existing memories
     */
    async analyzeFromMemories(projectId, analysis) {
        // Get all memories for the project
        const memories = await this.db.query(
            `SELECT content, memory_type, tags, created_at 
             FROM memories 
             WHERE project_id = $1 
             ORDER BY created_at DESC`,
            [projectId]
        );

        let codeMemories = 0;
        let bugMemories = 0;
        let testMemories = 0;
        let docMemories = 0;

        for (const memory of memories.rows) {
            const content = memory.content.toLowerCase();
            
            // Count memory types
            switch (memory.memory_type) {
                case 'code':
                    codeMemories++;
                    break;
                case 'bug':
                    bugMemories++;
                    break;
                case 'test':
                    testMemories++;
                    break;
                case 'documentation':
                    docMemories++;
                    break;
            }

            // Analyze content for patterns
            this.analyzeMemoryContent(content, memory, analysis);
        }

        // Calculate metrics
        analysis.metrics = {
            total_memories: memories.rows.length,
            code_memories: codeMemories,
            bug_memories: bugMemories,
            test_memories: testMemories,
            doc_memories: docMemories,
            test_to_code_ratio: codeMemories > 0 ? testMemories / codeMemories : 0,
            bug_density: memories.rows.length > 0 ? bugMemories / memories.rows.length : 0
        };

        // Generate findings based on metrics
        if (analysis.metrics.test_to_code_ratio < 0.3) {
            analysis.findings.codeQuality.push({
                type: 'low_test_coverage',
                severity: 'high',
                description: `Low test-to-code ratio: ${(analysis.metrics.test_to_code_ratio * 100).toFixed(1)}%`,
                suggestion: 'Consider adding more unit tests'
            });
        }

        if (analysis.metrics.bug_density > 0.2) {
            analysis.findings.codeQuality.push({
                type: 'high_bug_density',
                severity: 'medium',
                description: `High bug density: ${(analysis.metrics.bug_density * 100).toFixed(1)}%`,
                suggestion: 'Focus on code quality improvements and testing'
            });
        }
    }

    /**
     * Analyze individual memory content for patterns
     */
    analyzeMemoryContent(content, memory, analysis) {
        // Look for TODO comments
        const todoMatches = content.match(this.analysisPatterns.todoComments);
        if (todoMatches && todoMatches.length > 0) {
            analysis.findings.codeQuality.push({
                type: 'todo_comments',
                severity: 'low',
                description: `Found ${todoMatches.length} TODO comments`,
                details: todoMatches.slice(0, 3) // First 3 todos
            });
        }

        // Look for security issues
        const securityMatches = content.match(this.analysisPatterns.securityIssues);
        if (securityMatches && securityMatches.length > 0) {
            analysis.findings.security.push({
                type: 'potential_secrets',
                severity: 'critical',
                description: 'Potential hardcoded secrets found',
                suggestion: 'Move secrets to environment variables'
            });
        }

        // Look for performance mentions
        const performanceMatches = content.match(this.analysisPatterns.performancePatterns);
        if (performanceMatches && performanceMatches.length > 2) {
            analysis.findings.performance.push({
                type: 'performance_concerns',
                severity: 'medium',
                description: 'Multiple performance-related mentions found',
                suggestion: 'Consider performance optimization review'
            });
        }

        // Look for error handling patterns
        const errorMatches = content.match(this.analysisPatterns.errorPatterns);
        if (errorMatches && errorMatches.length < 2 && memory.memory_type === 'code') {
            analysis.findings.architecture.push({
                type: 'limited_error_handling',
                severity: 'medium',
                description: 'Limited error handling patterns detected',
                suggestion: 'Consider adding comprehensive error handling'
            });
        }
    }

    /**
     * Analyze for common patterns and anti-patterns
     */
    async analyzePatterns(projectId, analysis) {
        // Look for coding patterns
        const patterns = await this.db.query(
            `SELECT pattern_type, confidence_score, frequency_count 
             FROM coding_patterns 
             WHERE $1 = ANY(projects_seen)
             ORDER BY confidence_score DESC`,
            [analysis.project_name]
        );

        // Analyze pattern health
        for (const pattern of patterns.rows) {
            if (pattern.confidence_score < 0.5) {
                analysis.findings.codeQuality.push({
                    type: 'inconsistent_patterns',
                    severity: 'medium',
                    description: `Inconsistent ${pattern.pattern_type} patterns detected`,
                    suggestion: 'Consider standardizing code patterns'
                });
            }
        }

        // Look for decision patterns
        const decisions = await this.db.query(
            `SELECT decision_category, success_rate, COUNT(*) as count
             FROM decision_patterns 
             WHERE $1 = ANY(project_contexts)
             GROUP BY decision_category, success_rate
             ORDER BY success_rate ASC`,
            [analysis.project_name]
        );

        // Analyze decision success rates
        for (const decision of decisions.rows) {
            if (decision.success_rate && decision.success_rate < 0.6) {
                analysis.findings.architecture.push({
                    type: 'poor_decision_outcomes',
                    severity: 'high',
                    description: `Low success rate in ${decision.decision_category} decisions`,
                    suggestion: 'Review and improve decision-making process'
                });
            }
        }
    }

    /**
     * Analyze for missing components
     */
    async analyzeMissingComponents(projectId, analysis) {
        // Check for common missing components
        const memoryTypes = await this.db.query(
            `SELECT DISTINCT memory_type, COUNT(*) as count
             FROM memories 
             WHERE project_id = $1 
             GROUP BY memory_type`,
            [projectId]
        );

        const existingTypes = new Set(memoryTypes.rows.map(row => row.memory_type));
        
        // Expected components for a complete project
        const expectedComponents = [
            'project_brief',
            'architecture', 
            'requirements',
            'implementation_notes',
            'lessons_learned'
        ];

        for (const component of expectedComponents) {
            if (!existingTypes.has(component)) {
                analysis.findings.documentation.push({
                    type: 'missing_component',
                    severity: 'medium',
                    description: `Missing ${component} documentation`,
                    suggestion: `Consider adding ${component} documentation`
                });
            }
        }

        // Check for README
        const readmeExists = await this.checkForReadme(projectId);
        if (!readmeExists) {
            analysis.findings.documentation.push({
                type: 'missing_readme',
                severity: 'high',
                description: 'No README documentation found',
                suggestion: 'Create comprehensive README documentation'
            });
        }
    }

    /**
     * Generate task suggestions based on analysis
     */
    async generateSuggestions(analysis, maxSuggestions) {
        const suggestions = [];

        // Process each category of findings
        for (const [category, findings] of Object.entries(analysis.findings)) {
            const rules = this.suggestionRules[category] || [];
            
            for (const finding of findings) {
                const matchingRule = rules.find(rule => rule.trigger === finding.type);
                
                if (matchingRule) {
                    const suggestion = this.createTaskFromRule(matchingRule, finding, analysis);
                    suggestions.push(suggestion);
                }
            }
        }

        // Add general improvement suggestions
        const generalSuggestions = this.generateGeneralSuggestions(analysis);
        suggestions.push(...generalSuggestions);

        // Limit to maxSuggestions
        return suggestions.slice(0, maxSuggestions);
    }

    /**
     * Create a task suggestion from a rule and finding
     */
    createTaskFromRule(rule, finding, analysis) {
        // Replace placeholders in template
        let title = rule.template;
        let description = finding.description;

        // Add context-specific information
        if (finding.details) {
            description += `\nDetails: ${JSON.stringify(finding.details)}`;
        }

        return {
            title,
            description,
            category: rule.category,
            priority: rule.priority,
            tags: ['ai-suggested', finding.type, rule.category],
            source_analysis: {
                finding_type: finding.type,
                severity: finding.severity,
                category: Object.keys(analysis.findings).find(cat => 
                    analysis.findings[cat].includes(finding)
                )
            },
            estimated_hours: this.estimateEffort(rule.priority.effort),
            reasoning: finding.suggestion
        };
    }

    /**
     * Generate general improvement suggestions
     */
    generateGeneralSuggestions(analysis) {
        const suggestions = [];

        // Suggest documentation improvements
        if (analysis.metrics.doc_memories < 3) {
            suggestions.push({
                title: 'Improve project documentation',
                description: 'Add comprehensive documentation including setup, usage, and architecture guides',
                category: 'documentation',
                priority: { urgency: 'medium', impact: 'medium', effort: 'medium' },
                tags: ['ai-suggested', 'documentation', 'general'],
                estimated_hours: 4,
                reasoning: 'Low documentation coverage detected'
            });
        }

        // Suggest testing improvements
        if (analysis.metrics.test_to_code_ratio < 0.5) {
            suggestions.push({
                title: 'Expand test coverage',
                description: 'Add unit tests, integration tests, and end-to-end tests to improve code reliability',
                category: 'testing',
                priority: { urgency: 'high', impact: 'high', effort: 'high' },
                tags: ['ai-suggested', 'testing', 'quality'],
                estimated_hours: 16,
                reasoning: `Test-to-code ratio is ${(analysis.metrics.test_to_code_ratio * 100).toFixed(1)}%`
            });
        }

        // Suggest code review process
        if (analysis.metrics.bug_density > 0.15) {
            suggestions.push({
                title: 'Implement code review process',
                description: 'Establish formal code review process to catch issues before deployment',
                category: 'feature',
                priority: { urgency: 'medium', impact: 'high', effort: 'low' },
                tags: ['ai-suggested', 'process', 'quality'],
                estimated_hours: 2,
                reasoning: `High bug density (${(analysis.metrics.bug_density * 100).toFixed(1)}%) suggests need for better quality control`
            });
        }

        return suggestions;
    }

    /**
     * Rank suggestions by priority and impact
     */
    rankSuggestions(suggestions) {
        return suggestions.sort((a, b) => {
            // Calculate composite priority score
            const scoreA = this.calculatePriorityScore(a.priority);
            const scoreB = this.calculatePriorityScore(b.priority);
            
            if (scoreB !== scoreA) {
                return scoreB - scoreA; // Higher score first
            }
            
            // If same priority, prefer lower effort
            const effortScoreA = this.getEffortScore(a.priority.effort);
            const effortScoreB = this.getEffortScore(b.priority.effort);
            
            return effortScoreB - effortScoreA; // Higher effort score (lower effort) first
        });
    }

    /**
     * HELPER METHODS
     */

    async getProject(projectName) {
        const result = await this.db.query(
            'SELECT id, name, description FROM projects WHERE name = $1',
            [projectName]
        );
        return result.rows[0] || null;
    }

    async checkForReadme(projectId) {
        const result = await this.db.query(
            `SELECT COUNT(*) as count FROM memories 
             WHERE project_id = $1 
             AND (memory_type = 'documentation' OR content ILIKE '%readme%')`,
            [projectId]
        );
        return parseInt(result.rows[0].count) > 0;
    }

    calculatePriorityScore(priority) {
        const urgencyScore = {
            'critical': 1.0, 'high': 0.75, 'medium': 0.5, 'low': 0.25
        };
        const impactScore = {
            'high': 1.0, 'medium': 0.67, 'low': 0.33
        };

        const urgency = urgencyScore[priority.urgency] || 0.5;
        const impact = impactScore[priority.impact] || 0.67;

        return (urgency * 0.6) + (impact * 0.4);
    }

    getEffortScore(effort) {
        const effortScores = {
            'low': 1.0, 'medium': 0.67, 'high': 0.33
        };
        return effortScores[effort] || 0.67;
    }

    estimateEffort(effortLevel) {
        const effortHours = {
            'low': 2,
            'medium': 8,
            'high': 24
        };
        return effortHours[effortLevel] || 8;
    }

    generateAnalysisSummary(analysis) {
        const totalFindings = Object.values(analysis.findings)
            .reduce((sum, findings) => sum + findings.length, 0);

        const criticalFindings = Object.values(analysis.findings)
            .flat()
            .filter(finding => finding.severity === 'critical').length;

        return {
            total_findings: totalFindings,
            critical_findings: criticalFindings,
            categories_analyzed: Object.keys(analysis.findings).length,
            recommendations: totalFindings > 0 ? 'Improvements recommended' : 'Project appears healthy',
            test_coverage_status: analysis.metrics.test_to_code_ratio > 0.7 ? 'Good' : 'Needs improvement',
            documentation_status: analysis.metrics.doc_memories > 3 ? 'Adequate' : 'Sparse'
        };
    }
}