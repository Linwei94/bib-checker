# BibTeX Checker – Scholar Helper (Chrome Extension)

自动化 Google Scholar → Cite → BibTeX 流程。

## 安装

1. 打开 Chrome，进入 `chrome://extensions/`
2. 右上角开启「开发者模式」
3. 点击「加载已解压的扩展程序」，选择此 `extension/` 文件夹
4. 完成

## 使用

1. 在 BibTeX Checker 工具中选中要核查的条目
2. 点击「🔍 Google Scholar」按钮
3. 扩展自动在 Scholar 页面点击第一条结果的 Cite → BibTeX
4. BibTeX 内容自动发回工具，填入文本框并显示差异
5. 确认后点「✅ 替换条目」

## 工作原理

- `scholar-search.js`：注入 Scholar 搜索页，自动点击 Cite 和 BibTeX 链接
- `scholar-bib.js`：注入 BibTeX 结果页，捕获文本，通过 `postMessage` 发回工具
