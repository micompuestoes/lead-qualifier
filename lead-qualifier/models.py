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


class LeadOutput(BaseModel):
    """Respuesta completa que devuelve la API al procesar un lead."""
    lead_id: str
    classification: Clasificacion
    score: int
    reasoning: str
    generated_email: str
    recommended_actions: List[str]
    # False → el email quedó como borrador (el tenant revisa antes de enviar)
    email_sent: Optional[bool] = None
    processed_at: datetime
