/**
 * MCP Prompts Service for MiniMe-MCP
 * Provides reusable prompt templates for common development workflows
 * Supports dynamic arguments and context injection
 */

export class MCPPromptsService {
    constructor(logger, databaseService) {
        this.logger = logger;
        this.db = databaseService;
        
        // Define built-in prompts
        this.prompts = new Map();
        this.initializePrompts();
    }

    /**
     * Initialize built-in prompt templates
     */
    initializePrompts() {
        // Code Review Prompt
        this.prompts.set('code-review', {
            name: 'code-review',
            description: 'Generate a comprehensive code review for a file or code snippet',
            arguments: [
                {
                    name: 'code',
                    description: 'The code to review',
                    required: true
                },
                {
                    name: 'language',
                    description: 'Programming language (auto-detected if not provided)',
                    required: false
                },
                {
                    name: 'focus',
                    description: 'Specific areas to focus on (security, performance, style, etc.)',
                    required: false
                }
            ]
        });

        // Bug Investigation Prompt
        this.prompts.set('debug-analysis', {
            name: 'debug-analysis',
            description: 'Analyze code and logs to identify potential bugs and solutions',
            arguments: [
                {
                    name: 'error_message',
                    description: 'The error message or symptom description',
                    required: true
                },
                {
                    name: 'code_context',
                    description: 'Relevant code where the error occurs',
                    required: false
                },
                {
                    name: 'logs',
                    description: 'Application logs or stack traces',
                    required: false
                }
            ]
        });

        // Architecture Planning Prompt
        this.prompts.set('architecture-plan', {
            name: 'architecture-plan',
            description: 'Design system architecture based on requirements',
            arguments: [
                {
                    name: 'requirements',
                    description: 'Project requirements and constraints',
                    required: true
                },
                {
                    name: 'scale',
                    description: 'Expected scale (users, data volume, etc.)',
                    required: false
                },
                {
                    name: 'technology_preferences',
                    description: 'Preferred technologies or constraints',
                    required: false
                }
            ]
        });

        // Code Documentation Prompt
        this.prompts.set('generate-docs', {
            name: 'generate-docs',
            description: 'Generate comprehensive documentation for code',
            arguments: [
                {
                    name: 'code',
                    description: 'Code to document',
                    required: true
                },
                {
                    name: 'format',
                    description: 'Documentation format (markdown, jsdoc, etc.)',
                    required: false
                },
                {
                    name: 'audience',
                    description: 'Target audience (developers, users, etc.)',
                    required: false
                }
            ]
        });

        // Test Generation Prompt
        this.prompts.set('generate-tests', {
            name: 'generate-tests',
            description: 'Generate unit tests for code functions or classes',
            arguments: [
                {
                    name: 'code',
                    description: 'Code to test',
                    required: true
                },
                {
                    name: 'test_framework',
                    description: 'Testing framework (jest, pytest, etc.)',
                    required: false
                },
                {
                    name: 'coverage_type',
                    description: 'Type of tests (unit, integration, edge-cases)',
                    required: false
                }
            ]
        });

        // Git Commit Message Prompt
        this.prompts.set('commit-message', {
            name: 'commit-message',
            description: 'Generate conventional commit messages from code changes',
            arguments: [
                {
                    name: 'diff',
                    description: 'Git diff or description of changes',
                    required: true
                },
                {
                    name: 'type',
                    description: 'Change type (feat, fix, docs, refactor, etc.)',
                    required: false
                }
            ]
        });

        // Performance Optimization Prompt
        this.prompts.set('optimize-performance', {
            name: 'optimize-performance',
            description: 'Analyze code for performance improvements',
            arguments: [
                {
                    name: 'code',
                    description: 'Code to optimize',
                    required: true
                },
                {
                    name: 'performance_metrics',
                    description: 'Current performance issues or metrics',
                    required: false
                },
                {
                    name: 'constraints',
                    description: 'Optimization constraints (memory, CPU, compatibility)',
                    required: false
                }
            ]
        });

        // API Design Prompt
        this.prompts.set('api-design', {
            name: 'api-design',
            description: 'Design REST or GraphQL APIs based on requirements',
            arguments: [
                {
                    name: 'requirements',
                    description: 'API requirements and use cases',
                    required: true
                },
                {
                    name: 'api_type',
                    description: 'API type (REST, GraphQL, gRPC)',
                    required: false
                },
                {
                    name: 'data_model',
                    description: 'Data model or database schema',
                    required: false
                }
            ]
        });

        // Security Review Prompt
        this.prompts.set('security-review', {
            name: 'security-review',
            description: 'Analyze code for security vulnerabilities',
            arguments: [
                {
                    name: 'code',
                    description: 'Code to review for security issues',
                    required: true
                },
                {
                    name: 'security_level',
                    description: 'Security level required (basic, enterprise, high-security)',
                    required: false
                }
            ]
        });

        // Learning Path Prompt
        this.prompts.set('learning-path', {
            name: 'learning-path',
            description: 'Create personalized learning recommendations based on project history',
            arguments: [
                {
                    name: 'project_name',
                    description: 'Project to analyze for learning opportunities',
                    required: false
                },
                {
                    name: 'skill_focus',
                    description: 'Specific skills to focus on',
                    required: false
                }
            ]
        });

        this.logger.info(`Initialized ${this.prompts.size} built-in prompts`);
    }

