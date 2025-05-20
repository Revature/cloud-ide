"""Machine (vm) API routes."""

from fastapi import APIRouter, Header, HTTPException
from app.models.machine import Machine
from app.business import machine_management, endpoint_permission_decorator

router = APIRouter()

# @router.post("/", response_model=Machine, status_code=status.HTTP_201_CREATED)
# def create_machine(machine: Machine, session: Session = Depends(get_session), access_token: str = Header(..., alias="Access-Token")):
#     """Create a new Machine record."""
#     session.add(machine)
#     session.commit()
#     session.refresh(machine)
#     return machine

@router.get("/", response_model=list[Machine])
@endpoint_permission_decorator.permission_required("machines")
def read_machines(
                  #access_token: str = Header(..., alias="Access-Token")
                  ):
    """Retrieve a list of all Machines."""
    machines = machine_management.get_all_machines()
    if not machines:
        raise HTTPException(status_code=204, detail="No machines found")
    return machines

@router.get("/{machine_id}", response_model=Machine)
@endpoint_permission_decorator.permission_required("machines")
def read_machine(machine_id: int,
                 #access_token: str = Header(..., alias="Access-Token")
                 ):
    """Retrieve a single Machine by ID."""
    machine = machine_management.get_machine_by_id(machine_id)
    if not machine:
        raise HTTPException(status_code=400, detail="Machine not found")
    return machine

# @router.patch("/{machine_id}", response_model=Machine)
# def update_machine(machine_id: int,
#                    updated_machine: Machine,
#                    session: Session = Depends(get_session),
#                    access_token: str = Header(..., alias="Access-Token")):
#     """Update an existing Machine record."""
#     machine = session.get(Machine, machine_id)
#     if not machine:
#         raise HTTPException(status_code=404, detail="Machine not found")

#     # Update fields; typically, you might want to limit which fields can be updated.
#     machine.name = updated_machine.name
#     machine.description = updated_machine.description
#     machine.identifier = updated_machine.identifier
#     machine.modified_by = updated_machine.modified_by

#     session.add(machine)
#     session.commit()
#     session.refresh(machine)
#     return machine

# @router.delete("/{machine_id}", status_code=status.HTTP_200_OK)
# def delete_machine(machine_id: int, session: Session = Depends(get_session), access_token: str = Header(..., alias="Access-Token")):
#     """Delete a Machine record."""
#     machine = session.get(Machine, machine_id)
#     if not machine:
#         raise HTTPException(status_code=404, detail="Machine not found")
#     session.delete(machine)
#     session.commit()
