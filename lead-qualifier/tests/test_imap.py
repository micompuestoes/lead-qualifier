"""
Tests de la integración IMAP: protección SSRF al conectar, la política de
'\\Seen' que evita perder leads en un fallo transitorio, y el router
/me/imap (gate de plan, guardado, verificación de credenciales).
"""

import email.message

import pytest

from core.database import set_tenant_plan
from services.email_imap import (
    _validar_host_seguro, conectar, obtener_no_leidos, parsear_email_raw,
)

T = "dev-tenant"


# ── SSRF: no se permite conectar a IPs privadas/locales/reservadas ────────────

@pytest.mark.parametrize("host", [
    "127.0.0.1",       # loopback
    "localhost",       # loopback
    "169.254.169.254", # metadata de la nube (AWS/GCP/Azure)
    "10.0.0.5",        # rango privado
    "192.168.1.1",     # rango privado
    "0.0.0.0",         # sin especificar
])
def test_validar_host_seguro_rechaza_ips_no_permitidas(host):
    with pytest.raises(RuntimeError):
        _validar_host_seguro(host, 993)


def test_validar_host_seguro_permite_ip_publica():
    _validar_host_seguro("8.8.8.8", 993)  # no lanza


def test_validar_host_seguro_rechaza_dominio_que_no_resuelve():
    with pytest.raises(RuntimeError):
        _validar_host_seguro("este-dominio-no-existe-de-verdad.invalid", 993)


def test_conectar_corta_antes_de_abrir_el_socket_imap(monkeypatch):
    """La validación SSRF debe ocurrir ANTES de intentar el login IMAP real."""
    def _no_deberia_llamarse(*a, **kw):
        raise AssertionError("no debería intentar abrir conexión IMAP")

    monkeypatch.setattr("services.email_imap.imaplib.IMAP4_SSL", _no_deberia_llamarse)
    with pytest.raises(RuntimeError):
        conectar("127.0.0.1", 993, "user", "pass")


# ── Parseo de emails: límites alineados con LeadInput ──────────────────────────

def _email_bytes(from_addr: str, subject: str, body: str) -> bytes:
    msg = email.message.EmailMessage()
    msg["From"] = from_addr
    msg["Subject"] = subject
    msg.set_content(body)
    return msg.as_bytes()


def test_parsear_nombre_de_1_caracter_no_se_pierde():
    """LeadInput exige name >= 2 caracteres; una parte local de 1 char no
    debe hacer que el lead se descarte más adelante por validación."""
    raw = _email_bytes("a@dominio.com", "Consulta", "Hola, quiero información")
    parsed = parsear_email_raw(raw)
    assert parsed is not None
    assert len(parsed["name"]) >= 2


def test_parsear_mensaje_se_recorta_alineado_con_leadinput():
    """El cap debe coincidir con LeadInput.message (max_length=2000): antes
    era 3000, lo que provocaba un ValidationError silencioso aguas abajo."""
    raw = _email_bytes("cliente@dominio.com", "", "x" * 5000)
    parsed = parsear_email_raw(raw)
    assert len(parsed["message"]) <= 2000


def test_parsear_mensaje_muy_corto_cumple_minimo_de_leadinput():
    raw = _email_bytes("cliente@dominio.com", "", "hi")
    parsed = parsear_email_raw(raw)
    assert len(parsed["message"]) >= 5


# ── Fallback a HTML: portales sin alternativa en texto plano ──────────────────
# Bug real: los avisos de idealista/Fotocasa (y muchos portales) suelen venir
# solo en HTML maquetado, sin parte text/plain — antes de este fix, esos leads
# se descartaban en silencio (parsear_email_raw devolvía None).

def _email_html_bytes(from_addr: str, subject: str, html: str) -> bytes:
    """Email de una sola parte, SOLO text/html (sin alternativa en texto plano)."""
    msg = email.message.EmailMessage()
    msg["From"] = from_addr
    msg["Subject"] = subject
    msg.set_content(html, subtype="html")
    return msg.as_bytes()


def test_parsear_email_solo_html_no_se_descarta():
    html = "<html><body><p>Hola,</p><p>Busco piso de 3 habitaciones en Bilbao, presupuesto 250.000€.</p></body></html>"
    raw = _email_html_bytes("contacto@portal-inmobiliario.example", "Nuevo contacto", html)
    parsed = parsear_email_raw(raw)
    assert parsed is not None
    assert "piso de 3 habitaciones" in parsed["message"]
    assert "<p>" not in parsed["message"]


def test_parsear_email_html_ignora_script_y_style():
    html = (
        "<html><head><style>.x{color:red}</style></head><body>"
        "<script>trackClick();</script>"
        "<p>Quiero información sobre un ático en Valencia.</p>"
        "</body></html>"
    )
    raw = _email_html_bytes("contacto@portal-inmobiliario.example", "", html)
    parsed = parsear_email_raw(raw)
    assert parsed is not None
    assert "ático en Valencia" in parsed["message"]
    assert "trackClick" not in parsed["message"]
    assert "color:red" not in parsed["message"]


