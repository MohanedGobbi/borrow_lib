"""Transactional email: password reset, address verification, staff invites (docs/rework/WP-08.md)
and the loan reminders: ready for pickup, due soon, overdue (docs/rework/F2.md).

One function per email. Each builds a plain-text message in the recipient's language
(for invites, the inviting admin's), and never raises: a failed send is logged and reported
through the return value, so a mail outage cannot break a request.
"""
import logging
from zoneinfo import ZoneInfo

from django.conf import settings
from django.contrib.auth.tokens import PasswordResetTokenGenerator, default_token_generator
from django.core.mail import EmailMessage, get_connection, send_mail
from django.utils import timezone, translation
from django.utils.encoding import force_bytes
from django.utils.formats import date_format
from django.utils.http import urlsafe_base64_encode

from .models import INVITE_LIFETIME

log = logging.getLogger(__name__)

HOUR, DAY = 3600, 86400


class EmailVerificationTokenGenerator(PasswordResetTokenGenerator):
    """Like a password reset token, but it dies when the address is verified."""
    key_salt = "library.emails.EmailVerificationTokenGenerator"

    def _make_hash_value(self, user, timestamp):
        return f"{user.pk}{user.email}{user.profile.email_verified}{timestamp}"


email_verification_token = EmailVerificationTokenGenerator()

GREETING = {
    "en": ("Hello {name},", "Hello,"),
    "fr": ("Bonjour {name},", "Bonjour,"),
    "ar": ("مرحبًا {name}،", "مرحبًا،"),
}