    /**
     * List all available prompts
     */
    async listPrompts() {
        const promptList = [];
        
        for (const [name, prompt] of this.prompts) {
            promptList.push({
                name: prompt.name,
                description: prompt.description,
                arguments: prompt.arguments || []
            });
        }
        
        return promptList;
    }

    /**
     * Get a specific prompt with its template
     */
    async getPrompt(name, args = {}) {
        const prompt = this.prompts.get(name);
        if (!prompt) {
            throw new Error(`Prompt not found: ${name}`);
        }

        this.logger.info(`Generating prompt: ${name}`, { args: Object.keys(args) });

        // Generate the actual prompt messages based on the template
        const messages = await this.generatePromptMessages(prompt, args);
        
        return {
            description: prompt.description,
            messages: messages
        };
    }

    /**
     * Generate prompt messages based on template and arguments
     */
    async generatePromptMessages(prompt, args) {
        const messages = [];
        
        switch (prompt.name) {
            case 'code-review':
                messages.push({
                    role: 'user',
                    content: {
                        type: 'text',
                        text: this.buildCodeReviewPrompt(args)
                    }
                });
                break;

            case 'debug-analysis':
                messages.push({
                    role: 'user',
                    content: {
                        type: 'text',
                        text: this.buildDebugAnalysisPrompt(args)
                    }
                });
                break;

            case 'architecture-plan':
                messages.push({
                    role: 'user',
                    content: {
                        type: 'text',
                        text: this.buildArchitecturePlanPrompt(args)
                    }
                });
                break;

            case 'generate-docs':
                messages.push({
                    role: 'user',
                    content: {
                        type: 'text',
                        text: this.buildDocumentationPrompt(args)
                    }
                });
                break;

            case 'generate-tests':
                messages.push({
                    role: 'user',
                    content: {
                        type: 'text',
                        text: this.buildTestGenerationPrompt(args)
                    }
                });
                break;

            case 'commit-message':
                messages.push({
                    role: 'user',
                    content: {
                        type: 'text',
                        text: this.buildCommitMessagePrompt(args)
                    }
                });
                break;

            case 'optimize-performance':
                messages.push({
                    role: 'user',
                    content: {
                        type: 'text',
                        text: this.buildPerformanceOptimizationPrompt(args)
                    }
                });
                break;

            case 'api-design':
                messages.push({
                    role: 'user',
                    content: {
                        type: 'text',
                        text: this.buildApiDesignPrompt(args)
                    }
                });
                break;

            case 'security-review':
                messages.push({
                    role: 'user',
                    content: {
                        type: 'text',
                        text: this.buildSecurityReviewPrompt(args)
                    }
                });
                break;

            case 'learning-path':
                const learningPrompt = await this.buildLearningPathPrompt(args);
                messages.push({
                    role: 'user',
                    content: {
                        type: 'text',
                        text: learningPrompt
                    }
                });
                break;

            default:
                throw new Error(`Unknown prompt template: ${prompt.name}`);
        }

        return messages;
    }

