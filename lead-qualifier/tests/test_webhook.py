"""
Tests del webhook saliente a CRM: protección SSRF antes de hacer la petición.
La URL la elige el propio tenant, igual que el host IMAP (ver test_imap.py),
así que debe pasar por el mismo guard antes de que salga ninguna petición real.
"""

import pytest

from services.webhook import send_lead_webhook


@pytest.mark.parametrize("url", [
    "http://127.0.0.1/hook",
    "http://localhost:8000/hook",
    "http://169.254.169.254/latest/meta-data/",  # metadata de la nube
    "http://10.0.0.5/hook",
    "http://192.168.1.1/hook",
])
def test_send_lead_webhook_bloquea_hosts_no_permitidos(url, monkeypatch):
    def _no_deberia_llamarse(*a, **kw):
        raise AssertionError("no debería llegar a hacer la petición HTTP")
    monkeypatch.setattr("services.webhook.httpx.post", _no_deberia_llamarse)
    send_lead_webhook(url, {"lead": "x"})  # no lanza — falla en silencio (background task)


@pytest.mark.parametrize("url", [
    "ftp://8.8.8.8/hook",
    "javascript:alert(1)",
    "not-a-url",
])
def test_send_lead_webhook_bloquea_esquemas_invalidos(url, monkeypatch):
    def _no_deberia_llamarse(*a, **kw):
        raise AssertionError("no debería llegar a hacer la petición HTTP")
    monkeypatch.setattr("services.webhook.httpx.post", _no_deberia_llamarse)
    send_lead_webhook(url, {"lead": "x"})


def test_send_lead_webhook_permite_host_publico(monkeypatch):
    llamadas = []
    class _Resp:
        status_code = 200
    def _post(url, json, timeout, follow_redirects):
        llamadas.append((url, json, follow_redirects))
        return _Resp()
    monkeypatch.setattr("services.webhook.httpx.post", _post)

    send_lead_webhook("https://8.8.8.8/lead", {"lead": "x"})

    assert len(llamadas) == 1
    assert llamadas[0][2] is False  # follow_redirects=False — sin esto un host
    # público que redirige a uno interno colaría igualmente el SSRF