# Per language: (subject, body). {link}, {library} and {validity} are filled in below.
MESSAGES = {
    "password_reset": {
        "en": ("Reset your {library} password",
               "We received a request to reset the password of your {library} account. "
               "Open this link to choose a new one:\n\n{link}\n\n"
               "The link is valid for {validity} and works once. If you did not ask for this, "
               "ignore this email: your password stays as it is."),
        "fr": ("Réinitialisez votre mot de passe {library}",
               "Nous avons reçu une demande de réinitialisation du mot de passe de votre compte {library}. "
               "Ouvrez ce lien pour en choisir un nouveau :\n\n{link}\n\n"
               "Le lien est valable {validity} et ne fonctionne qu'une fois. Si vous n'êtes pas à l'origine "
               "de cette demande, ignorez cet e-mail : votre mot de passe reste inchangé."),
        "ar": ("إعادة تعيين كلمة مرور {library}",
               "تلقينا طلبًا لإعادة تعيين كلمة مرور حسابك في {library}. "
               "افتح هذا الرابط لاختيار كلمة مرور جديدة:\n\n{link}\n\n"
               "الرابط صالح لمدة {validity} ويعمل مرة واحدة فقط. إذا لم تطلب ذلك، "
               "تجاهل هذه الرسالة وستبقى كلمة مرورك كما هي."),
    },
    "verification": {
        "en": ("Confirm your {library} email address",
               "Welcome to {library}. Confirm that this address is yours to start borrowing books:\n\n{link}\n\n"
               "The link is valid for {validity}. You can ask for a new one from the notice at the top of the site."),
        "fr": ("Confirmez votre adresse e-mail {library}",
               "Bienvenue à {library}. Confirmez que cette adresse est bien la vôtre pour pouvoir emprunter des livres :\n\n{link}\n\n"
               "Le lien est valable {validity}. Vous pouvez en demander un nouveau depuis l'avis en haut du site."),
        "ar": ("تأكيد عنوان بريدك الإلكتروني في {library}",
               "مرحبًا بك في {library}. أكّد أن هذا العنوان لك لتتمكن من استعارة الكتب:\n\n{link}\n\n"
               "الرابط صالح لمدة {validity}. يمكنك طلب رابط جديد من الإشعار في أعلى الموقع."),
    },
    "welcome": {
        "en": ("Your {library} account is ready: set your password",
               "An account has been created for you at {library}. Set your password to start borrowing books:\n\n{link}\n\n"
               "The link is valid for {validity} and works once. If it has expired, open the sign-in page and "
               "choose “Forgot password?” to get a new one."),
        "fr": ("Votre compte {library} est prêt : choisissez votre mot de passe",
               "Un compte a été créé pour vous à {library}. Choisissez votre mot de passe pour commencer à emprunter des livres :\n\n{link}\n\n"
               "Le lien est valable {validity} et ne fonctionne qu'une fois. S'il a expiré, ouvrez la page de "
               "connexion et choisissez « Mot de passe oublié ? » pour en recevoir un nouveau."),
        "ar": ("حسابك في {library} جاهز: اختر كلمة مرورك",
               "تم إنشاء حساب لك في {library}. اختر كلمة مرورك لتبدأ باستعارة الكتب:\n\n{link}\n\n"
               "الرابط صالح لمدة {validity} ويعمل مرة واحدة فقط. إذا انتهت صلاحيته، افتح صفحة تسجيل الدخول "
               "واختر «نسيت كلمة المرور؟» للحصول على رابط جديد."),
    },
    "staff_invite": {
        "en": ("You are invited to join {library} as {role}",
               "You have been invited to create a {role} account at {library}. Open this link to sign up "
               "with this email address:\n\n{link}\n\n"
               "The link is valid for {validity} and can be used once."),
        "fr": ("Invitation à rejoindre {library} comme {role}",
               "Vous êtes invité(e) à créer un compte {role} à {library}. Ouvrez ce lien pour vous inscrire "
               "avec cette adresse e-mail :\n\n{link}\n\n"
               "Le lien est valable {validity} et ne peut être utilisé qu'une fois."),
        "ar": ("دعوة للانضمام إلى {library} بصفة {role}",
               "تمت دعوتك لإنشاء حساب {role} في {library}. افتح هذا الرابط للتسجيل "
               "بهذا البريد الإلكتروني:\n\n{link}\n\n"
               "الرابط صالح لمدة {validity} ويمكن استخدامه مرة واحدة فقط."),
    },
    "ready": {
        "en": ("“{title}” is ready for pickup",
               "“{title}” is being held for you at {library}.\n\n"
               "{shelf_line}Pick it up by {deadline}. If you do not, the hold is cancelled and the book goes "
               "to the next person on the waiting list.\n\nYour loans: {link}\n\n{footer}"),
        "fr": ("« {title} » est prêt à être retiré",
               "« {title} » est réservé pour vous à {library}.\n\n"
               "{shelf_line}Venez le retirer avant le {deadline}. Passé ce délai, la réservation est annulée "
               "et le livre passe au prochain membre de la liste d'attente.\n\nVos prêts : {link}\n\n{footer}"),
        "ar": ("«{title}» جاهز للاستلام",
               "«{title}» محجوز لك في {library}.\n\n"
               "{shelf_line}يرجى استلامه قبل {deadline}. بعد ذلك يُلغى الحجز وينتقل الكتاب إلى العضو التالي "
               "في قائمة الانتظار.\n\nإعاراتي: {link}\n\n{footer}"),
    },
    "due_soon": {
        "en": ("“{title}” is due back soon",
               "Your loan of “{title}” is due back on {due}. Please return it to the circulation desk by then."
               "{renewal}\n\nYour loans: {link}\n\n{footer}"),
        "fr": ("« {title} » est bientôt à rendre",
               "Votre prêt de « {title} » est à rendre le {due}. Merci de le rapporter au bureau de prêt avant "
               "cette date.{renewal}\n\nVos prêts : {link}\n\n{footer}"),
        "ar": ("موعد إرجاع «{title}» يقترب",
               "موعد إرجاع «{title}» المُعار لك هو {due}. يرجى إعادته إلى مكتب الإعارة قبل ذلك."
               "{renewal}\n\nإعاراتي: {link}\n\n{footer}"),
    },
    "overdue": {
        "en": ("“{title}” is overdue",
               "“{title}” was due back on {due} and has not been returned. New requests are blocked until you "
               "return it at the circulation desk.\n\nYour loans: {link}\n\n{footer}"),
        "fr": ("« {title} » est en retard",
               "« {title} » devait être rendu le {due} et ne l'a pas été. Les nouvelles demandes sont bloquées "
               "tant que vous ne l'avez pas rapporté au bureau de prêt.\n\nVos prêts : {link}\n\n{footer}"),
        "ar": ("«{title}» متأخر عن موعد الإرجاع",
               "كان موعد إرجاع «{title}» في {due} ولم يُرجَع بعد. الطلبات الجديدة محظورة إلى أن تعيده إلى "
               "مكتب الإعارة.\n\nإعاراتي: {link}\n\n{footer}"),
    },
}

