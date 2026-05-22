import * as fs from 'fs';

let content = fs.readFileSync('src/components/AppPreview.tsx', 'utf8');

// 1. Add state hooks to the top of AppPreview
const insertion1 = `export default function AppPreview({ entities, uiMode, handleUIEvent, isFullScreen }: AppPreviewProps) {
  const [isMobileUI, setIsMobileUI] = React.useState(false);
  const [isRealMobile, setIsRealMobile] = React.useState(typeof window !== 'undefined' ? window.innerWidth < 640 : false);
  
  React.useEffect(() => {
    const handleResize = () => setIsRealMobile(window.innerWidth < 640);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const displayMobile = isMobileUI || isRealMobile;
  const getX = (entity: any) => displayMobile && entity.mobile_x !== undefined ? entity.mobile_x : (entity.x || 0);
  const getY = (entity: any) => displayMobile && entity.mobile_y !== undefined ? entity.mobile_y : (entity.y || 0);
`;

content = content.replace(
  'export default function AppPreview({ entities, uiMode, handleUIEvent, isFullScreen }: AppPreviewProps) {',
  insertion1
);

// 2. Wrap the root div in a mobile container if needed
const oldStart = `  return (
    <div 
      className={clsx("w-full h-full relative overflow-hidden", )}`;

const newStart = `  return (
    <div className={clsx("w-full h-full flex items-center justify-center", displayMobile && "bg-black/80")}>
      <div 
        className={clsx("relative overflow-hidden", displayMobile ? "w-[375px] h-[812px] bg-white rounded-[40px] border-[8px] border-zinc-900 shadow-2xl shrink-0" : "w-full h-full")}
        style={{
          boxShadow: displayMobile ? '0 0 0 1px #333, 0 10px 40px rgba(0,0,0,0.5)' : undefined,
`;

content = content.replace(
  `  return (
    <div 
      className={clsx("w-full h-full relative overflow-hidden", )}`,
  newStart
);

// We must also adjust the style block after this since it previously belonged to the root div.
content = content.replace(
  `      style={{
        backgroundColor: computerStyle ? 'transparent' : ((Object.values(entities).find((e: any) => e.type === 'world') as any)?.background || (Object.values(entities).find((e: any) => e.type === 'world') as any)?.color || '#ffffff'),
        backgroundImage: (Object.values(entities).find((e: any) => e.type === 'world') as any)?.backgroundImage ? \`url(\${(Object.values(entities).find((e: any) => e.type === 'world') as any)?.backgroundImage})\` : 'none',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        perspective: camera ? '1000px' : 'none'
      }}
    >`,
  `        backgroundColor: computerStyle ? 'transparent' : ((Object.values(entities).find((e: any) => e.type === 'world') as any)?.background || (Object.values(entities).find((e: any) => e.type === 'world') as any)?.color || '#ffffff'),
        backgroundImage: (Object.values(entities).find((e: any) => e.type === 'world') as any)?.backgroundImage ? \`url(\${(Object.values(entities).find((e: any) => e.type === 'world') as any)?.backgroundImage})\` : 'none',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        perspective: camera ? '1000px' : 'none'
      }}
    >`
);

// Close the wrapper div at the end
content = content.replace(
  `    </div>
  );
}`,
  `      </div>
    </div>
  );
}`
);

// 3. Replace all left: entity.x || 0 and top: entity.y || 0 with getX and getY
content = content.replace(/left:\s*entity\.x\s*\|\|\s*0/g, 'left: getX(entity)');
content = content.replace(/top:\s*entity\.y\s*\|\|\s*0/g, 'top: getY(entity)');

// Some have x1 and y1 for lines
// In AppPreview: const x1 = x1 ... left: x1 ... we might need to handle line specifically. Let's look at line logic:
// const x1 = entity.x || 0; const y1 = entity.y || 0;
content = content.replace(/const x1 = entity\.x \|\| 0;/g, 'const x1 = getX(entity);');
content = content.replace(/const y1 = entity\.y \|\| 0;/g, 'const y1 = getY(entity);');

// 4. Update the onDragEnd handlers
const oldDragEnd = `                  entity.x = Math.round(parseFloat(entity.x || 0) + info.offset.x);
                  entity.y = Math.round(parseFloat(entity.y || 0) + info.offset.y);`;
                  
