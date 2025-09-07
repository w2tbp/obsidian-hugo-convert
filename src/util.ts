import { App, TFile, Notice } from "obsidian";
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
			const vaultPath = this.app.vault.adapter.basePath;
			hugoDir = path.join(vaultPath, hugoDir);
		}

    // 获取所有带有blog标签的文件
		const blogFiles = this.getFilesWithBlogTag();

		if (blogFiles.length === 0) {
			new Notice("未找到带有blog标签的文件！");
			return;
		}

    // const confirmMessage = `即将清空目录：${hugoDir}\n此操作将删除该目录中的所有文件，是否继续？`;
    // if (!confirm(confirmMessage)) {
    //     new Notice("导出操作已取消");
    //     return;
    // }

    new Notice("开始导出文件到Hugo目录...");

		let successCount = 0;
		let failureCount = 0;
		const processedAttachments = new Set<string>();

    // 清空Hugo目录
    this.deleteDirectory(hugoDir);

		// 处理每个文件
		for (const file of blogFiles) {
			try {
				const hugoContent = await this.convertToHugoFormat(file);
				
				console.log(file)

				const postDir = path.join(hugoDir, file.basename);

				// 确保目标目录存在
				this.ensureDirectoryExists(postDir);

				// 构建目标文件路径
				const destPath = path.join(postDir, "index.md");

				// 写入转换后的内容
				fs.writeFileSync(destPath, hugoContent, "utf8");
				successCount++;
				console.log(`成功写入到路径: ${destPath} `);

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

		allFiles.forEach((file) => {
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
	async convertToHugoFormat(file: TFile): Promise<string> {
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
		if (fileStats) {
			created = new Date(fileStats.ctime);
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
      const escapedLink = attachment.link.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      hugoContent = hugoContent.replace(new RegExp(escapedLink, 'g'), `images/${fileName}`);
      processedAttachments.add(attachment.link);
    }

		return frontmatter + hugoContent;
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
	
}
