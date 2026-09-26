SEVERITY_POINTS = {
    "Critical": 25,
    "High": 15,
    "Medium": 8,
    "Low": 3,
    "Informational": 1,
}


def calculate_score(findings):
    total_risk = 0
    for finding in findings or []:
        severity = finding.get("severity", "Low")
        total_risk += SEVERITY_POINTS.get(severity, 0)

    return max(0, min(100, 100 - total_risk))


def get_grade(score):
    if score >= 90:
        return "A"
    if score >= 75:
        return "B"
    if score >= 60:
        return "C"
    if score >= 40:
        return "D"
    return "F"


def get_risk_level(score):
    if score >= 90:
        return "Low"
    if score >= 75:
        return "Moderate"
    if score >= 60:
        return "High"
    return "Critical"


def calculate_risk(findings):
    score = calculate_score(findings)
    return {
        "score": score,
        "grade": get_grade(score),
        "risk_level": get_risk_level(score),
    }


def build_score_explanation(findings, score, grade, risk_level):
    findings = findings or []
    deductions = []
    total_deduction = 0

    for finding in findings:
        severity = finding.get("severity", "Low")
        points = SEVERITY_POINTS.get(severity, 0)
        if points:
            deductions.append({
                "title": finding.get("title", "Security finding"),
                "severity": severity,
                "points": points,
            })
            total_deduction += points

    return {
        "method": "Web score = 100 minus weighted finding deductions.",
        "starting_score": 100,
        "total_deduction": total_deduction,
        "finding_deductions": deductions,
        "final_score": score,
        "grade": grade,
        "risk_level": risk_level,
        "grade_thresholds": {
            "A": "90-100",
            "B": "75-89",
            "C": "60-74",
            "D": "40-59",
            "F": "0-39",
        },
        "risk_thresholds": {
            "Low": "90-100",
            "Moderate": "75-89",
            "High": "60-74",
            "Critical": "0-59",
        },
    }
