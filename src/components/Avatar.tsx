import { useEffect, useState } from 'react'
import { tryGetSupabaseClient } from '../lib/supabase'
import { recordTechnicalError } from '../lib/diagnostics'

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
  fallbackUrl?: string
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
  fallbackUrl,
}: AvatarProps) {
  const [signedImage, setSignedImage] = useState<{ bucket: string; path: string; url: string } | null>(null)
  const [failedSrc, setFailedSrc] = useState('')

  useEffect(() => {
    if (!storageBucket || !storagePath) return
    const supabase = tryGetSupabaseClient()
    if (!supabase) return
    let active = true
    supabase.storage.from(storageBucket).createSignedUrl(storagePath, 3600).then(({ data, error }) => {
      if (error) recordTechnicalError('Avatar.createSignedUrl', error)
      if (active) setSignedImage({ bucket: storageBucket, path: storagePath, url: data?.signedUrl ?? '' })
    }).catch((error: unknown) => {
      recordTechnicalError('Avatar.createSignedUrl', error)
    })
    return () => { active = false }
  }, [storageBucket, storagePath])

  const signedUrl = signedImage && signedImage.bucket === storageBucket && signedImage.path === storagePath ? signedImage.url : ''
  const src = uploadedUrl || signedUrl || googleUrl || (avatarKey === 'default-female'
    ? '/Controle-App/avatars/default_avatar_fem.jpg'
    : avatarKey === 'default-male'
      ? '/Controle-App/avatars/default_avatar.jpg'
      : '')

  if (src && src !== failedSrc) {
    return <img className={`avatar-image avatar-${shape}`} style={{ width: size, height: size }} src={src} alt={alt || name || 'Avatar'} onError={() => {
      recordTechnicalError('Avatar.imageLoad', new Error('Não foi possível carregar a imagem.'))
      setFailedSrc(src)
    }} />
  }

  if (companyLogoFallback) {
    return <img className={`avatar-image avatar-${shape}`} style={{ width: size, height: size }} src={fallbackUrl || '/Controle-App/favicon.svg'} alt={alt || 'Logo da empresa'} />
  }

  const initial = (name?.trim().charAt(0) || '?').toUpperCase()
  return <span className={`avatar-image avatar-${shape} avatar-initial`} style={{ width: size, height: size }} aria-label={alt || name || 'Avatar'}>{initial}</span>
}
