# 版本控制、核对、发布与回滚

## 版本规则

1. 应用代码、地图原始素材、生成文件、测试、部署工具及当前文档都必须纳入 Git。
2. 发布前必须确认工作区干净，且本地 `main` 与 GitHub `main` 的完整 SHA 相同。`release.py deploy` 会强制检查。
3. 每次发布只使用 GitHub 上的确定提交，按文件校验 SHA-256，不能把未提交本地文件混进发布包。
4. 发布目录为 `/var/www/school-map/releases/release-<SHA前12位>/`，`current` 指向当前目录；旧版保留。
5. 每次发布生成 `version.json`：提交号、UTC 部署时间、源码地址和全部公开静态文件校验值。它是部署产物，不写回 Git，避免提交号自引用。
6. 发布/回滚成功后在服务器 `/var/www/school-map/release-history.jsonl` 追加记录。早期发布通过 `previous-*` 文件保留回滚指向。
7. 文档更新也要提交和推送。需要三处提交号完全一致时，文档提交同样发布，不能声称“已上线”而没有核对。
8. 不 force-push `main`，不移动已有 release 标签；修复建立新提交、新 release。回滚只切服务器链接，不重写 Git 历史。

## 已核对的起点

建立此流程前，本地工作区干净，GitHub main 和线上对应 `9cad850701b0f27af74e93fe677bd779e3d57510`；28 个上线静态文件 SHA-256 全部与本地相同。旧发布目录为 `release-9cad850`，可作为回滚目标。后续版本以线上 `/version.json` 和发布记录为准，不在文档中反复手工维护“最新 SHA”。

## 正常发布

```sh
# 在项目根目录工作
python3 scripts/prepare-maps.py  # 仅更新素材/生成逻辑后需要
node --check app.js
node --test tests/positioning.test.mjs tests/gestures.test.mjs

git status --short
git diff --check
git diff
# 选择并核对本次文件，再提交；不要无审查地加入密钥或本地环境文件
git add <本次文件>
git commit -m "Describe the resulting behavior"
git push origin main

python3 scripts/release.py deploy
python3 scripts/release.py check
```

发布工具会重复执行必要的 JS 语法和计算测试。若输入未变且之前已验证，通过该工具执行即可。若只是文档更新，也必须保持工作区干净、提交已推送。

`check` 是只读核对：工作区 → GitHub main → 服务器版本记录 → 每个静态资源哈希 → HTTPS 入口与模块 MIME。遇到任一差异会以非零状态退出；不自动覆盖或隐藏差异。

发布后还需浏览器验证公开 HTTPS 链接：

- Overview 初始完整展示原图，放大、双指缩放和拖动正常。
- G/1/2 地图、标签和共享图例正常；最小缩放显示全层。
- 首次打开自动请求浏览器位置权限；允许后定位持续更新，拒绝时有状态说明。
- 经纬度/精度/测试入口不可见，测试模式不能通过页面事件启用。
- 实测手机触摸或浏览器多点触摸事件，不能只以鼠标/普通滚轮测试代替双指缩放。

全部验证后记录不可变发布标签，例如：

```sh
git tag -a release-<SHA前12位> -m "Verified production release"
git push origin release-<SHA前12位>
```

同一标签存在时先核对指向；不得强制覆盖。GitHub main 是源码版本；release 标签代表通过上线验证的版本。

## 回滚

先读取 `release-history.jsonl` 或 `previous-*`，确认具体旧目录，不能猜测“上一版”。

```sh
# 示例：回到已经核对过的初始线上版本
python3 scripts/release.py rollback --release release-9cad850
```

工具会从 Git 中解析该目录的提交，校验服务器旧文件并切换链接；HTTPS 检查失败会恢复回滚前的链接。旧目录缺失或文件被改过时会拒绝回滚。此操作不改本地 main/GitHub main；因此回滚后 `check` 会正确报告线上与 main 不同。恢复一致时重新发布 main，或建立修复提交后发布。

## nginx 与运维边界

静态发布不需要重启 nginx，也不触碰其他网站、数据库和服务。工具在发布前校验服务器的地图 nginx 配置与 Git 中 `deploy/school-map.conf` 一致；配置不同会停止，不能静默跳过。

确需改配置时：先备份 `/etc/nginx/conf.d/school-map.conf`，只安装本项目配置，运行 `nginx -t`，成功后 reload；失败恢复备份。`.mjs` 必须以 JavaScript 类型返回，SVG/JS/CSS gzip 已配置。证书和 SSH 私钥只保留服务器/用户配置中，不能提交到 Git。

公网访问地址始终为 https://map.solvaneon.com/ 。二维码可使用 `?level=ground` 等稳定楼层链接，发布目录不是用户访问入口。

## 可重复的浏览器验收

`scripts/check-browser.cjs` 使用 Chrome 多点触摸协议实际发送两根手指的触摸序列，覆盖四个页面的捏合缩放、单指拖动、最小适配，以及公开 UI、定位更新和电脑缩放控件。该脚本也随版本提交，不依赖临时对话脚本。

需要可用的 Playwright 环境（验证依赖，不是网站运行依赖）。可通过 `PLAYWRIGHT_MODULE` 指定现有模块路径，`PLAYWRIGHT_CHANNEL=chrome` 使用已安装的 Chrome。

```sh
# 本地服务器运行时
node scripts/check-browser.cjs

# 线上同一套验收
MAP_URL=https://map.solvaneon.com/ node scripts/check-browser.cjs
```

可选 `BROWSER_SCREENSHOT` 指定截图输出路径。不要把临时截图或测试日志混入发布。
