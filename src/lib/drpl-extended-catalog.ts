export type DrplCategoryBase = '3d' | '2d' | 'app';

export interface DrplRuntimeMeta {
  archetype: string;
  defaultColor?: string;
  secondaryColor?: string;
  w?: number;
  h?: number;
  d?: number;
  radius?: number;
  scale?: number;
  emissive?: boolean;
  spin?: number;
  bob?: boolean;
  widgetKind?: string;
  icon?: string;
  preset?: string;
}

export interface ExtendedDrplComponentSeed {
  id: string;
  name: string;
  category: DrplCategoryBase;
  subgroup: string;
  color: string;
  badge: string;
  signature: string;
  descriptionRu: string;
  descriptionEn: string;
  roleRu: string;
  roleEn: string;
  compatibleWith: string[];
  incompatibleWith: string[];
  snippet: string;
  runtimeMeta: DrplRuntimeMeta;
}

const COMPAT_3D = ['все *3d объекты', 'ui_* (HUD)', 'synth_* / sfx2d'];
const INCOMPAT_3D = ['use2d (без mode="hybrid")'];
const COMPAT_2D = ['все *2d объекты', 'ui_* (HUD)', 'synth_* / sfx2d'];
const INCOMPAT_2D = ['use3d (без mode="hybrid")'];
const COMPAT_APP = ['useapp', 'use3d / use2d (оверлей)', 'все ui_* и system узлы'];
const INCOMPAT_APP = ['нет конфликтов'];

interface DomainSpec {
  subgroup: string;
  category: DrplCategoryBase;
  color: string;
  badge: string;
  archetype: string;
  items: Array<[string, string, string, string?]>; // [name, ruTitle, enTitle, customArchetype?]
  themes?: Array<[string, string, string, string]>; // [prefix, ruAdj, enAdj, color]
  makeProps: (name: string, idx: number, color: string) => {
    sig: string;
    snippet: string;
    meta: DrplRuntimeMeta;
  };
}

