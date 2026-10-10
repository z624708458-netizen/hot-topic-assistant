# Cloudflare 后端部署准备（暂不连接模型）

当前用户已有 Cloudflare 账号，尚未开通 OpenAI API。本版本可以**先部署后端，不需要任何 API Key**。默认模型关闭，生成和改稿保持禁用，不回退模板。GitHub Pages、新闻、第二大脑、评分及既有数据不受影响。

## 最简单的部署方式：控制台粘贴单文件

1. 登录已有的 [Cloudflare 控制台](https://dash.cloudflare.com/)，进入 Workers & Pages，创建 Worker，选择 Hello World / Start with Hello World（控制台按钮名称可能略有变化），名称可用 `hot-topic-speech`。使用免费计划即可，不需要购买套餐或绑定 OpenAI。
2. 打开 Worker 的 Edit code（编辑代码），打开仓库里的 [worker.bundle.mjs](https://github.com/z624708458-netizen/hot-topic-assistant/blob/main/server/worker.bundle.mjs)，点击 Raw 查看完整文件，将**全部代码**复制替换编辑器中原有代码，点击 Deploy。这个文件已经包含依赖；不需要安装软件、下载 ZIP 或授权 GitHub。
3. 打开 `https://你的Worker地址.workers.dev/health`。应显示 `backend_ready: true`、`configured: false` 和“当前未连接大模型，无法生成高质量口播”。这表示后端就绪，**不代表模型已连接**。如果地址尚未启用，在 Worker 的 Settings → Domains & Routes 中启用 workers.dev。
4. 返回热点雷达，打开选题详情 → 口播生成器 → 连接大模型 / 设置，只填写 Worker 根地址（不加 `/health`），**应用访问码留空**，检查连接。网页显示“后端已就绪；当前未连接大模型”，生成按钮继续禁用。

可以把 Worker 的公开地址提供给开发者核对。不要发送账号密码、API Key 或应用访问码。当前开发环境没有 Cloudflare 登录授权，因此仓库推送不会替你实际部署 Worker。

### 现在无需配置的内容

不需要 OpenAI 账号、OpenAI API Key、应用访问码、KV、数据库或付费服务。默认允许网页来源为 `https://z624708458-netizen.github.io`。即使意外设置了 Key，未显式开启 `MODEL_ENABLED` 也不会调用模型。健康检查只检查后端和配置，不上传新闻或知识库。

## 日后开通 API 再启用

这是后续步骤，**当前不执行**。OpenAI API 与 ChatGPT 订阅独立，调用可能产生费用。开通后先设置项目预算与提醒，再在 Worker Settings → Variables and Secrets 添加：

| 名称 | 类型 | 设置 |
| --- | --- | --- |
| OPENAI_API_KEY | Secret | 自己的 OpenAI 项目 Key，只放服务端 |
| APP_ACCESS_TOKEN | Secret | 至少24字符随机应用访问码，与 OpenAI Key 不同 |
| MODEL_ENABLED | 文本 | `true`（最后再开启；默认关闭） |
| OPENAI_MODEL | 文本，可选 | 默认 `gpt-4.1-mini`，需项目有权限 |
| ALLOWED_ORIGIN | 文本，可选 | 默认 `https://z624708458-netizen.github.io` |
| MODEL_PROVIDER | 文本，可选 | 默认 `openai` |

保存并部署后，在网页填写服务地址和**应用访问码**。Key永远不输入网页、聊天或 GitHub。访问码仅在本页内存；刷新需重新输入。localStorage 仅保存服务地址。

`/health` 不消耗模型额度；即使配置与访问码通过，也不证明 Key 实际有效。实际生成报错会明确提示并保留旧稿。`/generate` 和每个改稿按钮各调用一次模型。切换时长不自动调用。所选新闻、历史样稿、观点与风险记录在生成时才发送至 Worker 和 OpenAI。

## 维护和可重复构建

源码是 `server/worker.mjs`，公共输入输出契约是 `assets/speech-contract.js`，单文件由以下命令生成（无依赖）：

```sh
node server/build-worker.mjs
node server/build-worker.mjs --check
```

单文件已提交仓库，测试检查与源码完全一致。之后修改源码需要重新生成，然后在 Cloudflare 控制台重新粘贴和部署；**这种手动部署不会随 GitHub 推送自动更新**。GitHub Pages 继续按原工作流自动更新。

熟悉 CLI 时也可使用 `server/wrangler.toml`，`MODEL_ENABLED = "false"` 已设置；当前无需运行登录或部署命令。

## 服务边界

- 公开 `/health` 仅返回就绪信息，不泄露秘密。浏览器跨域仅允许指定 Origin。生成接口要求显式开启模型、服务端 Key 和正确应用访问码。
- 固定调用 OpenAI 官方 Responses API，预留 `providers` 接口，不接受任意上游地址，不抓取输入新闻 URL。
- 输入格式/体积限制、请求超时、输出格式/逐字证据校验、每隔离实例每 IP 每分钟10次辅助限流。限流不是全局额度保障，后续仍需 OpenAI 预算。
- 不使用 KV/数据库存储新闻或素材，不记录请求正文或 Key，不回传上游错误。OpenAI 请求 `store:false` 不等于其数据保留政策为零。
- 历史全文用于风格参考，旧事实不视为当前事实；证据检查无法替代人工事实核对，也不保证平台放行。

## 测试

在仓库根目录：

```sh
node --test tests/rules.test.js tests/brain.test.js tests/brain41.test.js tests/speech.test.js tests/speech-server.test.mjs
python3 -m unittest discover -s tests -p 'test_*.py' -v
```

所有模型响应都是明确标识的 TEST ONLY 测试数据，没有调用真实模型。真实口播质量和费用需要后续 API 接通后验收。
