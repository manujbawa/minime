/**
 * MCP Resources Service for MiniMe-MCP
 * Provides file system and project resource access via MCP Resources API
 * Supports URI-based resource access following MCP specification
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

export class MCPResourcesService {
    constructor(logger, databaseService) {
        this.logger = logger;
        this.db = databaseService;
        
        // Define supported schemes and their handlers
        this.schemes = {
            'file': this.handleFileResource.bind(this),
            'project': this.handleProjectResource.bind(this),
            'memory': this.handleMemoryResource.bind(this),
            'session': this.handleSessionResource.bind(this)
        };
        
        // Security: Define allowed file extensions and directories
        this.allowedExtensions = new Set([
            '.js', '.ts', '.jsx', '.tsx', '.vue', '.py', '.java', '.cpp', '.c', '.h',
            '.css', '.scss', '.less', '.html', '.xml', '.json', '.yaml', '.yml',
            '.md', '.txt', '.sql', '.sh', '.bat', '.ps1', '.dockerfile', '.gitignore',
            '.env.example', '.config', '.ini', '.toml', '.lock', '.log'
        ]);
        
        // Define project roots (these can be updated by roots API)
        this.projectRoots = new Set(['/app', '/workspace', '/project']);
    }

    /**
     * List all available resources
     */
    async listResources() {
        const resources = [];
        
        try {
            // Add project-based resources
            const projects = await this.db.listProjects(false);
            for (const project of projects) {
                resources.push({
                    uri: `project://${project.name}`,
                    name: `Project: ${project.name}`,
                    description: project.description || `Access to ${project.name} project data`,
                    mimeType: 'application/json'
                });
                
                // Add memory collections for each project
                resources.push({
                    uri: `memory://${project.name}`,
                    name: `Memories: ${project.name}`,
                    description: `All memories and context for ${project.name}`,
                    mimeType: 'application/json'
                });
            }
            
            // Add file system resources from project roots
            for (const root of this.projectRoots) {
                try {
                    await this.addFileResources(resources, root, root);
                } catch (error) {
                    this.logger.debug(`Skipping root ${root}: ${error.message}`);
                }
            }
            
            // Add session resources
            resources.push({
                uri: 'session://current',
                name: 'Current Session',
                description: 'Information about the current MCP session',
                mimeType: 'application/json'
            });
            
        } catch (error) {
            this.logger.error('Error listing resources:', error);
        }
        
        return resources;
    }

    /**
     * Read a specific resource by URI
     */
    async readResource(uri) {
        this.logger.info(`Reading resource: ${uri}`);
        
        try {
            const url = new URL(uri);
            const scheme = url.protocol.slice(0, -1); // Remove trailing ':'
            
            if (!this.schemes[scheme]) {
                throw new Error(`Unsupported URI scheme: ${scheme}`);
            }
            
            return await this.schemes[scheme](url);
            
        } catch (error) {
            this.logger.error(`Error reading resource ${uri}:`, error);
            throw new Error(`Failed to read resource: ${error.message}`);
        }
    }

    /**
     * Handle file:// URIs
     */
    async handleFileResource(url) {
        const filePath = url.pathname;
        
        // Security checks
        if (!this.isAllowedPath(filePath)) {
            throw new Error(`Access denied to path: ${filePath}`);
        }
        
        if (!this.isAllowedExtension(filePath)) {
            throw new Error(`File type not allowed: ${path.extname(filePath)}`);
        }
        
        try {
            const stats = await fs.stat(filePath);
            
            if (stats.isDirectory()) {
                // Return directory listing
                const files = await fs.readdir(filePath, { withFileTypes: true });
                const listing = files.map(file => ({
                    name: file.name,
                    type: file.isDirectory() ? 'directory' : 'file',
                    path: path.join(filePath, file.name)
                }));
                
                return [{
                    uri: url.href,
                    mimeType: 'application/json',
                    text: JSON.stringify({
                        type: 'directory',
                        path: filePath,
                        contents: listing
                    }, null, 2)
                }];
            } else {
                // Return file contents
                const content = await fs.readFile(filePath, 'utf8');
                const mimeType = this.getMimeType(filePath);
                
                return [{
                    uri: url.href,
                    mimeType: mimeType,
                    text: content
                }];
            }
            
        } catch (error) {
            throw new Error(`File access error: ${error.message}`);
        }
    }

    /**
     * Handle project:// URIs
     */
    async handleProjectResource(url) {
        const projectName = url.hostname;
        const pathParts = url.pathname.split('/').filter(Boolean);
        
        const project = await this.db.getProjectByName(projectName);
        if (!project) {
            throw new Error(`Project not found: ${projectName}`);
        }
        
        if (pathParts.length === 0) {
            // Return project overview
            const sessions = await this.db.listSessionsForProject(project.id, false);
            const memoryCount = await this.db.query(
                'SELECT COUNT(*) as count FROM memories WHERE project_id = $1',
                [project.id]
            );
            
            return [{
                uri: url.href,
                mimeType: 'application/json',
                text: JSON.stringify({
                    id: project.id,
                    name: project.name,
                    description: project.description,
                    settings: project.settings,
                    sessions: sessions.length,
                    memories: parseInt(memoryCount.rows[0].count),
                    created_at: project.created_at,
                    updated_at: project.updated_at
                }, null, 2)
            }];
        }
        
        // Handle sub-resources like project://name/sessions, project://name/memories
        const resourceType = pathParts[0];
        
        switch (resourceType) {
            case 'sessions':
                const sessions = await this.db.listSessionsForProject(project.id, false);
                return [{
                    uri: url.href,
                    mimeType: 'application/json',
                    text: JSON.stringify(sessions, null, 2)
                }];
                
            case 'memories':
                const memories = await this.db.listMemories({
                    projectId: project.id,
                    limit: 100,
                    orderBy: 'created_at',
                    orderDirection: 'DESC'
                });
                return [{
                    uri: url.href,
                    mimeType: 'application/json',
                    text: JSON.stringify(memories, null, 2)
                }];
                
            default:
                throw new Error(`Unknown project resource: ${resourceType}`);
        }
    }

    /**
     * Handle memory:// URIs
     */
    async handleMemoryResource(url) {
        const projectName = url.hostname;
        const pathParts = url.pathname.split('/').filter(Boolean);
        
        const project = await this.db.getProjectByName(projectName);
        if (!project) {
            throw new Error(`Project not found: ${projectName}`);
        }
        
        if (pathParts.length === 0) {
            // Return all memories for project
            const memories = await this.db.listMemories({
                projectId: project.id,
                limit: 500,
                orderBy: 'created_at',
                orderDirection: 'DESC'
            });
            
            return [{
                uri: url.href,
                mimeType: 'application/json',
                text: JSON.stringify({
                    project: projectName,
                    total: memories.length,
                    memories: memories
                }, null, 2)
            }];
        }
        
        // Handle specific memory types or IDs
        const memoryFilter = pathParts[0];
        let memories;
        
        if (memoryFilter.match(/^\d+$/)) {
            // Specific memory ID
            const memoryId = parseInt(memoryFilter);
            const result = await this.db.query(
                'SELECT * FROM memories WHERE id = $1 AND project_id = $2',
                [memoryId, project.id]
            );
            memories = result.rows;
        } else {
            // Memory type filter
            memories = await this.db.listMemories({
                projectId: project.id,
                memoryType: memoryFilter,
                limit: 100,
                orderBy: 'created_at',
                orderDirection: 'DESC'
            });
        }
        
        return [{
            uri: url.href,
            mimeType: 'application/json',
            text: JSON.stringify(memories, null, 2)
        }];
    }

    /**
     * Handle session:// URIs
     */
    async handleSessionResource(url) {
        const sessionType = url.hostname;
        
        if (sessionType === 'current') {
            // Return current session info
            const sessionInfo = {
                timestamp: new Date().toISOString(),
                server: {
                    name: 'MiniMe-MCP',
                    version: '0.1.0',
                    capabilities: ['tools', 'resources', 'prompts', 'roots']
                },
                resources: {
                    totalProjects: await this.getProjectCount(),
                    totalMemories: await this.getMemoryCount(),
                    projectRoots: Array.from(this.projectRoots)
                }
            };
            
            return [{
                uri: url.href,
                mimeType: 'application/json',
                text: JSON.stringify(sessionInfo, null, 2)
            }];
        }
        
        throw new Error(`Unknown session resource: ${sessionType}`);
    }

    /**
     * Add file system resources recursively
     */
    async addFileResources(resources, rootPath, currentPath, depth = 0) {
        if (depth > 3) return; // Limit recursion depth
        
        try {
            const stats = await fs.stat(currentPath);
            if (!stats.isDirectory()) return;
            
            const files = await fs.readdir(currentPath, { withFileTypes: true });
            
            for (const file of files) {
                if (file.name.startsWith('.') && file.name !== '.gitignore') continue;
                
                const filePath = path.join(currentPath, file.name);
                const relativePath = path.relative(rootPath, filePath);
                
                if (file.isDirectory()) {
                    resources.push({
                        uri: `file://${filePath}`,
                        name: `Directory: ${relativePath}`,
                        description: `Directory containing project files`,
                        mimeType: 'application/json'
                    });
                    
                    // Recurse into subdirectory
                    await this.addFileResources(resources, rootPath, filePath, depth + 1);
                } else if (this.isAllowedExtension(filePath)) {
                    resources.push({
                        uri: `file://${filePath}`,
                        name: relativePath,
                        description: `Source file: ${path.basename(filePath)}`,
                        mimeType: this.getMimeType(filePath)
                    });
                }
            }
        } catch (error) {
            this.logger.debug(`Error reading directory ${currentPath}: ${error.message}`);
        }
    }

    /**
     * Security: Check if path is allowed
     */
    isAllowedPath(filePath) {
        const resolved = path.resolve(filePath);
        
        // Must be within one of the project roots
        for (const root of this.projectRoots) {
            if (resolved.startsWith(path.resolve(root))) {
                return true;
            }
        }
        
        return false;
    }

    /**
     * Security: Check if file extension is allowed
     */
    isAllowedExtension(filePath) {
        const ext = path.extname(filePath).toLowerCase();
        return this.allowedExtensions.has(ext) || filePath.endsWith('.env.example');
    }

    /**
     * Get MIME type for file extension
     */
    getMimeType(filePath) {
        const ext = path.extname(filePath).toLowerCase();
        
        const mimeTypes = {
            '.js': 'application/javascript',
            '.ts': 'application/typescript',
            '.jsx': 'application/javascript',
            '.tsx': 'application/typescript',
            '.py': 'text/x-python',
            '.java': 'text/x-java',
            '.cpp': 'text/x-c++',
            '.c': 'text/x-c',
            '.h': 'text/x-c',
            '.css': 'text/css',
            '.scss': 'text/x-scss',
            '.html': 'text/html',
            '.xml': 'application/xml',
            '.json': 'application/json',
            '.yaml': 'application/yaml',
            '.yml': 'application/yaml',
            '.md': 'text/markdown',
            '.txt': 'text/plain',
            '.sql': 'application/sql',
            '.sh': 'application/x-sh',
            '.log': 'text/plain'
        };
        
        return mimeTypes[ext] || 'text/plain';
    }

    /**
     * Update project roots (called by roots API)
     */
    updateRoots(roots) {
        this.projectRoots = new Set(roots.map(root => {
            if (root.startsWith('file://')) {
                return new URL(root).pathname;
            }
            return root;
        }));
        this.logger.info(`Updated project roots: ${Array.from(this.projectRoots).join(', ')}`);
    }

    /**
     * Get project count helper
     */
    async getProjectCount() {
        const result = await this.db.query('SELECT COUNT(*) as count FROM projects');
        return parseInt(result.rows[0].count);
    }

    /**
     * Get memory count helper
     */
    async getMemoryCount() {
        const result = await this.db.query('SELECT COUNT(*) as count FROM memories');
        return parseInt(result.rows[0].count);
    }
}