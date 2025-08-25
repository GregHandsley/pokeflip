# Makefile at repo root
VENV := .venv
PY   := $(VENV)/bin/python
PIP  := $(VENV)/bin/pip

.PHONY: init db ingest build-csv report watch add-sale freeze

# 1) First-time setup (after you've created .venv already)
init:
	$(PIP) install -r requirements.txt

# 2) Create/upgrade database schema
db:
	$(PY) app/db_init.py

# 3) Ingest photos -> staged cards (add flags via ARGS="...")
ingest:
	$(PY) -m app.ingest_cli $(ARGS)

# 4) Build eBay bulk CSV (add flags via ARGS="...")
build-csv:
	$(PY) app/build_csv.py $(ARGS)

# 5) Quick dashboard/report
report:
	$(PY) app/report.py

# 6) Move folders when listing status changes
watch:
	$(PY) app/state_watcher.py

# 7) Record a sale quickly (use `make add-sale SKU=POK/...`)
add-sale:
	$(PY) app/accounting.py add-sale $(SKU)

# 8) Freeze exact versions (optional)
freeze:
	$(PIP) freeze > requirements-lock.txt

reset-soft:
	@mkdir -p inbox/unsorted inbox/pending staged listed sold logs
	@find inbox/unsorted -type f -delete
	@find inbox/pending -mindepth 1 -maxdepth 1 -type d -exec rm -rf {} +
	@find staged -mindepth 1 -maxdepth 1 -type d -exec rm -rf {} +
	@find listed -mindepth 1 -maxdepth 1 -type d -exec rm -rf {} +
	@find sold -mindepth 1 -maxdepth 1 -type d -exec rm -rf {} +
	@sqlite3 db/pokeflip.sqlite "DELETE FROM images;"
	@: > logs/ingest.log
	@echo "✅ Soft reset complete."

reset-hard:
	@rm -f db/pokeflip.sqlite
	@$(PY) app/db_init.py
	@mkdir -p inbox/unsorted inbox/pending staged listed sold logs
	@find inbox/unsorted -type f -delete
	@find inbox/pending -mindepth 1 -maxdepth 1 -type d -exec rm -rf {} +
	@find staged -mindepth 1 -maxdepth 1 -type d -exec rm -rf {} +
	@find listed -mindepth 1 -maxdepth 1 -type d -exec rm -rf {} +
	@find sold -mindepth 1 -maxdepth 1 -type d -exec rm -rf {} +
	@: > logs/ingest.log
	@echo "🧨 Hard reset complete."
