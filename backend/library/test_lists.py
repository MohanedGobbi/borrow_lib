"""List endpoints: pagination, filters and query counts (docs/rework/WP-04.md)."""
from datetime import timedelta

from django.db import connection
from django.test import TestCase
from django.test.utils import CaptureQueriesContext
from django.utils import timezone
from rest_framework.test import APIClient

from . import services
from .models import Book, BorrowRecord, Category, Role, Status
from .tests import make_book, make_user


def client_for(user=None):
    client = APIClient()
    if user:
        client.force_authenticate(user)
    return client


def make_titled_book(title, author="A", isbn=None, category="Fiction", year=2000, copies=1):
    cat, _ = Category.objects.get_or_create(name=category, defaults={"color": "#1F6E43"})
    return Book.objects.create(
        title=title, author=author, isbn=isbn or f"978-{Book.objects.count():010d}", category=cat,
        year=year, total_copies=copies, available_copies=copies)


def record(user, book, status, **kw):
    return BorrowRecord.objects.create(user=user, book=book, status=status, **kw)


class PaginationTests(TestCase):
    def setUp(self):
        self.staff = make_user("s@x.com", Role.STAFF)
        for i in range(30):
            make_book()
        for i in range(29):
            make_user(f"u{i}@x.com")
        member = make_user("m@x.com")
        for book in Book.objects.all()[:27]:
            record(member, book, Status.RETURNED)
        self.endpoints = {"/api/books": 30, "/api/users": 31, "/api/borrow-records": 27}

    def get(self, url, **params):
        return client_for(self.staff).get(url, params)

    def test_response_shape(self):
        for url, total in self.endpoints.items():
            body = self.get(url, page=2).json()
            self.assertEqual(set(body), {"count", "page", "pageSize", "results"}, url)
            self.assertEqual(body["count"], total, url)
            self.assertEqual(body["page"], 2, url)
            self.assertEqual(body["pageSize"], 25, url)
            self.assertEqual(len(body["results"]), total - 25, url)

    def test_page_size_is_honoured(self):
        for url in self.endpoints:
            body = self.get(url, pageSize=10).json()
            self.assertEqual(body["pageSize"], 10, url)
            self.assertEqual(len(body["results"]), 10, url)

    def test_page_size_is_capped_at_100(self):
        for url in self.endpoints:
            body = self.get(url, pageSize=500).json()
            self.assertEqual(body["pageSize"], 100, url)

    def test_page_past_the_end_is_404(self):
        for url in self.endpoints:
            self.assertEqual(self.get(url, page=3).status_code, 404, url)

    def test_pages_do_not_overlap(self):
        for url in self.endpoints:
            ids = []
            for page in (1, 2, 3, 4):
                res = self.get(url, page=page, pageSize=10)
                if res.status_code == 404:
                    break
                ids += [r["id"] for r in res.json()["results"]]
            self.assertEqual(len(ids), len(set(ids)), url)
            self.assertEqual(len(ids), self.endpoints[url], url)

    def test_other_lists_stay_unpaginated(self):
        member = make_user("other@x.com")
        client = client_for(member)
        for url in ("/api/borrow-records/mine", "/api/reservations", "/api/categories",
                    "/api/notifications/mine"):
            self.assertIsInstance(client.get(url).json(), list, url)
        self.assertIsInstance(client_for(self.staff).get("/api/activity").json(), list)


