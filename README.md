# Young E. 的网站

根目录个人主页，只汇总公开网站、简介与链接。页面通过 GitHub 公共 API 每 60 秒同步一次启用 GitHub Pages 的仓库，并支持手动刷新、失败时保留最近一次成功结果。

## 开发

```bash
npm install
npm run dev
```

## 验证与构建

```bash
npm test
npm run build
```

`.github/workflows/pages.yml` 会运行相同验证并部署到 GitHub Pages。
