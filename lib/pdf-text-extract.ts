// lib/pdf-text-extract.ts
import * as pdfjsLib from 'pdfjs-dist'

pdfjsLib.GlobalWorkerOptions.workerSrc =
  `/pdf.worker.min.mjs?v=${pdfjsLib.version}`

export class PdfPasswordRequiredError extends Error {}

async function openPdf(file: File, password?: string) {
  const arrayBuffer = await file.arrayBuffer()
  const task = pdfjsLib.getDocument({ data: arrayBuffer, password })
  try {
    return await task.promise
  } catch (err: unknown) {
    await task.destroy?.()
    if (typeof err === 'object' && err !== null && 'name' in err && err.name === 'PasswordException') {
      throw new PdfPasswordRequiredError(password ? 'Senha incorreta. Confira e tente novamente.' : 'Este PDF está protegido por senha.')
    }
    throw err
  }
}

export async function extractPdfText(file: File, password?: string): Promise<string> {
  const pdf = await openPdf(file, password)
  try {

  let fullText = ''

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum)
    const content = await page.getTextContent()

    let lastY: number | null = null
    let lineBuffer: string[] = []
    const lines: string[] = []

    for (const item of content.items) {
      if (!('str' in item)) continue
      const y = item.transform[5]
      if (lastY !== null && Math.abs(y - lastY) > 2) {
        lines.push(lineBuffer.join(' '))
        lineBuffer = []
      }
      lineBuffer.push(item.str)
      lastY = y
    }
    if (lineBuffer.length > 0) lines.push(lineBuffer.join(' '))

    fullText += lines.join('\n') + '\n'
  }

  return fullText
  } finally { await pdf.loadingTask?.destroy() }
}

// Open locally first, before any upload. Passwords never leave this browser.
// PDF.js decrypts for viewing; rebuild encrypted documents from rendered pages
// because its getData()/saveDocument() preserve the original encryption.
export async function preparePdfForAI(file: File, password?: string): Promise<File> {
  const pdf = await openPdf(file, password)
  try {
    if (pdf.numPages > 20) throw new Error('A leitura por IA aceita até 20 páginas. Divida a fatura em arquivos menores.')
    const metadata = await pdf.getMetadata()
    const info = metadata.info as { EncryptFilterName?: string | null }
    if (!info.EncryptFilterName && !password) return file
    const { jsPDF } = await import('jspdf')
    let output: InstanceType<typeof jsPDF> | undefined
    for (let number = 1; number <= pdf.numPages; number++) {
      const page = await pdf.getPage(number)
      const original = page.getViewport({ scale: 1 })
      const viewport = page.getViewport({ scale: Math.min(2, 1600 / Math.max(original.width, original.height)) })
      const canvas = document.createElement('canvas')
      try {
        canvas.width = Math.ceil(viewport.width)
        canvas.height = Math.ceil(viewport.height)
        const context = canvas.getContext('2d')
        if (!context) throw new Error('Seu navegador não conseguiu preparar o PDF. Tente outro navegador.')
        await page.render({ canvas, canvasContext: context, viewport, background: '#ffffff' }).promise
        const orientation = original.width > original.height ? 'landscape' : 'portrait'
        if (!output) output = new jsPDF({ unit: 'pt', format: [original.width, original.height], orientation, compress: true })
        else output.addPage([original.width, original.height], orientation)
        output.addImage(canvas.toDataURL('image/jpeg', 0.85), 'JPEG', 0, 0, original.width, original.height)
      } finally {
        canvas.width = canvas.height = 0
        page.cleanup()
      }
    }
    if (!output) throw new Error('Este PDF não contém páginas.')
    const prepared = new File([output.output('arraybuffer')], 'fatura.pdf', { type: 'application/pdf' })
    if (prepared.size > 3 * 1024 * 1024) throw new Error('O PDF preparado ultrapassou 3 MB. Divida a fatura em arquivos menores.')
    return prepared
  } finally { await pdf.loadingTask?.destroy() }
}
