.PHONY: help lint format test typecheck ios android android-device web

.DEFAULT_GOAL := help

help:
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-15s\033[0m %s\n", $$1, $$2}'

lint: ## Run linter
	npm run -s lint

format: ## Format source files
	npm run -s format

typecheck: ## Run type checker
	npm run -s typecheck

test: ## Run tests
	npm run -s test

# Backend environment for ios/android/web: local | sandbox | prod (default local,
# i.e. http://localhost:4000 — run ysc.org locally alongside this app).
# e.g. `make ios ENV=sandbox`, `make android ENV=prod`.
ENV ?= local

ios: ## Run the app in the iOS Simulator (checks/installs prerequisites first, macOS only). ENV=local|sandbox|prod
	@API_ENV=$(ENV) ./scripts/run-ios.sh

android: ## Run the app in an Android Emulator (checks/installs prerequisites first). ENV=local|sandbox|prod
	@API_ENV=$(ENV) ./scripts/run-android.sh

android-device: ## Install & run on a USB-connected physical Android device (needed for real Tap to Pay/NFC). ENV=local|sandbox|prod
	@API_ENV=$(ENV) DEVICE_ONLY=1 ./scripts/run-android.sh

web: ## Run the app in a browser via expo start --web. ENV=local|sandbox|prod
	@EXPO_PUBLIC_API_ENVIRONMENT=$(ENV) npm run -s web
