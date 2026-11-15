> **历史归档，请勿作为当前状态或发布操作依据。** 本文记录 2026-10-15 初期交接，包含尚未建站时的描述。当前功能见 [README.md](README.md)，版本和发布见 [docs/releases.md](docs/releases.md)。

# 学校地图网页项目：开发与服务器部署交接

更新日期：2026-10-15。本文供新 GitHub 仓库及新 Codex 对话直接接手使用。

## 1. 目标与当前进度

在现有阿里云服务器上额外部署一个供学校项目使用的地图网页，代码放在用户随后创建的独立 GitHub 仓库中，并在新对话中继续完善。

本次仅整理交接文档，已通过 SSH 只读核实服务器；尚未创建仓库、开发页面、添加 DNS、签发新证书或部署新站点。

尚未确定：学校项目主题与评分要求、地图覆盖区域、展示的数据、地图交互、访问域名、是否需要登录或数据库。下文 `school-map` 和 `map.solvaneon.com` 都是建议命名，不代表已经存在或获选。

## 2. 已核实的服务器信息

| 项目 | 当前值 |
| --- | --- |
| 云服务器 | 阿里云 ECS，公网 IP `118.31.225.213` |
| 操作系统 | Alibaba Cloud Linux 3.2104 U13.4 |
| 资源 | 2 核，约 1.8 GiB 内存，无 Swap；根盘 40 GB，剩余约 32 GB |
| SSH | 本机执行 `ssh solvaneon`，用户 root，端口 22 |
| SSH 私钥路径 | 本机 `~/.ssh/solvaneon_codex_new`，旧密钥已作废 |
| nginx | 1.24.0，systemd 服务 `nginx` 当前 active |
| Node / pnpm | Node v22.23.2、pnpm 10.15.1；pnpm 路径 `/usr/local/bin/pnpm` |
| Git / rsync | `/usr/bin/git` 存在；本次 `command -v rsync` 未找到可执行文件 |
| 已有公网网站 | `https://solvaneon.com`，80 跳转 443 |
| 已有后端 | `127.0.0.1:8787`，开发服务另占 `127.0.0.1:8788` |
| 其他监听端口 | SSH 22、nginx 80/443；未监听 8443 |

若 SSH 别名丢失，本机可执行：

```bash
ssh -i ~/.ssh/solvaneon_codex_new root@118.31.225.213
```

上述路径仅指向私钥，本文不包含任何私钥、密码、Token 或 API 密钥。新对话若换机器，需由用户自行准备授权访问方式，不要把密钥上传 GitHub。

### 已有业务的位置与保护边界

- 生产项目：`/opt/solvaneon-server`，systemd 服务 `solvaneon`，运行用户 `solvaneon`。
- 开发项目：已有文档记载为 `/opt/solvaneon-dev`，端口 8788；本次核实了端口监听，未检查该目录内容。
- 已有数据库：文档记载在 `/var/lib/solvaneon/data`；不要用于学校项目。
- nginx 配置：`/etc/nginx/conf.d/solvaneon-80.conf`、`/etc/nginx/conf.d/solvaneon.conf`。
- 现有证书：`/etc/nginx/ssl/solvaneon.com.crt`、`/etc/nginx/ssl/solvaneon.com.key`。
- ACME：`/root/.acme.sh`，HTTP-01 webroot 为 `/var/www/acme`。现有配置注释记载自动续期；本次未单独验证定时任务或续期执行结果。
- 不修改已有 `.env`、数据库、认证逻辑和代理路由；不停止现有服务；新站点使用独立目录和独立 nginx 配置。

**以线上状态为准：** 现有 nginx 配置记载 2026-09-25 备案通过并切换 443。旧 README 中“备案审核中、80/443 关闭、公网 8443”的内容已过时。新增域名的备案接入、DNS 和证书要求仍应按最终域名核对，不能据此假设任意新域名均已可用。

## 3. 推荐实现方案

优先使用 React + TypeScript + Vite，地图用 Leaflet；如需要大量矢量数据、倾斜或自定义地图样式，再评估 MapLibre GL JS。这是建议，新仓库尚未确定技术栈。

第一版尽量做纯静态前端，GeoJSON 或项目数据随构建产物发布，nginx 直接提供文件。无需占用后端端口、增加数据库或复用 Solvaneon API。建议在本机或 CI 构建后上传，服务器内存较小。

