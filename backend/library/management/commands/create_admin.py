"""Create the library's first administrator (الموظف المسؤول), who then creates every other account from the site.

    python manage.py create_admin --email admin@univ-ghardaia.dz --name "اسم المسؤول" --phone 0661000000

The password is asked for (twice) unless --password is given.
"""
from getpass import getpass

from django.contrib.auth.models import User
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from library.models import Role, UserProfile


class Command(BaseCommand):
    help = "Create an administrator account with its library profile."

    def add_arguments(self, parser):
        parser.add_argument("--email", required=True)
        parser.add_argument("--name", required=True, help="Full name.")
        parser.add_argument("--phone", default="")
        parser.add_argument("--password", help="Asked for interactively when left out.")

    def handle(self, email, name, phone, password, **options):
        email = email.strip().lower()
        if User.objects.filter(email__iexact=email).exists():
            raise CommandError(f"An account with {email} already exists.")
        if password is None:
            password = getpass("Password: ")
            if password != getpass("Password (again): "):
                raise CommandError("The passwords do not match.")
        first, _, last = name.strip().partition(" ")
        try:
            validate_password(password, User(username=email, email=email, first_name=first))
        except ValidationError as e:
            raise CommandError(" ".join(e.messages))
        with transaction.atomic():
            user = User.objects.create_user(username=email, email=email, password=password,
                                            first_name=first, last_name=last, is_staff=True)
            profile = UserProfile.objects.create(user=user, role=Role.ADMIN, phone_number=phone)
        self.stdout.write(self.style.SUCCESS(f"Administrator {email} created (card {profile.student_or_staff_id})."))
