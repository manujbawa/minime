/**
 * Task Extraction Service for MiniMe-MCP
 * Extracts actionable tasks from various document types (project briefs, PRDs, requirements)
 */

export class TaskExtractor {
    constructor(logger, databaseService) {
        this.logger = logger;
        this.db = databaseService;
        
        // Pattern definitions for different document types
        this.patterns = {
            // Common actionable phrases
            actionable: [
                'implement', 'create', 'add', 'build', 'develop', 'design',
                'fix', 'update', 'refactor', 'optimize', 'improve',
                'test', 'verify', 'validate', 'ensure', 'setup',
                'configure', 'deploy', 'integrate', 'migrate'
            ],
            
            // Requirement indicators
            requirements: [
                'must', 'should', 'need to', 'will', 'shall',
                'require', 'necessary', 'essential', 'critical'
            ],
            
            // Priority indicators
            priority: {
                critical: ['urgent', 'critical', 'asap', 'immediately', 'blocker'],
                high: ['important', 'high priority', 'soon', 'quickly'],
                low: ['nice to have', 'optional', 'future', 'later', 'eventually']
            },
            
            // Time estimates
            timeEstimates: /(\d+)\s*(hours?|days?|weeks?|months?)/gi,
            
            // Due dates
            dueDates: /(?:due|deadline|by)\s*:?\s*(\d{4}-\d{2}-\d{2}|\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/gi
        };
    }

    /**
     * Extract tasks from a memory document
     */
    async extractTasksFromMemory(memoryId) {
        try {
            const memory = await this.getMemory(memoryId);
            if (!memory) {
                throw new Error(`Memory with ID ${memoryId} not found`);
            }

            const tasks = await this.extractTasksByType(memory.content, memory.memory_type);
            
            // Add metadata to extracted tasks
            return tasks.map(task => ({
                ...task,
                source_memory_id: memoryId,
                source_type: memory.memory_type,
                extracted_at: new Date().toISOString()
            }));

        } catch (error) {
            this.logger.error('Error extracting tasks from memory:', error);
            throw error;
        }
    }

    /**
     * Extract tasks based on document type
     */
    async extractTasksByType(content, memoryType) {
        switch (memoryType) {
            case 'project_brief':
                return this.extractFromProjectBrief(content);
            case 'prd':
                return this.extractFromPRD(content);
            case 'requirements':
                return this.extractFromRequirements(content);
            case 'bug':
                return this.extractFromBugReport(content);
            default:
                return this.genericTaskExtraction(content);
        }
    }

    /**
     * Extract tasks from project brief
     */
    extractFromProjectBrief(content) {
        const tasks = [];

        // Pattern 1: Numbered lists (1. Task item)
        const numberedTasks = this.extractNumberedTasks(content);
        tasks.push(...numberedTasks);

        // Pattern 2: Bullet points
        const bulletTasks = this.extractBulletTasks(content);
        tasks.push(...bulletTasks);

        // Pattern 3: Requirement phrases
        const requirementTasks = this.extractRequirementTasks(content);
        tasks.push(...requirementTasks);

        // Pattern 4: Section-based extraction
        const sectionTasks = this.extractFromSections(content);
        tasks.push(...sectionTasks);

        return this.deduplicateAndEnhanceTasks(tasks);
    }

    /**
     * Extract tasks from PRD (Product Requirements Document)
     */
    extractFromPRD(content) {
        const tasks = [];
        const sections = this.extractSections(content);

        // User Stories → Feature tasks
        if (sections['User Stories'] || sections['user stories']) {
            const userStorySection = sections['User Stories'] || sections['user stories'];
            const stories = this.extractUserStories(userStorySection);
            
            tasks.push(...stories.map(story => ({
                title: story.title || `Implement user story: ${story.summary}`,
                description: story.description,
                category: 'feature',
                priority: this.inferPriorityFromText(story.description),
                acceptance_criteria: story.acceptance_criteria || [],
                estimated_hours: story.estimated_hours,
                user_story_id: story.id
            })));
        }

        // Functional Requirements → Feature tasks
        if (sections['Functional Requirements'] || sections['functional requirements']) {
            const reqSection = sections['Functional Requirements'] || sections['functional requirements'];
            const requirements = this.extractRequirements(reqSection);
            
            tasks.push(...requirements.map(req => ({
                title: req.summary,
                description: req.details,
                category: 'feature',
                priority: req.priority || this.inferPriorityFromText(req.details),
                tags: ['functional-requirement', req.id].filter(Boolean)
            })));
        }

        // Non-functional Requirements → Various task types
        if (sections['Non-functional Requirements'] || sections['non-functional requirements']) {
            const nfrSection = sections['Non-functional Requirements'] || sections['non-functional requirements'];
            const nfrs = this.extractRequirements(nfrSection);
            
            tasks.push(...nfrs.map(nfr => ({
                title: nfr.summary,
                description: nfr.details,
                category: this.categorizeNFR(nfr),
                priority: { urgency: 'medium', impact: 'high', effort: 'medium' },
                tags: ['non-functional', nfr.type].filter(Boolean)
            })));
        }

        // Acceptance Criteria → Testing tasks
        if (sections['Acceptance Criteria'] || sections['acceptance criteria']) {
            const acSection = sections['Acceptance Criteria'] || sections['acceptance criteria'];
            const criteria = this.extractAcceptanceCriteria(acSection);
            
            tasks.push(...criteria.map(criterion => ({
                title: `Test: ${criterion.summary}`,
                description: criterion.details,
                category: 'testing',
                priority: { urgency: 'medium', impact: 'high', effort: 'low' },
                tags: ['acceptance-criteria', 'testing']
            })));
        }

        return this.deduplicateAndEnhanceTasks(tasks);
    }

    /**
     * Extract tasks from requirements document
     */
    extractFromRequirements(content) {
        const tasks = [];

        // Functional requirements
        const functionalReqs = this.extractFunctionalRequirements(content);
        tasks.push(...functionalReqs.map(req => ({
            title: req.title,
            description: req.description,
            category: 'feature',
            priority: req.priority,
            tags: ['requirement', req.id].filter(Boolean)
        })));

        // Technical requirements
        const technicalReqs = this.extractTechnicalRequirements(content);
        tasks.push(...technicalReqs.map(req => ({
            title: req.title,
            description: req.description,
            category: this.categorizeTechnicalRequirement(req),
            priority: req.priority,
            tags: ['technical-requirement', req.id].filter(Boolean)
        })));

        return this.deduplicateAndEnhanceTasks(tasks);
    }

    /**
     * Extract tasks from bug reports
     */
    extractFromBugReport(content) {
        const tasks = [];

        // Main bug fix task
        const bugTitle = this.extractBugTitle(content);
        const bugDescription = this.extractBugDescription(content);
        
        tasks.push({
            title: `Fix: ${bugTitle}`,
            description: bugDescription,
            category: 'bug',
            priority: this.inferBugPriority(content),
            tags: ['bug-fix']
        });

        // Related testing tasks
        const testingSteps = this.extractTestingSteps(content);
        if (testingSteps.length > 0) {
            tasks.push({
                title: `Test fix for: ${bugTitle}`,
                description: `Verify fix using steps:\n${testingSteps.join('\n')}`,
                category: 'testing',
                priority: { urgency: 'high', impact: 'medium', effort: 'low' },
                tags: ['bug-verification', 'testing']
            });
        }

        return tasks;
    }

    /**
     * Generic task extraction for unknown document types
     */
    genericTaskExtraction(content) {
        const tasks = [];

        // Extract actionable items
        const actionableTasks = this.extractActionableItems(content);
        tasks.push(...actionableTasks);

        // Extract TODO items
        const todoTasks = this.extractTodoItems(content);
        tasks.push(...todoTasks);

        return this.deduplicateAndEnhanceTasks(tasks);
    }

    /**
     * PATTERN EXTRACTION METHODS
     */

    extractNumberedTasks(content) {
        const tasks = [];
        const numberedPattern = /^\s*(\d+)[\.\)]\s+(.+)$/gm;
        let match;

        while ((match = numberedPattern.exec(content)) !== null) {
            const taskText = match[2].trim();
            if (this.isActionable(taskText)) {
                tasks.push(this.parseTaskFromText(taskText));
            }
        }

        return tasks;
    }

    extractBulletTasks(content) {
        const tasks = [];
        const bulletPattern = /^\s*[\*\-\+]\s+(.+)$/gm;
        let match;

        while ((match = bulletPattern.exec(content)) !== null) {
            const taskText = match[1].trim();
            if (this.isActionable(taskText)) {
                tasks.push(this.parseTaskFromText(taskText));
            }
        }

        return tasks;
    }

    extractRequirementTasks(content) {
        const tasks = [];
        const requirementPattern = new RegExp(
            `(${this.patterns.requirements.join('|')})\\s+(.+?)(?:\\.|$)`, 
            'gi'
        );
        let match;

        while ((match = requirementPattern.exec(content)) !== null) {
            const requirement = match[2].trim();
            if (this.isActionable(requirement)) {
                tasks.push(this.parseTaskFromText(requirement));
            }
        }

        return tasks;
    }

    extractFromSections(content) {
        const tasks = [];
        const sections = this.extractSections(content);

        // Look for task-relevant sections
        const taskSections = [
            'Key Requirements', 'Success Criteria', 'Action Items',
            'Next Steps', 'TODO', 'Tasks', 'Implementation Steps'
        ];

        for (const sectionName of taskSections) {
            if (sections[sectionName]) {
                const sectionTasks = this.extractFromSection(sections[sectionName]);
                tasks.push(...sectionTasks);
            }
        }

        return tasks;
    }

