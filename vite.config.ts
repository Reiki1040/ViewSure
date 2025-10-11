import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import fs from 'node:fs';
import path from 'node:path';

const resolveHttpsConfig = () => {
  const certDir = path.resolve(__dirname, 'certs');
  const keyPath = path.join(certDir, 'localhost-key.pem');
  const certPath = path.join(certDir, 'localhost-cert.pem');

  if (fs.existsSync(keyPath) && fs.existsSync(certPath)) {
    return {
      key: fs.readFileSync(keyPath),
      cert: fs.readFileSync(certPath)
    };
  }

  return false;
};

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    open: true,
    https: resolveHttpsConfig(),
    host: 'localhost'
  }
});