const THREE_D_DOMAINS: DomainSpec[] = [
  {
    subgroup: 'Architecture',
    category: '3d',
    color: '#64748B',
    badge: 'Arch 3D',
    archetype: 'arch_tower',
    items: [
      ['tower3d', 'Сторожевая башня', 'Watchtower', 'arch_tower'],
      ['castle3d', 'Замок с башнями', 'Fortified castle', 'arch_castle'],
      ['fortress3d', 'Боевая крепость', 'Armored fortress', 'arch_castle'],
      ['bridge3d', 'Мост с перилами', 'Structural bridge', 'arch_bridge'],
      ['arch3d', 'Триумфальная арка', 'Monumental arch', 'arch_gate'],
      ['pillar3d', 'Колонна с капителью', 'Architectural pillar', 'arch_pillar'],
      ['monolith3d', 'Загадочный монолит', 'Glowing monolith', 'arch_pillar'],
      ['obelisk3d', 'Древний обелиск', 'Ancient obelisk', 'arch_pillar'],
      ['dome3d', 'Купол станции', 'Geodesic dome', 'arch_dome'],
      ['bunker3d', 'Укреплённый бункер', 'Reinforced bunker', 'arch_bunker'],
      ['hangar3d', 'Космический ангар', 'Space hangar bay', 'arch_hangar'],
      ['reactor3d', 'Энергетический реактор', 'Fusion reactor core', 'arch_reactor'],
      ['temple3d', 'Храм со ступенями', 'Stepped temple', 'arch_castle'],
      ['shrine3d', 'Святилище света', 'Illuminated shrine', 'arch_gate'],
      ['gate3d', 'Энерго-ворота', 'Energy gate portal', 'arch_gate'],
      ['vault_door3d', 'Дверь хранилища', 'Armored vault door', 'arch_gate'],
      ['stairs3d', 'Лестница на высоту', 'Modular staircase', 'arch_stairs'],
      ['ramp3d', 'Пандус-трамплин', 'Launch ramp incline', 'arch_ramp'],
      ['fence3d', 'Защитное ограждение', 'Perimeter fence', 'arch_wall'],
      ['wall3d', 'Секция стены', 'Modular wall segment', 'arch_wall'],
      ['glass_wall3d', 'Стеклянная перегородка', 'Translucent glass wall', 'arch_wall'],
      ['balcony3d', 'Смотровая площадка', 'Cantilever balcony', 'arch_bridge'],
      ['lighthouse3d', 'Маяк с прожектором', 'Beacon lighthouse', 'arch_tower'],
      ['windmill3d', 'Ветряная мельница', 'Spinning windmill', 'arch_windmill'],
      ['crane3d', 'Строительный кран', 'Tower crane rig', 'arch_crane'],
      ['billboard3d', 'Неоновый билборд', 'Neon billboard display', 'arch_sign'],
      ['neon_sign3d', 'Неоновая вывеска', 'Glowing neon sign', 'arch_sign'],
      ['antenna3d', 'Радиомачта', 'Comms antenna mast', 'arch_tower'],
      ['radar_tower3d', 'Радарная вышка', 'Rotating radar tower', 'arch_reactor'],
      ['solar_panel3d', 'Солнечная панель', 'Solar array panel', 'arch_ramp'],
      ['launchpad3d', 'Стартовая площадка', 'Rocket launchpad', 'arch_dome'],
      ['tunnel3d', 'Секция туннеля', 'Arched tunnel segment', 'arch_hangar'],
      ['corridor3d', 'Научный коридор', 'Sci-fi corridor', 'arch_hangar'],
      ['statue3d', 'Статуя-памятник', 'Heroic monument statue', 'arch_pillar'],
      ['fountain3d', 'Фонтан с чашей', 'Illuminated fountain', 'arch_dome'],
      ['pagoda3d', 'Многоярусная пагода', 'Tiered pagoda roof', 'arch_tower'],
      ['skybridge3d', 'Небесный переход', 'Elevated skybridge', 'arch_bridge'],
      ['helipad3d', 'Вертолётная площадка', 'Marked helipad', 'arch_bunker'],
      ['barricade3d', 'Тактическая баррикада', 'Tactical barrier', 'arch_wall'],
      ['road_straight3d', 'Участок дороги', 'Straight road deck', 'arch_bridge'],
      ['streetlamp3d', 'Уличный фонарь', 'Glowing streetlamp', 'arch_pillar'],
      ['kiosk3d', 'Торговый киоск', 'Street kiosk booth', 'arch_bunker'],
      ['factory3d', 'Промышленный цех', 'Industrial factory hall', 'arch_hangar'],
      ['silo3d', 'Силосная башня', 'Cylindrical storage silo', 'arch_tower'],
      ['server_rack3d', 'Серверная стойка', 'LED server rack', 'arch_pillar'],
      ['observatory3d', 'Обсерватория', 'Telescope observatory dome', 'arch_dome'],
      ['colosseum3d', 'Кольцевая арена', 'Colosseum ring wall', 'arch_dome'],
      ['throne3d', 'Тронный пьедестал', 'Royal throne dais', 'arch_stairs'],
      ['altar3d', 'Ритуальный алтарь', 'Glowing stone altar', 'arch_bunker'],
      ['container3d', 'Грузовой контейнер', 'Shipping cargo container', 'arch_bunker']
    ],
    themes: [
      ['cyber', 'Кибер', 'Cyber', '#06B6D4'],
      ['scifi', 'Фантастический', 'Sci-Fi', '#38BDF8'],
      ['medieval', 'Средневековый', 'Medieval', '#A8A29E'],
      ['neon', 'Неоновый', 'Neon', '#EC4899'],
      ['ancient', 'Древний', 'Ancient', '#D97706']
    ],
    makeProps: (name, idx, color) => {
      const x = ((idx % 7) - 3) * 6;
      const z = -6 - Math.floor(idx / 7) * 5;
      return {
        sig: `${name}(name="${name}_${idx + 1}", x=${x}, y=0, z=${z}, scale=1.0, color="${color}")`,
        snippet: `${name}(name="${name}_1", x=0, y=0, z=-8, scale=1.0, color="${color}")`,
        meta: { archetype: 'arch_tower', defaultColor: color, secondaryColor: '#10b981', scale: 1 }
      };
    }
  },
  {
    subgroup: 'Nature & Space',
    category: '3d',
    color: '#10B981',
    badge: 'Nature 3D',
    archetype: 'nature_tree',
    items: [
      ['pine_tree3d', 'Хвойная сосна', 'Evergreen pine tree', 'nature_tree'],
      ['oak_tree3d', 'Раскидистый дуб', 'Leafy oak tree', 'nature_oak'],
      ['palm_tree3d', 'Тропическая пальма', 'Tropical palm tree', 'nature_palm'],
      ['sakura_tree3d', 'Цветущая сакура', 'Blossom sakura tree', 'nature_oak'],
      ['cactus3d', 'Пустынный кактус', 'Desert saguaro cactus', 'nature_pillar'],
      ['bamboo3d', 'Бамбуковая роща', 'Tall bamboo cluster', 'nature_pillar'],
      ['mushroom3d', 'Светящийся гриб', 'Bioluminescent mushroom', 'nature_mushroom'],
      ['giant_mushroom3d', 'Гигантский гриб', 'Giant fantasy mushroom', 'nature_mushroom'],
      ['crystal_shard3d', 'Осколок кристалла', 'Single crystal shard', 'nature_crystal'],
      ['crystal_cluster3d', 'Кластер кристаллов', 'Crystal cluster formation', 'nature_crystal'],
      ['amethyst_spire3d', 'Аметистовый шпиль', 'Amethyst spire formation', 'nature_crystal'],
      ['gold_ore3d', 'Золотая руда', 'Gold ore vein rock', 'nature_rock'],
      ['boulder3d', 'Массивный валун', 'Weathered stone boulder', 'nature_rock'],
      ['cliff3d', 'Скальный утёс', 'Rocky cliff outcrop', 'nature_rock'],
      ['stalagmite3d', 'Пещерный сталагмит', 'Cave stalagmite', 'nature_crystal'],
      ['glacier3d', 'Ледяной глетчер', 'Frozen glacier shard', 'nature_crystal'],
      ['iceberg3d', 'Плавающий айсберг', 'Floating iceberg mass', 'nature_rock'],
      ['volcano3d', 'Вулкан с кратером', 'Volcano cone with magma', 'nature_volcano'],
      ['lava_pool3d', 'Озеро лавы', 'Glowing magma pool', 'nature_pool'],
      ['waterfall3d', 'Водопад потока', 'Animated waterfall', 'nature_pool'],
      ['geyser3d', 'Паровой гейзер', 'Erupting geyser vent', 'nature_pool'],
      ['coral3d', 'Коралловый риф', 'Reef coral cluster', 'nature_crystal'],
      ['cloud3d', 'Объёмное облако', 'Volumetric 3D cloud', 'nature_cloud'],
      ['storm_cloud3d', 'Грозовое облако', 'Thunder storm cloud', 'nature_cloud'],
      ['rainbow3d', 'Радужная дуга', 'Spectral rainbow arc', 'nature_ring'],
      ['sun3d', 'Пылающее солнце', 'Radiant star sun', 'nature_planet'],
      ['moon3d', 'Кратерная луна', 'Cratered lunar sphere', 'nature_planet'],
      ['planet3d', 'Планета в космосе', 'Textured orbit planet', 'nature_planet'],
      ['ringed_planet3d', 'Планета с кольцами', 'Saturn-like ringed planet', 'nature_ringed'],
      ['comet3d', 'Летящая комета', 'Icy comet with tail', 'nature_planet'],
      ['meteor3d', 'Огненный метеор', 'Glowing meteor rock', 'nature_rock'],
      ['blackhole3d', 'Чёрная дыра с диском', 'Blackhole accretion disk', 'nature_ringed'],
      ['wormhole3d', 'Космическая кротовина', 'Space warp wormhole', 'nature_ringed'],
      ['campfire3d', 'Костёр с пламенем', 'Crackling campfire logs', 'nature_fire'],
      ['torch3d', 'Факел на стойке', 'Wall/ground flaming torch', 'nature_fire'],
      ['lantern3d', 'Волшебный фонарик', 'Floating sky lantern', 'nature_fire']
    ],
    themes: [
      ['glow', 'Светящийся', 'Glowing', '#2DD4BF'],
      ['frost', 'Ледяной', 'Frost', '#38BDF8'],
      ['magma', 'Огненный', 'Magma', '#F97316'],
      ['emerald', 'Изумрудный', 'Emerald', '#10B981'],
      ['void', 'Пустотный', 'Void', '#A855F7']
    ],
    makeProps: (name, idx, color) => ({
      sig: `${name}(name="${name}_${idx + 1}", x=${((idx % 6) - 2) * 4}, y=0, z=${-6 - idx % 5 * 4}, scale=1.0, color="${color}")`,
      snippet: `${name}(name="${name}_1", x=4, y=0, z=-6, scale=1.0, color="${color}")`,
      meta: { archetype: 'nature_crystal', defaultColor: color, secondaryColor: '#facc15', scale: 1 }
    })
  },
  {
    subgroup: 'Vehicles & Craft',
    category: '3d',
    color: '#3B82F6',
    badge: 'Vehicle 3D',
    archetype: 'vehicle_car',
    items: [
      ['sports_car3d', 'Спорткар', 'Aerodynamic sports car', 'vehicle_car'],
      ['drift_car3d', 'Дрифт-болид', 'Turbo drift racer', 'vehicle_car'],
      ['truck3d', 'Грузовик', 'Heavy cargo truck', 'vehicle_truck'],
      ['police_car3d', 'Патрульная машина', 'Police interceptor', 'vehicle_car'],
      ['bus3d', 'Городской автобус', 'Transit city bus', 'vehicle_truck'],
      ['train_engine3d', 'Локомотив поезда', 'High-speed locomotive', 'vehicle_truck'],
      ['motorcycle3d', 'Супербайк', 'Sport motorcycle', 'vehicle_bike'],
      ['hoverbike3d', 'Ховербайк', 'Antigravity hoverbike', 'vehicle_bike'],
      ['hovercar3d', 'Летающее авто', 'Sci-fi hovercar', 'vehicle_ship'],
      ['rover3d', 'Планетоход', '6-wheel space rover', 'vehicle_truck'],
      ['tank3d', 'Боевой танк', 'Armored battle tank', 'vehicle_tank'],
      ['helicopter3d', 'Вертолёт с винтом', 'Spinning rotor helicopter', 'vehicle_heli'],
      ['jet3d', 'Реактивный истребитель', 'Supersonic jet fighter', 'vehicle_ship'],
      ['spaceship3d', 'Звездолёт', 'Interstellar starship', 'vehicle_ship'],
      ['ufo3d', 'Летающая тарелка НЛО', 'Glowing alien UFO saucer', 'vehicle_ufo'],
      ['rocket3d', 'Космическая ракета', 'Orbital launch rocket', 'vehicle_rocket'],
      ['drone_quad3d', 'Квадрокоптер', 'Quadcopter recon drone', 'vehicle_heli'],
      ['submarine3d', 'Подводная лодка', 'Deep sea submarine', 'vehicle_ship'],
      ['speedboat3d', 'Гоночный катер', 'Hydrofoil speedboat', 'vehicle_ship'],
      ['airship3d', 'Дирижабль', 'Steampunk airship blimp', 'vehicle_ship'],
      ['mech_heavy3d', 'Тяжёлый мех', 'Heavy combat mech', 'mech_unit'],
      ['mech_scout3d', 'Быстрый развед-мех', 'Agile scout mech', 'mech_unit'],
      ['spider_bot3d', 'Робот-паук', 'Multi-leg spider walker', 'vehicle_tank'],
      ['hoverboard3d', 'Неоновый ховерборд', 'Floating hoverboard', 'vehicle_bike']
    ],
    themes: [
      ['turbo', 'Турбо', 'Turbo', '#EF4444'],
      ['stealth', 'Стелс', 'Stealth', '#64748B'],
      ['gold', 'Золотой', 'Gold', '#FACC15'],
      ['plasma', 'Плазменный', 'Plasma', '#38BDF8']
    ],
    makeProps: (name, idx, color) => ({
      sig: `${name}(name="${name}_${idx + 1}", x=0, y=0.6, z=${4 - (idx % 5) * 3}, speed=22, color="${color}")`,
      snippet: `${name}(name="${name}_1", x=0, y=0.6, z=4, speed=22, color="${color}")`,
      meta: { archetype: 'vehicle_car', defaultColor: color, secondaryColor: '#38bdf8', scale: 1 }
    })
  },
  {
    subgroup: 'Characters & Creatures',
    category: '3d',
    color: '#A855F7',
    badge: 'Actor 3D',
    archetype: 'actor_humanoid',
    items: [
      ['knight3d', 'Рыцарь в броне', 'Armored knight hero', 'actor_humanoid'],
      ['paladin3d', 'Паладин света', 'Radiant paladin', 'actor_humanoid'],
      ['archer3d', 'Лесной лучник', 'Forest ranger archer', 'actor_humanoid'],
      ['wizard3d', 'Волшебник с посохом', 'Arcane wizard caster', 'actor_humanoid'],
      ['cyber_ninja3d', 'Кибер-ниндзя', 'Stealth cyber ninja', 'actor_humanoid'],
      ['samurai3d', 'Самурай с катаной', 'Neon blade samurai', 'actor_humanoid'],
      ['astronaut3d', 'Космонавт', 'EVA suit astronaut', 'actor_humanoid'],
      ['engineer3d', 'Инженер-техник', 'Station engineer NPC', 'actor_humanoid'],
      ['vendor3d', 'Торговец магазина', 'Shopkeeper merchant NPC', 'actor_humanoid'],
      ['robot_helper3d', 'Робот-помощник', 'Friendly companion bot', 'actor_bot'],
      ['android3d', 'Андроид', 'Synthetic android unit', 'actor_humanoid'],
      ['slime3d', 'Прыгающий слайм', 'Bouncy translucent slime', 'actor_slime'],
      ['goblin3d', 'Гоблин-налётчик', 'Goblin raider mob', 'actor_humanoid'],
      ['skeleton3d', 'Скелет-воин', 'Undead skeleton warrior', 'actor_humanoid'],
      ['ghost3d', 'Парящий призрак', 'Floating spirit ghost', 'actor_ghost'],
      ['golem3d', 'Каменный голем', 'Heavy stone golem', 'actor_golem'],
      ['phoenix3d', 'Огненный феникс', 'Blazing phoenix bird', 'actor_bird'],
      ['alien3d', 'Пришелец', 'Extraterrestrial scout', 'actor_humanoid'],
      ['pet_drone3d', 'Питомец-дрон', 'Orbiting companion drone', 'actor_bot'],
      ['pet_wolf3d', 'Кибер-волк', 'Loyal cyber wolf pet', 'actor_quad']
    ],
    themes: [
      ['shadow', 'Теневой', 'Shadow', '#6366F1'],
      ['solar', 'Солнечный', 'Solar', '#F59E0B'],
      ['frost', 'Морозный', 'Frost', '#38BDF8'],
      ['crimson', 'Багровый', 'Crimson', '#F43F5E']
    ],
    makeProps: (name, idx, color) => ({
      sig: `${name}(name="${name}_${idx + 1}", x=${((idx % 5) - 2) * 3}, y=0, z=${-4 - (idx % 4) * 3}, hp=100, color="${color}")`,
      snippet: `${name}(name="${name}_1", x=0, y=0, z=2, hp=100, color="${color}")`,
      meta: { archetype: 'actor_humanoid', defaultColor: color, secondaryColor: '#10b981', scale: 1 }
    })
  },
  {
    subgroup: 'Combat, Props & VFX',
    category: '3d',
    color: '#F43F5E',
    badge: 'VFX / Prop',
    archetype: 'fx_orb',
    items: [
      ['laser_turret3d', 'Лазерная турель', 'Automated laser turret', 'weapon_turret'],
      ['missile_pod3d', 'Ракетная установка', 'Guided missile launcher', 'weapon_turret'],
      ['shield_dome3d', 'Силовой купол', 'Protective energy dome', 'fx_dome'],
      ['forcefield3d', 'Силовой барьер', 'Translucent forcefield wall', 'arch_wall'],
      ['teleporter3d', 'Платформа телепорта', 'Glowing teleporter pad', 'fx_pad'],
      ['mine3d', 'Контактная мина', 'Blinking proximity mine', 'fx_orb'],
      ['barrel_tnt3d', 'Взрывная бочка', 'Explosive hazard barrel', 'prop_barrel'],
      ['ammo_crate3d', 'Ящик боеприпасов', 'Supply ammo crate', 'prop_crate'],
      ['medkit3d', 'Аптечка здоровья', 'Healing medkit pickup', 'prop_crate'],
      ['sword3d', 'Энергетический меч', 'Floating plasma sword', 'prop_sword'],
      ['staff3d', 'Магический посох', 'Arcane crystal staff', 'prop_sword'],
      ['coin_gold3d', 'Золотая монета', 'Spinning gold coin', 'prop_coin'],
      ['keycard3d', 'Ключ-карта доступа', 'Floating access keycard', 'prop_coin'],
      ['chest3d', 'Сундук с сокровищами', 'Treasure loot chest', 'prop_crate'],
      ['conveyor3d', 'Конвейерная лента', 'Moving belt conveyor', 'arch_bridge'],
      ['elevator3d', 'Подъёмный лифт', 'Oscillating lift platform', 'arch_bridge'],
      ['saw_blade3d', 'Вращающаяся пила', 'Spinning hazard sawblade', 'fx_ring'],
      ['magnet3d', 'Магнитное поле', 'Magnetic pull emitter', 'fx_orb'],
      ['wind_zone3d', 'Ветровой поток', 'Updraft wind vortex', 'fx_ring'],
      ['explosion_fx3d', 'Вспышка взрыва', 'Expanding explosion burst', 'fx_orb'],
      ['fire_fx3d', 'Эмиттер огня', 'Rising fire particles', 'nature_fire'],
      ['smoke_fx3d', 'Эмиттер дыма', 'Billowing smoke plume', 'nature_cloud'],
      ['snow_fx3d', 'Снегопад 3D', '3D falling snow particles', 'fx_snow'],
      ['rain_fx3d', 'Дождь 3D', '3D falling rain streaks', 'fx_snow'],
      ['lightning_fx3d', 'Электрическая дуга', 'Crackling plasma bolt', 'fx_beam'],
      ['magic_circle3d', 'Магический круг', 'Spinning rune magic ring', 'fx_ring'],
      ['finish_arch3d', 'Финишная арка', 'Checkered finish gate', 'arch_gate'],
      ['switch_lever3d', 'Рычаг активации', 'Interactive lever switch', 'prop_console'],
      ['terminal_3d', '3D терминал', 'Interactive sci-fi kiosk', 'prop_console'],
      ['target_dummy3d', 'Мишень стрельбища', 'Training target dummy', 'prop_target']
    ],
    themes: [
      ['plasma', 'Плазменный', 'Plasma', '#38BDF8'],
      ['inferno', 'Адский', 'Inferno', '#F97316'],
      ['quantum', 'Квантовый', 'Quantum', '#A855F7'],
      ['toxic', 'Токсичный', 'Toxic', '#84CC16']
    ],
    makeProps: (name, idx, color) => ({
      sig: `${name}(name="${name}_${idx + 1}", x=${((idx % 5) - 2) * 3}, y=1.2, z=${-5 - (idx % 4) * 3}, color="${color}")`,
      snippet: `${name}(name="${name}_1", x=2, y=1.2, z=-6, color="${color}")`,
      meta: { archetype: 'fx_orb', defaultColor: color, secondaryColor: '#facc15', scale: 1, spin: 1.5 }
    })
  }
];

