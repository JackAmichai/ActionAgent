# Contributing to ActionAgent

Thank you for your interest in contributing to ActionAgent! We welcome contributions from the community.

## Development Setup

1.  **Clone the repository**
    ```bash
    git clone https://github.com/JackAmichai/ActionAgent.git
    cd ActionAgent
    ```

2.  **Install dependencies**
    ```bash
    npm install
    ```

3.  **Configure Environment**
    Copy `.env.sample` to `.env` and fill in the required values.
    ```bash
    cp .env.sample .env
    ```

4.  **Run Tests**
    Ensure all tests pass before submitting your PR.
    ```bash
    npm test
    ```

5.  **Linting & Formatting**
    We use ESLint and Prettier.
    ```bash
    npm run lint
    npm run format
    ```

## Pull Request Process

1.  Create a new branch for your feature or bug fix.
    ```bash
    git checkout -b feature/my-amazing-feature
    ```
2.  Make your changes and commit them with descriptive messages.
3.  Push your branch to GitHub.
4.  Open a Pull Request against the `main` branch.
5.  Ensure all CI checks pass.

## Coding Standards

*   Use TypeScript for all new code.
*   Follow the existing code style (Prettier/ESLint).
*   Add tests for new features.
*   Update documentation as needed.

## Architecture

ActionAgent uses:
*   **Bot Framework SDK** for Teams integration.
*   **Azure OpenAI** for intelligence.
*   **Azure DevOps REST API** for work item management.
*   **Microsoft Graph API** for accessing transcripts.

See `README.md` for more architectural details.
