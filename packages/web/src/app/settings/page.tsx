'use client';

import '@radix-ui/themes/styles.css';
import '../../index.css';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Theme } from '@radix-ui/themes';

import { UserWrapper } from '../../store/user';
import SettingsScreen from '../../Settings';

export default function SettingsPage() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;
  return (
    <Theme accentColor="purple" hasBackground={false}>
      <UserWrapper>
        <SettingsScreen goBack={() => router.push('/')} />
      </UserWrapper>
    </Theme>
  );
}
