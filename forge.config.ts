// Node built-ins (import first for ESLint import/order)
import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

import { MakerSquirrel } from '@electron-forge/maker-squirrel';
import { MakerZIP } from '@electron-forge/maker-zip';
import { VitePlugin } from '@electron-forge/plugin-vite';
import type { ForgeConfig } from '@electron-forge/shared-types';

// Factory-default Electron Forge configuration (Vite template)
// No custom makers or extra plugins – lets Forge decide the best defaults.

/**
 * Build launcher and reorganize output structure
 */
const buildLauncherAndReorganize = (buildPath: string, platform: string): void => {
  if (platform !== 'win32') {
    console.log(`Skipping launcher build for platform: ${platform}`);
    return;
  }

  console.log('Building C++ launcher...');

  try {
    // Try to build launcher with available compiler
    const launcherDir = path.join(__dirname, 'launcher');
    const launcherSource = path.join(launcherDir, 'main.cpp');
    const launcherOutput = path.join(launcherDir, 'imapviewer.exe');

    if (!fs.existsSync(launcherSource)) {
      console.warn('Launcher source not found, skipping launcher build');
      return;
    }

    // Try g++ first (MinGW-w64)
    try {
      execSync('where g++', { stdio: 'ignore' });
      execSync(`g++ -std=c++17 -O2 -static -static-libgcc -static-libstdc++ -o imapviewer.exe main.cpp -luser32`, {
        cwd: launcherDir,
        stdio: 'pipe'
      });
      console.log('✓ Launcher built with g++');
    } catch {
      // Try MSVC
      try {
        execSync('where cl', { stdio: 'ignore' });

        // Use cmd to setup MSVC environment and compile
        const msvcCommand = `cmd /c "call "C:\\Program Files (x86)\\Microsoft Visual Studio\\2022\\BuildTools\\VC\\Auxiliary\\Build\\vcvars64.bat" >nul 2>&1 && cl /std:c++17 /O2 /EHsc /MT main.cpp /Fe:imapviewer.exe user32.lib kernel32.lib >nul 2>&1"`;

        execSync(msvcCommand, {
          cwd: launcherDir,
          stdio: 'pipe'
        });
        console.log('✓ Launcher built with MSVC');
      } catch (error) {
        console.warn('⚠ No C++ compiler found, skipping launcher build');
        console.warn('Error:', error instanceof Error ? error.message : String(error));
        return;
      }
    }

    // Reorganize build structure
    console.log('Reorganizing build structure...');

    const systemDir = path.join(buildPath, 'app');
    const originalExe = path.join(buildPath, 'imapviewer.exe');

    // Create app directory
    if (!fs.existsSync(systemDir)) {
      fs.mkdirSync(systemDir, { recursive: true });
    }

    // Move original executable to app directory
    if (fs.existsSync(originalExe)) {
      fs.renameSync(originalExe, path.join(systemDir, 'imapviewer.exe'));
      console.log('✓ Moved original executable to app/');
    }

    // Move system files to extra
    const systemFiles = [
      'chrome_100_percent.pak', 'chrome_200_percent.pak', 'd3dcompiler_47.dll',
      'ffmpeg.dll', 'icudtl.dat', 'libEGL.dll', 'libGLESv2.dll', 'resources.pak',
      'snapshot_blob.bin', 'v8_context_snapshot.bin', 'vk_swiftshader.dll',
      'vk_swiftshader_icd.json', 'vulkan-1.dll', 'LICENSE', 'LICENSES.chromium.html', 'version'
    ];

    const systemDirs = ['locales', 'resources'];

    [...systemFiles, ...systemDirs].forEach(item => {
      const itemPath = path.join(buildPath, item);
      if (fs.existsSync(itemPath)) {
        fs.renameSync(itemPath, path.join(systemDir, item));
        console.log(`✓ Moved ${item} to app/`);
      }
    });

    // Remove Squirrel.exe from portable version
    const squirrelPath = path.join(buildPath, 'Squirrel.exe');
    if (fs.existsSync(squirrelPath)) {
      fs.unlinkSync(squirrelPath);
      console.log('✓ Removed Squirrel.exe (installer files are separate)');
    }

    // Copy launcher to root
    if (fs.existsSync(launcherOutput)) {
      fs.copyFileSync(launcherOutput, path.join(buildPath, 'imapviewer.exe'));
      console.log('✓ Copied launcher as main executable');
    }

    console.log('✅ Build reorganization completed successfully!');

  } catch (error) {
    console.error('❌ Error during launcher build/reorganization:', error);
    // Don't throw - let the build continue even if launcher fails
  }
};

const config: ForgeConfig = {
  packagerConfig: {
    asar: false, // Temporarily disable .asar packaging to debug "Finalizing package" hang
    prune: true,
    // Exclude glue dump directory from being copied into the final app
    ignore: [
      /src in txt([/\\]|$)/,
      /launcher([/\\]|$)/, // Exclude launcher source from being packaged
    ],
  },
  rebuildConfig: {},
  makers: [
    new MakerSquirrel({}) /* Windows installer */,
    new MakerZIP({}, ['darwin', 'linux']) /* simple zip for non-Windows */,
  ],
  plugins: [
    new VitePlugin({
      build: [
        {
          entry: 'src/main.ts',
          config: 'vite.main.config.mjs',
        },
        {
          entry: 'src/preload.ts',
          config: 'vite.preload.config.mjs',
        },
      ],
      renderer: [
        {
          name: 'main_window',
          config: 'vite.renderer.config.mjs',
        },
      ],
    }),
  ],
  hooks: {
    postMake: async (_config, makeResults) => {
      console.log('🔧 PostMake hook triggered!');
      console.log('Make results:', makeResults.map(r => ({ platform: r.platform, arch: r.arch, artifacts: r.artifacts })));

      // Find Windows build output and reorganize
      const winResult = makeResults.find(result =>
        result.platform === 'win32' && result.arch === 'x64'
      );

      if (winResult) {
        console.log('Found Windows result:', winResult.platform, winResult.arch);

        // Look for the packaged app directory
        const outDir = path.join(__dirname, 'out');
        const appDir = path.join(outDir, 'imapviewer-win32-x64');

        console.log('Looking for app directory:', appDir);
        console.log('Directory exists:', fs.existsSync(appDir));

        if (fs.existsSync(appDir)) {
          console.log('🚀 Starting launcher build and reorganization...');
          buildLauncherAndReorganize(appDir, 'win32');
        } else {
          console.log('❌ App directory not found');
        }
      } else {
        console.log('❌ No Windows result found');
      }
    },
  },
};

export default config;
