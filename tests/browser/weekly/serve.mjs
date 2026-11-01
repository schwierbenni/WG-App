import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
const tools = createRequire(
  resolve(process.env.WG_TEST_TOOLCHAIN ?? '.tools/browser-test/package.json'),
)
let vitePath
try {
  vitePath = tools.resolve('vite')
} catch {
  vitePath = tools.resolve('vite', {
    paths: [dirname(tools.resolve('vitest/package.json'))],
  })
}
const { createServer } = await import(pathToFileURL(vitePath))
const local = createRequire(resolve('package.json'))
const { default: tailwind } = await import(
  pathToFileURL(local.resolve('@tailwindcss/postcss'))
)
const root = resolve('.')
const server = await createServer({
  configFile: false,
  root: resolve('tests/browser/weekly'),
  cacheDir: resolve('.tools/weekly-vite-cache'),
  resolve: {
    alias: {
      '@': root,
      'next-auth/react': resolve('tests/browser/weekly/session.js'),
      'next/navigation': resolve('tests/browser/weekly/navigation.js'),
    },
  },
  css: { postcss: { plugins: [tailwind()] } },
  esbuild: { jsx: 'automatic' },
  server: {
    host: '127.0.0.1',
    port: 3096,
    strictPort: true,
    fs: { allow: [root] },
  },
})
await server.listen()
console.log('Weekly duty fixture: http://127.0.0.1:3096')