const TWO_D_DOMAINS: DomainSpec[] = [
  {
    subgroup: '2D Actors & Enemies',
    category: '2d',
    color: '#10B981',
    badge: 'Actor 2D',
    archetype: 'player',
    items: [
      ['knight2d', '2D Рыцарь', '2D Armored knight', 'player'],
      ['ninja2d', '2D Ниндзя', '2D Agile ninja', 'player'],
      ['wizard2d', '2D Маг', '2D Spellcaster wizard', 'player'],
      ['robot2d', '2D Робот', '2D Mech robot', 'player'],
      ['archer2d', '2D Лучник', '2D Ranger archer', 'player'],
      ['astronaut2d', '2D Астронавт', '2D Space explorer', 'player'],
      ['slime2d', '2D Слайм', '2D Bouncing slime enemy', 'enemy'],
      ['goblin2d', '2D Гоблин', '2D Goblin patroller', 'enemy'],
      ['skeleton2d', '2D Скелет', '2D Skeleton guard', 'enemy'],
      ['bat2d', '2D Летучая мышь', '2D Hovering cave bat', 'enemy'],
      ['ghost2d', '2D Призрак', '2D Floating ghost', 'enemy'],
      ['spider2d', '2D Паук', '2D Dungeon spider', 'enemy'],
      ['boss2d', '2D Босс арены', '2D Giant arena boss', 'enemy'],
      ['turret2d', '2D Турель', '2D Defense turret', 'sprite'],
      ['drone2d', '2D Боевой дрон', '2D Patrol hover drone', 'enemy'],
      ['car2d', '2D Гоночное авто', '2D Top/side racer car', 'capsule'],
      ['ship2d', '2D Космический корабль', '2D Space shooter ship', 'triangle'],
      ['ufo2d', '2D Тарелка НЛО', '2D Alien saucer', 'circle'],
      ['tank2d', '2D Танк', '2D Armored tank', 'rect'],
      ['npc2d', '2D Мирный NPC', '2D Quest villager NPC', 'sprite'],
      ['pet2d', '2D Питомец', '2D Companion pet', 'circle']
    ],
    themes: [
      ['cyber', 'Кибер', 'Cyber', '#06B6D4'],
      ['shadow', 'Теневой', 'Shadow', '#8B5CF6'],
      ['fire', 'Огненный', 'Fire', '#F97316'],
      ['frost', 'Ледяной', 'Frost', '#38BDF8'],
      ['gold', 'Золотой', 'Gold', '#FACC15'],
      ['toxic', 'Ядовитый', 'Toxic', '#84CC16']
    ],
    makeProps: (name, idx, color) => ({
      sig: `${name}(name="${name}_${idx + 1}", x=${100 + (idx % 5) * 90}, y=${180 + (idx % 3) * 60}, speed=220, hp=100, color="${color}")`,
      snippet: `${name}(name="${name}_1", x=180, y=280, speed=220, hp=100, color="${color}")`,
      meta: { archetype: 'player', defaultColor: color, w: 36, h: 40, icon: name.replace('2d', '') }
    })
  },
  {
    subgroup: '2D Level & Physics',
    category: '2d',
    color: '#64748B',
    badge: 'Level 2D',
    archetype: 'platform',
    items: [
      ['moving_plat2d', 'Движущаяся платформа', 'Oscillating platform', 'platform'],
      ['ice_plat2d', 'Ледяная платформа', 'Slippery ice platform', 'platform'],
      ['crumble_plat2d', 'Хрупкая платформа', 'Fragile crumbling block', 'platform'],
      ['conveyor2d', '2D Конвейер', 'Conveyor belt platform', 'platform'],
      ['ladder2d', 'Лестница вверх', 'Climbable vertical ladder', 'sprite'],
      ['rope2d', 'Верёвка/лиана', 'Swinging climb rope', 'line'],
      ['door2d', 'Дверь уровня', 'Interactive level door', 'rect'],
      ['locked_door2d', 'Запертая дверь', 'Key-locked security door', 'rect'],
      ['key2d', 'Ключ от двери', 'Collectible gold key', 'coin'],
      ['lever2d', 'Настенный рычаг', 'Toggleable wall lever', 'sprite'],
      ['chest2d', 'Сундук лута', 'Reward treasure chest', 'sprite'],
      ['crate2d', 'Деревянный ящик', 'Pushable cargo crate', 'rect'],
      ['barrel2d', 'Бочка на карте', 'Destructible barrel', 'capsule'],
      ['portal2d', '2D Портал', 'Warp teleport vortex', 'circle'],
      ['fan2d', 'Вентилятор потока', 'Updraft air fan', 'sprite'],
      ['saw2d', 'Циркулярная пила', 'Spinning hazard saw', 'polygon'],
      ['laser_gate2d', 'Лазерный барьер', 'Vertical laser beam', 'line'],
      ['water_zone2d', 'Водный бассейн', 'Translucent water zone', 'rect'],
      ['lava_zone2d', 'Лавовое озеро', 'Deadly glowing lava', 'hazard'],
      ['acid_zone2d', 'Кислотная лужа', 'Toxic acid hazard', 'hazard'],
      ['signpost2d', 'Указатель подсказки', 'Story signpost prop', 'sprite'],
      ['torch2d', 'Настенный факел', 'Glowing wall torch', 'circle'],
      ['tree2d', '2D Дерево', 'Scenery background tree', 'triangle'],
      ['house2d', '2D Домик', 'Scenery cottage house', 'rect'],
      ['gem2d', 'Самоцвет', 'Bonus collectible gem', 'coin'],
      ['heart2d', 'Сердце лечения', 'Health restore pickup', 'coin']
    ],
    themes: [
      ['neon', 'Неоновый', 'Neon', '#EC4899'],
      ['stone', 'Каменный', 'Stone', '#94A3B8'],
      ['crystal', 'Кристальный', 'Crystal', '#38BDF8'],
      ['magma', 'Лавовый', 'Magma', '#EF4444'],
      ['emerald', 'Изумрудный', 'Emerald', '#10B981']
    ],
    makeProps: (name, idx, color) => ({
      sig: `${name}(name="${name}_${idx + 1}", x=${120 + (idx % 4) * 130}, y=${220 + (idx % 3) * 65}, w=110, h=22, color="${color}")`,
      snippet: `${name}(name="${name}_1", x=240, y=310, w=120, h=22, color="${color}")`,
      meta: { archetype: 'platform', defaultColor: color, w: 120, h: 24, icon: name.replace('2d', '') }
    })
  },
  {
    subgroup: '2D Combat, VFX & Arcade',
    category: '2d',
    color: '#F97316',
    badge: 'FX / Arcade',
    archetype: 'circle',
    items: [
      ['fireball2d', 'Огненный шар', 'Blazing fireball projectile', 'circle'],
      ['icebolt2d', 'Ледяная стрела', 'Freezing ice bolt', 'triangle'],
      ['missile2d', 'Самонаводящаяся ракета', 'Homing missile', 'capsule'],
      ['lightning2d', 'Разряд молнии', 'Electric lightning strike', 'line'],
      ['shockwave2d', 'Ударная волна', 'Expanding shockwave ring', 'circle'],
      ['slash2d', 'Взмах клинка', 'Melee sword slash arc', 'triangle'],
      ['explosion2d', 'Взрыв частиц', 'Particle explosion burst', 'polygon'],
      ['aura2d', 'Светящаяся аура', 'Glowing character aura', 'circle'],
      ['paddle2d', 'Ракетка арканоида', 'Arcade breaker paddle', 'platform'],
      ['ball2d', 'Игровой мяч', 'Bouncing arcade ball', 'circle'],
      ['brick2d', 'Разрушаемый блок', 'Arcade breakable brick', 'rect'],
      ['snake_seg2d', 'Сегмент змейки', 'Grid snake body segment', 'rect'],
      ['apple2d', 'Яблоко для змейки', 'Arcade bonus apple', 'coin'],
      ['tetromino2d', 'Блок тетриса', 'Falling puzzle block', 'rect'],
      ['card_slot2d', 'Игровая карта 2D', 'Tabletop game card node', 'sprite'],
      ['dice2d', 'Игральный кубик', 'Boardgame dice node', 'sprite'],
      ['hex_tile2d', 'Гексагональный тайл', 'Strategy hex map tile', 'polygon'],
      ['tower_cannon2d', 'Башня пушка TD', 'Tower defense cannon', 'sprite'],
      ['tower_frost2d', 'Ледяная башня TD', 'Tower defense frost node', 'sprite'],
      ['waypoint2d', 'Точка маршрута', 'Pathfinding waypoint node', 'circle']
    ],
    themes: [
      ['arc', 'Дуговой', 'Arc', '#38BDF8'],
      ['solar', 'Солнечный', 'Solar', '#FACC15'],
      ['void', 'Пустотный', 'Void', '#A855F7'],
      ['ruby', 'Рубиновый', 'Ruby', '#F43F5E'],
      ['mint', 'Мятный', 'Mint', '#10B981']
    ],
    makeProps: (name, idx, color) => ({
      sig: `${name}(name="${name}_${idx + 1}", x=${140 + (idx % 5) * 95}, y=${160 + (idx % 4) * 55}, radius=22, color="${color}")`,
      snippet: `${name}(name="${name}_1", x=300, y=220, radius=24, color="${color}")`,
      meta: { archetype: 'circle', defaultColor: color, w: 48, h: 48, radius: 24, spin: 1.2, icon: name.replace('2d', '') }
    })
  }
];

