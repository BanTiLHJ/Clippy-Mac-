# Clippy — macOS Clipboard Manager

一个轻量、无感、美观的 macOS 剪贴板管理器。

## 功能

- 🔍 **实时剪贴板监控** — 自动记录文本、HTML、图片
- 📌 **固定常用项** — 重要内容不会被自动清理
- 🔎 **即时搜索** — 快速找到历史记录
- ⌨️ **键盘导航** — ↑↓ 选择 · ↵ 复制 · Esc 关闭
- 🌐 **多语言** — 简体中文 / English，自动跟随系统
- 🌓 **黑白主题** — 自动跟随系统 / 手动切换
- 📎 **文件拖拽** — 拖入文件即可保存到剪贴板历史
- 🖥️ **菜单栏图标** — 常驻菜单栏，Cmd+Shift+V 呼出

## 技术栈

- Electron 29 + React 18
- Webpack 5 + Babel
- CSS Variables (macOS 原生风格)

## 快速开始

```bash
# 安装依赖
npm install

# 开发运行
npm start

# 打包 DMG
npm run dist
```

## 项目结构

```
├── main.js              # Electron 主进程
├── preload.js           # 预加载脚本 (contextBridge)
├── webpack.config.js    # Webpack 配置
├── src/
│   ├── index.html       # HTML 模板
│   ├── index.jsx        # React 入口 + 设置初始化
│   ├── App.jsx          # 主界面组件
│   ├── App.css          # 样式 (dark + light)
│   ├── useTheme.js      # 主题 hook
│   ├── i18n/            # 国际化
│   │   ├── index.js     # I18nProvider
│   │   ├── en.js        # English
│   │   └── zh-CN.js     # 简体中文
│   └── components/
│       └── ClipboardItem.jsx  # 剪贴板项组件
└── assets/
    ├── icon.png         # 应用图标
    └── icon.icns        # macOS 图标
```

## 快捷键

| 快捷键 | 功能 |
|--------|------|
| Cmd+Shift+V | 显示/隐藏窗口 |
| ↑↓ | 导航列表 |
| ↵ | 复制选中项 |
| Esc | 清除搜索 / 关闭 |

## 许可

MIT
