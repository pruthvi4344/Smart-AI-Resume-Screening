"""
Flask REST API
==============
Backend API for the Explainable Hybrid AI Resume Screening System.
Provides endpoints for resume screening, job description management,
custom rules, PDF upload, and model metrics.
"""

import os
import sys
import json
import io
import numpy as np
from flask import Flask, request, jsonify
from flask_cors import CORS

app = Flask(__name__)

CORS(app, origins=[
    "https://resume-screening-sandy.vercel.app",
    "http://localhost:5173",
    "http://127.0.0.1:5173"
])
@app.get("/")
def home():
    return {
        "status": "ok",
        "service": "Resume Screening API",
        "endpoints": ["/health", "/api/screen"]
    }
@app.get("/health")
def health():
    return {"ok": True}
# Add project root to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from modules.pii_masker import PIIMasker
from modules.feature_extractor import FeatureExtractor
from modules.rule_engine import RuleEngine, Rule
from modules.ml_models import HybridMLModel
from modules.hybrid_engine import HybridDecisionEngine
from modules.explainer import ExplanationGenerator
from data.prepare_data import JOB_SKILL_POOLS

# PDF support
try:
    from PyPDF2 import PdfReader
    PDF_SUPPORT = True
except ImportError:
    PDF_SUPPORT = False
    print("WARNING: PyPDF2 not installed. PDF upload will not work.")



# Global instances
masker = PIIMasker()
decision_engine = HybridDecisionEngine(ml_threshold=0.5)
explainer = ExplanationGenerator()

# In-memory storage for custom job descriptions and rules
custom_job_descriptions = {}
custom_rules_store = {}  # keyed by job_desc_id

# Load models cache
loaded_models = {}


def get_model(category):
    """Load or retrieve cached model for a job category."""
    if category not in loaded_models:
        model = HybridMLModel(alpha=0.5)
        model_dir = os.path.join("models", category)
        if os.path.exists(model_dir):
            model.load(model_dir)
            loaded_models[category] = model
        else:
            return None
    return loaded_models[category]


def extract_text_from_pdf(file_bytes):
    """Extract text from a PDF file."""
    if not PDF_SUPPORT:
        return None, "PyPDF2 is not installed"
    try:
        reader = PdfReader(io.BytesIO(file_bytes))
        text = ""
        for page in reader.pages:
            page_text = page.extract_text()
            if page_text:
                text += page_text + "\n"
        return text.strip(), None
    except Exception as e:
        return None, str(e)


def _init_sample_job_descriptions():
    """Initialize sample job descriptions on startup."""
    for key, pool in JOB_SKILL_POOLS.items():
        custom_job_descriptions[key] = {
            "id": key,
            "title": pool["title"],
            "required_skills": pool["required"],
            "preferred_skills": pool["preferred"],
            "min_experience": pool["min_experience"],
            "min_education": pool["min_education"],
            "min_skill_match_ratio": 0.5,
            "min_total_skills": 3,
            "description": (
                f"We are seeking a talented {pool['title']} to join our team. "
                f"The ideal candidate will have at least {pool['min_experience']} "
                f"years of experience and proficiency in {', '.join(pool['required'])}. "
                f"Nice to have: {', '.join(pool['preferred'][:5])}. "
                f"Minimum education: {pool['min_education'].title()} degree."
            ),
            "is_sample": True,
        }
        custom_rules_store[key] = []


# Initialize on startup
_init_sample_job_descriptions()


# ========== PDF UPLOAD ==========

@app.route("/api/upload-pdf", methods=["POST"])
def upload_pdf():
    """
    Upload a PDF file and extract text.
    Returns the extracted text content.
    """
    if "file" not in request.files:
        return jsonify({"error": "No file provided"}), 400

    file = request.files["file"]
    if not file.filename.lower().endswith(".pdf"):
        return jsonify({"error": "Only PDF files are supported"}), 400

    file_bytes = file.read()
    text, error = extract_text_from_pdf(file_bytes)

    if error:
        return jsonify({"error": f"Failed to parse PDF: {error}"}), 400

    if not text or len(text.strip()) < 10:
        return jsonify({"error": "Could not extract meaningful text from PDF"}), 400

    return jsonify({
        "text": text,
        "filename": file.filename,
        "char_count": len(text),
    })


# ========== JOB DESCRIPTIONS ==========

