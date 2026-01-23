# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 1.1.x   | :white_check_mark: |
| 1.0.x   | :x:                |

## Reporting a Vulnerability

If you discover a security vulnerability within ActionAgent, please send an email to the maintainers instead of opening a public issue.

### Data Privacy

*   **Transcripts**: Meeting transcripts are processed in memory and sent to Azure OpenAI. They are not persisted in the bot's database.
*   **Tokens**: Authentication tokens (PAT, Graph) are stored in environment variables and never logged.
*   **Logging**: PII is scrubbed from logs where possible.

### Azure OpenAI Data Usage

This project uses Azure OpenAI. Please refer to Microsoft's [Data, privacy, and security for Azure OpenAI Service](https://learn.microsoft.com/en-us/legal/cognitive-services/openai/data-privacy) documentation.
