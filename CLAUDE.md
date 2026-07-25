
## Conventions

### Secrets

- Never commit secrets.

### Git workflow

- Never commit directly to `main`.
- One feature branch per feature, named `feat/<short-description>`.
- Commit after each logical change with a clear Conventional Commits message
  (`feat:`, `fix:`, `refactor:`, etc.) — don't batch everything into one
  commit at the end.
- Before each commit, show the diff and the proposed commit message for
  review.
- After pushing, open a PR with the host's CLI:
  - GitHub: `gh pr create --fill`
  - Azure DevOps: `az repos pr create`
