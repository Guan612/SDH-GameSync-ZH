# SDH-GameSync 简体中文版

基于 [AkazaRenn/SDH-GameSync](https://github.com/AkazaRenn/SDH-GameSync) v1.1.5（提交 `891f5b1`）的本地汉化版，版本号 `1.1.5-zh.2`。原作者、BSD-3-Clause 许可证和原版英文说明均保留。这不是上游官方中文版。

## 1.1.5-zh.2 界面修复

云服务设置页现在预留 Steam 顶栏/底栏空间，并使用独立可滚动内容区，避免第四个选项被底栏遮住。键盘聚焦控件时会滚动到可见区域；不改侧栏、快捷面板或同步行为。修复已单独提交上游 [PR #30](https://github.com/AkazaRenn/SDH-GameSync/pull/30)，尚未合并。

本地 13 项测试、类型检查与构建通过；模拟 Decky 控件/Steam 顶底栏的真实浏览器布局检查覆盖 5 种尺寸，滚轮、键盘聚焦和触摸滚动通过。**这不是 Steam/DroidDeck 真机验收，真实手柄焦点导航仍待确认。**

## 改动范围

- 汉化插件面板、游戏右键菜单、云存储设置、规则编辑、日志按钮、确认弹窗、手柄操作提示及同步通知。
- 明确标注「严格游戏同步」的删除风险、「本地优先」和「云端优先」的方向。
- 云服务设置补充 WebDAV 的中文入口说明。**没有新增可直接填写 WebDAV 地址/账号的表单**，仍需首次在桌面配置。
- 保留插件元数据中的 `name: Game Sync`、后端、配置键、过滤规则格式和原同步逻辑。前端标题显示 `Game Sync（中文）`。
- 本版固定简体中文，没有新增多语言切换器。Steam/Decky 提供的系统文件选择器等组件使用其自身语言；rclone 输出和诊断日志保留原文，便于排错。

## 安装与回退

1. 在原版插件中先关闭自动同步，正常退出游戏，并等待已有同步任务结束。
2. 使用文件管理器备份已有存档，以及本机 `homebrew/settings/SDH-GameSync` 目录。若实际插件目录名不同，请以本机为准；备份含 rclone 凭据，不要上传给他人。
3. 打开 Decky 设置，启用开发者选项，通过「从 ZIP 安装」或「Install Plugin from ZIP」选择 `release/SDH-GameSync-1.1.5-zh.2.zip`。具体选项名称随 Decky 版本不同。
4. 这是原插件的替换版，不是应与原版同时启用的第二个同步器。安装后确认只有一个 Game Sync；若 Decky 没有替换原插件，先停止，不要启用两份。
5. 检查原云服务、目录和规则是否保留，拿一款已备份的游戏手动测试，再启用启动/退出自动同步。

如需回退，可重新安装原版 ZIP。本版不迁移配置，但安装器是否保留目录取决于 Decky；回退前仍应备份。不提供自动安装到主机或 DroidDeck 的脚本。

## 第一次配置 WebDAV

WebDAV 由 rclone 提供支持；本汉化版不增加新后端，也不把密码写入源码。

切到 SteamOS 桌面模式，找到插件自己的 rclone 二进制和配置目录。典型目录如下；DIY SteamOS 的用户名不一定是 `deck`，因此使用 `$HOME`：

```bash
"$HOME/homebrew/data/SDH-GameSync/rclone" \
  --config "$HOME/homebrew/settings/SDH-GameSync/rclone.conf" config
```

如果实际目录不是 `SDH-GameSync`，请把命令中两处目录改成本机实际名称。

1. 使用 `n` 创建远端，名称必须填 `cloud`。如果已存在 `cloud`，先备份配置，再用 `e` 编辑，不要重复创建或直接删除凭据。
2. 存储类型选择 `webdav`，按提示填写服务商提供的 WebDAV URL、服务类型、用户名和应用专用密码。按服务商文档确认 URL，不要把普通网页登录地址当作 WebDAV URL。
3. 使用 HTTPS，不要为了连通而关闭证书检查。建议使用只有专用存档目录权限的账户。
4. 返回插件的「云存储服务」，应识别为 WebDAV；在云端创建配置中的同步目录，默认是 `/sdh-game-sync`。
5. 首次同步前先确定哪一端的存档是正确版本。云端还没有存档时，应先在「专用同步规则」中手动上传正确的本地存档，不要直接以空云端开始下载。

服务说明：[rclone WebDAV 文档](https://rclone.org/webdav/)。密码由 rclone 管理；配置文件内的混淆密码不等于强加密，备份也要保密。

## 配置单个游戏

1. 在 Steam 库中打开游戏右键菜单，选择「同步日志与规则」。手动添加的非 Steam 游戏也要从对应 Steam 条目启动，插件才有机会处理生命周期通知。
2. 进入「专用同步规则」，选择「添加包含规则」，只选真正的存档文件/目录，不要选整个 Proton 容器、Steam 目录或系统根目录。
3. 检查匹配文件数量并保存规则。
4. 先手动上传正确进度，确认云端目录和内容，再测试下载能否被另一台设备正确读档。
5. 在插件面板打开「启动游戏时同步」及「退出游戏时同步」。默认不启用「严格游戏同步」。

共享规则优先级高于专用规则；共享排除项可能使游戏规则不生效。全局同步主要用于非游戏专属文件，不建议让它和游戏规则重复管理同一份存档。

## 重要边界

- 本版只做汉化，没有把文件复制升级成 Steam Cloud。启动后暂停进程再下载的机制保留上游行为，存在个别游戏提前读档的竞态。
- 正常退出后才会上传；强退 Steam、崩溃、断电或马上关闭 DroidDeck 可能导致上传未完成。队列结束不等于每个任务都成功，请看失败通知和同步日志。
- 插件没有跨设备锁。不要两台同时玩同一游戏；离线进度和云端进度发生分叉时，先备份再决定采用哪一份。
- 默认的游戏同步是 `rclone copy`，不是安全的存档合并，也不是版本备份。严格模式改为 `rclone sync`，可能删除目标端文件。建议在 WebDAV 服务端额外开启历史版本/快照。
- 云端保存的是同步根目录下的相对路径，**三端填同一 WebDAV 地址不代表存档就会对应**。Windows、SteamOS 和 DroidDeck 的不同存档位置需要额外映射。非 Steam 快捷方式 ID 也不应假定跨设备一致。
- Windows 需要另配启动器/脚本；本版不是 Windows 客户端。DroidDeck 0.7.1 的 SDH-GameSync 后端、rclone 架构和暂停/恢复进程兼容性尚未真机验证，不能承诺安装即可用。
- 正式 Steam Cloud 管理的同一份存档不建议再由本插件同时双向管理。

## 构建与验证

需要 Node.js 22+ 和 pnpm（项目声明 9.15.0）。

```bash
pnpm install --frozen-lockfile --ignore-scripts
pnpm test
pnpm typecheck
pnpm package
```

安装包在 `release/SDH-GameSync-1.1.5-zh.2.zip`。打包脚本只收集发布文件，不包含 `.git`、`node_modules`、凭据或本地配置。包内顶层目录仍为 `SDH-GameSync`，默认配置位于包根目录，与上游 ZIP 一致。

上游 `src/json/*.json` 是符号链接；Windows Git 需启用 `core.symlinks` 并正确检出这两个文件，否则 TypeScript 会把链接目标文本误读成 JSON。不要提交用来替代链接的配置副本。

`typecheck` 跳过依赖库声明检查（上游 Decky 依赖缺少部分 React peer 声明），仍检查本项目 TypeScript 源码。测试使用模拟 Decky/Steam 环境，覆盖中文标签、弹窗、通知和配置绑定，并核对后端及生命周期处理未改变。**这些都不代替 SteamOS/DroidDeck 真机或真实 WebDAV 端到端验收。**
