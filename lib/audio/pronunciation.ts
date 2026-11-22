export type Accent = "uk" | "us";
export type PlaybackMode = "audio" | "speech" | "unavailable";

let activeAudio: HTMLAudioElement | null = null;

function stopActivePlayback(): void {
  if (activeAudio) {
    activeAudio.pause();
    activeAudio.currentTime = 0;
    activeAudio = null;
  }
  if (typeof window !== "undefined" && "speechSynthesis" in window) {
    window.speechSynthesis.cancel();
  }
}

function selectEnglishVoice(
  voices: readonly SpeechSynthesisVoice[],
  targetLang: string,
): SpeechSynthesisVoice | undefined {
  const normalizedTarget = targetLang.toLowerCase();
  return (
    voices.find((voice) => voice.lang.toLowerCase() === normalizedTarget) ??
    voices.find((voice) =>
      voice.lang.toLowerCase().startsWith(normalizedTarget.slice(0, 5)),
    ) ??
    voices.find((voice) => voice.lang.toLowerCase().startsWith("en"))
  );
}

function speakWithWebSpeech(
  text: string,
  accent: Accent,
): Promise<PlaybackMode> {
  if (
    typeof window === "undefined" ||
    !("speechSynthesis" in window) ||
    typeof SpeechSynthesisUtterance === "undefined"
  ) {
    return Promise.resolve("unavailable");
  }

  const targetLang = accent === "uk" ? "en-GB" : "en-US";
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = targetLang;
  utterance.rate = 0.95;

  const voice = selectEnglishVoice(
    window.speechSynthesis.getVoices(),
    targetLang,
  );
  if (voice) {
    utterance.voice = voice;
  }

  return new Promise<PlaybackMode>((resolve) => {
    let settled = false;
    const finish = (mode: PlaybackMode) => {
      if (settled) {
        return;
      }
      settled = true;
      window.clearTimeout(fallbackTimer);
      resolve(mode);
    };

    const fallbackTimer = window.setTimeout(() => finish("speech"), 8000);
    utterance.onend = () => finish("speech");
    utterance.onerror = () => finish("unavailable");

    window.speechSynthesis.speak(utterance);
  });
}

function playAudioUrl(url: string): Promise<boolean> {
  if (typeof Audio === "undefined") {
    return Promise.resolve(false);
  }

  return new Promise<boolean>((resolve) => {
    const audio = new Audio(url);
    activeAudio = audio;
    let settled = false;

    const cleanup = (ok: boolean) => {
      if (settled) {
        return;
      }
      settled = true;
      if (activeAudio === audio) {
        activeAudio = null;
      }
      audio.onended = null;
      audio.onerror = null;
      resolve(ok);
    };

    audio.onended = () => cleanup(true);
    audio.onerror = () => cleanup(false);

    audio.play().catch(() => cleanup(false));
  });
}

/**
 * Plays pronunciation audio for a word/phrase.
 * Prefers the verified `.mp3` URL from Free Dictionary API and transparently
 * falls back to the browser's Web Speech API (`en-GB` / `en-US`) if missing
 * or if audio playback fails.
 */
export async function playPronunciation({
  audioUrl,
  text,
  accent,
}: {
  audioUrl: string | null;
  text: string;
  accent: Accent;
}): Promise<PlaybackMode> {
  stopActivePlayback();

  if (audioUrl) {
    const played = await playAudioUrl(audioUrl);
    if (played) {
      return "audio";
    }
  }

  return speakWithWebSpeech(text, accent);
}
