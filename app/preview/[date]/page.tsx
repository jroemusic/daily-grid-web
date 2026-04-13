'use client';

import { use, useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function PreviewRedirect({ params }: { params: Promise<{ date: string }> }) {
  const { date } = use(params);
  const router = useRouter();

  useEffect(() => {
    router.replace(`/editor/${date}`);
  }, [date, router]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-gray-600">Redirecting to editor...</div>
    </div>
  );
}
