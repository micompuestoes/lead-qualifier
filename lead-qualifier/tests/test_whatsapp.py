"""
Tests del módulo de WhatsApp ([services/whatsapp.py]).

Cubren la normalización de teléfonos y el gating por configuración. No tocan red:
`httpx` se importa de forma perezosa en el módulo, así que estos tests corren
con solo `pytest` (igual que los del scoring).
"""

import pytest

from services.whatsapp import normalize_phone, whatsapp_configured


@pytest.mark.parametrize("entrada, esperado", [
    ("+34 600 11 22 33", "34600112233"),   # internacional con espacios
    ("600112233",        "34600112233"),   # nacional de 9 dígitos → añade prefijo ES
    ("0034600112233",    "34600112233"),   # prefijo 00
    ("+1 415 555 2671",  "14155552671"),   # otro país
    ("+34-600-112-233",  "34600112233"),   # separadores variados
])
def test_normalize_phone_validos(entrada, esperado):
    assert normalize_phone(entrada) == esperado


@pytest.mark.parametrize("entrada", [
    None,        # nada
    "",          # vacío
    "   ",       # espacios
    "abc",       # sin dígitos
    "12345",     # demasiado corto y sin prefijo
])
def test_normalize_phone_invalidos(entrada):
    assert normalize_phone(entrada) is None


def test_whatsapp_no_configurado_por_defecto(monkeypatch):
    monkeypatch.delenv("WHATSAPP_TOKEN", raising=False)
    monkeypatch.delenv("WHATSAPP_PHONE_ID", raising=False)
    assert whatsapp_configured() is False


def test_whatsapp_requiere_ambas_credenciales(monkeypatch):
    monkeypatch.setenv("WHATSAPP_TOKEN", "tok")
    monkeypatch.delenv("WHATSAPP_PHONE_ID", raising=False)
    assert whatsapp_configured() is False

    monkeypatch.setenv("WHATSAPP_PHONE_ID", "123")
    assert whatsapp_configured() is True


def test_send_hot_lead_alert_noop_si_no_configurado(monkeypatch):
    # Sin credenciales no debe intentar nada ni lanzar: devuelve False.
    monkeypatch.delenv("WHATSAPP_TOKEN", raising=False)
    monkeypatch.delenv("WHATSAPP_PHONE_ID", raising=False)
    from services.whatsapp import send_hot_lead_alert
    assert send_hot_lead_alert("+34600112233", "Ana", "+34600000000", 9, "CALIENTE") is False
