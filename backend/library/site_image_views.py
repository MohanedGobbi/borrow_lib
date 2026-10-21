"""The site's photographs: everyone reads them, admins replace or restore them."""
from rest_framework import status as http
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from . import site_images
from .errors import NotFoundError
from .models import SiteImage, SiteImageSlot, display_name, log_activity
from .permissions import IsAdmin

SLOTS = [value for value, _ in SiteImageSlot.choices]
SLOT_NAMES = {"hero": "landing page", "feature": "landing page feature", "auth": "sign-in pages"}


def serialize(image: SiteImage | None, request):
    """`null` for a slot nobody changed: the client shows the bundled photograph."""
    if image is None:
        return None
    url = lambda f: request.build_absolute_uri(f.url)  # noqa: E731
    sources = [(url(getattr(image, attr)), w) for attr, w in site_images.rendition_widths(image)]
    return {
        "src": url(image.image_1200),
        "srcset": ", ".join(f"{u} {w}w" for u, w in sources),
        "width": image.width,
        "height": image.height,
        "alt": {"en": image.alt_en, "fr": image.alt_fr, "ar": image.alt_ar},
        "credit": image.credit,
        "updatedAt": image.updated_at,
    }


def check_slot(slot: str) -> str:
    if slot not in SLOTS:
        raise NotFoundError("not_found", "Not found.")
    return slot


class SiteImageListView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        rows = {row.slot: row for row in SiteImage.objects.all()}
        return Response({slot: serialize(rows.get(slot), request) for slot in SLOTS})


class SiteImageDetailView(APIView):
    """Admin only. PUT replaces the slot's photograph; DELETE returns the slot to the bundled one."""
    permission_classes = [IsAdmin]

    def put(self, request, slot):
        check_slot(slot)
        d = request.data
        texts = site_images.clean_texts(d.get("altEn"), d.get("altFr"), d.get("altAr"), d.get("credit"))
        row = site_images.store(slot, request.FILES.get("file"), texts, request.user)
        log_activity(display_name(request.user), "SITE_IMAGE_CHANGED",
                     f"Replaced the {SLOT_NAMES[slot]} photograph.", slot=slot)
        return Response(serialize(row, request))

    def delete(self, request, slot):
        check_slot(slot)
        row = SiteImage.objects.filter(slot=slot).first()
        if row:
            site_images.remove(row)
            log_activity(display_name(request.user), "SITE_IMAGE_RESET",
                         f"Restored the default {SLOT_NAMES[slot]} photograph.", slot=slot)
        return Response(status=http.HTTP_204_NO_CONTENT)
