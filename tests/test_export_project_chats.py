from scripts.archive.export_project_chats import Message, pair_turns, sanitize


def test_pair_turns_keeps_last_assistant_message():
    messages = [
        Message("user", "question", "2026-01-01T00:00:00Z"),
        Message("assistant", "progress", "2026-01-01T00:00:01Z"),
        Message("assistant", "final", "2026-01-01T00:00:02Z"),
    ]
    assert pair_turns(messages)[0][1].text == "final"


def test_sanitize_redacts_keys_and_trailing_space():
    cleaned = sanitize("api_key=abcdefghijklmno  \nAIzaFAKEFAKEFAKEFAKEFAKE")
    assert "abcdefghijklmno" not in cleaned
    assert "AIza" not in cleaned
    assert not cleaned.splitlines()[0].endswith(" ")
