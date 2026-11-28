import { AppData } from '../types';
import { pickRandomFrameSeed, renderEplSnapshotSync } from './projectSnapshot';

export const DEMO_PROJECT_ID = 'demo_neon_core_dash';

/**
 * Готовый стартовый мини-проект для редактора:
 * движущийся неоновый блок + управляемый куб на WASD + сбор кристалла + живой счёт.
 * Работает с первого кадра в Live Preview и легко редактируется новичком.
 */
export const STARTER_EDITOR_CODE = `started?
  create background { color=#0d1117 }
  variable { name=score, value=0 }
  variable { name=vx, value=4 }

  create text_label { name=title, text="EPL Starter — Move with WASD", x=24, y=20, color=#f3f4f6, size=18 }
  create text_label { name=hud, text="Score: {score}", x=24, y=48, color=#10b981, size=16 }

  create block { name=mover, x=140, y=130, width=96, height=24, color=#38bdf8, corner=8 }
  create circle { name=orb, x=420, y=220, radius=16, color=#f59e0b }
  create player { name=hero, x=120, y=220, width=42, height=42, color=#10b981 }
  create wasd_controls { name=ctrl, target=hero, speed=250, boundary=true }

  create button { name=boost_btn, text="+1 Bonus", x=24, y=82, width=120, height=34, color=#10b981 }
  create timer { name=loop, interval=32 }
end

timer_tick? { target=loop }
  move { target=mover, x={vx}, y=0 }
  if mover.x >= 460 then
    variable { name=vx, value=-4 }
  end
  if mover.x <= 60 then
    variable { name=vx, value=4 }
  end
end

collided? { targetA=hero, targetB=orb }
  math { target=score, op=add, value=1 }
  play_sound { sound=coin, volume=0.4 }
  move_to { target=orb, x=random(60, 500), y=random(100, 320) }
end

clicked? { target=boost_btn }
  math { target=score, op=add, value=1 }
  play_sound { sound=power, volume=0.35 }
end`;

export const FEATURED_DEMO_CODE = `started?
  create background { color=#090d16 }
  variable { name=score, value=0 }
  variable { name=best, value=0 }
  variable { name=droneDir, value=5 }

  create text_label { name=title, text="Neon Core Dash", x=28, y=20, color=#f8fafc, size=22 }
  create text_label { name=hud, text="Score: {score}   Best: {best}", x=28, y=50, color=#10b981, size=15 }
  create text_label { name=hint, text="WASD — move · Collect gold orbs · Dodge red drone", x=28, y=74, color=#94a3b8, size=12 }

  create block { name=arena_top, x=24, y=104, width=590, height=6, color=#1e293b, corner=3 }
  create block { name=arena_bottom, x=24, y=386, width=590, height=6, color=#1e293b, corner=3 }
  create block { name=wall_center, x=290, y=200, width=64, height=90, color=#1f2937, corner=12, solid=true }

  create circle { name=orb, x=490, y=220, radius=16, color=#f59e0b }
  create enemy { name=drone, x=340, y=130, width=36, height=36, color=#ef4444 }
  create player { name=hero, x=90, y=220, width=44, height=44, color=#10b981 }
  create wasd_controls { name=wasd, target=hero, speed=270, boundary=true }

  create button { name=reset_btn, text="Reset Score", x=480, y=22, width=130, height=34, color=#2563eb }
  create particle { name=core_fx, x=505, y=235, color=#f59e0b, count=10 }
  create timer { name=drone_tick, interval=30 }
end

timer_tick? { target=drone_tick }
  move { target=drone, x=0, y={droneDir} }
  if drone.y >= 340 then
    variable { name=droneDir, value=-5 }
  end
  if drone.y <= 118 then
    variable { name=droneDir, value=5 }
  end
end

collided? { targetA=hero, targetB=orb }
  math { target=score, op=add, value=10 }
  play_sound { sound=coin, volume=0.45 }
  if score > best then
    variable { name=best, value={score} }
  end
  move_to { target=orb, x=random(60, 560), y=random(120, 340) }
end

collided? { targetA=hero, targetB=drone }
  variable { name=score, value=0 }
  play_sound { sound=hit, volume=0.45 }
  shake { intensity=6, duration=200 }
  move_to { target=hero, x=80, y=220 }
end

clicked? { target=reset_btn }
  variable { name=score, value=0 }
  play_sound { sound=click, volume=0.35 }
end`;

export const FEATURED_DEMO_APP: AppData = {
  id: DEMO_PROJECT_ID,
  title: 'Neon Core Dash',
  description:
    'Интерактивная мини-игра на EPL: управление WASD, сбор энергетических сфер, патрулирующий дрон, частицы и живой HUD. Откройте код в редакторе и измените любую механику за секунду.',
  code: FEATURED_DEMO_CODE,
  version: '1.2.0',
  category: 'games',
  price: 0,
  authorId: 'epl_official_demo',
  authorName: 'EPL Studio',
  isVerified: true,
  supportedPlatforms: ['web', 'windows', 'macos', 'linux'],
  iconUrl: '',
  bannerUrl: '',
  screenshotUrl: '',
  likes: 128,
  dislikes: 2,
  downloads: 940,
  visits: 1840,
  rating: 4.9,
  createdAt: '2026-11-01T10:00:00.000Z',
  updatedAt: '2026-11-01T10:00:00.000Z',
  allowCopy: true,
  status: 'verified',
};

export function getAppCoverImage(
  app: Partial<AppData> & { category?: string },
  frameSeed?: number
): string {
  const seed = frameSeed ?? pickRandomFrameSeed(app.id || app.title);
  if (app.code && app.code.trim()) {
    return renderEplSnapshotSync(app.code, {
      title: app.title,
      category: app.category,
      seed,
    });
  }
  if (app.screenshotUrl && app.screenshotUrl.trim()) return app.screenshotUrl;
  if (app.bannerUrl && app.bannerUrl.trim()) return app.bannerUrl;
  return renderEplSnapshotSync('', {
    title: app.title,
    category: app.category,
    seed,
  });
}

export function getAppCardDescription(app: Partial<AppData>, language: string): string {
  const raw = (app.description || '').trim();
  const placeholderSet = new Set(['test', 'тест', 'my app', 'a cool app written in epl.', '']);
  if (raw && !placeholderSet.has(raw.toLowerCase())) {
    return raw;
  }

  const isSite = Boolean(app.isWebsite || app.websiteDomain);
  if (isSite) {
    return language === 'ru'
      ? 'Интерактивный веб-сайт на EPL с доменом .epl и мгновенным запуском в браузере.'
      : 'Interactive .epl website built in EPL Studio and ready to open directly in browser.';
  }

  const cat = String(app.category || '').toLowerCase();
  if (cat === 'games') {
    return language === 'ru'
      ? 'Интерактивная игра на языке EPL с мгновенным запуском и открытой сценой.'
      : 'Interactive game built with EPL Studio with instant browser launch.';
  }
  if (cat === 'ai' || cat === 'programming language' || cat === 'custom editor') {
    return language === 'ru'
      ? 'Инструмент разработчика и ИИ-сценарий на языке EPL.'
      : 'Developer tool and interactive script powered by EPL.';
  }
  return language === 'ru'
    ? 'Приложение на языке EPL — запустите онлайн или откройте страницу проекта.'
    : 'Application built with EPL — launch directly in browser or inspect project details.';
}
