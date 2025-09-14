from __future__ import annotations
from fastapi import FastAPI, Request
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles

from app.common.paths import project_root
from .deps import templates, counts
from .routes_upload import router as upload_router
from .routes_ingest import router as ingest_router
from .routes_review import router as review_router
from .routes_cards import router as cards_router
from app.ui.routes_sales import router as sales_router

app = FastAPI(title="Pokeflip UI")

# static + files
app.mount("/static", StaticFiles(directory=str(project_root() / "static")), name="static")
app.mount("/files",  StaticFiles(directory=str(project_root().resolve())), name="files")

# dashboard
@app.get("/", response_class=HTMLResponse)
def dashboard(request: Request):
    return templates.TemplateResponse("ui/dashboard.html", {"request": request, "counts": counts()})

# routes
app.include_router(upload_router)
app.include_router(ingest_router)
app.include_router(review_router)
app.include_router(cards_router)
app.include_router(sales_router)
