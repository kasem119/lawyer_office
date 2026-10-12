.PHONY: help deploy deploy-frontend deploy-backend status logs restart build

help:
	@echo ==================================================
	@echo Lawyer Office Management System - Deployment
	@echo ==================================================
	@echo Available commands:
	@echo   make deploy          - Deploy full application (Frontend + Backend)
	@echo   make deploy-frontend - Deploy frontend only (Vite build + upload)
	@echo   make deploy-backend  - Deploy backend only (routes, services, DB)
	@echo   make status          - Check live VPS service health and resources
	@echo   make logs            - Show live server logs (journalctl)
	@echo   make restart         - Restart remote lawyer-office service
	@echo   make build           - Build frontend locally
	@echo ==================================================

deploy:
	python deploy/deploy.py --mode all

deploy-frontend:
	python deploy/deploy.py --mode frontend

deploy-backend:
	python deploy/deploy.py --mode backend

status:
	python deploy/deploy.py --mode status

logs:
	python deploy/deploy.py --mode logs

restart:
	python deploy/deploy.py --mode restart

build:
	npm run build:client
