from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
import os
from dotenv import load_dotenv

from services.prompt_injection import PromptInjectionDetector
from services.redaction import DataRedactor
from services.eval_service import EvalService
from services.slo_monitor import SLOMonitor

load_dotenv()

app = FastAPI(title="SLO Eval Gateway - Python Services")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize services
prompt_injection_detector = PromptInjectionDetector()
data_redactor = DataRedactor()
eval_service = EvalService()
slo_monitor = SLOMonitor()


class RedactionRequest(BaseModel):
    data: Dict[str, Any]


class RedactionResponse(BaseModel):
    redacted_data: Dict[str, Any]
    redactions_applied: List[Dict[str, Any]]


class PromptInjectionRequest(BaseModel):
    text: str


class PromptInjectionResponse(BaseModel):
    detection_score: float
    detected_patterns: List[str]
    is_malicious: bool
    mitigation_suggestions: List[str]


class EvalRunRequest(BaseModel):
    eval_run_id: str
    dataset_path: str
    policy_id: Optional[str] = None


class EvalRunResponse(BaseModel):
    results: Dict[str, Any]
    scores: Dict[str, Any]
    passed: bool


@app.get("/health")
async def health():
    return {"status": "healthy"}


@app.post("/redact", response_model=RedactionResponse)
async def redact_data(request: RedactionRequest):
    """Redact sensitive data from input"""
    try:
        redacted_data, redactions = data_redactor.redact(request.data)
        return RedactionResponse(
            redacted_data=redacted_data,
            redactions_applied=redactions
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/detect-prompt-injection", response_model=PromptInjectionResponse)
async def detect_prompt_injection(request: PromptInjectionRequest):
    """Detect prompt injection attempts"""
    try:
        result = prompt_injection_detector.detect(request.text)
        return PromptInjectionResponse(
            detection_score=result["score"],
            detected_patterns=result["patterns"],
            is_malicious=result["is_malicious"],
            mitigation_suggestions=result["suggestions"]
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/evals/run", response_model=EvalRunResponse)
async def run_evaluation(request: EvalRunRequest):
    """Run evaluation tests"""
    try:
        results = await eval_service.run_evaluation(
            request.eval_run_id,
            request.dataset_path,
            request.policy_id
        )
        return EvalRunResponse(
            results=results["results"],
            scores=results["scores"],
            passed=results["passed"]
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/metrics/slo")
async def get_slo_metrics(client_id: Optional[str] = None, hours: int = 24):
    """Get SLO metrics"""
    try:
        metrics = await slo_monitor.get_metrics(client_id, hours)
        return metrics
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/metrics/record")
async def record_metric(
    metric_type: str,
    client_id: str,
    value: float,
    labels: Optional[Dict[str, Any]] = None
):
    """Record a metric"""
    try:
        await slo_monitor.record_metric(metric_type, client_id, value, labels or {})
        return {"status": "recorded"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
