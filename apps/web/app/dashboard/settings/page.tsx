'use client'

import { useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { Camera, LoaderCircle, Save, Trash2, UserCircle } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

const AVATAR_BUCKET = 'avatars'
const MAX_AVATAR_SIZE = 5 * 1024 * 1024
const AVATAR_TYPES = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
} as const

type SettingsMessage = { type: 'success' | 'error'; text: string }

export default function SettingsPage() {
  const router = useRouter()
  const avatarInput = useRef<HTMLInputElement>(null)
  const [userId, setUserId] = useState('')
  const [email, setEmail] = useState('')
  const [fullName, setFullName] = useState('')
  const [username, setUsername] = useState('')
  const [phone, setPhone] = useState('')
  const [state, setState] = useState('')
  const [city, setCity] = useState('')
  const [avatarUrl, setAvatarUrl] = useState('')
  const [avatarPath, setAvatarPath] = useState('')
  const [profileReady, setProfileReady] = useState(false)
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [savingProfile, setSavingProfile] = useState(false)
  const [changingPassword, setChangingPassword] = useState(false)
  const [avatarBusy, setAvatarBusy] = useState(false)
  const [revokingSessions, setRevokingSessions] = useState(false)
  const [message, setMessage] = useState<SettingsMessage | null>(null)

  useEffect(() => {
    const supabase = createClient()
    let active = true
    supabase.auth.getUser().then(({ data, error }) => {
      if (!active) return
      if (error || !data.user) {
        setMessage({ type: 'error', text: 'Unable to load account details. Sign in again and retry.' })
        setProfileReady(true)
        return
      }
      const metadata = data.user.user_metadata ?? {}
      setUserId(data.user.id)
      setEmail(data.user.email ?? '')
      setFullName(typeof metadata.full_name === 'string' ? metadata.full_name : '')
      setUsername(
        typeof metadata.username === 'string'
          ? metadata.username
          : typeof metadata.nickname === 'string'
            ? metadata.nickname
            : typeof metadata.full_name === 'string' ? metadata.full_name : '',
      )
      setPhone(typeof metadata.phone === 'string' ? metadata.phone : '')
      setState(typeof metadata.state === 'string' ? metadata.state : '')
      setCity(typeof metadata.city === 'string' ? metadata.city : '')
      setAvatarUrl(typeof metadata.avatar_url === 'string' ? metadata.avatar_url : '')
      setAvatarPath(typeof metadata.avatar_path === 'string' ? metadata.avatar_path : '')
      setProfileReady(true)
    }).catch((error: unknown) => {
      console.error('Could not load account details:', error)
      if (active) {
        setMessage({ type: 'error', text: 'Unable to load account details. Sign in again and retry.' })
        setProfileReady(true)
      }
    })
    return () => {
      active = false
    }
  }, [])

  function passwordError(password: string): string | null {
    if (password.length < 10) return 'Password must be at least 10 characters.'
    if (/^[a-zA-Z]+$/.test(password) || /^[0-9]+$/.test(password)) {
      return 'Password must include a mix of letters, numbers, or symbols.'
    }
    return null
  }

  async function handleProfileSave(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setMessage(null)
    if (!fullName.trim()) {
      setMessage({ type: 'error', text: 'Enter your full name.' })
      return
    }
    if (username.trim().length > 40) {
      setMessage({ type: 'error', text: 'Username or nickname must be 40 characters or fewer.' })
      return
    }

    setSavingProfile(true)
    try {
      const supabase = createClient()
      const normalizedEmail = email.trim().toLowerCase()
      const { error } = await supabase.auth.updateUser({
        data: {
          full_name: fullName.trim(),
          username: username.trim(),
          nickname: username.trim(),
          phone: phone.trim(),
          state: state.trim(),
          city: city.trim(),
        },
        ...(normalizedEmail !== email ? { email: normalizedEmail } : {}),
      })
      if (error) throw error
      setEmail(normalizedEmail)
      setMessage({
        type: 'success',
        text: normalizedEmail !== email
          ? 'Profile saved. Check your new email address for a confirmation link.'
          : 'Profile saved.',
      })
      router.refresh()
    } catch (error) {
      console.error('Could not save profile:', error)
      setMessage({
        type: 'error',
        text: error instanceof Error ? `Unable to save profile: ${error.message}` : 'Unable to save profile. Please try again.',
      })
    } finally {
      setSavingProfile(false)
    }
  }

  async function handleAvatarSelection(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    setMessage(null)

    const extension = AVATAR_TYPES[file.type as keyof typeof AVATAR_TYPES]
    if (!extension) {
      setMessage({ type: 'error', text: 'Choose a JPEG, PNG, or WebP image.' })
      return
    }
    if (file.size > MAX_AVATAR_SIZE) {
      setMessage({ type: 'error', text: 'Image must be 5 MB or smaller.' })
      return
    }
    if (!userId) {
      setMessage({ type: 'error', text: 'Account details are not ready. Reload and try again.' })
      return
    }

    setAvatarBusy(true)
    const objectPath = `${userId}/${crypto.randomUUID()}.${extension}`
    const supabase = createClient()
    try {
      const { error: uploadError } = await supabase.storage
        .from(AVATAR_BUCKET)
        .upload(objectPath, file, {
          contentType: file.type,
          cacheControl: '3600',
          upsert: false,
        })
      if (uploadError) throw uploadError

      const { data: publicUrl } = supabase.storage.from(AVATAR_BUCKET).getPublicUrl(objectPath)
      const { error: profileError } = await supabase.auth.updateUser({
        data: { avatar_url: publicUrl.publicUrl, avatar_path: objectPath },
      })
      if (profileError) {
        const { error: cleanupError } = await supabase.storage.from(AVATAR_BUCKET).remove([objectPath])
        if (cleanupError) console.error('Could not clean up an unlinked avatar upload:', cleanupError)
        throw profileError
      }

      const previousPath = avatarPath
      setAvatarUrl(publicUrl.publicUrl)
      setAvatarPath(objectPath)
      setMessage({ type: 'success', text: 'Profile photo updated.' })
      if (previousPath.startsWith(`${userId}/`)) {
        const { error: cleanupError } = await supabase.storage.from(AVATAR_BUCKET).remove([previousPath])
        if (cleanupError) console.error('Could not remove the previous profile photo:', cleanupError)
      }
      router.refresh()
    } catch (error) {
      console.error('Could not update profile photo:', error)
      setMessage({
        type: 'error',
        text: error instanceof Error ? `Unable to update photo: ${error.message}` : 'Unable to update photo. Please try again.',
      })
    } finally {
      setAvatarBusy(false)
    }
  }

  async function handleAvatarRemove() {
    if (!avatarUrl) return
    setAvatarBusy(true)
    setMessage(null)
    const supabase = createClient()
    try {
      const { error } = await supabase.auth.updateUser({ data: { avatar_url: null, avatar_path: null } })
      if (error) throw error
      setAvatarUrl('')
      setAvatarPath('')
      if (avatarPath.startsWith(`${userId}/`)) {
        const { error: cleanupError } = await supabase.storage.from(AVATAR_BUCKET).remove([avatarPath])
        if (cleanupError) {
          console.error('Could not remove the profile photo from storage:', cleanupError)
          setMessage({ type: 'error', text: 'Default avatar restored, but the old photo could not be deleted.' })
          router.refresh()
          return
        }
      }
      setMessage({ type: 'success', text: 'Default avatar restored.' })
      router.refresh()
    } catch (error) {
      console.error('Could not remove profile photo:', error)
      setMessage({
        type: 'error',
        text: error instanceof Error ? `Unable to remove photo: ${error.message}` : 'Unable to remove photo. Please try again.',
      })
    } finally {
      setAvatarBusy(false)
    }
  }

  async function handlePasswordUpdate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setMessage(null)
    if (newPassword !== confirmPassword) {
      setMessage({ type: 'error', text: 'Passwords do not match.' })
      return
    }
    const errorMessage = passwordError(newPassword)
    if (errorMessage) {
      setMessage({ type: 'error', text: errorMessage })
      return
    }

    setChangingPassword(true)
    try {
      const { error } = await createClient().auth.updateUser({ password: newPassword })
      if (error) throw error
      setMessage({ type: 'success', text: 'Password updated.' })
      setNewPassword('')
      setConfirmPassword('')
    } catch (error) {
      console.error('Could not update password:', error)
      setMessage({
        type: 'error',
        text: error instanceof Error ? `Unable to update password: ${error.message}` : 'Unable to update password. Please try again.',
      })
    } finally {
      setChangingPassword(false)
    }
  }

  async function handleRevokeSessions() {
    if (!window.confirm('Sign out this account on every device? You will need to sign in again here.')) return

    setRevokingSessions(true)
    setMessage(null)
    try {
      const { error } = await createClient().auth.signOut({ scope: 'global' })
      if (error) throw error
      router.replace('/auth/login')
      router.refresh()
    } catch (error) {
      console.error('Could not revoke sessions:', error)
      setMessage({
        type: 'error',
        text: error instanceof Error ? `Unable to revoke sessions: ${error.message}` : 'Unable to revoke sessions. Please try again.',
      })
      setRevokingSessions(false)
    }
  }

  const busy = savingProfile || changingPassword || avatarBusy || revokingSessions

  return (
    <div className="mx-auto max-w-3xl px-5 py-8 md:px-8 md:py-12">
      <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-brass-600">Settings</p>
      <h1 className="mt-2 mb-7 font-display text-4xl font-medium tracking-tight text-ink">Account settings</h1>

      {message && (
        <div
          role={message.type === 'error' ? 'alert' : 'status'}
          className={`mb-6 rounded-lg border p-3 text-sm ${
            message.type === 'success'
              ? 'border-ink-100 bg-ink-50 text-ink-600'
              : 'border-seal/25 bg-seal/5 text-seal'
          }`}
        >
          {message.text}
        </div>
      )}

      <section aria-labelledby="profile-heading" className="mb-6 rounded-2xl border border-ink-100 bg-white p-5 sm:p-7">
        <div className="mb-6">
          <h2 id="profile-heading" className="font-display text-xl font-medium text-ink">Profile</h2>
          <p className="mt-1 text-sm text-ink-400">Manage the details shown on your account.</p>
        </div>

        <div className="mb-6 flex flex-wrap items-center gap-4 border-b border-ink-100 pb-6">
          <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-full bg-paper text-ink-400">
            {avatarUrl ? (
              <Image src={avatarUrl} alt="Profile photo" width={80} height={80} unoptimized className="h-full w-full object-cover" />
            ) : (
              <UserCircle size={54} strokeWidth={1.25} aria-label="Default avatar" />
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <input
              ref={avatarInput}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={(event) => void handleAvatarSelection(event)}
              className="sr-only"
              aria-label="Choose profile photo"
            />
            <button
              type="button"
              onClick={() => avatarInput.current?.click()}
              disabled={!profileReady || busy}
              className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-ink px-3 py-2 text-sm font-medium text-white hover:bg-ink-600 disabled:opacity-50"
            >
              {avatarBusy ? <LoaderCircle size={16} className="animate-spin" /> : <Camera size={16} />}
              {avatarBusy ? 'Updating…' : 'Upload photo'}
            </button>
            {avatarUrl && (
              <button
                type="button"
                onClick={() => void handleAvatarRemove()}
                disabled={busy}
                className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-ink-100 px-3 py-2 text-sm font-medium text-ink hover:bg-paper disabled:opacity-50"
              >
                <Trash2 size={15} /> Remove photo
              </button>
            )}
            <p className="w-full text-xs text-ink-400">
              JPEG, PNG, or WebP; maximum 5 MB. Profile photos are publicly accessible.
            </p>
          </div>
        </div>

        <form onSubmit={handleProfileSave} className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm font-medium text-ink">
            Full name
            <input
              value={fullName}
              onChange={(event) => setFullName(event.target.value)}
              maxLength={100}
              required
              autoComplete="name"
              disabled={!profileReady || busy}
              className="mt-1.5 min-h-11 w-full rounded-lg border border-ink-100 px-3 text-sm font-normal focus:border-brass focus:outline-none focus:ring-2 focus:ring-brass/20 disabled:bg-paper"
            />
          </label>
          <label className="block text-sm font-medium text-ink">
            Username or nickname
            <input
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              maxLength={40}
              autoComplete="nickname"
              disabled={!profileReady || busy}
              placeholder="Choose a name for your account"
              className="mt-1.5 min-h-11 w-full rounded-lg border border-ink-100 px-3 text-sm font-normal focus:border-brass focus:outline-none focus:ring-2 focus:ring-brass/20 disabled:bg-paper"
            />
          </label>
          <label className="block text-sm font-medium text-ink sm:col-span-2">
            Email address
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="email"
              required
              disabled={!profileReady || busy}
              className="mt-1.5 min-h-11 w-full rounded-lg border border-ink-100 px-3 text-sm font-normal focus:border-brass focus:outline-none focus:ring-2 focus:ring-brass/20 disabled:bg-paper"
            />
            <span className="mt-1 block text-xs font-normal text-ink-400">A change takes effect after confirming it from your new email inbox.</span>
          </label>
          <label className="block text-sm font-medium text-ink">
            Phone number
            <input
              type="tel"
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              maxLength={30}
              autoComplete="tel"
              disabled={!profileReady || busy}
              className="mt-1.5 min-h-11 w-full rounded-lg border border-ink-100 px-3 text-sm font-normal focus:border-brass focus:outline-none focus:ring-2 focus:ring-brass/20 disabled:bg-paper"
            />
          </label>
          <label className="block text-sm font-medium text-ink">
            State / FCT
            <input
              value={state}
              onChange={(event) => setState(event.target.value)}
              maxLength={80}
              autoComplete="address-level1"
              disabled={!profileReady || busy}
              className="mt-1.5 min-h-11 w-full rounded-lg border border-ink-100 px-3 text-sm font-normal focus:border-brass focus:outline-none focus:ring-2 focus:ring-brass/20 disabled:bg-paper"
            />
          </label>
          <label className="block text-sm font-medium text-ink">
            City
            <input
              value={city}
              onChange={(event) => setCity(event.target.value)}
              maxLength={100}
              autoComplete="address-level2"
              disabled={!profileReady || busy}
              className="mt-1.5 min-h-11 w-full rounded-lg border border-ink-100 px-3 text-sm font-normal focus:border-brass focus:outline-none focus:ring-2 focus:ring-brass/20 disabled:bg-paper"
            />
          </label>
          <div className="flex items-center justify-end sm:col-span-2">
            <button
              type="submit"
              disabled={!profileReady || busy}
              className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-ink px-4 py-2.5 text-sm font-medium text-white hover:bg-ink-600 disabled:opacity-50"
            >
              {savingProfile ? <LoaderCircle size={16} className="animate-spin" /> : <Save size={15} />}
              {savingProfile ? 'Saving…' : 'Save profile'}
            </button>
          </div>
        </form>
      </section>

      <section aria-labelledby="password-heading" className="mb-6 rounded-2xl border border-ink-100 bg-white p-5 sm:p-7">
        <h2 id="password-heading" className="font-display text-xl font-medium text-ink">Change password</h2>
        <p className="mb-5 mt-1 text-sm text-ink-400">If you signed in with Google, manage your password through Google.</p>
        <form onSubmit={handlePasswordUpdate} className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm font-medium text-ink">
            New password
            <input
              type="password"
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              autoComplete="new-password"
              required
              disabled={busy}
              className="mt-1.5 min-h-11 w-full rounded-lg border border-ink-100 px-3 text-sm font-normal focus:border-brass focus:outline-none focus:ring-2 focus:ring-brass/20"
            />
          </label>
          <label className="block text-sm font-medium text-ink">
            Confirm new password
            <input
              type="password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              autoComplete="new-password"
              required
              disabled={busy}
              className="mt-1.5 min-h-11 w-full rounded-lg border border-ink-100 px-3 text-sm font-normal focus:border-brass focus:outline-none focus:ring-2 focus:ring-brass/20"
            />
          </label>
          <div className="sm:col-span-2">
            <button
              type="submit"
              disabled={busy}
              className="min-h-11 rounded-lg border border-ink-100 px-4 py-2.5 text-sm font-medium text-ink hover:bg-paper disabled:opacity-50"
            >
              {changingPassword ? 'Updating…' : 'Update password'}
            </button>
          </div>
        </form>
      </section>

      <section aria-labelledby="security-heading" className="rounded-2xl border border-seal/20 bg-white p-5 sm:p-7">
        <h2 id="security-heading" className="font-display text-xl font-medium text-ink">Session security</h2>
        <p className="mb-5 mt-1 text-sm leading-6 text-ink-400">
          This device signs out after one hour of inactivity. Sign out all devices if your account may be at risk; existing access tokens remain valid until expiry.
        </p>
        <button
          type="button"
          onClick={() => void handleRevokeSessions()}
          disabled={busy}
          className="min-h-11 rounded-lg border border-seal/30 px-4 py-2.5 text-sm font-medium text-seal hover:bg-seal/5 disabled:opacity-50"
        >
          {revokingSessions ? 'Revoking sessions…' : 'Sign out all devices'}
        </button>
      </section>
    </div>
  )
}
