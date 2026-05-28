# Contributing

Thanks for helping improve Codex Voice Input.

This project is a Codex++ user script plus a local Python voice helper. Because it runs inside the Codex renderer and starts a local process, all external code submissions require maintainer review before merge.

## Before Opening a Pull Request

- Run `npm test`.
- Do not commit API keys, tokens, real user directories, email addresses, private network addresses, or credentialed URLs.
- Explain the security impact of changes that touch installation, startup, dependencies, or local processes.
- Keep changes focused and avoid unrelated refactors.

## Review Policy

- A maintainer reviews code, test results, and privacy-sensitive data before merge.
- Changes to `codex-voice-input.js`, install scripts, helper startup, or dependency files receive extra scrutiny.
- Pull requests may be closed or delayed if they include unsafe commands, hidden network behavior, secrets, or machine-specific paths.
