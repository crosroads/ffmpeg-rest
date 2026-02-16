# Bug: Accidental PR to Upstream Repo — Fork Isolation

**Date:** February 15, 2026
**Severity:** Security / Code Leak
**Status:** Resolved

---

## Problem Description

### Issue:
A pull request (PR #1) was accidentally created against the **upstream** repository (`crisog/ffmpeg-rest`) from the `crosroads/ffmpeg-rest` fork, exposing proprietary VicSee/EasyBrainrot code to the upstream maintainer.

### Exposed Code:
- Video composition pipeline (ASS subtitles, karaoke highlighting)
- S3/R2 storage integration paths
- Watermark positioning logic
- Background video caching strategy
- 2,945 lines of additions across 13 files

### Root Cause:
`crosroads/ffmpeg-rest` was a **GitHub fork** of `crisog/ffmpeg-rest`. GitHub forks have an automatic relationship with the upstream repo:

1. When a branch is pushed to a fork, GitHub suggests creating a PR against the **upstream** repo (not the fork itself)
2. `gh pr create` on a fork defaults to creating PRs against the upstream repo unless `--repo` is explicitly specified
3. On **November 22, 2025**, the `feature/video-composition` branch was pushed and a PR was created against upstream — likely by Claude Code during an EasyBrainrot build session

The PR sat open for ~3 months until the upstream owner (`crisog`) closed it on February 15, 2026 without merging.

---

## Resolution

### Immediate Actions (Feb 15, 2026):
1. **Deleted `feature/video-composition` branch** — both local and remote (`origin`)
2. **Detached fork** — used GitHub Settings > "Leave fork network" to make `crosroads/ffmpeg-rest` a standalone repo, permanently breaking the fork relationship with `crisog/ffmpeg-rest`

### Result:
- `crosroads/ffmpeg-rest` is now a standalone repository
- Same URL, same git remotes, same Railway deployment — no reconfiguration needed
- No future PRs can accidentally target the upstream repo
- Repository visibility can now be changed (forks cannot change visibility)

---

## Prevention Rules

### NEVER on this repo:
1. **Never create pull requests** — commit and push directly to `main`
2. **Never push feature branches to remote** — work locally, merge to `main`, push `main`
3. **Never use `gh pr create`** — there is no PR workflow for this repo
4. **Never re-fork from upstream** — if upstream updates are needed, cherry-pick manually

### If upstream changes are needed:
```bash
# Add upstream as a read-only remote (temporarily)
git remote add upstream https://github.com/crisog/ffmpeg-rest.git
git fetch upstream
git cherry-pick <commit-hash>
git remote remove upstream
```

---

## Timeline

| Date | Event |
|------|-------|
| Nov 22, 2025 | `feature/video-composition` branch pushed, PR #1 created against upstream |
| Feb 15, 2026 | `crisog` closes PR #1 (unmerged) |
| Feb 15, 2026 | Branch deleted (local + remote) |
| Feb 15, 2026 | Fork detached via GitHub Settings > "Leave fork network" |
