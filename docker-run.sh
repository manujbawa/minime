#!/bin/bash
# MiniMe-MCP Docker Volume Setup and Run Script
# Usage: ./docker-run.sh [VOLUME_NAME] [OPTIONS]

set -e

# Configuration
DEFAULT_VOLUME_NAME="minime_data"
DEFAULT_IMAGE_NAME="minime-mcp"
DEFAULT_PORT="8000"
DEFAULT_PASSWORD="minime_secure_password"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Helper functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

show_usage() {
    cat << EOF
MiniMe-MCP Docker Volume Management

Usage: $0 [COMMAND] [OPTIONS]

Commands:
    run [VOLUME_NAME]     Run MiniMe-MCP with persistent volume (default: minime_data)
    build                 Build the Docker image
    stop                  Stop and remove running container
    logs                  Show container logs
    shell                 Open shell in running container
    clean                 Remove container, image, and volume (WARNING: deletes all data!)
    status                Show container and volume status

Options for 'run':
    --port PORT          Host port to bind (default: 8000)
    --password PASS      Database password (default: auto-generated)
    --name NAME          Container name (default: minime-mcp)
    --detach, -d         Run in background (detached mode)
    --build              Build image before running

Examples:
    $0 run                          # Run with default volume 'minime_data'
    $0 run my_project_data          # Run with custom volume name
    $0 run --port 8080 -d           # Run on port 8080 in background
    $0 build                        # Build the Docker image
    $0 logs                         # View container logs
    $0 status                       # Check system status

Volume Data Location:
    All persistent data (database, models, logs) is stored in the Docker volume.
    This includes:
    - PostgreSQL database with memories and thinking sequences
    - Downloaded Ollama models
    - Application logs and configuration

EOF
}

# Parse command line arguments
COMMAND="${1:-run}"
VOLUME_NAME="$DEFAULT_VOLUME_NAME"
CONTAINER_NAME="minime-mcp"
PORT="$DEFAULT_PORT"
PASSWORD=""
DETACH_MODE=""
BUILD_FIRST=""

# Shift past command
shift || true

# Parse additional arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --port)
            PORT="$2"
            shift 2
            ;;
        --password)
            PASSWORD="$2"
            shift 2
            ;;
        --name)
            CONTAINER_NAME="$2"
            shift 2
            ;;
        --detach|-d)
            DETACH_MODE="-d"
            shift
            ;;
        --build)
            BUILD_FIRST="yes"
            shift
            ;;
        --help|-h)
            show_usage
            exit 0
            ;;
        -*)
            log_error "Unknown option: $1"
            show_usage
            exit 1
            ;;
        *)
            # If it's not an option, treat as volume name
            if [[ "$COMMAND" == "run" ]] && [[ -z "$VOLUME_NAME_SET" ]]; then
                VOLUME_NAME="$1"
                VOLUME_NAME_SET="yes"
            else
                log_error "Unknown argument: $1"
                show_usage
                exit 1
            fi
            shift
            ;;
    esac
done

# Use default password if not provided (for volume persistence)
if [[ -z "$PASSWORD" ]]; then
    PASSWORD="$DEFAULT_PASSWORD"
fi

# Check if Docker is available
check_docker() {
    if ! command -v docker &> /dev/null; then
        log_error "Docker is not installed or not in PATH"
        exit 1
    fi
    
    if ! docker info &> /dev/null; then
        log_error "Docker daemon is not running or current user lacks permissions"
        log_info "Try: sudo systemctl start docker"
        log_info "Or add your user to docker group: sudo usermod -aG docker \$USER"
        exit 1
    fi
}

# Build Docker image
build_image() {
    log_info "Building MiniMe-MCP Docker image..."
    
    if [[ ! -f "build/Dockerfile" ]]; then
        log_error "Dockerfile not found. Please run from project root directory."
        exit 1
    fi
    
    # Build from project root with build/Dockerfile so all files are in context
    docker build -f build/Dockerfile -t "$DEFAULT_IMAGE_NAME:latest" .
    
    log_success "Docker image built successfully: $DEFAULT_IMAGE_NAME:latest"
}

# Create volume if it doesn't exist
create_volume() {
    local volume_name="$1"
    
    if docker volume inspect "$volume_name" &> /dev/null; then
        log_info "Volume '$volume_name' already exists"
    else
        log_info "Creating Docker volume: $volume_name"
        docker volume create "$volume_name"
        log_success "Volume '$volume_name' created"
    fi
}

