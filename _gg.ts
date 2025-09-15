/**
 * @file _gg.ts
 * @description "Gen Glue" script. It performs two tasks:
 * 1. Concatenates project source files into `src in txt/all_src_files.txt`.
 * 2. Generates a high-level project map `_PROJECT_MAP.md` from @file descriptions.
 * It also watches for file changes to regenerate both outputs.
 *
 * Usage: `bun run _gg.ts` or `ts-node _gg.ts`
 */

import fs from 'fs';
import path from 'path';
import chalk from 'chalk';
import { glob } from 'glob';

// --- Configuration (Unified) ---
interface ScriptConfig {
  rootDir: string;
  includePatterns: string[];
  excludePatterns: string[];
  
  // For Glue file
  glueOutputDir: string;
  glueOutputFile: string;
  glueSeparator: string;
  
  // For Map file
  mapOutputFile: string;
  
  // For Watcher
  ignoreFiles: string[];
}

const CONFIG: ScriptConfig = {
  rootDir: process.cwd(),
  includePatterns: [
    'src/**/*.ts',
    'src/**/*.tsx',
    // Added root-level configuration & environment files
    '.env*',
    'components.json',
    'Dockerfile',
    'docker-compose*',
    'package.json',
    'tsconfig.json',
    'vitest*',
  ],
  excludePatterns: [
    '**/node_modules/**',
    '**/*.d.ts',
    '**/*.test.ts',
    '**/*.spec.ts',
    '**/dist/**',
    '**/.next/**',
    '**/coverage/**',
    '**/public/**',
    '**/*.config.js',
    '**/*.config.ts',
    '**/*.setup.ts',
    '**/generated/**',
    '**/migrations/**',
    '**/SettingButton/**',
    '**/plugins/**',
    '**/definitions/**',
    //'**/ui/**',
  ],
  
  // Glue settings
  glueOutputDir: 'src in txt',
  glueOutputFile: 'all_src_files.txt',
  glueSeparator: '\n\n---\n\n',

  // Map settings
  mapOutputFile: '_PROJECT_MAP.md',

  // Watcher settings
  ignoreFiles: ['_PROJECT_MAP.md', '_gg.ts'], 
};

// --- Simplified Data Structures for Map ---
interface FileInfo {
  relativePath: string;
  /** The single-line description extracted from the @file tag. */
  description: string;
}

interface ProjectStats {
  fileCount: number;
  totalLines: number;
  totalChars: number;
  estimatedTokens: number;
}

// --- Glue Logic ---

/** Ensures that the output directory exists */
function ensureDirExists(dir: string) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

/**
 * Reads all source files and concatenates them into a single string.
 */
async function generateAndWriteGlueFile(files: string[]) {
  console.log(chalk.cyan(`[${new Date().toLocaleTimeString()}] Generating glue file...`));
  
  const content = files
    .sort()
    .map((relativePath) => {
      const absPath = path.join(CONFIG.rootDir, relativePath);
      const content = fs.readFileSync(absPath, 'utf-8');
      return `// FILE: ${relativePath}\n\n${content}`;
    })
    .join(CONFIG.glueSeparator);
  
  const outDirAbs = path.join(CONFIG.rootDir, CONFIG.glueOutputDir);
  ensureDirExists(outDirAbs);

  const outFileAbs = path.join(outDirAbs, CONFIG.glueOutputFile);
  fs.writeFileSync(outFileAbs, content, 'utf-8');
  
  console.log(chalk.green(`[${new Date().toLocaleTimeString()}] ✓ Glue file written to ${path.relative(CONFIG.rootDir, outFileAbs)}`));
}

// --- Map Logic ---

/**
 * Parses a source file to extract the `@file` description from its header comment.
 */
