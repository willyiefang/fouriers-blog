---
date: 2026-03-03
title: 在不同电脑上维护和部署此博客的流程
tags:
  - Git
  - 部署
  - VuePress
---

## 在新电脑上第一次部署本博客

假设你的新电脑已经安装了 **Git** 和 **Node.js**，并且使用的还是同一个 GitHub 账号。

1. **克隆仓库**

   ```bash
   git clone https://github.com/willyiefang/fouriers-blog.git
   cd fouriers-blog
   ```

2. **安装依赖**

   ```bash
   npm install
   ```

3. **本地启动开发服务器**

   ```bash
   npm run docs:dev
   ```

   打开浏览器访问 `http://localhost:8080/`，就可以在本地查看博客。

## 日后修改博客并上传的 Git 操作

无论是在公司电脑还是个人电脑，后续的日常流程都一样：

1. **开始前先拉取远程最新代码**

   ```bash
   git pull
   ```

2. **编写 / 修改文章**

   - 在 `docs/posts/` 目录下新建或编辑 Markdown 文件。
   - 在 `docs/index.md` 或 `docs/posts/README.md` 中按需要加上入口链接。

3. **查看当前变更（可选但推荐）**

   ```bash
   git status
   ```

4. **添加到暂存区**

   ```bash
   git add .
   ```

5. **提交本次修改**

   ```bash
   git commit -m "update docs"
   ```

6. **推送到 GitHub**

   ```bash
   git push
   ```

   如果网络不好导致推送失败，只要本地已经 `commit` 了，稍后网络正常再执行一次 `git push` 即可。

## 部署与线上访问地址

- 每次推送到 `main` 分支后，GitHub Actions 自动执行：
  - `npm install`
  - `npm run docs:build`
  - 将 `docs/.vuepress/dist` 发布到 `gh-pages` 分支
- GitHub Pages 使用 `gh-pages` 分支作为发布源。

因此，只要 **`git push` 成功**，几分钟后访问：

- 首页：`https://willyiefang.github.io/fouriers-blog/`
- 示例文章：`https://willyiefang.github.io/fouriers-blog/posts/first-post.html`

就能看到最新内容。

