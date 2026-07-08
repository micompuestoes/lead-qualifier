"""
Generación del CSV de leads en el servidor (stdlib puro, sin dependencias).

Antes el CSV se montaba en el navegador sobre los primeros 500 leads cargados,
cortando en silencio. Ahora lo genera el backend con TODOS los leads que
cumplen los filtros, respetando la visibilidad por agente.
"""

import csv
import io

COLUMNAS = ["Nombre", "Email", "Teléfono", "Clasificación", "Score", "Estado", "Fecha", "Mensaje"]


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
            l.get("name") or "",
            l.get("email") or "",
            l.get("phone") or "",
            l.get("classification") or "",
            l.get("score") if l.get("score") is not None else "",
            l.get("status") or "",
            (l.get("created_at") or "")[:10],
            # Mensaje en una sola línea para no romper lectores de CSV básicos
            (l.get("message") or "").replace("\r\n", " ").replace("\n", " ").strip(),
        ])
    return "﻿" + buf.getvalue()
