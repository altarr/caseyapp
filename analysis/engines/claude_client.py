import os
import anthropic


def get_client():
    if os.environ.get('USE_BEDROCK', '').strip() in ('1', 'true', 'yes'):
        from anthropic import AnthropicBedrock
        return AnthropicBedrock(aws_region=os.environ.get('AWS_REGION', 'us-east-1'))
    base_url = os.environ.get('RONE_AI_BASE_URL', 'https://api.anthropic.com')
    api_key = os.environ.get('RONE_AI_API_KEY') or os.environ.get('ANTHROPIC_API_KEY')
    return anthropic.Anthropic(api_key=api_key, base_url=base_url)
