## 部署到 Vercel

### 必填环境变量（Vercel Project → Settings → Environment Variables）

服务端（API）
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `DASHSCOPE_API_KEY`
- `DASHSCOPE_BASE_URL`（北京：`https://dashscope.aliyuncs.com/compatible-mode/v1`）
- `DASHSCOPE_EMBEDDING_MODEL`（`text-embedding-v4`）
- `DASHSCOPE_EMBEDDING_DIMENSIONS`（建议 `1024`）
- `DASHSCOPE_CHAT_MODEL`（`qwen3.5-plus`）

前端（构建时）
- `VITE_USE_BACKEND`：`true`

可选
- `BACKEND_TOKEN`（如果启用鉴权）
- `VITE_BACKEND_TOKEN`（与 `BACKEND_TOKEN` 一致）

### Supabase 数据库

确保 `public.stories` 有 `embedding vector(1024)` 列，并且已创建 `ivfflat` 索引。

