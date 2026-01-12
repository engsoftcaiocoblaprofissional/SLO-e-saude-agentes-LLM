from celery import shared_task
from services.slo_monitor import SLOMonitor
from services.eval_service import EvalService
import asyncio

slo_monitor = SLOMonitor()
eval_service = EvalService()


@shared_task
def calculate_slo_metrics(client_id=None, hours=24):
    """Task assíncrona para calcular métricas SLO"""
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    try:
        return loop.run_until_complete(
            slo_monitor.get_metrics(client_id, hours)
        )
    finally:
        loop.close()


@shared_task
def run_evaluation_async(eval_run_id, dataset_path, policy_id=None):
    """Task assíncrona para executar avaliação"""
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    try:
        return loop.run_until_complete(
            eval_service.run_evaluation(eval_run_id, dataset_path, policy_id)
        )
    finally:
        loop.close()
