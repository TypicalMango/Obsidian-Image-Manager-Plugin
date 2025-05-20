import { Plugin, TFile } from 'obsidian';

export default class ImageCleanerPlugin extends Plugin {
  async onload() {
    console.log('Loading Image Cleaner…');
    await this.cleanupImages();
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
      const regex = /!\[\[?([^)\]\.]+\.(?:png|jpe?g|gif|svg|bmp|webp))\]?]?/gi;
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
}
