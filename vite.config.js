import { defineConfig } from 'vite';

const repositoryName = process.env.GITHUB_REPOSITORY?.split('/')[1];
const productionBase = repositoryName
  ? (repositoryName.endsWith('.github.io') ? '/' : `/${repositoryName}/`)
  : '/';

export default defineConfig({
  // Nama repository dibaca otomatis oleh GitHub Actions.
  base: process.env.NODE_ENV === 'production' ? productionBase : '/',
});
