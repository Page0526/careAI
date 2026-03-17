"""CareAI Configuration"""
import os
from pathlib import Path

# Base paths
BASE_DIR = Path(__file__).resolve().parent
DATA_DIR = BASE_DIR / "data"
WHO_DIR = DATA_DIR / "who_tables"
KB_DIR = DATA_DIR / "knowledge_base"
DB_PATH = BASE_DIR / "careai.db"

# Database
DATABASE_URL = f"sqlite:///{DB_PATH}"

# Groq API
GROQ_API_KEY = os.getenv("GROQ_API_KEY", "")
GROQ_MODEL = "llama-3.3-70b-versatile"
GROQ_MAX_TOKENS = 2048
GROQ_TEMPERATURE = 0.3

# CORS
CORS_ORIGINS = [
    "http://localhost:3000",
    "http://localhost:3001",
    "https://mylab.io.vn",
]

# Validation thresholds
WEIGHT_MIN_KG = 0.3       # Minimum plausible weight (preterm neonate)
WEIGHT_MAX_KG = 150.0     # Maximum plausible pediatric weight
HEIGHT_MIN_CM = 25.0      # Minimum plausible height (preterm)
HEIGHT_MAX_CM = 200.0     # Maximum plausible pediatric height
ZSCORE_EXTREME = 5.0      # Z-score threshold for extreme values
MAX_WEIGHT_CHANGE_KG_DAY = 0.5  # Max plausible weight change per day (age-adjusted)
CARRIED_FORWARD_DAYS = 3  # Days of identical values to flag

# Alert severity levels
SEVERITY_CRITICAL = "critical"
SEVERITY_HIGH = "high"
SEVERITY_WARNING = "warning"
SEVERITY_INFO = "info"
