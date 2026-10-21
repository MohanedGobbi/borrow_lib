from django.contrib.auth.models import User
from django.db.models.signals import post_save, pre_delete
from django.dispatch import receiver
from django.utils import timezone

from .models import Role, StaffInvite, UserProfile


def revoke_invites_from(user_id):
    StaffInvite.objects.filter(created_by_id=user_id, used_at=None, revoked_at=None).update(revoked_at=timezone.now())


@receiver(post_save, sender=UserProfile)
def sync_user_active(sender, instance, **kwargs):
    """Keep User.is_active (which SimpleJWT checks) equal to profile.active, wherever it is saved."""
    if kwargs.get("raw"):  # restoring a backup: the rows are written exactly as they were saved
        return
    if instance.user.is_active != instance.active:
        # A queryset update skips User's own signals, so there is no save recursion.
        User.objects.filter(pk=instance.user_id).update(is_active=instance.active)
        instance.user.is_active = instance.active
    # An invite carries its creator's authority: it dies when that authority does.
    if not instance.active or (instance.role != Role.ADMIN and not instance.user.is_superuser):
        revoke_invites_from(instance.user_id)


@receiver(pre_delete, sender=User)
def revoke_invites_of_deleted_user(sender, instance, **kwargs):
    revoke_invites_from(instance.pk)
