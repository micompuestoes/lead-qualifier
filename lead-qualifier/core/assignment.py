"""
Lógica pura de reparto de leads entre agentes (sin dependencias de BD).

Se separa aquí para poder testearla sin SQLAlchemy: la capa de base de datos
(`pick_next_agent` en database.py) solo aporta los datos (agentes y conteos).
"""

from typing import Optional


def choose_next_agent(agent_ids: list[str], counts: dict[str, int]) -> Optional[str]:
    """
    Round-robin balanceado por carga: devuelve el agente con MENOS leads
    asignados. Empate → se respeta el orden de `agent_ids` (el primero gana),
    lo que reparte de forma estable y predecible.

    agent_ids: agentes candidatos, en orden de preferencia.
    counts:    nº de leads ya asignados por agente (los que faltan cuentan como 0).
    """
    if not agent_ids:
        return None
    return min(agent_ids, key=lambda a: (counts.get(a, 0), agent_ids.index(a)))
