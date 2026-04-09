import { App, TFile, Notice, FileSystemAdapter } from "obsidian";
import * as fs from "fs";
import * as path from "path";
import { HugoConvertSettings } from "./setting";

export class HugoConvertUtil {
	private app: App;
	private settings: HugoConvertSettings;

	constructor(app: App, settings: HugoConvertSettings) {
		this.app = app;
		this.settings = settings;
	}

	updateSettings(settings: HugoConvertSettings) {
		this.settings = settings;
	}

	/**
	 * 导出所有带blog标签的文件到Hugo目录
	 */
	async exportBlogFilesToHugo() {
		// 检查Hugo目录设置
		if (!this.settings.hugoContentDir) {
			new Notice("请先在插件设置中配置Hugo内容目录！");
			return;
		}

		// 解析Hugo目录路径
		let hugoDir = this.settings.hugoContentDir;
		if (!path.isAbsolute(hugoDir)) {
			// 如果是相对路径，将其解析为相对于Vault根目录的路径
			const vaultPath = (this.app.vault.adapter as FileSystemAdapter).getBasePath();
			hugoDir = path.join(vaultPath, hugoDir);
		}

		// 获取所有带有blog标签的文件
		const blogFiles = this.getFilesWithBlogTag();

		if (blogFiles.length === 0) {
			new Notice("未找到带有blog标签的文件！");
			return;
		}

		// 创建 blog 文件 basename 的 Set，用于双向链接检查
		const blogFileBasenames = new Set<string>();
		blogFiles.forEach(file => blogFileBasenames.add(file.basename));

		new Notice("开始导出文件到Hugo目录...");

		let successCount = 0;
		let failureCount = 0;
		const processedAttachments = new Set<string>();

		// 清空Hugo目录
		this.deleteDirectory(hugoDir);

		// 处理每个文件
		for (const file of blogFiles) {
			try {
				const hugoContent = await this.convertToHugoFormat(file, blogFileBasenames);

				const postDir = path.join(hugoDir, file.basename);

				// 确保目标目录存在
				this.ensureDirectoryExists(postDir);

				// 构建目标文件路径
				const destPath = path.join(postDir, "index.md");

				// 写入转换后的内容
				fs.writeFileSync(destPath, hugoContent, "utf8");
				successCount++;

				// 处理附件
				const attachments = this.getAttachmentsInFile(file);
				const attachmentDestDir = path.join(postDir, "images");
				this.ensureDirectoryExists(attachmentDestDir);
				for (const attachment of attachments) {
					// 避免重复处理相同的附件
					if (processedAttachments.has(attachment.path)) continue;

					// 复制附件到指定子目录
					const attachmentCopied = await this.copyAttachment(
						attachment,
						attachmentDestDir
					);
					if (attachmentCopied) {
						processedAttachments.add(attachment.path);
					}
				}
			} catch (error) {
				console.error(`处理文件 ${file.path} 失败:`, error);
				failureCount++;
			}
		}

		// 显示结果通知
		new Notice(
			`导出完成: 成功 ${successCount} 个, 失败 ${failureCount} 个\n输出路径: ${hugoDir}`
		);

	}

	/**
	 * 获取所有包含"blog"标签的文件
	 * @returns 包含所有带有blog标签的文件数组
	 */
	getFilesWithBlogTag(): TFile[] {
		const filesWithBlogTag: TFile[] = [];
		const allFiles = this.app.vault.getMarkdownFiles();

		// 解析排除目录列表
		const excludeDirs = this.settings.excludeDirs
			.split('\n')
			.map(dir => dir.trim())
			.filter(dir => dir.length > 0);

		allFiles.forEach((file) => {
			// 检查文件是否在排除目录中
			const isInExcludedDir = excludeDirs.some(dir => {
				const normalizedDir = dir.endsWith('/') ? dir : dir + '/';
				return file.path.startsWith(normalizedDir) || file.path.startsWith(dir + '/');
			});

			if (isInExcludedDir) {
				return; // 跳过排除目录中的文件
			}

			const cache = this.app.metadataCache.getFileCache(file);
			if (cache && cache?.frontmatter?.tags) {
				if (cache.frontmatter.tags.includes("blog")) {
					filesWithBlogTag.push(file);
				}
			}
		});

		return filesWithBlogTag;
	}

	/**
	 * 删除目录及其所有内容
	 * @param dirPath 目录路径
	 */
	deleteDirectory(dirPath: string) {
		if (fs.existsSync(dirPath)) {
			fs.rmSync(dirPath, { recursive: true, force: true });
		}
	}

