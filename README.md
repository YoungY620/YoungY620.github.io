# 旅灯镇 / Wayfarer Lantern Town

Young E. 的可探索像素 RPG 个人主页，静态部署于 [youngy620.github.io](https://youngy620.github.io/)。访问者从旅人码头出发，进入参考 Ninja Adventure 官方村庄构建的小镇，通过 NPC、建筑、宝石路标、贝壳与冒险洞穴访问个人内容或独立游戏。

## 技术与目录

- 主世界：RPGJS v5 standalone，不依赖后端服务。
- 内容页：`public/pages/` 下 13 个可直接访问的中、日、英静态页面。
- 独立游戏：`games/dungeon-one/`，与主世界分开构建、分开存档。
- 游戏目录：`catalog/games.json`，同时支持站内游戏和外部链接。
- 共享素材：`public/assets/ninja-v1/`，主世界、页面和地牢只维护一份 Ninja Adventure 素材。
- 音乐：`public/assets/town-audio/`，广播台按清单按需读取预上传的 OGG 文件。
- 翻译：`src/i18n/zh.json`、`ja.json`、`en.json` 是全站唯一文案映射来源。

主世界位置、广播曲目、音量和静音设置，以及地牢检查点与成绩，均保存在浏览器本地；主世界与地牢使用不同的存储命名空间。

## 本地运行

需要 Node.js 22 或更新版本。

```bash
npm ci
npm run dev
```

开发地址默认为 `http://localhost:5173/`。生产构建与本地预览：

```bash
npm run build
npm run preview
```

完整校验会检查三语键一致性、地图连通性、TypeScript，以及主世界和地牢的生产构建：

```bash
npm run check
```

## 发布

推送 `main` 后，`.github/workflows/pages.yml` 会运行完整校验、构建 `dist/`，再通过 GitHub Pages 官方 Actions 发布。产物包含：

- `/`：主世界
- `/pages/...`：个人内容页
- `/games/dungeon-one/`：独立地牢
- `/catalog/games.json`：游戏目录
- `/assets/ninja-v1/`：共享 Ninja 素材
- `/assets/town-audio/`：广播音乐

## 素材与致谢

像素美术、字体、音效与素材包音乐来自 [Ninja Adventure Asset Pack](https://pixel-boy.itch.io/ninja-adventure-asset-pack)，作者 Pixel-Boy 与 AAA，许可为 CC0 1.0。蓝忍者精灵和村庄布局直接依据[官方参考工程](https://github.com/pixel-boy/NinjaAdventure)导入。

完整来源、音乐权利说明及站内致谢见 [CREDITS.md](./CREDITS.md)。
