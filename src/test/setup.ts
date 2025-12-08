import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

afterEach(() => {
  cleanup();
});

import.meta.env.VITE_API_BASE_URL = 'http://localhost:8000';
import.meta.env.VITE_API_BASE_WS_URL = 'ws://localhost:8000';
import.meta.env.VITE_S3_URL = 'http://localhost:9000';
import.meta.env.VITE_ATTACHMENT_BASE_URL = 'http://localhost:9000/attachments';
import.meta.env.VITE_REFRESH_INTERVAL = '3600000';
import.meta.env.DEV = true;

