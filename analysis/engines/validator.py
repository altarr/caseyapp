"""Schema validator for structured analysis output.

Validates that LLM-generated JSON conforms to the expected schema
before it flows into summary building and HTML rendering.
"""


class ValidationError(Exception):
    """Raised when analysis output fails schema validation."""

    def __init__(self, errors: list):
        self.errors = errors
        super().__init__(f"Validation failed: {'; '.join(errors)}")


# -- Schema definitions --------------------------------------------------------

FACTUAL_SCHEMA = {
    "visitor_name": {"type": str, "required": True},
    "products_demonstrated": {"type": list, "required": True, "item_type": str},
    "key_interests": {"type": list, "required": True, "item_type": str},
    "follow_up_actions": {"type": list, "required": True},
    "demo_duration_seconds": {"type": (int, float), "required": True},
    "features_demonstrated": {"type": list, "required": False},
    "visitor_questions": {"type": list, "required": False},
    "key_moments": {"type": list, "required": False},
    "session_stats": {"type": dict, "required": False},
    "visitor_technical_level": {"type": str, "required": False},
}

RECOMMENDATIONS_SCHEMA = {
    "visitor_name": {"type": str, "required": True},
    "products_demonstrated": {"type": list, "required": True, "item_type": str},
    "key_interests": {"type": list, "required": True},
    "follow_up_actions": {"type": list, "required": True},
    "demo_duration_seconds": {"type": (int, float), "required": True},
    "engagement_rating": {"type": (int, float), "required": True},
    "executive_summary": {"type": str, "required": True},
    "sdr_notes": {"type": str, "required": False},
    "visitor_technical_level": {"type": str, "required": False},
}

SUMMARY_SCHEMA = {
    "session_id": {"type": str, "required": True},
    "visitor_name": {"type": str, "required": True},
    "products_demonstrated": {"type": list, "required": True, "item_type": str},
    "key_interests": {"type": list, "required": True},
    "follow_up_actions": {"type": list, "required": True},
    "demo_duration_seconds": {"type": (int, float), "required": True},
    "engagement_rating": {"type": (int, float), "required": True},
    "executive_summary": {"type": str, "required": True},
    "visitor_technical_level": {"type": str, "required": False},
}


# -- Validation functions ------------------------------------------------------

def _validate_against_schema(data: dict, schema: dict, label: str) -> list:
    """Validate a dict against a schema definition. Returns list of error strings."""
    errors = []

    if not isinstance(data, dict):
        return [f"{label}: expected dict, got {type(data).__name__}"]

    for field, rules in schema.items():
        value = data.get(field)

        # Required check
        if rules.get("required") and value is None:
            errors.append(f"{label}: missing required field '{field}'")
            continue

        if value is None:
            continue

        # Type check
        expected_type = rules["type"]
        if not isinstance(value, expected_type):
            errors.append(
                f"{label}: field '{field}' expected {expected_type}, "
                f"got {type(value).__name__}"
            )
            continue

        # Array item type check
        if isinstance(value, list) and "item_type" in rules:
            item_type = rules["item_type"]
            for i, item in enumerate(value):
                if not isinstance(item, item_type):
                    errors.append(
                        f"{label}: field '{field}[{i}]' expected {item_type.__name__}, "
                        f"got {type(item).__name__}"
                    )

    return errors


def validate_factual(data: dict) -> list:
    """Validate factual extraction output. Returns list of error strings (empty = valid)."""
    errors = _validate_against_schema(data, FACTUAL_SCHEMA, "factual")
    if not isinstance(data, dict):
        return errors

    # visitor_name must be non-empty
    name = data.get("visitor_name", "")
    if isinstance(name, str) and not name.strip():
        errors.append("factual: 'visitor_name' must not be empty")

    # demo_duration_seconds must be non-negative
    dur = data.get("demo_duration_seconds")
    if isinstance(dur, (int, float)) and dur < 0:
        errors.append("factual: 'demo_duration_seconds' must be >= 0")

    return errors


def validate_recommendations(data: dict) -> list:
    """Validate recommendations output. Returns list of error strings (empty = valid)."""
    errors = _validate_against_schema(data, RECOMMENDATIONS_SCHEMA, "recommendations")

    # engagement_rating must be 1-5
    score = data.get("engagement_rating")
    if isinstance(score, (int, float)) and not (1 <= score <= 5):
        errors.append("recommendations: 'engagement_rating' must be between 1 and 5")

    return errors


def validate_summary(data: dict) -> list:
    """Validate final summary output. Returns list of error strings (empty = valid)."""
    errors = _validate_against_schema(data, SUMMARY_SCHEMA, "summary")
    if not isinstance(data, dict):
        return errors

    # engagement_rating must be 0-5
    rating = data.get("engagement_rating")
    if isinstance(rating, (int, float)) and rating > 5:
        errors.append("summary: 'engagement_rating' exceeds maximum of 5")

    # key_interests confidence must be high/medium/low
    valid_conf = {"high", "medium", "low"}
    for i, interest in enumerate(data.get("key_interests") or []):
        if isinstance(interest, dict):
            conf = interest.get("confidence")
            if conf and conf not in valid_conf:
                errors.append(
                    f"summary: 'key_interests[{i}].confidence' invalid value '{conf}'"
                )

    return errors


def validate_or_raise(data: dict, schema_name: str) -> dict:
    """Validate and return data, or raise ValidationError.

    schema_name: one of 'factual', 'recommendations', 'summary'
    """
    validators = {
        "factual": validate_factual,
        "recommendations": validate_recommendations,
        "summary": validate_summary,
    }

    validator = validators.get(schema_name)
    if not validator:
        raise ValueError(f"Unknown schema: {schema_name}")

    errors = validator(data)
    if errors:
        raise ValidationError(errors)

    return data


def validate_summary_or_raise(data: dict) -> dict:
    """Validate summary output, raising ValidationError on failure."""
    return validate_or_raise(data, "summary")
