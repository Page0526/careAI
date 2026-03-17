"""CareAI – FastAPI Main Application"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

from config import CORS_ORIGINS
from database import init_db
from routes import patients, observations, validation, fhir, agent, upload, dashboard


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    init_db()
    print("[CareAI] Server started. Database initialized.")
    yield
    # Shutdown
    print("[CareAI] Server shutting down.")


app = FastAPI(
    title="CareAI API",
    description="AI-powered EHR Data Validation for Pediatric Inpatient Nutrition",
    version="0.1.0",
    lifespan=lifespan,
    root_path="/hackathon",
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Routes
app.include_router(dashboard.router, prefix="/api", tags=["Dashboard"])
app.include_router(patients.router, prefix="/api", tags=["Patients"])
app.include_router(observations.router, prefix="/api", tags=["Observations"])
app.include_router(validation.router, prefix="/api", tags=["Validation"])
app.include_router(fhir.router, prefix="/api", tags=["FHIR"])
app.include_router(agent.router, prefix="/api", tags=["Agent"])
app.include_router(upload.router, prefix="/api", tags=["Upload"])


@app.get("/api/health")
async def health_check():
    return {"status": "ok", "service": "CareAI", "version": "0.1.0"}
