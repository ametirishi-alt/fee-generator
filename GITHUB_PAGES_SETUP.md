# Fee Generator for GitHub Pages

1. Extract this ZIP.
2. Upload the docs folder to the top level of your GitHub repository. Keep the folder intact. Your repository should contain docs/index.html.
3. In the repository, open Settings, then Pages.
4. Choose Deploy from a branch. Select your default branch (usually main) and /docs, then Save.
5. After publication completes, copy the website URL shown under Pages and share it.

This package contains the same calculator code as the private Fee Generator, prepared for publication from GitHub Pages /docs. It has no external dependencies and needs no build step. Each visitor uses a separate calculator in their browser. Client details and selections are kept only in the open page and are cleared on refresh. The tool does not save or send client quotes.

GitHub Pages is generally public, including the price list delivered to the browser. GitHub Free requires a public repository. Pro and Team can publish from a private repository, but the Pages website is still normally public. Private Pages sites require an eligible organization on GitHub Enterprise Cloud.

Rates are in docs/pricing.mjs. Future changes to the separate ChatGPT-hosted version are not automatically synced to this package or your GitHub repository.

Official setup: https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site
