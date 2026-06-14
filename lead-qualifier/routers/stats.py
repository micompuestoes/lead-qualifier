"""Estadísticas avanzadas de leads (plan agencia)."""

from fastapi import APIRouter, Depends

from core.database import get_agent_leaderboard, get_stats
from deps import get_tenant_id, require_plan

router = APIRouter(tags=["estadisticas"])


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