class BookFilterTests(TestCase):
    def setUp(self):
        self.dune = make_titled_book("Dune", author="Frank Herbert", isbn="111-A", category="SciFi", year=1965)
        self.emma = make_titled_book("Emma", author="Jane Austen", isbn="222-B", category="Classics", year=1815)
        self.pride = make_titled_book("Pride and Prejudice", author="Jane Austen", isbn="333-C",
                                      category="Classics", year=1813)
        self.client = client_for()

    def titles(self, **params):
        res = self.client.get("/api/books", params)
        self.assertEqual(res.status_code, 200)
        return [b["title"] for b in res.json()["results"]]

    def test_default_order_is_title(self):
        self.assertEqual(self.titles(), ["Dune", "Emma", "Pride and Prejudice"])

    def test_search_matches_title_author_or_isbn(self):
        self.assertEqual(self.titles(search="prejud"), ["Pride and Prejudice"])
        self.assertEqual(self.titles(search="austen"), ["Emma", "Pride and Prejudice"])
        self.assertEqual(self.titles(search="111-a"), ["Dune"])

    def test_search_matches_shelf_mark(self):
        self.emma.shelf_location = "CLA-AUS-2"
        self.emma.save()
        self.assertEqual(self.titles(search="cla-aus"), ["Emma"])

    def test_category_is_an_exact_name_match(self):
        self.assertEqual(self.titles(category="Classics"), ["Emma", "Pride and Prejudice"])
        self.assertEqual(self.titles(category="Class"), [])

    def test_author_and_isbn(self):
        self.assertEqual(self.titles(author="herbert"), ["Dune"])
        self.assertEqual(self.titles(isbn="333"), ["Pride and Prejudice"])

    def test_ids(self):
        self.assertEqual(self.titles(ids=f"{self.dune.pk},{self.pride.pk}"), ["Dune", "Pride and Prejudice"])
        self.assertEqual(self.titles(ids=str(self.emma.pk)), ["Emma"])

    def test_ordering(self):
        self.assertEqual(self.titles(ordering="-year"), ["Dune", "Emma", "Pride and Prejudice"])
        self.assertEqual(self.titles(ordering="year"), ["Pride and Prejudice", "Emma", "Dune"])
        self.assertEqual(self.titles(ordering="author"), ["Dune", "Emma", "Pride and Prejudice"])
        self.assertEqual(self.client.get("/api/books", {"ordering": "isbn"}).status_code, 400)

    def test_available_excludes_books_with_every_copy_borrowed_or_held(self):
        staff = make_user("s@x.com", Role.STAFF)
        a, b = make_user("a@x.com"), make_user("b@x.com")
        # Emma's only copy is held for a pickup; Dune's only copy is on loan.
        services.approve(staff, services.create_request(a, self.emma))
        borrowed = services.create_request(b, self.dune)
        services.approve(staff, borrowed)
        services.confirm_pickup(staff, borrowed)
        self.assertEqual(self.titles(available=1), ["Pride and Prejudice"])
        self.assertEqual(self.titles(), ["Dune", "Emma", "Pride and Prejudice"])

    def test_available_counts_a_book_with_a_spare_copy(self):
        staff = make_user("s@x.com", Role.STAFF)
        two = make_titled_book("Two copies", copies=2)
        services.approve(staff, services.create_request(make_user("a@x.com"), two))
        self.assertIn("Two copies", self.titles(available=1))


class BorrowRecordFilterTests(TestCase):
    def setUp(self):
        self.staff = make_user("s@x.com", Role.STAFF)
        self.a, self.b = make_user("a@x.com"), make_user("b@x.com")
        self.book1, self.book2 = make_book(3), make_book(3)
        now = timezone.now()
        self.late = record(self.a, self.book1, Status.OVERDUE, due_date=now - timedelta(days=1))
        self.soon = record(self.b, self.book2, Status.BORROWED, due_date=now + timedelta(days=2))
        self.later = record(self.a, self.book2, Status.BORROWED, due_date=now + timedelta(days=9))
        self.pending = record(self.b, self.book1, Status.PENDING)
        self.ready = record(self.a, self.book1, Status.READY, pickup_deadline=now + timedelta(hours=5))
        BorrowRecord.objects.filter(pk=self.late.pk).update(requested_at=now - timedelta(days=20))
        self.client = client_for(self.staff)

    def ids(self, **params):
        res = self.client.get("/api/borrow-records", params)
        self.assertEqual(res.status_code, 200)
        return [r["id"] for r in res.json()["results"]]

    def test_status_single_value_and_comma_list(self):
        self.assertEqual(self.ids(status="PENDING"), [self.pending.pk])
        self.assertCountEqual(self.ids(status="BORROWED,OVERDUE"), [self.late.pk, self.soon.pk, self.later.pk])

    def test_book_and_user(self):
        self.assertCountEqual(self.ids(book=self.book2.pk), [self.soon.pk, self.later.pk])
        self.assertCountEqual(self.ids(user=self.b.pk), [self.soon.pk, self.pending.pk])
        self.assertEqual(self.ids(book=self.book1.pk, user=self.a.pk, status="READY"), [self.ready.pk])

    def test_default_order_is_newest_request_first(self):
        ids = self.ids()
        self.assertEqual(ids[-1], self.late.pk)
        self.assertEqual(len(ids), 5)

    def test_order_by_due_date(self):
        self.assertEqual(self.ids(status="BORROWED,OVERDUE", ordering="due_date"),
                         [self.late.pk, self.soon.pk, self.later.pk])
        self.assertEqual(self.ids(status="BORROWED,OVERDUE", ordering="-due_date"),
                         [self.later.pk, self.soon.pk, self.late.pk])

    def test_order_by_pickup_deadline(self):
        self.assertEqual(self.ids(status="READY", ordering="pickup_deadline"), [self.ready.pk])

    def test_only_listed_ordering_fields(self):
        self.assertEqual(self.client.get("/api/borrow-records", {"ordering": "user"}).status_code, 400)


