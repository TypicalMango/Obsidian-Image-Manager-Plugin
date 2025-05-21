import { App, Plugin, TFile, PluginSettingTab, Setting } from 'obsidian';

interface MyPluginSettings {
	sweepIconEnabled: boolean;
}

const DEFAULT_SETTINGS: MyPluginSettings = {
	sweepIconEnabled: true
}

export default class ImageManagerPlugin extends Plugin {
  settings: MyPluginSettings;
  sweepRibbonIconE1: HTMLElement | null = null;

  async onload() {
    await this.loadSettings();
    console.log('Loading Image Manager...');

    // Add settings tab
    this.addSettingTab(new SampleSettingTab(this.app, this));

    // Wait till vault/layout is ready
    this.app.workspace.onLayoutReady(() => {
      // Run sweep
      this.cleanupImages().catch((e) => console.error('ImageManager failed:', e));
      // Add sweep Icon
      this.updateSweepRibbonIcon();
    })

  }

  async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

  async cleanupImages() {
    const vault = this.app.vault;
    const adapter = vault.adapter;

    // Ensure images/ folder exists
    const imagesFolder = 'images';
    if (!(await adapter.exists(imagesFolder))) {
      await vault.createFolder(imagesFolder);
      console.log(`Created folder: ${imagesFolder}/`);
    }

    // Gather all image files in vault
    const allFiles = vault.getFiles();
    const imageExts = ['.png', '.jpg', '.jpeg', '.gif', '.svg', '.bmp', '.webp'];
    const imageFiles: TFile[] = allFiles.filter((f) =>
      imageExts.some((ext) => f.path.toLowerCase().endsWith(ext))
    );

    // Move every image file into images/
    for (const img of imageFiles) {
      const destPath = `${imagesFolder}/${img.name}`;
      // Skip if already in images/
      if (img.parent?.path === imagesFolder) continue;
      // If a name collision, you might want to handle duplicates here!
      await vault.rename(img, destPath);
      console.log(`Moved ${img.path} → ${destPath}`);
    }

    // Build a set of all referenced image paths
    const mdFiles = allFiles.filter((f) => f.extension === 'md');
    const referenced = new Set<string>();
    for (const md of mdFiles) {
      const content = await vault.cachedRead(md);
      // Regex to match ![[image.png]] or ![](images/image.png) or ![](image.png)
      // const regex = /!\[\[?([^)\]\.]+\.(?:png|jpe?g|gif|svg|bmp|webp))\]?]?/gi;
      const regex = /!\[\[?([^\]\)]+?\.(?:png|jpe?g|gif|svg|bmp|webp))\]?]?/gi;
      let m: RegExpExecArray | null;
      while ((m = regex.exec(content))) {
        let ref = m[1];
        // Normalize to images/ if missing
        if (!ref.startsWith(imagesFolder + '/')) {
          ref = imagesFolder + '/' + ref;
        }
        referenced.add(ref);
      }
    }

    // Delete unreferenced images
    const updatedImages = vault.getFiles().filter((f) =>
      f.parent?.path === imagesFolder && imageExts.some((ext) => f.path.toLowerCase().endsWith(ext))
    );
    for (const img of updatedImages) {
      if (!referenced.has(img.path)) {
        await vault.delete(img, false);
        console.log(`Deleted unreferenced image: ${img.path}`);
      }
    }

    console.log('Image cleanup complete.');
  }

  updateSweepRibbonIcon() {
    if (this.settings.sweepIconEnabled) {
      if (!this.sweepRibbonIconE1) {
        this.sweepRibbonIconE1 = this.addRibbonIcon('book-image', 'Sweep images', (evt: MouseEvent) => {
          this.cleanupImages().catch((e) => console.error('ImageManager failed:', e));
        });
      }
    } else {
      if (this.sweepRibbonIconE1) {
        this.sweepRibbonIconE1.remove();
        this.sweepRibbonIconE1 = null;
      }
    }
  }
}

class SampleSettingTab extends PluginSettingTab {
	plugin: ImageManagerPlugin;

	constructor(app: App, plugin: ImageManagerPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const {containerEl} = this;

		containerEl.empty();

    new Setting(containerEl)
      .setName('Sweep Icon')
      .setDesc('Disable sweep Icon in ribbon')
      .addToggle(toggle => toggle
        .setValue(this.plugin.settings.sweepIconEnabled)
        .onChange(async (value) => {
          this.plugin.settings.sweepIconEnabled = value;
          await this.plugin.saveSettings();
          this.plugin.updateSweepRibbonIcon();
        }));
  }
}