ROLE_NAMES = {
    "STAFF": {"en": "staff", "fr": "membre du personnel", "ar": "موظف"},
    "ADMIN": {"en": "admin", "fr": "administrateur", "ar": "مسؤول"},
}

# Pieces of the reminder emails, per language.
REMINDER_PARTS = {
    "en": {"shelf": "Shelf mark: {shelf}\n", "renewal": " You can renew it from My loans.",
           "footer": "You get this email because email reminders are on. You can turn them off in your profile: {profile_link}"},
    "fr": {"shelf": "Cote : {shelf}\n", "renewal": " Vous pouvez le renouveler depuis Mes prêts.",
           "footer": "Vous recevez cet e-mail parce que les rappels par e-mail sont activés. Vous pouvez les désactiver dans votre profil : {profile_link}"},
    "ar": {"shelf": "رمز الرف: {shelf}\n", "renewal": " يمكنك تجديده من إعاراتي.",
           "footer": "تصلك هذه الرسالة لأن التذكيرات بالبريد الإلكتروني مفعّلة. يمكنك إيقافها من ملفك الشخصي: {profile_link}"},
}

UNITS = {
    "en": {"hour": ("hour", "hours"), "day": ("day", "days")},
    "fr": {"hour": ("heure", "heures"), "day": ("jour", "jours")},
}


def language_of(user) -> str:
    profile = getattr(user, "profile", None)
    return profile.language if profile and profile.language in GREETING else "en"


