"""Admin-editable site photographs: the endpoints and, above all, the upload safety."""
import shutil
import tempfile
from io import BytesIO
from pathlib import Path

from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase, override_settings
from PIL import Image, ImageChops
from rest_framework.test import APIClient

from .models import ActivityLog, Role, SiteImage
from .tests import make_user

ALT = {"altEn": "Reading room", "altFr": "Salle de lecture", "altAr": "قاعة القراءة"}


def png(width=1500, height=1000, mode="RGB", color=(30, 90, 60)) -> bytes:
    buf = BytesIO()
    Image.new(mode, (width, height), color).save(buf, format="PNG")
    return buf.getvalue()


def jpeg_with_exif(width=1500, height=1000, orientation=None) -> bytes:
    exif = Image.Exif()
    exif[0x010F] = "SecretCameraMaker"      # Make
    exif[0x013B] = "Jane Photographer"      # Artist
    exif.get_ifd(0x8825)[1] = "N"           # GPS latitude reference
    exif.get_ifd(0x8825)[2] = (48.0, 51.0, 24.0)
    if orientation:
        exif[0x0112] = orientation
    buf = BytesIO()
    Image.new("RGB", (width, height), (200, 120, 40)).save(buf, format="JPEG", exif=exif)
    return buf.getvalue()


def upload(data: bytes, name="photo.png", content_type="image/png"):
    return SimpleUploadedFile(name, data, content_type=content_type)


