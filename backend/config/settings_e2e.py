"""Settings for the Playwright end-to-end run (e2e/serve-django.mjs). Never used in production.

The suite signs in and reloads hundreds of times from one address, which the real sign-in and
refresh limits would reject, so only those limits are lifted. Everything else is config.settings.
"""
from .settings import *  # noqa: F401,F403
from .settings import REST_FRAMEWORK

REST_FRAMEWORK = {
    **REST_FRAMEWORK,
    "DEFAULT_THROTTLE_RATES": {scope: "100000/min" for scope in REST_FRAMEWORK["DEFAULT_THROTTLE_RATES"]},
}
