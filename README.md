# 鲸鲸与 GPT 娘 · 桌面生活助手

Windows 外部桌宠整合：记账、生活提醒、小动作，以及可选的双宠互动。操作台已经内置，可查看每项功能的触发条件并立即演示。

<img src="src/whale/assets/companion-idle.png" width="130" alt="鲸鲸站姿"> <img src="src/whale/assets/companion-snack.png" width="130" alt="鲸鲸吃饭"> <img src="src/whale/assets/companion-sit.png" width="130" alt="鲸鲸坐着休息"> <img src="src/whale/assets/buddy-running.gif" width="130" alt="GPT 娘工作动作">

## 下载安装

前往 [最新发布页](https://github.com/axiu8076-cell/whale-gpt-desktop-pets/releases/latest)，按需要选一个 ZIP：

| 安装包 | 包含内容 |
| --- | --- |
| `Whale-Standalone-Windows-x64-2026.10.16.zip` | 鲸鲸、内置操作台、记账、硬件与日常提醒、独立任务检测 |
| `Whale-GPT-Duo-Windows-x64-2026.10.16.zip` | 上述全部功能＋GPT 娘、订阅额度、工作动作和双宠互动 |

1. 将整个 ZIP 解压到普通文件夹。
2. 双击 **安装鲸鲸.cmd**，按窗口提示安装。
3. 从桌面快捷方式打开角色或操作台，也可在鲸鲸托盘菜单打开操作台。

适用 Windows 10/11 x64（Intel / AMD）。包含 Electron 运行环境，无需另外安装 Node、Python、Codex CLI 或申请管理员权限。余额查询需要联网。单位策略若禁止脚本，请交给 IT 审核。

API Key 可留空，先看动作和使用提醒。DeepSeek 官方记账需要你自己的 Key；安装设置使用 Windows 当前用户加密保存。不要转发安装后的用户数据目录。

## 已合并的功能

- **日常动作**：站立、静默小口吃米饭、坐在任务栏上沿休息，动作随机轮换；重要提醒优先。
- **硬件状态**：CPU/GPU 负载高时库库吃饭；内存或专用显存接近满载时抱着米饭说“吃不下了”；真实温度、电池充电与低电量提醒。
- **生活提醒**：手动番茄钟；Codex 连续闲置 15 分钟提醒别浪费月供；正常完成超过 30 分钟的任务后庆祝。
- **桌面特效**：文件移入回收站后，在缓存的原位置、原图标上表演吃文件；双宠版可随机由 GPT 娘发光炮。拿不到原图标就跳过，Shift+Delete 不触发。
- **双宠动作**：鲸鲸走过去递咖啡、一起庆祝；GPT 娘工作时随机敲电脑累晕或叼笔思考。需要两只显示在同一主屏幕。
- **显示与操作**：普通窗口置顶，全屏时让位；可拖动、设置大小和声音。内置操作台有 21 项卡片、触发要求、功能开关和即时演示。演示不会删除真实文件。

查看完整 [功能与触发条件](installer/duo/功能与触发条件.txt)。

## 额度与隐私

DeepSeek API 余额与 ChatGPT/Codex 月费订阅额度分别计算。余额差值是观测支出，不是精确逐请求账单。GPT 娘查询订阅额度需要本机 Codex 自带或已安装的 CLI 与有效登录；没有可靠结果时会显示不可读取。

客户端任务读取只在本机进行，可在安装设置中关闭。独立鲸鲸读取器只保留任务事件、状态和时间；双宠任务卡可显示本机聊天标题。程序不会把这些内容上传到 GitHub。发行包不包含作者的 Key、账号、聊天记录、账本、缓存和安装回执。

温度依赖可用传感器；CPU 温度需 LibreHardwareMonitor / OpenHardwareMonitor，缺失时显示未知。没有 Codex 或不兼容的本机记录时，任务提醒不可用，其余桌宠功能仍可使用。

## 更新和卸载

安装目录为当前用户目录下的 `.whale-companion`。两个版本共用此目录，可从鲸鲸单独版直接安装双宠版，原鲸鲸数据保留。建议任选一种使用。

开始菜单 → 鲸鲸生活助手 → **连接与启动设置**：修改 Key、任务读取与开机启动。开机启动默认不勾选。

开始菜单 → 鲸鲸生活助手 → **卸载鲸鲸**：默认保留个人数据，也可选择一并删除。更新请从本仓库发布页下载新包；整合版关闭上游 GPT 娘的独立自动更新，以免覆盖定制功能。

## 源码与构建

`src/whale` 为鲸鲸代码和素材；`src/gpt` 为 GPT 娘代码和素材；`installer/whale` 与 `installer/duo` 为两个安装器；`tools/build-release.py` 可重新打包。

下载并解压 [Electron 44.3.0 Windows x64](https://github.com/electron/electron/releases/tag/v44.3.0)，保留完整许可证，在 Python 3 中执行：

```powershell
python tools/build-release.py --electron-dir D:\electron-44.3.0-win32-x64 --variant whale --output dist
python tools/build-release.py --electron-dir D:\electron-44.3.0-win32-x64 --variant duo --output dist
```

发布包的 SHA256 校验值随 Release 提供。首次版本在 Windows 的独立测试目录验证了安装、冷启动、操作台、重启、数据保留及卸载。传感器与订阅读取结果取决于同事的硬件和登录状态。

## 来源、许可与致谢

本仓库是现有项目的整合与定制。感谢：

- [MeteorNOX / DeepSeek-Balance-Whale-Widget](https://github.com/MeteorNOX/DeepSeek-Balance-Whale-Widget)，以及 Codex 适配协作者 Yang-huai406。
- [1llysviel 的 macOS PR #128](https://github.com/MeteorNOX/DeepSeek-Balance-Whale-Widget/pull/128)；保留相关代码与致谢，本安装包只支持 Windows。
- [T7moris / GPT-Niang](https://github.com/T7moris/GPT-Niang) 及贡献者。
- Electron、Chromium、Node.js 和 smol-toml 的维护者。

代码和文档按各目录中的 MIT / BSD 许可证分发。**角色、图片与音频不因代码 MIT 而获得额外授权**；原角色权益归各自权利人。GPT 娘素材仅允许随非商业项目副本展示和分发，不作为独立素材包或商业授权。

请保留 [鲸鲸来源说明](src/whale/PROVENANCE.md)、[第三方声明](src/whale/THIRD_PARTY_NOTICES.md)、[GPT 娘素材声明](src/gpt/assets/CHARACTER-NOTICE.txt) 和 [素材来源](src/gpt/assets/生成说明.md)。新增动作基于用户参考由 ImageGen 制作，不改变原角色权益。
