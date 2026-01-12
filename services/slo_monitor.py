import os
import asyncio
from typing import Dict, List, Any, Optional
from datetime import datetime, timedelta
try:
    import asyncpg
except ImportError:
    asyncpg = None
from prometheus_client import Counter, Histogram, Gauge

class SLOMonitor:
    """
    Monitor de SLO (Service Level Objectives)
    Rastreia métricas de negócio para agentes/LLMs
    """
    
    def __init__(self):
        self.db_url = os.getenv("DATABASE_URL")
        
        # Métricas Prometheus
        self.task_success_counter = Counter(
            'agent_task_success_total',
            'Total successful tasks',
            ['client_id', 'route_path', 'intent']
        )
        
        self.task_failure_counter = Counter(
            'agent_task_failure_total',
            'Total failed tasks',
            ['client_id', 'route_path', 'intent', 'error_type']
        )
        
        self.tool_failure_counter = Counter(
            'agent_tool_failure_total',
            'Total tool failures',
            ['client_id', 'tool_name']
        )
        
        self.escalation_counter = Counter(
            'agent_human_escalation_total',
            'Total human escalations',
            ['client_id', 'route_path', 'reason']
        )
        
        self.cost_histogram = Histogram(
            'agent_cost_per_task',
            'Cost per task',
            ['client_id', 'route_path'],
            buckets=[0.01, 0.05, 0.1, 0.5, 1.0, 5.0, 10.0]
        )
        
        self.latency_histogram = Histogram(
            'agent_latency_seconds',
            'Task latency',
            ['client_id', 'route_path'],
            buckets=[0.1, 0.5, 1.0, 2.0, 5.0, 10.0, 30.0]
        )
        
        self.policy_incident_counter = Counter(
            'agent_policy_incident_total',
            'Total policy incidents',
            ['client_id', 'route_path', 'incident_type']
        )
    
    async def get_metrics(
        self,
        client_id: Optional[str] = None,
        hours: int = 24
    ) -> Dict[str, Any]:
        """
        Obtém métricas SLO agregadas
        
        Args:
            client_id: ID do cliente (opcional)
            hours: Janela de tempo em horas
        
        Returns:
            Dict com métricas agregadas
        """
        window_start = datetime.utcnow() - timedelta(hours=hours)
        
        if not asyncpg:
            # Fallback se asyncpg não estiver disponível
            return {
                "window_start": window_start.isoformat(),
                "window_end": datetime.utcnow().isoformat(),
                "client_id": client_id,
                "error": "asyncpg not available"
            }
        
        conn = await asyncpg.connect(self.db_url)
        
        try:
            # Task Success Rate
            success_rate = await self._calculate_task_success_rate(
                conn, client_id, window_start
            )
            
            # Tool Failure Rate
            tool_failure_rate = await self._calculate_tool_failure_rate(
                conn, client_id, window_start
            )
            
            # Human Escalation Rate
            escalation_rate = await self._calculate_escalation_rate(
                conn, client_id, window_start
            )
            
            # Cost per Task
            cost_metrics = await self._calculate_cost_metrics(
                conn, client_id, window_start
            )
            
            # Latency (p95, p99)
            latency_metrics = await self._calculate_latency_metrics(
                conn, client_id, window_start
            )
            
            # Policy Incidents
            policy_incidents = await self._get_policy_incidents(
                conn, client_id, window_start
            )
            
            return {
                "window_start": window_start.isoformat(),
                "window_end": datetime.utcnow().isoformat(),
                "client_id": client_id,
                "task_success_rate": success_rate,
                "tool_failure_rate": tool_failure_rate,
                "escalation_rate": escalation_rate,
                "cost_metrics": cost_metrics,
                "latency_metrics": latency_metrics,
                "policy_incidents": policy_incidents
            }
        finally:
            await conn.close()
    
    async def _calculate_task_success_rate(
        self,
        conn,
        client_id: Optional[str],
        window_start: datetime
    ) -> Dict[str, float]:
        """Calcula taxa de sucesso de tarefas"""
        query = """
            SELECT 
                COUNT(*) FILTER (WHERE status = 'completed') as successful,
                COUNT(*) as total
            FROM runs
            WHERE created_at >= $1
        """
        params = [window_start]
        
        if client_id:
            query += " AND client_id = $2"
            params.append(client_id)
        
        row = await conn.fetchrow(query, *params)
        
        total = row['total'] or 0
        successful = row['successful'] or 0
        
        rate = (successful / total) if total > 0 else 0.0
        
        return {
            "rate": rate,
            "successful": successful,
            "total": total
        }
    
    async def _calculate_tool_failure_rate(
        self,
        conn,
        client_id: Optional[str],
        window_start: datetime
    ) -> Dict[str, Any]:
        """Calcula taxa de falha de ferramentas"""
        query = """
            SELECT 
                te.tool_name,
                COUNT(*) FILTER (WHERE te.executed = false OR te.execution_error IS NOT NULL) as failed,
                COUNT(*) as total
            FROM tool_executions te
            JOIN runs r ON te.run_id = r.id
            WHERE te.timestamp >= $1
        """
        params = [window_start]
        
        if client_id:
            query += " AND r.client_id = $2"
            params.append(client_id)
        
        query += " GROUP BY te.tool_name"
        
        rows = await conn.fetch(query, *params)
        
        tool_rates = {}
        total_failed = 0
        total_executions = 0
        
        for row in rows:
            tool_name = row['tool_name']
            failed = row['failed'] or 0
            total = row['total'] or 0
            
            rate = (failed / total) if total > 0 else 0.0
            tool_rates[tool_name] = {
                "rate": rate,
                "failed": failed,
                "total": total
            }
            
            total_failed += failed
            total_executions += total
        
        overall_rate = (total_failed / total_executions) if total_executions > 0 else 0.0
        
        return {
            "overall_rate": overall_rate,
            "by_tool": tool_rates,
            "total_failed": total_failed,
            "total_executions": total_executions
        }
    
    async def _calculate_escalation_rate(
        self,
        conn,
        client_id: Optional[str],
        window_start: datetime
    ) -> Dict[str, float]:
        """Calcula taxa de escalação para humano"""
        query = """
            SELECT 
                COUNT(*) FILTER (WHERE requires_approval = true) as escalations,
                COUNT(*) as total
            FROM runs
            WHERE created_at >= $1
        """
        params = [window_start]
        
        if client_id:
            query += " AND client_id = $2"
            params.append(client_id)
        
        row = await conn.fetchrow(query, *params)
        
        total = row['total'] or 0
        escalations = row['escalations'] or 0
        
        rate = (escalations / total) if total > 0 else 0.0
        
        return {
            "rate": rate,
            "escalations": escalations,
            "total": total
        }
    
    async def _calculate_cost_metrics(
        self,
        conn,
        client_id: Optional[str],
        window_start: datetime
    ) -> Dict[str, float]:
        """Calcula métricas de custo"""
        # Em produção, isso viria de uma tabela de custos ou logs de API
        # Por enquanto, estimamos baseado em tokens
        
        query = """
            SELECT 
                AVG(EXTRACT(EPOCH FROM (completed_at - created_at))) as avg_duration,
                COUNT(*) as total_tasks
            FROM runs
            WHERE created_at >= $1 AND status = 'completed'
        """
        params = [window_start]
        
        if client_id:
            query += " AND client_id = $2"
            params.append(client_id)
        
        row = await conn.fetchrow(query, *params)
        
        # Estimativa simples (em produção, usar custos reais)
        avg_duration = row['avg_duration'] or 0.0
        total_tasks = row['total_tasks'] or 0
        
        # Estimativa: $0.002 por segundo de processamento
        estimated_cost_per_task = avg_duration * 0.002
        total_cost = estimated_cost_per_task * total_tasks
        
        return {
            "avg_cost_per_task": estimated_cost_per_task,
            "total_cost": total_cost,
            "total_tasks": total_tasks
        }
    
    async def _calculate_latency_metrics(
        self,
        conn,
        client_id: Optional[str],
        window_start: datetime
    ) -> Dict[str, float]:
        """Calcula métricas de latência (p95, p99)"""
        query = """
            SELECT 
                EXTRACT(EPOCH FROM (completed_at - created_at)) as duration
            FROM runs
            WHERE created_at >= $1 
              AND status = 'completed'
              AND completed_at IS NOT NULL
        """
        params = [window_start]
        
        if client_id:
            query += " AND client_id = $2"
            params.append(client_id)
        
        rows = await conn.fetch(query, *params)
        
        durations = [row['duration'] for row in rows if row['duration'] is not None]
        
        if not durations:
            return {
                "p50": 0.0,
                "p95": 0.0,
                "p99": 0.0,
                "avg": 0.0,
                "min": 0.0,
                "max": 0.0
            }
        
        durations.sort()
        n = len(durations)
        
        return {
            "p50": durations[int(n * 0.50)],
            "p95": durations[int(n * 0.95)],
            "p99": durations[int(n * 0.99)],
            "avg": sum(durations) / n,
            "min": min(durations),
            "max": max(durations)
        }
    
    async def _get_policy_incidents(
        self,
        conn,
        client_id: Optional[str],
        window_start: datetime
    ) -> Dict[str, Any]:
        """Obtém incidentes de política"""
        query = """
            SELECT 
                COUNT(*) FILTER (WHERE status = 'blocked') as blocked,
                COUNT(*) FILTER (WHERE status = 'blocked' AND error_message LIKE '%PII%') as pii_incidents,
                COUNT(*) FILTER (WHERE status = 'blocked' AND error_message LIKE '%policy%') as policy_violations
            FROM runs
            WHERE created_at >= $1
        """
        params = [window_start]
        
        if client_id:
            query += " AND client_id = $2"
            params.append(client_id)
        
        row = await conn.fetchrow(query, *params)
        
        return {
            "total_blocked": row['blocked'] or 0,
            "pii_incidents": row['pii_incidents'] or 0,
            "policy_violations": row['policy_violations'] or 0
        }
    
    async def record_metric(
        self,
        metric_type: str,
        client_id: str,
        value: float,
        labels: Dict[str, Any]
    ):
        """Registra uma métrica"""
        if not asyncpg:
            return
        
        conn = await asyncpg.connect(self.db_url)
        
        try:
            await conn.execute(
                """
                INSERT INTO metrics (metric_type, client_id, value, labels, timestamp)
                VALUES ($1, $2, $3, $4, NOW())
                """,
                metric_type,
                client_id,
                value,
                labels
            )
        finally:
            await conn.close()