def duration(seconds: int, lang: str) -> str:
    unit, n = ("day", seconds // DAY) if seconds % DAY == 0 else ("hour", max(1, round(seconds / HOUR)))
    if lang == "ar":
        if n == 1:
            return "يوم واحد" if unit == "day" else "ساعة واحدة"
        if n == 2:
            return "يومان" if unit == "day" else "ساعتان"
        word = ("أيام", "ساعات") if n <= 10 else ("يومًا", "ساعة")
        return f"{n} {word[0] if unit == 'day' else word[1]}"
    singular, plural = UNITS[lang][unit]
    return f"{n} {singular if n == 1 else plural}"


def frontend_link(path: str, **params) -> str:
    query = "&".join(f"{key}={value}" for key, value in params.items())
    return f"{settings.FRONTEND_URL.rstrip('/')}{path}" + (f"?{query}" if query else "")


def user_link(path: str, user, token: str) -> str:
    return frontend_link(path, uid=urlsafe_base64_encode(force_bytes(user.pk)), token=token)


def compose(kind: str, lang: str, name: str | None, **values) -> tuple[str, str]:
    """The (subject, body) of one email in one language."""
    subject, body = MESSAGES[kind][lang]
    values.setdefault("library", settings.LIBRARY_NAME)
    greeting = GREETING[lang][0].format(name=name) if name else GREETING[lang][1]
    return subject.format(**values), f"{greeting}\n\n{body.format(**values)}\n\n{values['library']}"


def deliver(kind: str, lang: str, to: str, name: str | None, **values) -> bool:
    subject, text = compose(kind, lang, name, **values)
    try:
        send_mail(subject, text, settings.DEFAULT_FROM_EMAIL, [to])
        return True
    except Exception:  # SMTP down, bad credentials…: the request must still answer as specced
        log.exception("Could not send the %s email to %s", kind, to)
        return False


def send_password_reset(user) -> bool:
    lang = language_of(user)
    link = user_link("/reset-password", user, default_token_generator.make_token(user))
    return deliver("password_reset", lang, user.email, user.first_name or None, link=link,
                   validity=duration(settings.PASSWORD_RESET_TIMEOUT, lang))


def send_verification(user) -> bool:
    lang = language_of(user)
    link = user_link("/verify-email", user, email_verification_token.make_token(user))
    return deliver("verification", lang, user.email, user.first_name or None, link=link,
                   validity=duration(settings.PASSWORD_RESET_TIMEOUT, lang))


def send_welcome_batch(users) -> int:
    """The welcome email of freshly imported students, over one SMTP connection. Returns how many went out.

    The link is the password-reset link: it lets the student choose a first password, and using it also
    verifies the address. Never raises (see the module docstring).
    """
    users = [u for u in users if u.email]
    if not users:
        return 0
    messages = []
    for user in users:
        lang = language_of(user)
        link = user_link("/reset-password", user, default_token_generator.make_token(user))
        subject, text = compose("welcome", lang, user.first_name or None, link=link,
                                validity=duration(settings.PASSWORD_RESET_TIMEOUT, lang))
        messages.append(EmailMessage(subject, text, settings.DEFAULT_FROM_EMAIL, [user.email]))
    try:
        return get_connection().send_messages(messages) or 0
    except Exception:  # SMTP down: the accounts exist, and "Forgot password?" still works
        log.exception("Could not send the welcome emails")
        return 0


def invite_link(token: str) -> str:
    return frontend_link("/signup", invite=token)


def send_staff_invite(invite, token: str) -> bool:
    lang = language_of(invite.created_by) if invite.created_by else "en"
    return deliver("staff_invite", lang, invite.email, None, link=invite_link(token),
                   role=ROLE_NAMES[invite.role][lang],
                   validity=duration(int(INVITE_LIFETIME.total_seconds()), lang))


# ------------------------------------------------------------------ loan reminders

def local_datetime(value, lang: str) -> str:
    """A moment in the library's time zone, with the month spelled in the member's language."""
    with translation.override(lang):
        return date_format(timezone.localtime(value, ZoneInfo(settings.LIBRARY_TIME_ZONE)), "j F Y, H:i")


def _send_reminder(kind: str, record, **values) -> bool:
    """One reminder about `record` to its member, in their language. False when it was not (or could not be) sent."""
    user = record.user
    if not user.email:
        return False
    lang = language_of(user)
    parts = REMINDER_PARTS[lang]
    footer = parts["footer"].format(profile_link=frontend_link("/profile"))
    return deliver(kind, lang, user.email, user.first_name or None, title=record.book.title,
                   link=frontend_link("/my-requests"), footer=footer, **values)


def send_ready_email(record) -> bool:
    lang = language_of(record.user)
    shelf = record.book.shelf_location
    return _send_reminder("ready", record, deadline=local_datetime(record.pickup_deadline, lang),
                          shelf_line=REMINDER_PARTS[lang]["shelf"].format(shelf=shelf) if shelf else "")


def send_due_soon_email(record, can_renew: bool) -> bool:
    lang = language_of(record.user)
    return _send_reminder("due_soon", record, due=local_datetime(record.due_date, lang),
                          renewal=REMINDER_PARTS[lang]["renewal"] if can_renew else "")


def send_overdue_email(record) -> bool:
    lang = language_of(record.user)
    return _send_reminder("overdue", record, due=local_datetime(record.due_date, lang))
