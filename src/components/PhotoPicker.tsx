import { useCallback, useState, type ChangeEvent } from 'react'
import Cropper, { type Area } from 'react-easy-crop'

type PhotoPickerProps = {
  shape: 'round' | 'square'
  label?: string
  onConfirm: (file: Blob, previewUrl: string) => void
}

function createImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = reject
    image.src = url
  })
}

async function cropImage(imageUrl: string, crop: Area): Promise<Blob> {
  const image = await createImage(imageUrl)
  const canvas = document.createElement('canvas')
  canvas.width = 512
  canvas.height = 512
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Não foi possível preparar o recorte da imagem.')

  context.drawImage(
    image,
    crop.x,
    crop.y,
    crop.width,
    crop.height,
    0,
    0,
    512,
    512,
  )

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob)
          return
        }
        canvas.toBlob(
          (jpegBlob) => jpegBlob
            ? resolve(jpegBlob)
            : reject(new Error('Não foi possível exportar a imagem.')),
          'image/jpeg',
          0.85,
        )
      },
      'image/webp',
      0.85,
    )
  })
}

export function PhotoPicker({ shape, label = 'Trocar foto', onConfirm }: PhotoPickerProps) {
  const [open, setOpen] = useState(false)
  const [imageUrl, setImageUrl] = useState('')
  const [crop, setCrop] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [croppedArea, setCroppedArea] = useState<Area | null>(null)
  const [error, setError] = useState('')

  const selectFile = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    setError('')
    if (!file) return
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setError('Selecione uma imagem JPEG, PNG ou WebP.')
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      setError('A imagem deve ter no máximo 5 MB.')
      return
    }
    setImageUrl(URL.createObjectURL(file))
  }

  const onCropComplete = useCallback((_area: Area, pixels: Area) => {
    setCroppedArea(pixels)
  }, [])

  const cancel = () => {
    if (imageUrl) URL.revokeObjectURL(imageUrl)
    setImageUrl('')
    setOpen(false)
    setError('')
  }

  const confirm = async () => {
    if (!imageUrl || !croppedArea) return
    try {
      const blob = await cropImage(imageUrl, croppedArea)
      const previewUrl = URL.createObjectURL(blob)
      onConfirm(blob, previewUrl)
      cancel()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Não foi possível recortar a imagem.')
    }
  }

  return (
    <div className="photo-picker">
      <button className="secondary-button" type="button" onClick={() => setOpen(true)}>{label}</button>
      {open && (
        <div className="photo-picker-modal" role="dialog" aria-modal="true" aria-label={label}>
          <div className="photo-picker-panel">
            <h2>Enquadrar foto</h2>
            <input type="file" accept="image/jpeg,image/png,image/webp" onChange={selectFile} />
            {error && <p className="form-error" role="alert">{error}</p>}
            {imageUrl && (
              <>
                <div className={`crop-area crop-${shape}`}>
                  <Cropper
                    image={imageUrl}
                    crop={crop}
                    zoom={zoom}
                    aspect={1}
                    cropShape={shape === 'round' ? 'round' : 'rect'}
                    showGrid
                    onCropChange={setCrop}
                    onZoomChange={setZoom}
                    onCropComplete={onCropComplete}
                  />
                </div>
                <label>Zoom
                  <input type="range" min={1} max={3} step={0.05} value={zoom} onChange={(event) => setZoom(Number(event.target.value))} />
                </label>
              </>
            )}
            <div className="photo-picker-actions">
              <button className="secondary-button" type="button" onClick={cancel}>Cancelar</button>
              <button className="primary-button" type="button" onClick={confirm} disabled={!croppedArea}>Confirmar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
