'use client';

import { useEffect, useState } from 'react';
import { getUploaderName } from '@/lib/identity';
import NameGate from './NameGate';

// First-visit gate. Shows on mount when no uploaderName is stored.
// Dismissible (view-only). Upload flow has its own required gate.
export default function NameGateController() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!getUploaderName()) {
      setOpen(true);
    }
  }, []);

  return <NameGate open={open} onClose={() => setOpen(false)} />;
}
