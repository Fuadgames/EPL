import { TOKEN_REGEX } from './epl-dictionary';
import { GoogleGenAI } from "@google/genai";

type EPLValue = string | number | boolean | null;

interface EPLEntity {
  id: string;
  type: string;
  [key: string]: any;
}

interface EPLContext {
  variables: Record<string, EPLValue>;
  entities: Record<string, EPLEntity>;
  events: Record<string, string[]>;
  output: string[];
  isRunning: boolean;
  timers: Record<string, any>;
  currentObject: EPLEntity | null;
  controlType: 'wasd' | null;
  lastEventValue: string | null;
}

export class EPLInterpreter {
  context: EPLContext;
  onOutput: (msg: string) => void;
  onUIUpdate: (entities: Record<string, EPLEntity>) => void;
  aiSettings: { answerMode: 'text' | 'console', changesEnabled: boolean };

  constructor(
    onOutput: (msg: string) => void, 
    onUIUpdate: (entities: Record<string, EPLEntity>) => void,
    aiSettings: { answerMode: 'text' | 'console', changesEnabled: boolean }
  ) {
    this.context = {
      variables: {},
      entities: {},
      events: {},
      output: [],
      isRunning: false,
      timers: {},
      currentObject: null,
      controlType: null,
      lastEventValue: null
    };
    this.onOutput = onOutput;
    this.onUIUpdate = onUIUpdate;
    this.aiSettings = aiSettings;
  }

  log(msg: string) {
    this.context.output.push(msg);
    this.onOutput(msg);
  }

  parseSettings(settingsStr: string): Record<string, any> {
    const obj: Record<string, any> = {};
    if (!settingsStr) return obj;
    
    settingsStr.split(',').forEach(pair => {
      const parts = pair.split('=');
      if (parts.length === 2) {
        const key = parts[0].trim();
        let val: any = parts[1].trim();
        
        // Remove quotes if present
        if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
        else if (val.startsWith("'") && val.endsWith("'")) val = val.slice(1, -1);
        
        // Parse numbers but preserve relative signs for move/etc
        const isRelative = val.startsWith('+') || val.startsWith('-');
        if (!isNaN(Number(val)) && !isRelative) {
          val = Number(val);
        } else if (val === 'true') {
          val = true;
        } else if (val === 'false') {
          val = false;
        }
        
        obj[key] = val;
      }
    });
    return obj;
  }

  evaluateExpression(expr: string): EPLValue {
    expr = expr.trim();
    if (expr.startsWith('"') && expr.endsWith('"')) return expr.slice(1, -1);
    if (!isNaN(Number(expr))) return Number(expr);
    if (expr === 'true') return true;
    if (expr === 'false') return false;
    
    return this.context.variables[expr] !== undefined ? this.context.variables[expr] : null;
  }

  evaluateCondition(cond: string): boolean {
    // Simple eval for now: "Player.x > 100"
    try {
      // Replace entity references with actual values
      const parsedCond = cond.replace(/([a-zA-Z0-9_]+)\.([a-zA-Z0-9_]+)/g, (match, entityName, prop) => {
        const entity = Object.values(this.context.entities).find(e => e.name === entityName);
        if (entity && entity[prop] !== undefined) {
          const val = entity[prop];
          return typeof val === 'string' ? `"${val.replace(/"/g, '\\"')}"` : String(val);
        }
        return '0';
      });
      
      // Extremely basic and unsafe eval just for demonstration of EPL logic
      // In a real app, use a proper expression parser
      return new Function(`return ${parsedCond}`)();
    } catch (e) {
      return false;
    }
  }