地图底图与数据必须明确来源、许可证、署名和额度。OpenStreetMap 标准瓦片不能当作无使用限制的免费 CDN；选定提供商后按其政策使用。浏览器端地图 Key 对访问者可见，需设置域名白名单和额度，真正的服务端密钥不能写入 `VITE_*`。学校在中国大陆或面向国内用户时，需评估底图可达性及 WGS84 / GCJ-02 / BD-09 坐标差异，不能直接混用。

建议新仓库目录：

```text
src/                  页面、地图组件、样式
public/data/          可公开的 GeoJSON / JSON
.env.example          环境变量名与示例，无真实密钥
deploy/nginx.conf     新站点 nginx 模板
docs/data-sources.md  数据来源、坐标系、许可、更新时间
README.md             本文件，并随项目推进更新
```

建议脚本：`pnpm dev`、`pnpm build`、`pnpm preview`、`pnpm typecheck`。这些是待实现接口，目前并无可运行的新项目。

## 4. 域名与 nginx 方案

建议使用独立子域名，例如 `map.solvaneon.com`，独立 nginx `server`，共用服务器 80/443。这样不会占用现有网站的路径。需先确认用户是否接受该域名；如学校要求独立域名则按学校要求调整。

部署前：

1. 确认域名可用及相应备案/接入要求；配置 A 记录指向 `118.31.225.213`。仅在 IPv6 路径实际可用时添加 AAAA。
2. 检查阿里云安全组和主机防火墙对 80/443 的访问，新前端无需开放额外端口。本次未读取安全组或防火墙规则。
3. 先添加新域名的 HTTP 配置，保留 `/.well-known/acme-challenge/` 到 `/var/www/acme`，通过 HTTP-01 申请新域名证书；检查现有 acme.sh 用法和续期部署钩子后再操作。
4. 新域名证书安装到独立文件。现有根域名证书是否包含子域名尚未检查，不可直接假设可复用。
5. 证书就绪后启用完整 HTTPS 配置；每次都先 `nginx -t`，成功后才 reload。

下面是**待替换的最终配置模板**，证书文件和站点目录存在后才能启用。建议保存为 `/etc/nginx/conf.d/school-map.conf`：

```nginx
server {
    listen 80;
    listen [::]:80;
    server_name map.solvaneon.com;

    location ^~ /.well-known/acme-challenge/ {
        root /var/www/acme;
        default_type text/plain;
    }
    location / {
        return 301 https://map.solvaneon.com$request_uri;
    }
}

server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name map.solvaneon.com;

    ssl_certificate /etc/nginx/ssl/map.solvaneon.com.crt;
    ssl_certificate_key /etc/nginx/ssl/map.solvaneon.com.key;
    ssl_protocols TLSv1.2 TLSv1.3;
    server_tokens off;

    root /var/www/school-map/current;
    index index.html;
    access_log /var/log/nginx/school-map.access.log main;
    error_log /var/log/nginx/school-map.error.log warn;

    location = /index.html {
        add_header Cache-Control "no-cache" always;
    }
    location /assets/ {
        try_files $uri =404;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
    location /data/ {
        try_files $uri =404;
    }
    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

模板按 Vite 默认哈希资源设计；若修改资源命名，不要对非哈希文件设置一年缓存。nginx 用户需能遍历站点目录和读取文件。HTTPS 页面引用的地图、字体、数据也都必须使用 HTTPS。

## 5. 发布与回滚流程

建议发布结构：

```text
/var/www/school-map/
  releases/<发布编号>/   每次构建输出的文件
  current -> releases/<发布编号>