function extractFileDescription(filePath: string): string {
  try {
    // Read only the first 8kb of the file for performance.
    const buffer = Buffer.alloc(8192);
    const fd = fs.openSync(filePath, 'r');
    fs.readSync(fd, buffer, 0, 8192, 0);
    fs.closeSync(fd);
    const content = buffer.toString('utf-8');

    // Regex helpers
    const jsDocBlocksRegex = /\/\*\*[\s\S]*?\*\//g;
    const tagRegexFactory = (tag: string) => new RegExp(`@${tag}\\s+([^\\r\\n]*)(?:\\r?\\n\\s*\\*\\s*([^\\r\\n]+))?`);

    const blocks = content.match(jsDocBlocksRegex);
    if (!blocks) return 'No description found.';

    const formatDesc = (line1: string, line2?: string, hasMore?: boolean) => {
      let text = line1.trim();
      if (line2) text += `. ${line2.trim()}`;
      // Skip adding lengthy per-file markers; legend will explain truncation
      return text;
    };

    for (const block of blocks) {
      // Helper to detect if more description lines exist beyond captured two
      const hasExtraLines = (startIdx: number) => {
        const rest = block.slice(startIdx).split(/\r?\n/).slice(1); // lines after first captured line
        let count = 0;
        for (const l of rest) {
          const trimmed = l.trim();
          if (trimmed.startsWith('*')) {
            const contentPart = trimmed.slice(1).trim();
            if (contentPart.startsWith('@')) break; // another tag starts
            if (contentPart.length === 0) continue; // empty line in description
            count += 1;
            if (count >= 1) return true; // at least one extra beyond second captured
          } else break;
        }
        return false;
      };

      // 1) @description preferred
      const descRegex = tagRegexFactory('description');
      const descMatch = block.match(descRegex);
      if (descMatch && descMatch.index !== undefined && descMatch[1]) {
        const more = hasExtraLines(descMatch.index!);
        return formatDesc(descMatch[1], descMatch[2], more);
      }
      // 2) fallback to @file
      const fileRegex = tagRegexFactory('file');
      const fileMatch = block.match(fileRegex);
      if (fileMatch && fileMatch.index !== undefined && fileMatch[1]) {
        const more = hasExtraLines(fileMatch.index!);
        return formatDesc(fileMatch[1], fileMatch[2], more);
      }
    }

    return 'No description found.';
  } catch (error) {
    console.warn(chalk.yellow(`Could not read or parse header for ${filePath}.`));
    return 'Error reading file header.';
  }
}

/**
 * Formats the collected file information into a compact Markdown map.
 */
function formatProjectMapToMarkdown(files: FileInfo[], stats: ProjectStats): string {
  const DESCRIPTION_CHAR_LIMIT = 140;
  const trimDescription = (desc: string): string => {
    if (desc.length <= DESCRIPTION_CHAR_LIMIT) return desc;
    return desc.slice(0, DESCRIPTION_CHAR_LIMIT).replace(/\s+\S*$/, '').trim() + '…';
  };

  const formatStat = (num: number) => {
    if (num < 1000) return `${num}`;
    if (num < 1_000_000) return `~${Math.round(num / 1000)}k`;
    return `~${(num / 1_000_000).toFixed(1)}M`;
  };

  const fLines = formatStat(stats.totalLines);
  const fChars = formatStat(stats.totalChars);
  const fTokens = formatStat(stats.estimatedTokens);

  let md = `# Metacharts Project Map (High-Level Index)\n`;
  md += `# Auto-generated: ${new Date().toISOString()}\n`;
  md += `# Purpose: Provides a high-level overview for AI navigation and developer onboarding.\n`;
  md += `# Stats: ${stats.fileCount} files, ${fLines} lines, ${fChars} chars, ~${fTokens} tokens\n\n`;
  md += `> Legend: An ellipsis (\u2026) at the end of a description means it was truncated. Read the file for full details.\n\n`;

  const filesByDir = new Map<string, FileInfo[]>();
  for (const file of files) {
    const dir = path.dirname(file.relativePath).replace(/\\/g, '/');
    if (!filesByDir.has(dir)) {
      filesByDir.set(dir, []);
    }
    filesByDir.get(dir)!.push(file);
  }

  const sortedDirs = [...filesByDir.keys()].sort();

  for (const dir of sortedDirs) {
    md += `## \`${dir}/\`\n`;
    const filesInDir = filesByDir.get(dir)!;
    filesInDir.sort((a, b) => a.relativePath.localeCompare(b.relativePath));

    for (const file of filesInDir) {
      const fileName = path.basename(file.relativePath);
      md += `- \`${fileName}\`: ${trimDescription(file.description)}\n`;
    }
    md += '\n';
  }

  return md.trim();
}