  async runLines(lines: string[]): Promise<boolean> {
    let i = 0;
    while (i < lines.length && this.context.isRunning) {
      let line = lines[i].trim();
      if (!line || line.startsWith('//') || line.startsWith('#')) {
        i++;
        continue;
      }

      // Parse line into tokens
      const parts = line.split(TOKEN_REGEX);
      let executed = false;

      // Scan for actions
      for (let j = 1; j < parts.length; j += 4) {
        const keyword = parts[j];
        if (!keyword) continue;
        const settingsStr = parts[j+1] || '';
        const settings = this.parseSettings(settingsStr);

        if (keyword === 'stop') {
          return true; // Stop execution of current block and propagate
        }
        else if (keyword === 'create') {
          // Look ahead for the entity type
          const nextKeyword = parts[j+4];
          const nextSettingsStr = parts[j+5] || '';
          const nextSettings = this.parseSettings(nextSettingsStr);
          
          if (['world', 'button', 'block', '3Dblock', 'sprite', 'png', 'text_label', 'particle', 'sound', 'timer', 'player', 'enemy', 'textbox'].includes(nextKeyword)) {
            const id = nextSettings.name || `entity_${Date.now()}_${Math.random()}`;
            this.context.entities[id] = { id, type: nextKeyword, ...nextSettings };
            this.onUIUpdate({ ...this.context.entities });
            
            // Handle timer creation
            if (nextKeyword === 'timer') {
              const interval = Number(nextSettings.interval || 1000);
              const timerId = setInterval(() => {
                if (this.context.isRunning) {
                  this.triggerEvent('timer_tick?', nextSettings.name);
                }
              }, interval);
              this.context.timers[id] = timerId;
            }

            // Trigger created? event if it exists
            const createdEventKey = `created?_${nextSettings.name}`;
            if (this.context.events[createdEventKey]) {
              this.runLines(this.context.events[createdEventKey]); // Run asynchronously
            }
            
            j += 4; // Skip next token
          }
          executed = true;
        } 
        else if (['world', 'button', 'block', '3Dblock', 'sprite', 'png', 'text_label', 'particle', 'sound', 'timer', 'player', 'enemy', 'textbox'].includes(keyword)) {
          // If used without 'create', it updates an existing entity
          const targetName = settings.name || settings.target || (keyword === 'world' ? 'world' : null);
          const target = Object.values(this.context.entities).find(e => e.name === targetName || (keyword === 'world' && e.type === 'world'));
          
          if (target) {
            // Only update, don't create. 
            // We strip 'id' and 'type' from settings to prevent corruption
            const { id, type, ...cleanSettings } = settings;
            Object.assign(target, cleanSettings);
            this.onUIUpdate({ ...this.context.entities });
          } else {
            // Log that the entity was not found for update
            if (targetName) {
              this.log(`Error: Entity "${targetName}" not found. Use 'create' to make a new one.`);
            }
          }
          executed = true;
        }
        else if (keyword === 'ai') {
          const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
          const response = await ai.models.generateContent({
            model: "gemini-3-flash-preview",
            contents: settings.prompt,
          });
          const text = response.text;
          if (this.aiSettings.answerMode === 'text') {
            this.log(text || '');
          } else {
            console.log(text);
          }
          if (this.aiSettings.changesEnabled && settings.target) {
            const target = Object.values(this.context.entities).find(e => e.name === settings.target);
            if (target) {
              target.text = text;
              this.onUIUpdate({ ...this.context.entities });
            }
          }
          executed = true;
        }
        else if (keyword === 'object') {
          const targetName = settings.name;
          const target = Object.values(this.context.entities).find(e => e.name === targetName);
          
          let block: string[] = [];
          i++;
          while (i < lines.length) {
            const innerLine = lines[i].trim();
            if (innerLine === 'end' || innerLine.startsWith('end')) break;
            block.push(lines[i]);
            i++;
          }
          
          const previousObject = this.context.currentObject;
          this.context.currentObject = target || null;
          
          await this.runLines(block);
          
          this.context.currentObject = previousObject;
          
          executed = true;
          break;
        }
        else if (keyword === 'control') {
          this.context.controlType = settings.type === 'wasd' ? 'wasd' : null;
          executed = true;
        }
        else if (keyword === 'type') {
          if (settings.target === 'console') {
            console.log(String(settings.text || ''));
          } else {
            this.log(String(settings.text || ''));
          }
          executed = true;
        }
        else if (keyword === 'background') {
          // Find the world entity or create one
          let world = Object.values(this.context.entities).find(e => e.type === 'world');
          if (!world) {
            const id = `world_${Date.now()}`;
            world = { id, type: 'world', name: 'world' };
            this.context.entities[id] = world;
          }
          if (settings.color) world.background = settings.color;
          if (settings.image) world.backgroundImage = settings.image;
          this.onUIUpdate({ ...this.context.entities });
          executed = true;
        }
        else if (keyword === 'move') {
          const target = Object.values(this.context.entities).find(e => e.name === settings.target) || this.context.currentObject;
          if (target) {
            if (settings.x !== undefined) {
              const val = String(settings.x);
              if (val.startsWith('+')) target.x = (target.x || 0) + Number(val.slice(1));
              else if (val.startsWith('-')) target.x = (target.x || 0) - Number(val.slice(1));
              else target.x = Number(val);
            }
            if (settings.y !== undefined) {
              const val = String(settings.y);
              if (val.startsWith('+')) target.y = (target.y || 0) + Number(val.slice(1));
              else if (val.startsWith('-')) target.y = (target.y || 0) - Number(val.slice(1));
              else target.y = Number(val);
            }
            this.onUIUpdate({ ...this.context.entities });
            
            // Basic collision detection
            this.checkCollisions(target);
          }
          executed = true;
        }
        else if (keyword === 'wait') {
          const ms = Number(settings.time || 1000);
          await new Promise(resolve => setTimeout(resolve, ms));
          executed = true;
        }
        else if (keyword === 'set up') {
          const target = Object.values(this.context.entities).find(e => e.name === settings.target) || this.context.currentObject;
          if (target && settings.property) {
            target[settings.property] = settings.value;
            this.onUIUpdate({ ...this.context.entities });
          }
          executed = true;
        }
        else if (keyword === 'destroy') {
          const targetId = Object.keys(this.context.entities).find(id => this.context.entities[id].name === (settings.target || this.context.currentObject?.name));
          if (targetId) {
            delete this.context.entities[targetId];
            this.onUIUpdate({ ...this.context.entities });
          }
          executed = true;
        }
        else if (keyword === 'if') {
          // Find check on current line or next line
          let checkIdx = parts.indexOf('check', j);
          let condition = 'false';
          
          if (checkIdx !== -1) {
            const checkSettings = this.parseSettings(parts[checkIdx+1] || '');
            condition = checkSettings.expression || 'false';
          } else if (i + 1 < lines.length && lines[i+1].trim().startsWith('check')) {
            const nextLine = lines[i+1].trim();
            const nextParts = nextLine.split(TOKEN_REGEX);
            const nextCheckIdx = nextParts.indexOf('check');
            if (nextCheckIdx !== -1) {
              const checkSettings = this.parseSettings(nextParts[nextCheckIdx+1] || '');
              condition = checkSettings.expression || 'false';
              i++; // Consume the check line
            }
          }

          const isTrue = this.evaluateCondition(condition);
          
          let ifBlock: string[] = [];
          let elseBlock: string[] = [];
          let currentBlock = ifBlock;
          
          i++;
          while (i < lines.length) {
            const innerLine = lines[i].trim();
            if (innerLine === 'end' || innerLine.startsWith('end')) break;
            if (innerLine === 'else' || innerLine.startsWith('else')) {
              currentBlock = elseBlock;
              i++;
              continue;
            }
            currentBlock.push(lines[i]);
            i++;
          }
          
          if (isTrue) {
            const stopped = await this.runLines(ifBlock);
            if (stopped) return true;
          }
          else if (elseBlock.length > 0) {
            const stopped = await this.runLines(elseBlock);
            if (stopped) return true;
          }
          
          executed = true;
          break; // Break inner loop, i is already updated
        }
      }

      if (!executed) i++;
      else if (parts.indexOf('if') === -1) i++; // Only increment if not handled by block logic
    }
    return false;
  }

