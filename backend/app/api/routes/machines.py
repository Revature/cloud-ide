"""Machine (vm) API routes."""

from fastapi import APIRouter, Header, HTTPException, Request
from app.models.machine import Machine
from app.business import machine_management, endpoint_permission_decorator

router = APIRouter()

@router.get("/", response_model=list[Machine])
@endpoint_permission_decorator.permission_required("machines")
def read_machines(
                  request: Request
                  ):
    """Retrieve a list of all Machines."""
    machines = machine_management.get_all_machines()
    if not machines:
        raise HTTPException(status_code=204, detail="No machines found")
    return machines

@router.get("/{machine_id}", response_model=Machine)
@endpoint_permission_decorator.permission_required("machines")
def read_machine(machine_id: int,
                 request: Request
                 ):
    """Retrieve a single Machine by ID."""
    machine = machine_management.get_machine_by_id(machine_id)
    if not machine:
        raise HTTPException(status_code=400, detail="Machine not found")
    return machine
