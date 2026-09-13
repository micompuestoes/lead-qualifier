"""Estadísticas avanzadas de leads (plan agencia)."""

from datetime import datetime, timedelta, timezone
from typing import Literal, Optional

from fastapi import APIRouter, Depends

from core.database import get_agent_leaderboard, get_closed_deals_value, get_stats
from deps import get_tenant_id, require_plan

router = APIRouter(tags=["estadisticas"])

Periodo = Literal["semana", "mes", "año", "siempre"]


def _since_for_periodo(periodo: Periodo) -> Optional[str]:
    """Fecha ISO de inicio del periodo (calendario, no "últimos N días"), o
    None para 'siempre' (sin filtro)."""
    now = datetime.now(timezone.utc)
    if periodo == "semana":
        inicio = now - timedelta(days=now.weekday())  # lunes de esta semana
        return inicio.replace(hour=0, minute=0, second=0, microsecond=0).isoformat()
    if periodo == "mes":
        return now.replace(day=1, hour=0, minute=0, second=0, microsecond=0).isoformat()
    if periodo == "año":
        return now.replace(month=1, day=1, hour=0, minute=0, second=0, microsecond=0).isoformat()
    return None  # "siempre"


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
