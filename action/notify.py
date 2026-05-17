import requests


def send_message(token: str, chat_id: int, text: str) -> None:
    requests.post(
        f"https://api.telegram.org/bot{token}/sendMessage",
        json={"chat_id": chat_id, "text": text},
        timeout=30,
    ).raise_for_status()


def send_message_with_keyboard(
    token: str,
    chat_id: int,
    text: str,
    inline_keyboard: list,
) -> None:
    requests.post(
        f"https://api.telegram.org/bot{token}/sendMessage",
        json={
            "chat_id": chat_id,
            "text": text,
            "reply_markup": {"inline_keyboard": inline_keyboard},
        },
        timeout=30,
    ).raise_for_status()
