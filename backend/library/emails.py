"""Transactional email: password reset, address verification and staff invites (docs/rework/WP-08.md).

One function per email. Each builds a plain-text message in the recipient's language
(for invites, the inviting admin's), and never raises: a failed send is logged and reported
through the return value, so a mail outage cannot break a request.
"""
import logging

from django.conf import settings
from django.contrib.auth.tokens import PasswordResetTokenGenerator, default_token_generator
from django.core.mail import send_mail
from django.utils.encoding import force_bytes
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
}

ROLE_NAMES = {
    "STAFF": {"en": "staff", "fr": "membre du personnel", "ar": "موظف"},
    "ADMIN": {"en": "admin", "fr": "administrateur", "ar": "مسؤول"},
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
    return f"{settings.FRONTEND_URL.rstrip('/')}{path}?{query}"


def user_link(path: str, user, token: str) -> str:
    return frontend_link(path, uid=urlsafe_base64_encode(force_bytes(user.pk)), token=token)


def deliver(kind: str, lang: str, to: str, name: str | None, **values) -> bool:
    subject, body = MESSAGES[kind][lang]
    values.setdefault("library", settings.LIBRARY_NAME)
    greeting = GREETING[lang][0].format(name=name) if name else GREETING[lang][1]
    try:
        send_mail(subject.format(**values), f"{greeting}\n\n{body.format(**values)}\n\n{values['library']}",
                  settings.DEFAULT_FROM_EMAIL, [to])
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


def invite_link(token: str) -> str:
    return frontend_link("/signup", invite=token)


def send_staff_invite(invite, token: str) -> bool:
    lang = language_of(invite.created_by) if invite.created_by else "en"
    return deliver("staff_invite", lang, invite.email, None, link=invite_link(token),
                   role=ROLE_NAMES[invite.role][lang],
                   validity=duration(int(INVITE_LIFETIME.total_seconds()), lang))