/**
 * Scans files, extracts descriptions, and writes the map.
 */
function generateAndWriteMapFile(filePaths: string[]) {
  console.log(chalk.cyan(`[${new Date().toLocaleTimeString()}] Generating project map...`));

  const fileInfos: FileInfo[] = [];
  let totalLines = 0;
  let totalChars = 0;
  for (const fileName of filePaths) {
    const absolutePath = path.join(CONFIG.rootDir, fileName);
    try {
      const content = fs.readFileSync(absolutePath, 'utf-8');
      totalLines += content.split('\n').length;
      totalChars += content.length;
    } catch (e) {
      // Ignore read errors, will be handled by other parts of the script
    }

    const description = extractFileDescription(absolutePath);
    fileInfos.push({
      relativePath: fileName.replace(/\\/g, '/'),
      description: description,
    });
  }
  const stats: ProjectStats = {
    fileCount: filePaths.length,
    totalLines,
    totalChars,
    estimatedTokens: Math.round(totalChars / 4),
  };

  const markdownContent = formatProjectMapToMarkdown(fileInfos, stats);
  fs.writeFileSync(path.join(CONFIG.rootDir, CONFIG.mapOutputFile), markdownContent, 'utf-8');

  console.log(chalk.green(`[${new Date().toLocaleTimeString()}] ✓ Project map written to ${CONFIG.mapOutputFile}`));
}

// --- Main Execution & Watcher ---

/**
 * The main regeneration process. Scans files and runs both generators.
 */
async function runFullRegeneration() {
  const startTime = Date.now();
  console.log(chalk.blueBright(`\n--- Starting Full Regeneration ---`));

  const fileNames = await glob(CONFIG.includePatterns, {
    cwd: CONFIG.rootDir,
    ignore: CONFIG.excludePatterns,
    nodir: true,
  });
  
  if (fileNames.length === 0) {
    console.warn(chalk.yellow('No source files matched the provided patterns. Nothing to do.'));
    return;
  }

  await generateAndWriteGlueFile(fileNames);
  generateAndWriteMapFile(fileNames);

  const duration = (Date.now() - startTime) / 1000;
  console.log(chalk.blueBright(`--- ✓ Regeneration finished in ${duration.toFixed(2)}s. Found ${fileNames.length} files. ---\n`));
}

async function getFileStats(): Promise<Map<string, number>> {
  const statsMap = new Map<string, number>();
  const files = await glob(CONFIG.includePatterns, {
    cwd: CONFIG.rootDir,
    ignore: [...CONFIG.excludePatterns, ...CONFIG.ignoreFiles.map(f => `**/${f}`)],
    nodir: true,
    absolute: true,
  });
  for (const file of files) {
    try {
      statsMap.set(file, fs.statSync(file).mtimeMs);
    } catch (e) {
      /* ignore files that might be deleted during scan */
    }
  }
  return statsMap;
}

async function main() {
  await runFullRegeneration();

  console.log(chalk.blue(`Watching for file changes. Press Ctrl+C to stop.`));

  let previousStats = await getFileStats();
  let isRunning = false;

  const poll = async () => {
    if (isRunning) return;

    const currentStats = await getFileStats();
    let changed = false;

    if (currentStats.size !== previousStats.size) {
      changed = true;
    } else {
      for (const [file, mtime] of currentStats.entries()) {
        if (previousStats.get(file) !== mtime) {
          changed = true;
          break;
        }
      }
    }

    if (changed) {
      isRunning = true;
      await runFullRegeneration();
      previousStats = await getFileStats();
      isRunning = false;
    }

    setTimeout(poll, 2500);
  };

  setTimeout(poll, 2500);
}

main().catch((e: Error) => console.error(chalk.red('Critical error in main execution:'), e)); 