    // Prompt template builders
    buildCodeReviewPrompt(args) {
        const { code, language, focus } = args;
        let prompt = `Please provide a comprehensive code review for the following code:\n\n`;
        
        if (language) {
            prompt += `Language: ${language}\n\n`;
        }
        
        prompt += `\`\`\`\n${code}\n\`\`\`\n\n`;
        prompt += `Please analyze the code for:\n`;
        prompt += `- Code quality and best practices\n`;
        prompt += `- Potential bugs or issues\n`;
        prompt += `- Performance considerations\n`;
        prompt += `- Security concerns\n`;
        prompt += `- Maintainability and readability\n`;
        
        if (focus) {
            prompt += `\nPlease pay special attention to: ${focus}\n`;
        }
        
        prompt += `\nProvide specific suggestions for improvement with examples where applicable.`;
        
        return prompt;
    }

    buildDebugAnalysisPrompt(args) {
        const { error_message, code_context, logs } = args;
        let prompt = `Help me debug this issue:\n\n`;
        prompt += `Error/Symptom: ${error_message}\n\n`;
        
        if (code_context) {
            prompt += `Relevant Code:\n\`\`\`\n${code_context}\n\`\`\`\n\n`;
        }
        
        if (logs) {
            prompt += `Logs/Stack Trace:\n\`\`\`\n${logs}\n\`\`\`\n\n`;
        }
        
        prompt += `Please help me:\n`;
        prompt += `1. Identify the root cause of the issue\n`;
        prompt += `2. Suggest specific fixes or debugging steps\n`;
        prompt += `3. Recommend preventive measures\n`;
        prompt += `4. Provide code examples if applicable`;
        
        return prompt;
    }

    buildArchitecturePlanPrompt(args) {
        const { requirements, scale, technology_preferences } = args;
        let prompt = `Design a system architecture for the following requirements:\n\n`;
        prompt += `Requirements:\n${requirements}\n\n`;
        
        if (scale) {
            prompt += `Scale Requirements: ${scale}\n\n`;
        }
        
        if (technology_preferences) {
            prompt += `Technology Preferences/Constraints: ${technology_preferences}\n\n`;
        }
        
        prompt += `Please provide:\n`;
        prompt += `1. High-level architecture diagram (in text/ASCII)\n`;
        prompt += `2. Technology stack recommendations\n`;
        prompt += `3. Data flow and component interactions\n`;
        prompt += `4. Scalability considerations\n`;
        prompt += `5. Security architecture\n`;
        prompt += `6. Deployment strategy\n`;
        prompt += `7. Potential challenges and mitigations`;
        
        return prompt;
    }

    buildDocumentationPrompt(args) {
        const { code, format, audience } = args;
        let prompt = `Generate comprehensive documentation for this code:\n\n`;
        prompt += `\`\`\`\n${code}\n\`\`\`\n\n`;
        
        if (format) {
            prompt += `Format: ${format}\n`;
        }
        
        if (audience) {
            prompt += `Target Audience: ${audience}\n`;
        }
        
        prompt += `\nInclude:\n`;
        prompt += `- Purpose and functionality overview\n`;
        prompt += `- Parameters and return values\n`;
        prompt += `- Usage examples\n`;
        prompt += `- Error handling\n`;
        prompt += `- Dependencies and requirements\n`;
        prompt += `- Performance considerations if applicable`;
        
        return prompt;
    }

    buildTestGenerationPrompt(args) {
        const { code, test_framework, coverage_type } = args;
        let prompt = `Generate comprehensive tests for this code:\n\n`;
        prompt += `\`\`\`\n${code}\n\`\`\`\n\n`;
        
        if (test_framework) {
            prompt += `Test Framework: ${test_framework}\n`;
        }
        
        if (coverage_type) {
            prompt += `Test Coverage Type: ${coverage_type}\n`;
        }
        
        prompt += `\nGenerate tests covering:\n`;
        prompt += `- Happy path scenarios\n`;
        prompt += `- Edge cases and boundary conditions\n`;
        prompt += `- Error conditions and exceptions\n`;
        prompt += `- Input validation\n`;
        prompt += `- Mock dependencies if needed\n`;
        prompt += `\nProvide complete, runnable test code with assertions.`;
        
        return prompt;
    }

    buildCommitMessagePrompt(args) {
        const { diff, type } = args;
        let prompt = `Generate a conventional commit message for these changes:\n\n`;
        prompt += `Changes:\n${diff}\n\n`;
        
        if (type) {
            prompt += `Suggested Type: ${type}\n\n`;
        }
        
        prompt += `Follow conventional commit format:\n`;
        prompt += `<type>(<scope>): <description>\n\n`;
        prompt += `[optional body]\n\n`;
        prompt += `[optional footer(s)]\n\n`;
        prompt += `Types: feat, fix, docs, style, refactor, test, chore\n`;
        prompt += `Keep description under 50 characters, use imperative mood.`;
        
        return prompt;
    }

