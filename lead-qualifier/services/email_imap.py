"""
Módulo IMAP — lee emails no leídos de la bandeja del tenant
y los convierte en datos de lead para el qualifier.

Diseño:
  - imaplib (stdlib) → sin dependencias extra
  - Toda la I/O IMAP es bloqueante → se llama desde run_in_executor()
  - Solo se procesan emails con remitentes reales (se filtran noreply, etc.)
"""

import email
import imaplib
import logging
from email.header import decode_header
from email.utils import parseaddr
from typing import Callable

logger = logging.getLogger(__name__)

# Mapa de dominios conocidos → servidor IMAP
_IMAP_MAP: dict[str, tuple[str, int]] = {
    "gmail.com":       ("imap.gmail.com",            993),
    "googlemail.com":  ("imap.gmail.com",            993),
    "outlook.com":     ("outlook.office365.com",     993),
    "hotmail.com":     ("outlook.office365.com",     993),
    "hotmail.es":      ("outlook.office365.com",     993),
    "live.com":        ("outlook.office365.com",     993),
    "msn.com":         ("outlook.office365.com",     993),
    "yahoo.com":       ("imap.mail.yahoo.com",       993),
    "yahoo.es":        ("imap.mail.yahoo.com",       993),
    "icloud.com":      ("imap.mail.me.com",          993),
    "me.com":          ("imap.mail.me.com",          993),
}

# Palabras que indican email automático — se descartan
_NO_REPLY = {
    "noreply", "no-reply", "no_reply", "donotreply",
    "mailer-daemon", "postmaster", "bounce", "autoresponder",
    "notifications", "newsletter", "unsubscribe",
}


def detectar_servidor_imap(email_addr: str) -> tuple[str, int]:
    """
    Detecta automáticamente el servidor IMAP a partir del dominio.
    Para dominios desconocidos intenta imap.<dominio>:993.
    """
    try:
        domain = email_addr.strip().split("@")[1].lower()
    except IndexError:
        return ("", 993)
    return _IMAP_MAP.get(domain, (f"imap.{domain}", 993))


def _decodificar_header(valor: str | None) -> str:
    """Decodifica cabeceras MIME (puede venir en base64, quoted-printable, etc.)."""
    if not valor:
        return ""
    partes = decode_header(valor)
    resultado = []
    for fragmento, charset in partes:
        if isinstance(fragmento, bytes):
            resultado.append(fragmento.decode(charset or "utf-8", errors="replace"))
        else:
            resultado.append(str(fragmento))
    return "".join(resultado).strip()


def _extraer_cuerpo(msg: email.message.Message) -> str:
    """Extrae el cuerpo en texto plano del email."""
    if msg.is_multipart():
        for part in msg.walk():
            content_type = part.get_content_type()
            disposition = str(part.get("Content-Disposition", ""))
            if content_type == "text/plain" and "attachment" not in disposition:
                try:
                    charset = part.get_content_charset() or "utf-8"
                    return part.get_payload(decode=True).decode(charset, errors="replace").strip()
                except Exception:
                    continue
        return ""
    else:
        try:
            charset = msg.get_content_charset() or "utf-8"
            return msg.get_payload(decode=True).decode(charset, errors="replace").strip()
        except Exception:
            return str(msg.get_payload())


def _es_automatico(email_addr: str) -> bool:
    """Devuelve True si el remitente parece ser un sistema automático."""
    addr_lower = email_addr.lower()
    return any(keyword in addr_lower for keyword in _NO_REPLY)