@app.route("/api/job-descriptions", methods=["GET"])
def get_job_descriptions():
    """Return all job descriptions (sample + custom)."""
    return jsonify(custom_job_descriptions)


@app.route("/api/job-descriptions", methods=["POST"])
def create_job_description():
    """
    Create a new job description.

    Request JSON:
    {
        "title": "Frontend Developer",
        "required_skills": ["react", "javascript", "css"],
        "preferred_skills": ["typescript", "next.js"],
        "min_experience": 2,
        "min_education": "bachelor",
        "min_skill_match_ratio": 0.5,
        "min_total_skills": 3,
        "description": "We are looking for..."
    }
    """
    data = request.get_json()

    if not data or "title" not in data:
        return jsonify({"error": "title is required"}), 400

    # Generate ID from title
    jd_id = data["title"].lower().replace(" ", "_").replace("-", "_")
    # Ensure uniqueness
    base_id = jd_id
    counter = 1
    while jd_id in custom_job_descriptions:
        jd_id = f"{base_id}_{counter}"
        counter += 1

    required_skills = data.get("required_skills", [])
    if isinstance(required_skills, str):
        required_skills = [s.strip() for s in required_skills.split(",") if s.strip()]

    preferred_skills = data.get("preferred_skills", [])
    if isinstance(preferred_skills, str):
        preferred_skills = [s.strip() for s in preferred_skills.split(",") if s.strip()]

    jd = {
        "id": jd_id,
        "title": data["title"],
        "required_skills": [s.lower() for s in required_skills],
        "preferred_skills": [s.lower() for s in preferred_skills],
        "min_experience": int(data.get("min_experience", 0)),
        "min_education": data.get("min_education", "bachelor").lower(),
        "min_skill_match_ratio": float(data.get("min_skill_match_ratio", 0.5)),
        "min_total_skills": int(data.get("min_total_skills", 3)),
        "description": data.get("description", ""),
        "is_sample": False,
    }

    custom_job_descriptions[jd_id] = jd
    custom_rules_store[jd_id] = []

    return jsonify(jd), 201


@app.route("/api/job-descriptions/<jd_id>", methods=["DELETE"])
def delete_job_description(jd_id):
    """Delete a job description."""
    if jd_id not in custom_job_descriptions:
        return jsonify({"error": "Job description not found"}), 404
    del custom_job_descriptions[jd_id]
    custom_rules_store.pop(jd_id, None)
    return jsonify({"message": f"Deleted job description: {jd_id}"})


