# Changelog

All notable changes to this project will be documented in this file.

## [1.1.0] - 2024-05-21

### Added
- **Sentiment Analysis**: The bot now analyzes the sentiment of the meeting (Positive, Neutral, Negative).
- **Priority Detection**: Tasks are now assigned High/Medium/Low priority based on context.
- **Work Item Types**: Support for Bug, Task, and User Story classification.
- **Vercel Deployment**: Support for deploying as a Serverless Function on Vercel.
- **Docker Support**: Added Dockerfile and .dockerignore for containerized deployment.
- **Structured Logging**: Logs are now output in JSON format for better observability.
- **Token Metrics**: Added tracking for AI token usage.
- **Help Card**: Added "Report Issue" button.

### Changed
- **Validation**: Switched to Zod for robust AI response validation.
- **UI**: Updated Summary Card to display Priority colors and Sentiment.
- **Refactoring**: Separated Bot Adapter logic for better modularity.

### Fixed
- **Linting**: Added ESLint configuration and fixed unused variables.
- ** formatting**: Added Prettier configuration.

## [1.0.0] - Initial Release
- Basic meeting processing
- Azure OpenAI integration
- Azure DevOps integration
- Teams Bot interface
