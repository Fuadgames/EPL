import React, { useEffect, useState } from 'react';
import { AppData } from '../types';
import {
  captureEplProjectSnapshotAsync,
  pickRandomFrameSeed,
  renderEplSnapshotSync,
} from '../lib/projectSnapshot';

interface ProjectSnapshotImgProps {
  app: Partial<AppData> & { code?: string; title?: string; category?: string };
  seed?: number;
  className?: string;
  alt?: string;
}

export default function ProjectSnapshotImg({
  app,
  seed,
  className = 'w-full h-full object-cover',
  alt,
}: ProjectSnapshotImgProps) {
  const effectiveSeed = seed ?? pickRandomFrameSeed(app.id || app.title);
  const code = app.code || '';

  const [src, setSrc] = useState<string>(() => {
    if (code.trim()) {
      return renderEplSnapshotSync(code, {
        title: app.title,
        category: app.category,
        seed: effectiveSeed,
      });
    }
    return app.screenshotUrl || app.bannerUrl || renderEplSnapshotSync('', { title: app.title, seed: effectiveSeed });
  });

  useEffect(() => {
    let cancelled = false;
    if (!code.trim()) {
      setSrc(
        app.screenshotUrl ||
          app.bannerUrl ||
          renderEplSnapshotSync('', { title: app.title, seed: effectiveSeed })
      );
      return;
    }

    setSrc(
      renderEplSnapshotSync(code, {
        title: app.title,
        category: app.category,
        seed: effectiveSeed,
      })
    );

    captureEplProjectSnapshotAsync(code, {
      title: app.title,
      category: app.category,
      seed: effectiveSeed,
    })
      .then((realFrame) => {
        if (!cancelled && realFrame) {
          setSrc(realFrame);
        }
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [code, app.title, app.category, app.screenshotUrl, app.bannerUrl, effectiveSeed]);

  return (
    <img
      src={src}
      alt={alt || app.title || 'Project Snapshot'}
      className={className}
      referrerPolicy="no-referrer"
    />
  );
}
