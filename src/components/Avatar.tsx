import { useEffect, useState } from 'react'
import { tryGetSupabaseClient } from '../lib/supabase'

type AvatarProps = {
  name?: string | null
  uploadedUrl?: string | null
  googleUrl?: string | null
  avatarKey?: string | null
  storageBucket?: 'profile-photos' | 'company-photos'
  storagePath?: string | null
  shape?: 'round' | 'square'
  size?: number
  alt?: string
  companyLogoFallback?: boolean
}

export function Avatar({
  name,
  uploadedUrl,
  googleUrl,
  avatarKey,
  storageBucket,
  storagePath,
  shape = 'round',
  size = 44,
  alt,
  companyLogoFallback = false,
}: AvatarProps) {
  const [signedUrl, setSignedUrl] = useState('')

  useEffect(() => {
    if (!storageBucket || !storagePath) {
      queueMicrotask(() => setSignedUrl(''))
      return
    }
    const supabase = tryGetSupabaseClient()
    if (!supabase) return
    let active = true
    supabase.storage.from(storageBucket).createSignedUrl(storagePath, 3600).then(({ data }) => {
      if (active) setSignedUrl(data?.signedUrl ?? '')
    })
    return () => { active = false }
  }, [storageBucket, storagePath])

  const src = uploadedUrl || signedUrl || googleUrl || (avatarKey === 'default-female'
    ? '/Controle-App/avatars/default_avatar_fem.jpg'
    : avatarKey === 'default-male'
      ? '/Controle-App/avatars/default_avatar.jpg'
      : '')

  if (src) {
    return <img className={`avatar-image avatar-${shape}`} style={{ width: size, height: size }} src={src} alt={alt || name || 'Avatar'} />
  }

  if (companyLogoFallback) {
    return <img className={`avatar-image avatar-${shape}`} style={{ width: size, height: size }} src="/Controle-App/favicon.svg" alt={alt || 'Logo da empresa'} />
  }

  const initial = (name?.trim().charAt(0) || '?').toUpperCase()
  return <span className={`avatar-image avatar-${shape} avatar-initial`} style={{ width: size, height: size }} aria-label={alt || name || 'Avatar'}>{initial}</span>
}