def parsear_email_raw(raw: bytes) -> dict | None:
    """
    Parsea un email crudo (bytes RFC822) y devuelve
    {name, email, message} listo para el qualifier, o None si no es válido.
    """
    try:
        msg = email.message_from_bytes(raw)

        from_raw = msg.get("From", "")
        nombre_raw, addr = parseaddr(from_raw)
        addr = addr.strip().lower()

        if not addr or "@" not in addr:
            return None
        if _es_automatico(addr):
            logger.debug("Email automático ignorado: %s", addr)
            return None

        nombre = _decodificar_header(nombre_raw) or addr.split("@")[0]
        if len(nombre) < 2:
            # LeadInput exige name >= 2 caracteres — una parte local de 1
            # carácter (ej. "a@dominio.com") no debe descartar el lead.
            nombre = addr
        asunto = _decodificar_header(msg.get("Subject", ""))
        cuerpo = _extraer_cuerpo(msg)

        if not cuerpo and not asunto:
            return None

        # Montamos el mensaje para el qualifier: asunto + cuerpo.
        # Cap alineado con LeadInput.message (max_length=2000): un mensaje
        # más largo que el límite de validación provocaría un ValidationError
        # aguas abajo y, sin este alineamiento, se perdería el lead.
        mensaje = f"Asunto: {asunto}\n\n{cuerpo}" if asunto else cuerpo
        mensaje = mensaje[:2000]
        if len(mensaje) < 5:
            # LeadInput exige message >= 5 caracteres.
            mensaje = mensaje.ljust(5, ".")

        return {"name": nombre, "email": addr, "message": mensaje}

    except Exception as exc:
        logger.error("Error parseando email raw: %s", exc)
        return None


# ── Operaciones IMAP (bloqueantes — llamar desde run_in_executor) ─────────────

def conectar(host: str, port: int, user: str, password: str) -> imaplib.IMAP4_SSL:
    """Abre conexión IMAP SSL y hace login. Lanza excepción si falla."""
    imap = imaplib.IMAP4_SSL(host, port)
    imap.login(user, password)
    return imap


def obtener_no_leidos(
    host: str, port: int, user: str, password: str,
    procesar: Callable[[dict], bool] | None = None,
) -> list[dict]:
    """
    Conecta, obtiene todos los emails no leídos y, por cada uno que se
    parsea correctamente, llama a `procesar(datos)` (si se pasa).

    Un email solo se marca como \\Seen si `procesar` devuelve True (o si no
    se pasa `procesar`, comportamiento antiguo). Si `procesar` devuelve
    False o lanza una excepción no controlada por él mismo, el email queda
    SIN LEER para reintentarse en el siguiente sync — así un fallo transitorio
    (API caída, red, etc.) al cualificar el lead no lo pierde para siempre.

    Devuelve la lista de {name, email, message} procesados con éxito.
    """
    resultados: list[dict] = []
    imap = None
    try:
        imap = conectar(host, port, user, password)
        imap.select("INBOX")

        _, nums = imap.search(None, "UNSEEN")
        if not nums or not nums[0]:
            return resultados

        for num in nums[0].split():
            try:
                _, data = imap.fetch(num, "(RFC822)")
                raw = data[0][1]
                parsed = parsear_email_raw(raw)
                if not parsed:
                    # No es un lead válido (automático, vacío...): no hay
                    # nada que reintentar, se marca leído para no repasarlo.
                    imap.store(num, "+FLAGS", "\\Seen")
                    continue

                ok = procesar(parsed) if procesar else True
                if ok:
                    resultados.append(parsed)
                    imap.store(num, "+FLAGS", "\\Seen")
                else:
                    logger.warning(
                        "No se pudo procesar el email de %s — queda sin leer, se reintentará",
                        parsed.get("email"),
                    )
            except Exception as exc:
                logger.error("Error procesando email #%s: %s", num, exc)

    except imaplib.IMAP4.error as exc:
        raise RuntimeError(f"Error IMAP: {exc}") from exc
    finally:
        if imap:
            try:
                imap.close()
                imap.logout()
            except Exception:
                pass

    return resultados


def verificar_conexion(host: str, port: int, user: str, password: str) -> None:
    """Prueba la conexión IMAP. Lanza RuntimeError si falla."""
    try:
        imap = conectar(host, port, user, password)
        imap.logout()
    except imaplib.IMAP4.error as exc:
        raise RuntimeError(f"Credenciales incorrectas o servidor no accesible: {exc}") from exc
    except OSError as exc:
        raise RuntimeError(f"No se pudo conectar a {host}:{port} — {exc}") from exc
