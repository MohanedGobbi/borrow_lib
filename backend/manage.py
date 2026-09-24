#!/usr/bin/env python
import os
import sys

if __name__ == "__main__":
    os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
    # manage.py is the developer tool: default to debug mode locally. Production
    # servers run through WSGI (gunicorn), which never sets this, and cron jobs
    # there should export DJANGO_DEBUG=0 along with the real settings.
    os.environ.setdefault("DJANGO_DEBUG", "1")
    from django.core.management import execute_from_command_line

    execute_from_command_line(sys.argv)
