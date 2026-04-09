import { App, PluginSettingTab, Setting } from "obsidian";
import HugoConvert from "./main";

/**
 * 插件设置接口定义
 */
export interface HugoConvertSettings {
	enableRibbon: boolean;
	hugoContentDir: string;
	afterExportCommands: string;
	excludeDirs: string;
	siteUrl: string;
}

/**
 * 默认设置值
 */
export const DEFAULT_SETTINGS: HugoConvertSettings = {
	enableRibbon: false,
	hugoContentDir: "./blog",
	afterExportCommands: "",
	excludeDirs: "",
	siteUrl: "",
};

/**
 * 插件设置面板
 */
export class HugoConvertSettingTab extends PluginSettingTab {
	plugin: HugoConvert;

	constructor(app: App, plugin: HugoConvert) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;

		containerEl.empty();
		containerEl.createEl("h2", { text: "Hugo 导出设置" });

		new Setting(containerEl)
			.setName("Hugo 内容目录")
			.setDesc(
				"Hugo 内容目录路径，可以是绝对路径或相对于 Obsidian 库根目录的相对路径。注意：导出前会清空此目录，请确保路径正确且目录中没有重要文件！"
			)
			.addText((text) =>
				text
					.setPlaceholder("输入您的 Hugo 内容目录")
					.setValue(this.plugin.settings.hugoContentDir)
					.onChange(async (value) => {
						this.plugin.settings.hugoContentDir = value;
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName("启用侧边栏图标")
			.setDesc("在 Obsidian 侧边栏显示快速导出图标。")
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.enableRibbon)
					.onChange(async (value) => {
						this.plugin.settings.enableRibbon = value;
						await this.plugin.saveSettings();
						// 修改设置后立即更新ribbon图标显示状态
						this.plugin.updateRibbonIcon();
					})
			);

		new Setting(this.containerEl)
			.setName("目标网站 URL")
			.setDesc(
				"Hugo 网站的 URL，用于转换双向链接。例如：https://w2tbp.github.io/"
			)
			.addText((text) =>
				text
					.setPlaceholder("https://example.com/")
					.setValue(this.plugin.settings.siteUrl || "")
					.onChange(async (value) => {
						this.plugin.settings.siteUrl = value;
						await this.plugin.saveSettings();
					})
			);

		new Setting(this.containerEl)
			.setName("导出后执行命令")
			.setDesc(
				"导出后执行的命令（每行一个命令）。使用 {hugoDir} 表示 Hugo 目录路径。"
			)
			.addTextArea(
				(text) => (
					(text
						.setPlaceholder("e.g.\ncd {hugoDir}\nhugo server -D")
						.setValue(
							this.plugin.settings.afterExportCommands || ""
						)
						.onChange(async (value) => {
							this.plugin.settings.afterExportCommands = value;
							await this.plugin.saveSettings();
						}).inputEl.style.height = "120px"),
					(text.inputEl.style.width = "100%")
				)
			);

		new Setting(this.containerEl)
			.setName("排除目录")
			.setDesc(
				"扫描博客文件时排除的目录（每行一个目录，使用相对于库根目录的路径，如：drafts/private、assets/templates）。"
			)
			.addTextArea(
				(text) => (
					(text
						.setPlaceholder("e.g.\ndrafts\nprivate\narchived")
						.setValue(
							this.plugin.settings.excludeDirs || ""
						)
						.onChange(async (value) => {
							this.plugin.settings.excludeDirs = value;
							await this.plugin.saveSettings();
						}).inputEl.style.height = "100px"),
					(text.inputEl.style.width = "100%")
				)
			);
	}
}
