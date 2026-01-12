import json
import os
import re
import asyncio
from typing import Dict, List, Any, Optional
from pathlib import Path
import aiofiles
from openai import AsyncOpenAI
from anthropic import AsyncAnthropic

class EvalService:
    """
    Serviço de avaliação de agentes/LLMs
    Executa testes, calcula scores e gera relatórios
    """
    
    def __init__(self):
        self.openai_client = None
        self.anthropic_client = None
        
        if os.getenv("OPENAI_API_KEY"):
            self.openai_client = AsyncOpenAI(api_key=os.getenv("OPENAI_API_KEY"))
        
        if os.getenv("ANTHROPIC_API_KEY"):
            self.anthropic_client = AsyncAnthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))
    
    async def run_evaluation(
        self,
        eval_run_id: str,
        dataset_path: str,
        policy_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Executa avaliação completa
        
        Args:
            eval_run_id: ID da execução de avaliação
            dataset_path: Caminho para dataset JSONL
            policy_id: ID da política a ser testada
        
        Returns:
            Dict com results, scores e passed
        """
        # Carregar dataset
        dataset = await self._load_dataset(dataset_path)
        
        results = []
        scores = {
            "factualness": [],
            "policy_adherence": [],
            "completeness": [],
            "hallucination": [],
            "tool_use_quality": []
        }
        
        # Executar cada caso de teste
        for i, test_case in enumerate(dataset):
            result = await self._evaluate_case(test_case, policy_id)
            results.append(result)
            
            # Acumular scores
            for score_type in scores.keys():
                if score_type in result.get("scores", {}):
                    scores[score_type].append(result["scores"][score_type])
        
        # Calcular scores agregados
        aggregated_scores = {}
        for score_type, values in scores.items():
            if values:
                aggregated_scores[score_type] = {
                    "mean": sum(values) / len(values),
                    "min": min(values),
                    "max": max(values),
                    "std": self._calculate_std(values)
                }
        
        # Determinar se passou (threshold configurável)
        passed = self._determine_pass(aggregated_scores)
        
        return {
            "results": results,
            "scores": aggregated_scores,
            "passed": passed,
            "total_cases": len(dataset),
            "passed_cases": sum(1 for r in results if r.get("passed", False))
        }
    
    async def _load_dataset(self, dataset_path: str) -> List[Dict]:
        """Carrega dataset JSONL"""
        dataset = []
        
        if not Path(dataset_path).exists():
            raise FileNotFoundError(f"Dataset not found: {dataset_path}")
        
        async with aiofiles.open(dataset_path, 'r') as f:
            async for line in f:
                line = line.strip()
                if line:
                    dataset.append(json.loads(line))
        
        return dataset
    
    async def _evaluate_case(
        self,
        test_case: Dict,
        policy_id: Optional[str]
    ) -> Dict[str, Any]:
        """
        Avalia um caso de teste individual
        
        Formato esperado do test_case:
        {
            "input": {...},
            "expected_output": {...},
            "expected_tools": [...],
            "expected_behavior": "..."
        }
        """
        # Executar o caso (simular execução do agente)
        # Em produção, isso chamaria o gateway real
        actual_output = await self._execute_case(test_case["input"])
        
        # Calcular scores
        scores = {}
        
        # Factualness: verificar se o output é factual
        scores["factualness"] = await self._score_factualness(
            test_case.get("expected_output"),
            actual_output
        )
        
        # Policy adherence: verificar se seguiu políticas
        scores["policy_adherence"] = await self._score_policy_adherence(
            test_case,
            actual_output,
            policy_id
        )
        
        # Completeness: verificar se completou a tarefa
        scores["completeness"] = await self._score_completeness(
            test_case.get("expected_output"),
            actual_output
        )
        
        # Hallucination: verificar se inventou informações
        scores["hallucination"] = await self._score_hallucination(
            test_case.get("input"),
            actual_output
        )
        
        # Tool use quality: verificar qualidade do uso de ferramentas
        scores["tool_use_quality"] = await self._score_tool_use(
            test_case.get("expected_tools"),
            actual_output.get("tools_used", [])
        )
        
        # Score geral (média ponderada)
        overall_score = (
            scores["factualness"] * 0.25 +
            scores["policy_adherence"] * 0.25 +
            scores["completeness"] * 0.20 +
            (1.0 - scores["hallucination"]) * 0.15 +
            scores["tool_use_quality"] * 0.15
        )
        
        passed = overall_score >= 0.7
        
        return {
            "test_case_id": test_case.get("id", "unknown"),
            "scores": scores,
            "overall_score": overall_score,
            "passed": passed,
            "actual_output": actual_output,
            "expected_output": test_case.get("expected_output")
        }
    
    async def _execute_case(self, input_data: Dict) -> Dict:
        """Executa um caso de teste (simulado)"""
        # Em produção, isso chamaria o gateway real via API
        # Por enquanto, retornamos um output simulado
        return {
            "result": "Simulated execution",
            "tools_used": [],
            "output": input_data
        }
    
    async def _score_factualness(
        self,
        expected: Optional[Dict],
        actual: Dict
    ) -> float:
        """Score de factualidade (0-1)"""
        if not expected:
            return 0.5  # Score neutro se não há expectativa
        
        # Comparação simples (em produção, usar LLM para avaliar)
        expected_str = json.dumps(expected, sort_keys=True)
        actual_str = json.dumps(actual, sort_keys=True)
        
        # Similaridade simples
        if expected_str == actual_str:
            return 1.0
        
        # Calcular similaridade básica
        common_keys = set(expected.keys()) & set(actual.keys())
        if not common_keys:
            return 0.0
        
        matches = 0
        for key in common_keys:
            if expected[key] == actual[key]:
                matches += 1
        
        return matches / len(common_keys) if common_keys else 0.0
    
    async def _score_policy_adherence(
        self,
        test_case: Dict,
        actual_output: Dict,
        policy_id: Optional[str]
    ) -> float:
        """Score de aderência à política (0-1)"""
        # Verificar se não violou políticas
        # Em produção, isso verificaria contra a política real
        
        violations = []
        
        # Verificar se não usou ferramentas proibidas
        tools_used = actual_output.get("tools_used", [])
        # (verificação real seria feita contra policy)
        
        # Verificar se não expôs dados sensíveis
        output_str = json.dumps(actual_output)
        pii_patterns = [
            r"\b\d{3}\.\d{3}\.\d{3}-\d{2}\b",  # CPF
            r"\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b",  # Credit card
        ]
        
        for pattern in pii_patterns:
            if re.search(pattern, output_str):
                violations.append("PII_EXPOSED")
        
        # Score baseado em violações
        if len(violations) == 0:
            return 1.0
        elif len(violations) == 1:
            return 0.5
        else:
            return 0.0
    
    async def _score_completeness(
        self,
        expected: Optional[Dict],
        actual: Dict
    ) -> float:
        """Score de completude (0-1)"""
        if not expected:
            return 0.5
        
        # Verificar se todos os campos esperados estão presentes
        expected_keys = set(expected.keys())
        actual_keys = set(actual.keys())
        
        if not expected_keys:
            return 1.0
        
        coverage = len(expected_keys & actual_keys) / len(expected_keys)
        return coverage
    
    async def _score_hallucination(
        self,
        input_data: Dict,
        actual_output: Dict
    ) -> float:
        """Score de alucinação (0-1, onde 1 = muita alucinação)"""
        # Verificar se o output contém informações não presentes no input
        input_str = json.dumps(input_data).lower()
        output_str = json.dumps(actual_output).lower()
        
        # Extrair entidades/chaves do input
        input_entities = set(re.findall(r'\b\w{4,}\b', input_str))
        output_entities = set(re.findall(r'\b\w{4,}\b', output_str))
        
        # Entidades no output que não estão no input (potencial alucinação)
        new_entities = output_entities - input_entities
        
        # Score baseado na proporção de novas entidades
        if len(output_entities) == 0:
            return 0.0
        
        hallucination_ratio = len(new_entities) / len(output_entities)
        return min(hallucination_ratio, 1.0)
    
    async def _score_tool_use(
        self,
        expected_tools: Optional[List],
        actual_tools: List
    ) -> float:
        """Score de qualidade do uso de ferramentas (0-1)"""
        if not expected_tools:
            # Se não há expectativa, verificar se usou ferramentas apropriadamente
            return 0.5
        
        if not actual_tools:
            return 0.0
        
        # Verificar se usou as ferramentas esperadas
        expected_set = set(t.get("name", t) if isinstance(t, dict) else t for t in expected_tools)
        actual_set = set(t.get("name", t) if isinstance(t, dict) else t for t in actual_tools)
        
        if expected_set == actual_set:
            return 1.0
        
        # Calcular overlap
        overlap = len(expected_set & actual_set)
        total_expected = len(expected_set)
        
        if total_expected == 0:
            return 0.5
        
        return overlap / total_expected
    
    def _calculate_std(self, values: List[float]) -> float:
        """Calcula desvio padrão"""
        if len(values) < 2:
            return 0.0
        
        mean = sum(values) / len(values)
        variance = sum((x - mean) ** 2 for x in values) / len(values)
        return variance ** 0.5
    
    def _determine_pass(self, scores: Dict[str, Dict]) -> bool:
        """Determina se a avaliação passou"""
        if not scores:
            return False
        
        # Thresholds mínimos
        thresholds = {
            "factualness": 0.7,
            "policy_adherence": 0.8,
            "completeness": 0.7,
            "hallucination": 0.3,  # Máximo de alucinação
            "tool_use_quality": 0.6
        }
        
        for score_type, threshold in thresholds.items():
            if score_type in scores:
                mean_score = scores[score_type]["mean"]
                
                if score_type == "hallucination":
                    # Para alucinação, queremos valores baixos
                    if mean_score > threshold:
                        return False
                else:
                    # Para outros, queremos valores altos
                    if mean_score < threshold:
                        return False
        
        return True
