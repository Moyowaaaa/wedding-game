'use client'

import { useState } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Check } from 'lucide-react'

export const PHOTO_CHALLENGES = [
  { id: 1, title: 'The Bride & Groom', emoji: '👰🤵' },
  { id: 2, title: 'Close-up of the Ring(s)', emoji: '💍' },
  { id: 3, title: 'The Wedding Cake', emoji: '🎂' },
  { id: 4, title: 'Champagne Toast Moment', emoji: '🍾' },
  { id: 5, title: 'The Bouquet', emoji: '💐' },
  { id: 6, title: 'Your Table\'s Group Photo', emoji: '👨‍👩‍👧‍👦' },
  { id: 7, title: 'Someone Dancing', emoji: '💃' },
  { id: 8, title: 'The DJ/Band/Music Setup', emoji: '🎵' },
  { id: 9, title: 'A Funny/Silly Moment', emoji: '😆' },
  { id: 10, title: 'Guest Wearing Fabulous Fashion', emoji: '👗' },
  { id: 11, title: 'Wedding Decorations/Flowers', emoji: '🌹' },
  { id: 12, title: 'Venue or Venue Sign', emoji: '📍' },
  { id: 13, title: 'Your Favorite Food', emoji: '🍽️' },
  { id: 14, title: 'A Couple\'s Moment', emoji: '💕' },
  { id: 15, title: 'Everyone Celebrating Together', emoji: '🎉' },
]

interface PhotoChecklistProps {
  selectedChallenge: number | null
  completedChallenges: Set<number>
  onSelectChallenge: (challengeId: number) => void
}

export function PhotoChecklist({
  selectedChallenge,
  completedChallenges,
  onSelectChallenge,
}: PhotoChecklistProps) {
  return (
    <div className="w-full space-y-4">
      <div className="space-y-2">
        <h2 className="text-2xl font-serif font-semibold text-primary">
          Photo Scavenger Hunt
        </h2>
        <p className="text-sm text-muted-foreground">
          Select a challenge and capture the moment!
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {PHOTO_CHALLENGES.map((challenge) => {
          const isCompleted = completedChallenges.has(challenge.id)
          const isSelected = selectedChallenge === challenge.id

          return (
            <button
              key={challenge.id}
              onClick={() => onSelectChallenge(challenge.id)}
              className={`relative p-4 rounded-lg border-2 transition-all text-left ${
                isSelected
                  ? 'border-accent bg-accent/5'
                  : isCompleted
                  ? 'border-primary/30 bg-primary/5 opacity-60'
                  : 'border-border hover:border-accent/50 bg-card'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1">
                  <div className="text-2xl mb-2">{challenge.emoji}</div>
                  <p className="text-sm font-medium leading-snug">
                    {challenge.title}
                  </p>
                </div>
                {isCompleted && (
                  <div className="flex-shrink-0 mt-1">
                    <Check className="w-5 h-5 text-primary" />
                  </div>
                )}
              </div>
            </button>
          )
        })}
      </div>

      <div className="pt-2 text-center text-xs text-muted-foreground">
        Completed: {completedChallenges.size} of {PHOTO_CHALLENGES.length}
      </div>
    </div>
  )
}
