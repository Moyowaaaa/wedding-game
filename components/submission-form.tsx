'use client'

import { useState } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { PHOTO_CHALLENGES } from './photo-checklist'
import { Loader2 } from 'lucide-react'

interface SubmissionFormProps {
  challenge: number
  photoFile: File
  onComplete: () => void
  onBack: () => void
}

export function SubmissionForm({
  challenge,
  photoFile,
  onComplete,
  onBack,
}: SubmissionFormProps) {
  const [guestName, setGuestName] = useState('')
  const [caption, setCaption] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const challengeData = PHOTO_CHALLENGES.find((c) => c.id === challenge)

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()

    if (!guestName.trim()) {
      setError('Please enter your name')
      return
    }

    setIsSubmitting(true)
    setError(null)

    try {
      // Upload photo to Cloudinary
      const uploadFormData = new FormData()
      uploadFormData.append('file', photoFile)

      const uploadResponse = await fetch('/api/upload', {
        method: 'POST',
        body: uploadFormData,
      })

      if (!uploadResponse.ok) {
        throw new Error('Failed to upload photo')
      }

      const uploadedData = await uploadResponse.json()
      const imageUrl = uploadedData.secure_url

      // Save submission with image URL
      const submissionResponse = await fetch('/api/submissions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          guestName,
          challenge: challengeData?.title || '',
          caption,
          imageUrl,
        }),
      })

      if (!submissionResponse.ok) {
        throw new Error('Failed to save submission')
      }

      onComplete()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
      setIsSubmitting(false)
    }
  }

  return (
    <div className="space-y-6">
      <button
        onClick={onBack}
        className="text-accent hover:underline text-sm font-medium"
      >
        ← Retake Photo
      </button>

      <div className="space-y-4">
        <div>
          <h3 className="text-lg font-serif font-semibold text-primary mb-2">
            {challengeData?.emoji} {challengeData?.title}
          </h3>
          <p className="text-sm text-muted-foreground">
            Complete your submission by adding your details below.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-2">
            <label htmlFor="name" className="block text-sm font-medium text-foreground">
              Your Name *
            </label>
            <Input
              id="name"
              type="text"
              placeholder="Enter your name"
              value={guestName}
              onChange={(e) => setGuestName(e.target.value)}
              disabled={isSubmitting}
              className="bg-secondary border-border"
              required
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="caption" className="block text-sm font-medium text-foreground">
              Add a Caption (Optional)
            </label>
            <textarea
              id="caption"
              placeholder="Share a moment or memory..."
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              disabled={isSubmitting}
              className="w-full px-3 py-2 rounded-md bg-secondary border border-border text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-accent disabled:opacity-50"
              rows={3}
            />
            <p className="text-xs text-muted-foreground">
              {caption.length}/200 characters
            </p>
          </div>

          {error && (
            <div className="p-3 rounded-md bg-red-50 border border-red-200 text-sm text-red-700">
              {error}
            </div>
          )}

          <div className="flex gap-2 pt-4">
            <Button
              type="button"
              onClick={onBack}
              variant="outline"
              disabled={isSubmitting}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting || !guestName.trim()}
              className="flex-1 bg-accent hover:bg-accent/90 text-accent-foreground"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Uploading...
                </>
              ) : (
                'Submit Photo'
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
