# =============================================================================
# TalentGeenie — Development Makefile
# =============================================================================
# Common commands for managing the self-hosted Supabase development stack.
#
# Usage:
#   make help        — Show all available commands
#   make up          — Start everything
#   make down        — Stop everything
#   make reset       — Wipe data and restart fresh
# =============================================================================

.PHONY: help up down stop start reset logs logs-db logs-auth logs-rest logs-realtime \
        logs-storage logs-kong logs-studio status migrate keys clean ps \
        frontend frontend-build frontend-preview

# Config
COMPOSE_FILE    := docker-compose.supabase.yml
ENV_FILE        := .env.supabase
COMPOSE         := docker compose -f $(COMPOSE_FILE) --env-file $(ENV_FILE)

# =============================================================================
# Help
# =============================================================================

help: ## Show this help
	@echo ""
	@echo "  TalentGeenie — Development Commands"
	@echo "  ════════════════════════════════════"
	@echo ""
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | \
		awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-20s\033[0m %s\n", $$1, $$2}'
	@echo ""

# =============================================================================
# Supabase Stack
# =============================================================================

up: ## Start the full Supabase backend stack
	@./scripts/start-dev.sh --backend

start: up ## Alias for 'up'

down: ## Stop all services (keep data)
	@$(COMPOSE) down

stop: down ## Alias for 'down'

restart: ## Restart all services
	@$(COMPOSE) restart

reset: ## ⚠️  Wipe ALL data and restart from scratch
	@./scripts/start-dev.sh --reset --backend

pull: ## Pull latest Docker images
	@$(COMPOSE) pull

# =============================================================================
# Status & Logs
# =============================================================================

ps: ## Show running containers
	@$(COMPOSE) ps

status: ## Show service health status
	@echo ""
	@echo "  Service Health Status"
	@echo "  ═════════════════════"
	@$(COMPOSE) ps --format "table {{.Name}}\t{{.Status}}\t{{.Ports}}"
	@echo ""

logs: ## Tail logs for all services
	@$(COMPOSE) logs -f --tail=50

logs-db: ## Tail PostgreSQL logs
	@$(COMPOSE) logs -f --tail=100 db

logs-auth: ## Tail GoTrue (auth) logs
	@$(COMPOSE) logs -f --tail=100 auth

logs-rest: ## Tail PostgREST logs
	@$(COMPOSE) logs -f --tail=100 rest

logs-realtime: ## Tail Realtime logs
	@$(COMPOSE) logs -f --tail=100 realtime

logs-storage: ## Tail Storage API logs
	@$(COMPOSE) logs -f --tail=100 storage

logs-kong: ## Tail Kong API gateway logs
	@$(COMPOSE) logs -f --tail=100 kong

logs-studio: ## Tail Studio dashboard logs
	@$(COMPOSE) logs -f --tail=100 studio

logs-migrate: ## Show migration runner output
	@$(COMPOSE) logs db-migrations

# =============================================================================
# Database
# =============================================================================

migrate: ## Run database migrations
	@$(COMPOSE) run --rm db-migrations

db-shell: ## Open psql shell to the database
	@$(COMPOSE) exec db psql -U postgres -d $${POSTGRES_DB:-postgres}

db-dump: ## Dump the database to db-dump.sql
	@$(COMPOSE) exec db pg_dump -U postgres -d $${POSTGRES_DB:-postgres} --clean --if-exists > db-dump.sql
	@echo "Database dumped to db-dump.sql"

db-tables: ## List all tables in public schema
	@$(COMPOSE) exec db psql -U postgres -d $${POSTGRES_DB:-postgres} \
		-c "SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename;"

db-migrations-status: ## Show applied migrations
	@$(COMPOSE) exec db psql -U postgres -d $${POSTGRES_DB:-postgres} \
		-c "SELECT filename, applied_at, checksum FROM public._schema_migrations ORDER BY applied_at;"

# =============================================================================
# Keys
# =============================================================================

keys: ## Generate new JWT keys
	@chmod +x scripts/generate-keys.sh
	@bash scripts/generate-keys.sh

keys-append: ## Generate keys and append to .env.supabase
	@chmod +x scripts/generate-keys.sh
	@bash scripts/generate-keys.sh --append $(ENV_FILE)

# =============================================================================
# Frontend (Vite dev server)
# =============================================================================

frontend: ## Start Vite dev server (frontend)
	@npm run dev

frontend-build: ## Build frontend for production
	@npm run build

frontend-preview: ## Preview production build locally
	@npm run preview

install: ## Install frontend dependencies
	@npm install

# =============================================================================
# Cleanup
# =============================================================================

clean: ## Remove all containers, volumes, and networks
	@echo "⚠️  This will remove ALL TalentGeenie Docker data!"
	@read -p "Are you sure? (y/N) " confirm && [ "$$confirm" = "y" ] || exit 0
	@$(COMPOSE) down -v --remove-orphans
	@echo "Cleanup complete."

prune: ## Remove unused Docker resources (system-wide)
	@docker system prune -f
