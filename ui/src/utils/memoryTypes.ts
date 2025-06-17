/**
 * Memory Types Utilities for UI
 * Matches the backend memory types constants
 */

// Existing memory types (preserve these)
export const LEGACY_MEMORY_TYPES = {
    CODE: 'code',
    DECISION: 'decision', 
    INSIGHT: 'insight',
    GENERAL: 'general',
    PROGRESS: 'progress',
    SUMMARY: 'summary',
    RELEASE_VERSION: 'release_version',
    PRD: 'prd',
    BUG: 'bug'
} as const;

// New Memory Bank-aligned types
export const MEMORY_BANK_TYPES = {
    PROJECT_BRIEF: 'project_brief',
    PRODUCT_CONTEXT: 'product_context', 
    ACTIVE_CONTEXT: 'active_context',
    SYSTEM_PATTERNS: 'system_patterns',
    TECH_CONTEXT: 'tech_context',
    ARCHITECTURE: 'architecture',
    REQUIREMENTS: 'requirements',
    DESIGN_DECISIONS: 'design_decisions',
    IMPLEMENTATION_NOTES: 'implementation_notes',
    LESSONS_LEARNED: 'lessons_learned'
} as const;

// All memory types combined
export const ALL_MEMORY_TYPES = {
    ...LEGACY_MEMORY_TYPES,
    ...MEMORY_BANK_TYPES
} as const;

// Memory type metadata for UI
export const MEMORY_TYPE_METADATA = {
    // Legacy types
    [LEGACY_MEMORY_TYPES.CODE]: {
        label: 'Code',
        description: 'Code-related memories and snippets',
        color: 'primary' as const,
        category: 'development'
    },
    [LEGACY_MEMORY_TYPES.DECISION]: {
        label: 'Decision', 
        description: 'Decisions made during development',
        color: 'info' as const,
        category: 'planning'
    },
    [LEGACY_MEMORY_TYPES.INSIGHT]: {
        label: 'Insight',
        description: 'Insights and discoveries',
        color: 'secondary' as const, 
        category: 'learning'
    },
    [LEGACY_MEMORY_TYPES.GENERAL]: {
        label: 'General',
        description: 'General purpose memories',
        color: 'default' as const,
        category: 'general'
    },
    [LEGACY_MEMORY_TYPES.PROGRESS]: {
        label: 'Progress',
        description: 'Progress tracking and status updates',
        color: 'success' as const,
        category: 'tracking'
    },
    [LEGACY_MEMORY_TYPES.SUMMARY]: {
        label: 'Summary',
        description: 'Summaries and overviews',
        color: 'info' as const,
        category: 'documentation'
    },
    [LEGACY_MEMORY_TYPES.RELEASE_VERSION]: {
        label: 'Release Version',
        description: 'Release and version information',
        color: 'warning' as const,
        category: 'releases'
    },
    [LEGACY_MEMORY_TYPES.PRD]: {
        label: 'PRD',
        description: 'Product requirement documents',
        color: 'primary' as const,
        category: 'documentation'
    },
    [LEGACY_MEMORY_TYPES.BUG]: {
        label: 'Bug',
        description: 'Bug reports and fixes',
        color: 'error' as const,
        category: 'issues'
    },

    // Memory Bank types
    [MEMORY_BANK_TYPES.PROJECT_BRIEF]: {
        label: 'Project Brief',
        description: 'Foundation document - core requirements and goals',
        color: 'primary' as const,
        category: 'foundation'
    },
    [MEMORY_BANK_TYPES.PRODUCT_CONTEXT]: {
        label: 'Product Context',
        description: 'Why this project exists, problems it solves',
        color: 'secondary' as const,
        category: 'foundation'
    },
    [MEMORY_BANK_TYPES.ACTIVE_CONTEXT]: {
        label: 'Active Context', 
        description: 'Current work focus, recent changes, next steps',
        color: 'warning' as const,
        category: 'current'
    },
    [MEMORY_BANK_TYPES.SYSTEM_PATTERNS]: {
        label: 'System Patterns',
        description: 'Architecture, design patterns, component relationships',
        color: 'info' as const,
        category: 'architecture'
    },
    [MEMORY_BANK_TYPES.TECH_CONTEXT]: {
        label: 'Tech Context',
        description: 'Technologies, setup, constraints, dependencies',
        color: 'primary' as const,
        category: 'technical'
    },
    [MEMORY_BANK_TYPES.ARCHITECTURE]: {
        label: 'Architecture',
        description: 'System architecture and design decisions',
        color: 'info' as const,
        category: 'architecture'
    },
    [MEMORY_BANK_TYPES.REQUIREMENTS]: {
        label: 'Requirements',
        description: 'Functional and non-functional requirements',
        color: 'primary' as const,
        category: 'planning'
    },
    [MEMORY_BANK_TYPES.DESIGN_DECISIONS]: {
        label: 'Design Decisions',
        description: 'Key design decisions and their rationale',
        color: 'secondary' as const,
        category: 'planning'
    },
    [MEMORY_BANK_TYPES.IMPLEMENTATION_NOTES]: {
        label: 'Implementation Notes',
        description: 'Implementation details and technical notes',
        color: 'default' as const,
        category: 'development'
    },
    [MEMORY_BANK_TYPES.LESSONS_LEARNED]: {
        label: 'Lessons Learned',
        description: 'Lessons learned and retrospective insights',
        color: 'success' as const,
        category: 'learning'
    }
} as const;

