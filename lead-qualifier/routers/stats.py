"""Estadísticas avanzadas de leads (plan agencia)."""

from datetime import timedelta, timezone
from typing import Literal, Optional

from fastapi import APIRouter, Depends

from core.database import ahora_espana, get_agent_leaderboard, get_closed_deals_value, get_stats
from deps import get_tenant_id, require_plan

router = APIRouter(tags=["estadisticas"])

Periodo = Literal["semana", "mes", "año", "siempre"]


def _since_for_periodo(periodo: Periodo) -> Optional[str]:
    """
    Fecha ISO (en UTC, para comparar con closed_at) de inicio del periodo, o
    None para 'siempre' (sin filtro). El límite se calcula sobre el
    calendario de España, no el de UTC — con datetime.now(timezone.utc) el
    lunes de "esta semana" (o el día 1 de mes/año) podía caer hasta 2 horas
    tarde cerca de la medianoche local, el mismo desfase ya corregido para
    los recordatorios (ver hoy_espana() en core/database.py). El resultado
    se convierte a UTC antes de formatear: closed_at se guarda en UTC, y
    comparar dos ISO-8601 con offsets distintos como texto no ordena bien.
    """
    ahora = ahora_espana()
    if periodo == "semana":
        inicio = ahora - timedelta(days=ahora.weekday())  # lunes de esta semana
        inicio = inicio.replace(hour=0, minute=0, second=0, microsecond=0)
    elif periodo == "mes":
        inicio = ahora.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    elif periodo == "año":
        inicio = ahora.replace(month=1, day=1, hour=0, minute=0, second=0, microsecond=0)
    else:
        return None  # "siempre"
    return inicio.astimezone(timezone.utc).isoformat()


@router.get("/stats")
async def get_estadisticas(tenant_id: str = Depends(get_tenant_id)):
    """Estadísticas avanzadas de leads — solo plan agencia."""
    require_plan(tenant_id, "agencia")
    return get_stats(tenant_id)


@router.get("/stats/agents")
async def get_ranking_agentes(tenant_id: str = Depends(get_tenant_id)):
    """Ranking de rendimiento por agente del equipo — solo plan agencia."""
    require_plan(tenant_id, "agencia")
    return get_agent_leaderboard(tenant_id)


@router.get("/stats/deal-value")
async def get_valor_operaciones(periodo: Periodo = "siempre", tenant_id: str = Depends(get_tenant_id)):
    """Valor (€) de las operaciones cerradas en el periodo elegido — solo plan agencia."""
    require_plan(tenant_id, "agencia")
    since = _since_for_periodo(periodo)
    return get_closed_deals_value(tenant_id, since=since)