  async run(code: string) {
    this.stop();
    this.context.isRunning = true;
    this.context.output = [];
    this.context.entities = {};
    this.context.events = {};
    this.onUIUpdate(this.context.entities);
    
    const lines = code.split('\n');
    
    // Parse events
    let currentEvent: string | null = 'started?';
    let eventBlock: string[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line || line.startsWith('#')) continue;
      const parts = line.split(TOKEN_REGEX);
      
      let foundEvent = false;
      for (let j = 1; j < parts.length; j += 4) {
        const keyword = parts[j];
        if (['started?', 'created?', 'clicked?', 'collided?', 'key_pressed?', 'timer_tick?'].includes(keyword)) {
          if (currentEvent && eventBlock.length > 0) {
            this.context.events[currentEvent] = [...(this.context.events[currentEvent] || []), ...eventBlock];
          }
          
          const settings = this.parseSettings(parts[j+1] || '');
          const suffix = settings.target || settings.key || settings.name;
          currentEvent = (keyword === 'started?' || !suffix) ? keyword : `${keyword}_${suffix}`;
          eventBlock = [];
          foundEvent = true;
          break;
        } else if (keyword === 'end' && currentEvent) {
          this.context.events[currentEvent] = [...(this.context.events[currentEvent] || []), ...eventBlock];
          currentEvent = 'started?'; // Go back to collecting loose code in started?
          eventBlock = [];
          foundEvent = true;
          break;
        }
      }

      if (!foundEvent && currentEvent) {
        eventBlock.push(line);
      }
    }
    
