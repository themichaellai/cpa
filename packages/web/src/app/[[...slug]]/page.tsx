import '@radix-ui/themes/styles.css';
import '../../index.css';
import { ClientOnly } from './client';

export function generateStaticParams() {
  return [{ slug: [''] }];
}

export default function Page() {
  return <ClientOnly />;
}