    buildPerformanceOptimizationPrompt(args) {
        const { code, performance_metrics, constraints } = args;
        let prompt = `Analyze this code for performance optimization opportunities:\n\n`;
        prompt += `\`\`\`\n${code}\n\`\`\`\n\n`;
        
        if (performance_metrics) {
            prompt += `Current Performance Issues: ${performance_metrics}\n\n`;
        }
        
        if (constraints) {
            prompt += `Optimization Constraints: ${constraints}\n\n`;
        }
        
        prompt += `Please analyze for:\n`;
        prompt += `- Time complexity improvements\n`;
        prompt += `- Memory usage optimization\n`;
        prompt += `- Algorithm efficiency\n`;
        prompt += `- Caching opportunities\n`;
        prompt += `- Database query optimization\n`;
        prompt += `- Parallel processing potential\n`;
        prompt += `\nProvide specific optimization suggestions with before/after code examples.`;
        
        return prompt;
    }

    buildApiDesignPrompt(args) {
        const { requirements, api_type, data_model } = args;
        let prompt = `Design an API based on these requirements:\n\n`;
        prompt += `Requirements: ${requirements}\n\n`;
        
        if (api_type) {
            prompt += `API Type: ${api_type}\n\n`;
        }
        
        if (data_model) {
            prompt += `Data Model: ${data_model}\n\n`;
        }
        
        prompt += `Please provide:\n`;
        prompt += `1. API endpoint structure\n`;
        prompt += `2. Request/response schemas\n`;
        prompt += `3. HTTP methods and status codes\n`;
        prompt += `4. Authentication/authorization approach\n`;
        prompt += `5. Error handling strategy\n`;
        prompt += `6. Rate limiting considerations\n`;
        prompt += `7. Documentation examples\n`;
        prompt += `8. Versioning strategy`;
        
        return prompt;
    }

    buildSecurityReviewPrompt(args) {
        const { code, security_level } = args;
        let prompt = `Perform a security review of this code:\n\n`;
        prompt += `\`\`\`\n${code}\n\`\`\`\n\n`;
        
        if (security_level) {
            prompt += `Security Level Required: ${security_level}\n\n`;
        }
        
        prompt += `Check for:\n`;
        prompt += `- Input validation and sanitization\n`;
        prompt += `- SQL injection vulnerabilities\n`;
        prompt += `- XSS prevention\n`;
        prompt += `- Authentication and authorization flaws\n`;
        prompt += `- Sensitive data exposure\n`;
        prompt += `- Insecure cryptographic practices\n`;
        prompt += `- OWASP Top 10 vulnerabilities\n`;
        prompt += `\nProvide specific security recommendations and secure code examples.`;
        
        return prompt;
    }

    async buildLearningPathPrompt(args) {
        const { project_name, skill_focus } = args;
        let prompt = `Create a personalized learning path based on development history:\n\n`;
        
        // Get project-specific context if provided
        if (project_name) {
            try {
                const project = await this.db.getProjectByName(project_name);
                if (project) {
                    const memories = await this.db.listMemories({
                        projectId: project.id,
                        limit: 20,
                        orderBy: 'created_at',
                        orderDirection: 'DESC'
                    });
                    
                    prompt += `Recent project activities (${project_name}):\n`;
                    memories.forEach(memory => {
                        prompt += `- ${memory.memory_type}: ${memory.content.substring(0, 100)}...\n`;
                    });
                    prompt += `\n`;
                }
            } catch (error) {
                this.logger.debug(`Error loading project context: ${error.message}`);
            }
        }
        
        if (skill_focus) {
            prompt += `Focus Areas: ${skill_focus}\n\n`;
        }
        
        prompt += `Based on the development history, please suggest:\n`;
        prompt += `1. Skills that would benefit current projects\n`;
        prompt += `2. Technologies worth exploring\n`;
        prompt += `3. Best practices to adopt\n`;
        prompt += `4. Learning resources and next steps\n`;
        prompt += `5. Specific areas for improvement\n`;
        prompt += `\nProvide a prioritized learning roadmap with practical action items.`;
        
        return prompt;
    }
}