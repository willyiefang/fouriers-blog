---
date: 2026-03-12
title: 跨仓库 commit 同步总结（内外网/子仓库到大仓库）
tags:
  - Git
  - Patch
  - 工程实践
---

# 跨仓库 commit 同步任务总结（内外网/子仓库到大仓库）

这篇记录一次补丁迁移过程：  
从一台服务器（内网、仓库 A）导出 patch，在另一台服务器（外网、仓库 B）应用，并处理了以下典型问题：

- 正在编译时是否能打 patch
- `git am` 中断后的状态清理
- `git am -3` 失败（缺 blob）
- `git apply --check` 报错但实际上已打入
- 源仓库是独立 repo，目标是单仓（monorepo）时的路径映射（`--directory`）
- 需要排除某几笔提交时如何导出 patch

---

## 1. 问题描述（本次）

- 29 服务器：源仓库（部分是独立仓库）
- 16 服务器：目标仓库（其中 vendor 不是独立仓库）
- 需求：迁移一批提交，并排除指定 2 笔
- 路径差异：源 patch 路径是 `bsp/...`，目标实际路径是 `sprdroid13_vnd_main/bsp/...`

---

## 2. 标准流程模板（推荐直接复用）

## 2.1 源仓库导出 patch

### A) 导出最近 N 笔

```bash
git format-patch -N HEAD -o /tmp/patches_export
```

### B) 导出指定范围

```bash
git format-patch <old_commit>^..<new_commit> -o /tmp/patches_export
```

### C) 需要排除某几笔（推荐做法）

1. 先导出一整段  
2. 删除不需要的 patch 文件（按文件名或 `From <sha>` 确认）  
3. 保留其余 patch 按编号顺序应用

---

## 2.2 打包并跨机器传输

在源机器：

```bash
cd /tmp
tar czf patches_export.tgz patches_export
```

从目标机器拉取（示例）：

```bash
scp <user>@<source_ip>:/tmp/patches_export.tgz ~/
```

> 注意：`scp ... ~/` 是下载到目标机的家目录（例如 `/home/lyq/`），不是当前工作目录。

解压到目标机：

```bash
tar xzf ~/patches_export.tgz -C ~
```

---

## 2.3 目标仓库应用 patch

先进入**正确的 git 根目录**：

```bash
git rev-parse --show-toplevel
git status
```

预检查：

```bash
git apply --check ~/patches_export/*.patch
```

正式应用：

```bash
git am ~/patches_export/*.patch
```

---

## 3. 子仓库 -> 大仓库 的关键参数：`--directory`

当 patch 内文件路径是：

```text
bsp/kernel5.15/...
```

而目标仓库真实路径是：

```text
sprdroid13_vnd_main/bsp/kernel5.15/...
```

应在大仓根目录执行：

```bash
git apply --check --directory=sprdroid13_vnd_main ~/patches_export/0001-*.patch
git am --directory=sprdroid13_vnd_main ~/patches_export/0001-*.patch
```

`--directory=xxx` 的本质是：把 patch 内每个目标路径都加前缀 `xxx/`。

---

## 4. 常见异常与处理

## 4.1 `previous rebase-apply still exists`

说明上次 `git am` 被中断（如 Ctrl+C）。

```bash
git am --abort || git am --quit
```

---

## 4.2 `Repository lacks necessary blobs to fall back on 3-way merge`

`git am -3` 无法三方合并（缺历史对象或基线差异）。可改走：

```bash
git am --abort
git apply --reject --whitespace=nowarn <patch>
find . -name "*.rej"
```

手工合并 `.rej` 后再 commit。

---

## 4.3 `git apply --check` 失败但怀疑已打入

这种情况很常见（重复应用会失败）。验证方法：

```bash
git log --oneline -5
git show --name-only --oneline -1
git status
```

若最近提交已包含该 patch，且 `status` clean，说明已生效。

---

## 4.4 `trailing whitespace` 警告

通常只是告警，不是失败。  
只要没有 `Patch failed` / `CONFLICT`，且流程走完，一般可忽略。

---

## 5. 本次实战的高效操作顺序（可直接套）

1. 在源仓库 `git format-patch` 导出  
2. 删除不需要的 patch 文件  
3. 打包 `tar czf`  
4. 传到目标机并解压  
5. 在目标仓库先 `git apply --check`  
6. 再 `git am` 批量应用  
7. 若路径层级不同，用 `git am --directory=<prefix>`  
8. `git log` + `git status` 最终确认  

---

## 6. 命令清单（模板）

```bash
# 源仓库
git format-patch <old>^..<new> -o /tmp/patches_export
cd /tmp && tar czf patches_export.tgz patches_export

# 目标机器拉包
scp <user>@<source_ip>:/tmp/patches_export.tgz ~/
tar xzf ~/patches_export.tgz -C ~

# 目标仓库应用（同路径）
cd <target_repo_root>
git apply --check ~/patches_export/*.patch
git am ~/patches_export/*.patch

# 目标仓库应用（路径前缀不同）
git apply --check --directory=<prefix> ~/patches_export/*.patch
git am --directory=<prefix> ~/patches_export/*.patch

# 验证
git log --oneline -10
git status
```

---

## 8. 经验建议

- 每次迁移前先确认：**当前目录是不是正确 git 根**。
- 大批量迁移优先 `format-patch + git am`，不要手工一笔笔 cherry-pick。
- 内外网不同步时，固定使用“导出 -> 打包 -> 传输 -> 应用”的流水线。
- 碰到失败先看错误类型：路径问题、基线问题、还是流程状态残留，处理会快很多。

---

以上流程适用于 Android 大仓、多子目录、多机器迁移场景，后续可直接复用为团队 SOP。
