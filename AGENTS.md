# Agent Instructions

This project uses **bd** (beads) for issue tracking. Run `bd prime` for full workflow context.

> **Architecture in one line:** Issues live in a local Dolt database
> (`.beads/dolt/`); cross-machine sync uses `bd dolt push/pull` (a
> git-compatible protocol), stored under `refs/dolt/data` on your git
> remote — separate from `refs/heads/*` where your code lives.
> `.beads/issues.jsonl` is a passive export, not the wire protocol.
>
> See [SYNC_CONCEPTS.md](https://github.com/gastownhall/beads/blob/main/docs/SYNC_CONCEPTS.md)
> for the one-screen overview and anti-patterns (don't treat JSONL as the
> source of truth; don't `bd import` during normal operation; don't
> reach for third-party Dolt hosting before trying the default).

## Quick Reference

```bash
bd ready              # Find available work
bd show <id>          # View issue details
bd update <id> --claim  # Claim work atomically
bd close <id>         # Complete work
bd dolt push          # Push beads data to remote
```

## Non-Interactive Shell Commands

**ALWAYS use non-interactive flags** with file operations to avoid hanging on confirmation prompts.

Shell commands like `cp`, `mv`, and `rm` may be aliased to include `-i` (interactive) mode on some systems, causing the agent to hang indefinitely waiting for y/n input.

**Use these forms instead:**
```bash
# Force overwrite without prompting
cp -f source dest           # NOT: cp source dest
mv -f source dest           # NOT: mv source dest
rm -f file                  # NOT: rm file

# For recursive operations
rm -rf directory            # NOT: rm -r directory
cp -rf source dest          # NOT: cp -r source dest
```

**Other commands that may prompt:**
- `scp` - use `-o BatchMode=yes` for non-interactive
- `ssh` - use `-o BatchMode=yes` to fail instead of prompting
- `apt-get` - use `-y` flag
- `brew` - use `HOMEBREW_NO_AUTO_UPDATE=1` env var

<!-- BEGIN BEADS INTEGRATION v:1 profile:minimal hash:7510c1e2 -->
## Beads Issue Tracker

This project uses **bd (beads)** for issue tracking. Run `bd prime` to see full workflow context and commands.

### Quick Reference

```bash
bd ready              # Find available work
bd show <id>          # View issue details
bd update <id> --claim  # Claim work
bd close <id>         # Complete work
```

### Rules

- Use `bd` for ALL task tracking — do NOT use TodoWrite, TaskCreate, or markdown TODO lists
- Run `bd prime` for detailed command reference and session close protocol
- Use `bd remember` for persistent knowledge — do NOT use MEMORY.md files

**Architecture in one line:** issues live in a local Dolt DB; sync uses `refs/dolt/data` on your git remote; `.beads/issues.jsonl` is a passive export. See https://github.com/gastownhall/beads/blob/main/docs/SYNC_CONCEPTS.md for details and anti-patterns.

## Session Completion

**When ending a work session**, complete the steps below.

**WORKFLOW:**

1. **File issues for remaining work** - Create issues for anything that needs follow-up
2. **Run quality gates** (if code changed) - Tests, linters, builds
3. **Update issue status** - Close finished work, update in-progress items
4. **Push to remote** — **ONLY if the delegation brief permits pushing.** If the brief says push is forbidden, stop at commit and report the commit hash. Leaving work committed-but-unpushed is the correct outcome under a push-forbidden brief, not a failure.
   ```bash
   git pull --rebase
   git push
   git status
   ```
5. **Clean up** - Clear stashes, prune remote branches
6. **Verify** - All intended changes committed
7. **Hand off** - Provide context for next session
<!-- END BEADS INTEGRATION -->

## 命令の優先順位【2026-07-27 追加・恒久】

**委譲ブリーフの「触ってはいけない」＞ このファイル。** 相反したら必ずブリーフ側に従うこと。

このファイルは beads の定型ブロックを含む汎用テンプレートで、以前は「Work is NOT complete until git push succeeds」「NEVER stop before pushing」という push 強制の記述が入っていた。ラポルタの委譲ブリーフは push 禁止で回すことが多いため、これが常時ロードされた反対命令として働き、2026-07-20 ns9l4 と 2026-07-24 X サイクルの push 境界違反の構造的原因になっていた（2026-07-27 の worker-brief-digest 棚卸しで発見、worker-cwd/CLAUDE.md で是正済み）。本ファイルにも同型の記述が残存していたため、2026-07-29 の一斉掃引（friction台帳 a770c1059b79）で同じ修正を適用した。

- push 禁止のブリーフ下では `git add` + `git commit` のみを使う。`claude-git-sync.sh` は commit と push の一体型なので使わない
- push 禁止下で post-commit が drift 警告を出すのは想定内。解消しに行かないこと
- 迷ったら push せず、commit hash を報告して判断を仰ぐ

