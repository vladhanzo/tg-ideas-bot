import os
import datetime
from slugify import slugify


def make_slug(text: str, max_length: int = 60) -> str:
    words = text.split()[:7]
    short = " ".join(words)
    return slugify(short, max_length=max_length, separator="-", lowercase=True)


def build_filename(text: str, dt: datetime.datetime) -> str:
    timestamp = dt.strftime("%Y-%m-%d_%H%M")
    slug = make_slug(text)
    return f"Inbox/{timestamp}_{slug}.md"


def build_note(text: str, note_type: str, message_id: int, created_at: str) -> str:
    lines = text.strip().split("\n")
    title = lines[0]
    body = "\n".join(lines[1:]).strip()

    frontmatter = "\n".join([
        "---",
        f"created: {created_at}",
        "source: telegram",
        f"type: {note_type}",
        f"telegram_message_id: {message_id}",
        "---",
    ])

    if body:
        return f"{frontmatter}\n\n# {title}\n\n{body}"
    return f"{frontmatter}\n\n# {title}"


def find_unique_path(base_path: str, vault_dir: str) -> str:
    path = os.path.join(vault_dir, base_path)
    if not os.path.exists(path):
        return base_path
    stem, ext = os.path.splitext(base_path)
    suffix = 2
    while True:
        candidate = f"{stem}_{suffix}{ext}"
        if not os.path.exists(os.path.join(vault_dir, candidate)):
            return candidate
        suffix += 1
