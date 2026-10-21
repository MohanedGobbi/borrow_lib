"""Email reminders: ready for pickup, due soon, overdue.

Django's locmem backend collects what is sent in mail.outbox. Holds send their email when the
transaction commits, so the tests that create one run inside captureOnCommitCallbacks.
"""
from datetime import datetime, timedelta, timezone as dt_timezone
from io import StringIO
from unittest import mock

from django.core import mail
from django.core.management import call_command
from django.test import TestCase, override_settings
from django.db import transaction
from django.utils import timezone
from rest_framework.test import APIClient

from . import emails, services
from .models import BorrowRecord, LibrarySettings, Notification, Role, Status
from .test_circulation_rules import postgres_row_locking
from .tests import make_book, make_user


def make_member(email="m@x.com", language="en", reminders=True):
    user = make_user(email)
    user.profile.language = language
    user.profile.email_reminders = reminders
    user.profile.save(update_fields=["language", "email_reminders"])
    return user


def borrowed(member, staff, book, due_in_days):
    """A BORROWED loan due `due_in_days` from now."""
    record = services.create_request(member, book)
    services.approve(staff, record)
    services.confirm_pickup(staff, record)
    BorrowRecord.objects.filter(pk=record.pk).update(due_date=timezone.now() + timedelta(days=due_in_days))
    record.refresh_from_db()
    return record


class ReminderTestCase(TestCase):
    def setUp(self):
        self.staff = make_user("staff@x.com", Role.STAFF)
        self.member = make_member()
        self.book = make_book(copies=1)
        self.book.shelf_location = "FIC-A-03"
        self.book.save(update_fields=["shelf_location"])

    def approve(self, member=None, book=None):
        record = services.create_request(member or self.member, book or self.book)
        with self.captureOnCommitCallbacks(execute=True):
            services.approve(self.staff, record)
        record.refresh_from_db()
        return record


# ------------------------------------------------------------------ ready for pickup

class ReadyEmailTests(ReminderTestCase):
    def test_approval_sends_one_ready_email_with_the_details(self):
        record = self.approve()
        self.assertEqual(len(mail.outbox), 1)
        message = mail.outbox[0]
        self.assertEqual(message.to, ["m@x.com"])
        self.assertEqual(message.subject, f"“{self.book.title}” is ready for pickup")
        self.assertIn("Shelf mark: FIC-A-03", message.body)
        self.assertIn(emails.local_datetime(record.pickup_deadline, "en"), message.body)
        self.assertIn("/my-requests", message.body)
        self.assertNotIn("?\n", message.body)  # a link without parameters has no stray "?"
        self.assertIsNotNone(record.ready_email_sent_at)

    def test_a_french_member_gets_french_with_a_french_month(self):
        member = make_member("fr@x.com", language="fr")
        record = self.approve(member)
        message = mail.outbox[0]
        self.assertEqual(message.subject, f"« {self.book.title} » est prêt à être retiré")
        self.assertIn("Cote : FIC-A-03", message.body)
        deadline = emails.local_datetime(record.pickup_deadline, "fr")
        self.assertIn(deadline, message.body)
        months = ("janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre",
                  "octobre", "novembre", "décembre")
        self.assertTrue(any(month in deadline for month in months), deadline)

    def test_the_hold_email_has_no_shelf_line_when_the_book_has_no_shelf_mark(self):
        self.book.shelf_location = ""
        self.book.save(update_fields=["shelf_location"])
        self.approve()
        self.assertNotIn("Shelf mark", mail.outbox[0].body)

    def test_queue_handoff_after_a_return_emails_the_next_member(self):
        first = make_member("first@x.com")
        waiting = make_member("waiting@x.com", language="fr")
        record = borrowed(first, self.staff, self.book, due_in_days=5)
        self.book.refresh_from_db()
        services.create_reservation(waiting, self.book)
        mail.outbox.clear()
        with self.captureOnCommitCallbacks(execute=True):
            services.confirm_return(self.staff, record)
        self.assertEqual([m.to for m in mail.outbox], [["waiting@x.com"]])
        self.assertIn("est prêt à être retiré", mail.outbox[0].subject)
        handoff = BorrowRecord.objects.get(user=waiting)
        self.assertIsNotNone(handoff.ready_email_sent_at)

    def test_queue_handoff_after_a_withdrawal_and_after_expiry_email_too(self):
        holder, waiting = make_member("holder@x.com"), make_member("waiting@x.com")
        held = self.approve(holder)
        services.create_reservation(waiting, self.book)
        mail.outbox.clear()
        with self.captureOnCommitCallbacks(execute=True):
            services.withdraw(holder, held)
        self.assertEqual([m.to for m in mail.outbox], [["waiting@x.com"]])

        # The hold that was just handed over expires, and nobody else is waiting: no further email.
        BorrowRecord.objects.filter(user=waiting).update(pickup_deadline=timezone.now() - timedelta(hours=1))
        mail.outbox.clear()
        with self.captureOnCommitCallbacks(execute=True):
            services.run_hourly_cancellation()
        self.assertEqual(mail.outbox, [])

    def test_a_rolled_back_hold_sends_nothing(self):
        record = services.create_request(self.member, self.book)
        with self.captureOnCommitCallbacks(execute=True):
            with self.assertRaises(RuntimeError), transaction.atomic():
                services.approve(self.staff, record)
                raise RuntimeError("something failed after the hold was created")
        self.assertEqual(mail.outbox, [])
        record.refresh_from_db()
        self.assertEqual(record.status, Status.PENDING)
        self.assertIsNone(record.ready_email_sent_at)

    def test_a_failed_ready_email_is_not_retried_and_does_not_break_the_approval(self):
        record = services.create_request(self.member, self.book)
        with mock.patch("library.emails.send_mail", side_effect=OSError("smtp down")):
            with self.captureOnCommitCallbacks(execute=True):
                services.approve(self.staff, record)
        record.refresh_from_db()
        self.assertEqual(record.status, Status.READY)
        self.assertIsNone(record.ready_email_sent_at)
        services.run_daily_reminders()
        self.assertEqual(mail.outbox, [])


# ------------------------------------------------------------------ due soon

class DueSoonTests(ReminderTestCase):
    def test_sent_once_when_the_loan_is_inside_the_window(self):
        record = borrowed(self.member, self.staff, self.book, due_in_days=1)
        mail.outbox.clear()
        self.assertEqual(services.run_daily_reminders(), 1)
        self.assertEqual(len(mail.outbox), 1)
        message = mail.outbox[0]
        self.assertEqual(message.to, ["m@x.com"])
        self.assertEqual(message.subject, f"“{self.book.title}” is due back soon")
        record.refresh_from_db()
        self.assertIn(emails.local_datetime(record.due_date, "en"), message.body)
        self.assertIsNotNone(record.due_reminder_sent_at)

    def test_not_sent_outside_the_window(self):
        borrowed(self.member, self.staff, self.book, due_in_days=5)
        mail.outbox.clear()
        self.assertEqual(services.run_daily_reminders(), 0)
        self.assertEqual(mail.outbox, [])

    def test_not_sent_again_on_a_second_run(self):
        borrowed(self.member, self.staff, self.book, due_in_days=1)
        mail.outbox.clear()
        self.assertEqual(services.run_daily_reminders(), 1)
        self.assertEqual(services.run_daily_reminders(), 0)
        self.assertEqual(len(mail.outbox), 1)

    def test_sent_again_after_a_renewal(self):
        record = borrowed(self.member, self.staff, self.book, due_in_days=1)
        mail.outbox.clear()
        services.run_daily_reminders()
        record.refresh_from_db()
        self.assertIsNotNone(record.due_reminder_sent_at)

        services.renew(self.member, record)
        record.refresh_from_db()
        self.assertIsNone(record.due_reminder_sent_at)  # the new due date gets its own reminder
        self.assertEqual(services.run_daily_reminders(), 0)  # ...but it is two weeks away

        later = timezone.now() + timedelta(days=13)  # inside the window of the new due date
        self.assertEqual(services.run_daily_reminders(now=later), 1)
        self.assertEqual(len(mail.outbox), 2)

    def test_not_sent_when_the_setting_is_zero(self):
        rules = LibrarySettings.get()
        rules.reminder_days_before_due = 0
        rules.save()
        borrowed(self.member, self.staff, self.book, due_in_days=0.5)
        mail.outbox.clear()
        self.assertEqual(services.run_daily_reminders(), 0)
        self.assertEqual(mail.outbox, [])

    def test_the_window_follows_the_setting(self):
        rules = LibrarySettings.get()
        rules.reminder_days_before_due = 7
        rules.save()
        borrowed(self.member, self.staff, self.book, due_in_days=6)
        mail.outbox.clear()
        self.assertEqual(services.run_daily_reminders(), 1)

    def test_a_loan_already_past_due_gets_no_due_soon_email(self):
        borrowed(self.member, self.staff, self.book, due_in_days=-1)
        mail.outbox.clear()
        self.assertEqual(services.run_daily_reminders(), 0)

    def test_a_returned_loan_is_not_reminded(self):
        record = borrowed(self.member, self.staff, self.book, due_in_days=1)
        services.confirm_return(self.staff, record)
        mail.outbox.clear()
        self.assertEqual(services.run_daily_reminders(), 0)

    def test_the_email_offers_renewal_only_when_it_is_possible(self):
        record = borrowed(self.member, self.staff, self.book, due_in_days=1)
        mail.outbox.clear()
        services.run_daily_reminders()
        self.assertIn("You can renew it from My loans.", mail.outbox[0].body)

        # Someone waits for the book: renewal is blocked, so the hint is left out.
        other_book = make_book(copies=1)
        other_member, waiting = make_member("o@x.com"), make_member("w@x.com")
        borrowed(other_member, self.staff, other_book, due_in_days=1)
        other_book.refresh_from_db()
        services.create_reservation(waiting, other_book)
        mail.outbox.clear()
        services.run_daily_reminders()
        self.assertEqual([m.to for m in mail.outbox], [["o@x.com"]])
        self.assertNotIn("renew", mail.outbox[0].body)
        self.assertIn("return it to the circulation desk", mail.outbox[0].body)
        self.assertEqual(record.renewal_count, 0)

    def test_an_arabic_member_gets_arabic(self):
        member = make_member("ar@x.com", language="ar")
        borrowed(member, self.staff, self.book, due_in_days=1)
        mail.outbox.clear()
        services.run_daily_reminders()
        self.assertEqual(mail.outbox[0].subject, f"موعد إرجاع «{self.book.title}» يقترب")
        self.assertIn("يمكنك تجديده", mail.outbox[0].body)

    def test_a_failed_send_leaves_the_mark_empty_and_the_next_run_retries(self):
        record = borrowed(self.member, self.staff, self.book, due_in_days=1)
        mail.outbox.clear()
        with mock.patch("library.emails.send_mail", side_effect=OSError("smtp down")):
            self.assertEqual(services.run_daily_reminders(), 0)
        record.refresh_from_db()
        self.assertIsNone(record.due_reminder_sent_at)
        self.assertEqual(services.run_daily_reminders(), 1)
        self.assertEqual(len(mail.outbox), 1)
        record.refresh_from_db()
        self.assertIsNotNone(record.due_reminder_sent_at)


# ------------------------------------------------------------------ overdue

class OverdueEmailTests(ReminderTestCase):
    def test_one_email_when_flagged_and_none_on_the_next_nightly_run(self):
        record = borrowed(self.member, self.staff, self.book, due_in_days=-1)
        mail.outbox.clear()
        self.assertEqual(services.run_nightly_overdue(), 1)
        self.assertEqual(len(mail.outbox), 1)
        message = mail.outbox[0]
        self.assertEqual(message.subject, f"“{self.book.title}” is overdue")
        self.assertIn("New requests are blocked until you return it at the circulation desk", message.body)
        record.refresh_from_db()
        self.assertEqual(record.status, Status.OVERDUE)
        self.assertIsNotNone(record.overdue_email_sent_at)

        self.assertEqual(services.run_nightly_overdue(), 0)
        self.assertEqual(services.run_daily_reminders(), 0)
        self.assertEqual(len(mail.outbox), 1)

    def test_a_failed_overdue_email_is_retried_by_the_daily_job(self):
        record = borrowed(self.member, self.staff, self.book, due_in_days=-1)
        mail.outbox.clear()
        with mock.patch("library.emails.send_mail", side_effect=OSError("smtp down")):
            self.assertEqual(services.run_nightly_overdue(), 1)  # still flagged
        record.refresh_from_db()
        self.assertEqual(record.status, Status.OVERDUE)
        self.assertIsNone(record.overdue_email_sent_at)

        self.assertEqual(services.run_daily_reminders(), 1)
        self.assertEqual(len(mail.outbox), 1)
        record.refresh_from_db()
        self.assertIsNotNone(record.overdue_email_sent_at)
        self.assertEqual(services.run_daily_reminders(), 0)

    def test_the_job_takes_its_row_locks_inside_transactions(self):
        # Outside a request, PostgreSQL refuses select_for_update without a transaction; the harness makes SQLite do too.
        borrowed(self.member, self.staff, self.book, due_in_days=1)
        late = borrowed(make_member("late@x.com"), self.staff, make_book(), due_in_days=-1)
        mail.outbox.clear()
        with postgres_row_locking():
            self.assertEqual(services.run_nightly_overdue(), 1)
            self.assertEqual(services.run_daily_reminders(), 1)
        late.refresh_from_db()
        self.assertEqual(late.status, Status.OVERDUE)

    def test_the_reminder_command_runs_the_job(self):
        borrowed(self.member, self.staff, self.book, due_in_days=1)
        mail.outbox.clear()
        out = StringIO()
        call_command("send_reminders", stdout=out)
        self.assertIn("1 email(s) sent", out.getvalue())
        self.assertEqual(len(mail.outbox), 1)


