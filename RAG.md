你是一名资深全栈工程师 + AI产品工程师。

请为「人生导演（Life's Director）」构建一个完整的产品级原型系统，包含：

1. 后端RAG系统（Supabase + embedding + LLM）
---------------------------------------
【全流程】：
用户输入新故事
      ↓
前端调用 /rag API
      ↓
后端生成 input embedding
      ↓
从 Supabase 获取该用户所有 stories
      ↓
计算相似度（cosine similarity）
      ↓
选出 Top-K（相关记忆）
      ↓
构建 Prompt（RAG核心）
      ↓
调用 LLM（GPT）
      ↓
返回增强后的故事 + 相关记忆

---------------------------------------
【目标】
实现一个完整的后端RAG系统（Retrieval-Augmented Generation），具备：

1. 用户人生记忆存储（Supabase）
2. embedding向量生成与存储
3. 语义检索（相似度计算）
4. 基于上下文的大模型生成
5. 标准API接口（供前端调用）

---------------------------------------
【技术栈】

- Node.js（ESM）
- Express
- Supabase（PostgreSQL）
- OpenAI API：
  - text-embedding-3-small（embedding）
  - gpt-4o-mini（生成）

---------------------------------------
【项目结构要求】

请生成如下结构：

backend/
├── server.js
├── config/
│   └── env.js
├── services/
│   ├── embeddingService.js
│   ├── ragService.js
│   ├── llmService.js
│   └── memoryService.js
├── utils/
│   ├── similarity.js
│   └── logger.js
├── routes/
│   ├── ragRoutes.js
│   └── storyRoutes.js
└── lib/
    └── supabaseClient.js

---------------------------------------
【数据库结构（Supabase）】

表：stories

字段（已在表中增加embedding字段）
---------------------------------------
【核心功能模块】

---------------------------------------
1️⃣ memoryService（数据层）

功能：

- addStory（新增故事 + embedding）
- getUserStories（获取用户所有记忆）

---------------------------------------
2️⃣ embeddingService

功能：

- getEmbedding(text)

调用 OpenAI embedding API

---------------------------------------
3️⃣ similarity 工具

实现：

- cosineSimilarity(a, b)

---------------------------------------
4️⃣ ragService（核心）

流程：

- 输入：userInput + userId
- 获取 embedding
- 从数据库取用户数据
- 计算相似度
- 选 Top-K（默认3）
- 构建 context
- 返回 relatedStories + context

---------------------------------------
5️⃣ llmService

功能：

- generateStory(prompt)

调用 GPT API

---------------------------------------
6️⃣ Prompt设计（必须实现）

构建函数：

buildPrompt(userInput, relatedStories)

要求：

- 使用“人生故事整理助手”人设
- 输出温暖、有陪伴感
- 不编造事实
- 结合历史记忆补全内容

---------------------------------------
【API设计】

---------------------------------------
1️⃣ POST /story/add

功能：

新增故事

流程：

- 生成 embedding
- 存入 Supabase

请求：

{
  userId,
  content,
  tags,
  year
}

---------------------------------------
2️⃣ POST /rag/run

功能：

执行RAG

流程：

- embedding
- 检索
- 构建prompt
- 调用LLM
- 返回结果

请求：

{
  userId,
  userInput
}

返回：

{
  original,
  enhanced,
  relatedStories
}

---------------------------------------
【工程要求】

必须做到：

- 使用 async/await
- 每个模块职责清晰
- 所有API带错误处理
- 使用环境变量（API KEY不可写死）
- 所有函数写清晰注释
- 控制台日志清晰（方便调试）

---------------------------------------
【输出要求】

请按顺序输出：

1. server.js
2. env.js
3. supabaseClient.js
4. 所有 services 文件
5. utils 文件
6. routes 文件

每个文件必须完整、可运行。

不要省略代码。
不要写伪代码。
不要只写结构。

---------------------------------------

现在开始生成完整代码。