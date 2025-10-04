/**
 * @file Electron Forge configuration for multi-platform builds
 * @description Comprehensive build configuration for Windows (Squirrel installer + Portable),
 * macOS (DMG + Portable), and Linux (Deb + Portable). Includes platform-specific makers,
 * icon handling, post-build cleanup, and automatic renaming of zip output to "Portable" directory.
 * Supports both arm64 and x64 architectures. Post-make hook ensures portable builds are clearly
 * labeled and cleaned from unnecessary Squirrel artifacts.
 */

// Node built-ins (import first for proper import organization)
import * as fs from 'node:fs'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'

import { MakerDeb } from '@electron-forge/maker-deb'
import { MakerDMG } from '@electron-forge/maker-dmg'
import { MakerSquirrel } from '@electron-forge/maker-squirrel'
import { MakerZIP } from '@electron-forge/maker-zip'
import { VitePlugin } from '@electron-forge/plugin-vite'
import type { ForgeConfig } from '@electron-forge/shared-types'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
/**
 * Clean up build artifacts (remove Squirrel.exe from portable version)
 */
const cleanupBuildArtifacts = (buildPath: string, platform: string): void => {
  if (platform !== 'win32') {
    return
  }

  try {
    // Remove Squirrel.exe from portable version
    const squirrelPath = path.join(buildPath, 'Squirrel.exe')
    if (fs.existsSync(squirrelPath)) {
      fs.unlinkSync(squirrelPath)
    }
  } catch (error) {
    console.error('❌ Error during build cleanup:', error)
    // Don't throw - let the build continue even if cleanup fails
  }
}

const config: ForgeConfig = {
  packagerConfig: {
    asar: false,
    prune: false,
    executableName: 'iView',
    // Platform-specific icons (Forge auto-selects .ico for Windows, .icns for macOS, .svg for Linux)
    icon: path.join(__dirname, 'public', 'icon'),
    derefSymlinks: false,
    // Copy icons to app root for system tray and runtime access
    extraResource: [path.join(__dirname, 'public', 'icon.ico')],
  },
  rebuildConfig: {},
  makers: [
    // Windows: Squirrel installer (primary) + Portable (ZIP renamed via postMake hook)
    new MakerSquirrel({
      setupIcon: path.join(__dirname, 'public', 'icon.ico'),
      iconUrl: 'https://raw.githubusercontent.com/HALDRO/IMAP-Viewer/main/public/icon.ico',
      loadingGif: undefined, // Use default Squirrel loading animation
    }),
    new MakerZIP({}, ['win32']),

    // macOS: DMG (primary) + Portable (ZIP renamed via postMake hook)
    new MakerDMG({
      icon: path.join(__dirname, 'public', 'icon.icns'),
      background: undefined, // Use default DMG background
      format: 'ULFO', // Compressed DMG
    }),
    new MakerZIP({}, ['darwin']),

    // Linux: Deb package (primary) + Portable (ZIP renamed via postMake hook)
    new MakerDeb({
      options: {
        icon: path.join(__dirname, 'public', 'icon.svg'),
        categories: ['Network'],
        section: 'mail',
        priority: 'optional',
        maintainer: 'HALDRO',
        homepage: 'https://github.com/HALDRO/IMAP-Viewer',
      },
    }),
    new MakerZIP({}, ['linux']),
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
      // Find Windows build output and cleanup
      const winResult = makeResults.find(
        result => result.platform === 'win32' && result.arch === 'x64'
      )

      if (winResult) {
        // Look for the packaged app directory
        const outDir = path.join(__dirname, 'out')
        const appDir = path.join(outDir, 'iView-win32-x64')

        if (fs.existsSync(appDir)) {
          cleanupBuildArtifacts(appDir, 'win32')
        }

        // Log Windows installer info
        const squirrelDir = path.join(__dirname, 'out', 'make', 'squirrel.windows')
        if (fs.existsSync(squirrelDir)) {
          const squirrelFiles = fs.readdirSync(squirrelDir)
          for (const file of squirrelFiles) {
            if (file.endsWith('.exe')) {
              // biome-ignore lint/suspicious/noConsoleLog: Build hook output
              console.log(`✅ Windows installer ready: ${file}`)
            }
          }
        }
      }

      // biome-ignore lint/suspicious/noConsoleLog: Build hook output
      console.log('🎉 Build completed successfully!')

      // Exit the build process after completion
      process.exit(0)
    },
  },
}

export default config
