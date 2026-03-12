// docs/.vuepress/config.js
// 使用 VuePress 2 + 默认主题 + Vite 打包器
import { defineUserConfig } from 'vuepress'
//import { defaultTheme } from '@vuepress/theme-default'
import { viteBundler } from '@vuepress/bundler-vite'
import { plumeTheme } from 'vuepress-theme-plume'

export default defineUserConfig({
  lang: 'zh-CN',
  title: '我的开发笔记',
  description: '开发记录与辅助工具使用',
  // 如果仓库名是 fouriers-blog，则 GitHub Pages 访问路径为
  // https://你的用户名.github.io/fouriers-blog/
  // 对应的 base 需要设置为 '/fouriers-blog/'。若你之后改用其他仓库名，请同步修改这里。
  base: '/fouriers-blog/',

  // 显式指定主题
  theme: plumeTheme({
    navbar: [
      { text: '首页', link: '/' },
      { text: '文章', link: '/posts/' },
    ],
    sidebar: {
      '/posts/': [
        {
          text: '文章列表',
          collapsible: false,
          children: [
            '/posts/first-post.md',
            '/posts/deploy-log.md',
          ],
        },
      ],
    },
  }),

  // 显式指定打包器（bundler）
  bundler: viteBundler(),
})
