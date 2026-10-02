"""UserProfile.active drives User.is_active however it is saved (e.g. in the Django admin)."""
from django.test import TestCase

from .tests import make_user


class ActiveSyncTests(TestCase):
    def test_saving_the_profile_syncs_the_user(self):
        user = make_user("m@x.com")
        profile = user.profile
        profile.active = False
        profile.save()
        user.refresh_from_db()
        self.assertFalse(user.is_active)
        profile.active = True
        profile.save()
        user.refresh_from_db()
        self.assertTrue(user.is_active)
