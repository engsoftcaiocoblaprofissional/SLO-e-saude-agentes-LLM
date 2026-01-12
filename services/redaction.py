import re
import os
import hashlib
from typing import Dict, List, Any, Tuple
from cryptography.fernet import Fernet
import base64

class DataRedactor:
    """
    Redator de dados sensíveis (PII, secrets, etc.)
    Suporta múltiplos tipos de dados sensíveis
    """
    
    def __init__(self):
        self.patterns = self._load_patterns()
        self.key = self._get_or_create_key()
        self.cipher = Fernet(self.key)
    
    def _get_or_create_key(self) -> bytes:
        """Gera ou recupera chave de criptografia"""
        # Em produção, use uma chave gerenciada por KMS ou variável de ambiente
        key_env = os.getenv("REDACTION_KEY")
        if key_env:
            return base64.urlsafe_b64encode(key_env.encode()[:32].ljust(32, b'0'))
        else:
            # Gerar chave determinística baseada em secret
            secret = os.getenv("JWT_SECRET", "default-secret")
            key = hashlib.sha256(secret.encode()).digest()
            return base64.urlsafe_b64encode(key)
    
    def _load_patterns(self) -> List[Dict[str, any]]:
        """Carrega padrões de dados sensíveis"""
        return [
            {
                "name": "CPF",
                "pattern": r"\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b",
                "replacement": "[CPF_REDACTED]",
                "type": "pii"
            },
            {
                "name": "CNPJ",
                "pattern": r"\b\d{2}\.?\d{3}\.?\d{3}/?\d{4}-?\d{2}\b",
                "replacement": "[CNPJ_REDACTED]",
                "type": "pii"
            },
            {
                "name": "Credit Card",
                "pattern": r"\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b",
                "replacement": "[CARD_REDACTED]",
                "type": "pii"
            },
            {
                "name": "Email",
                "pattern": r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b",
                "replacement": "[EMAIL_REDACTED]",
                "type": "pii"
            },
            {
                "name": "Phone BR",
                "pattern": r"\b(\(?\d{2}\)?\s?)?\d{4,5}[-\s]?\d{4}\b",
                "replacement": "[PHONE_REDACTED]",
                "type": "pii"
            },
            {
                "name": "API Key",
                "pattern": r"\b(sk-|pk-|AKIA|AIza)[A-Za-z0-9]{20,}\b",
                "replacement": "[API_KEY_REDACTED]",
                "type": "secret"
            },
            {
                "name": "JWT Token",
                "pattern": r"\beyJ[A-Za-z0-9-_=]+\.eyJ[A-Za-z0-9-_=]+\.?[A-Za-z0-9-_.+/=]*\b",
                "replacement": "[JWT_REDACTED]",
                "type": "secret"
            },
            {
                "name": "Password",
                "pattern": r"(?i)(password|senha|pwd)\s*[:=]\s*['\"]?([^\s'\"\n]{6,})['\"]?",
                "replacement": r"\1: [PASSWORD_REDACTED]",
                "type": "secret"
            },
            {
                "name": "SSN",
                "pattern": r"\b\d{3}-\d{2}-\d{4}\b",
                "replacement": "[SSN_REDACTED]",
                "type": "pii"
            },
            {
                "name": "IP Address",
                "pattern": r"\b(?:\d{1,3}\.){3}\d{1,3}\b",
                "replacement": "[IP_REDACTED]",
                "type": "network"
            },
            {
                "name": "MAC Address",
                "pattern": r"\b([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})\b",
                "replacement": "[MAC_REDACTED]",
                "type": "network"
            }
        ]
    
    def redact(self, data: Any, redactions_applied: List[Dict] = None) -> Tuple[Any, List[Dict]]:
        """
        Redacta dados sensíveis recursivamente
        
        Args:
            data: Dados a serem redatados (dict, list, str, etc.)
            redactions_applied: Lista de redações aplicadas (para recursão)
        
        Returns:
            Tuple (dados_redatados, lista_de_redações)
        """
        if redactions_applied is None:
            redactions_applied = []
        
        if isinstance(data, dict):
            redacted_dict = {}
            for key, value in data.items():
                redacted_value, new_redactions = self.redact(value, redactions_applied)
                redacted_dict[key] = redacted_value
                redactions_applied.extend(new_redactions)
            return redacted_dict, redactions_applied
        
        elif isinstance(data, list):
            redacted_list = []
            for item in data:
                redacted_item, new_redactions = self.redact(item, redactions_applied)
                redacted_list.append(redacted_item)
                redactions_applied.extend(new_redactions)
            return redacted_list, redactions_applied
        
        elif isinstance(data, str):
            return self._redact_string(data, redactions_applied)
        
        else:
            # Tipos primitivos (int, float, bool, None) não precisam redação
            return data, redactions_applied
    
    def _redact_string(self, text: str, redactions_applied: List[Dict]) -> Tuple[str, List[Dict]]:
        """Redacta uma string"""
        if not text:
            return text, redactions_applied
        
        redacted_text = text
        new_redactions = []
        
        for pattern_def in self.patterns:
            matches = list(re.finditer(pattern_def["pattern"], text, re.IGNORECASE))
            
            for match in matches:
                original_value = match.group(0)
                
                # Criar hash para referência (sem expor o valor original)
                value_hash = hashlib.sha256(original_value.encode()).hexdigest()[:8]
                
                # Substituir
                if pattern_def["name"] == "Password":
                    # Para senhas, usar substituição especial
                    redacted_text = re.sub(
                        pattern_def["pattern"],
                        pattern_def["replacement"],
                        redacted_text,
                        flags=re.IGNORECASE
                    )
                else:
                    redacted_text = redacted_text.replace(original_value, pattern_def["replacement"])
                
                new_redactions.append({
                    "type": pattern_def["type"],
                    "pattern_name": pattern_def["name"],
                    "pattern_matched": pattern_def["pattern"],
                    "value_hash": value_hash,
                    "replacement": pattern_def["replacement"]
                })
        
        return redacted_text, new_redactions
    
    def mask_partial(self, value: str, keep_start: int = 3, keep_end: int = 3) -> str:
        """Mascara parcialmente um valor (mantém início e fim)"""
        if len(value) <= keep_start + keep_end:
            return "*" * len(value)
        
        start = value[:keep_start]
        end = value[-keep_end:]
        middle = "*" * (len(value) - keep_start - keep_end)
        
        return f"{start}{middle}{end}"
    
    def hash_value(self, value: str) -> str:
        """Gera hash de um valor para referência"""
        return hashlib.sha256(value.encode()).hexdigest()
