"""JSON schema validation for analysis output."""

import json

SUMMARY_SCHEMA = {
    "type": "object",
    "required": [
        "session_id",
        "visitor_name",
        "se_name",
        "products_demonstrated",
        "key_interests",
        "follow_up_actions",
        "demo_duration_seconds",
        "session_score",
        "executive_summary",
        "key_moments",
        "generated_at",
    ],
    "properties": {
        "session_id": {"type": "string"},
        "visitor_name": {"type": "string"},
        "se_name": {"type": "string"},
        "products_demonstrated": {
            "type": "array",
            "items": {"type": "string"},
        },
        "key_interests": {
            "type": "array",
            "items": {
                "type": "object",
                "required": ["topic", "confidence", "evidence"],
                "properties": {
                    "topic": {"type": "string"},
                    "confidence": {"type": "string", "enum": ["high", "medium", "low"]},
                    "evidence": {"type": "string"},
                },
            },
        },
        "follow_up_actions": {
            "type": "array",
            "items": {"type": "string"},
        },
        "demo_duration_seconds": {"type": "integer", "minimum": 0},
        "session_score": {"type": "integer", "minimum": 0, "maximum": 10},
        "executive_summary": {"type": "string"},
        "key_moments": {
            "type": "array",
            "items": {
                "type": "object",
                "required": ["timestamp", "description", "impact"],
                "properties": {
                    "timestamp": {"type": "string"},
                    "screenshot": {"type": ["string", "null"]},
                    "description": {"type": "string"},
                    "impact": {"type": "string"},
                },
            },
        },
        "v1_tenant_link": {"type": "string"},
        "generated_at": {"type": "string"},
    },
}

FOLLOW_UP_SCHEMA = {
    "type": "object",
    "required": [
        "session_id",
        "visitor_email",
        "priority",
        "tags",
        "sdr_notes",
    ],
    "properties": {
        "session_id": {"type": "string"},
        "visitor_email": {"type": "string"},
        "subject": {"type": "string"},
        "summary_url": {"type": "string"},
        "tenant_url": {"type": "string"},
        "priority": {"type": "string", "enum": ["high", "medium", "low"]},
        "tags": {
            "type": "array",
            "items": {"type": "string"},
        },
        "sdr_notes": {"type": "string"},
    },
}


class ValidationError(Exception):
    """Raised when output fails schema validation."""

    def __init__(self, errors: list):
        self.errors = errors
        super().__init__(f"Schema validation failed: {'; '.join(errors)}")


def validate_summary(data: dict) -> list:
    """Validate summary.json against the schema. Returns list of error strings (empty = valid)."""
    errors = []
    _validate_object(data, SUMMARY_SCHEMA, "root", errors)
    return errors


def validate_summary_or_raise(data: dict):
    """Validate summary.json, raise ValidationError if invalid."""
    errors = validate_summary(data)
    if errors:
        raise ValidationError(errors)


def validate_follow_up(data: dict) -> list:
    """Validate follow-up.json against the schema. Returns list of error strings (empty = valid)."""
    errors = []
    _validate_object(data, FOLLOW_UP_SCHEMA, "root", errors)
    return errors


def validate_follow_up_or_raise(data: dict):
    """Validate follow-up.json, raise ValidationError if invalid."""
    errors = validate_follow_up(data)
    if errors:
        raise ValidationError(errors)


def _validate_object(data, schema, path, errors):
    expected_type = schema.get("type")

    if expected_type == "object":
        if not isinstance(data, dict):
            errors.append(f"{path}: expected object, got {type(data).__name__}")
            return

        for field in schema.get("required", []):
            if field not in data:
                errors.append(f"{path}: missing required field '{field}'")

        props = schema.get("properties", {})
        for key, value in data.items():
            if key in props:
                _validate_object(value, props[key], f"{path}.{key}", errors)

    elif expected_type == "array":
        if not isinstance(data, list):
            errors.append(f"{path}: expected array, got {type(data).__name__}")
            return
        item_schema = schema.get("items")
        if item_schema:
            for i, item in enumerate(data):
                _validate_object(item, item_schema, f"{path}[{i}]", errors)

    elif expected_type == "string":
        if not isinstance(data, str):
            errors.append(f"{path}: expected string, got {type(data).__name__}")
        enum_values = schema.get("enum")
        if enum_values and data not in enum_values:
            errors.append(f"{path}: '{data}' not in {enum_values}")

    elif expected_type == "integer":
        if not isinstance(data, int) or isinstance(data, bool):
            errors.append(f"{path}: expected integer, got {type(data).__name__}")
            return
        if "minimum" in schema and data < schema["minimum"]:
            errors.append(f"{path}: {data} < minimum {schema['minimum']}")
        if "maximum" in schema and data > schema["maximum"]:
            errors.append(f"{path}: {data} > maximum {schema['maximum']}")

    elif isinstance(expected_type, list):
        # Union types like ["string", "null"]
        valid = False
        for t in expected_type:
            if t == "null" and data is None:
                valid = True
            elif t == "string" and isinstance(data, str):
                valid = True
        if not valid:
            errors.append(f"{path}: expected one of {expected_type}, got {type(data).__name__}")