def test_parsear_email_multipart_solo_html_usa_el_fallback():
    """multipart/mixed o multipart/related con SOLO una parte text/html
    (sin text/plain) — habitual cuando el correo lleva imágenes embebidas."""
    msg = email.message.EmailMessage()
    msg["From"] = "avisos@portal.example"
    msg["Subject"] = "Contacto recibido"
    msg.add_alternative(
        "<html><body><p>Interesado en alquilar un local en Sevilla.</p></body></html>",
        subtype="html",
    )
    parsed = parsear_email_raw(msg.as_bytes())
    assert parsed is not None
    assert "alquilar un local en Sevilla" in parsed["message"]


def test_parsear_email_prefiere_text_plain_si_existe():
    """Si el email SÍ trae text/plain, se sigue usando esa parte tal cual
    (sin pasar por el parser de HTML) — el fallback es solo para cuando falta."""
    msg = email.message.EmailMessage()
    msg["From"] = "cliente@dominio.com"
    msg["Subject"] = "Consulta"
    msg.set_content("Texto plano de verdad.")
    msg.add_alternative("<html><body><p>Versión en HTML, no debería usarse.</p></body></html>", subtype="html")
    parsed = parsear_email_raw(msg.as_bytes())
    assert parsed is not None
    assert "Texto plano de verdad" in parsed["message"]
    assert "no debería usarse" not in parsed["message"]


# ── obtener_no_leidos: solo marca \\Seen si el procesamiento tuvo éxito ────────

class _FakeImap:
    """IMAP falso: simula un buzón con mensajes numerados y registra qué
    números se marcaron como leídos (\\Seen)."""

    def __init__(self, mensajes: dict[int, bytes]):
        self._mensajes = mensajes
        self.marcados: list[int] = []

    def select(self, box):
        pass

    def search(self, charset, criterio):
        nums = b" ".join(str(n).encode() for n in self._mensajes)
        return ("OK", [nums])

    def fetch(self, num, spec):
        return ("OK", [(None, self._mensajes[int(num)])])

    def store(self, num, flag, valor):
        self.marcados.append(int(num))

    def close(self):
        pass

    def logout(self):
        pass


def test_obtener_no_leidos_no_marca_leido_si_procesar_falla(monkeypatch):
    raw_ok  = _email_bytes("ok@dominio.com", "Asunto", "Mensaje válido y suficientemente largo")
    raw_bad = _email_bytes("falla@dominio.com", "Asunto", "Mensaje válido y suficientemente largo")
    fake = _FakeImap({1: raw_ok, 2: raw_bad})
    monkeypatch.setattr("services.email_imap.conectar", lambda *a, **kw: fake)

    def procesar(datos: dict) -> bool:
        # Simula un fallo transitorio (p. ej. la IA caída) solo para uno.
        return datos["email"] != "falla@dominio.com"

    resultados = obtener_no_leidos("host", 993, "u", "p", procesar)

    assert {r["email"] for r in resultados} == {"ok@dominio.com"}
    # El que falló NO se marca como leído: se reintentará en el siguiente sync.
    assert fake.marcados == [1]


def test_obtener_no_leidos_sin_callback_marca_todo_como_antes(monkeypatch):
    """Compatibilidad: sin `procesar`, se comporta como antes (todo se marca)."""
    raw = _email_bytes("x@dominio.com", "Asunto", "Mensaje válido y suficientemente largo")
    fake = _FakeImap({1: raw})
    monkeypatch.setattr("services.email_imap.conectar", lambda *a, **kw: fake)

    resultados = obtener_no_leidos("host", 993, "u", "p")
    assert len(resultados) == 1
    assert fake.marcados == [1]


# ── Router /me/imap: gate de plan, guardado y verificación ────────────────────

def test_imap_requiere_plan_pro(client):
    set_tenant_plan(T, "free")
    assert client.post("/me/imap", json={"email": "x@gmail.com", "password": "pw"}).status_code == 403
    assert client.delete("/me/imap").status_code == 403


def test_imap_guarda_verifica_y_borra(client, monkeypatch):
    set_tenant_plan(T, "pro")
    monkeypatch.setattr("routers.imap.verificar_conexion", lambda *a, **kw: None)

    r = client.post("/me/imap", json={"email": "agencia@gmail.com", "password": "pw"})
    assert r.status_code == 200
    assert r.json()["host"] == "imap.gmail.com"  # autodetectado por dominio

    cfg = client.get("/me/imap").json()
    assert cfg["configured"] is True and cfg["user"] == "agencia@gmail.com"

    assert client.delete("/me/imap").status_code == 204
    assert client.get("/me/imap").json()["configured"] is False


def test_imap_credenciales_invalidas_da_400(client, monkeypatch):
    set_tenant_plan(T, "pro")

    def _falla(*a, **kw):
        raise RuntimeError("Credenciales incorrectas o servidor no accesible")

    monkeypatch.setattr("routers.imap.verificar_conexion", _falla)
    r = client.post("/me/imap", json={"email": "agencia@gmail.com", "password": "mala"})
    assert r.status_code == 400

    set_tenant_plan(T, "free")  # dejar el estado limpio para el resto de tests
