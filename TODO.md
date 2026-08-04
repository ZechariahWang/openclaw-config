# TODO

## Wake-word gating for Iris ("hey Iris")

Make the voice bridge privacy-gated like Siri: a small local wake-word detector
owns the mic, nothing streams to Google until the wake phrase is heard, then
audio flows for the conversation window and re-gates after ~1 min of silence.
Side benefit: stops idle listening from burning free-tier quota.

Plan:
- Python sidecar owns the mic, prints "WAKE" on detection; Node bridge keeps its
  persistent Gemini session but only forwards audio during a wake window.
- Detector options (pick one):
  1. openWakeWord + pre-trained "Hey Jarvis" - open source, works immediately,
     wrong name (or rename her Jarvis).
  2. Porcupine (Picovoice) custom "Hey Iris" - free personal tier, minutes of
     setup, needs account + access key from console.picovoice.ai (Linux x86_64).
  3. openWakeWord custom-trained "Hey Iris" - fully open source, most effort
     (synthetic-speech training notebook).