const APP_DOMAINS: DomainSpec[] = [
  {
    subgroup: 'UI Controls & Inputs',
    category: 'app',
    color: '#38BDF8',
    badge: 'UI Input',
    archetype: 'ui_widget',
    items: [
      ['ui_navbar', 'Верхняя панель навигации', 'Top navigation bar', 'ui_tabs'],
      ['ui_sidebar', 'Боковое меню разделов', 'Collapsible sidebar menu', 'ui_grid'],
      ['ui_breadcrumbs', 'Хлебные крошки', 'Breadcrumb trail path', 'ui_badge'],
      ['ui_pagination', 'Пагинация страниц', 'Page switcher bar', 'ui_tabs'],
      ['ui_accordion', 'Раскрывающийся список', 'Expandable accordion block', 'ui_card'],
      ['ui_drawer', 'Выдвижная панель', 'Slide-out side drawer', 'ui_modal'],
      ['ui_toolbar', 'Панель инструментов', 'Action icon toolbar', 'ui_grid'],
      ['ui_datepicker', 'Выбор даты', 'Interactive date input', 'ui_input'],
      ['ui_colorpicker', 'Палитра выбора цвета', 'Interactive color picker', 'ui_colorpicker'],
      ['ui_search', 'Строка поиска', 'Live search bar input', 'ui_input'],
      ['ui_textarea', 'Многострочное поле', 'Multi-line text editor', 'ui_input'],
      ['ui_select', 'Выпадающий список', 'Dropdown option selector', 'ui_tabs'],
      ['ui_checkbox', 'Чекбокс галочка', 'Checkbox control', 'ui_toggle'],
      ['ui_radio', 'Радио-переключатель', 'Radio group selector', 'ui_tabs'],
      ['ui_stepper', 'Счётчик +/-', 'Numeric +/- stepper', 'ui_stepper'],
      ['ui_rating', 'Рейтинг звёздами', 'Interactive star rating', 'ui_rating'],
      ['ui_knob', 'Поворотная ручка', 'Rotary synth/control knob', 'ui_gauge'],
      ['ui_joystick', 'Виртуальный джойстик', 'On-screen touch joystick', 'ui_joystick'],
      ['ui_dpad', 'Крестовина управления', '4-way directional pad', 'ui_dpad'],
      ['ui_tooltip', 'Подсказка-бейдж', 'Floating info badge', 'ui_badge'],
      ['ui_banner', 'Уведомление-баннер', 'Full-width status banner', 'ui_card'],
      ['ui_filedrop', 'Зона загрузки файла', 'File dropzone panel', 'ui_card']
    ],
    themes: [
      ['pro', 'Профи', 'Pro', '#10B981'],
      ['glass', 'Стеклянный', 'Glass', '#38BDF8'],
      ['dark', 'Тёмный', 'Dark', '#6366F1'],
      ['neon', 'Неоновый', 'Neon', '#EC4899'],
      ['amber', 'Янтарный', 'Amber', '#F59E0B']
    ],
    makeProps: (name, idx, color) => ({
      sig: `${name}(id="${name}_${idx + 1}", label="${name.replace('ui_', '').toUpperCase()}", x=${20 + (idx % 3) * 210}, y=${20 + (idx % 5) * 65}, w=200, color="${color}")`,
      snippet: `${name}(id="${name}_1", label="Control", x=24, y=24, w=200, color="${color}")`,
      meta: { archetype: 'ui_widget', widgetKind: name, defaultColor: color }
    })
  },
  {
    subgroup: 'Charts, Dashboards & OS',
    category: 'app',
    color: '#10B981',
    badge: 'Data / OS',
    archetype: 'ui_widget',
    items: [
      ['ui_barchart', 'Столбчатая диаграмма', 'Vertical bar chart', 'ui_barchart'],
      ['ui_piechart', 'Круговая диаграмма', 'Segmented pie chart', 'ui_gauge'],
      ['ui_donutchart', 'Кольцевая диаграмма', 'Ring donut chart', 'ui_gauge'],
      ['ui_radarchart', 'Радар-паутина', 'Multi-axis radar chart', 'ui_chart'],
      ['ui_sparkline', 'Мини-график спарклайн', 'Compact sparkline graph', 'ui_chart'],
      ['ui_heatmap', 'Тепловая карта', 'Activity heatmap matrix', 'ui_grid'],
      ['ui_leaderboard', 'Таблица лидеров', 'Ranked leaderboard table', 'ui_table'],
      ['ui_kanban', 'Канбан-доска задач', 'Task kanban columns', 'ui_table'],
      ['ui_calendar', 'Календарь событий', 'Monthly calendar widget', 'ui_table'],
      ['ui_timeline', 'Лента таймлайна', 'Chronological timeline', 'ui_chat'],
      ['ui_clock', 'Цифровые часы', 'Live digital clock', 'ui_timer'],
      ['ui_stopwatch', 'Секундомер', 'Counting stopwatch', 'ui_timer'],
      ['ui_weather', 'Виджет погоды', 'Weather telemetry card', 'ui_card'],
      ['ui_window', 'Окно мини-ОС', 'Draggable OS app window', 'ui_modal'],
      ['ui_taskbar', 'Панель задач ОС', 'Bottom OS taskbar strip', 'ui_tabs'],
      ['ui_crosshair', 'Прицел HUD', 'Tactical reticle overlay', 'ui_badge'],
      ['ui_compass', 'Компас направлений', 'Navigation compass bar', 'ui_badge'],
      ['ui_ammo_hud', 'Счётчик патронов', 'Weapon ammo counter', 'ui_card'],
      ['ui_quest_log', 'Журнал квестов', 'Active mission quest log', 'ui_chat'],
      ['ui_shop_card', 'Карточка магазина', 'In-game store item card', 'ui_card'],
      ['ui_markdown', 'Блок текста Markdown', 'Formatted notes card', 'ui_code'],
      ['ui_pixelgrid', 'Пиксельный холст', 'Interactive pixel editor', 'ui_grid']
    ],
    themes: [
      ['live', 'Живой', 'Live', '#10B981'],
      ['telemetry', 'Телеметрия', 'Telemetry', '#38BDF8'],
      ['retro', 'Ретро', 'Retro', '#FACC15'],
      ['cyber', 'Кибер', 'Cyber', '#A855F7'],
      ['hud', 'HUD', 'HUD', '#F43F5E']
    ],
    makeProps: (name, idx, color) => ({
      sig: `${name}(id="${name}_${idx + 1}", title="${name.replace('ui_', '').toUpperCase()}", x=${20 + (idx % 2) * 260}, y=${20 + (idx % 4) * 100}, w=240, h=120, color="${color}")`,
      snippet: `${name}(id="${name}_1", title="Dashboard Panel", x=24, y=24, w=250, h=120, color="${color}")`,
      meta: { archetype: 'ui_widget', widgetKind: name, defaultColor: color }
    })
  },
  {
    subgroup: 'Audio, Synth & Systems',
    category: 'app',
    color: '#EC4899',
    badge: 'Audio / Sys',
    archetype: 'audio_sys',
    items: [
      ['ui_piano', 'Пианино-синтезатор', 'Interactive synth keyboard', 'ui_piano'],
      ['ui_drumpad', 'Драм-пэд 4x2', 'Interactive beat drumpad', 'ui_drumpad'],
      ['ui_sequencer', 'Шаговый секвенсор', 'Loop step sequencer', 'ui_grid'],
      ['ui_mixer', 'Аудио-микшер каналов', 'Multi-channel audio mixer', 'ui_spectrum'],
      ['ui_oscilloscope', 'Осциллограф волны', 'Live waveform scope', 'ui_spectrum'],
      ['synth_arp', 'Арпеджиатор нот', 'Procedural arpeggio loop', 'audio_synth'],
      ['synth_bass', 'Синт-бас линия', 'Deep procedural bass synth', 'audio_synth'],
      ['synth_lead', 'Соло-синтезатор', 'Bright lead melody synth', 'audio_synth'],
      ['synth_pad', 'Атмосферный пэд', 'Ambient harmonic pad', 'audio_synth'],
      ['drum_kick', 'Бочка ритма', 'Electronic kick pulse', 'audio_sfx'],
      ['drum_snare', 'Рабочий барабан', 'Crisp snare hit', 'audio_sfx'],
      ['drum_hihat', 'Хай-хэт ритм', 'Metallic hi-hat tick', 'audio_sfx'],
      ['sfx_coin', 'Звук монеты', 'Coin collect chime', 'audio_sfx'],
      ['sfx_jump', 'Звук прыжка', 'Arcade jump sweep', 'audio_sfx'],
      ['sfx_laser', 'Звук лазера', 'Laser blaster pew', 'audio_sfx'],
      ['sfx_explosion', 'Звук взрыва', 'Heavy impact boom', 'audio_sfx'],
      ['sfx_levelup', 'Звук уровня', 'Victory fanfare chime', 'audio_sfx'],
      ['quest_system', 'Система квестов', 'Mission & objective tracker', 'sys_state'],
      ['shop_system', 'Магазин и валюта', 'In-game economy & shop', 'sys_state'],
      ['craft_system', 'Система крафта', 'Item crafting recipes', 'sys_state'],
      ['achievement_system', 'Система достижений', 'Unlockable badges system', 'sys_state'],
      ['wave_director', 'Режиссёр волн врагов', 'Enemy wave spawner logic', 'sys_state'],
      ['daynight_system', 'Цикл дня и ночи', 'Dynamic time of day cycle', 'sys_state'],
      ['save_system', 'Автосохранение слотов', 'Persistent save manager', 'sys_state']
    ],
    themes: [
      ['studio', 'Студийный', 'Studio', '#EC4899'],
      ['arcade', 'Аркадный', 'Arcade', '#F59E0B'],
      ['ambient', 'Эмбиент', 'Ambient', '#6366F1'],
      ['chiptune', '8-бит', 'Chiptune', '#10B981'],
      ['pro', 'Мастер', 'Master', '#38BDF8']
    ],
    makeProps: (name, idx, color) => ({
      sig: `${name}(id="${name}_${idx + 1}", preset="default", volume=0.25, color="${color}")`,
      snippet: `${name}(id="${name}_1", preset="default", volume=0.25, color="${color}")`,
      meta: { archetype: 'audio_sys', defaultColor: color, preset: name }
    })
  }
];

