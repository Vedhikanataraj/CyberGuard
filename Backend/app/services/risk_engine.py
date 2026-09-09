SEVERITY_POINTS = {
    "Critical": 25,
    "High": 15,
    "Medium": 8,
    "Low": 3,
    "Informational": 1,
}


def calculate_score(findings):

    total_risk = 0

    for finding in findings:

        severity = finding.get(
            "severity",
            "Low"
        )

        total_risk += SEVERITY_POINTS.get(
            severity,
            0
        )

    score = max(
        0,
        min(
            100,
            100 - total_risk
        )
    )

    return score


def get_grade(score):

    if score >= 90:
        return "A"

    elif score >= 75:
        return "B"

    elif score >= 60:
        return "C"

    elif score >= 40:
        return "D"

    return "F"


def get_risk_level(score):

    if score >= 90:
        return "Low"

    elif score >= 75:
        return "Moderate"

    elif score >= 60:
        return "High"

    elif score >= 40:
        return "High"

    return "Critical"


def calculate_risk(findings):

    score = calculate_score(findings)

    return {
        "score": score,
        "grade": get_grade(score),
        "risk_level": get_risk_level(score)
    }