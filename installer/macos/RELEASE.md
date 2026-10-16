鲸鲸独立版现在支持 **M 系列芯片 Mac（arm64，macOS 14+）**，内置操作台。

下载 `Whale-Standalone-macOS-arm64-2026.10.16.zip`，解压后将 **鲸鲸.app** 拖入「应用程序」并打开，无需 Node、Homebrew 或 Xcode。

- 日常站立、悄悄吃米饭、坐着休息，操作台查看触发条件并直接演示。
- DeepSeek 官方余额设置，Key 使用 macOS 钥匙串保护的加密存储，可留空。
- CPU、系统内存、电池、番茄钟；可选登录启动。
- 可选本机 Codex 任务读取：闲置 15 分钟提醒，正常完成 ≥30 分钟任务后庆祝。
- 普通窗口置顶，全屏让位；菜单栏打开操作台；Cmd+Option+W 显示/隐藏。

**Mac 范围**：温度、GPU/专用显存、Finder 原图标删除追踪和 Windows GPT 娘联动暂不支持。相应卡片明确标出限制，不伪造读数。手动吃文件演示不修改真实文件。

**首次打开**：此包为 ad-hoc 签名，未经 Apple Developer ID 签名和公证。若 macOS 拦截，在确认来源与 SHA256 后，可按 [Apple 官方说明](https://support.apple.com/zh-cn/102445)，在「系统设置 → 隐私与安全性」对这个应用选择「仍要打开」。无需关闭 Gatekeeper。

构建在 GitHub 的 macOS 15 arm64 环境进行，并自动验证原生探针、Electron 启动、鲸鲸渲染就绪、操作台、动作触发、计时器、退出重启与设置保留。完整检查结果见 `macos-validation.json`。个人 Key/钥匙串授权、真实电池变化、Dock/多屏/全屏交互和实际 Codex 登录需用户设备验证。

Windows 两个版本仍可在 [Windows 发布页](https://github.com/axiu8076-cell/whale-gpt-desktop-pets/releases/tag/v2026.10.16.1) 下载。

感谢 MeteorNOX、Yang-huai406 及 [1llysviel 的 macOS PR #128](https://github.com/MeteorNOX/DeepSeek-Balance-Whale-Widget/pull/128)。保留原项目与 Electron 许可证；角色素材不获得额外商业授权。
