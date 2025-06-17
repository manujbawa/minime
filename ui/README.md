# MiniMe-MCP Web UI

A modern React-based dashboard for MiniMe-MCP providing visual exploration of memories, sequential thinking, and analytics.

## 🚀 Quick Start

The UI is automatically built and served as part of the Docker container. Access it at:

```
http://localhost:8000/ui
```

## 🛠 Development

### Local Development
```bash
# Install dependencies
npm install

# Start development server (with API proxy)
npm run dev

# Build for production
npm run build
```

### API Integration
The UI communicates with the MiniMe-MCP server via:
- **REST API**: `/api/*` endpoints
- **Health Checks**: `/health` and `/mcp/status`
- **MCP Protocol**: `/mcp` (Streamable HTTP)

## 📱 Features

### ✅ Currently Available

**📊 Dashboard**
- Real-time system health monitoring
- Project overview with statistics
- Interactive charts (memory growth, type distribution)
- Live performance metrics

**🔍 Memory Explorer**
- Advanced search with semantic similarity
- Smart filtering (project, type, importance, date)
- Rich memory display with metadata
- Real-time search results

### 🚧 Coming Soon
- **Thinking Sequence Visualizer**: Interactive flow diagrams
- **Advanced Analytics**: Usage patterns and insights
- **Project Management**: Visual project creation and management
- **Universal Search**: Cross-project search capabilities

## 🏗 Architecture

- **Framework**: React 18 + TypeScript
- **Build Tool**: Vite
- **Styling**: Tailwind CSS
- **Charts**: Recharts
- **Flow Diagrams**: React Flow (for thinking sequences)
- **Icons**: Lucide React
- **HTTP Client**: Axios

## 📂 Project Structure

```
ui/
├── src/
│   ├── components/     # Reusable UI components
│   ├── pages/         # Main application pages
│   ├── services/      # API integration
│   ├── types/         # TypeScript type definitions
│   └── utils/         # Utility functions
├── public/            # Static assets
└── dist/              # Built production files
```

## 🎨 Design System

- **Colors**: Primary blue theme with semantic colors
- **Typography**: Inter font family
- **Layout**: Responsive design with sidebar navigation
- **Components**: Consistent design patterns
- **Animations**: Subtle transitions and loading states

## 🔧 Configuration

### Build Configuration
- **Base Path**: `/ui/` (for Docker serving)
- **Proxy**: Development proxy to `localhost:8000` for API calls
- **Chunks**: Optimized code splitting for performance

### Environment
- **Development**: Vite dev server with hot reload
- **Production**: Static files served by Express.js at `/ui`

## 📊 Performance

- **Bundle Size**: ~670KB total (gzipped: ~195KB)
- **Load Time**: < 2s on fast networks
- **Caching**: Aggressive caching for static assets
- **Optimization**: Code splitting and tree shaking

## 🔄 API Integration Examples

```typescript
// Get system health
const health = await miniMeAPI.getHealth();

// Search memories
const results = await miniMeAPI.searchMemories('React performance', {
  project_name: 'web-app',
  memory_type: 'insight'
});

// Get analytics
const analytics = await miniMeAPI.getAnalytics('30 days', 'web-app');
```

## 🐛 Troubleshooting

### UI Not Loading
1. Check if container is running: `docker ps`
2. Verify UI was built: `docker exec minime-mcp ls -la /app/ui/dist`
3. Check logs: `docker logs minime-mcp`

### API Errors
1. Verify server health: `curl http://localhost:8000/health`
2. Check network connectivity
3. Review browser console for errors

### Development Issues
1. Clear node_modules: `rm -rf node_modules && npm install`
2. Clear build cache: `rm -rf dist && npm run build`
3. Check TypeScript errors: `npm run type-check`

---

*The UI is integrated into the main Docker build process and automatically served alongside the MCP server and REST API.*