# Run MiniMe-MCP container
run_container() {
    local volume_name="$1"
    
    # Build first if requested
    if [[ "$BUILD_FIRST" == "yes" ]]; then
        build_image
    fi
    
    # Check if image exists
    if ! docker image inspect "$DEFAULT_IMAGE_NAME:latest" &> /dev/null; then
        log_warning "Docker image not found. Building it now..."
        build_image
    fi
    
    # Create volume
    create_volume "$volume_name"
    
    # Stop existing container if running
    if docker ps -q -f name="$CONTAINER_NAME" | grep -q .; then
        log_info "Stopping existing container: $CONTAINER_NAME"
        docker stop "$CONTAINER_NAME" || true
        docker rm "$CONTAINER_NAME" || true
    fi
    
    log_info "Starting MiniMe-MCP container..."
    log_info "  Volume: $volume_name"
    log_info "  Port: $PORT"
    log_info "  Container: $CONTAINER_NAME"
    
    # Run container with volume mount
    docker run $DETACH_MODE \
        --name "$CONTAINER_NAME" \
        -p "$PORT:8000" \
        -v "$volume_name:/data" \
        -e POSTGRES_PASSWORD="$PASSWORD" \
        -e MCP_PORT=8000 \
        -e LOG_LEVEL=info \
        "$DEFAULT_IMAGE_NAME:latest"
    
    if [[ "$DETACH_MODE" == "-d" ]]; then
        log_success "MiniMe-MCP started in background"
        log_info "Access the system at: http://localhost:$PORT"
        log_info "Health check: http://localhost:$PORT/health"
        log_info "View logs with: $0 logs"
    else
        log_success "MiniMe-MCP started in foreground"
    fi
}

# Show container logs
show_logs() {
    if docker ps -q -f name="$CONTAINER_NAME" | grep -q .; then
        log_info "Showing logs for container: $CONTAINER_NAME"
        docker logs -f "$CONTAINER_NAME"
    else
        log_error "Container '$CONTAINER_NAME' is not running"
        exit 1
    fi
}

# Stop container
stop_container() {
    if docker ps -q -f name="$CONTAINER_NAME" | grep -q .; then
        log_info "Stopping container: $CONTAINER_NAME"
        docker stop "$CONTAINER_NAME"
        docker rm "$CONTAINER_NAME"
        log_success "Container stopped and removed"
    else
        log_warning "Container '$CONTAINER_NAME' is not running"
    fi
}

# Open shell in container
open_shell() {
    if docker ps -q -f name="$CONTAINER_NAME" | grep -q .; then
        log_info "Opening shell in container: $CONTAINER_NAME"
        docker exec -it "$CONTAINER_NAME" /bin/bash
    else
        log_error "Container '$CONTAINER_NAME' is not running"
        exit 1
    fi
}

# Clean up everything
clean_all() {
    read -p "This will delete ALL data including the volume. Are you sure? (yes/no): " confirm
    if [[ "$confirm" != "yes" ]]; then
        log_info "Operation cancelled"
        exit 0
    fi
    
    log_warning "Cleaning up MiniMe-MCP (this will delete all data)..."
    
    # Stop and remove container
    docker stop "$CONTAINER_NAME" 2>/dev/null || true
    docker rm "$CONTAINER_NAME" 2>/dev/null || true
    
    # Remove image
    docker rmi "$DEFAULT_IMAGE_NAME:latest" 2>/dev/null || true
    
    # Remove volume
    docker volume rm "$VOLUME_NAME" 2>/dev/null || true
    
    log_success "Cleanup completed"
}

# Show status
show_status() {
    log_info "MiniMe-MCP System Status"
    echo
    
    # Container status
    if docker ps -q -f name="$CONTAINER_NAME" | grep -q .; then
        echo -e "${GREEN}Container:${NC} Running"
        docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" -f name="$CONTAINER_NAME"
    else
        echo -e "${YELLOW}Container:${NC} Not running"
    fi
    
    echo
    
    # Volume status
    if docker volume inspect "$VOLUME_NAME" &> /dev/null; then
        echo -e "${GREEN}Volume:${NC} $VOLUME_NAME exists"
        # Show volume size if possible
        docker system df -v | grep "$VOLUME_NAME" || true
    else
        echo -e "${YELLOW}Volume:${NC} $VOLUME_NAME does not exist"
    fi
    
    echo
    
    # Image status
    if docker image inspect "$DEFAULT_IMAGE_NAME:latest" &> /dev/null; then
        echo -e "${GREEN}Image:${NC} $DEFAULT_IMAGE_NAME:latest exists"
        docker images --format "table {{.Repository}}\t{{.Tag}}\t{{.Size}}\t{{.CreatedAt}}" "$DEFAULT_IMAGE_NAME"
    else
        echo -e "${YELLOW}Image:${NC} $DEFAULT_IMAGE_NAME:latest not built"
    fi
}

# Main script logic
main() {
    check_docker
    
    case "$COMMAND" in
        run)
            run_container "$VOLUME_NAME"
            ;;
        build)
            build_image
            ;;
        stop)
            stop_container
            ;;
        logs)
            show_logs
            ;;
        shell)
            open_shell
            ;;
        clean)
            clean_all
            ;;
        status)
            show_status
            ;;
        help|--help|-h)
            show_usage
            ;;
        *)
            log_error "Unknown command: $COMMAND"
            show_usage
            exit 1
            ;;
    esac
}

# Check if script is being sourced or executed
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi