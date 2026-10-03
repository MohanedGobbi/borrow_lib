"""Circulation desk (docs/rework/D2a.md): rejection reasons, queue search, approvals-list annotations."""
from django.db import connection
from django.test import TestCase
from django.test.utils import CaptureQueriesContext

from . import services
from .models import Book, BorrowRecord, Category, Notification, Role, Status
from .test_lists import client_for, make_titled_book, record
from .tests import make_book, make_user


class RejectionReasonTests(TestCase):
    def setUp(self):
        self.staff = make_user("s@x.com", Role.STAFF)
        self.member = make_user("m@x.com")
        self.book = make_book()

    def test_reason_is_stored_notified_and_serialized(self):
        req = services.create_request(self.member, self.book)
        res = client_for(self.staff).post(f"/api/borrow-records/{req.pk}/reject", {"reason": "  Reference copy only  "},
                                          format="json")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.json()["rejectionReason"], "Reference copy only")
        req.refresh_from_db()
        self.assertEqual(req.rejection_reason, "Reference copy only")
        note = Notification.objects.get(user=self.member, code="request_rejected")
        self.assertEqual(note.params["reason"], "Reference copy only")
        self.assertEqual(note.params["title"], self.book.title)
        mine = client_for(self.member).get("/api/borrow-records/mine").json()
        self.assertEqual(mine[0]["rejectionReason"], "Reference copy only")

    def test_reason_is_optional(self):
        req = services.create_request(self.member, self.book)
        res = client_for(self.staff).post(f"/api/borrow-records/{req.pk}/reject")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.json()["rejectionReason"], "")
        note = Notification.objects.get(user=self.member, code="request_rejected")
        self.assertNotIn("reason", note.params)

    def test_reason_is_capped_at_300_characters(self):
        req = services.create_request(self.member, self.book)
        services.reject(self.staff, req, "x" * 500)
        req.refresh_from_db()
        self.assertEqual(len(req.rejection_reason), 300)


class BorrowRecordSearchTests(TestCase):
    def setUp(self):
        self.staff = make_user("s@x.com", Role.STAFF)
        self.priya = make_user("priya@x.com")
        self.priya.first_name, self.priya.last_name = "Priya", "Sharma"
        self.priya.save()
        self.dan = make_user("dan@x.com")
        self.dan.first_name, self.dan.last_name = "Daniel", "Okafor"
        self.dan.save()
        self.dune = make_titled_book("Dune", isbn="9780441013593")
        self.dune.shelf_location = "SF-A-01"
        self.dune.save()
        self.emma = make_titled_book("Emma", isbn="9780141439587")
        self.emma.shelf_location = "FIC-B-07"
        self.emma.save()
        self.r1 = record(self.priya, self.dune, Status.PENDING)
        self.r2 = record(self.dan, self.emma, Status.PENDING)
        self.client = client_for(self.staff)

    def ids(self, search):
        res = self.client.get("/api/borrow-records", {"search": search})
        self.assertEqual(res.status_code, 200)
        return [r["id"] for r in res.json()["results"]]

    def test_member_first_or_last_name(self):
        self.assertEqual(self.ids("priya"), [self.r1.pk])
        self.assertEqual(self.ids("OKAFOR"), [self.r2.pk])
        self.assertEqual(self.ids("priya sharma"), [self.r1.pk])

    def test_student_id(self):
        self.assertEqual(self.ids("DAN"), [self.r2.pk])

    def test_book_title_isbn_and_shelf_mark(self):
        self.assertEqual(self.ids("dun"), [self.r1.pk])
        self.assertEqual(self.ids("0141439587"), [self.r2.pk])
        self.assertEqual(self.ids("fic-b"), [self.r2.pk])

    def test_no_match_and_combined_with_status(self):
        self.assertEqual(self.ids("nobody"), [])
        res = self.client.get("/api/borrow-records", {"search": "priya", "status": "READY"})
        self.assertEqual(res.json()["count"], 0)


class DeskAnnotationTests(TestCase):
    def setUp(self):
        self.staff = make_user("s@x.com", Role.STAFF)
        self.client = client_for(self.staff)

    def test_values(self):
        book = make_book(copies=3)
        other = make_book(copies=1)
        busy = make_user("busy@x.com")
        calm = make_user("calm@x.com")
        record(busy, other, Status.OVERDUE)
        record(busy, make_book(), Status.BORROWED)
        held = record(calm, book, Status.READY)
        record(make_user("third@x.com"), other, Status.READY)  # the only copy of `other` is held
        pending_busy = record(busy, book, Status.PENDING)
        pending_calm = record(calm, other, Status.PENDING)
        rows = {r["id"]: r for r in self.client.get("/api/borrow-records", {"status": "PENDING"}).json()["results"]}
        self.assertEqual(rows[pending_busy.pk]["bookFreeCopies"], 2)  # 3 on the shelf, 1 held
        self.assertEqual(rows[pending_calm.pk]["bookFreeCopies"], 0)  # 1 on the shelf, held for someone else
        self.assertTrue(rows[pending_busy.pk]["memberHasOverdue"])
        self.assertEqual(rows[pending_busy.pk]["memberActiveLoans"], 3)  # overdue + borrowed + pending
        self.assertFalse(rows[pending_calm.pk]["memberHasOverdue"])
        self.assertEqual(rows[pending_calm.pk]["memberActiveLoans"], 2)  # ready + pending
        self.assertEqual(rows[pending_calm.pk]["memberMaxBorrowLimit"], 5)
        self.assertEqual(held.status, Status.READY)

    def test_query_count_does_not_grow_with_rows(self):
        books = [make_book(copies=2) for _ in range(30)]
        member = make_user("m@x.com")

        def count():
            with CaptureQueriesContext(connection) as ctx:
                res = self.client.get("/api/borrow-records", {"status": "PENDING", "ordering": "requested_at"})
            self.assertEqual(res.status_code, 200)
            return len(ctx), len(res.json()["results"])

        for book in books[:3]:
            record(make_user(f"u{book.pk}@x.com"), book, Status.PENDING)
        record(member, books[0], Status.OVERDUE)
        small, rows_small = count()
        for book in books[3:20]:
            record(make_user(f"u{book.pk}@x.com"), book, Status.PENDING)
            record(member, book, Status.READY)
        large, rows_large = count()
        self.assertEqual((rows_small, rows_large), (3, 20))
        self.assertEqual(small, large)

    def test_scan_endpoint_carries_the_same_fields(self):
        member = make_user("m@x.com")
        record(member, make_book(), Status.BORROWED)
        res = self.client.get(f"/api/users/{member.profile.uuid}/scan").json()
        row = res["activeRecords"][0]
        self.assertEqual(row["memberActiveLoans"], 1)
        self.assertEqual(row["bookFreeCopies"], 2)
        self.assertFalse(row["memberHasOverdue"])
