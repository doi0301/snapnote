import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { defineConfig } from 'electron-vite'
import react from '@vitejs/plugin-react'

const __dirname = dirname(fileURLToPath(import.meta.url))
const rendererRoot = resolve(__dirname, 'src/renderer')

export default defineConfig({
  main: {
    resolve: {
      alias: {
        '@shared': resolve('src/shared')
      }
    }
  },
  preload: {
    resolve: {
      alias: {
        '@shared': resolve('src/shared')
      }
    }
  },
  renderer: {
    root: rendererRoot,
    build: {
      rollupOptions: {
        input: {
          index: resolve(rendererRoot, 'index.html'),
          folded: resolve(rendererRoot, 'folded.html'),
          edit: resolve(rendererRoot, 'edit.html'),
          preview: resolve(rendererRoot, 'preview.html'),
          history: resolve(rendererRoot, 'history.html'),
          settings: resolve(rendererRoot, 'settings.html')
        }
      }
    },
    resolve: {
      alias: {
        '@renderer': resolve('src/renderer/src'),
        '@shared': resolve('src/shared')
      }
    },
    plugins: [react()]
  }
})
