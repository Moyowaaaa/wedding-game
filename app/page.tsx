'use client'

import { useState } from 'react'
import {
  PhotoChecklist,
  PHOTO_CHALLENGES,
  countHuntCompletions,
} from '@/components/photo-checklist'
import { PhotoCapture } from '@/components/photo-capture'
import { SubmissionForm } from '@/components/submission-form'
import { Card } from '@/components/ui/card'

type PageStep = 'checklist' | 'capture' | 'form'

export default function Home() {
  const [step, setStep] = useState<PageStep>('checklist')
  const [selectedChallenge, setSelectedChallenge] = useState<number | null>(null)
  const [completedChallenges, setCompletedChallenges] = useState<Set<number>>(
    new Set()
  )
  const [selectedFile, setSelectedFile] = useState<File | null>(null)

  const handleSelectChallenge = (challengeId: number) => {
    setSelectedChallenge(challengeId)
    setStep('capture')
  }

  const handlePhotoSelected = (file: File) => {
    setSelectedFile(file)
    setStep('form')
  }

  const handleSubmissionComplete = (challengeId: number) => {
    setCompletedChallenges(
      new Set(completedChallenges).add(challengeId)
    )
    setStep('checklist')
    setSelectedChallenge(null)
    setSelectedFile(null)
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-background to-secondary/30">
      <div className="container max-w-2xl mx-auto px-4 py-6 sm:py-10">
        {/* Header */}
        <div className="text-center space-y-4 mb-8 sm:mb-12">
          <div className="flex justify-center mb-4">
            <a
              href="/gallery"
              className="inline-block bg-accent text-accent-foreground px-4 py-2 rounded-lg text-sm font-medium hover:opacity-90 transition-opacity"
            >
              View Gallery
            </a>
          </div>
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-serif font-bold text-primary">
            Wedding Photo Game
          </h1>
          <p className="text-base sm:text-lg text-muted-foreground">
            Celebrate with us and create memories!
          </p>
        </div>

        {/* Main Content Card */}
        <Card className="p-6 sm:p-8 bg-card border border-border shadow-lg mb-8">
          {step === 'checklist' && (
            <PhotoChecklist
              selectedChallenge={selectedChallenge}
              completedChallenges={completedChallenges}
              onSelectChallenge={handleSelectChallenge}
            />
          )}

          {step === 'capture' && selectedChallenge && (
            <div className="space-y-6">
              <button
                onClick={() => setStep('checklist')}
                className="text-accent hover:underline text-sm font-medium mb-4"
              >
                ← Back to Checklist
              </button>
              <PhotoCapture onPhotoSelected={handlePhotoSelected} />
            </div>
          )}

          {step === 'form' && selectedChallenge && selectedFile && (
            <SubmissionForm
              challenge={selectedChallenge}
              photoFile={selectedFile}
              onComplete={() => handleSubmissionComplete(selectedChallenge)}
              onBack={() => setStep('capture')}
            />
          )}
        </Card>

        {/* Footer Stats */}
        <div className="text-center text-sm text-muted-foreground">
          <p>
            You&apos;ve completed{' '}
            <span className="font-semibold text-primary">
              {countHuntCompletions(completedChallenges)}
            </span>{' '}
            out of{' '}
            <span className="font-semibold">{PHOTO_CHALLENGES.length}</span>{' '}
            challenges!
          </p>
        </div>
      </div>
    </main>
  )
}
