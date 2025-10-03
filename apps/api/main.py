from fastapi import FastAPI
from apps.api.routes.health import router as health_router

app = FastAPI(title="Pokeflip API")
app.include_router(health_router)