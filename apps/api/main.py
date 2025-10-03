from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from apps.api.routes.health import router as health_router
from apps.api.routes.files import router as files_router

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