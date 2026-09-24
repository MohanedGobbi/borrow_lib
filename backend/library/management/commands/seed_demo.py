"""Seed the database with demo data. All timestamps relative to now so the
dashboard shows urgent pickups, due-soon loans and overdue records.

    python manage.py seed_demo
"""
from datetime import timedelta

from django.contrib.auth.models import User
from django.core.management.base import BaseCommand
from django.utils import timezone

from library.models import (
    ActivityLog,
    Book,
    BorrowRecord,
    Category,
    Notification,
    Reservation,
    Role,
    Status,
    UserProfile,
)

PASSWORD = "password123"

CATEGORY_COLORS = {
    "Fiction": "#1F6E43",
    "Non-Fiction": "#8A5A2B",
    "Science": "#2D5F7A",
    "History": "#645B7C",
    "Technology": "#4A5560",
}

BOOKS = [
    ("The Name of the Wind", "Patrick Rothfuss", "978-0756404741", "Fiction", "DAW Books", 2007, 4, 2, "FIC-A-03", "#1F4D3A", "The riveting first-person narrative of Kvothe, a gifted young man who grows to be the most notorious magician his world has ever seen."),
    ("Sapiens: A Brief History of Humankind", "Yuval Noah Harari", "978-0062316097", "History", "Harper", 2015, 5, 3, "HIS-B-11", "#5C4630", "A groundbreaking narrative of humanity's creation and evolution."),
    ("Clean Code", "Robert C. Martin", "978-0132350884", "Technology", "Prentice Hall", 2008, 3, 0, "TEC-C-07", "#2E4A3C", "A handbook of agile software craftsmanship."),
    ("A Brief History of Time", "Stephen Hawking", "978-0553380163", "Science", "Bantam", 1998, 3, 1, "SCI-D-02", "#4A4E45", "From the Big Bang to black holes — a landmark volume in science writing."),
    ("The Design of Everyday Things", "Don Norman", "978-0465050659", "Non-Fiction", "Basic Books", 2013, 2, 2, "NON-E-05", "#7A3B2E", "The classic guide to human-centered design."),
    ("Dune", "Frank Herbert", "978-0441172719", "Fiction", "Ace", 1990, 6, 4, "FIC-A-09", "#2B3F52", "Set on the desert planet Arrakis, the story of Paul Atreides."),
    ("The Pragmatic Programmer", "David Thomas & Andrew Hunt", "978-0135957059", "Technology", "Addison-Wesley", 2019, 3, 1, "TEC-C-02", "#3D3A4F", "Your journey to mastery: classic software development wisdom."),
    ("Guns, Germs, and Steel", "Jared Diamond", "978-0393354324", "History", "W. W. Norton", 2017, 2, 0, "HIS-B-04", "#6E2A2A", "A global account of the rise of civilization."),
    ("The Selfish Gene", "Richard Dawkins", "978-0198788607", "Science", "Oxford UP", 2016, 3, 2, "SCI-D-08", "#29463F", "The gene-centered view of evolution that changed biology."),
    ("Thinking, Fast and Slow", "Daniel Kahneman", "978-0374533557", "Non-Fiction", "FSG", 2013, 4, 3, "NON-E-01", "#1F4D3A", "The two systems that drive the way we think."),
    ("Structure and Interpretation of Computer Programs", "Harold Abelson & Gerald Jay Sussman", "978-0262510875", "Technology", "MIT Press", 1996, 2, 2, "TEC-C-11", "#5C4630", "The wizard book: a deep introduction to programming using Scheme."),
    ("The Silk Roads", "Peter Frankopan", "978-1101912379", "History", "Vintage", 2017, 2, 1, "HIS-B-15", "#2E4A3C", "A new history of the world told through trade networks."),
    ("Klara and the Sun", "Kazuo Ishiguro", "978-0593318171", "Fiction", "Vintage", 2021, 3, 1, "FIC-A-14", "#4A4E45", "The story of Klara, an Artificial Friend."),
    ("The Gene: An Intimate History", "Siddhartha Mukherjee", "978-1476733524", "Science", "Scribner", 2017, 2, 0, "SCI-D-12", "#7A3B2E", "A magnificent history of the gene."),
    ("Atomic Habits", "James Clear", "978-0735211292", "Non-Fiction", "Avery", 2018, 5, 4, "NON-E-09", "#2B3F52", "Tiny changes, remarkable results."),
    ("The Art of Computer Programming, Vol. 1", "Donald E. Knuth", "978-0201896831", "Technology", "Addison-Wesley", 1997, 1, 1, "TEC-C-15", "#3D3A4F", "Fundamental algorithms — the bible of computer science."),
    ("Meditations", "Marcus Aurelius", "978-0812968255", "Non-Fiction", "Modern Library", 2002, 3, 3, "NON-E-13", "#6E2A2A", "Timeless Stoic wisdom on duty and mortality."),
    ("Project Hail Mary", "Andy Weir", "978-0593135228", "Fiction", "Ballantine", 2021, 4, 0, "FIC-A-20", "#29463F", "A lone astronaut with the fate of humanity on his shoulders."),
]

