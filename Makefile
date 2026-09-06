.PHONY: up down seed reset-db logs demo help

help:        ## Show available commands
	@echo "BackendBhai Development Commands:"
	@echo "  make up        - Start the full stack"
	@echo "  make down      - Stop everything"
	@echo "  make seed      - Populate demo data (50+ diverse requests)"
	@echo "  make reset-db  - Drop and recreate both databases"
	@echo "  make logs      - Tail all service logs"
	@echo "  make demo      - Start stack and seed demo data in one command"

up:          ## Start the full stack
	docker compose up -d --build

down:        ## Stop everything
	docker compose down

seed:        ## Populate demo data
	node scripts/seed.js

reset-db:    ## Drop and recreate both databases
	docker compose down -v && docker compose up -d postgres && sleep 3 && node scripts/init-db.js

logs:        ## Tail all service logs
	docker compose logs -f

demo:        ## One command: fresh stack + seeded data, ready to present
	docker compose up -d --build && sleep 5 && make seed
