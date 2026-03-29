import os
import anthropic


def get_client() -> anthropic.Anthropic:
    base_url = os.environ.get("RONE_AI_BASE_URL", "https://api.anthropic.com")
    api_key = os.environ.get("RONE_AI_API_KEY") or os.environ.get("ANTHROPIC_API_KEY")
    return anthropic.Anthropic(api_key=api_key, base_url=base_url)
