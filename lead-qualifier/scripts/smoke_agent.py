"""Script de prueba rápida — ejecuta el agente sin FastAPI."""
import json
import logging
import os
import sys
from pathlib import Path

# Permite importar módulos del directorio padre (lead-qualifier/)
sys.path.insert(0, str(Path(__file__).parent.parent))

from dotenv import load_dotenv
load_dotenv(dotenv_path=Path(__file__).parent.parent / ".env", override=True)

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s", datefmt="%H:%M:%S")

from core.agent import qualify_lead, _make_anthropic_client
from core.database import init_db

init_db()
client = _make_anthropic_client(os.getenv("ANTHROPIC_API_KEY"))

lead = {
    "name": "María García",
    "email": "maria.garcia@gmail.com",
    "phone": "+34 600 000 000",
    "message": "Hola, busco un piso de 3 habitaciones con terraza en la zona del Eixample, en Barcelona. Tengo la hipoteca preaprobada y un presupuesto de hasta 480.000 €. Me gustaría poder visitar opciones esta misma semana.",
}

print("\n" + "="*60)
print("TEST: Lead CALIENTE - comprador con presupuesto y financiación")
print("="*60)

result = qualify_lead(
    name=lead["name"],
    email=lead["email"],
    phone=lead["phone"],
    message=lead["message"],
    anthropic_client=client,
    agency_name="Inmobiliaria Barcelona",
)

print("\nRESULTADO:")
print(json.dumps(result, ensure_ascii=True, indent=2))
