import fs from 'fs';
import path from 'path';
import JSZip from 'jszip';
import {
  extractConfigFromScript,
  extractPhotoSlots,
  extractHtmlTitle,
  updateScriptWithConfig,
  updatePhotoInHtml,
  updateHtmlTitle,
  PhotoSlot,
} from './templateParser';

export interface TemplateSummary {
  id: string; // e.g., "template_birthday/birthday_template_1"
  category: string; // e.g., "template_birthday"
  categoryLabel: string; // e.g., "Birthday"
  name: string; // e.g., "birthday_template_1"
  displayName: string; // e.g., "Spider-Man Superhero Celebration"
  title: string;
  thumbnail: string | null;
  hasConfig: boolean;
  imageCount: number;
  lastModified: string;
  isClientOrder?: boolean;
}

export interface TemplateDetail {
  category: string;
  name: string;
  title: string;
  config: Record<string, any> | null;
  configVarName: string | null;
  photoSlots: PhotoSlot[];
  availableImages: { name: string; path: string; url: string; size: number }[];
  rawFiles: {
    'index.html': string;
    'app.js': string;
    'script.js': string;
    'customize.js': string;
    'style.css': string;
  };
}

export function getTemplatesRoot(): string {
  // If run inside memou_controller_website, parent directory is PROJECT MEMOu
  return path.resolve(process.cwd(), '..');
}

export function getClientsRoot(): string {
  return path.join(getTemplatesRoot(), 'client_orders');
}

/**
 * Format category directory name to human friendly label
 */
function formatCategoryLabel(dirName: string): string {
  if (dirName.startsWith('template_')) {
    const raw = dirName.replace('template_', '');
    return raw.charAt(0).toUpperCase() + raw.slice(1);
  }
  return dirName;
}

/**
 * Format template directory name to human friendly title
 */
function formatTemplateTitle(templateName: string, titleFromHtml?: string): string {
  if (titleFromHtml && titleFromHtml.trim()) {
    return titleFromHtml.replace(/[^\w\s\u00C0-\u024F\u1E00-\u1EFF!?,.-]/g, '').trim();
  }
  return templateName
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

/**
 * Scans all template categories and sub-templates
 */
export async function listTemplates(): Promise<TemplateSummary[]> {
  const root = getTemplatesRoot();
  const results: TemplateSummary[] = [];

  if (!fs.existsSync(root)) return results;

  const entries = await fs.promises.readdir(root, { withFileTypes: true });

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    // Skip node_modules, .git, and controller itself
    if (
      entry.name === 'memou_controller_website' ||
      entry.name.startsWith('.') ||
      entry.name === 'node_modules'
    ) {
      continue;
    }

    const isTemplateCategory = entry.name.startsWith('template_');
    const isClientOrderDir = entry.name === 'client_orders';

    if (!isTemplateCategory && !isClientOrderDir) continue;

    const categoryPath = path.join(root, entry.name);
    const subEntries = await fs.promises.readdir(categoryPath, { withFileTypes: true });

    for (const sub of subEntries) {
      if (!sub.isDirectory() || sub.name.startsWith('.')) continue;

      const templatePath = path.join(categoryPath, sub.name);
      const indexPath = path.join(templatePath, 'index.html');
      const scriptPath = path.join(templatePath, 'script.js');
      const customizePath = path.join(templatePath, 'customize.js');
      const assetsImgPath = path.join(templatePath, 'assets', 'images');

      if (!fs.existsSync(indexPath)) continue;

      let htmlContent = '';
      try {
        htmlContent = await fs.promises.readFile(indexPath, 'utf-8');
      } catch (e) {}

      let scriptContent = '';
      if (fs.existsSync(scriptPath)) {
        try {
          scriptContent = await fs.promises.readFile(scriptPath, 'utf-8');
        } catch (e) {}
      }

      const htmlTitle = extractHtmlTitle(htmlContent);
      const configInfo = extractConfigFromScript(scriptContent);

      let imageCount = 0;
      let thumbnail: string | null = null;

      if (fs.existsSync(assetsImgPath)) {
        try {
          const imgFiles = await fs.promises.readdir(assetsImgPath);
          const validImgs = imgFiles.filter((f) =>
            /\.(jpe?g|png|gif|webp|svg)$/i.test(f)
          );
          imageCount = validImgs.length;
          if (validImgs.length > 0) {
            thumbnail = `/api/preview/${entry.name}/${sub.name}/assets/images/${validImgs[0]}`;
          }
        } catch (e) {}
      }

      const stat = await fs.promises.stat(indexPath);

      results.push({
        id: `${entry.name}/${sub.name}`,
        category: entry.name,
        categoryLabel: isClientOrderDir ? 'Client Order' : formatCategoryLabel(entry.name),
        name: sub.name,
        displayName: formatTemplateTitle(sub.name, htmlTitle),
        title: htmlTitle,
        thumbnail,
        hasConfig: Boolean(configInfo),
        imageCount,
        lastModified: stat.mtime.toISOString(),
        isClientOrder: isClientOrderDir,
      });
    }
  }

  return results;
}

