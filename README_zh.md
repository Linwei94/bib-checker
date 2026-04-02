# BibTeX Checker

一款 Chrome 扩展，专门用于检测 BibTeX 中被 AI 捏造的参考文献。ChatGPT、Claude、Gemini 等 LLM 经常生成看似合理、实则不存在的论文标题、作者、发表会议和年份。ICML、ICLR、NeurIPS 等顶级会议现已开始自动检查参考文献合法性。

**BibTeX Checker** 将整个 `.bib` 文件批量与 Google Scholar 对比，以逐字段高亮差异的方式展示，让你在投稿前快速修复幻觉引用——分钟级完成，无需逐条手查。

🌐 **[项目主页](https://linwei94.github.io/bib-checker/)**

---

## 安装

> 无需 Chrome 应用商店，直接从源码加载。

1. **克隆**本仓库 — `git clone https://github.com/Linwei94/bib-checker`
2. 打开 Chrome，进入 `chrome://extensions`
3. 开启右上角的**开发者模式**
4. 点击**加载已解压的扩展程序**，选择 `extension/` 文件夹
5. 工具栏出现 📚 图标即安装完成

## 使用方法

### 第一阶段 — 批量获取

1. 点击 📚 图标打开 BibTeX Checker
2. 将 `.bib` 文件内容粘贴到左侧面板，点击 **解析**
3. 点击 **▶ 开始批量获取** — 扩展自动为每条文献打开 Google Scholar 标签页，点击引用 → BibTeX，获取结果后关闭标签页
4. 观察右侧条目列表的状态变化：⏳ 待获取 → 🔍 有差异 / `=` 无差异 / ❌ 获取失败

### 第二阶段 — 审查与修正

5. 点击任意已获取的条目，查看并排差异
   - 原始版本中发生变化的词语用**琥珀色**标注
   - Scholar 版本中对应变化的词语用**绿色**标注
   - 仅大小写不同的差异会被忽略
6. 对每条文献，选择处理方式：
   - **✅ 替换** — 应用 Scholar 的 BibTeX（默认保留你原来的 key）
   - **👍 保留** — 标记为已审查，保持原版本
   - **⚡ 全部替换 (N)** — 一键应用所有待处理的 Scholar 结果
7. 点击 **⬇ 下载 .bib** 保存更新后的文件

### 键盘快捷键

| 按键 | 操作 |
|------|------|
| `R` | 替换当前条目 |
| `K` | 保留当前条目 |
| `←` / `→` | 上一条 / 下一条已获取的文献 |
| `Ctrl+Z` | 撤销 |

## 工作原理

```
extension/
├── manifest.json        Chrome 扩展配置（MV3）
├── background.js        Service worker — 标签页间消息转发
├── scholar-search.js    注入 scholar.google.com 的内容脚本
│                        点击引用 → BibTeX，获取原始 BibTeX，转发结果
├── index.html           扩展 UI（点击工具栏图标时打开）
└── index.js             全部 UI 逻辑——解析、批量获取、差异对比、替换
```

- **Background service worker** 追踪扩展标签页，并在扩展页与 Scholar 标签页之间转发消息
- **Scholar 内容脚本** 在 `document_end` 时运行，展示蓝色进度横幅，以可配置的延迟自动点击引用和 BibTeX 链接，通过 `chrome.runtime.sendMessage` 发回结果
- **差异算法** 对词语 token（大小写规范化后）执行 LCS，精确高亮变化的词语

## 注意事项

- Google Scholar 在频繁请求后可能出现验证码。若扩展超时（60 秒），该条目会被标记为 ❌——手动重试即可
- 获取间隔可在 1–10 秒之间调整，有助于避免被限流
- 所有 `.bib` 内容仅保存在本地 `localStorage` 中，不会发送到任何外部服务器（Google Scholar 除外）

## 许可证

MIT