# ------------------------------------------------------------------ opt-out

class OptOutTests(ReminderTestCase):
    def setUp(self):
        super().setUp()
        self.quiet = make_member("quiet@x.com", reminders=False)

    def test_no_emails_but_the_notifications_are_still_created(self):
        record = self.approve(self.quiet)
        self.assertIsNone(record.ready_email_sent_at)
        self.assertTrue(Notification.objects.filter(user=self.quiet, code="request_approved").exists())

        services.confirm_pickup(self.staff, record)
        BorrowRecord.objects.filter(pk=record.pk).update(due_date=timezone.now() + timedelta(days=1))
        self.assertEqual(services.run_daily_reminders(), 0)

        BorrowRecord.objects.filter(pk=record.pk).update(due_date=timezone.now() - timedelta(days=1))
        self.assertEqual(services.run_nightly_overdue(), 1)
        self.assertTrue(Notification.objects.filter(user=self.quiet, code="overdue").exists())
        self.assertEqual(mail.outbox, [])

    def test_the_flag_is_in_the_profile_and_writable_by_the_member(self):
        client = APIClient()
        client.force_authenticate(self.quiet)
        self.assertIs(client.get("/api/users/me").json()["emailReminders"], False)
        res = client.patch("/api/users/me", {"emailReminders": True}, format="json")
        self.assertEqual(res.status_code, 200)
        self.assertIs(res.json()["emailReminders"], True)
        self.quiet.profile.refresh_from_db()
        self.assertTrue(self.quiet.profile.email_reminders)

    def test_it_defaults_to_on(self):
        self.assertTrue(make_user("new@x.com").profile.email_reminders)


# ------------------------------------------------------------------ dates and the jobs endpoint

class DateFormatTests(TestCase):
    moment = datetime(2026, 10, 5, 14, 30, tzinfo=dt_timezone.utc)

    def test_each_language_spells_its_own_month(self):
        self.assertEqual(emails.local_datetime(self.moment, "en"), "5 October 2026, 14:30")
        self.assertEqual(emails.local_datetime(self.moment, "fr"), "5 octobre 2026, 14:30")
        self.assertEqual(emails.local_datetime(self.moment, "ar"), "5 أكتوبر 2026, 14:30")

    @override_settings(LIBRARY_TIME_ZONE="Africa/Algiers")
    def test_dates_are_written_in_the_library_time_zone(self):
        self.assertEqual(emails.local_datetime(self.moment, "en"), "5 October 2026, 15:30")

    @override_settings(LIBRARY_TIME_ZONE="Pacific/Auckland")
    def test_a_zone_can_move_the_date_itself(self):
        self.assertEqual(emails.local_datetime(self.moment, "en"), "6 October 2026, 03:30")


class JobsEndpointTests(ReminderTestCase):
    def test_run_jobs_returns_the_reminder_count(self):
        borrowed(self.member, self.staff, self.book, due_in_days=1)
        mail.outbox.clear()
        client = APIClient()
        client.force_authenticate(self.staff)
        res = client.post("/api/jobs/run")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.json()["remindersSent"], 1)
        self.assertEqual(client.post("/api/jobs/run").json()["remindersSent"], 0)