    extractActionableItems(content) {
        const tasks = [];
        const actionablePattern = new RegExp(
            `\\b(${this.patterns.actionable.join('|')})\\s+(.{10,100})`, 
            'gi'
        );
        let match;

        while ((match = actionablePattern.exec(content)) !== null) {
            const taskText = match[0].trim();
            tasks.push(this.parseTaskFromText(taskText));
        }

        return tasks;
    }

    extractTodoItems(content) {
        const tasks = [];
        const todoPattern = /(?:TODO|FIXME|NOTE):\s*(.+)$/gm;
        let match;

        while ((match = todoPattern.exec(content)) !== null) {
            const taskText = match[1].trim();
            tasks.push(this.parseTaskFromText(taskText));
        }

        return tasks;
    }

    /**
     * PARSING AND ANALYSIS METHODS
     */

    parseTaskFromText(text) {
        const task = {
            title: this.extractTitle(text),
            description: text,
            category: this.inferCategory(text),
            priority: this.inferPriorityFromText(text),
            tags: this.extractTags(text)
        };

        // Extract time estimates
        const timeMatch = text.match(this.patterns.timeEstimates);
        if (timeMatch) {
            task.estimated_hours = this.convertToHours(timeMatch[1], timeMatch[2]);
        }

        // Extract due dates
        const dueDateMatch = text.match(this.patterns.dueDates);
        if (dueDateMatch) {
            task.due_date = this.normalizeDueDate(dueDateMatch[1]);
        }

        // Extract dependencies
        const dependencies = this.extractDependencies(text);
        if (dependencies.length > 0) {
            task.dependencies = dependencies;
        }

        return task;
    }

    extractTitle(text) {
        // Extract first sentence or first 80 characters
        const firstSentence = text.split(/[.!?]/)[0].trim();
        return firstSentence.length > 80 
            ? firstSentence.substring(0, 80) + '...'
            : firstSentence;
    }

    inferCategory(text) {
        const lowerText = text.toLowerCase();
        
        if (this.containsAny(lowerText, ['test', 'verify', 'validate', 'check'])) return 'testing';
        if (this.containsAny(lowerText, ['fix', 'bug', 'error', 'issue'])) return 'bug';
        if (this.containsAny(lowerText, ['refactor', 'optimize', 'improve', 'cleanup'])) return 'refactor';
        if (this.containsAny(lowerText, ['document', 'readme', 'guide', 'spec'])) return 'documentation';
        
        return 'feature';
    }

    inferPriorityFromText(text) {
        const lowerText = text.toLowerCase();
        
        for (const [level, keywords] of Object.entries(this.patterns.priority)) {
            if (this.containsAny(lowerText, keywords)) {
                return this.getPriorityObject(level);
            }
        }
        
        return { urgency: 'medium', impact: 'medium', effort: 'medium' };
    }

    /**
     * HELPER METHODS
     */

    async getMemory(memoryId) {
        const result = await this.db.query(
            'SELECT content, memory_type FROM memories WHERE id = $1', 
            [memoryId]
        );
        return result.rows[0] || null;
    }

    extractSections(content) {
        const sections = {};
        const sectionPattern = /^#+\s*(.+)$/gm;
        let currentSection = null;
        let currentContent = '';
        
        const lines = content.split('\n');
        
        for (const line of lines) {
            const sectionMatch = line.match(sectionPattern);
            
            if (sectionMatch) {
                // Save previous section
                if (currentSection) {
                    sections[currentSection] = currentContent.trim();
                }
                
                // Start new section
                currentSection = sectionMatch[1].trim();
                currentContent = '';
            } else if (currentSection) {
                currentContent += line + '\n';
            }
        }
        
        // Save last section
        if (currentSection) {
            sections[currentSection] = currentContent.trim();
        }
        
        return sections;
    }

