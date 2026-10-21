import os
import sys
from datetime import timedelta
from pathlib import Path

from corsheaders.defaults import default_headers
from django.core.exceptions import ImproperlyConfigured

BASE_DIR = Path(__file__).resolve().parent.parent


def env_list(name: str, default: str = "") -> list[str]:
    return [v.strip() for v in os.environ.get(name, default).split(",") if v.strip()]


# Production is the default. Debug mode must be switched on explicitly
# (manage.py does this for local development; gunicorn/WSGI does not).
DEBUG = os.environ.get("DJANGO_DEBUG", "0") == "1"

SECRET_KEY = os.environ.get("DJANGO_SECRET_KEY", "")
ALLOWED_HOSTS = env_list("DJANGO_ALLOWED_HOSTS")

if DEBUG:
    SECRET_KEY = SECRET_KEY or "dev-only-insecure-key-change-me"
    ALLOWED_HOSTS = ALLOWED_HOSTS or ["*"]
else:
    # Refuse to start with settings that would be unsafe on a public server.
    missing = [name for name, value in [
        ("DJANGO_SECRET_KEY", SECRET_KEY),
        ("DJANGO_ALLOWED_HOSTS", ALLOWED_HOSTS),
    ] if not value]
    if missing:
        raise ImproperlyConfigured(
            f"Missing production settings: {', '.join(missing)}. "
            "Set them in the environment, or set DJANGO_DEBUG=1 for local development."
        )
    if len(SECRET_KEY) < 50 or SECRET_KEY.startswith("dev-only"):
        raise ImproperlyConfigured("DJANGO_SECRET_KEY must be a random value of at least 50 characters.")
    if "*" in ALLOWED_HOSTS:
        raise ImproperlyConfigured("DJANGO_ALLOWED_HOSTS must list real host names, not '*'.")

INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "rest_framework",
    "rest_framework_simplejwt",
    "rest_framework_simplejwt.token_blacklist",
    "corsheaders",
    "django_filters",
    "library",
]

MIDDLEWARE = [
    "corsheaders.middleware.CorsMiddleware",
    "django.middleware.security.SecurityMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "config.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    }
]

WSGI_APPLICATION = "config.wsgi.application"

# SQLite for local dev; swap via DATABASE_URL-style env for Postgres in production.
DATABASES = {
    "default": {
        "ENGINE": os.environ.get("DB_ENGINE", "django.db.backends.sqlite3"),
        "NAME": os.environ.get("DB_NAME", BASE_DIR / "db.sqlite3"),
        "USER": os.environ.get("DB_USER", ""),
        "PASSWORD": os.environ.get("DB_PASSWORD", ""),
        "HOST": os.environ.get("DB_HOST", ""),
        "PORT": os.environ.get("DB_PORT", ""),
    }
}

# The test suite creates hundreds of users; real password hashing would dominate its run time.
if "test" in sys.argv[1:2]:
    PASSWORD_HASHERS = ["django.contrib.auth.hashers.MD5PasswordHasher"]
    # Throttle counters would leak between tests; test_throttling.py switches a real cache on.
    CACHES = {"default": {"BACKEND": "django.core.cache.backends.dummy.DummyCache"}}

AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator"},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

LANGUAGE_CODE = "en-us"
TIME_ZONE = "UTC"
# The languages the app speaks. Email dates are written in the member's own (month names come from these).
LANGUAGES = [("en", "English"), ("fr", "Français"), ("ar", "العربية")]
USE_I18N = True
USE_TZ = True

STATIC_URL = "static/"
STATIC_ROOT = BASE_DIR / "staticfiles"  # collectstatic target for the admin site
MEDIA_URL = "media/"
MEDIA_ROOT = BASE_DIR / "media"
DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"
# Bulk book imports post up to 5,000 rows as JSON.
DATA_UPLOAD_MAX_MEMORY_SIZE = 10 * 1024 * 1024

REST_FRAMEWORK = {
    "EXCEPTION_HANDLER": "library.errors.exception_handler",
    # `?format=csv` on the export endpoints is a file format, not a content-negotiation hint.
    "URL_FORMAT_OVERRIDE": None,
    "DEFAULT_AUTHENTICATION_CLASSES": (
        "rest_framework_simplejwt.authentication.JWTAuthentication",
    ),
    "DEFAULT_PERMISSION_CLASSES": ("rest_framework.permissions.IsAuthenticated",),
    # Only views that set throttle_scope are limited.
    "DEFAULT_THROTTLE_CLASSES": ("rest_framework.throttling.ScopedRateThrottle",),
    "DEFAULT_THROTTLE_RATES": {
        "auth_login": "10/min",
        "auth_register": "5/hour",
        "auth_reset": "5/hour",  # password reset and verification emails
        "auth_refresh": "30/min",
    },
    # Number of reverse proxies in front of Django, so throttles key on the real client address.
    "NUM_PROXIES": int(os.environ.get("DJANGO_NUM_PROXIES", "0")),
}

SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(minutes=10),
    "REFRESH_TOKEN_LIFETIME": timedelta(days=7),
    "ROTATE_REFRESH_TOKENS": True,
    "BLACKLIST_AFTER_ROTATION": True,
    "UPDATE_LAST_LOGIN": True,
}

# The refresh token lives only in this httpOnly cookie (library/auth_views.py). Browsers block
# third-party cookies, so the API must be same-site with the frontend: same origin through a
# proxy (SameSite=Strict, the default) or a sibling subdomain (AUTH_COOKIE_SAMESITE=Lax plus
# AUTH_COOKIE_DOMAIN). See DEPLOYMENT.md.
AUTH_REFRESH_COOKIE = {
    "name": "lb_refresh",
    "path": "/api/auth",
    "samesite": os.environ.get("AUTH_COOKIE_SAMESITE", "Strict"),
    "secure": not DEBUG,
    "domain": os.environ.get("AUTH_COOKIE_DOMAIN") or None,
}
AUTH_CSRF_HEADER = "HTTP_X_LIBBORROW_CSRF"
if AUTH_REFRESH_COOKIE["samesite"] not in ("Strict", "Lax", "None"):
    raise ImproperlyConfigured("AUTH_COOKIE_SAMESITE must be Strict or Lax.")
if not DEBUG and AUTH_REFRESH_COOKIE["samesite"] == "None":
    raise ImproperlyConfigured(
        "AUTH_COOKIE_SAMESITE=None needs third-party cookies, which browsers block. "
        "Serve the API from the frontend's site instead (see DEPLOYMENT.md)."
    )

CORS_ALLOWED_ORIGINS = env_list("CORS_ALLOWED_ORIGINS", "http://localhost:3000" if DEBUG else "")
# Optional comma-separated regexes, e.g. ^https://libborrow-.*\.vercel\.app$ for Vercel previews.
CORS_ALLOWED_ORIGIN_REGEXES = env_list("CORS_ALLOWED_ORIGIN_REGEXES")
CORS_ALLOW_CREDENTIALS = True
CORS_ALLOW_HEADERS = (*default_headers, "x-libborrow-csrf")

# Frontend base URL used inside QR codes on ID cards.
FRONTEND_URL = os.environ.get("FRONTEND_URL", "http://localhost:3000")

LIBRARY_NAME = os.environ.get("LIBRARY_NAME", "Faculty of Law and Political Sciences Library")
# The time zone dates are written in inside emails (an IANA name, e.g. "Africa/Algiers"). Storage stays UTC.
LIBRARY_TIME_ZONE = os.environ.get("LIBRARY_TIME_ZONE", "UTC")

# Password reset links are valid for one hour (verification and invite links have their own rules).
PASSWORD_RESET_TIMEOUT = 3600

# Outgoing email: printed to the console in development, SMTP in production. The test runner
# swaps in Django's locmem backend by itself.
if DEBUG:
    # Overridable so the end-to-end suite can write messages to files it reads back (e2e/serve-django.mjs).
    EMAIL_BACKEND = os.environ.get("EMAIL_BACKEND", "django.core.mail.backends.console.EmailBackend")
    if os.environ.get("EMAIL_FILE_PATH"):
        EMAIL_FILE_PATH = os.environ["EMAIL_FILE_PATH"]
else:
    EMAIL_BACKEND = "django.core.mail.backends.smtp.EmailBackend"
    EMAIL_HOST = os.environ.get("EMAIL_HOST", "")
    EMAIL_PORT = int(os.environ.get("EMAIL_PORT", "587"))
    EMAIL_HOST_USER = os.environ.get("EMAIL_HOST_USER", "")
    EMAIL_HOST_PASSWORD = os.environ.get("EMAIL_HOST_PASSWORD", "")
    EMAIL_USE_TLS = os.environ.get("EMAIL_USE_TLS", "1") == "1"
DEFAULT_FROM_EMAIL = os.environ.get("DEFAULT_FROM_EMAIL", "LibBorrow <no-reply@localhost>")

# ---------------------------------------------------------------- production hardening
if not DEBUG:
    # Behind a TLS-terminating proxy (nginx, Render, Railway…) that sets X-Forwarded-Proto.
    SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
    SECURE_SSL_REDIRECT = os.environ.get("DJANGO_SSL_REDIRECT", "1") == "1"
    SESSION_COOKIE_SECURE = True
    CSRF_COOKIE_SECURE = True
    SECURE_HSTS_SECONDS = int(os.environ.get("DJANGO_HSTS_SECONDS", "3600"))
    SECURE_HSTS_INCLUDE_SUBDOMAINS = False
    SECURE_CONTENT_TYPE_NOSNIFF = True
    SECURE_REFERRER_POLICY = "same-origin"
    X_FRAME_OPTIONS = "DENY"
    CSRF_TRUSTED_ORIGINS = env_list("CSRF_TRUSTED_ORIGINS")

LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "handlers": {"console": {"class": "logging.StreamHandler"}},
    "root": {"handlers": ["console"], "level": os.environ.get("DJANGO_LOG_LEVEL", "INFO")},
}