```

首次实施时由新对话写入可审查的部署脚本，流程如下：

1. 本机新仓库安装锁定依赖、完成类型检查和构建，浏览器验证地图及数据加载。
2. 把 `dist` 打成归档，通过 `scp` 上传，再解压到新的 release 目录。服务器当前未检测到 rsync，不要默认依赖它。
3. 检查 `index.html`、资源文件和权限，记录原 `current` 指向，再用临时符号链接原子切换 `current`。
4. 首次或修改 nginx 配置时，备份相关配置，执行 `nginx -t` 后 `systemctl reload nginx`。只切换静态文件时通常无需 reload。
5. 验证新站点、刷新路由、地图操作、底图署名、移动端和资源请求，再检查已有站点健康。
6. 回滚时把 `current` 切回上一版；若改过 nginx，再恢复备份并测试后 reload。保留至少上一版，确认后再清理旧目录。

初期可以手动部署，不必先引入 CI。后续若使用 GitHub Actions，应创建仅能写本项目目录的部署身份，将密钥放 Actions Secrets，并配置 SSH known_hosts；不要把 root 私钥或现有生产密钥提交仓库。

如项目后来需要私有数据、登录或写入功能，再增加独立后端、systemd 服务、服务用户与数据目录。先检查空闲端口，仅绑定回环，由新站点 nginx 代理 `/api/`；不要占用 8787/8788。

## 6. 验证与排错

已有服务基线：

```bash
ssh solvaneon 'systemctl is-active nginx solvaneon'
ssh solvaneon 'curl -fsS http://127.0.0.1:8787/health'
ssh solvaneon 'nginx -t'
```

新站点上线后，在浏览器访问最终 HTTPS 地址，检查证书、控制台和 Network：JS/CSS、GeoJSON、瓦片均应成功；地图有实际高度，缩放、平移、点位和图层功能可用；刷新页面和深层路由可用；空数据或网络失败应有提示。

```bash
# 将域名替换成最终值；本机已有 Node 22
node -e "fetch('https://map.solvaneon.com').then(r=>console.log(r.status,r.url)).catch(console.error)"
ssh solvaneon 'tail -n 80 /var/log/nginx/school-map.error.log'
```

本机历史上访问 solvaneon 的系统 curl 曾出现 TLS reset；遇到此问题，用浏览器或 Node fetch 交叉验证，不要只据 curl 失败认定站点不可用。

常见问题：地图空白先查容器高度和瓦片请求；点位偏移检查坐标系与经纬度顺序；GeoJSON 通常使用 `[经度, 纬度]`，Leaflet 常见方法接收 `[纬度, 经度]`；JS 请求收到 HTML 时查构建 base、资源路径和 SPA fallback；403 查文件权限；域名打开旧站点时查 DNS、server_name 和 nginx 是否成功 reload。

## 7. 新对话开始时需要确认

- GitHub 新仓库链接和本机工作目录。
- 学校项目的任务说明、截止日期、交付形式与语言。
- 地图区域、默认中心点、缩放范围，展示哪些点/线/面数据。
- 数据文件或来源、字段含义、坐标系，是否包含不得公开的数据。
- 必需交互：例如筛选、搜索、弹窗、图层切换、路线、统计；不应默认全部实现。
- 最终域名与访问范围，是否有登录或数据编辑需求。
- 预算及地图供应商要求、移动端和无障碍要求。

可先完成无需这些答案的仓库骨架和基本地图验证；正式地图内容与对外部署应按用户确定的要求推进。

## 8. 可直接复制给新 Codex 对话

> 请先阅读新仓库中的 README.md，然后继续完成我的学校地图网页项目。新仓库是【填写链接】，本机目录是【填写路径】，学校要求是【粘贴任务说明】，数据是【说明文件或来源】。请检查仓库实际状态，从已有实现继续推进。
>
> 服务器是现有阿里云 ECS，本机用 `ssh solvaneon` 访问，已有 nginx 和 Solvaneon 生产业务。README 包含 2026-10-15 的只读核查结果，操作前请重新核实。请用独立仓库、站点目录和 nginx 配置部署地图页面，保留已有业务正常运行。优先本机构建、静态部署。域名暂定【填写最终选择，未定则先确认】，地图功能按学校要求实现。
>
> 不要把密钥、生产 .env 或数据库复制进新仓库。先完成可运行版本和必要验证，再按我在新对话中授权的部署范围执行；若访问受沙箱限制，正常申请所需权限。

## 9. 参考资料及可信度

- 服务器实时只读检查：系统版本、资源、端口、nginx 配置、服务状态、工具版本，核查日期见页首。
- 本机 SSH 配置：`ssh -G solvaneon`，仅提取主机、用户、端口、私钥路径。
- 本机参考仓库：`~/Projects/Solvaneon-Server`；远程仓库 `https://github.com/Photo-king/Solvaneon-Server`。
- 参考文件：该仓库 `README.md`、`deploy/`、`docs/`；历史文档与线上不一致时，以重新检查后的线上状态为准。
- 本文未检查 DNS 管理权限、阿里云安全组、地图提供商账户、学校数据和未来新仓库，不将这些视为已准备完成。

本文包含服务器 IP 和内部部署路径，适合作为个人交接资料。如果新 GitHub 仓库公开，建议将具体运维信息移至私有文档，公开 README 只保留开发、数据和一般部署步骤。
