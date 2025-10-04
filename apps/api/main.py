from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from apps.api.routes.health import router as health_router
from apps.api.routes.files import router as files_router
from apps.api.routes.ingest import router as ingest_router
from apps.api.routes.pending import router as pending_router
from apps.api.routes.pending_stage import router as pending_stage_router
from apps.api.routes.cards import router as cards_router

app = FastAPI(title="Pokeflip API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],  # dev UI
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health_router)
app.include_router(files_router)
app.include_router(ingest_router)
app.include_router(pending_router)
app.include_router(pending_stage_router)
app.include_router(cards_router)