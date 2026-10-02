from django.contrib.auth.models import User
from django.db.models.signals import post_save
from django.dispatch import receiver

from .models import UserProfile


@receiver(post_save, sender=UserProfile)
def sync_user_active(sender, instance, **kwargs):
    """Keep User.is_active (which SimpleJWT checks) equal to profile.active, wherever it is saved."""
    if instance.user.is_active != instance.active:
        # A queryset update skips User's own signals, so there is no save recursion.
        User.objects.filter(pk=instance.user_id).update(is_active=instance.active)
        instance.user.is_active = instance.active
