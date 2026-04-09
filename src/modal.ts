import { App, Modal, Setting } from "obsidian";
import { HugoConvertSettings } from "./setting";

export class ConfirmModal extends Modal {
	private settings: HugoConvertSettings;
	private blogFileCount: number;
	private onConfirm: () => void;

	constructor(
		app: App,
		settings: HugoConvertSettings,
		blogFileCount: number,
		onConfirm: () => void
	) {
		super(app);
		this.settings = settings;
		this.blogFileCount = blogFileCount;
		this.onConfirm = onConfirm;
	}

	onOpen() {
		const { contentEl } = this;

		contentEl.createEl("h2", { text: "确认导出" });

		// 显示配置信息
		const infoContainer = contentEl.createDiv();
		infoContainer.style.marginBottom = "20px";

		infoContainer.createEl("p", {
			text: `待导出博客文件数量: ${this.blogFileCount}`,
		});

		infoContainer.createEl("p", {
			text: `Hugo 内容目录: ${this.settings.hugoContentDir}`,
		});

		if (this.settings.siteUrl) {
			infoContainer.createEl("p", {
				text: `目标网站 URL: ${this.settings.siteUrl}`,
			});
		}

		const excludeDirs = this.settings.excludeDirs
			.split("\n")
			.map((dir) => dir.trim())
			.filter((dir) => dir.length > 0);

		if (excludeDirs.length > 0) {
			infoContainer.createEl("p", {
				text: `排除目录: ${excludeDirs.join(", ")}`,
			});
		} else {
			infoContainer.createEl("p", {
				text: `排除目录: 无`,
			});
		}

		if (this.settings.afterExportCommands) {
			const cmdContainer = infoContainer.createDiv();
			cmdContainer.createEl("p", { text: "导出后执行命令:" });
			const cmdPre = cmdContainer.createEl("pre");
			cmdPre.style.backgroundColor = "var(--background-primary-alt)";
			cmdPre.style.padding = "10px";
			cmdPre.style.borderRadius = "5px";
			cmdPre.style.whiteSpace = "pre-wrap";
			cmdPre.style.wordBreak = "break-all";
			cmdPre.setText(this.settings.afterExportCommands);
		}

		// 警告信息
		const warningEl = contentEl.createEl("p", {
			text: "⚠️ 注意: 导出前会清空目标目录，请确认配置正确！",
		});
		warningEl.style.color = "var(--text-warning)";
		warningEl.style.fontWeight = "bold";

		// 按钮容器
		new Setting(contentEl)
			.addButton((btn) =>
				btn
					.setButtonText("取消")
					.onClick(() => {
						this.close();
					})
			)
			.addButton((btn) =>
				btn
					.setButtonText("确认导出")
					.setCta()
					.onClick(() => {
						this.close();
						this.onConfirm();
					})
			);
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}
}