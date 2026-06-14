"""
Singletons compartidos entre la app HTTP y los jobs en segundo plano.

El cliente de Anthropic se crea una sola vez en el arranque (ver `lifespan`
en main.py) y se reutiliza tanto en los endpoints como en el scheduler IMAP,
evitando reconstruir el contexto SSL en cada petición.
"""

from __future__ import annotations

from typing import Optional

import anthropic

# Asignado en el arranque por main.lifespan. None hasta entonces.
anthropic_client: Optional[anthropic.Anthropic] = None
