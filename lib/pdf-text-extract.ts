// lib/pdf-text-extract.ts
import * as pdfjsLib from 'pdfjs-dist'

pdfjsLib.GlobalWorkerOptions.workerSrc =
  `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`

export class PdfPasswordRequiredError extends Error {}

export async function extractPdfText(file: File, password?: string): Promise<string> {
  const arrayBuffer = await file.arrayBuffer()

  let pdf
  try {
    pdf = await pdfjsLib.getDocument({ data: arrayBuffer, password }).promise
  } catch (err: any) {
    if (err?.name === 'PasswordException') {
      throw new PdfPasswordRequiredError('Este PDF está protegido por senha.')
    }
    throw err
  }

  let fullText = ''

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum)
    const content = await page.getTextContent()

    let lastY: number | null = null
    let lineBuffer: string[] = []
    const lines: string[] = []

    for (const item of content.items as any[]) {
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
}