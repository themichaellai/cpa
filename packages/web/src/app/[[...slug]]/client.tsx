'use client';

import { useEffect, useState } from 'react';
import App from '../../App';

export function ClientOnly() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return mounted ? <App /> : null;
}
