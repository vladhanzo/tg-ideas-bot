import os
import sys
import tempfile
import datetime

import requests

import notify
from write_note import make_slug, build_filename, build_note, find_unique_path


def get_file_download_url(token: str, file_id: str) -> str:
    resp = requests.get(
        f"https://api.telegram.org/bot{token}/getFile",
        params={"file_id": file_id},
        timeout=30,
    )
    resp.raise_for_status()
    data = resp.json()
    file_path = data["result"]["file_path"]
    return f"https://api.telegram.org/file/bot{token}/{file_path}"


def download_file(url: str, dest: str) -> None:
    with requests.get(url, stream=True, timeout=60) as r:
        r.raise_for_status()
        with open(dest, "wb") as f:
            for chunk in r.iter_content(chunk_size=8192):
                f.write(chunk)


def run_transcription(audio_path: str, model) -> str | None:
    segments, _ = model.transcribe(
        audio_path,
        language=None,
        vad_filter=True,
        beam_size=5,
    )
    text = "".join(seg.text for seg in segments).strip()
    return text if text else None


def main() -> None:
    token = os.environ["TELEGRAM_BOT_TOKEN"]
    voice_file_id = os.environ["VOICE_FILE_ID"]
    chat_id = int(os.environ["CHAT_ID"])
    message_id = int(os.environ["MESSAGE_ID"])
    user_timestamp = os.environ.get("USER_TIMESTAMP", datetime.datetime.utcnow().isoformat() + "Z")
    vault_dir = os.environ.get("VAULT_DIR", "vault")
    github_repository = os.environ.get("GITHUB_REPOSITORY", "owner/repo")
    github_env_file = os.environ.get("GITHUB_ENV", "")

    print(f"Downloading voice file_id={voice_file_id}")
    download_url = get_file_download_url(token, voice_file_id)

    with tempfile.NamedTemporaryFile(suffix=".oga", delete=False) as tmp:
        audio_path = tmp.name

    try:
        download_file(download_url, audio_path)
        print(f"Downloaded to {audio_path}")

        print("Loading faster-whisper model (small)...")
        from faster_whisper import WhisperModel
        model = WhisperModel("small", device="cpu", compute_type="int8")

        print("Transcribing...")
        text = run_transcription(audio_path, model)

        if not text:
            notify.send_message(token, chat_id, "Не удалось распознать голосовое. Попробуйте ещё раз.")
            sys.exit(0)

        print(f"Transcription: {text[:80]}...")

        dt = datetime.datetime.fromisoformat(user_timestamp.replace("Z", "+00:00"))
        base_path = build_filename(text, dt)
        rel_path = find_unique_path(base_path, vault_dir)
        abs_path = os.path.join(vault_dir, rel_path)

        os.makedirs(os.path.dirname(abs_path), exist_ok=True)
        note_content = build_note(text, "voice", message_id, user_timestamp)
        with open(abs_path, "w", encoding="utf-8") as f:
            f.write(note_content)

        print(f"Written to {abs_path}")
        slug = make_slug(text)

        if github_env_file:
            with open(github_env_file, "a") as env_file:
                env_file.write(f"NOTE_PATH={rel_path}\n")
                env_file.write(f"NOTE_SLUG={slug}\n")

        file_url = f"https://github.com/{github_repository}/blob/main/{rel_path}"
        notify.send_message_with_keyboard(
            token,
            chat_id,
            f"Транскрипция:\n\n{text}\n\n{file_url}",
            inline_keyboard=[[
                {"text": "GitHub", "url": file_url},
                {"text": "Удалить", "callback_data": f"delete:{rel_path}"},
            ]],
        )
    finally:
        if os.path.exists(audio_path):
            os.unlink(audio_path)


if __name__ == "__main__":
    main()
