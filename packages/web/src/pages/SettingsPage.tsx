import { useEffect, useState, type FormEvent } from 'react';
import { Navigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { FaBell, FaKey, FaSpinner, FaUserEdit } from 'react-icons/fa';
import { AVATAR_COLORS } from '@sciehub/shared';
import { api } from '@/lib/api';
import { PageMeta } from '@/components/common/PageMeta';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PasswordInput } from '@/components/ui/password-input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { UserAvatar } from '@/components/generated/UserAvatar';
import { AccountSafetySection } from '@/components/settings/AccountSafetySection';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/components/common/Toast';
import { cn } from '@/lib/utils';

const NOTIF_KEY = 'sciehub_notifications';

function loadNotifs(): { email: boolean; groupActivity: boolean } {
  try {
    const raw = localStorage.getItem(NOTIF_KEY);
    if (raw) return { email: true, groupActivity: true, ...JSON.parse(raw) };
  } catch {
    // ignore
  }
  return { email: true, groupActivity: true };
}

export function SettingsPage() {
  const { user, loading, refresh } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [nickname, setNickname] = useState(user?.nickname ?? '');
  const [bio, setBio] = useState(user?.bio ?? '');
  const [avatarColor, setAvatarColor] = useState(user?.avatarUrl?.startsWith('#') ? user.avatarUrl : AVATAR_COLORS[0]);
  const [notifs, setNotifs] = useState(loadNotifs);
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  useEffect(() => {
    if (user) {
      setNickname(user.nickname);
      setBio(user.bio);
      if (user.avatarUrl?.startsWith('#')) setAvatarColor(user.avatarUrl);
    }
  }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    try {
      localStorage.setItem(NOTIF_KEY, JSON.stringify(notifs));
    } catch {
      // ignore
    }
  }, [notifs]);

  const profileMutation = useMutation({
    mutationFn: () =>
      api('/users/me', {
        method: 'PUT',
        json: { nickname: nickname.trim(), bio: bio.trim(), avatarUrl: avatarColor },
      }),
    onSuccess: async () => {
      await refresh();
      queryClient.invalidateQueries({ queryKey: ['user'] });
      toast('Profile updated', 'success');
    },
    onError: (err) => toast(err instanceof Error ? err.message : 'Could not update profile', 'error'),
  });

  const passwordMutation = useMutation({
    mutationFn: () =>
      api('/users/me/password', {
        method: 'PUT',
        json: { oldPassword, newPassword },
      }),
    onSuccess: () => {
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
      toast('Password changed', 'success');
    },
    onError: (err) => toast(err instanceof Error ? err.message : 'Could not change password', 'error'),
  });

  if (loading) return null;
  if (!user) return <Navigate to="/auth" replace state={{ from: '/settings' }} />;

  const onSubmitPassword = (e: FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 6) {
      toast('New password must be at least 6 characters', 'error');
      return;
    }
    if (newPassword !== confirmPassword) {
      toast('Passwords do not match', 'error');
      return;
    }
    passwordMutation.mutate();
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 lg:px-8">
      <PageMeta title="Settings" description="Manage your SCIEHub account." />
      <h1 className="flex items-center gap-2 font-display text-3xl">
        <FaUserEdit className="h-6 w-6 text-accent" /> Settings
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">Manage your profile, preferences and security.</p>

      {/* Profile */}
      <section className="mt-8 rounded-2xl border border-border/75 bg-surface/75 shadow-soft p-6">
        <h2 className="font-semibold">Profile</h2>
        <div className="mt-5 flex flex-wrap items-center gap-6">
          <div className="text-center">
            <UserAvatar nickname={nickname || user.nickname} username={user.username} avatarUrl={avatarColor} size="lg" />
            <p className="mt-2 text-xs text-muted-foreground">Preview</p>
          </div>
          <div className="flex-1 space-y-2">
            <Label>Avatar color</Label>
            <div className="flex flex-wrap gap-2">
              {AVATAR_COLORS.map((color) => (
                <button
                  key={color}
                  type="button"
                  onClick={() => setAvatarColor(color)}
                  aria-label={`Use avatar color ${color}`}
                  className={cn(
                    'h-8 w-8 cursor-pointer rounded-full border-2 transition-transform',
                    avatarColor === color ? 'scale-110 border-foreground' : 'border-transparent hover:scale-110',
                  )}
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>
          </div>
        </div>

        <div className="mt-6 grid gap-5 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="set-nickname">Nickname</Label>
            <Input id="set-nickname" value={nickname} onChange={(e) => setNickname(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="set-username">Username</Label>
            <Input id="set-username" value={`@${user.username}`} disabled />
          </div>
        </div>
        <div className="mt-5 space-y-2">
          <Label htmlFor="set-bio">Bio</Label>
          <Textarea id="set-bio" value={bio} onChange={(e) => setBio(e.target.value)} rows={3} placeholder="Tell your classmates what you study…" />
        </div>
        <div className="mt-5 flex justify-end">
          <Button onClick={() => profileMutation.mutate()} disabled={profileMutation.isPending}>
            {profileMutation.isPending && <FaSpinner className="h-4 w-4 animate-spin" />}
            Save profile
          </Button>
        </div>
      </section>

      <Separator className="my-8" />

      {/* Notifications */}
      <section className="rounded-2xl border border-border/75 bg-surface/75 shadow-soft p-6">
        <h2 className="flex items-center gap-2 font-semibold">
          <FaBell className="h-4 w-4 text-accent" /> Notifications
        </h2>
        <div className="mt-4 space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium">Email notifications</p>
              <p className="text-xs text-muted-foreground">Receive updates about your resources and groups by email.</p>
            </div>
            <Switch checked={notifs.email} onCheckedChange={(v) => setNotifs((n) => ({ ...n, email: v }))} />
          </div>
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium">Group activity</p>
              <p className="text-xs text-muted-foreground">Get notified when someone comments in your groups.</p>
            </div>
            <Switch checked={notifs.groupActivity} onCheckedChange={(v) => setNotifs((n) => ({ ...n, groupActivity: v }))} />
          </div>
        </div>
      </section>

      <Separator className="my-8" />

      {/* Password */}
      <section className="rounded-2xl border border-border/75 bg-surface/75 shadow-soft p-6">
        <h2 className="flex items-center gap-2 font-semibold">
          <FaKey className="h-4 w-4 text-accent" /> Change password
        </h2>
        <form onSubmit={onSubmitPassword} className="mt-4 max-w-md space-y-4">
          <div className="space-y-2">
            <Label htmlFor="old-pass">Current password</Label>
            <PasswordInput id="old-pass" value={oldPassword} onChange={(e) => setOldPassword(e.target.value)} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="new-pass">New password</Label>
            <PasswordInput id="new-pass" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirm-pass">Confirm new password</Label>
            <PasswordInput id="confirm-pass" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required />
          </div>
          <div className="flex justify-end">
            <Button type="submit" disabled={passwordMutation.isPending || !oldPassword || !newPassword || !confirmPassword}>
              {passwordMutation.isPending && <FaSpinner className="h-4 w-4 animate-spin" />}
              Change password
            </Button>
          </div>
        </form>
      </section>

      <Separator className="my-8" />

      <AccountSafetySection />
    </div>
  );
}
