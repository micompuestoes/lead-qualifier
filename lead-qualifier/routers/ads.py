"""Generador de anuncios inmobiliarios con IA (plan agencia)."""

import json
import logging
from typing import Optional

import anthropic
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from deps import get_anthropic_client, get_tenant_id, require_plan

logger = logging.getLogger(__name__)

router = APIRouter(tags=["anuncios"])


class AdInput(BaseModel):
    tipo:   str
    op:     str
    ubi:    str
    m2:     Optional[str] = None
    hab:    Optional[str] = None
    ban:    Optional[str] = None
    precio: Optional[str] = None
    extras: list[str] = []
    notas:  Optional[str] = None
    canales: list[str] = ["idealista", "rrss", "email"]


@router.post("/generate-ad")
async def generate_ad(
    data: AdInput,
    tenant_id: str = Depends(get_tenant_id),
):
    """Genera anuncios inmobiliarios para Idealista, RRSS y Email — solo plan agencia."""
    require_plan(tenant_id, "agencia")

    canales_validos = [c for c in data.canales if c in ("idealista", "rrss", "email")]
    if not canales_validos:
        raise HTTPException(status_code=400, detail="Selecciona al menos un canal")

    reglas = {
        "idealista": "tono profesional y descriptivo. Body máximo 1700 caracteres.",
        "rrss":      "tono dinámico y cercano, puede usar emojis con moderación. Body máximo 450 caracteres.",
        "email":     "tono consultivo/comercial, claro y directo. Body máximo 450 caracteres.",
    }
    reglas_texto = "\n".join(
        f"- {c}: {reglas[c]}" for c in canales_validos
    )

    extras_str = ", ".join(data.extras) if data.extras else "ninguno"
    prompt = f"""Eres un redactor inmobiliario senior especializado en el mercado español.
Genera borradores para cada canal solicitado, con estilo específico y límites de longitud.

Devuelve EXCLUSIVAMENTE un JSON válido, sin markdown, sin comentarios, sin texto extra.
Estructura esperada:
{{
  "drafts": {{
    "idealista": {{"titulo": "string", "body": "string"}},
    "rrss":      {{"titulo": "string", "body": "string"}},
    "email":     {{"titulo": "string", "body": "string"}}
  }}
}}
Incluye solo las claves de canales solicitados.

Reglas por canal:
{reglas_texto}

Datos del inmueble:
Tipo: {data.tipo or "no definido"}
Operación: {data.op or "no definido"}
Ubicación: {data.ubi or "no definida"}
m2: {data.m2 or "no definido"}
Habitaciones: {data.hab or "no definido"}
Baños: {data.ban or "no definido"}
Precio: {data.precio or "no definido"}
Extras: {extras_str}
Notas del agente: {data.notas or "sin notas adicionales"}
Canales solicitados: {", ".join(canales_validos)}
"""

    try:
        client = get_anthropic_client()
        message = client.messages.create(
            model="claude-haiku-4-5",
            max_tokens=1500,
            messages=[{"role": "user", "content": prompt}],
        )
        raw = message.content[0].text.strip()

        # Extraer JSON aunque venga envuelto en markdown
        if "```" in raw:
            raw = raw.split("```")[1]
            if raw.startswith("json"):
                raw = raw[4:]

        result = json.loads(raw)
        return result

    except json.JSONDecodeError as e:
        raise HTTPException(status_code=500, detail=f"Error al parsear respuesta de IA: {str(e)}")
    except anthropic.AuthenticationError:
        raise HTTPException(status_code=500, detail="API key de Anthropic inválida")
    except Exception as e:
        logger.exception("Error en generador de anuncios: %s", str(e))
        raise HTTPException(status_code=500, detail="Error interno al generar el anuncio")