class UserFilterTests(TestCase):
    def setUp(self):
        self.staff = make_user("s@x.com", Role.STAFF)
        self.ada = make_user("ada@x.com")
        self.ada.first_name, self.ada.last_name = "Ada", "Lovelace"
        self.ada.save()
        self.bob = make_user("bob@y.org")
        self.bob.first_name = "Bob"
        self.bob.save()
        self.client = client_for(self.staff)

    def emails(self, **params):
        res = self.client.get("/api/users", params)
        self.assertEqual(res.status_code, 200)
        return sorted(u["email"] for u in res.json()["results"])

    def test_search_covers_name_email_and_id(self):
        self.assertEqual(self.emails(search="lovel"), ["ada@x.com"])
        self.assertEqual(self.emails(search="y.org"), ["bob@y.org"])
        self.assertEqual(self.emails(search="BOB"), ["bob@y.org"])  # student ID is the upper-cased email local part

    def test_role(self):
        self.assertEqual(self.emails(role="STAFF"), ["s@x.com"])
        self.assertEqual(self.emails(role="MEMBER"), ["ada@x.com", "bob@y.org"])

    def test_loan_annotations(self):
        record(self.ada, make_book(), Status.BORROWED)
        record(self.ada, make_book(), Status.OVERDUE)
        record(self.ada, make_book(), Status.RETURNED)
        res = self.client.get("/api/users", {"search": "ada"}).json()["results"][0]
        self.assertEqual(res["activeLoans"], 2)
        self.assertTrue(res["hasOverdue"])
        bob = self.client.get("/api/users", {"search": "bob"}).json()["results"][0]
        self.assertEqual(bob["activeLoans"], 0)
        self.assertFalse(bob["hasOverdue"])


class QueryCountTests(TestCase):
    def count_queries(self, client, url):
        with CaptureQueriesContext(connection) as ctx:
            res = client.get(url)
        self.assertEqual(res.status_code, 200)
        return len(ctx), len(res.json()["results"])

    def test_users_query_count_does_not_grow_with_rows(self):
        staff = make_user("s@x.com", Role.STAFF)
        client = client_for(staff)
        book = make_book(copies=50)

        def add_users(n, start):
            for i in range(start, start + n):
                user = make_user(f"u{i}@x.com")
                record(user, book, Status.BORROWED)
                record(user, book, Status.OVERDUE if i % 2 else Status.PENDING)

        add_users(2, 0)  # plus the staff user: 3 rows
        small, rows_small = self.count_queries(client, "/api/users")
        add_users(27, 2)
        large, rows_large = self.count_queries(client, "/api/users")
        self.assertEqual((rows_small, rows_large), (3, 25))
        self.assertEqual(small, large)

    def test_books_query_count_does_not_grow_with_rows(self):
        client = client_for()
        for _ in range(3):
            make_book()
        small, rows_small = self.count_queries(client, "/api/books")
        for _ in range(27):
            make_book()
        large, rows_large = self.count_queries(client, "/api/books")
        self.assertEqual((rows_small, rows_large), (3, 25))
        self.assertEqual(small, large)

    def test_borrow_record_query_count_does_not_grow_with_rows(self):
        staff = make_user("s@x.com", Role.STAFF)
        client = client_for(staff)
        member = make_user("m@x.com")
        books = [make_book() for _ in range(30)]
        for book in books[:3]:
            record(member, book, Status.RETURNED)
        small, rows_small = self.count_queries(client, "/api/borrow-records")
        for book in books[3:]:
            record(member, book, Status.RETURNED)
        large, rows_large = self.count_queries(client, "/api/borrow-records")
        self.assertEqual((rows_small, rows_large), (3, 25))
        self.assertEqual(small, large)
