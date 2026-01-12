import re
import numpy as np
from typing import Dict, List, Tuple
from transformers import AutoTokenizer, AutoModelForSequenceClassification
import torch

class PromptInjectionDetector:
    """
    Detector de Prompt Injection usando múltiplas técnicas:
    - Pattern matching para instruções conhecidas
    - Análise semântica com modelos de linguagem
    - Detecção de tentativas de jailbreak
    """
    
    def __init__(self):
        self.patterns = self._load_patterns()
        self.model = None
        self.tokenizer = None
        self._load_model()
    
    def _load_patterns(self) -> List[Dict[str, any]]:
        """Carrega padrões conhecidos de prompt injection"""
        return [
            {
                "pattern": r"(?i)(ignore|forget|disregard).*(previous|above|instructions|rules|system)",
                "score": 0.8,
                "type": "instruction_override"
            },
            {
                "pattern": r"(?i)(you are|act as|pretend to be|roleplay as)",
                "score": 0.6,
                "type": "role_manipulation"
            },
            {
                "pattern": r"(?i)(system|assistant|user):\s*(.*)",
                "score": 0.7,
                "type": "format_manipulation"
            },
            {
                "pattern": r"(?i)(new instructions|new prompt|override|bypass)",
                "score": 0.75,
                "type": "bypass_attempt"
            },
            {
                "pattern": r"(?i)(tell me|reveal|show|expose).*(password|secret|key|token|api)",
                "score": 0.9,
                "type": "secret_extraction"
            },
            {
                "pattern": r"(?i)(do anything|unrestricted|no limits|ignore safety)",
                "score": 0.85,
                "type": "safety_bypass"
            },
            {
                "pattern": r"(?i)(\[INST\]|\[/INST\]|&lt;|&gt;|&amp;)",
                "score": 0.5,
                "type": "format_encoding"
            },
            {
                "pattern": r"(?i)(jailbreak|dan|do anything now)",
                "score": 0.9,
                "type": "jailbreak_attempt"
            },
            {
                "pattern": r"(?i)(repeat|echo|say exactly).*(word|phrase|text)",
                "score": 0.4,
                "type": "repetition_attack"
            },
            {
                "pattern": r"(?i)(translate|convert|encode).*(base64|hex|binary)",
                "score": 0.6,
                "type": "encoding_attack"
            }
        ]
    
    def _load_model(self):
        """Carrega modelo de detecção (opcional, pode usar modelo pré-treinado)"""
        try:
            # Tentar carregar modelo específico para detecção de prompt injection
            # Se não disponível, usar modelo genérico de classificação
            model_name = "microsoft/deberta-v3-base"
            self.tokenizer = AutoTokenizer.from_pretrained(model_name)
            # Nota: Em produção, você treinaria um modelo específico ou usaria um modelo fine-tuned
            # Por enquanto, usamos apenas pattern matching e heurísticas
        except Exception as e:
            print(f"Modelo não carregado, usando apenas pattern matching: {e}")
            self.model = None
            self.tokenizer = None
    
    def detect(self, text: str) -> Dict[str, any]:
        """
        Detecta tentativas de prompt injection
        
        Returns:
            Dict com score, patterns detectados, e sugestões de mitigação
        """
        if not text or len(text.strip()) == 0:
            return {
                "score": 0.0,
                "patterns": [],
                "is_malicious": False,
                "suggestions": []
            }
        
        detected_patterns = []
        max_score = 0.0
        pattern_scores = []
        
        # Pattern matching
        for pattern_def in self.patterns:
            matches = re.finditer(pattern_def["pattern"], text, re.MULTILINE | re.DOTALL)
            for match in matches:
                detected_patterns.append({
                    "type": pattern_def["type"],
                    "pattern": pattern_def["pattern"],
                    "match": match.group(0)[:100],  # Limitar tamanho
                    "score": pattern_def["score"]
                })
                pattern_scores.append(pattern_def["score"])
                max_score = max(max_score, pattern_def["score"])
        
        # Análise heurística adicional
        heuristic_score = self._heuristic_analysis(text)
        max_score = max(max_score, heuristic_score)
        
        # Combinar scores (média ponderada)
        if pattern_scores:
            avg_pattern_score = np.mean(pattern_scores)
            combined_score = (max_score * 0.6) + (avg_pattern_score * 0.3) + (heuristic_score * 0.1)
        else:
            combined_score = heuristic_score
        
        # Normalizar para 0-1
        final_score = min(combined_score, 1.0)
        
        is_malicious = final_score > 0.7
        
        suggestions = self._generate_suggestions(detected_patterns, final_score)
        
        return {
            "score": round(final_score, 3),
            "patterns": [p["type"] for p in detected_patterns],
            "is_malicious": is_malicious,
            "suggestions": suggestions
        }
    
    def _heuristic_analysis(self, text: str) -> float:
        """Análise heurística adicional"""
        score = 0.0
        
        # Verificar comprimento suspeito (muito curto ou muito longo)
        if len(text) < 10:
            score += 0.1
        if len(text) > 10000:
            score += 0.2
        
        # Verificar caracteres especiais excessivos
        special_char_ratio = len(re.findall(r'[^\w\s]', text)) / max(len(text), 1)
        if special_char_ratio > 0.3:
            score += 0.3
        
        # Verificar repetição excessiva
        words = text.split()
        if len(words) > 0:
            unique_ratio = len(set(words)) / len(words)
            if unique_ratio < 0.3:
                score += 0.2
        
        # Verificar tentativas de encoding
        if re.search(r'[A-Za-z0-9+/]{20,}={0,2}', text):  # Base64-like
            score += 0.2
        
        # Verificar tentativas de HTML/XML injection
        if re.search(r'<[^>]+>', text):
            score += 0.2
        
        return min(score, 1.0)
    
    def _generate_suggestions(self, detected_patterns: List[Dict], score: float) -> List[str]:
        """Gera sugestões de mitigação"""
        suggestions = []
        
        if score > 0.8:
            suggestions.append("Bloquear completamente a entrada")
            suggestions.append("Requerer aprovação humana")
        elif score > 0.6:
            suggestions.append("Sanitizar entrada removendo padrões suspeitos")
            suggestions.append("Adicionar contexto de segurança ao prompt")
        elif score > 0.4:
            suggestions.append("Monitorar execução cuidadosamente")
            suggestions.append("Limitar ações permitidas")
        
        if any(p["type"] == "secret_extraction" for p in detected_patterns):
            suggestions.append("Remover qualquer informação sensível do contexto")
        
        if any(p["type"] == "safety_bypass" for p in detected_patterns):
            suggestions.append("Reforçar regras de segurança")
            suggestions.append("Desabilitar ferramentas perigosas")
        
        return suggestions
