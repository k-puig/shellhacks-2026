import {
  ExpoSpeechRecognitionModule,
  useSpeechRecognitionEvent,
} from 'expo-speech-recognition';
import * as Device from 'expo-device';
import { useEffect, useRef, useState } from 'react';

export type VoiceStatus = 'starting' | 'listening' | 'awake' | 'denied' | 'error';

// Speech recognizers mishear "dodo" a lot, so accept the common variants.
const WAKE = /\b(?:hey|hi|ok|okay|a)[\s,]+(?:dodo|do do|doto|dodos|dough dough|toto|dudu)\b/g;

// How long to wait after the last word before treating the command as finished.
const COMMAND_SILENCE_MS = 1300;
// How long to wait for a command after a bare "Hey DODO".
const WAKE_TIMEOUT_MS = 5000;
// Give up after this many back-to-back failures (e.g. no usable mic).
const MAX_FAILURES = 5;
// Restart idle sessions this often so the transcript never grows unbounded
// (and we stay under iOS's ~1 minute limit for server-based recognition).
const SESSION_REFRESH_MS = 45_000;

type Options = {
  onWake: () => void;
  onCommand: (command: string) => void;
  onCancel: () => void;
};

// Always-on listener: keeps continuous recognition running, watches the
// transcript for "Hey DODO", then hands whatever follows it to onCommand.
export function useWakeWord({ onWake, onCommand, onCancel }: Options) {
  const [status, setStatus] = useState<VoiceStatus>('starting');
  const [heard, setHeard] = useState('');
  // Last error from the recognizer, shown in the UI so failures are debuggable.
  const [errorDetail, setErrorDetail] = useState('');

  const handlers = useRef({ onWake, onCommand, onCancel });
  useEffect(() => {
    handlers.current = { onWake, onCommand, onCancel };
  });

  const awake = useRef(false);
  const enabled = useRef(true);
  // Ignore late results from a session we already acted on.
  const draining = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const failures = useRef(0);
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // On-device recognition: no network and no server time limit. The simulator
  // has no on-device model, and some phones haven't downloaded it, so this
  // flips to server recognition if the local recognizer fails to start.
  const onDevice = useRef(
    Device.isDevice && ExpoSpeechRecognitionModule.supportsOnDeviceRecognition(),
  );

  const start = () => {
    if (!enabled.current) return;
    ExpoSpeechRecognitionModule.start({
      lang: 'en-US',
      interimResults: true,
      continuous: true,
      // Several guesses per phrase: "hey dodo" is often only the 2nd or 3rd.
      maxAlternatives: 3,
      requiresOnDeviceRecognition: onDevice.current,
      contextualStrings: ['Hey DODO', 'DODO'],
      androidIntentOptions: {
        // Don't end the session after a short silence while we wait for the wake word.
        EXTRA_SPEECH_INPUT_COMPLETE_SILENCE_LENGTH_MILLIS: 10_000,
        EXTRA_SPEECH_INPUT_POSSIBLY_COMPLETE_SILENCE_LENGTH_MILLIS: 10_000,
      },
      iosCategory: {
        category: 'playAndRecord',
        categoryOptions: ['defaultToSpeaker', 'allowBluetooth', 'mixWithOthers'],
        mode: 'default',
      },
      // Echo cancellation so the narrator's voice doesn't get transcribed.
      // The simulator has no voice-processing audio unit, so skip it there.
      iosVoiceProcessingEnabled: Device.isDevice,
    });
  };

  // Ends the current recognition session; the "end" handler restarts it with a
  // fresh transcript.
  const reset = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    awake.current = false;
    draining.current = true;
    ExpoSpeechRecognitionModule.abort();
  };

  const finish = (command: string) => {
    reset();
    setStatus('listening');
    if (command) handlers.current.onCommand(command);
    else handlers.current.onCancel();
  };

  useSpeechRecognitionEvent('start', () => {
    draining.current = false;
    if (!awake.current) setStatus('listening');
    if (refreshTimer.current) clearTimeout(refreshTimer.current);
    refreshTimer.current = setTimeout(() => {
      // Never cut someone off mid-command.
      if (!awake.current) reset();
    }, SESSION_REFRESH_MS);
  });

  useSpeechRecognitionEvent('end', () => {
    // Restart right away normally; back off while it keeps failing.
    if (enabled.current) setTimeout(start, 250 * 2 ** failures.current);
  });

  useSpeechRecognitionEvent('error', (event) => {
    if (event.error !== 'aborted') console.log('[dodo] speech error', event.error, event.message);
    if (event.error === 'not-allowed') {
      enabled.current = false;
      setStatus('denied');
    } else if (onDevice.current && /initialize recognizer/i.test(event.message)) {
      // Local model unavailable (kLSRErrorDomain 300): retry via Apple's servers.
      onDevice.current = false;
    } else if (event.error !== 'aborted' && event.error !== 'no-speech') {
      failures.current++;
      setErrorDetail(`${event.error}: ${event.message}`);
      if (failures.current >= MAX_FAILURES) {
        enabled.current = false;
        setStatus('error');
        console.log('[dodo] voice disabled after repeated errors:', event.error, event.message);
      }
    }
    // Anything else: the "end" event follows and restarts us.
  });

  useSpeechRecognitionEvent('result', (event) => {
    if (draining.current) return;
    failures.current = 0;

    // Use the first alternative that contains the wake word.
    let transcript = '';
    let last: RegExpExecArray | undefined;
    for (const alt of event.results) {
      const text = alt.transcript.toLowerCase();
      const found = [...text.matchAll(WAKE)].pop();
      if (found) {
        transcript = text;
        last = found;
        break;
      }
    }
    if (!last) return;

    if (!awake.current) {
      awake.current = true;
      setStatus('awake');
      handlers.current.onWake();
    }

    const command = transcript.slice(last.index + last[0].length).replace(/^[\s,.]+/, '').trim();
    setHeard(command);

    if (timer.current) clearTimeout(timer.current);
    if (event.isFinal && command) {
      finish(command);
    } else {
      timer.current = setTimeout(
        () => finish(command),
        command ? COMMAND_SILENCE_MS : WAKE_TIMEOUT_MS,
      );
    }
  });

  useEffect(() => {
    enabled.current = true;
    ExpoSpeechRecognitionModule.requestPermissionsAsync().then(({ granted }) => {
      if (granted) start();
      else setStatus('denied');
    });
    return () => {
      enabled.current = false;
      if (timer.current) clearTimeout(timer.current);
      if (refreshTimer.current) clearTimeout(refreshTimer.current);
      ExpoSpeechRecognitionModule.abort();
    };
  }, []);

  // Turn listening back on after it gave up.
  const retry = () => {
    failures.current = 0;
    enabled.current = true;
    setErrorDetail('');
    setStatus('starting');
    start();
  };

  return { status, heard, errorDetail, retry };
}
