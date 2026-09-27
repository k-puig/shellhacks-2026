import {
  ExpoSpeechRecognitionModule,
  useSpeechRecognitionEvent,
} from 'expo-speech-recognition';
import * as Device from 'expo-device';
import { useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';

import { isInstantCommand, parseCommand } from './parseCommand';
import { readResult } from './wakeCommand';

// TEMPORARY: timeline of mic events and wake-word decisions, for debugging.
const t0 = Date.now();
const vlog = (...args: unknown[]) =>
  console.log(`[dodo-voice] ${((Date.now() - t0) / 1000).toFixed(2)}s`, ...args);

// idle: not listening for "Hey Nova" (turned off in Settings); the mic button still works.
export type VoiceStatus = 'starting' | 'listening' | 'awake' | 'idle' | 'denied' | 'error';


// How long to wait after the last word before treating the command as finished.
const COMMAND_SILENCE_MS = 1300;
// How long to wait for a command after a bare "Hey Nova".
const WAKE_TIMEOUT_MS = 5000;
// Give up after this many back-to-back failures (e.g. no usable mic).
const MAX_FAILURES = 5;
// Restart idle sessions this often so the transcript never grows unbounded
// (and we stay under iOS's ~1 minute limit for server-based recognition).
// Each restart is ~1 s of deafness, so on-device, which has no limit, waits longer.
const SESSION_REFRESH_MS = 45_000;
const ON_DEVICE_REFRESH_MS = 5 * 60_000;
// In the background, keep listening this long after narration pauses, so
// "Hey Nova, pause" … "Hey Nova, play" works with the screen locked.
const BACKGROUND_GRACE_MS = 2 * 60_000;

type Options = {
  onWake: () => void;
  onCommand: (command: string) => void;
  onCancel: () => void;
  // Speech to drop, e.g. the narrator's voice picked up by the mic.
  ignore?: (text: string) => boolean;
  // Keep listening for "Hey Nova" (default). When false, only the mic button listens.
  alwaysListen?: boolean;
  // Keep listening with the app in the background (screen locked, another app
  // open). The reader sets this while the book is being narrated.
  keepInBackground?: boolean;
};

// Always-on listener: keeps continuous recognition running, watches the
// transcript for "Hey Nova", then hands whatever follows it to onCommand.
export function useWakeWord({
  onWake,
  onCommand,
  onCancel,
  ignore,
  alwaysListen = true,
  keepInBackground = false,
}: Options) {
  const [status, setStatus] = useState<VoiceStatus>('starting');
  const [heard, setHeard] = useState('');
  // Same as `heard`, readable from callbacks (the mic button ends the turn with it).
  const heardRef = useRef('');
  const hear = (text: string) => {
    heardRef.current = text;
    setHeard(text);
  };
  // Last error from the recognizer, shown in the UI so failures are debuggable.
  const [errorDetail, setErrorDetail] = useState('');

  const handlers = useRef({ onWake, onCommand, onCancel, ignore });
  const alwaysListenRef = useRef(alwaysListen);
  const keepInBackgroundRef = useRef(keepInBackground);
  // Whether a recognition session is running right now.
  const running = useRef(false);
  useEffect(() => {
    handlers.current = { onWake, onCommand, onCancel, ignore };
  });

  const awake = useRef(false);
  const enabled = useRef(true);
  // Ignore late results from a session we already acted on.
  const draining = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const failures = useRef(0);
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // The current session's transcript so far, and what it was when the mic
  // button was tapped, so only words said after the tap count as the command.
  const lastTranscript = useRef('');
  const tapSince = useRef('');
  // The native module can emit several "end" events for one session, and each
  // native start() rebuilds the audio engine and re-activates the session,
  // which cuts out the narrator. So only ever keep one restart pending.
  const restartTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // In the background (screen locked, app switched) we keep listening only while
  // the book is being narrated, and for BACKGROUND_GRACE_MS after it pauses so
  // "Hey Nova, play" still works; otherwise we stop and start fresh when the app
  // is active again. iOS allows this because the "audio" background mode is on
  // and the mic's audio session is already running when the app leaves.
  const foreground = useRef(AppState.currentState === 'active');
  const inBackgroundAllowed = useRef(false);
  const graceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const canListen = () => foreground.current || inBackgroundAllowed.current;
  // On-device recognition: no network and no server time limit. The simulator
  // has no on-device model, and some phones haven't downloaded it, so this
  // flips to server recognition if the local recognizer fails to start.
  const onDevice = useRef(
    Device.isDevice && ExpoSpeechRecognitionModule.supportsOnDeviceRecognition(),
  );

  const start = () => {
    vlog('start()', { enabled: enabled.current, foreground: foreground.current, background: inBackgroundAllowed.current });
    if (!enabled.current || !canListen()) return;
    ExpoSpeechRecognitionModule.start({
      lang: 'en-US',
      interimResults: true,
      continuous: true,
      // Several guesses per phrase: in a noisy room "hey nova" is often not the 1st.
      maxAlternatives: 5,
      requiresOnDeviceRecognition: onDevice.current,
      contextualStrings: ['Hey Nova', 'Nova'],
      androidIntentOptions: {
        // Don't end the session after a short silence while we wait for the wake word.
        EXTRA_SPEECH_INPUT_COMPLETE_SILENCE_LENGTH_MILLIS: 10_000,
        EXTRA_SPEECH_INPUT_POSSIBLY_COMPLETE_SILENCE_LENGTH_MILLIS: 10_000,
      },
      iosCategory: {
        category: 'playAndRecord',
        // A2DP, not hands-free Bluetooth: hands-free (allowBluetooth) forces
        // AirPods into call mode, which garbles the narrator. With A2DP the book
        // plays in full quality and the iPhone's own mic listens.
        categoryOptions: ['defaultToSpeaker', 'allowBluetoothA2DP', 'mixWithOthers'],
        mode: 'default',
      },
      // Keep voice processing (echo cancellation) OFF: on iOS it switches the
      // audio session into "voiceChat" (phone-call) mode, which routes the
      // narrator to the earpiece and ducks its volume, flipping back and forth
      // on every recognition restart. Without it the mic may pick up the
      // narration, which is harmless: the book never says "Hey Nova".
      iosVoiceProcessingEnabled: false,
    });
  };

  // Ends the current recognition session; the "end" handler restarts it with a
  // fresh transcript.
  const scheduleStart = (delayMs: number) => {
    if (restartTimer.current) clearTimeout(restartTimer.current);
    restartTimer.current = setTimeout(() => {
      restartTimer.current = null;
      start();
    }, delayMs);
  };

  const reset = () => {
    vlog('reset() -> abort');
    tapSince.current = '';
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    awake.current = false;
    draining.current = true;
    ExpoSpeechRecognitionModule.abort();
  };

  const finish = (command: string) => {
    vlog('finish', JSON.stringify(command));
    reset();
    setStatus(alwaysListenRef.current ? 'listening' : 'idle');
    if (command) handlers.current.onCommand(command);
    else handlers.current.onCancel();
  };

  useSpeechRecognitionEvent('start', () => {
    running.current = true;
    vlog('event start', { awake: awake.current, draining: draining.current });
    draining.current = false;
    lastTranscript.current = '';
    if (!awake.current) setStatus('listening');
    if (refreshTimer.current) clearTimeout(refreshTimer.current);
    refreshTimer.current = setTimeout(
      () => {
        // Never cut someone off mid-command.
        if (!awake.current) reset();
      },
      onDevice.current ? ON_DEVICE_REFRESH_MS : SESSION_REFRESH_MS,
    );
  });

  useSpeechRecognitionEvent('end', () => {
    vlog('event end', { enabled: enabled.current, foreground: foreground.current, failures: failures.current });
    // Restart right away normally, so "Hey Nova" is heard again quickly; back
    // off while it keeps failing.
    running.current = false;
    const delay = failures.current ? 250 * 2 ** failures.current : 100;
    // With "Hey Nova" off, only keep going while a tapped command is pending.
    const keepListening = alwaysListenRef.current || awake.current;
    if (enabled.current && canListen() && keepListening) scheduleStart(delay);
  });

  useSpeechRecognitionEvent('error', (event) => {
    vlog('event error', event.error, event.message);
    if (event.error !== 'aborted') console.log('[dodo] speech error', event.error, event.message);
    // Errors from the OS cutting the mic (screen lock, call, Siri) aren't real
    // failures; the foreground handler restarts listening.
    if (!canListen() || event.error === 'interrupted') return;
    // iOS won't start a new recording from the background, only keep one that
    // was running. Stop trying quietly; returning to the app starts it again.
    if (!foreground.current && event.error === 'audio-capture') {
      vlog('background restart refused by iOS');
      inBackgroundAllowed.current = false;
      return;
    }
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
    vlog('event result', { final: event.isFinal, draining: draining.current, awake: awake.current }, JSON.stringify(event.results.map((r) => r.transcript)));
    if (draining.current) return;
    // "Hey Nova" is off: only a mic-button command is listened to.
    if (!alwaysListenRef.current && !awake.current) return;
    failures.current = 0;

    const transcripts = event.results.map((r) => r.transcript);
    const read = readResult(transcripts, awake.current, tapSince.current);
    lastTranscript.current = transcripts[0] ?? '';
    if (!read) return;
    vlog('read', JSON.stringify(read));

    // The narrator keeps playing (quieter) while we listen, so drop its words.
    let command = read.command;
    if (command && handlers.current.ignore?.(command)) {
      vlog('ignored narrator echo', JSON.stringify(command));
      if (!read.woke) return;
      command = '';
    }

    if (!awake.current) {
      awake.current = true;
      setStatus('awake');
      handlers.current.onWake();
    }

    hear(command);

    if (timer.current) clearTimeout(timer.current);
    // Short commands like "pause" run as soon as they're heard.
    if (command && (event.isFinal || isInstantCommand(parseCommand(command)))) {
      finish(command);
    } else {
      timer.current = setTimeout(
        () => finish(command),
        command ? COMMAND_SILENCE_MS : WAKE_TIMEOUT_MS,
      );
    }
  });

  // Fresh start: clear any failure state, re-check permission (the user may
  // have just enabled it in Settings), then begin listening.
  const begin = () => {
    if (timer.current) clearTimeout(timer.current);
    awake.current = false;
    failures.current = 0;
    enabled.current = true;
    ExpoSpeechRecognitionModule.requestPermissionsAsync().then(({ granted }) => {
      if (!granted) {
        enabled.current = false;
        setStatus('denied');
        return;
      }
      if (!alwaysListenRef.current) {
        setStatus('idle');
        return;
      }
      // Abort any half-dead session first; its "end" restarts us, and start()
      // below covers the case where nothing was running.
      ExpoSpeechRecognitionModule.abort();
      scheduleStart(300);
    });
  };

  const startFresh = () => {
    setErrorDetail('');
    setStatus('starting');
    begin();
  };

  const stopForBackground = () => {
    if (timer.current) clearTimeout(timer.current);
    if (refreshTimer.current) clearTimeout(refreshTimer.current);
    if (restartTimer.current) clearTimeout(restartTimer.current);
    // Drop a half-spoken command rather than acting on it later.
    if (awake.current) handlers.current.onCancel();
    awake.current = false;
    draining.current = true;
    ExpoSpeechRecognitionModule.abort();
  };

  useEffect(() => {
    // State already starts at 'starting' on mount, so only kick off listening.
    begin();
    // Locking the phone goes active → inactive → background. "inactive" alone
    // (Control Center, a notification, the lock animation) isn't leaving the
    // app, so only "background" and "active" change anything.
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        if (foreground.current) return;
        foreground.current = true;
        if (graceTimer.current) clearTimeout(graceTimer.current);
        // Keep a session that survived the background; otherwise start again.
        if (!inBackgroundAllowed.current || !running.current) startFresh();
        inBackgroundAllowed.current = false;
      } else if (state === 'background' && foreground.current) {
        foreground.current = false;
        inBackgroundAllowed.current = keepInBackgroundRef.current;
        vlog('background', { keepListening: inBackgroundAllowed.current });
        if (!inBackgroundAllowed.current) stopForBackground();
      }
    });
    return () => {
      sub.remove();
      enabled.current = false;
      if (timer.current) clearTimeout(timer.current);
      if (refreshTimer.current) clearTimeout(refreshTimer.current);
      if (restartTimer.current) clearTimeout(restartTimer.current);
      if (graceTimer.current) clearTimeout(graceTimer.current);
      ExpoSpeechRecognitionModule.abort();
    };
    // Mount-only: begin/startFresh/stopForBackground only touch refs and setters.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // "Hey Nova" switched on or off in Settings while the reader is open.
  const firstRun = useRef(true);
  useEffect(() => {
    alwaysListenRef.current = alwaysListen;
    if (firstRun.current) {
      firstRun.current = false;
      return;
    }
    // Next tick, so the switch isn't handled in the middle of this render's effects.
    const t = setTimeout(() => {
      if (alwaysListen) startFresh();
      else if (!awake.current) {
        // Cancel any restart already queued, or the mic comes back on.
        if (restartTimer.current) clearTimeout(restartTimer.current);
        if (refreshTimer.current) clearTimeout(refreshTimer.current);
        ExpoSpeechRecognitionModule.abort();
        setStatus('idle');
      }
    }, 0);
    return () => clearTimeout(t);
    // startFresh only touches refs and setters.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [alwaysListen]);

  // Narration paused or resumed while the app is in the background: after the
  // grace period with nothing playing, stop listening until the app is opened.
  useEffect(() => {
    keepInBackgroundRef.current = keepInBackground;
    if (foreground.current || !inBackgroundAllowed.current) return;
    if (graceTimer.current) clearTimeout(graceTimer.current);
    graceTimer.current = null;
    if (!keepInBackground) {
      graceTimer.current = setTimeout(() => {
        vlog('background grace over');
        inBackgroundAllowed.current = false;
        stopForBackground();
      }, BACKGROUND_GRACE_MS);
    }
  }, [keepInBackground]);

  // Turn listening back on after it gave up (tap on "Voice unavailable").
  const retry = startFresh;

  // Same as saying "Hey Nova": for the mic button, when the room is too loud.
  const wake = () => {
    if (awake.current || !enabled.current) return;
    vlog('wake() by tap');
    // With "Hey Nova" off the mic isn't running yet: start it for this command.
    const fresh = !running.current;
    if (fresh) start();
    awake.current = true;
    // A fresh session has nothing said before the tap; otherwise skip what was.
    tapSince.current = fresh ? '' : lastTranscript.current;
    setStatus('awake');
    hear('');
    handlers.current.onWake();
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => finish(''), WAKE_TIMEOUT_MS);
  };

  // The mic button while listening: send what's been said now, without waiting
  // for silence; with nothing said yet, stop listening.
  const endTurn = () => {
    if (!awake.current) return;
    vlog('endTurn() by tap', JSON.stringify(heardRef.current));
    finish(heardRef.current);
  };

  return { status, heard, errorDetail, retry, wake, endTurn };
}
