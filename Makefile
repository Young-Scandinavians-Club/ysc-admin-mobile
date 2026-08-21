.PHONY: help lint format test typecheck ios android

.DEFAULT_GOAL := help

help:
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-12s\033[0m %s\n", $$1, $$2}'

lint: ## Run linter
	npm run -s lint

format: ## Format source files
	npm run -s format

typecheck: ## Run type checker
	npm run -s typecheck

test: ## Run tests
	npm run -s test

ios: ## Run the app in the iOS Simulator (checks/installs prerequisites first, macOS only)
	./scripts/run-ios.sh

android: ## Run the app in an Android Emulator (checks/installs prerequisites first)
	./scripts/run-android.sh
