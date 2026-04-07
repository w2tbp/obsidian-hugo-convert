# Obsidian Hugo Convert

一个 Obsidian 插件，用于将带有 `blog` 标签的 Markdown 文件导出为 Hugo 兼容的博客文章格式。

## 功能特性

- **自动扫描博客文件**：自动扫描 Obsidian 库中所有带有 `blog` 标签的 Markdown 文件
- **转换为 Hugo 格式**：将 Obsidian 格式的 Markdown 文件转换为 Hugo 兼容格式
- **Frontmatter 转换**：
  - 自动生成 Hugo frontmatter（title、date、lastmod、tags）
  - 支持 `createTime` 和 `updateTime` 属性优先获取时间信息
  - 兼容旧的 `date` 属性
  - 自动移除 `blog` 标签（因为它是隐式的）
- **附件处理**：自动复制图片等附件到目标目录，并更新引用路径
- **目录排除**：支持配置排除目录，跳过不需要导出的文件夹
- **导出确认**：导出前弹出确认对话框，展示配置信息，避免误操作
- **自定义命令**：支持配置导出后自动执行的命令（如 `hugo server`）

## 安装

### 手动安装

1. 下载 `main.js`、`manifest.json` 文件
2. 将文件复制到你的 Obsidian 库目录：`VaultFolder/.obsidian/plugins/obsidian-hugo-convert/`
3. 重启 Obsidian 并在设置中启用插件

### 开发安装

```bash
# 克隆仓库
git clone <repo-url>

# 安装依赖
npm i

# 编译（开发模式，自动监听文件变化）
npm run dev

# 编译（生产模式）
npm run build
```

## 使用方法

### 基本使用

1. 在 Obsidian 中为需要导出的 Markdown 文件添加 `blog` 标签
2. 在插件设置中配置 Hugo 内容目录
3. 通过以下方式触发导出：
   - 命令面板：执行 `Export blog files to Hugo` 命令
   - 侧边栏图标：启用侧边栏图标后点击导出（需在设置中开启）
4. 在确认对话框中查看配置信息，点击"确认导出"

### Frontmatter 属性

插件支持以下 Obsidian frontmatter 属性：

| 属性 | 说明 | 优先级 |
|------|------|--------|
| `title` | 文章标题 | 最高（若无则使用文件名） |
| `createTime` | 创建时间 | 最高 |
| `updateTime` | 修改时间 | 最高 |
| `tags` | 标签列表 | - |

### 输出结构

导出的文件结构为 Hugo 的 Page Bundle 格式：

```
hugo-content-dir/
├── 文章标题/
│   ├── index.md
│   └── images/
│       └── 图片1.png
│       └── 图片2.jpg
├── 另一篇文章/
│   ├── index.md
│   └── images/
│       └── ...
```

## 配置选项

| 选项 | 说明 | 默认值 |
|------|------|--------|
| Hugo 内容目录 | 导出目标目录，支持相对路径或绝对路径 | `./blog` |
| 启用侧边栏图标 | 在 Obsidian 侧边栏显示导出图标 | 关闭 |
| 导出后执行命令 | 导出完成后执行的命令（每行一个） | 空 |
| 排除目录 | 扫描时排除的目录（每行一个） | 空 |

### 配置示例

**排除目录：**
```
drafts
private
archived
```

**导出后执行命令：**
```
cd {hugoDir}/..
hugo server -D
```

使用 `{hugoDir}` 变量表示 Hugo 内容目录路径。

## 注意事项

- 导出前会**清空目标目录**，请确保路径正确且目录中没有重要文件
- 只有带有 `blog` 标签的文件才会被导出
- 图片等附件会复制到每篇文章的 `images/` 子目录中
- 外部图片 URL 保持不变，不会被处理

## 开发

基于 Obsidian 插件 API 开发，使用 TypeScript。

```bash
# 开发模式编译
npm run dev

# 生产模式编译
npm run build

# 类型检查
tsc -noEmit -skipLibCheck
```

## API 文档

参考 [Obsidian API 文档](https://github.com/obsidianmd/obsidian-api)