    isActionable(text) {
        const lowerText = text.toLowerCase();
        return this.patterns.actionable.some(word => 
            lowerText.includes(word)
        ) || this.patterns.requirements.some(word => 
            lowerText.includes(word)
        );
    }

    containsAny(text, keywords) {
        return keywords.some(keyword => text.includes(keyword));
    }

    getPriorityObject(level) {
        const priorities = {
            critical: { urgency: 'critical', impact: 'high', effort: 'medium' },
            high: { urgency: 'high', impact: 'high', effort: 'medium' },
            low: { urgency: 'low', impact: 'low', effort: 'low' }
        };
        return priorities[level] || { urgency: 'medium', impact: 'medium', effort: 'medium' };
    }

    extractTags(text) {
        const tags = [];
        const lowerText = text.toLowerCase();
        
        // Technology tags
        const techKeywords = ['api', 'database', 'frontend', 'backend', 'ui', 'ux', 'auth', 'security'];
        techKeywords.forEach(keyword => {
            if (lowerText.includes(keyword)) {
                tags.push(keyword);
            }
        });
        
        return tags;
    }

    extractDependencies(text) {
        const dependencies = [];
        const depPattern = /(?:after|depends on|requires|needs)\s+([^,.\n]+)/gi;
        let match;
        
        while ((match = depPattern.exec(text)) !== null) {
            dependencies.push(match[1].trim());
        }
        
        return dependencies;
    }

    convertToHours(amount, unit) {
        const num = parseInt(amount);
        const lowerUnit = unit.toLowerCase();
        
        if (lowerUnit.startsWith('hour')) return num;
        if (lowerUnit.startsWith('day')) return num * 8;
        if (lowerUnit.startsWith('week')) return num * 40;
        if (lowerUnit.startsWith('month')) return num * 160;
        
        return num;
    }

    normalizeDueDate(dateStr) {
        // Convert various date formats to ISO format
        try {
            return new Date(dateStr).toISOString().split('T')[0];
        } catch {
            return dateStr; // Return as-is if parsing fails
        }
    }

    deduplicateAndEnhanceTasks(tasks) {
        // Remove duplicates based on title similarity
        const uniqueTasks = [];
        const seenTitles = new Set();
        
        for (const task of tasks) {
            const normalizedTitle = task.title.toLowerCase().trim();
            if (!seenTitles.has(normalizedTitle)) {
                seenTitles.add(normalizedTitle);
                
                // Enhance task with additional metadata
                task.extraction_confidence = this.calculateExtractionConfidence(task);
                task.complexity_estimate = this.estimateComplexity(task);
                
                uniqueTasks.push(task);
            }
        }
        
        return uniqueTasks;
    }

    calculateExtractionConfidence(task) {
        let confidence = 0.5; // Base confidence
        
        // Higher confidence for explicit action words
        if (this.patterns.actionable.some(word => 
            task.description.toLowerCase().includes(word))) {
            confidence += 0.2;
        }
        
        // Higher confidence for structured content
        if (task.acceptance_criteria && task.acceptance_criteria.length > 0) {
            confidence += 0.2;
        }
        
        // Higher confidence for time estimates
        if (task.estimated_hours) {
            confidence += 0.1;
        }
        
        return Math.min(1.0, confidence);
    }

    estimateComplexity(task) {
        const description = task.description.toLowerCase();
        let complexity = 'medium';
        
        // Simple task indicators
        if (this.containsAny(description, ['fix', 'update', 'change', 'simple'])) {
            complexity = 'low';
        }
        
        // Complex task indicators
        if (this.containsAny(description, ['implement', 'design', 'architecture', 'integration', 'complex'])) {
            complexity = 'high';
        }
        
        // Override based on time estimates
        if (task.estimated_hours) {
            if (task.estimated_hours <= 4) complexity = 'low';
            else if (task.estimated_hours >= 16) complexity = 'high';
        }
        
        return complexity;
    }

    // Placeholder methods for PRD-specific extraction
    extractUserStories(content) { return []; }
    extractRequirements(content) { return []; }
    extractAcceptanceCriteria(content) { return []; }
    extractFunctionalRequirements(content) { return []; }
    extractTechnicalRequirements(content) { return []; }
    extractFromSection(content) { return []; }
    categorizeNFR(nfr) { return 'optimization'; }
    categorizeTechnicalRequirement(req) { return 'feature'; }
    extractBugTitle(content) { return 'Bug fix'; }
    extractBugDescription(content) { return content.substring(0, 200); }
    extractTestingSteps(content) { return []; }
    inferBugPriority(content) { 
        return { urgency: 'high', impact: 'medium', effort: 'medium' }; 
    }
}