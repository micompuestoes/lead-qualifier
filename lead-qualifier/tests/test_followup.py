"""
Tests de la plantilla del recordatorio de seguimiento ([services/email_sender.py]).

email_sender es stdlib puro, así que corren con solo pytest, como el resto.
La lógica de selección de candidatos (ventana de días, score, un solo envío)
vive en SQL y se verifica funcionalmente con la app real.
"""

from services.email_sender import build_followup_email


def test_asunto_incluye_agencia():
    asunto, _ = build_followup_email("María García", "Casas García")
    assert "Casas García" in asunto


def test_asunto_sin_agencia_no_deja_separador_colgando():
    asunto, _ = build_followup_email("María García", "")
    assert "·" not in asunto
    assert asunto.strip()


def test_cuerpo_personalizado_y_firmado():
    _, cuerpo = build_followup_email("María García", "Casas García")
    assert cuerpo.startswith("Hola María,")
    assert cuerpo.rstrip().endswith("Casas García")
    # Promesa clave del mensaje: solo se insiste una vez.
    assert "no volveremos a insistir" in cuerpo


def test_fallbacks_sin_nombre_ni_agencia():
    asunto, cuerpo = build_followup_email("", "")
    assert cuerpo.startswith("Hola de nuevo,")
    assert cuerpo.rstrip().endswith("el equipo")
    # Nada sin rellenar
    assert "{" not in cuerpo and "{" not in asunto
