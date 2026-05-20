"""
Modelos Pydantic para validación de datos de entrada y salida de la API.
"""

from pydantic import BaseModel, EmailStr, Field
from typing import Optional, List
from datetime import datetime
from enum import Enum


class Clasificacion(str, Enum):
    CALIENTE = "CALIENTE"
    TIBIO = "TIBIO"
    FRIO = "FRÍO"


class LeadInput(BaseModel):
    """Datos que llegan desde el formulario web."""
    name: str = Field(..., min_length=2, max_length=100, description="Nombre completo del lead")
    email: EmailStr = Field(..., description="Email de contacto")
    phone: Optional[str] = Field(None, max_length=20, description="Teléfono de contacto")
    message: str = Field(..., min_length=5, max_length=2000, description="Mensaje del lead")


class IntentAnalysis(BaseModel):
    """Resultado del análisis de intención del mensaje."""
    intention: str
    urgency: str  # alta, media, baja
    keywords: List[str]
    message_quality: str  # claro, vago, muy_vago


class CompanyInfo(BaseModel):
    """Información inferida del dominio de email."""
    domain: str
    is_personal_email: bool  # Gmail, Hotmail, Yahoo, etc.
    company_name: Optional[str] = None
    estimated_sector: Optional[str] = None
    estimated_size: Optional[str] = None  # micro, pequeña, mediana, grande


class LeadScore(BaseModel):
    """Puntuación y clasificación del lead."""
    score: int = Field(..., ge=1, le=10)
    classification: Clasificacion
    reasoning: str
    recommended_actions: List[str]


class LeadOutput(BaseModel):
    """Respuesta completa que devuelve la API al procesar un lead."""
    lead_id: str
    classification: Clasificacion
    score: int
    reasoning: str
    generated_email: str
    recommended_actions: List[str]
    processed_at: datetime


class LeadRecord(BaseModel):
    """Registro completo almacenado en base de datos."""
    id: str
    name: str
    email: str
    phone: Optional[str]
    message: str
    classification: Optional[str]
    score: Optional[int]
    reasoning: Optional[str]
    generated_email: Optional[str]
    recommended_actions: Optional[str]  # JSON string en BD
    created_at: datetime
    processed_at: Optional[datetime]
