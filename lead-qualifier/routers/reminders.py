"""
Recordatorios de seguimiento por lead ("llamar el jueves", "enviar cédula"...).

Pensados para crear el hábito de entrar al panel cada día: la lista de tareas
pendientes de hoy vive en el dashboard (GET /reminders/pending) y un job
diario (ver jobs.py) avisa por email de lo que vence.
"""

import logging
import uuid
from datetime import date
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from core.database import (
    create_reminder, delete_reminder, get_lead_by_id, get_pending_reminders,
    get_reminder_by_id, get_reminders_for_lead, update_reminder,
)
from deps import Caller, get_caller

logger = logging.getLogger(__name__)

router = APIRouter(tags=["recordatorios"])


class CrearRecordatorioInput(BaseModel):
    note: str = Field(min_length=1, max_length=500)
    due_date: date


class ActualizarRecordatorioInput(BaseModel):
    note: Optional[str] = Field(default=None, min_length=1, max_length=500)
    due_date: Optional[date] = None
    done: Optional[bool] = None


def _serializar(r: dict) -> dict:
    r = dict(r)
    r["done"] = bool(r.get("done"))
    return r


@router.post("/leads/{lead_id}/reminders", status_code=201)
async def crear_recordatorio(
    lead_id: str,
    body: CrearRecordatorioInput,
    caller: Caller = Depends(get_caller),
):
    """Crea un recordatorio de seguimiento para un lead (un agente solo de los suyos)."""
    lead = get_lead_by_id(lead_id, tenant_id=caller.tenant_id, agent_id=caller.agent_filter)
    if not lead:
        raise HTTPException(status_code=404, detail=f"Lead {lead_id} no encontrado")

    reminder_id = str(uuid.uuid4())
    create_reminder(
        reminder_id, lead_id, caller.tenant_id,
        note=body.note.strip(), due_date=body.due_date.isoformat(),
    )
    return _serializar(get_reminder_by_id(reminder_id, caller.tenant_id))


@router.get("/leads/{lead_id}/reminders")
async def listar_recordatorios_lead(
    lead_id: str,
    caller: Caller = Depends(get_caller),
):
    """Recordatorios de un lead concreto, pendientes y hechos."""
    lead = get_lead_by_id(lead_id, tenant_id=caller.tenant_id, agent_id=caller.agent_filter)
    if not lead:
        raise HTTPException(status_code=404, detail=f"Lead {lead_id} no encontrado")
    return [_serializar(r) for r in get_reminders_for_lead(lead_id, caller.tenant_id)]


@router.get("/reminders/pending")
async def listar_recordatorios_pendientes(
    caller: Caller = Depends(get_caller),
):
    """
    Tareas de hoy: recordatorios sin completar que vencen hoy o antes (un
    agente solo ve los de sus leads asignados). Para el widget del dashboard.
    """
    hasta = date.today().isoformat()
    reminders = get_pending_reminders(caller.tenant_id, agent_id=caller.agent_filter, hasta=hasta)
    return [_serializar(r) for r in reminders]


@router.patch("/reminders/{reminder_id}")
async def actualizar_recordatorio(
    reminder_id: str,
    body: ActualizarRecordatorioInput,
    caller: Caller = Depends(get_caller),
):
    """Edita la nota/fecha o marca como hecho/pendiente un recordatorio."""
    reminder = get_reminder_by_id(reminder_id, caller.tenant_id)
    if not reminder:
        raise HTTPException(status_code=404, detail="Recordatorio no encontrado")

    update_reminder(
        reminder_id, caller.tenant_id,
        note=body.note.strip() if body.note is not None else None,
        due_date=body.due_date.isoformat() if body.due_date is not None else None,
        done=body.done,
    )
    return _serializar(get_reminder_by_id(reminder_id, caller.tenant_id))


@router.delete("/reminders/{reminder_id}", status_code=204)
async def eliminar_recordatorio(
    reminder_id: str,
    caller: Caller = Depends(get_caller),
):
    reminder = get_reminder_by_id(reminder_id, caller.tenant_id)
    if not reminder:
        raise HTTPException(status_code=404, detail="Recordatorio no encontrado")
    delete_reminder(reminder_id, caller.tenant_id)