/**
 * Get complete details for a single template
 */
export async function getTemplateDetails(
  category: string,
  templateName: string
): Promise<TemplateDetail | null> {
  const root = getTemplatesRoot();
  const templatePath = path.join(root, category, templateName);

  if (!fs.existsSync(templatePath)) return null;

  const indexPath = path.join(templatePath, 'index.html');
  const scriptPath = path.join(templatePath, 'script.js');
  const customizePath = path.join(templatePath, 'customize.js');
  const stylePath = path.join(templatePath, 'style.css');
  const assetsImgPath = path.join(templatePath, 'assets', 'images');

  const htmlContent = fs.existsSync(indexPath)
    ? await fs.promises.readFile(indexPath, 'utf-8')
    : '';
  const scriptContent = fs.existsSync(scriptPath)
    ? await fs.promises.readFile(scriptPath, 'utf-8')
    : '';
  const styleContent = fs.existsSync(stylePath)
    ? await fs.promises.readFile(stylePath, 'utf-8')
    : '';

  const htmlTitle = extractHtmlTitle(htmlContent);
  const configInfo = extractConfigFromScript(scriptContent);
  const photoSlots = extractPhotoSlots(htmlContent);

  const availableImages: { name: string; path: string; url: string; size: number }[] = [];
  if (fs.existsSync(assetsImgPath)) {
    try {
      const files = await fs.promises.readdir(assetsImgPath);
      for (const file of files) {
        if (/\.(jpe?g|png|gif|webp|svg)$/i.test(file)) {
          const filePath = path.join(assetsImgPath, file);
          const stat = await fs.promises.stat(filePath);
          availableImages.push({
            name: file,
            path: `assets/images/${file}`,
            url: `/api/preview/${category}/${templateName}/assets/images/${file}`,
            size: stat.size,
          });
        }
      }
    } catch (e) {}
  }

  return {
    category,
    name: templateName,
    title: htmlTitle,
    config: configInfo ? configInfo.config : null,
    configVarName: configInfo ? configInfo.varName : null,
    photoSlots,
    availableImages,
    rawFiles: {
      'index.html': htmlContent,
      'script.js': scriptContent,
      'app.js': scriptContent,
      'customize.js': scriptContent,
      'style.css': styleContent,
    },
  };
}

/**
 * Save updated template settings, config, and HTML
 */
