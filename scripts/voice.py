"""AI voiceover for reels (Kokoro, free, runs locally). Model files are fetched from GitHub on first use.

  from voice import synth   ->   synth(text, path_wav) returns (samples, sample_rate)
"""
import os, subprocess
from pathlib import Path

DIR = Path(os.environ.get("KOKORO_DIR", Path.home() / ".cache" / "kokoro"))
BASE = "https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0/"
FILES = ["kokoro-v1.0.onnx", "voices-v1.0.bin"]
VOICE = os.environ.get("REEL_VOICE", "am_michael")
SPEED = float(os.environ.get("REEL_VOICE_SPEED", "1.0"))
_k = None


def _load():
    global _k
    if _k is None:
        DIR.mkdir(parents=True, exist_ok=True)
        for f in FILES:
            if not (DIR / f).exists() or (DIR / f).stat().st_size < 1_000_000:
                subprocess.run(["curl", "-sL", "--fail", "-o", str(DIR / f), BASE + f], check=True)
        try:
            from kokoro_onnx import Kokoro
        except ImportError:
            subprocess.run(["pip", "install", "--break-system-packages", "-q", "kokoro-onnx", "soundfile"], check=True)
            from kokoro_onnx import Kokoro
        _k = Kokoro(str(DIR / FILES[0]), str(DIR / FILES[1]))
    return _k


def synth(text):
    s, sr = _load().create(text, voice=VOICE, speed=SPEED, lang="en-us")
    return s, sr
