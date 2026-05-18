import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '../../action'))

import datetime
import tempfile
from write_note import make_slug, build_filename, build_note, find_unique_path


def test_english_slug():
    assert make_slug("Buy some milk today") == "buy-some-milk-today"


def test_cyrillic_slug():
    result = make_slug("Купить хлеб")
    assert len(result) > 0
    assert "-" in result or result.isalpha()


def test_slug_max_length():
    long_text = "word " * 50
    assert len(make_slug(long_text)) <= 60


def test_build_filename_format():
    dt = datetime.datetime(2026, 5, 17, 14, 32, 10)
    path = build_filename("Test idea", dt)
    assert path.startswith("raw/2026-05-17_1432_")
    assert path.endswith(".md")
    assert "test-idea" in path


def test_build_note_frontmatter():
    note = build_note("My idea", "text", 42, "2026-05-17T14:32:10+03:00")
    assert "created: 2026-05-17T14:32:10+03:00" in note
    assert "source: telegram" in note
    assert "type: text" in note
    assert "telegram_message_id: 42" in note


def test_build_note_title_from_first_line():
    note = build_note("Title line\nBody line", "text", 1, "2026-01-01T00:00:00+00:00")
    assert "# Title line" in note
    assert "Body line" in note


def test_build_note_single_line():
    note = build_note("Just a title", "text", 1, "2026-01-01T00:00:00+00:00")
    assert "# Just a title" in note
    assert "None" not in note


def test_build_note_voice_type():
    note = build_note("Voice text", "voice", 5, "2026-01-01T00:00:00+00:00")
    assert "type: voice" in note


def test_find_unique_path_no_collision():
    with tempfile.TemporaryDirectory() as tmpdir:
        os.makedirs(os.path.join(tmpdir, "raw"), exist_ok=True)
        result = find_unique_path("raw/test.md", tmpdir)
        assert result == "raw/test.md"


def test_find_unique_path_with_collision():
    with tempfile.TemporaryDirectory() as tmpdir:
        os.makedirs(os.path.join(tmpdir, "raw"), exist_ok=True)
        # Create existing file
        open(os.path.join(tmpdir, "raw", "test.md"), "w").close()
        result = find_unique_path("raw/test.md", tmpdir)
        assert result == "raw/test_2.md"