// Categories for grouping
export const MEMORY_CATEGORIES = {
    FOUNDATION: 'foundation',
    CURRENT: 'current', 
    ARCHITECTURE: 'architecture',
    TECHNICAL: 'technical',
    PLANNING: 'planning',
    DEVELOPMENT: 'development',
    DOCUMENTATION: 'documentation',
    LEARNING: 'learning',
    TRACKING: 'tracking',
    RELEASES: 'releases',
    ISSUES: 'issues',
    GENERAL: 'general'
} as const;

// Helper functions
export function getMemoryTypeLabel(type: string): string {
    return MEMORY_TYPE_METADATA[type as keyof typeof MEMORY_TYPE_METADATA]?.label || type;
}

export function getMemoryTypeDescription(type: string): string {
    return MEMORY_TYPE_METADATA[type as keyof typeof MEMORY_TYPE_METADATA]?.description || '';
}

export function getMemoryTypeColor(type: string): 'primary' | 'secondary' | 'info' | 'error' | 'warning' | 'success' | 'default' {
    return MEMORY_TYPE_METADATA[type as keyof typeof MEMORY_TYPE_METADATA]?.color || 'default';
}

export function getMemoryTypeCategory(type: string): string {
    return MEMORY_TYPE_METADATA[type as keyof typeof MEMORY_TYPE_METADATA]?.category || 'general';
}

export function getMemoryTypesByCategory(category: string) {
    return Object.entries(MEMORY_TYPE_METADATA)
        .filter(([_, metadata]) => metadata.category === category)
        .map(([type, _]) => type);
}

export function getAllMemoryTypesArray(): string[] {
    return Object.values(ALL_MEMORY_TYPES);
}

export function getMemoryTypesForUI() {
    return Object.entries(MEMORY_TYPE_METADATA).map(([type, metadata]) => ({
        value: type,
        label: metadata.label,
        description: metadata.description,
        color: metadata.color,
        category: metadata.category
    }));
}

export function getMemoryTypesByCategories() {
    const grouped: Record<string, Array<{value: string, label: string, description: string}>> = {};
    
    Object.entries(MEMORY_TYPE_METADATA).forEach(([type, metadata]) => {
        if (!grouped[metadata.category]) {
            grouped[metadata.category] = [];
        }
        grouped[metadata.category].push({
            value: type,
            label: metadata.label,
            description: metadata.description
        });
    });
    
    return grouped;
} 