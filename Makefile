.PHONY: help install dev dev-backend dev-frontend \
        docker-up docker-down test lint clean

help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | \
		awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-20s\033[0m %s\n", $$1, $$2}'

# ── Setup ──────────────────────────────────────────────────────────────────────

install: install-backend install-frontend ## Install all dependencies

install-backend: ## Install Python dependencies
	cd backend && pip install -r requirements.txt

install-frontend: ## Install Node dependencies
	cd frontend && npm install

env: ## Copy .env.example to .env
	@test -f .env || (cp .env.example .env && echo "Created .env — fill in your credentials")

# ── Development ───────────────────────────────────────────────────────────────

dev: ## Run frontend + backend in parallel (requires make 4.x or GNU parallel)
	@$(MAKE) -j2 dev-backend dev-frontend

dev-backend: ## Run FastAPI dev server
	cd backend && uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

dev-frontend: ## Run Next.js dev server
	cd frontend && npm run dev

# ── Docker ────────────────────────────────────────────────────────────────────

docker-up: ## Start all services via Docker Compose
	docker compose -f infra/docker-compose.yml up --build -d

docker-down: ## Stop all Docker services
	docker compose -f infra/docker-compose.yml down

docker-logs: ## Tail Docker logs
	docker compose -f infra/docker-compose.yml logs -f

# ── Testing ───────────────────────────────────────────────────────────────────

test: test-backend test-frontend ## Run all tests

test-backend: ## Run backend tests
	cd backend && pytest tests/ -v

test-frontend: ## Run frontend tests
	cd frontend && npm test

lint: lint-backend lint-frontend ## Lint all code

lint-backend: ## Lint Python (ruff)
	cd backend && python -m ruff check app/ || true

lint-frontend: ## Lint TypeScript
	cd frontend && npm run lint

# ── Cleanup ───────────────────────────────────────────────────────────────────

clean: ## Remove build artifacts
	find . -type d -name __pycache__ -exec rm -rf {} + 2>/dev/null || true
	find . -name "*.pyc" -delete 2>/dev/null || true
	rm -rf frontend/.next frontend/node_modules/.cache