const newDragEnd = `                  if (displayMobile) {
                    entity.mobile_x = Math.round(parseFloat(entity.mobile_x || entity.x || 0) + info.offset.x);
                    entity.mobile_y = Math.round(parseFloat(entity.mobile_y || entity.y || 0) + info.offset.y);
                  } else {
                    entity.x = Math.round(parseFloat(entity.x || 0) + info.offset.x);
                    entity.y = Math.round(parseFloat(entity.y || 0) + info.offset.y);
                  }`;
                  
content = content.split(oldDragEnd).join(newDragEnd);

// 5. Update the "Position & Properties" panel
// Note: We need to make sure the panel is outside the scaled view. But it's position absolute. So it should still work.
// Let's find the UI panel button.
const oldBtn = `<button 
            onClick={() => handleUIEvent('trigger_mobile_emulator?', uiMode.target)}
            className="w-full py-2 mb-4 bg-zinc-800 hover:bg-zinc-700 text-sm font-medium rounded-lg transition-colors flex items-center justify-center gap-2 text-zinc-300"
          >
             <Smartphone className="w-4 h-4 text-emerald-400" /> Mobile UI
          </button>`;

const newBtn = `<button 
            onClick={() => setIsMobileUI(!isMobileUI)}
            className={clsx("w-full py-2 mb-4 hover:bg-zinc-700 text-sm font-medium rounded-lg transition-colors flex items-center justify-center gap-2", isMobileUI ? "bg-emerald-600 text-white" : "bg-zinc-800 text-zinc-300")}
          >
             <Smartphone className="w-4 h-4" /> {isMobileUI ? "PC UI (default)" : "Mobile UI"}
          </button>`;
content = content.replace(oldBtn, newBtn);

// 6. Update the inputs for X and Y in the properties panel
const oldXInput = `                <input type="number" 
                  value={(Object.values(entities).find((en: any) => en.name === uiMode.target) as any)?.x || 0}
                  className="bg-zinc-800 p-2 rounded outline-none w-full border border-zinc-700 focus:border-emerald-500" 
                  onChange={(e) => {
                  const targetEntity = Object.values(entities).find((en: any) => en.name === uiMode.target) as any;
                  if (targetEntity) {
                    targetEntity.x = Number(e.target.value);
                    handleUIEvent('manipulated?', uiMode.target);
                  }
                }} />`;
                
const newXInput = `                <input type="number" 
                  value={(Object.values(entities).find((en: any) => en.name === uiMode.target) as any)?.[displayMobile ? 'mobile_x' : 'x'] || (Object.values(entities).find((en: any) => en.name === uiMode.target) as any)?.x || 0}
                  className="bg-zinc-800 p-2 rounded outline-none w-full border border-zinc-700 focus:border-emerald-500" 
                  onChange={(e) => {
                  const targetEntity = Object.values(entities).find((en: any) => en.name === uiMode.target) as any;
                  if (targetEntity) {
                    if (displayMobile) targetEntity.mobile_x = Number(e.target.value);
                    else targetEntity.x = Number(e.target.value);
                    handleUIEvent('manipulated?', uiMode.target);
                  }
                }} />`;
content = content.replace(oldXInput, newXInput);

const oldYInput = `                <input type="number" 
                  value={(Object.values(entities).find((en: any) => en.name === uiMode.target) as any)?.y || 0}
                  className="bg-zinc-800 p-2 rounded outline-none w-full border border-zinc-700 focus:border-emerald-500" 
                  onChange={(e) => {
                  const targetEntity = Object.values(entities).find((en: any) => en.name === uiMode.target) as any;
                  if (targetEntity) {
                    targetEntity.y = Number(e.target.value);
                    handleUIEvent('manipulated?', uiMode.target);
                  }
                }} />`;

const newYInput = `                <input type="number" 
                  value={(Object.values(entities).find((en: any) => en.name === uiMode.target) as any)?.[displayMobile ? 'mobile_y' : 'y'] || (Object.values(entities).find((en: any) => en.name === uiMode.target) as any)?.y || 0}
                  className="bg-zinc-800 p-2 rounded outline-none w-full border border-zinc-700 focus:border-emerald-500" 
                  onChange={(e) => {
                  const targetEntity = Object.values(entities).find((en: any) => en.name === uiMode.target) as any;
                  if (targetEntity) {
                    if (displayMobile) targetEntity.mobile_y = Number(e.target.value);
                    else targetEntity.y = Number(e.target.value);
                    handleUIEvent('manipulated?', uiMode.target);
                  }
                }} />`;
content = content.replace(oldYInput, newYInput);

fs.writeFileSync('src/components/AppPreview.tsx', content);

console.log("AppPreview updated successfully!");
