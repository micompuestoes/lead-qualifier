"""Tests del generador de CSV ([core/csv_export.py]) — stdlib puro, sin deps."""

import csv
import io

from core.csv_export import COLUMNAS, leads_to_csv


def _parsear(texto: str) -> list:
    """Parsea el CSV generado (quitando el BOM) para verificar el contenido."""
    return list(csv.reader(io.StringIO(texto.lstrip("﻿"))))


def test_empieza_con_bom_para_excel():
    assert leads_to_csv([]).startswith("﻿")


def test_sin_leads_solo_cabecera():
    filas = _parsear(leads_to_csv([]))
    assert filas == [COLUMNAS]


def test_campos_con_comas_y_comillas_sobreviven():
    lead = {
        "name": 'Ana "La Rápida" Pérez', "email": "ana@x.com", "phone": "+34 600,111",
        "classification": "CALIENTE", "score": 9, "status": "PENDIENTE",
        "created_at": "2026-07-08T10:00:00+00:00",
        "message": "Busco piso, 3 habitaciones",
    }
    filas = _parsear(leads_to_csv([lead]))
    assert filas[1][0] == 'Ana "La Rápida" Pérez'
    assert filas[1][2] == "+34 600,111"
    assert filas[1][7] == "Busco piso, 3 habitaciones"
    assert filas[1][6] == "2026-07-08"   # solo la fecha, sin hora


def test_saltos_de_linea_en_mensaje_se_aplanan():
    lead = {"name": "B", "email": "b@x.com", "message": "línea 1\nlínea 2\r\nlínea 3"}
    filas = _parsear(leads_to_csv([lead]))
    assert filas[1][7] == "línea 1 línea 2 línea 3"


def test_valores_ausentes_quedan_vacios():
    filas = _parsear(leads_to_csv([{"name": "C", "email": "c@x.com"}]))
    fila = filas[1]
    assert fila[0] == "C" and fila[4] == "" and fila[5] == "" and fila[6] == ""
