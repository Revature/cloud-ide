"""Task to close idle ready pool runners before pool management runs."""
from datetime import datetime, timedelta
from sqlmodel import Session, select
from app.db.database import engine
from app.models.runner import Runner
from app.models.runner_history import RunnerHistory
from celery.utils.log import get_task_logger
from app.celery_app import celery_app
import asyncio

# Configurable idle timeout in minutes (can be set via env var or config in production)
IDLE_POOL_RUNNER_MINUTES = 10  # Adjust as needed

logger = get_task_logger(__name__)

@celery_app.task
def close_idle_pool_runners():
    """
    Task to transition idle 'ready' pool runners to 'closed_pool' if they've been idle for longer than the configured timeout.
    """
    now = datetime.utcnow()
    idle_cutoff = now - timedelta(minutes=IDLE_POOL_RUNNER_MINUTES)
    closed_count = 0
    with Session(engine) as session:
        stmt = select(Runner).where(
            Runner.state == "ready",
            Runner.updated_on != None,
            Runner.updated_on < idle_cutoff
        )
        idle_runners = session.exec(stmt).all()
        if idle_runners:
            from app.business.runner_management import stop_runner
            async def stop_all_runners():
                coros = [stop_runner(runner.id, initiated_by="close_idle_pool_runners") for runner in idle_runners]
                return await asyncio.gather(*coros)
            try:
                results = asyncio.run(stop_all_runners())
            except Exception as exc:
                logger.error(f"Error running stop_runner coroutines: {exc!s}")
                results = [None] * len(idle_runners)
            for runner, result in zip(idle_runners, results):
                if result and result.get("status") == "success":
                    runner.state = "closed_pool"
                    session.add(RunnerHistory(
                        runner_id=runner.id,
                        event_name="pool_runner_closed_idle",
                        event_data={
                            "timestamp": now.isoformat(),
                            "reason": "idle_timeout",
                            "last_updated_on": runner.updated_on.isoformat() if runner.updated_on else None
                        },
                        created_by="system",
                        modified_by="system"
                    ))
                    closed_count += 1
                elif result:
                    logger.error(f"Failed to stop runner {runner.id}: {result.get('message')}")
                else:
                    logger.error(f"No result returned for runner {runner.id} during stop operation.")
            session.commit()
    logger.info(f"Closed {closed_count} idle ready pool runners.")
    return {"closed_idle_runners": closed_count, "timestamp": now.isoformat()}
