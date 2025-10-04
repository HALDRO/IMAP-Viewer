import { AlertCircle, Archive, Download, File, FileText, Image } from 'lucide-react'
import type React from 'react'
import { useState } from 'react'

import type { EmailAttachment } from '../shared/types/email'

interface EmailAttachmentsProps {
  attachments: EmailAttachment[]
  accountId: string
  mailboxName: string
  emailUid: number
}

const getFileIcon = (contentType: string): React.ElementType => {
  if (contentType.startsWith('image/')) return Image
  if (contentType.startsWith('text/')) return FileText
  if (contentType.includes('zip') || contentType.includes('rar') || contentType.includes('archive'))
    return Archive
  return File
}

const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${Number.parseFloat((bytes / k ** i).toFixed(2))} ${sizes[i]}`
}

const EmailAttachments: React.FC<EmailAttachmentsProps> = ({
  attachments,
  accountId,
  mailboxName,
  emailUid,
}) => {
  const [downloadingIndex, setDownloadingIndex] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleDownload = async (
    attachmentIndex: number,
    filename: string | undefined
  ): Promise<void> => {
    setDownloadingIndex(attachmentIndex)
    setError(null)

    try {
      const attachmentData = await window.ipcApi.downloadAttachment(
        accountId,
        mailboxName,
        emailUid,
        attachmentIndex
      )

      // Create blob and download
      const blob = new Blob([attachmentData.content], { type: attachmentData.contentType })
      const url = URL.createObjectURL(blob)

      const link = document.createElement('a')
      link.href = url
      link.download = attachmentData.filename || filename || `attachment_${attachmentIndex}`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)

      URL.revokeObjectURL(url)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to download attachment')
    } finally {
      setDownloadingIndex(null)
    }
  }

  if (attachments === null || attachments === undefined || attachments.length === 0) {
    return null
  }

  return (
    <div className="border-t border-gray-600 mt-4 pt-4">
      <div className="flex items-center gap-2 mb-3">
        <Archive className="w-4 h-4 text-blue-400" />
        <span className="text-sm font-medium text-white">Attachments ({attachments.length})</span>
      </div>

      {error !== null && error.length > 0 && (
        <div className="flex items-center gap-2 mb-3 p-2 bg-red-900/20 border border-red-500/30 rounded text-red-400 text-sm">
          <AlertCircle className="w-4 h-4" />
          {error}
        </div>
      )}

      <div className="space-y-2">
        {attachments.map((attachment, index) => {
          const IconComponent = getFileIcon(attachment.contentType)
          const isDownloading = downloadingIndex === index

          return (
            <div
              key={attachment.partID}
              className="flex items-center justify-between p-3 bg-gray-800/50 border border-gray-600/30 rounded-lg hover:bg-gray-700/50 transition-colors"
            >
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <IconComponent className="w-5 h-5 text-blue-400 shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium text-white truncate">
                    {attachment.filename ?? `Attachment ${index + 1}`}
                  </div>
                  <div className="text-xs text-gray-400">
                    {attachment.contentType} • {formatFileSize(attachment.size)}
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  void handleDownload(index, attachment.filename ?? `attachment_${index + 1}`)
                }}
                disabled={isDownloading}
                className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white text-sm rounded transition-colors"
              >
                {isDownloading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Downloading...
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4" />
                    Download
                  </>
                )}
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default EmailAttachments