class SiteImageTests(TestCase):
    def setUp(self):
        # Files are not rolled back with the database, so every test gets an empty media folder of its own.
        self.media = tempfile.mkdtemp(prefix="lb-site-images-")
        self.addCleanup(shutil.rmtree, self.media, ignore_errors=True)
        self.enterContext(override_settings(MEDIA_ROOT=self.media))
        self.admin = make_user("a@x.com", Role.ADMIN)
        self.staff = make_user("s@x.com", Role.STAFF)
        self.member = make_user("m@x.com")
        self.client = APIClient()

    def as_user(self, user):
        self.client.force_authenticate(user)

    def put(self, slot="hero", file=None, **fields):
        data = {**ALT, "credit": "Photo: Library archives", **fields}
        if file is not None:
            data["file"] = file
        return self.client.put(f"/api/site-images/{slot}", data, format="multipart")

    def media_files(self):
        site = Path(self.media) / "site"
        return sorted(p.name for p in site.glob("*")) if site.exists() else []

    def assertRejected(self, res, code, status=400):
        self.assertEqual(res.status_code, status, res.data)
        self.assertEqual(res.data["code"], code)
        self.assertEqual(SiteImage.objects.count(), 0)
        self.assertEqual(self.media_files(), [])

    # ----------------------------------------------------------- reading

    def test_public_get_shows_null_slots_by_default(self):
        res = self.client.get("/api/site-images")  # not signed in
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data, {"hero": None, "feature": None, "auth": None})

    def test_public_get_shows_an_uploaded_slot(self):
        self.as_user(self.admin)
        self.put("hero", upload(png(2400, 1600)))
        anonymous = APIClient()
        data = anonymous.get("/api/site-images").data
        self.assertIsNone(data["feature"])
        hero = data["hero"]
        self.assertEqual((hero["width"], hero["height"]), (2400, 1600))
        self.assertEqual(hero["alt"], {"en": "Reading room", "fr": "Salle de lecture", "ar": "قاعة القراءة"})
        self.assertEqual(hero["credit"], "Photo: Library archives")
        parts = [p.split(" ") for p in hero["srcset"].split(", ")]
        self.assertEqual([w for _, w in parts], ["640w", "1200w", "2000w"])
        self.assertEqual(hero["src"], parts[1][0])
        self.assertTrue(all(u.startswith("http") and u.endswith(".webp") for u, _ in parts))

    # ----------------------------------------------------------- uploading

    def test_admin_upload_creates_three_webps_with_the_right_widths_and_no_exif(self):
        self.as_user(self.admin)
        res = self.put("hero", upload(jpeg_with_exif(2400, 1600), "IMG_0042.jpg", "image/jpeg"))
        self.assertEqual(res.status_code, 200, res.data)
        row = SiteImage.objects.get(slot="hero")
        self.assertEqual((row.width, row.height), (2400, 1600))
        self.assertEqual(row.updated_by, self.admin)
        self.assertEqual(len(self.media_files()), 3)
        for field, width in ((row.image_2000, 2000), (row.image_1200, 1200), (row.image_640, 640)):
            self.assertTrue(field.name.startswith("site/") and field.name.endswith(".webp"))
            self.assertNotIn("IMG_0042", field.name)  # the uploaded name never reaches the disk
            raw = field.read()
            field.close()
            img = Image.open(BytesIO(raw))
            self.assertEqual(img.format, "WEBP")
            self.assertEqual(img.mode, "RGB")
            self.assertEqual(img.width, width)
            self.assertEqual(img.height, round(1600 * width / 2400))
            self.assertEqual(dict(img.getexif()), {})
            self.assertNotIn("exif", img.info)
            self.assertNotIn(b"EXIF", raw)
            self.assertNotIn(b"SecretCameraMaker", raw)
            self.assertNotIn(b"Jane Photographer", raw)
        log = ActivityLog.objects.get(action="SITE_IMAGE_CHANGED")
        self.assertEqual((log.code, log.params), ("site_image_changed", {"slot": "hero"}))

    def test_a_smaller_original_is_never_upscaled(self):
        self.as_user(self.admin)
        res = self.put("hero", upload(png(1500, 1000)))
        self.assertEqual(res.status_code, 200, res.data)
        row = SiteImage.objects.get(slot="hero")
        widths = {w: Image.open(getattr(row, f"image_{w}")).width for w in (2000, 1200, 640)}
        self.assertEqual(widths, {2000: 1500, 1200: 1200, 640: 640})
        self.assertEqual([p.split(" ")[1] for p in res.data["srcset"].split(", ")], ["640w", "1200w", "1500w"])

    def test_transparency_is_flattened_and_orientation_is_applied(self):
        self.as_user(self.admin)
        self.put("hero", upload(png(1400, 900, "RGBA", (0, 0, 0, 0))))
        row = SiteImage.objects.get(slot="hero")
        corner = Image.open(row.image_1200).getpixel((5, 5))
        self.assertTrue(all(c > 245 for c in corner), corner)  # transparent -> white, not black
        # A portrait shot stored sideways (orientation 6) is rotated upright before the EXIF is dropped.
        self.put("auth", upload(jpeg_with_exif(1600, 1000, orientation=6), "p.jpg", "image/jpeg"))
        auth = SiteImage.objects.get(slot="auth")
        self.assertEqual((auth.width, auth.height), (1000, 1600))

    def test_every_slot_is_stored_in_black_and_white(self):
        # Saturated colour in, greyscale out: every pixel of every stored rendition has R == G == B.
        buf = BytesIO()
        img = Image.new("RGB", (1600, 1000), (200, 40, 40))
        img.paste((30, 160, 60), (0, 500, 1600, 1000))
        img.paste((40, 60, 220), (800, 0, 1600, 500))
        img.save(buf, format="PNG")
        self.as_user(self.admin)
        for slot in ("hero", "feature", "auth"):
            res = self.put(slot, upload(buf.getvalue()))
            self.assertEqual(res.status_code, 200, res.data)
            row = SiteImage.objects.get(slot=slot)
            for field in (row.image_2000, row.image_1200, row.image_640):
                with field.open("rb") as f:
                    stored = Image.open(BytesIO(f.read())).convert("RGB")
                r, g, b = stored.split()
                self.assertEqual(ImageChops.difference(r, g).getextrema()[1], 0, (slot, field.name))
                self.assertEqual(ImageChops.difference(g, b).getextrema()[1], 0, (slot, field.name))
                # and it is still a picture, not a flat fill: the three colour blocks became different greys
                self.assertGreater(len({stored.getpixel((x, y)) for x, y in ((10, 10), (stored.width - 10, 10), (10, stored.height - 10))}), 1)

    def test_replacing_a_photo_deletes_the_old_files(self):
        self.as_user(self.admin)
        self.put("hero", upload(png(2400, 1600)))
        old = set(self.media_files())
        self.assertEqual(len(old), 3)
        res = self.put("hero", upload(png(2200, 1400, color=(10, 10, 10))), altEn="Changed")
        self.assertEqual(res.status_code, 200, res.data)
        new = set(self.media_files())
        self.assertEqual(len(new), 3)
        self.assertTrue(old.isdisjoint(new))
        self.assertEqual(SiteImage.objects.count(), 1)
        self.assertEqual(SiteImage.objects.get().alt_en, "Changed")

    def test_a_rejected_replacement_keeps_the_current_photo(self):
        self.as_user(self.admin)
        self.put("hero", upload(png(2400, 1600)))
        before = self.media_files()
        res = self.put("hero", upload(b"not an image", "x.png"))
        self.assertEqual(res.status_code, 400)
        self.assertEqual(self.media_files(), before)

    def test_staff_and_members_cannot_change_photos(self):
        for user in (self.staff, self.member):
            self.as_user(user)
            res = self.put("hero", upload(png()))
            self.assertEqual(res.status_code, 403, res.data)
            self.assertEqual(self.client.delete("/api/site-images/hero").status_code, 403)
        anonymous = APIClient()
        self.assertEqual(anonymous.put("/api/site-images/hero", {**ALT, "file": upload(png())}, format="multipart")
                         .status_code, 401)
        self.assertEqual(SiteImage.objects.count(), 0)
        self.assertEqual(self.media_files(), [])

    def test_unknown_slot_is_not_found(self):
        self.as_user(self.admin)
        self.assertEqual(self.put("banner", upload(png())).status_code, 404)
        self.assertEqual(self.client.delete("/api/site-images/banner").status_code, 404)

    # ----------------------------------------------------------- upload safety

    def test_a_non_image_is_rejected(self):
        self.as_user(self.admin)
        self.assertRejected(self.put("hero", upload(b"just some text", "notes.txt", "text/plain")), "image_invalid")

    def test_a_fake_extension_is_rejected_whatever_it_claims_to_be(self):
        self.as_user(self.admin)
        # Text and an HTML page named .jpg, with an image content type.
        self.assertRejected(self.put("hero", upload(b"<script>alert(1)</script>", "x.jpg", "image/jpeg")), "image_invalid")
        # A real image in a format that is not allowed, named .jpg.
        for fmt in ("GIF", "BMP"):
            buf = BytesIO()
            Image.new("RGB", (1500, 1000), (1, 2, 3)).save(buf, format=fmt)
            res = self.put("hero", upload(buf.getvalue(), "photo.jpg", "image/jpeg"))
            self.assertRejected(res, "image_type_not_allowed")

    def test_a_truncated_image_is_rejected(self):
        self.as_user(self.admin)
        # Noise, so the PNG is large enough that cutting it in half removes real image data.
        buf = BytesIO()
        Image.effect_noise((1500, 1000), 80).convert("RGB").save(buf, format="PNG")
        cut = buf.getvalue()[: len(buf.getvalue()) // 2]
        self.assertRejected(self.put("hero", upload(cut)), "image_invalid")

    def test_an_oversized_file_is_rejected(self):
        self.as_user(self.admin)
        big = png(1500, 1000) + b"\0" * (8 * 1024 * 1024)  # a valid PNG, padded past 8 MB
        res = self.put("hero", upload(big))
        self.assertRejected(res, "image_too_large")
        self.assertEqual(res.data["params"], {"maxMb": 8})

    def test_too_many_pixels_is_rejected(self):
        self.as_user(self.admin)
        buf = BytesIO()
        Image.new("L", (7000, 6000)).save(buf, format="PNG")  # 42 megapixels, a few KB on disk
        self.assertLess(len(buf.getvalue()), 8 * 1024 * 1024)
        res = self.put("hero", upload(buf.getvalue()))
        self.assertRejected(res, "image_too_many_pixels")
        self.assertEqual(res.data["params"], {"megapixels": 40})

    def test_a_decompression_bomb_is_rejected_without_decoding_it(self):
        self.as_user(self.admin)
        buf = BytesIO()
        Image.new("1", (12000, 9000)).save(buf, format="PNG")  # 108 megapixels: Pillow's own bomb error
        self.assertRejected(self.put("hero", upload(buf.getvalue())), "image_too_many_pixels")

    def test_too_small_an_image_is_rejected_for_hero_and_feature(self):
        self.as_user(self.admin)
        for slot in ("hero", "feature"):
            res = self.put(slot, upload(png(1199, 800)))
            self.assertRejected(res, "image_too_small")
            self.assertEqual(res.data["params"], {"minWidth": 1200, "width": 1199})
        # The sign-in strip is narrow, so it accepts less.
        self.assertEqual(self.put("auth", upload(png(700, 1000))).status_code, 200)
        self.assertEqual(self.put("hero", upload(png(1200, 800))).status_code, 200)

    def test_missing_file_is_rejected(self):
        self.as_user(self.admin)
        self.assertRejected(self.put("hero"), "image_required")

    def test_missing_alt_text_is_rejected_in_each_language(self):
        self.as_user(self.admin)
        for field in ("altEn", "altFr", "altAr"):
            for value in ("", "   "):
                self.assertRejected(self.put("hero", upload(png()), **{field: value}), "alt_required")
        # Left out entirely, too.
        res = self.client.put("/api/site-images/hero", {"file": upload(png()), "altEn": "x"}, format="multipart")
        self.assertRejected(res, "alt_required")

    def test_over_long_text_is_rejected(self):
        self.as_user(self.admin)
        self.assertRejected(self.put("hero", upload(png()), altFr="x" * 201), "site_image_text_too_long")
        self.assertRejected(self.put("hero", upload(png()), credit="x" * 201), "site_image_text_too_long")

    def test_credit_is_optional(self):
        self.as_user(self.admin)
        res = self.put("hero", upload(png()), credit="")
        self.assertEqual(res.status_code, 200, res.data)
        self.assertEqual(res.data["credit"], "")

    # ----------------------------------------------------------- restoring

    def test_delete_resets_the_slot_and_removes_the_files(self):
        self.as_user(self.admin)
        self.put("hero", upload(png(2400, 1600)))
        self.put("feature", upload(png(2400, 1600)))
        self.assertEqual(len(self.media_files()), 6)
        res = self.client.delete("/api/site-images/hero")
        self.assertEqual(res.status_code, 204)
        self.assertEqual(len(self.media_files()), 3)  # the feature photo's files remain
        data = self.client.get("/api/site-images").data
        self.assertIsNone(data["hero"])
        self.assertIsNotNone(data["feature"])
        log = ActivityLog.objects.get(action="SITE_IMAGE_RESET")
        self.assertEqual((log.code, log.params), ("site_image_reset", {"slot": "hero"}))

    def test_deleting_a_slot_that_was_never_changed_is_harmless(self):
        self.as_user(self.admin)
        self.assertEqual(self.client.delete("/api/site-images/hero").status_code, 204)
        self.assertFalse(ActivityLog.objects.filter(action="SITE_IMAGE_RESET").exists())
