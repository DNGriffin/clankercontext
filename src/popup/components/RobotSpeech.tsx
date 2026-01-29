import React, { useEffect, useState, useCallback } from 'react';
import { SleepingZzz } from './SleepingZzz';
import { TypewriterText } from './TypewriterText';

const AWAKE_PHRASES = [
  'Feed me context!',
  'Yummy context...',
  'More data please!',
  'Hungry for bugs...',
  'Nom nom context',
  'Beep boop!',
  '*whirrs happily*',
  'Processing...',
  '*happy robot noises*',
  'Ready to help!',
  'Watching closely...',
  'Scanning for issues',
  'Send patches!',
  'Clanker clanker clanker!', 
];

interface RobotSpeechProps {
  isSleeping: boolean;
}

export function RobotSpeech({ isSleeping }: RobotSpeechProps): React.ReactElement {
  const [phraseIndex, setPhraseIndex] = useState(() => Math.floor(Math.random() * AWAKE_PHRASES.length));
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [showPhrase, setShowPhrase] = useState(true);

  const getNextPhrase = useCallback(() => {
    setPhraseIndex((prev) => {
      let next = Math.floor(Math.random() * AWAKE_PHRASES.length);
      // Avoid repeating the same phrase
      while (next === prev && AWAKE_PHRASES.length > 1) {
        next = Math.floor(Math.random() * AWAKE_PHRASES.length);
      }
      return next;
    });
  }, []);

  const handlePhraseComplete = useCallback(() => {
    // Wait, then fade out and show next phrase
    const pauseTimer = setTimeout(() => {
      setIsTransitioning(true);
      setShowPhrase(false);

      const transitionTimer = setTimeout(() => {
        getNextPhrase();
        setShowPhrase(true);
        setIsTransitioning(false);
      }, 300);

      return () => clearTimeout(transitionTimer);
    }, 2500);

    return () => clearTimeout(pauseTimer);
  }, [getNextPhrase]);

  // Reset phrase when waking up
  useEffect(() => {
    if (!isSleeping) {
      getNextPhrase();
      setShowPhrase(true);
      setIsTransitioning(false);
    }
  }, [isSleeping, getNextPhrase]);

  return (
    <div className="h-4 flex items-center">
      {isSleeping ? (
        <SleepingZzz />
      ) : (
        <div
          className={`transition-opacity duration-300 ${
            showPhrase && !isTransitioning ? 'opacity-100' : 'opacity-0'
          }`}
        >
          {showPhrase && (
            <TypewriterText
              key={phraseIndex}
              text={AWAKE_PHRASES[phraseIndex]}
              speed={40}
              onComplete={handlePhraseComplete}
            />
          )}
        </div>
      )}
    </div>
  );
}
