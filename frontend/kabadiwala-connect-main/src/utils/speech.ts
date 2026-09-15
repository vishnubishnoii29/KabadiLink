// Speech utility for text-to-speech safety guidance and pricing voice readout in EN, HI, MR

export class AudioGuideEngine {
  private static synth: SpeechSynthesis | null = typeof window !== "undefined" ? window.speechSynthesis : null;
  private static isSpeaking = false;
  private static activeUtterance: SpeechSynthesisUtterance | null = null;

  public static speak(text: string, lang: "en" | "hi" | "mr" = "en", onEnd?: () => void) {
    if (!this.synth) {
      console.warn("SpeechSynthesis not supported on this browser.");
      if (onEnd) onEnd();
      return;
    }

    // Cancel ongoing speech
    this.stop();

    const utterance = new SpeechSynthesisUtterance(text);
    this.activeUtterance = utterance;

    // Pick appropriate BCP-47 tag
    let langCode = "en-IN";
    if (lang === "hi") langCode = "hi-IN";
    if (lang === "mr") langCode = "mr-IN";

    utterance.lang = langCode;
    utterance.rate = 0.95; // slightly deliberate for clarity
    utterance.pitch = 1.0;

    // Try finding matching voice
    const voices = this.synth.getVoices();
    const matchedVoice = voices.find((v) => v.lang === langCode || v.lang.startsWith(lang));
    if (matchedVoice) {
      utterance.voice = matchedVoice;
    }

    utterance.onstart = () => {
      this.isSpeaking = true;
    };

    utterance.onend = () => {
      this.isSpeaking = false;
      this.activeUtterance = null;
      if (onEnd) onEnd();
    };

    utterance.onerror = (e) => {
      console.warn("TTS playback error:", e);
      this.isSpeaking = false;
      this.activeUtterance = null;
      if (onEnd) onEnd();
    };

    this.synth.speak(utterance);
  }

  public static stop() {
    if (this.synth) {
      this.synth.cancel();
    }
    this.isSpeaking = false;
    this.activeUtterance = null;
  }

  public static getIsSpeaking() {
    return this.isSpeaking;
  }

  public static playBidChime() {
    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const gain = ctx.createGain();

      osc1.type = "sine";
      osc1.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
      osc1.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.15); // A5

      osc2.type = "triangle";
      osc2.frequency.setValueAtTime(880, ctx.currentTime);
      osc2.frequency.exponentialRampToValueAtTime(1174.66, ctx.currentTime + 0.2); // D6

      gain.gain.setValueAtTime(0.18, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);

      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(ctx.destination);

      osc1.start();
      osc2.start();
      osc1.stop(ctx.currentTime + 0.4);
      osc2.stop(ctx.currentTime + 0.4);
    } catch {
      // Ignore audio context errors in quiet mode
    }
  }

  public static playSuccessChime() {
    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = "sine";
      osc.frequency.setValueAtTime(523.25, ctx.currentTime); // C5
      osc.frequency.setValueAtTime(659.25, ctx.currentTime + 0.1); // E5
      osc.frequency.setValueAtTime(783.99, ctx.currentTime + 0.2); // G5
      osc.frequency.setValueAtTime(1046.50, ctx.currentTime + 0.3); // C6

      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + 0.6);
    } catch {
      // Ignore audio context errors
    }
  }
}
