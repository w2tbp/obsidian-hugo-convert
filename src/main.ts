import { Plugin } from "obsidian";
import {
	HugoConvertSettings,
	DEFAULT_SETTINGS,
	HugoConvertSettingTab,
} from "./setting";
import { HugoConvertUtil } from "./util";

export default class HugoConvert extends Plugin {
	settings: HugoConvertSettings;
	private ribbonIconEl: HTMLElement | null = null;
	private util: HugoConvertUtil;

	async onload() {
		await this.loadSettings();

		this.util = new HugoConvertUtil(this.app, this.settings);

		this.updateRibbonIcon();

		this.addCommand({
			id: "export-blog-files-to-hugo",
			name: "Export blog files to Hugo",
			callback: async () => {
				await this.util.exportBlogFilesToHugo();
			},
		});

		this.addSettingTab(new HugoConvertSettingTab(this.app, this));

		console.log("Hugo Exporter plugin loaded!");
	}

	onunload() {
		console.log("Hugo Exporter plugin unloaded!");
	}

	async loadSettings() {
		this.settings = Object.assign(
			{},
			DEFAULT_SETTINGS,
			await this.loadData()
		);

		if (this.util) {
			this.util.updateSettings(this.settings);
		}
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	updateRibbonIcon() {
		// 首先移除已有的ribbon图标（如果存在）
		if (this.ribbonIconEl) {
			this.ribbonIconEl.remove();
			this.ribbonIconEl = null;
		}

		// 只有当enableRibbon为true时才创建ribbon图标
		if (this.settings.enableRibbon) {
			this.ribbonIconEl = this.addRibbonIcon(
				"book-copy",
				"hugo convert",
				async (evt: MouseEvent) => {
					await this.util.exportBlogFilesToHugo();
				}
			);
			this.ribbonIconEl.addClass("hugo-convert-ribbon-class");
		}
	}
}
