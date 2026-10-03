"""Admin-set site photographs (docs/rework/R4.md): upload checks, re-encoding, storing and removing.

The upload is untrusted. What it claims to be (extension, content type) is ignored: Pillow opens it and decides.
Only JPEG, PNG and WebP pass, at most 8 MB and 40 megapixels. Every rendition is built from the decoded
pixels alone, so EXIF (GPS, camera, owner) and any other embedded metadata never reaches the disk.
Every photograph is stored in black and white (the site is green, white and red), whatever slot it is for.
"""
import warnings
from io import BytesIO

from django.core.files.base import ContentFile
from django.db import transaction
from PIL import Image, ImageCms, ImageOps

from .errors import BusinessRuleError
from .models import SiteImage, SiteImageSlot

MAX_BYTES = 8 * 1024 * 1024
MAX_PIXELS = 40_000_000
ALLOWED_FORMATS = {"JPEG", "PNG", "WEBP"}
WIDTHS = (2000, 1200, 640)
TEXT_MAX = 200
# The hero and the feature photo fill the screen; the sign-in panel is a narrow strip.
MIN_WIDTH = {SiteImageSlot.HERO: 1200, SiteImageSlot.FEATURE: 1200, SiteImageSlot.AUTH: 640}
WEBP_QUALITY = 82

# Pillow's own decompression-bomb guard, as a second line behind the explicit check below.
Image.MAX_IMAGE_PIXELS = MAX_PIXELS


def _text(value, field: str) -> str:
    text = (value or "").strip()
    if len(text) > TEXT_MAX:
        raise BusinessRuleError("site_image_text_too_long", f"Keep the {field} to {TEXT_MAX} characters or fewer.",
                                field=field, max=TEXT_MAX)
    return text


def clean_texts(alt_en, alt_fr, alt_ar, credit) -> dict:
    """The alt text in all three languages is required: these photographs are not decorative."""
    alts = {"alt_en": (alt_en or "").strip(), "alt_fr": (alt_fr or "").strip(), "alt_ar": (alt_ar or "").strip()}
    if not all(alts.values()):
        raise BusinessRuleError("alt_required", "Describe the photograph in English, French and Arabic.")
    return {**{k: _text(v, k) for k, v in alts.items()}, "credit": _text(credit, "credit")}


def decode(upload, slot: str) -> Image.Image:
    """Open an uploaded file as an RGB image with no metadata, or raise the error that says why not."""
    if upload is None:
        raise BusinessRuleError("image_required", "Choose a photograph to upload.")
    if upload.size > MAX_BYTES:
        raise BusinessRuleError("image_too_large", "The photograph is larger than 8 MB.", maxMb=MAX_BYTES // 2**20)
    try:
        with warnings.catch_warnings():
            warnings.simplefilter("ignore", Image.DecompressionBombWarning)  # the explicit check below answers
            img = Image.open(upload)
    except Image.DecompressionBombError:
        raise BusinessRuleError("image_too_many_pixels", "The photograph has more than 40 megapixels.",
                                megapixels=MAX_PIXELS // 1_000_000)
    except Exception:  # not an image at all, or one Pillow cannot read
        raise BusinessRuleError("image_invalid", "The file is not a readable image.")
    if img.format not in ALLOWED_FORMATS:
        raise BusinessRuleError("image_type_not_allowed", "Only JPEG, PNG and WebP photographs are accepted.")
    # The size is in the header: refuse a huge image before any pixel is decoded.
    if img.width * img.height > MAX_PIXELS:
        raise BusinessRuleError("image_too_many_pixels", "The photograph has more than 40 megapixels.",
                                megapixels=MAX_PIXELS // 1_000_000)
    try:
        img.load()  # decodes everything; a truncated or corrupt file fails here
        img = ImageOps.exif_transpose(img)  # honour the camera's rotation before the EXIF is dropped
    except Exception:
        raise BusinessRuleError("image_invalid", "The file is not a readable image.")

    minimum = MIN_WIDTH[slot]
    if img.width < minimum:
        raise BusinessRuleError("image_too_small", f"The photograph must be at least {minimum} pixels wide.",
                                minWidth=minimum, width=img.width)
    return _plain_rgb(img)


def _plain_rgb(img: Image.Image) -> Image.Image:
    """Greyscale pixels (as RGB, so R == G == B) from sRGB, transparency flattened onto white, in a fresh image that carries no `info`."""
    profile = img.info.get("icc_profile")
    if img.mode in ("RGBA", "LA", "PA") or (img.mode == "P" and "transparency" in img.info):
        rgba = img.convert("RGBA")
        flat = Image.new("RGB", rgba.size, (255, 255, 255))
        flat.paste(rgba, mask=rgba.getchannel("A"))
        img = flat
    elif img.mode != "RGB":
        img = img.convert("RGB")
    if profile:
        try:
            img = ImageCms.profileToProfile(
                img, ImageCms.ImageCmsProfile(BytesIO(profile)), ImageCms.createProfile("sRGB"), outputMode="RGB")
        except Exception:
            pass  # a profile Pillow cannot apply: keep the pixels as they are
    img = ImageOps.grayscale(img).convert("RGB")  # black and white for every slot, after the colour profile is applied
    return Image.frombytes("RGB", img.size, img.tobytes())


def renditions(img: Image.Image) -> dict[int, bytes]:
    """WebP bytes per target width. A target wider than the original is capped at the original (no upscaling)."""
    out = {}
    for width in WIDTHS:
        w = min(width, img.width)
        h = max(1, round(img.height * w / img.width))
        sized = img if w == img.width else img.resize((w, h), Image.Resampling.LANCZOS)
        buf = BytesIO()
        sized.save(buf, format="WEBP", quality=WEBP_QUALITY, method=4)  # no exif / icc arguments: none is written
        out[width] = buf.getvalue()
    return out


def rendition_widths(image: SiteImage) -> list[tuple[str, int]]:
    """(attribute, real width) for each stored file, smallest first, dropping a file that repeats a narrower width."""
    seen, out = set(), []
    for attr, nominal in (("image_640", 640), ("image_1200", 1200), ("image_2000", 2000)):
        w = min(nominal, image.width)
        if w not in seen:
            seen.add(w)
            out.append((attr, w))
    return out


def _delete_files(names: list[str], storage):
    for name in names:
        if name:
            storage.delete(name)


def store(slot: str, upload, texts: dict, user) -> SiteImage:
    """Validate and re-encode `upload`, save it as the slot's photograph, and delete the one it replaces."""
    img = decode(upload, slot)
    data = renditions(img)
    with transaction.atomic():
        row = SiteImage.objects.select_for_update().filter(slot=slot).first() or SiteImage(slot=slot)
        old = [f.name for f in row.files()] if row.pk else []
        storage = row.image_2000.storage
        row.width, row.height, row.updated_by = img.width, img.height, user
        for key, value in texts.items():
            setattr(row, key, value)
        for width in WIDTHS:  # `save=False`: the row is written once, below, with all three names
            getattr(row, f"image_{width}").save("x.webp", ContentFile(data[width]), save=False)
        new = [f.name for f in row.files()]
        try:
            row.save()
        except Exception:
            _delete_files(new, storage)
            raise
    _delete_files(old, storage)
    return row


def remove(row: SiteImage):
    names = [f.name for f in row.files()]
    storage = row.image_2000.storage
    row.delete()
    _delete_files(names, storage)