USERS = [
    # (name, email, id number, role, member since days ago)
    ("Eleanor Vance", "admin@libborrow.dev", "STF-0001", Role.ADMIN, 2700),
    ("Marcus Holloway", "staff@libborrow.dev", "STF-0042", Role.STAFF, 1600),
    ("Priya Sharma", "priya@example.com", "STU-10293", Role.MEMBER, 700),
    ("Daniel Okafor", "daniel@example.com", "STU-10417", Role.MEMBER, 560),
    ("Sofia Lindqvist", "sofia@example.com", "STU-10558", Role.MEMBER, 150),
    ("Tomás Rivera", "tomas@example.com", "STU-10660", Role.MEMBER, 95),
    ("Hana Yoshida", "hana@example.com", "STU-10774", Role.MEMBER, 40),
    ("Greta Weiss", "gweiss@libborrow.dev", "STF-0057", Role.STAFF, 1250),
    ("Youssef Ben Ali", "youssef@example.com", "STU-10801", Role.MEMBER, 210),
    ("Amira Haddad", "amira@example.com", "STU-10802", Role.MEMBER, 180),
    ("Lucas Martin", "lucas@example.com", "STU-10803", Role.MEMBER, 260),
    ("Inès Moreau", "ines@example.com", "STU-10804", Role.MEMBER, 120),
    ("Karim Mansour", "karim@example.com", "STU-10805", Role.MEMBER, 75),
    ("Léa Dubois", "lea@example.com", "STU-10806", Role.MEMBER, 300),
    ("Omar Trabelsi", "omar@example.com", "STU-10807", Role.MEMBER, 55),
    ("Sara Khalil", "sara@example.com", "STU-10808", Role.MEMBER, 20),
]


