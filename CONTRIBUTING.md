# Contributing

## Commit message convention
Use Chinese commit prefix types and 72-char subject:
- feat, fix, docs, style, refactor, perf, test, chore

Example:
```
feat: 增加RDAP域名过期检测并分类死链原因

- 说明改动必要性与影响
- 是否存在破坏性变更
```

## PR workflow
- Fork → branch → PR to `main`
- CI validates manifest and packs artifact

## Coding style
- Follow existing JS style; no secrets in repo
- Keep UI copy bilingual where appropriate