import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '../../action'))

from unittest.mock import patch, MagicMock
import transcribe


def test_get_file_download_url():
    with patch('requests.get') as mock_get:
        mock_resp = MagicMock()
        mock_resp.json.return_value = {
            'ok': True,
            'result': {'file_path': 'voice/file.oga'}
        }
        mock_get.return_value = mock_resp
        url = transcribe.get_file_download_url('mytoken', 'file_id_123')
    assert url == 'https://api.telegram.org/file/botmytoken/voice/file.oga'


def test_run_transcription_returns_text():
    mock_model = MagicMock()
    seg1 = MagicMock()
    seg1.text = ' Hello world '
    seg2 = MagicMock()
    seg2.text = ' more text'
    mock_model.transcribe.return_value = ([seg1, seg2], MagicMock())
    result = transcribe.run_transcription('/tmp/audio.oga', mock_model)
    assert result == 'Hello world  more text'


def test_run_transcription_empty_returns_none():
    mock_model = MagicMock()
    mock_model.transcribe.return_value = ([], MagicMock())
    result = transcribe.run_transcription('/tmp/audio.oga', mock_model)
    assert result is None


def test_run_transcription_whitespace_only_returns_none():
    mock_model = MagicMock()
    seg = MagicMock()
    seg.text = '   '
    mock_model.transcribe.return_value = ([seg], MagicMock())
    result = transcribe.run_transcription('/tmp/audio.oga', mock_model)
    assert result is None