class Command(BaseCommand):
    help = "Seed the database with demo books, users, borrow records and reservations."

    def handle(self, *args, **options):
        if Book.objects.exists():
            self.stdout.write(self.style.WARNING("Database already seeded — skipping."))
            return

        now = timezone.now()
        H, D = timedelta(hours=1), timedelta(days=1)

        categories = {
            name: Category.objects.create(name=name, color=color)
            for name, color in CATEGORY_COLORS.items()
        }

        books = {}
        for title, author, isbn, cat, pub, year, total, avail, shelf, color, desc in BOOKS:
            books[title] = Book.objects.create(
                title=title, author=author, isbn=isbn, category=categories[cat], publisher=pub,
                year=year, total_copies=total, available_copies=avail,
                shelf_location=shelf, cover_color=color, description=desc,
            )

        users = {}
        for name, email, idnum, role, since_days in USERS:
            first, _, last = name.partition(" ")
            user = User.objects.create_user(
                username=email, email=email, password=PASSWORD, first_name=first, last_name=last,
                is_superuser=(role == Role.ADMIN), is_staff=(role in (Role.ADMIN, Role.STAFF)),
            )
            profile = UserProfile.objects.create(
                user=user, student_or_staff_id=idnum, role=role,
                phone_number=f"+1 555 010 {idnum[-4:]}", max_borrow_limit=10 if role != Role.MEMBER else 5,
            )
            UserProfile.objects.filter(pk=profile.pk).update(membership_start_date=(now - since_days * D).date())
            users[email] = user

        admin = users["admin@libborrow.dev"]
        admin.profile.role = Role.ADMIN
        admin.profile.save(update_fields=["role"])

        priya, daniel, sofia = users["priya@example.com"], users["daniel@example.com"], users["sofia@example.com"]
        tomas, hana = users["tomas@example.com"], users["hana@example.com"]

        def rec(user, book, status, **offsets):
            fields = dict(status=status)
            for key, delta in offsets.items():
                # accept absolute datetimes or timedeltas relative to now
                fields[key] = now + delta if isinstance(delta, timedelta) else delta
            r = BorrowRecord.objects.create(user=user, book=book, **fields)
            BorrowRecord.objects.filter(pk=r.pk).update(requested_at=fields.get("requested_at", now))
            return r

        B = lambda t: books[t]
        # PENDING
        rec(priya, B("A Brief History of Time"), Status.PENDING, requested_at=-5 * H)
        rec(tomas, B("The Pragmatic Programmer"), Status.PENDING, requested_at=-26 * H)
        rec(hana, B("The Name of the Wind"), Status.PENDING, requested_at=-2 * H)
        rec(sofia, B("Atomic Habits"), Status.PENDING, requested_at=-40 * H)
        # READY (two urgent < 6h)
        rec(daniel, B("Thinking, Fast and Slow"), Status.READY, requested_at=-50 * H, approved_at=now - 46 * H, pickup_deadline=now + 2 * H)
        rec(priya, B("Sapiens: A Brief History of Humankind"), Status.READY, requested_at=-10 * H, approved_at=now - 8 * H, pickup_deadline=now + 40 * H)
        rec(tomas, B("The Silk Roads"), Status.READY, requested_at=-30 * H, approved_at=now - 43 * H, pickup_deadline=now + 5 * H)
        # BORROWED (one due soon)
        rec(sofia, B("Dune"), Status.BORROWED, requested_at=-13 * D, approved_at=now - 12.8 * D, pickup_deadline=now - 10.8 * D, borrowed_at=now - 12 * D, due_date=now + 2 * D)
        rec(hana, B("Klara and the Sun"), Status.BORROWED, requested_at=-6 * D, approved_at=now - 5.9 * D, pickup_deadline=now - 3.9 * D, borrowed_at=now - 5 * D, due_date=now + 9 * D)
        rec(priya, B("The Selfish Gene"), Status.BORROWED, requested_at=-8 * D, approved_at=now - 7.8 * D, pickup_deadline=now - 5.8 * D, borrowed_at=now - 7 * D, due_date=now + 7 * D)
        # OVERDUE
        rec(daniel, B("The Name of the Wind"), Status.OVERDUE, requested_at=-20 * D, approved_at=now - 19.8 * D, pickup_deadline=now - 17.8 * D, borrowed_at=now - 19 * D, due_date=now - 5 * D)
        rec(tomas, B("The Design of Everyday Things"), Status.OVERDUE, requested_at=-18 * D, approved_at=now - 17.9 * D, pickup_deadline=now - 15.9 * D, borrowed_at=now - 17 * D, due_date=now - 3 * D)
        # RETURNED
        rec(priya, B("Dune"), Status.RETURNED, requested_at=-40 * D, approved_at=now - 39.8 * D, pickup_deadline=now - 37.8 * D, borrowed_at=now - 39 * D, due_date=now - 25 * D, returned_at=now - 28 * D)
        rec(sofia, B("Thinking, Fast and Slow"), Status.RETURNED, requested_at=-35 * D, approved_at=now - 34.8 * D, pickup_deadline=now - 32.8 * D, borrowed_at=now - 34 * D, due_date=now - 20 * D, returned_at=now - 22 * D)
        # REJECTED + CANCELLED
        rec(tomas, B("The Art of Computer Programming, Vol. 1"), Status.REJECTED, requested_at=-9 * D)
        rec(daniel, B("Clean Code"), Status.CANCELLED, requested_at=-6 * D, approved_at=now - 5.8 * D, pickup_deadline=now - 3.8 * D)

        # Students holding the remaining copies, so every copy off the shelf has a borrower.
        LOANS = [
            ("youssef@example.com", "Project Hail Mary", 3),
            ("amira@example.com", "Project Hail Mary", 6),
            ("lucas@example.com", "Project Hail Mary", 9),
            ("ines@example.com", "Project Hail Mary", 12),
            ("karim@example.com", "Clean Code", 2),
            ("lea@example.com", "Clean Code", 8),
            ("omar@example.com", "Clean Code", 11),
            ("sara@example.com", "Guns, Germs, and Steel", 4),
            ("youssef@example.com", "Guns, Germs, and Steel", 10),
            ("amira@example.com", "The Gene: An Intimate History", 5),
            ("karim@example.com", "The Gene: An Intimate History", 13),
            ("lucas@example.com", "The Name of the Wind", 7),
            ("ines@example.com", "Sapiens: A Brief History of Humankind", 2),
            ("omar@example.com", "Sapiens: A Brief History of Humankind", 6),
            ("lea@example.com", "A Brief History of Time", 4),
            ("sara@example.com", "A Brief History of Time", 9),
            ("karim@example.com", "Dune", 1),
            ("omar@example.com", "The Pragmatic Programmer", 3),
            ("youssef@example.com", "The Pragmatic Programmer", 12),
            ("amira@example.com", "Thinking, Fast and Slow", 8),
            ("lucas@example.com", "The Silk Roads", 5),
            ("sara@example.com", "Klara and the Sun", 10),
            ("ines@example.com", "Atomic Habits", 7),
        ]
        for email, title, days_ago in LOANS:
            rec(users[email], B(title), Status.BORROWED, requested_at=-(days_ago + 1) * D,
                approved_at=now - (days_ago + 0.8) * D, pickup_deadline=now - (days_ago - 1.2) * D,
                borrowed_at=now - days_ago * D, due_date=now + (14 - days_ago) * D)

        # Shelf stock is derived from the loans: available = total - copies on loan.
        for book in books.values():
            out = book.borrow_records.filter(status__in=[Status.BORROWED, Status.OVERDUE]).count()
            book.available_copies = max(0, book.total_copies - out)
            book.save(update_fields=["available_copies"])

        # Reservations (FIFO queues behind zero-stock titles)
        Reservation.objects.create(user=sofia, book=B("Clean Code"))
        Reservation.objects.create(user=hana, book=B("Clean Code"))
        Reservation.objects.create(user=priya, book=B("Guns, Germs, and Steel"))
        Reservation.objects.create(user=daniel, book=B("Project Hail Mary"))
        Reservation.objects.create(user=tomas, book=B("Project Hail Mary"))

        ActivityLog.objects.create(actor_name="System", action="SEED", detail="Demo dataset loaded (18 books, 8 users, 17 records, 5 reservations).")
        Notification.objects.create(user=daniel, message="Your pickup window for “Thinking, Fast and Slow” closes soon.")

        self.stdout.write(self.style.SUCCESS(
            "Seeded. Login with any seeded email, password: password123\n"
            "  admin@libborrow.dev / staff@libborrow.dev / priya@example.com …"
        ))
