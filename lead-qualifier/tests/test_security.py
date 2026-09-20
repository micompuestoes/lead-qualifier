"""
Tests de las primitivas de seguridad: cifrado Fernet y su política de claves,
IP real del cliente (X-Forwarded-For) y rate limiting persistido en BD.

El cifrado con la clave por defecto de desarrollo equivale a guardar las
contraseñas IMAP en claro (la clave está en el repo), así que solo se permite
en DEV_MODE explícito.
"""

import pytest
from fastapi import Request

from security import _fernet, cifrar, client_ip, descifrar, rate_limited


def _sin_claves(monkeypatch):
    monkeypatch.delenv("FERNET_KEY", raising=False)
    monkeypatch.delenv("ADMIN_SECRET_KEY", raising=False)


def test_fernet_rechaza_clave_por_defecto_fuera_de_dev(monkeypatch):
    _sin_claves(monkeypatch)
    monkeypatch.delenv("DEV_MODE", raising=False)
    with pytest.raises(RuntimeError):
        _fernet()


def test_fernet_roundtrip_en_dev_mode(monkeypatch):
    _sin_claves(monkeypatch)
    monkeypatch.setenv("DEV_MODE", "1")
    assert descifrar(cifrar("secreto-imap")) == "secreto-imap"


def test_fernet_con_admin_secret_key_sin_dev_mode(monkeypatch):
    """Con ADMIN_SECRET_KEY real (instalaciones antiguas) sigue funcionando."""
    monkeypatch.delenv("FERNET_KEY", raising=False)
    monkeypatch.delenv("DEV_MODE", raising=False)
    monkeypatch.setenv("ADMIN_SECRET_KEY", "una-clave-de-produccion-larga")
    assert descifrar(cifrar("secreto-imap")) == "secreto-imap"


# ── IP real del cliente (X-Forwarded-For) ──────────────────────────────────

def _request(headers: list[tuple[bytes, bytes]] = ()) -> Request:
    scope = {
        "type": "http", "method": "GET", "path": "/",
        "headers": list(headers), "client": ("10.0.0.1", 1234),
    }
    return Request(scope)


def test_client_ip_usa_el_ultimo_valor_de_xff():
    """
    El primer valor de X-Forwarded-For lo puede inventar el propio cliente;
    el ÚLTIMO es el que añade nuestro proxy de confianza justo antes de
    reenviarnos la petición, así que es el único en el que se puede confiar
    para el rate limiting del formulario público.
    """
    req = _request([(b"x-forwarded-for", b"1.2.3.4, 5.6.7.8, 9.9.9.9")])
    assert client_ip(req) == "9.9.9.9"


def test_client_ip_sin_cabecera_usa_client_host():
    assert client_ip(_request()) == "10.0.0.1"


# ── Rate limiting persistido en BD ─────────────────────────────────────────

def test_rate_limited_bloquea_al_superar_el_limite_por_minuto(client):
    bucket = "test-bucket-min-9f3a"
    for _ in range(3):
        assert rate_limited(bucket, per_min=3, per_hour=100) is False
    assert rate_limited(bucket, per_min=3, per_hour=100) is True


def test_rate_limited_buckets_independientes(client):
    assert rate_limited("test-bucket-a-9f3a", per_min=1, per_hour=100) is False
    assert rate_limited("test-bucket-a-9f3a", per_min=1, per_hour=100) is True
    # Un bucket distinto no se ve afectado por el que ya se saturó.
    assert rate_limited("test-bucket-b-9f3a", per_min=1, per_hour=100) is False


def test_rate_limited_respeta_el_limite_diario_opcional(client):
    """per_day es opcional (pensado para un bucket global, ver /demo/qualify)
    — con un per_min/per_hour generosos, el que debe frenar es el diario."""
    bucket = "test-bucket-diario-9f3a"
    assert rate_limited(bucket, per_min=100, per_hour=100, per_day=1) is False
    assert rate_limited(bucket, per_min=100, per_hour=100, per_day=1) is True


def test_rate_limited_sin_per_day_no_comprueba_limite_diario(client):
    """Omitir per_day (comportamiento por defecto) no debe activar ningún
    límite diario implícito — los llamantes existentes no cambian de golpe."""
    bucket = "test-bucket-sin-diario-9f3a"
    for _ in range(5):
        assert rate_limited(bucket, per_min=100, per_hour=100) is False
