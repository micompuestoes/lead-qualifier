"""Script de prueba rápida — ejecuta el agente sin FastAPI."""
import json
import logging
import os
from pathlib import Path
from dotenv import load_dotenv

load_dotenv(dotenv_path=Path(__file__).parent / ".env", override=True)

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s", datefmt="%H:%M:%S")

from agent import qualify_lead, _make_anthropic_client
from database import init_db

init_db()
client = _make_anthropic_client(os.getenv("ANTHROPIC_API_KEY"))

lead = {
    "name": "María García",
    "email": "maria@inmobiliariabarcelona.com",
    "phone": "+34 600 000 000",
    "message": "Hola, somos una inmobiliaria con 5 agentes y necesitamos automatizar el seguimiento de leads. Tenemos urgencia porque estamos perdiendo clientes por falta de respuesta rápida."
}

print("\n" + "="*60)
print("TEST: Lead CALIENTE - inmobiliaria con urgencia")
print("="*60)

result = qualify_lead(
    name=lead["name"],
    email=lead["email"],
    phone=lead["phone"],
    message=lead["message"],
    anthropic_client=client,
)

print("\nRESULTADO:")
print(json.dumps(result, ensure_ascii=True, indent=2))