	/**
	 * 将Obsidian格式转换为Hugo格式
	 * @param file 文件对象
	 * @returns 转换后的内容
	 */
	async convertToHugoFormat(file: TFile, blogFileBasenames: Set<string>): Promise<string> {
		const content = await this.app.vault.read(file);

		// 获取文件元数据
		const cache = this.app.metadataCache.getFileCache(file);

		// 提取标题（优先使用frontmatter中的title，否则使用文件名）
		let title = file.basename;
		if (cache?.frontmatter?.title) {
			title = cache.frontmatter.title;
		}

		// 提取标签（过滤掉#blog标签）
		const tags = cache?.frontmatter?.tags
			? cache.frontmatter.tags
					.map((tag: string) => tag.replace("#", ""))
					.filter((tag: string) => tag !== "blog")
			: [];

		// 获取创建时间和修改时间
		let created = new Date();
		let modified = new Date();
		const fileStats = await this.app.vault.adapter.stat(file.path);

		// 优先从 frontmatter 获取 createTime，否则使用文件时间
		if (cache?.frontmatter?.createTime) {
			created = new Date(cache.frontmatter.createTime);
		} else if (fileStats) {
			created = new Date(fileStats.ctime);
		}

		// 优先从 frontmatter 获取 updateTime，否则使用文件时间
		if (cache?.frontmatter?.updateTime) {
			modified = new Date(cache.frontmatter.updateTime);
		} else if (fileStats) {
			modified = new Date(fileStats.mtime);
		}

		// 格式化日期
		const dateFormat = "YYYY-MM-DDTHH:mm:ssZ";
		const formattedCreated = this.formatDate(created, dateFormat);
		const formattedModified = this.formatDate(modified, dateFormat);

		// 创建Hugo的frontmatter
		const frontmatter =
			[
				"---",
				`title: "${title.replace(/"/g, '"')}"`,
				`date: ${formattedCreated}`,
				`lastmod: ${formattedModified}`,
				...(tags.length > 0
					? [
							`tags: [${tags
								.map(
									(t: string) => `"${t.replace(/"/g, '\\"')}"`
								)
								.join(", ")}]`]
					: []),
			].join("\n") + "\n---\n\n";

		// 移除Obsidian原始frontmatter
		let hugoContent = content.replace(/^---\s*[\s\S]*?---\s*/, "");

		// 处理附件路径
		const processedAttachments = new Set<string>();
		const attachments = cache?.embeds || [];
		for (const attachment of attachments) {
			if (processedAttachments.has(attachment.link)) continue;
			// 提取文件名（去掉路径部分）
			const fileName = path.basename(attachment.link);
			hugoContent = this.replaceImagePath(hugoContent, attachment.link, `images/${fileName}`);
			processedAttachments.add(attachment.link);
		}

		// 处理双向链接
		if (this.settings.siteUrl) {
			hugoContent = this.convertWikilinks(hugoContent, file, blogFileBasenames);
		}

		return frontmatter + hugoContent;
	}

	/**
	 * 替换Markdown字符串中的图片路径
	 * @param markdownString Markdown字符串
	 * @param originalPath 原始图片路径
	 * @param newPath 新图片路径
	 * @returns 替换后的Markdown字符串
	 */
	replaceImagePath(markdownString: string, originalPath: string, newPath: string) {
		// 将原始路径中的空格转换为%20，其他字符保持不变
		const encodedPath = originalPath.replace(/\s/g, '%20');
		// 转义特殊字符，确保正则表达式能正确匹配
		const escapedOriginalPath = encodedPath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
		// 构建正则表达式
		const regex = new RegExp(`!\\[(.*?)\\]\\(${escapedOriginalPath}(.*?)\\)`, 'g');
		// 执行替换
		const encodedNewPath = newPath.replace(/\s/g, '%20');
		const replaced = markdownString.replace(regex, `![$1](${encodedNewPath}$2)`);
		return replaced;
	}

	/**
	 * 格式化日期
	 * @param date 日期对象
	 * @param format 日期格式字符串
	 * @returns 格式化后的日期字符串
	 */
	formatDate(date: Date, format: string): string {
		const year = date.getFullYear();
		const month = String(date.getMonth() + 1).padStart(2, "0");
		const day = String(date.getDate()).padStart(2, "0");
		const hours = String(date.getHours()).padStart(2, "0");
		const minutes = String(date.getMinutes()).padStart(2, "0");
		const seconds = String(date.getSeconds()).padStart(2, "0");

		// 处理时区
		const timezoneOffset = date.getTimezoneOffset();
		const timezoneSign = timezoneOffset > 0 ? "-" : "+";
		const timezoneHours = String(
			Math.abs(Math.floor(timezoneOffset / 60))
		).padStart(2, "0");
		const timezoneMinutes = String(Math.abs(timezoneOffset % 60)).padStart(
			2,
			"0"
		);
		const timezone = `${timezoneSign}${timezoneHours}:${timezoneMinutes}`;

		return format
			.replace("YYYY", year.toString())
			.replace("MM", month)
			.replace("DD", day)
			.replace("HH", hours)
			.replace("mm", minutes)
			.replace("ss", seconds)
			.replace("Z", timezone);
	}

	/**
	 * 确保目录存在，如果不存在则创建
	 * @param dirPath 目录路径
	 */
	ensureDirectoryExists(dirPath: string) {
		if (!fs.existsSync(dirPath)) {
			fs.mkdirSync(dirPath, { recursive: true });
		}
	}

	/**
	 * 获取文件中的附件列表
	 * @param file 文件对象
	 * @returns 附件文件数组
	 */
	getAttachmentsInFile(file: TFile): TFile[] {
		const attachments: TFile[] = [];
		const cache = this.app.metadataCache.getFileCache(file);

		if (cache?.embeds) {
			cache.embeds.forEach((embed) => {
				const embeddedFile = this.app.metadataCache.getFirstLinkpathDest(embed.link, file.path);
				if (embeddedFile && embeddedFile.extension !== 'md') {
					attachments.push(embeddedFile);
				}
			});
		}

		return attachments;
	}

	/**
	 * 复制附件到目标目录
	 * @param attachment 附件文件
	 * @param destDir 目标目录
	 * @returns 是否复制成功
	 */
	async copyAttachment(attachment: TFile, destDir: string) {
		try {
			// 读取附件内容（二进制）
			const content = await this.app.vault.readBinary(attachment);

			// 构建目标路径
			const destPath = path.join(destDir, attachment.name);

			// 确保目标目录存在
			this.ensureDirectoryExists(destDir);

			// 写入文件
			fs.writeFileSync(destPath, Buffer.from(content));
			return true;
		} catch (error) {
			console.error(
				`Failed to copy attachment ${attachment.path}:`,
				error
			);
			return false;
		}
	}

	/**
	 * 转换双向链接为 Hugo 网站链接
	 * @param content Markdown 内容
	 * @param currentFile 当前文件
	 * @param blogFileBasenames 所有 blog 文件的 basename Set
	 * @returns 转换后的内容
	 */
	convertWikilinks(content: string, currentFile: TFile, blogFileBasenames: Set<string>): string {
		// 匹配 [显示文本](链接.md) 格式，链接必须以 .md 结尾
		const markdownLinkRegex = /\[([^\]]+)\]\(([^)]+\.md)\)/g;

		console.log(`[HugoConvert] 处理文件 ${currentFile.path} 的双向链接，blog文件列表:`, [...blogFileBasenames]);

		return content.replace(markdownLinkRegex, (match, displayText, linkPath) => {
			// 获取链接目标的 basename（去掉 .md 扩展名）
			let linkBasename = linkPath;
			if (linkBasename.endsWith('.md')) {
				linkBasename = linkBasename.slice(0, -3);
			}
			// 处理路径中的目录部分，只保留文件名
			linkBasename = path.basename(linkBasename);

			console.log(`[HugoConvert] 发现链接: ${match} -> basename: ${linkBasename}`);

			// 检查链接目标是否在 blog 文件列表中
			if (blogFileBasenames.has(linkBasename)) {
				// 构建 Hugo 网站链接
				const siteUrl = this.settings.siteUrl.endsWith('/')
					? this.settings.siteUrl
					: this.settings.siteUrl + '/';
				const hugoLink = `${siteUrl}${linkBasename}`;

				console.log(`[HugoConvert] 转换链接: ${match} -> [${displayText}](${hugoLink})`);
				return `[${displayText}](${hugoLink})`;
			} else {
				// 链接目标不在 blog 文件列表中，输出警告日志
				console.warn(`[HugoConvert] 双向链接 "${match}" 的目标 "${linkBasename}" 未被 blog 标签标记，文件: ${currentFile.path}`);
				// 保持原样，不转换
				return match;
			}
		});
	}

}