function fnv1aHash(str: string, seed = 2166136261): number {
  let h = seed >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function hexToHsl(hex: string): [number, number, number] {
  const clean = hex.replace('#', '');
  const full = clean.length === 3
    ? clean.split('').map(c => c + c).join('')
    : clean.padEnd(6, '0').slice(0, 6);
  const r = parseInt(full.slice(0, 2), 16) / 255;
  const g = parseInt(full.slice(2, 4), 16) / 255;
  const b = parseInt(full.slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [210, 65, Math.round(l * 100)];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = 0;
  if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  return [Math.round(h * 60), Math.round(s * 100), Math.round(l * 100)];
}

function hslToHex(h: number, s: number, l: number): string {
  const hue = ((h % 360) + 360) % 360;
  const sat = Math.max(0, Math.min(100, s)) / 100;
  const lig = Math.max(0, Math.min(100, l)) / 100;
  const a = sat * Math.min(lig, 1 - lig);
  const f = (n: number) => {
    const k = (n + hue / 30) % 12;
    const col = lig - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * col).toString(16).padStart(2, '0').toUpperCase();
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

const SEMANTIC_HUE_RULES: Array<[RegExp, number, number, number]> = [
  [/gold|coin|royal|crown|chest|treasure|sun|solar|star|amber|trophy|retro/, 44, 88, 60],
  [/lava|magma|fire|flame|inferno|volcano|torch|campfire|brazier|phoenix|explosion|tnt|dwarven/, 18, 90, 58],
  [/crimson|ruby|heart|cursed|mine|boss|saw|spike|laser|hud|drum|turbo/, 348, 86, 61],
  [/sakura|neon|pink|magenta|rainbow|hyper|studio|arcade/, 322, 85, 64],
  [/amethyst|purple|violet|void|arcane|wizard|magic|quantum|plasma|shadow|dark|portal|wormhole|blackhole|tele/, 274, 82, 65],
  [/cyber|aqua|cyan|holo|scanner|radar|server|oscilloscope|telemetry|glass|synth|sequencer/, 188, 84, 58],
  [/ice|frost|glacier|snow|cryo|water|sea|ocean|waterfall|rain|submarine|sky|orbital|jet|spaceship|comet|pastel/, 208, 84, 63],
  [/toxic|acid|slime|poison/, 94, 84, 57],
  [/emerald|pine|oak|bamboo|tree|forest|elven|mint|cactus|medkit|heal|pixel|chiptune|pro|live|apple/, 148, 78, 57],
  [/stone|castle|fortress|bunker|wall|cliff|boulder|golem|skeleton|stealth|medieval|iron|tank|anvil|crypt|tomb|road|bridge|hangar|container/, 215, 56, 63]
];

function pickDistinctComponentColors(
  compName: string,
  baseHex: string,
  idx: number,
  usedHexes: Set<string>
): { primary: string; secondary: string } {
  const lower = compName.toLowerCase();
  const h1 = fnv1aHash(lower);
  const h2 = fnv1aHash(lower.split('').reverse().join(''), 0x811c9dc5);

  let baseHue: number;
  let baseSat: number;
  let baseLig: number;

  const matched = SEMANTIC_HUE_RULES.find(([re]) => re.test(lower));
  if (matched) {
    baseHue = matched[1];
    baseSat = matched[2];
    baseLig = matched[3];
  } else {
    const [bh, bs, bl] = hexToHsl(baseHex);
    baseHue = bh;
    baseSat = Math.max(66, Math.min(92, bs));
    baseLig = Math.max(56, Math.min(68, bl));
  }

  // Spread hues across items so even neighbors in the same domain look clearly distinct
  const hueOffset = matched
    ? ((h1 % 37) - 18) + ((idx % 5) - 2) * 3
    : ((h1 % 101) - 50) + (idx % 7) * 5;
  let h = ((baseHue + hueOffset) % 360 + 360) % 360;
  let s = Math.max(54, Math.min(95, baseSat + ((h2 % 19) - 9)));
  let l = Math.max(54, Math.min(70, baseLig + (((h2 >>> 5) % 13) - 6)));

  let primary = hslToHex(h, s, l);
  let guard = 0;
  while (usedHexes.has(primary) && guard < 120) {
    guard++;
    h = (h + (guard % 2 === 0 ? 7 : -5) + 360) % 360;
    s = 56 + ((s - 56 + 7) % 38);
    l = 54 + ((l - 54 + 3) % 17);
    primary = hslToHex(h, s, l);
  }
  usedHexes.add(primary);

  const secondary = hslToHex((h + 148 + (h1 % 35)) % 360, Math.min(92, Math.max(68, s)), 64);
  return { primary, secondary };
}

function buildExtendedCatalog(): ExtendedDrplComponentSeed[] {
  const result: ExtendedDrplComponentSeed[] = [];
  const usedNames = new Set<string>();
  const usedHexes = new Set<string>();

  const pushUnique = (entry: ExtendedDrplComponentSeed) => {
    if (usedNames.has(entry.name)) return;
    usedNames.add(entry.name);
    result.push(entry);
  };

  const allDomains = [...THREE_D_DOMAINS, ...TWO_D_DOMAINS, ...APP_DOMAINS];

  // 1) Base clean semantic items
  for (const domain of allDomains) {
    const compat = domain.category === '3d' ? COMPAT_3D : domain.category === '2d' ? COMPAT_2D : COMPAT_APP;
    const incompat = domain.category === '3d' ? INCOMPAT_3D : domain.category === '2d' ? INCOMPAT_2D : INCOMPAT_APP;

    domain.items.forEach(([name, ru, en, arch], idx) => {
      const { primary, secondary } = pickDistinctComponentColors(name, domain.color, idx, usedHexes);
      const built = domain.makeProps(name, idx, primary);
      pushUnique({
        id: name,
        name,
        category: domain.category,
        subgroup: domain.subgroup,
        color: primary,
        badge: domain.badge,
        signature: built.sig,
        descriptionRu: `${ru} — настраиваемый компонент категории «${domain.subgroup}» для создания сцен и проектов в DRPL.`,
        descriptionEn: `${en} — customizable ${domain.subgroup} node for building worlds and apps in DRPL.`,
        roleRu: `${ru}: готов к размещению, анимации и настройке параметров.`,
        roleEn: `${en}: ready for placement, animation and full customization.`,
        compatibleWith: compat,
        incompatibleWith: incompat,
        snippet: built.snippet,
        runtimeMeta: {
          ...built.meta,
          archetype: arch || domain.archetype,
          defaultColor: primary,
          secondaryColor: secondary
        }
      });
    });
  }

  // 2) Cross-themed semantic variations (e.g., cyber_tower3d, frost_crystal_cluster3d, neon_knight2d, glass_ui_navbar, etc.)
  for (const domain of allDomains) {
    const compat = domain.category === '3d' ? COMPAT_3D : domain.category === '2d' ? COMPAT_2D : COMPAT_APP;
    const incompat = domain.category === '3d' ? INCOMPAT_3D : domain.category === '2d' ? INCOMPAT_2D : INCOMPAT_APP;
    const themes = domain.themes || [];

    for (const [tPrefix, tRu, tEn, tCol] of themes) {
      domain.items.forEach(([baseName, ru, en, arch], idx) => {
        const compName = baseName.startsWith('ui_')
          ? `ui_${tPrefix}_${baseName.slice(3)}`
          : `${tPrefix}_${baseName}`;
        const { primary, secondary } = pickDistinctComponentColors(compName, tCol, idx, usedHexes);
        const built = domain.makeProps(compName, idx, primary);
        pushUnique({
          id: compName,
          name: compName,
          category: domain.category,
          subgroup: domain.subgroup,
          color: primary,
          badge: `${tEn} • ${domain.badge}`,
          signature: built.sig,
          descriptionRu: `${tRu} вариант: ${ru.toLowerCase()} с уникальной палитрой и настройками.`,
          descriptionEn: `${tEn} variant of ${en.toLowerCase()} with themed styling and parameters.`,
          roleRu: `${tRu} ${ru.toLowerCase()} — гибко настраиваемый узел DRPL.`,
          roleEn: `${tEn} ${en.toLowerCase()} — customizable themed DRPL node.`,
          compatibleWith: compat,
          incompatibleWith: incompat,
          snippet: built.snippet,
          runtimeMeta: {
            ...built.meta,
            archetype: arch || domain.archetype,
            defaultColor: primary,
            secondaryColor: secondary
          }
        });
      });
    }
  }

  // 3) Rich extra procedural Game/App Building Blocks to guarantee > 1,200 total components across genres
  const extraGenres: Array<{
    subgroup: string;
    category: DrplCategoryBase;
    color: string;
    badge: string;
    archetype: string;
    prefixes: Array<[string, string, string, string]>;
    nouns: Array<[string, string, string]>;
    suffix: string;
  }> = [
    {
      subgroup: 'Sci-Fi & Cyberpunk 3D',
      category: '3d',
      color: '#06B6D4',
      badge: 'Sci-Fi 3D',
      archetype: 'arch_tower',
      prefixes: [
        ['quantum', 'Квантовый', 'Quantum', '#06B6D4'],
        ['orbital', 'Орбитальный', 'Orbital', '#38BDF8'],
        ['plasma', 'Плазменный', 'Plasma', '#A855F7'],
        ['hyper', 'Гипер', 'Hyper', '#EC4899'],
        ['nano', 'Нано', 'Nano', '#10B981']
      ],
      nouns: [
        ['beacon', 'маяк', 'beacon'],
        ['core', 'энерго-ядро', 'power core'],
        ['pod', 'капсула', 'capsule pod'],
        ['relay', 'ретранслятор', 'relay station'],
        ['shield_pylon', 'щитовой пилон', 'shield pylon'],
        ['dock_bay', 'стыковочный отсек', 'docking bay'],
        ['telepad', 'телепорт-пад', 'teleporter pad'],
        ['scanner', 'сканер', 'laser scanner'],
        ['turret_mk2', 'турель МК2', 'defense turret'],
        ['capacitor', 'конденсатор', 'flux capacitor'],
        ['obelisk_tech', 'техно-обелиск', 'tech obelisk'],
        ['barrier', 'силовой барьер', 'energy barrier'],
        ['holo_table', 'голографический стол', 'hologram table'],
        ['cryo_chamber', 'криокамера', 'cryo chamber'],
        ['thruster', 'двигатель тяги', 'thruster unit'],
        ['solar_wing', 'солнечное крыло', 'solar wing']
      ],
      suffix: '3d'
    },
    {
      subgroup: 'Fantasy & RPG 3D',
      category: '3d',
      color: '#F59E0B',
      badge: 'RPG 3D',
      archetype: 'arch_castle',
      prefixes: [
        ['royal', 'Королевский', 'Royal', '#FACC15'],
        ['elven', 'Эльфийский', 'Elven', '#10B981'],
        ['dwarven', 'Гномий', 'Dwarven', '#F97316'],
        ['arcane', 'Тайный', 'Arcane', '#A855F7'],
        ['cursed', 'Проклятый', 'Cursed', '#F43F5E']
      ],
      nouns: [
        ['keep', 'донжон', 'citadel keep'],
        ['forge', 'кузница', 'blacksmith forge'],
        ['anvil', 'наковальня', 'runic anvil'],
        ['cauldron', 'котёл зелий', 'alchemy cauldron'],
        ['banner', 'знамя', 'war banner'],
        ['brazier', 'жаровня', 'flaming brazier'],
        ['totem', 'тотем силы', 'spirit totem'],
        ['well', 'колодец маны', 'mana well'],
        ['crypt', 'склеп', 'stone crypt'],
        ['tomb', 'гробница', 'ancient tomb'],
        ['obelisk_rune', 'рунный камень', 'runestone obelisk'],
        ['lantern_post', 'фонарный столб', 'lantern post'],
        ['wagon', 'повозка', 'supply wagon'],
        ['tent', 'шатёр лагеря', 'camp tent'],
        ['tavern', 'таверна', 'village tavern'],
        ['archway', 'каменный свод', 'stone archway']
      ],
      suffix: '3d'
    },
    {
      subgroup: '2D Genre Kits',
      category: '2d',
      color: '#14B8A6',
      badge: 'Kit 2D',
      archetype: 'sprite',
      prefixes: [
        ['retro', 'Ретро', 'Retro', '#FACC15'],
        ['pixel', 'Пиксельный', 'Pixel', '#10B981'],
        ['neon', 'Неоновый', 'Neon', '#EC4899'],
        ['dark', 'Тёмный', 'Dark', '#8B5CF6'],
        ['pastel', 'Пастельный', 'Pastel', '#38BDF8']
      ],
      nouns: [
        ['platform_wide', 'широкая платформа', 'wide platform'],
        ['spike_row', 'ряд шипов', 'spike row hazard'],
        ['coin_cluster', 'горсть монет', 'coin pickup'],
        ['star_pickup', 'звезда бонуса', 'bonus star'],
        ['shield_orb', 'сфера щита', 'shield orb'],
        ['speed_pad', 'панель ускорения', 'speed boost pad'],
        ['jump_pad', 'пружина прыжка', 'jump spring pad'],
        ['guard_bot', 'охранный бот', 'patrol guard'],
        ['boss_drone', 'мини-босс', 'mini boss unit'],
        ['tele_ring', 'кольцо телепорта', 'warp ring'],
        ['checkpoint_pole', 'флаг чекпоинта', 'checkpoint flag'],
        ['laser_emitter', 'излучатель лазера', 'laser emitter'],
        ['crate_box', 'физический ящик', 'physics crate'],
        ['switch_btn', 'нажимная кнопка', 'pressure button'],
        ['portal_gate', 'портал выхода', 'exit portal'],
        ['collect_gem', 'кристалл очков', 'score crystal']
      ],
      suffix: '2d'
    },
    {
      subgroup: 'App Widgets & Modules',
      category: 'app',
      color: '#8B5CF6',
      badge: 'Module App',
      archetype: 'ui_widget',
      prefixes: [
        ['ui_mini', 'Компактный', 'Compact', '#38BDF8'],
        ['ui_pro', 'Профессиональный', 'Pro', '#10B981'],
        ['ui_game', 'Игровой', 'Game HUD', '#F59E0B'],
        ['ui_studio', 'Студийный', 'Studio', '#EC4899'],
        ['ui_os', 'Системный OS', 'OS Desktop', '#6366F1']
      ],
      nouns: [
        ['status_card', 'блок статуса', 'status card'],
        ['metric_tile', 'плитка метрики', 'metric tile'],
        ['action_btn', 'кнопка действия', 'action button'],
        ['range_slider', 'ползунок', 'range slider'],
        ['toggle_sw', 'переключатель', 'toggle switch'],
        ['progress_bar', 'индикатор прогресса', 'progress bar'],
        ['log_panel', 'панель логов', 'log terminal'],
        ['chart_line', 'график линии', 'line chart'],
        ['meter_gauge', 'шкала прибора', 'dial gauge'],
        ['menu_tabs', 'вкладки меню', 'tab bar'],
        ['grid_pad', 'панель кнопок', 'keypad grid'],
        ['badge_tag', 'бейдж-метка', 'tag badge'],
        ['timer_box', 'блок таймера', 'timer readout'],
        ['list_feed', 'лента событий', 'event feed'],
        ['slot_bar', 'панель слотов', 'inventory slot bar'],
        ['text_label', 'заголовок текста', 'text display']
      ],
      suffix: ''
    }
  ];

  for (const g of extraGenres) {
    const compat = g.category === '3d' ? COMPAT_3D : g.category === '2d' ? COMPAT_2D : COMPAT_APP;
    const incompat = g.category === '3d' ? INCOMPAT_3D : g.category === '2d' ? INCOMPAT_2D : INCOMPAT_APP;

    for (const [pSlug, pRu, pEn, pCol] of g.prefixes) {
      g.nouns.forEach(([nSlug, nRu, nEn], idx) => {
        const compName = `${pSlug}_${nSlug}${g.suffix}`;
        const { primary, secondary } = pickDistinctComponentColors(compName, pCol, idx, usedHexes);
        const posX = g.category === '3d' ? ((idx % 5) - 2) * 3 : 30 + (idx % 4) * 140;
        const posY = g.category === '3d' ? 1 : 40 + (idx % 4) * 75;
        const sig =
          g.category === '3d'
            ? `${compName}(name="${compName}_1", x=${posX}, y=${posY}, z=-6, scale=1.0, color="${primary}")`
            : g.category === '2d'
              ? `${compName}(name="${compName}_1", x=${posX}, y=${posY}, w=64, h=48, color="${primary}")`
              : `${compName}(id="${compName}_1", title="${pEn} ${nEn}", x=${posX}, y=${posY}, w=200, color="${primary}")`;
        const widgetKind =
          nSlug.includes('btn') ? 'ui_button'
            : nSlug.includes('slider') ? 'ui_slider'
              : nSlug.includes('toggle') ? 'ui_toggle'
                : nSlug.includes('progress') ? 'ui_progress'
                  : nSlug.includes('log') ? 'ui_terminal'
                    : nSlug.includes('chart') ? 'ui_chart'
                      : nSlug.includes('gauge') ? 'ui_gauge'
                        : nSlug.includes('tabs') ? 'ui_tabs'
                          : nSlug.includes('pad') ? 'ui_grid'
                            : nSlug.includes('badge') ? 'ui_badge'
                              : nSlug.includes('timer') ? 'ui_timer'
                                : nSlug.includes('feed') ? 'ui_chat'
                                  : nSlug.includes('slot') ? 'ui_inventory'
                                    : nSlug.includes('text') ? 'ui_text'
                                      : 'ui_card';

        const arch2D =
          nSlug.includes('plat') ? 'platform'
            : nSlug.includes('spike') ? 'hazard'
              : nSlug.includes('coin') || nSlug.includes('star') || nSlug.includes('gem') ? 'coin'
                : nSlug.includes('jump') ? 'spring'
                  : nSlug.includes('guard') || nSlug.includes('boss') ? 'enemy'
                    : nSlug.includes('pole') ? 'checkpoint'
                      : nSlug.includes('orb') || nSlug.includes('ring') ? 'circle'
                        : nSlug.includes('crate') ? 'rect'
                          : 'sprite';

        const arch3D =
          nSlug.includes('beacon') || nSlug.includes('obelisk') || nSlug.includes('pylon') || nSlug.includes('totem') ? 'arch_pillar'
            : nSlug.includes('keep') || nSlug.includes('tavern') || nSlug.includes('forge') || nSlug.includes('crypt') ? 'arch_castle'
              : nSlug.includes('pod') || nSlug.includes('chamber') ? 'arch_dome'
                : nSlug.includes('turret') || nSlug.includes('scanner') ? 'weapon_turret'
                  : nSlug.includes('barrier') || nSlug.includes('arch') ? 'arch_gate'
                    : nSlug.includes('brazier') || nSlug.includes('lantern') ? 'nature_fire'
                      : nSlug.includes('core') || nSlug.includes('telepad') ? 'fx_orb'
                        : 'arch_bunker';

        pushUnique({
          id: compName,
          name: compName,
          category: g.category,
          subgroup: g.subgroup,
          color: primary,
          badge: `${pEn} • ${g.badge}`,
          signature: sig,
          descriptionRu: `${pRu} ${nRu} — готовый компонент раздела «${g.subgroup}» с полной поддержкой визуального редактирования и настройки.`,
          descriptionEn: `${pEn} ${nEn} — customizable ${g.subgroup} component ready for code, block & visual editing.`,
          roleRu: `${pRu} ${nRu} (${g.subgroup}).`,
          roleEn: `${pEn} ${nEn} (${g.subgroup}).`,
          compatibleWith: compat,
          incompatibleWith: incompat,
          snippet: sig,
          runtimeMeta: {
            archetype: g.category === '3d' ? arch3D : g.category === '2d' ? arch2D : 'ui_widget',
            defaultColor: primary,
            secondaryColor: secondary,
            scale: 1,
            w: 64,
            h: 48,
            widgetKind,
            icon: nSlug.split('_')[0]
          }
        });
      });
    }
  }

  return result;
}

export const DRPL_EXTENDED_COMPONENTS: ExtendedDrplComponentSeed[] = buildExtendedCatalog();
