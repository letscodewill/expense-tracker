const MAX_PHOTO_BYTES = 20 * 1024 * 1024
const MAX_UPLOAD_BYTES = 3 * 1024 * 1024

// Camera photographs are normalized locally; only the prepared JPEG is sent.
export async function prepareReceiptPhoto(file: File): Promise<File> {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type))
    throw new Error('Formato da foto não suportado. Use JPG, PNG ou WebP.')
  if (!file.size || file.size > MAX_PHOTO_BYTES)
    throw new Error('A foto deve ter no máximo 20 MB antes da preparação.')
  const url = URL.createObjectURL(file)
  try {
    const image = new Image()
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve()
      image.onerror = () => reject(new Error('Não foi possível abrir a foto. Tire outra foto ou escolha uma imagem da galeria.'))
      image.src = url
    })
    const width = image.naturalWidth, height = image.naturalHeight
    if (!width || !height || width * height > 50000000)
      throw new Error('A resolução da foto é muito grande. Use uma resolução menor na câmera.')
    const scale = Math.min(1, 2400 / Math.max(width, height))
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(width * scale))
    canvas.height = Math.max(1, Math.round(height * scale))
    const context = canvas.getContext('2d')
    if (!context) throw new Error('Não foi possível preparar a foto neste navegador. Escolha uma imagem da galeria.')
    context.fillStyle = '#fff'
    context.fillRect(0, 0, canvas.width, canvas.height)
    context.drawImage(image, 0, 0, canvas.width, canvas.height)
    for (const quality of [0.9, 0.75, 0.6]) {
      const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/jpeg', quality))
      if (blob && blob.size > 0 && blob.size <= MAX_UPLOAD_BYTES && blob.type === 'image/jpeg')
        return new File([blob], 'comprovante.jpg', { type: 'image/jpeg' })
    }
    throw new Error('A foto preparada excede 3 MB. Aproxime o comprovante ou reduza a resolução.')
  } finally {
    URL.revokeObjectURL(url)
  }
}
