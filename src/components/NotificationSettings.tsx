import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { apiAuth } from "@/api";
import { useAuth } from "@/auth/AuthContext";
import { useI18n } from "@/i18n";
import { errorMessage } from "@/lib/errors";
import { Panel } from "@/components/Page";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  EMAIL_KINDS, NOTIFICATION_GROUPS, type EmailKind, type NotificationGroup, type NotificationPrefs, type Profile,
} from "@/types";

/**
 * The member chooses which notifications reach them: each group of in-app notifications, and each kind of
 * reminder email (under a master switch for all of them). Every box saves on its own, straight away.
 */
export function NotificationSettings({ me }: { me: Profile }) {
  const { t } = useI18n();
  const { refresh } = useAuth();

  const prefs = useMutation({
    mutationFn: apiAuth.setNotificationPrefs,
    onSuccess: async () => {
      await refresh();
      toast.success(t("notifPrefs.saved"));
    },
    onError: (e) => {
      toast.error(errorMessage(t, e));
    },
  });
  const master = useMutation({
    mutationFn: apiAuth.setEmailReminders,
    onSuccess: async (profile) => {
      await refresh();
      toast.success(t(profile.emailReminders ? "toast.remindersOn" : "toast.remindersOff"));
    },
    onError: (e) => {
      toast.error(errorMessage(t, e));
    },
  });

  // While a change is saving, the boxes show the value being saved.
  const pending: NotificationPrefs = prefs.isPending ? prefs.variables : {};
  const inApp = (g: NotificationGroup) => pending.inApp?.[g] ?? me.notificationPrefs?.inApp?.[g] ?? true;
  const email = (k: EmailKind) => pending.email?.[k] ?? me.notificationPrefs?.email?.[k] ?? true;
  const emailsOn = master.isPending ? master.variables : me.emailReminders;
  const busy = prefs.isPending || master.isPending;

  const row = (id: string, label: string, help: string, checked: boolean, onChange: (v: boolean) => void, disabled = false) => (
    <div key={id} className="flex items-start gap-3 px-4 py-3">
      <Checkbox
        id={id}
        className="mt-1"
        checked={checked}
        disabled={busy || disabled}
        onCheckedChange={(v) => onChange(v === true)}
        aria-describedby={`${id}-help`}
      />
      <div className="min-w-0">
        <Label htmlFor={id} className="text-[15px] font-medium">{label}</Label>
        <p id={`${id}-help`} className="mt-0.5 text-sm text-muted-foreground">{help}</p>
      </div>
    </div>
  );

  return (
    <Panel title={t("notifPrefs.title")} flush>
      <p className="px-4 py-3 text-sm text-muted-foreground">{t("notifPrefs.sub")}</p>
      <h3 className="border-y bg-surface px-4 py-2 text-xs font-semibold text-muted-foreground">{t("notifPrefs.inApp")}</h3>
      <div className="divide-y">
        {NOTIFICATION_GROUPS.map((g) =>
          row(`notif-${g}`, t(`notifPrefs.group.${g}`), t(`notifPrefs.groupHelp.${g}`), inApp(g),
            (v) => prefs.mutate({ inApp: { [g]: v } })))}
      </div>
      <h3 className="border-y bg-surface px-4 py-2 text-xs font-semibold text-muted-foreground">{t("notifPrefs.email")}</h3>
      <div className="divide-y">
        {row("email-reminders", t("profile.reminders"), t("profile.remindersHelp"), emailsOn, (v) => master.mutate(v))}
        {EMAIL_KINDS.map((k) =>
          row(`email-${k}`, t(`notifPrefs.emailKind.${k}`), t(`notifPrefs.emailHelp.${k}`), emailsOn && email(k),
            (v) => prefs.mutate({ email: { [k]: v } }), !emailsOn))}
      </div>
    </Panel>
  );
}
