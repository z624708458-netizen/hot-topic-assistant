# V5.1 模型服务：尚未部署，需用户授权后接通

GitHub Pages继续托管现有界面；Cloudflare Worker只负责安全调用OpenAI。Worker代码没有Key，不会因推送GitHub自动创建账号、部署Worker或调用模型。现有新闻/知识库免费功能独立运行。

## 接通前需要确认

1. 同意使用Cloudflare Workers免费计划，需要Cloudflare账号和GitHub仓库授权。日常个人使用通常适合免费额度，具体以账户实际配额为准。
2. 同意使用OpenAI API。ChatGPT订阅不等于API额度；API按用量计费，需自己的OpenAI项目、API Key和可用额度。先设置项目预算与提醒；不能承诺免费。
3. 需要服务端访问 `api.openai.com`，浏览器访问部署后具体的 `你的服务.workers.dev`。本次未访问新域名或发送真实模型请求。部署确认前不填写Key。

## 授权后的最简单部署方式

Cloudflare控制台创建Worker，选择连接Git仓库 `z624708458-netizen/hot-topic-assistant`、main分支，工作目录 `server`，部署命令 `npx wrangler deploy`。依赖由Cloudflare构建环境处理；无需改变GitHub Pages，也无需安装本地软件。Wrangler会打包引用的 `../assets/speech-contract.js`。

在Worker的Settings → Variables and Secrets设置：

| 名称 | 类型 | 设置 |
| --- | --- | --- |
| OPENAI_API_KEY | **Secret** | 自己的OpenAI项目Key，只放这里，不放仓库/网页/聊天 |
| APP_ACCESS_TOKEN | **Secret** | 自己生成的至少24字符随机应用访问码；与OpenAI Key不同 |
| ALLOWED_ORIGIN | 文本 | `https://z624708458-netizen.github.io`（没有仓库路径） |
| OPENAI_MODEL | 文本 | 默认 `gpt-4.1-mini`，需账户可用；可在服务端更换 |
| MODEL_PROVIDER | 文本，可选 | 默认 `openai`，后续可通过providers接口扩展 |

保存设置后重新部署。取得Worker HTTPS地址后，在页面“口播生成器 → 连接大模型 / 设置”填写服务地址和**应用访问码**，点击检查连接。这里不能输入OpenAI Key。访问码只留在当前页面内存，不写localStorage；刷新页面需要重新输入。服务地址可以保存在本浏览器。

`/health`只检查服务端配置是否齐全，不产生模型调用，也不证明Key有效；实际生成失败会明确提示，保留原稿。`/generate`发起一次OpenAI Responses API调用；五种改稿操作也各产生一次模型调用。切换时长不自动消费额度。

如使用CLI，授权后可在本目录运行 `npx wrangler deploy` 和 `npx wrangler secret put OPENAI_API_KEY` / `npx wrangler secret put APP_ACCESS_TOKEN`；认证需用户自己完成，Key通过交互Secret输入，禁止写在命令参数、Git或前端。

## 已实现的边界

- Key只在服务端使用；浏览器只连接自己的Worker。固定调用OpenAI官方Responses地址，不抓取用户传入的原文URL，不接受自定义上游地址。
- 精确Origin校验、应用访问码认证、输入格式/体积限制、模型请求超时和输出来源/格式校验。每个Worker隔离实例每IP每分钟10次的限制是辅助保护，**不是全局额度保障**，仍要在OpenAI设置预算。
- 请求不写KV或数据库，不记录正文/Key；响应不回传上游错误或Key。OpenAI请求设 `store:false`；这不代表OpenAI自身的数据保留政策为零。
- 新闻URL、来源、发布时间、标题、摘要和可选粘贴全文作为当前事实。相关性≥60的S/A/B作品全文最多4条；相关个人观点/写作偏好合计最多3条；相关风险记录最多3条。不足不补无关素材，全文过大直接报错，不悄悄截断。
- 历史样稿仅学习节奏、措辞习惯、开头、结构和判断方式；长句照抄会被拒绝，旧数字不会因此成为当前事实。写作策略与事件观点分别传入。
- 模型提供事实/历史观点/判断/待核实段落与逐字证据。规则验证证据确实存在、提示新增数字与风险词，但不能证明语义推导正确或平台一定放行。

## 本地验证（不需要Key、不联网到模型）

在仓库根目录：

```sh
node --test tests/speech.test.js tests/speech-server.test.mjs
python3 -m unittest discover -s tests -p 'test_speech.py' -v
```

测试响应均明确标为TEST ONLY，验证HTTP请求/Provider/前后端状态/持久化。**真实模型文稿的自然度、像不像创作者和实际费用，需接通后用本人历史稿验收；当前尚未验证。**
