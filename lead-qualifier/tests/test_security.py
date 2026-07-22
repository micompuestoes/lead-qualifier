"""
Tests de las primitivas de seguridad: cifrado Fernet y su política de claves.

El cifrado con la clave por defecto de desarrollo equivale a guardar las
contraseñas IMAP en claro (la clave está en el repo), así que solo se permite
en DEV_MODE explícito.
"""

import pytest

from security import _fernet, cifrar, descifrar


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