@app.route("/api/job-descriptions/from-text", methods=["POST"])
def create_jd_from_text():
    """
    Auto-generate structured job description from raw text.
    Parses a job posting text to extract requirements.
    """
    data = request.get_json()
    text = data.get("text", "")

    if not text or len(text.strip()) < 20:
        return jsonify({"error": "Job description text is too short"}), 400

    # Use feature extractor to parse the text for skills
    from modules.feature_extractor import SKILL_CATEGORIES
    text_lower = text.lower()

    found_skills = []
    for category, skills in SKILL_CATEGORIES.items():
        for skill in skills:
            if skill in text_lower:
                found_skills.append(skill)
    found_skills = list(set(found_skills))

    # Try to extract experience requirement
    import re
    exp_matches = re.findall(r'(\d+)\+?\s*years?', text_lower)
    min_exp = int(exp_matches[0]) if exp_matches else 0

    # Try to extract education
    edu_level = "bachelor"
    if "phd" in text_lower or "ph.d" in text_lower:
        edu_level = "phd"
    elif "master" in text_lower or "m.s." in text_lower:
        edu_level = "master"

    # Try to extract title (first line or "title" keyword)
    lines = [l.strip() for l in text.split("\n") if l.strip()]
    title = lines[0] if lines else "Custom Position"
    # Keep title short
    if len(title) > 60:
        title = title[:60]

    # Split skills into required (first half) and preferred (rest)
    mid = max(len(found_skills) // 2, 1)
    required = found_skills[:mid] if found_skills else ["python"]
    preferred = found_skills[mid:] if len(found_skills) > mid else []

    jd_data = {
        "title": title,
        "required_skills": required,
        "preferred_skills": preferred,
        "min_experience": min_exp,
        "min_education": edu_level,
        "description": text[:500],
    }

    # Delegate to the create endpoint logic
    jd_id = title.lower().replace(" ", "_").replace("-", "_")
    base_id = jd_id
    counter = 1
    while jd_id in custom_job_descriptions:
        jd_id = f"{base_id}_{counter}"
        counter += 1

    jd = {
        "id": jd_id,
        "title": jd_data["title"],
        "required_skills": jd_data["required_skills"],
        "preferred_skills": jd_data["preferred_skills"],
        "min_experience": jd_data["min_experience"],
        "min_education": jd_data["min_education"],
        "min_skill_match_ratio": 0.5,
        "min_total_skills": 3,
        "description": jd_data["description"],
        "is_sample": False,
    }

    custom_job_descriptions[jd_id] = jd
    custom_rules_store[jd_id] = []

    return jsonify(jd), 201


# ========== CUSTOM RULES ==========

@app.route("/api/rules/<jd_id>", methods=["GET"])
def get_custom_rules(jd_id):
    """Get custom rules for a job description."""
    rules = custom_rules_store.get(jd_id, [])
    return jsonify(rules)


@app.route("/api/rules/<jd_id>", methods=["POST"])
def add_custom_rule(jd_id):
    """
    Add a custom rule to a job description.

    Request JSON:
    {
        "name": "Specific Certification",
        "field": "skills_found",
        "operator": "contains",
        "value": "aws",
        "is_critical": false,
        "description": "Candidate should have AWS certification"
    }

    Supported fields: skill_match_ratio, experience_years, education_score,
                      total_skills_count, skills_found
    Supported operators: gte (>=), lte (<=), eq (==), contains, not_contains
    """
    if jd_id not in custom_job_descriptions:
        return jsonify({"error": "Job description not found"}), 404

    data = request.get_json()
    if not data or "name" not in data:
        return jsonify({"error": "Rule name is required"}), 400

    rule = {
        "id": f"custom_{len(custom_rules_store.get(jd_id, []))}_{data['name'].lower().replace(' ', '_')}",
        "name": data["name"],
        "field": data.get("field", "skills_found"),
        "operator": data.get("operator", "contains"),
        "value": data.get("value", ""),
        "is_critical": data.get("is_critical", False),
        "description": data.get("description", data["name"]),
    }

    if jd_id not in custom_rules_store:
        custom_rules_store[jd_id] = []
    custom_rules_store[jd_id].append(rule)

    return jsonify(rule), 201


@app.route("/api/rules/<jd_id>/<rule_id>", methods=["DELETE"])
def delete_custom_rule(jd_id, rule_id):
    """Delete a custom rule."""
    if jd_id not in custom_rules_store:
        return jsonify({"error": "Job description not found"}), 404

    rules = custom_rules_store[jd_id]
    custom_rules_store[jd_id] = [r for r in rules if r["id"] != rule_id]
    return jsonify({"message": f"Deleted rule: {rule_id}"})


# ========== SCREENING ==========

def _apply_custom_rules(features, custom_rules):
    """Evaluate custom rules against features."""
    results = []
    for rule in custom_rules:
        field = rule["field"]
        op = rule["operator"]
        value = rule["value"]

        passed = False
        reason = ""

        if field == "skills_found":
            skills_lower = [s.lower() for s in features.get("skills_found", [])]
            if op == "contains":
                passed = value.lower() in skills_lower
                reason = (
                    f"Skill '{value}' {'found' if passed else 'not found'} "
                    f"in candidate's skill set"
                )
            elif op == "not_contains":
                passed = value.lower() not in skills_lower
                reason = (
                    f"Skill '{value}' {'not found (good)' if passed else 'found'} "
                    f"in candidate's skill set"
                )
        elif field in ("skill_match_ratio", "experience_years",
                       "education_score", "total_skills_count"):
            actual = features.get(field, 0)
            try:
                target = float(value)
            except (ValueError, TypeError):
                target = 0

            if op == "gte":
                passed = actual >= target
                reason = f"{field.replace('_', ' ').title()}: {actual} {'≥' if passed else '<'} {target}"
            elif op == "lte":
                passed = actual <= target
                reason = f"{field.replace('_', ' ').title()}: {actual} {'≤' if passed else '>'} {target}"
            elif op == "eq":
                passed = actual == target
                reason = f"{field.replace('_', ' ').title()}: {actual} {'==' if passed else '!='} {target}"
        else:
            passed = True
            reason = f"Unknown field: {field}"

        results.append({
            "rule_name": rule["name"],
            "description": rule["description"],
            "passed": passed,
            "reason": reason,
            "is_critical": rule.get("is_critical", False),
            "is_custom": True,
        })

    return results


@app.route("/api/health", methods=["GET"])
def health_check():
    """Health check endpoint."""
    return jsonify({"status": "ok", "message": "Resume Screening API is running"})


@app.route("/api/screen", methods=["POST"])
def screen_resume():
    """
    Screen a resume against a job description.

    Request JSON:
    {
        "resume_text": "...",
        "job_category": "software_engineer"
    }

    Or with form data (for PDF upload):
    - resume_file: PDF file
    - job_category: string
    """
    # Handle both JSON and form data
    if request.content_type and "multipart/form-data" in request.content_type:
        resume_text = ""
        if "resume_file" in request.files:
            file = request.files["resume_file"]
            if file.filename.lower().endswith(".pdf"):
                text, err = extract_text_from_pdf(file.read())
                if err:
                    return jsonify({"error": f"PDF parse error: {err}"}), 400
                resume_text = text
            else:
                return jsonify({"error": "Only PDF files supported"}), 400
        else:
            resume_text = request.form.get("resume_text", "")
        job_category = request.form.get("job_category", "software_engineer")
    else:
        data = request.get_json()
        if not data:
            return jsonify({"error": "No data provided"}), 400
        resume_text = data.get("resume_text", "")
        job_category = data.get("job_category", "software_engineer")

    if not resume_text or len(resume_text.strip()) < 10:
        return jsonify({"error": "Resume text is required (min 10 characters)"}), 400

    # Look up job description
    jd = custom_job_descriptions.get(job_category)
    if not jd:
        return jsonify({
            "error": f"Job description '{job_category}' not found. Please add a job description first.",
            "available": list(custom_job_descriptions.keys()),
        }), 400

    # Step 1: Mask PII
    pii_result = masker.mask(resume_text)

    # Step 2: Extract features
    extractor = FeatureExtractor(
        required_skills=jd["required_skills"],
        min_experience=jd["min_experience"],
        min_education=jd["min_education"],
    )
    features = extractor.extract(pii_result["masked_text"])

    # Step 3: Rule-based evaluation
    rule_engine = RuleEngine(job_requirements={
        "min_experience": jd["min_experience"],
        "min_skill_match_ratio": jd.get("min_skill_match_ratio", 0.5),
        "min_education": jd["min_education"],
        "min_total_skills": jd.get("min_total_skills", 3),
    })
    rule_result = rule_engine.evaluate(features)

    # Apply custom rules
    custom_rules = custom_rules_store.get(job_category, [])
    if custom_rules:
        custom_results = _apply_custom_rules(features, custom_rules)
        rule_result["rule_results"].extend(custom_results)
        rule_result["rules_total"] += len(custom_results)

        # Re-check critical failures
        custom_critical_failures = [
            r for r in custom_results if r["is_critical"] and not r["passed"]
        ]
        if custom_critical_failures:
            rule_result["critical_failures"].extend(
                [r["rule_name"] for r in custom_critical_failures]
            )
            rule_result["passed_all_critical"] = False
            rule_result["decision"] = "REJECT"

        rules_passed = sum(1 for r in rule_result["rule_results"] if r["passed"])
        rule_result["rules_passed"] = rules_passed
        rule_result["summary"] = (
            f"Rule-based screening: {'PASSED' if rule_result['decision'] == 'ACCEPT' else 'FAILED'} "
            f"({rules_passed}/{rule_result['rules_total']} rules met)"
        )

    # Step 4: ML prediction - find closest model category
    model = get_model(job_category)
    if not model:
        # Try to find closest matching category
        for cat_key in JOB_SKILL_POOLS:
            model = get_model(cat_key)
            if model:
                break

    if model and model.is_trained:
        fv = features["feature_vector"]
        X = np.array([[
            fv["skill_match_ratio"],
            fv["experience_years"],
            fv["education_score"],
            fv["total_skills_normalized"],
        ]])
        ml_result = model.predict(X[0])
    else:
        # Fallback scoring
        fv = features["feature_vector"]
        score = (
            fv["skill_match_ratio"] * 0.4 +
            fv["experience_years"] * 0.3 +
            fv["education_score"] * 0.2 +
            fv["total_skills_normalized"] * 0.1
        )
        ml_result = {
            "decision": "ACCEPT" if score >= 0.5 else "REJECT",
            "confidence": round(score, 4),
            "lr_probability": round(score, 4),
            "nb_probability": round(score, 4),
            "hybrid_probability": round(score, 4),
            "feature_contributions": {
                "skill_match_ratio": {
                    "weight": 0.4, "value": round(fv["skill_match_ratio"], 4),
                    "contribution": round(0.4 * fv["skill_match_ratio"], 4),
                },
                "experience_years": {
                    "weight": 0.3, "value": round(fv["experience_years"], 4),
                    "contribution": round(0.3 * fv["experience_years"], 4),
                },
                "education_score": {
                    "weight": 0.2, "value": round(fv["education_score"], 4),
                    "contribution": round(0.2 * fv["education_score"], 4),
                },
                "total_skills": {
                    "weight": 0.1,
                    "value": round(fv["total_skills_normalized"], 4),
                    "contribution": round(0.1 * fv["total_skills_normalized"], 4),
                },
            },
            "model_note": "Using fallback scoring (no trained model for this category)",
        }

    # Step 5: Hybrid decision
    hybrid_result = decision_engine.decide(rule_result, ml_result)

    # Step 6: Generate explanation
    explanation = explainer.generate(hybrid_result, features)

    # Build response
    response = {
        "decision": hybrid_result["final_decision"],
        "confidence": hybrid_result["confidence"],
        "pii": {
            "masked_text": pii_result["masked_text"],
            "pii_detected": pii_result["pii_detected"],
            "pii_report": pii_result["pii_report"],
        },
        "features": {
            "skills_matched": features["skills_matched"],
            "skills_missing": features["skills_missing"],
            "skill_match_ratio": features["skill_match_ratio"],
            "experience_years": features["experience_years"],
            "education_level": features["education_level"],
            "education_score": features["education_score"],
            "total_skills_count": features["total_skills_count"],
            "skill_categories": features["skill_categories"],
        },
        "rule_analysis": {
            "decision": rule_result["decision"],
            "rules_passed": rule_result["rules_passed"],
            "rules_total": rule_result["rules_total"],
            "rule_results": rule_result["rule_results"],
            "summary": rule_result["summary"],
        },
        "ml_analysis": {
            "lr_probability": ml_result.get("lr_probability", 0),
            "nb_probability": ml_result.get("nb_probability", 0),
            "hybrid_probability": ml_result.get("hybrid_probability", 0),
            "feature_contributions": ml_result.get("feature_contributions", {}),
        },
        "explanation": {
            "summary": explanation["summary"],
            "decision_basis": explanation["decision_explanation"],
            "rule_explanations": explanation["rule_explanations"],
            "ml_explanation": explanation["ml_explanation"],
            "positive_factors": explanation["positive_factors"],
            "negative_factors": explanation["negative_factors"],
            "recommendation": explanation["recommendation"],
        },
        "job_category": job_category,
        "job_title": jd["title"],
    }

    return jsonify(response)


@app.route("/api/metrics", methods=["GET"])
def get_metrics():
    """Return training metrics for all models."""
    metrics_path = os.path.join("models", "training_metrics.json")
    if os.path.exists(metrics_path):
        with open(metrics_path) as f:
            return jsonify(json.load(f))
    return jsonify({"message": "No training metrics found. Run train_models.py first."})


@app.route("/api/sample-resumes", methods=["GET"])
def get_sample_resumes():
    """Return sample resumes for testing."""
    from data.prepare_data import generate_resume_text

    samples = {}
    for category in JOB_SKILL_POOLS:
        samples[category] = {
            "good": generate_resume_text(category, "good"),
            "average": generate_resume_text(category, "average"),
            "poor": generate_resume_text(category, "poor"),
        }
    return jsonify(samples)


if __name__ == "__main__":
    print("=" * 60)
    print("Resume Screening API")
    print("=" * 60)
    print("Starting Flask server on http://localhost:5000")
    print("React frontend should run on http://localhost:5173")
    print(f"Job descriptions loaded: {len(custom_job_descriptions)}")
    print("=" * 60)
    app.run(debug=True, port=5000)
