# MiniMe-MCP Development Guide

## 🚀 Quick Start Development Workflows

### **Hot Reload Development (Fastest)**
For rapid UI development with instant updates:

```bash
# Start development mode with UI hot reload
make dev-hot

# Make your UI changes in ui/src/...
# Then rebuild UI and see changes instantly:
make ui-rebuild

# Refresh browser to see changes
```

**What this does:**
- Mounts local `ui/dist/` as volume in container
- UI changes are visible immediately after `make ui-rebuild`
- No Docker image rebuilding required
- Perfect for rapid UI iteration

### **Full Development Build**
For changes that require Docker image rebuilding:

```bash
# Full rebuild with fresh UI
make build-docker && make restart

# Or complete clean rebuild
make rebuild
```

### **Production Build**
For final testing and deployment:

```bash
# Production build (no volume mounting)
make build
make up
```

## 📋 Development Commands Reference

### **UI Development**
| Command | Purpose | When to Use |
|---------|---------|-------------|
| `make dev-hot` | Start with UI hot reload | Initial setup for UI development |
| `make ui-rebuild` | Rebuild UI for hot reload | After every UI change |
| `make build-ui` | Build UI assets only | Testing UI build without Docker |
| `make lint-ui` | Run ESLint checks | Before committing UI changes |

### **Full Development**
| Command | Purpose | When to Use |
|---------|---------|-------------|
| `make build-docker` | Build image with fresh UI | Server-side changes + UI |
| `make restart` | Restart with latest image | After `build-docker` |
| `make rebuild` | Complete clean rebuild | Major changes or troubleshooting |

### **Debugging & Monitoring**
| Command | Purpose | When to Use |
|---------|---------|-------------|
| `make debug` | Start with extensive logging | Debugging MCP tools |
| `make debug-rebuild` | Rebuild + debug mode | Code changes + debugging |
| `make logs` | Watch container logs | Monitor startup/operation |
| `make status` | Check container status | Quick health check |

## 🔄 Typical Development Workflows

### **UI-Only Changes**
```bash
# 1. Start hot reload mode (once)
make dev-hot

# 2. Make UI changes in ui/src/...

# 3. Rebuild UI (repeat as needed)
make ui-rebuild

# 4. Refresh browser to see changes
```

### **Server + UI Changes**
```bash
# Make your changes to src/ and/or ui/

# Full rebuild and restart
make build-docker && make restart

# Monitor startup
make logs
```

### **Database Schema Changes**
```bash
# Make changes to build/database/schema.sql

# Complete rebuild (includes schema)
make rebuild

# Verify schema
make shell-db
```

## 🏭 Production vs Development

### **Development Mode Features**
- Volume mounting for UI hot reload
- Debug logging available
- Local model loading
- Sample data loading
- `NODE_ENV=development`

### **Production Mode Features**
- UI baked into Docker image
- Optimized for performance
- No volume dependencies
- `NODE_ENV=production`
- Security optimizations

## 🛠️ Advanced Development

### **Working with Local Models**
```bash
# Start with local models enabled
make dev-hot  # Already includes USE_LOCAL_MODELS=true

# Or for production
USE_LOCAL_MODELS=true make up
```

### **Database Development**
```bash
# Access database directly
make shell-db

# Watch database logs
make logs-db

# Reset database (WARNING: destroys data)
make clean && make dev-hot
```

### **API Development**
```bash
# Monitor API logs
make logs | grep "MCP"

# Test API health
curl http://localhost:8000/health

# Access MCP tools
curl http://localhost:8000/mcp/status
```

## 🔧 Troubleshooting

### **UI Not Updating**
1. Check if you're in hot reload mode: `make dev-hot`
2. Rebuild UI: `make ui-rebuild`
3. Check volume mounting: `docker inspect minimemcp | grep Mounts`

### **Build Failures**
1. Clean everything: `make clean`
2. Rebuild from scratch: `make rebuild`
3. Check ESLint errors: `make lint-ui`

### **Container Issues**
1. Check status: `make status`
2. View logs: `make logs`
3. Restart: `make restart`

## 📝 Best Practices

### **Before Committing**
```bash
# 1. Run linting
make lint-ui

# 2. Test production build
make build-docker && make restart

# 3. Run health checks
make test
```

### **Daily Development**
1. Use `make dev-hot` for UI work
2. Use `make ui-rebuild` for every UI change
3. Switch to `make build-docker` for server changes
4. Always test production build before deploying

### **Performance Tips**
- Keep `make dev-hot` running during UI development
- Use `make ui-rebuild` instead of full rebuilds
- Only use `make rebuild` when necessary
- Monitor logs with `make logs` for debugging

---

## 🎯 Quick Reference

**Fastest UI Development:**
```bash
make dev-hot      # Start once
make ui-rebuild   # Use repeatedly
```

**Complete Development:**
```bash
make build-docker && make restart
```

**Production Testing:**
```bash
make build && make up
```