export async function saveTemplateDetails(
  category: string,
  templateName: string,
  payload: {
    title?: string;
    config?: Record<string, any>;
    configVarName?: string;
    photoUpdates?: { slotId: string; newSrc: string }[];
    rawFiles?: {
      'index.html'?: string;
      'script.js'?: string;
      'app.js'?: string;
      'customize.js'?: string;
      'style.css'?: string;
    };
  }
): Promise<boolean> {
  const root = getTemplatesRoot();
  const templatePath = path.join(root, category, templateName);

  if (!fs.existsSync(templatePath)) return false;

  const indexPath = path.join(templatePath, 'index.html');
  const scriptPath = path.join(templatePath, 'script.js');
  const appPath = path.join(templatePath, 'app.js');
  const customizePath = path.join(templatePath, 'customize.js');
  const stylePath = path.join(templatePath, 'style.css');

  // 1. Raw files direct overwrite mode
  if (payload.rawFiles) {
    if (payload.rawFiles['index.html'] !== undefined) {
      await fs.promises.writeFile(indexPath, payload.rawFiles['index.html'], 'utf-8');
    }
    if (payload.rawFiles['script.js'] !== undefined) {
      await fs.promises.writeFile(scriptPath, payload.rawFiles['script.js'], 'utf-8');
    }
    if (payload.rawFiles['app.js'] !== undefined) {
      await fs.promises.writeFile(appPath, payload.rawFiles['app.js'], 'utf-8');
    }
    if (payload.rawFiles['customize.js'] !== undefined) {
      await fs.promises.writeFile(customizePath, payload.rawFiles['customize.js'], 'utf-8');
    }
    if (payload.rawFiles['style.css'] !== undefined) {
      await fs.promises.writeFile(stylePath, payload.rawFiles['style.css'], 'utf-8');
    }
    return true;
  }

  // 2. Structured form save mode
  // A. Update script.js with new config
  if (payload.config && payload.configVarName && fs.existsSync(scriptPath)) {
    const currentScript = await fs.promises.readFile(scriptPath, 'utf-8');
    const updatedScript = updateScriptWithConfig(
      currentScript,
      payload.configVarName,
      payload.config
    );
    await fs.promises.writeFile(scriptPath, updatedScript, 'utf-8');
  }

  // B. Update index.html title and photo slots
  if (fs.existsSync(indexPath)) {
    let currentHtml = await fs.promises.readFile(indexPath, 'utf-8');

    if (payload.title) {
      currentHtml = updateHtmlTitle(currentHtml, payload.title);
    }

    if (payload.photoUpdates && payload.photoUpdates.length > 0) {
      const currentSlots = extractPhotoSlots(currentHtml);
      for (const update of payload.photoUpdates) {
        currentHtml = updatePhotoInHtml(
          currentHtml,
          update.slotId,
          update.newSrc,
          currentSlots
        );
      }
    }

    await fs.promises.writeFile(indexPath, currentHtml, 'utf-8');
  }

  return true;
}

/**
 * Save an uploaded photo to assets/images
 */
export async function saveUploadedPhoto(
  category: string,
  templateName: string,
  fileName: string,
  buffer: Buffer
): Promise<{ path: string; url: string }> {
  const root = getTemplatesRoot();
  const assetsDir = path.join(root, category, templateName, 'assets', 'images');

  await fs.promises.mkdir(assetsDir, { recursive: true });

  // Sanitize filename
  const cleanName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
  const filePath = path.join(assetsDir, cleanName);

  await fs.promises.writeFile(filePath, buffer);

  return {
    path: `assets/images/${cleanName}`,
    url: `/api/preview/${category}/${templateName}/assets/images/${cleanName}`,
  };
}

/**
 * Duplicate a template to create a customized client order
 */
export async function cloneTemplateForClient(
  category: string,
  templateName: string,
  clientOrderName: string
): Promise<{ clientCategory: string; clientName: string }> {
  const root = getTemplatesRoot();
  const sourcePath = path.join(root, category, templateName);
  const clientDirName = 'client_orders';
  const cleanClientName = clientOrderName.replace(/[^a-zA-Z0-9_-]/g, '_').toLowerCase();
  const targetPath = path.join(root, clientDirName, cleanClientName);

  await fs.promises.mkdir(targetPath, { recursive: true });
  await copyDirectoryRecursive(sourcePath, targetPath);

  return {
    clientCategory: clientDirName,
    clientName: cleanClientName,
  };
}

/**
 * Recursively copy a directory (excluding .git)
 */
async function copyDirectoryRecursive(src: string, dest: string) {
  await fs.promises.mkdir(dest, { recursive: true });
  const entries = await fs.promises.readdir(src, { withFileTypes: true });

  for (const entry of entries) {
    if (entry.name === '.git') continue;
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      await copyDirectoryRecursive(srcPath, destPath);
    } else {
      await fs.promises.copyFile(srcPath, destPath);
    }
  }
}

/**
 * Package a template as a ZIP buffer for downloading
 */
export async function createTemplateZip(
  category: string,
  templateName: string
): Promise<Buffer> {
  const root = getTemplatesRoot();
  const templatePath = path.join(root, category, templateName);
  const zip = new JSZip();

  async function addFolderToZip(folderPath: string, zipFolder: JSZip) {
    const entries = await fs.promises.readdir(folderPath, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name === '.git') continue;
      const fullPath = path.join(folderPath, entry.name);
      if (entry.isDirectory()) {
        const subZip = zipFolder.folder(entry.name);
        if (subZip) {
          await addFolderToZip(fullPath, subZip);
        }
      } else {
        const content = await fs.promises.readFile(fullPath);
        zipFolder.file(entry.name, content);
      }
    }
  }

  await addFolderToZip(templatePath, zip);
  return await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
}
