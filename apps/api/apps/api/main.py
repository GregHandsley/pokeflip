from fastapi import FastAPI

app = FastAPI(title="Pokeflip API")

@app.get("/health/live")
def health_live():
    return {"status": "ok"}