    if (currentEvent && eventBlock.length > 0) {
      this.context.events[currentEvent] = [...(this.context.events[currentEvent] || []), ...eventBlock];
    }

    // Run started? block
    if (this.context.events['started?']) {
      await this.runLines(this.context.events['started?']);
    }
  }

  hasEvents(): boolean {
    return Object.values(this.context.events).some(lines => lines.length > 0);
  }

  stop() {
    this.context.isRunning = false;
    Object.values(this.context.timers).forEach(id => clearInterval(id));
    this.context.timers = {};
  }

  checkCollisions(mover: EPLEntity) {
    const moverX = mover.x || 0;
    const moverY = mover.y || 0;
    const moverW = mover.width || mover.size || 64;
    const moverH = mover.height || mover.size || 64;

    Object.values(this.context.entities).forEach(other => {
      if (other.id === mover.id) return;
      if (other.type === 'world') return;

      const otherX = other.x || 0;
      const otherY = other.y || 0;
      const otherW = other.width || other.size || 64;
      const otherH = other.height || other.size || 64;

      const isColliding = (
        moverX < otherX + otherW &&
        moverX + moverW > otherX &&
        moverY < otherY + otherH &&
        moverY + moverH > otherY
      );

      if (isColliding) {
        this.triggerEvent('collided?', mover.name);
        this.triggerEvent('collided?', other.name);
      }
    });
  }

  async triggerEvent(eventName: string, target?: string, value?: string) {
    if (!this.context.isRunning) return;
    
    this.context.lastEventValue = value || null;
    if (value !== undefined) {
      this.context.variables['last_event_value'] = value || null;
    }

    // Normalize target for keyboard events
    let normalizedTarget = target;
    if (eventName === 'key_pressed?' && target) {
      normalizedTarget = target.toLowerCase();
      // Map common keys
      if (target === ' ') normalizedTarget = 'space';
      if (target === 'ArrowUp') normalizedTarget = 'up';
      if (target === 'ArrowDown') normalizedTarget = 'down';
      if (target === 'ArrowLeft') normalizedTarget = 'left';
      if (target === 'ArrowRight') normalizedTarget = 'right';
    }

    // Try specific event first (e.g. key_pressed?_a)
    const specificKey = normalizedTarget ? `${eventName}_${normalizedTarget}` : eventName;
    if (this.context.events[specificKey]) {
      await this.runLines(this.context.events[specificKey]);
    }
    
    // Also try generic event if it's a different key (e.g. catch-all key_pressed?)
    if (normalizedTarget && specificKey !== eventName && this.context.events[eventName]) {
      await this.runLines(this.context.events[eventName]);
    }
  }
}
