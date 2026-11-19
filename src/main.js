import { getLanguage, setLanguage, t, translatePage } from './i18n.js';
import { generateRandomLevel } from './random-level.js';

const CONFIG_URL = new URL('../data/config.json', import.meta.url);
const CANVAS_SIZE = 720;
const CELL_SIZE = 42;
const BOARD_X = (CANVAS_SIZE - CELL_SIZE * 15) / 2;
const BOARD_Y = BOARD_X;

const state = {
  level: null,
  phaseNumber: 1,
  history: [],
  undoStack: [],
  mode: 'loading',
  loadError: null,
  remainingMs: 60_000,
  activeTool: 'move',
  rotatedLargeTable: false,
  rooms: [],
  tables: [],
  drawing: null,
  moving: null,
  hoverCell: null,
  scene: null,
  game: null
};

const dom = {
  languagePicker: document.querySelector('.language-picker'),
  measurementToggle: document.querySelector('#measurement-toggle'),
  timer: document.querySelector('#timer'),
  timerCard: document.querySelector('.timer-card'),
  phaseTitle: document.querySelector('#phase-title'),
  missionTitle: document.querySelector('#mission-title'),
  missionDescription: document.querySelector('#mission-description'),
  roomRules: document.querySelector('#room-rules'),
  tableRules: document.querySelector('#table-rules'),
  seatTarget: document.querySelector('#seat-target'),
  startOverlay: document.querySelector('#start-overlay'),
  resultOverlay: document.querySelector('#result-overlay'),
  resultTitle: document.querySelector('#result-title'),
  resultSummary: document.querySelector('#result-summary'),
  resultChecklist: document.querySelector('#result-checklist'),
  historyPanel: document.querySelector('#history-panel'),
  historyList: document.querySelector('#history-list'),
  stars: document.querySelector('#stars'),
  nextButton: document.querySelector('#next-button'),
  submitButton: document.querySelector('#submit-button'),
  undoButton: document.querySelector('#undo-button'),
  rotateButton: document.querySelector('#rotate-button'),
  toolHint: document.querySelector('#tool-hint'),
  boardSizeLabel: document.querySelector('#board-size-label'),
  loadError: document.querySelector('#load-error')
};

const roomColors = {
  kitchen: { fill: 0xf2c7a6, line: 0xb47d53, icon: '🍕' },
  bathroom: { fill: 0xb9dce1, line: 0x5b9aa4, icon: '◉' },
  entrance: { fill: 0xd8c8ed, line: 0x8a73ac, icon: '↗' }
};

class RestaurantScene extends (window.Phaser?.Scene ?? Object) {
  constructor() {
    super('RestaurantScene');
    this.graphics = null;
    this.labels = [];
    this.furniture = new Map();
    this.visibleFurniture = new Set();
    this.floors = new Map();
    this.visibleFloors = new Set();
    this.tableSprites = new Map();
    this.visibleTables = new Set();
  }

  preload() {
    const base = new URL('../tiles/modern-interiors/', import.meta.url).href;
    this.load.spritesheet('oven', base + 'oven.png', { frameWidth: 16, frameHeight: 32 });
    this.load.spritesheet('kitchen-sink', base + 'kitchen-sink.png', { frameWidth: 32, frameHeight: 16 });
    for (const name of ['toilet', 'bathroom-sink', 'wardrobe', 'register', 'table4', 'table8']) {
      this.load.image(name, base + name + '.png');
    }
    for (const name of ['kitchen', 'bathroom', 'entrance']) {
      this.load.image(name + '-floor', base + name + '-floor.png');
    }
  }

  create() {
    state.scene = this;
    this.graphics = this.add.graphics();
    for (const [key, end, frameRate] of [['oven', 5, 2], ['kitchen-sink', 2, 10]]) {
      if (!this.textures.exists(key)) continue;
      this.textures.get(key).setFilter(Phaser.Textures.FilterMode.NEAREST);
      this.anims.create({ key, frames: this.anims.generateFrameNumbers(key, { start: 0, end }), frameRate, repeat: -1 });
    }
    for (const key of ['toilet', 'bathroom-sink', 'wardrobe', 'register', 'table4', 'table8', 'kitchen-floor', 'bathroom-floor', 'entrance-floor']) {
      if (this.textures.exists(key)) this.textures.get(key).setFilter(Phaser.Textures.FilterMode.NEAREST);
    }
    this.input.on('pointerdown', (pointer) => this.handlePointerDown(pointer));
    this.input.on('pointermove', (pointer) => this.handlePointerMove(pointer));
    this.input.on('pointerup', () => this.handlePointerUp());
    this.input.keyboard?.on('keydown-R', () => {
      if (state.activeTool === 'table8') toggleTableRotation();
    });
    this.redraw();
    window.render_game_to_text = renderGameToText;
    window.advanceTime = (milliseconds) => {
      if (state.scene) state.scene.advanceTime(milliseconds);
    };
  }

  update(_time, delta) {
    this.advanceTime(delta);
  }

  advanceTime(milliseconds) {
    if (state.mode !== 'playing') return;
    state.remainingMs = Math.max(0, state.remainingMs - Math.max(0, milliseconds));
    updateTimerDisplay();
    if (state.remainingMs <= 0) finishLevel();
  }

  pointToCell(pointer) {
    const x = Math.floor((pointer.x - BOARD_X) / CELL_SIZE);
    const y = Math.floor((pointer.y - BOARD_Y) / CELL_SIZE);
    const level = currentLevel();
    if (!level || x < 0 || y < 0 || x >= level.grid.width || y >= level.grid.height) return null;
    return { x, y };
  }

  handlePointerDown(pointer) {
    if (state.mode !== 'playing') return;
    const cell = this.pointToCell(pointer);
    if (!cell) return;

    if (state.activeTool === 'move') {
      const target = findObjectAt(cell);
      if (!target) return;
      state.moving = {
        object: target.object,
        startCell: cell,
        startX: target.object.x,
        startY: target.object.y,
        width: target.object.width,
        height: target.object.height,
        before: captureBoardState()
      };
      this.redraw();
      return;
    }

    if (state.activeTool === 'erase') {
      eraseObjectAt(cell);
      this.redraw();
      return;
    }

    if (roomColors[state.activeTool]) {
      state.drawing = { type: state.activeTool, start: cell, end: cell, before: captureBoardState() };
      this.redraw();
      return;
    }

    if (state.activeTool === 'table8' || state.activeTool === 'table4') {
      addTableAt(state.activeTool, cell);
      this.redraw();
    }
  }

  handlePointerMove(pointer) {
    const cell = this.pointToCell(pointer);
    state.hoverCell = cell;
    let changed = false;

    if (state.drawing && cell) {
      state.drawing.end = cell;
      changed = true;
    }

    if (state.moving && cell) {
      const { object, startCell, startX, startY, width, height } = state.moving;
      const level = currentLevel();
      const x = startX + cell.x - startCell.x;
      const y = startY + cell.y - startCell.y;
      object.x = clamp(x, 0, level.grid.width - width);
      object.y = clamp(y, 0, level.grid.height - height);
      changed = true;
    } else if (state.activeTool === 'table8' || state.activeTool === 'table4') {
      changed = true;
    }

    if (changed) this.redraw();
  }

  handlePointerUp() {
    if (state.drawing) {
      const rect = rectangleFromCells(state.drawing.start, state.drawing.end);
      state.undoStack.push(state.drawing.before);
      state.rooms.push({
        id: createId(),
        type: state.drawing.type,
        ...rect
      });
      state.drawing = null;
      updateUndoButton();
      this.redraw();
      return;
    }
    if (state.moving) {
      const { object, startX, startY, before } = state.moving;
      if (object.x !== startX || object.y !== startY) state.undoStack.push(before);
      state.moving = null;
      updateUndoButton();
      this.redraw();
    }
  }

  redraw() {
    if (!this.graphics) return;
    this.graphics.clear();
    this.visibleFurniture.clear();
    this.visibleFloors.clear();
    this.visibleTables.clear();
    this.labels.forEach((label) => label.destroy());
    this.labels = [];

    const level = currentLevel();
    if (!level) return;
    const width = level.grid.width;
    const height = level.grid.height;
    const g = this.graphics;

    g.lineStyle(1, 0x756e60, .3);
    for (let x = 0; x <= width; x++) {
      const lineX = BOARD_X + x * CELL_SIZE;
      g.lineBetween(lineX, BOARD_Y, lineX, BOARD_Y + height * CELL_SIZE);
    }
    for (let y = 0; y <= height; y++) {
      const lineY = BOARD_Y + y * CELL_SIZE;
      g.lineBetween(BOARD_X, lineY, BOARD_X + width * CELL_SIZE, lineY);
    }

    for (const room of state.rooms) this.drawRoom(room);
    for (const [key, floor] of this.floors) {
      if (this.visibleFloors.has(key)) continue;
      floor.destroy();
      this.floors.delete(key);
    }
    for (const [key, sprite] of this.furniture) {
      if (this.visibleFurniture.has(key)) continue;
      sprite.destroy();
      this.furniture.delete(key);
    }
    for (const table of state.tables) this.drawTable(table);
    if (state.drawing) this.drawRoomPreview(state.drawing);
    if ((state.activeTool === 'table8' || state.activeTool === 'table4') && state.hoverCell && state.mode === 'playing') {
      this.drawTablePreview(state.activeTool, state.hoverCell);
    }
    this.drawBoardBorder(width, height);
    for (const [key, sprite] of this.tableSprites) {
      if (this.visibleTables.has(key)) continue;
      sprite.destroy();
      this.tableSprites.delete(key);
    }
  }

  drawRoom(room) {
    const style = roomColors[room.type];
    if (!style) return;
    const x = BOARD_X + room.x * CELL_SIZE + 2;
    const y = BOARD_Y + room.y * CELL_SIZE + 2;
    const w = room.width * CELL_SIZE - 4;
    const h = room.height * CELL_SIZE - 4;
    this.drawFloor(room.id, room.type + '-floor', x, y, w, h, -1);
    this.graphics.fillStyle(style.fill, .18).fillRoundedRect(x, y, w, h, 5);
    this.graphics.lineStyle(2, style.line, .95).strokeRoundedRect(x, y, w, h, 5);
    this.drawRoomFurniture(room, x, y, w, h);
  }

  drawFloor(key, texture, x, y, width, height, depth) {
    if (!this.textures.exists(texture)) return;
    this.visibleFloors.add(key);
    let floor = this.floors.get(key);
    if (!floor) {
      floor = this.add.tileSprite(x, y, width, height, texture)
        .setOrigin(0).setDepth(depth).setTileScale(CELL_SIZE / 16);
      this.floors.set(key, floor);
    }
    floor.setPosition(x, y).setSize(width, height);
  }

  drawRoomFurniture(room, x, y, width, height) {
    const horizontal = width >= height;
    const fixtures = room.type === 'kitchen' ? ['kitchen-sink', 'oven']
      : room.type === 'entrance' ? ['wardrobe', 'register', 'wardrobe'] : ['bathroom-sink', 'toilet'];
    fixtures.forEach((texture, index) => {
      if (!this.textures.exists(texture)) return;
      const key = `${room.id}:${index}`;
      this.visibleFurniture.add(key);
      let sprite = this.furniture.get(key);
      if (!sprite) {
        sprite = this.add.sprite(0, 0, texture).setDepth(1);
        this.furniture.set(key, sprite);
        if (this.anims.exists(texture)) sprite.play(texture);
      }
      const fraction = .2 + index * .6 / (fixtures.length - 1);
      sprite.setPosition(
        x + width * (horizontal ? fraction : .5),
        y + height * (horizontal ? .5 : fraction)
      );
      const slotSize = .8 / fixtures.length;
      const maxWidth = Math.min(72, width * (horizontal ? slotSize : .8));
      const maxHeight = Math.min(72, height * (horizontal ? .8 : slotSize));
      sprite.setScale(Math.min(maxWidth / sprite.width, maxHeight / sprite.height));
    });
  }
  drawTable(table, preview = false) {
    if (!this.textures.exists(table.type)) return;
    const key = preview ? 'preview' : table.id;
    this.visibleTables.add(key);
    let sprite = this.tableSprites.get(key);
    if (!sprite) {
      sprite = this.add.image(0, 0, table.type).setDepth(1);
      this.tableSprites.set(key, sprite);
    }
    sprite.setTexture(table.type);
    const horizontal = table.type === 'table8' && table.width > table.height;
    const width = table.width * CELL_SIZE - 4;
    const height = table.height * CELL_SIZE - 4;
    sprite.setRotation(horizontal ? Math.PI / 2 : 0);
    sprite.setDisplaySize(horizontal ? height : width, horizontal ? width : height);
    sprite.setPosition(
      BOARD_X + (table.x + table.width / 2) * CELL_SIZE,
      BOARD_Y + (table.y + table.height / 2) * CELL_SIZE
    );
    sprite.setAlpha(preview ? .5 : 1);
  }

  drawRoomPreview(drawing) {
    const rect = rectangleFromCells(drawing.start, drawing.end);
    const style = roomColors[drawing.type];
    const x = BOARD_X + rect.x * CELL_SIZE + 3;
    const y = BOARD_Y + rect.y * CELL_SIZE + 3;
    const w = rect.width * CELL_SIZE - 6;
    const h = rect.height * CELL_SIZE - 6;
    this.graphics.fillStyle(style.fill, .58).fillRect(x, y, w, h);
    this.graphics.lineStyle(2, style.line, 1).strokeRect(x, y, w, h);
    const area = rect.width * rect.height;
    const measure = state.showArea
      ? `${rect.width} × ${rect.height} m\n${area} m²`
      : `${rect.width} × ${rect.height} m`;
    this.addLabel(measure, x + w / 2, y + h / 2, Math.max(9, Math.min(13, CELL_SIZE / 3)), '#3b4538', Math.max(26, w - 4));
  }

  drawTablePreview(type, cell) {
    const size = getTableSize(type);
    this.drawTable({ type, ...cell, ...size }, true);
  }

  drawBoardBorder(width, height) {
    this.graphics.lineStyle(2, 0xc9c5b9, 1).strokeRect(BOARD_X, BOARD_Y, width * CELL_SIZE, height * CELL_SIZE);
  }

  addLabel(text, x, y, fontSize, color, wrapWidth) {
    const label = this.add.text(x, y, String(text), {
      fontFamily: 'DM Sans, sans-serif',
      fontSize: `${fontSize}px`,
      fontStyle: 'bold',
      color,
      align: 'center',
      lineSpacing: -2,
      wordWrap: { width: wrapWidth, useAdvancedWrap: true }
    }).setOrigin(.5).setDepth(2);
    this.labels.push(label);
  }
}

function currentLevel() {
  return state.level;
}

function captureBoardState() {
  return {
    rooms: state.rooms.map((room) => ({ ...room })),
    tables: state.tables.map((table) => ({ ...table })),
    rotatedLargeTable: state.rotatedLargeTable
  };
}

function restoreBoardState(snapshot) {
  state.rooms = snapshot.rooms.map((room) => ({ ...room }));
  state.tables = snapshot.tables.map((table) => ({ ...table }));
  state.rotatedLargeTable = snapshot.rotatedLargeTable;
}

function updateUndoButton() {
  dom.undoButton.disabled = state.mode !== 'playing' || state.undoStack.length === 0;
}

function undoLastChange() {
  if (state.mode !== 'playing' || state.undoStack.length === 0) return;
  restoreBoardState(state.undoStack.pop());
  state.drawing = null;
  state.moving = null;
  state.hoverCell = null;
  updateUndoButton();
  state.scene?.redraw();
}

function createId() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function rectangleFromCells(start, end) {
  const x = Math.min(start.x, end.x);
  const y = Math.min(start.y, end.y);
  return {
    x,
    y,
    width: Math.abs(start.x - end.x) + 1,
    height: Math.abs(start.y - end.y) + 1
  };
}

function getTableSize(type) {
  const definition = currentLevel()?.tables.find((table) => table.type === type);
  if (!definition) return { width: 1, height: 1, seats: type === 'table8' ? 8 : 4 };
  const rotate = type === 'table8' && state.rotatedLargeTable && definition.width !== definition.height;
  return {
    width: rotate ? definition.height : definition.width,
    height: rotate ? definition.width : definition.height,
    seats: definition.seats
  };
}

function addTableAt(type, cell) {
  const size = getTableSize(type);
  state.undoStack.push(captureBoardState());
  state.tables.push({
    id: createId(),
    type,
    seats: size.seats,
    x: cell.x,
    y: cell.y,
    width: size.width,
    height: size.height
  });
}

function findObjectAt(cell) {
  for (let index = state.tables.length - 1; index >= 0; index--) {
    const table = state.tables[index];
    if (pointInsideRect(cell, table)) return { object: table, collection: state.tables, index };
  }
  for (let index = state.rooms.length - 1; index >= 0; index--) {
    const room = state.rooms[index];
    if (pointInsideRect(cell, room)) return { object: room, collection: state.rooms, index };
  }
  return null;
}

function pointInsideRect(point, rect) {
  return point.x >= rect.x && point.y >= rect.y && point.x < rect.x + rect.width && point.y < rect.y + rect.height;
}

function eraseObjectAt(cell) {
  const target = findObjectAt(cell);
  if (!target) return;
  state.undoStack.push(captureBoardState());
  target.collection.splice(target.index, 1);
  updateUndoButton();
}

function toggleTableRotation() {
  if (state.mode === 'playing') state.undoStack.push(captureBoardState());
  state.rotatedLargeTable = !state.rotatedLargeTable;
  updateToolUI();
  state.scene?.redraw();
}

function selectTool(tool) {
  state.activeTool = tool;
  state.hoverCell = null;
  updateToolUI();
  state.scene?.redraw();
}

function updateToolUI() {
  document.querySelectorAll('[data-tool]').forEach((button) => {
    const active = button.dataset.tool === state.activeTool;
    button.classList.toggle('is-active', active);
    button.setAttribute('aria-pressed', String(active));
  });
  dom.rotateButton.hidden = state.activeTool !== 'table8';
  document.querySelector('#rotate-label').textContent = t(state.rotatedLargeTable ? 'horizontal' : 'rotate');
  dom.toolHint.textContent = t(`${state.activeTool}Hint`);
}

function resetLevel() {
  state.rooms = [];
  state.tables = [];
  state.undoStack = [];
  state.remainingMs = (currentLevel()?.timeLimitSeconds ?? 60) * 1000;
  state.mode = 'ready';
  state.activeTool = 'move';
  state.rotatedLargeTable = false;
  state.drawing = null;
  state.moving = null;
  state.hoverCell = null;
  state.showArea = currentLevel()?.showArea ?? true;
  dom.measurementToggle.checked = state.showArea;
  dom.startOverlay.hidden = false;
  dom.resultOverlay.hidden = true;
  updatePhaseDetails();
  updateTimerDisplay();
  updateToolUI();
  state.scene?.redraw();
}

function updatePhaseDetails() {
  const level = currentLevel();
  if (!level) return;
  dom.phaseTitle.textContent = `${t('level')} ${state.phaseNumber}`;
  dom.missionTitle.textContent = t('rules');
  dom.missionDescription.textContent = t('randomDescription');
  dom.boardSizeLabel.textContent = t('gridSize', level.grid);
  document.querySelector('#game').setAttribute('aria-label', t('gridLabel', level.grid));
  document.querySelector('#start-description').textContent = t('startDescription', { seconds: level.timeLimitSeconds });
  document.querySelector('#spacing-note').textContent = t('spacingNote', { distance: level.minimumTableDistanceMeters });
  dom.roomRules.replaceChildren();
  level.rooms.forEach((room) => {
    const item = document.createElement('li');
    const icon = document.createElement('span');
    icon.className = 'rule-icon';
    icon.textContent = roomColors[room.type]?.icon ?? '▦';
    const text = document.createElement('span');
    const strong = document.createElement('strong');
    const roomName = room.type === 'bathroom' && room.count > 1 ? 'bathrooms' : room.type;
    strong.textContent = t('pieceCount', { count: room.count, label: roomColors[room.type] ? t(roomName) : room.label });
    const small = document.createElement('small');
    if (room.type === 'kitchen') small.textContent = `${room.width} × ${room.height} m`;
    else if (roomColors[room.type]) small.textContent = t(`${room.type}Size`, { area: room.areaM2 });
    else small.textContent = `${room.areaM2} m²`;
    text.append(strong, small);
    item.append(icon, text);
    dom.roomRules.append(item);
  });

  dom.tableRules.replaceChildren();
  dom.seatTarget.textContent = t('seats', { count: level.targetSeats });
}

function formatTime(milliseconds) {
  const seconds = Math.ceil(milliseconds / 1000);
  const minutesPart = Math.floor(seconds / 60).toString().padStart(2, '0');
  const secondsPart = (seconds % 60).toString().padStart(2, '0');
  return `${minutesPart}:${secondsPart}`;
}

function updateTimerDisplay() {
  dom.timer.textContent = formatTime(state.remainingMs);
  dom.timerCard.classList.toggle('is-urgent', state.mode === 'playing' && state.remainingMs <= 10_000);
  dom.submitButton.disabled = state.mode !== 'playing';
  updateUndoButton();
}

function startLevel() {
  state.remainingMs = currentLevel().timeLimitSeconds * 1000;
  state.mode = 'playing';
  dom.startOverlay.hidden = true;
  dom.resultOverlay.hidden = true;
  updateTimerDisplay();
  state.scene?.redraw();
}

function nextLevel() {
  state.level = generateRandomLevel(currentLevel());
  state.phaseNumber += 1;
  resetLevel();
}

function finishLevel() {
  if (state.mode !== 'playing') return;
  state.remainingMs = 0;
  state.mode = 'result';
  const result = validateCurrentLevel();
  recordResult(result.stars);
  showResult(result);
  updateTimerDisplay();
  state.scene?.redraw();
}

function validateCurrentLevel() {
  const level = currentLevel();
  const grid = level.grid;
  const roomBoundsPass = state.rooms.every((room) => rectInsideBoard(room, grid));
  const roomCollisions = hasAnyOverlap(state.rooms);
  const roomTargetsPass = level.rooms.every((target) => {
    const placements = state.rooms.filter((room) => room.type === target.type);
    if (placements.length !== target.count) return false;
    return placements.every((room) => {
      if (room.type === 'kitchen') {
        return (room.width === target.width && room.height === target.height)
          || (room.width === target.height && room.height === target.width);
      }
      return room.width * room.height === target.areaM2;
    });
  });
  const roomTypesExpected = new Set(level.rooms.map((room) => room.type));
  const noExtraRoomTypes = state.rooms.every((room) => roomTypesExpected.has(room.type));
  const expectedRoomArea = level.rooms.reduce((sum, room) => sum + room.count * room.areaM2, 0);
  const uniqueRoomCells = countUniqueOccupiedCells(state.rooms, grid);
  const actualDiningArea = grid.width * grid.height - uniqueRoomCells;
  const expectedDiningArea = grid.width * grid.height - expectedRoomArea;
  const diningAreaPass = actualDiningArea === expectedDiningArea;
  const roomsPass = roomBoundsPass && !roomCollisions && roomTargetsPass && noExtraRoomTypes && diningAreaPass;

  const tableCountsPass = state.tables.every((table) => level.tables.some((target) => target.type === table.type));
  const actualSeats = state.tables.reduce((sum, table) => sum + table.seats, 0);
  const seatTotalPass = actualSeats === level.targetSeats;
  const tableGeometryPass = state.tables.every((table) => {
    const definition = level.tables.find((target) => target.type === table.type);
    if (!definition) return false;
    return (table.width === definition.width && table.height === definition.height)
      || (table.width === definition.height && table.height === definition.width);
  });
  const tablesOverlap = hasAnyOverlap(state.tables);
  const tablesInRooms = state.tables.some((table) => state.rooms.some((room) => rectanglesOverlap(table, room)));
  const tablesBoundsPass = state.tables.every((table) => rectInsideBoard(table, grid));
  const tablesInsidePass = tablesBoundsPass && !tablesOverlap && !tablesInRooms;
  const distance = level.minimumTableDistanceMeters;
  const spacingPass = tableSpacingPass(state.tables, distance, grid.metersPerCell);
  const tablesPass = tableCountsPass && seatTotalPass && tableGeometryPass;
  const placementPass = state.tables.length > 0 && tablesInsidePass && spacingPass;
  const placementIssues = [];
  if (state.tables.length === 0) placementIssues.push(t('noTables'));
  if (!tablesBoundsPass) placementIssues.push(t('outsideTables'));
  if (tablesOverlap) placementIssues.push(t('overlappingTables'));
  if (tablesInRooms) placementIssues.push(t('tablesInsideRooms'));
  if (!spacingPass) placementIssues.push(t('spacingFailed', { distance }));

  return {
    stars: Number(roomsPass) + Number(tablesPass) + Number(placementPass),
    checks: [
      {
        pass: roomsPass,
        title: t('roomsAndAreas'),
        detail: roomsPass
          ? t('roomsPassed', { actual: actualDiningArea })
          : t('roomsFailed', { actual: actualDiningArea, expected: expectedDiningArea })
      },
      {
        pass: tablesPass,
        title: t('tablesAndSeats'),
        detail: tablesPass
          ? t('tablesPassed', { actual: actualSeats })
          : t('tablesFailed', { actual: actualSeats, expected: level.targetSeats })
      },
      {
        pass: placementPass,
        title: t('placement'),
        detail: placementPass
          ? t('placementPassed', { distance })
          : placementIssues.join(' ')
      }
    ]
  };
}

function recordResult(stars) {
  const previous = state.history.find((entry) => entry.phaseNumber === state.phaseNumber);
  if (previous) {
    previous.stars = Math.max(previous.stars, stars);
  } else {
    state.history.push({ phaseNumber: state.phaseNumber, stars });
    state.history = state.history.slice(-10);
  }
  renderHistory();
}

function renderHistory() {
  dom.historyPanel.hidden = state.history.length === 0;
  dom.historyList.replaceChildren();
  for (const entry of [...state.history].reverse()) {
    const item = document.createElement('li');
    const label = document.createElement('span');
    label.textContent = `${t('level')} ${entry.phaseNumber}`;
    const score = document.createElement('span');
    score.className = 'history-stars';
    score.setAttribute('role', 'img');
    score.setAttribute('aria-label', t('stars', { count: entry.stars }));
    for (let index = 0; index < 3; index++) {
      const star = document.createElement('span');
      star.textContent = '★';
      star.setAttribute('aria-hidden', 'true');
      if (index >= entry.stars) star.className = 'empty-star';
      score.append(star);
    }
    item.append(label, score);
    dom.historyList.append(item);
  }
}

function showResult(result) {
  dom.resultTitle.textContent = result.stars === 3 ? t('allStars') : result.stars > 0 ? t('someStars') : t('zeroStars');
  dom.resultSummary.textContent = result.stars === 3
    ? t('success')
    : t('tryAnotherLayout');
  dom.stars.replaceChildren();
  for (let index = 0; index < 3; index++) {
    const star = document.createElement('span');
    star.textContent = '★';
    if (index >= result.stars) star.className = 'empty-star';
    dom.stars.append(star);
  }
  dom.stars.setAttribute('aria-label', t('stars', { count: result.stars }));
  dom.resultChecklist.replaceChildren();
  result.checks.forEach((check) => {
    const item = document.createElement('li');
    item.className = check.pass ? 'pass' : 'fail';
    const symbol = document.createElement('span');
    symbol.className = 'check-symbol';
    symbol.textContent = check.pass ? '✓' : '×';
    const text = document.createElement('span');
    const strong = document.createElement('strong');
    strong.textContent = check.title;
    const detail = document.createElement('span');
    detail.textContent = check.detail;
    text.append(strong, document.createElement('br'), detail);
    item.append(symbol, text);
    dom.resultChecklist.append(item);
  });
  dom.resultOverlay.hidden = false;
}

function rectInsideBoard(rect, grid) {
  return rect.x >= 0 && rect.y >= 0 && rect.width > 0 && rect.height > 0
    && rect.x + rect.width <= grid.width && rect.y + rect.height <= grid.height;
}

function rectanglesOverlap(a, b) {
  return a.x < b.x + b.width && a.x + a.width > b.x
    && a.y < b.y + b.height && a.y + a.height > b.y;
}

function hasAnyOverlap(rectangles) {
  for (let first = 0; first < rectangles.length; first++) {
    for (let second = first + 1; second < rectangles.length; second++) {
      if (rectanglesOverlap(rectangles[first], rectangles[second])) return true;
    }
  }
  return false;
}

function countUniqueOccupiedCells(rectangles, grid) {
  const occupied = new Set();
  rectangles.forEach((rect) => {
    for (let y = Math.max(0, rect.y); y < Math.min(grid.height, rect.y + rect.height); y++) {
      for (let x = Math.max(0, rect.x); x < Math.min(grid.width, rect.x + rect.width); x++) {
        occupied.add(`${x},${y}`);
      }
    }
  });
  return occupied.size;
}

function edgeDistance(a, b, metersPerCell = 1) {
  const horizontalGap = Math.max(0, a.x - (b.x + b.width), b.x - (a.x + a.width));
  const verticalGap = Math.max(0, a.y - (b.y + b.height), b.y - (a.y + a.height));
  return Math.hypot(horizontalGap, verticalGap) * metersPerCell;
}

function tableSpacingPass(tables, minimumDistance, metersPerCell) {
  for (let first = 0; first < tables.length; first++) {
    for (let second = first + 1; second < tables.length; second++) {
      if (edgeDistance(tables[first], tables[second], metersPerCell) + 1e-9 < minimumDistance) return false;
    }
  }
  return true;
}

function renderGameToText() {
  const level = currentLevel();
  if (!level) return JSON.stringify({ mode: state.mode });
  return JSON.stringify({
    mode: state.mode,
    language: getLanguage(),
    coordinateSystem: 'Cells are zero-based; x increases right, y increases down; room/table sizes are in 1m cells.',
    level: level.id,
    phaseNumber: state.phaseNumber,
    history: state.history,
    undoAvailable: state.undoStack.length > 0,
    timerSeconds: Math.ceil(state.remainingMs / 1000),
    selectedTool: state.activeTool,
    grid: level.grid,
    rooms: state.rooms.map(({ type, x, y, width, height }) => ({ type, x, y, width, height })),
    tables: state.tables.map(({ type, seats, x, y, width, height }) => ({ type, seats, x, y, width, height }))
  });
}

function connectControls() {
  document.querySelectorAll('[data-tool]').forEach((button) => {
    button.addEventListener('click', () => selectTool(button.dataset.tool));
  });
  dom.rotateButton.addEventListener('click', toggleTableRotation);
  document.querySelector('#start-button').addEventListener('click', startLevel);
  document.querySelector('#restart-button').addEventListener('click', resetLevel);
  dom.submitButton.addEventListener('click', finishLevel);
  dom.undoButton.addEventListener('click', undoLastChange);
  document.querySelector('#retry-button').addEventListener('click', resetLevel);
  dom.nextButton.addEventListener('click', nextLevel);
  dom.measurementToggle.addEventListener('change', () => {
    state.showArea = dom.measurementToggle.checked;
    state.scene?.redraw();
  });
}

function refreshLanguage() {
  document.querySelectorAll('[data-language]').forEach((button) => {
    const selected = button.dataset.language === getLanguage();
    button.classList.toggle('is-active', selected);
    button.setAttribute('aria-pressed', String(selected));
  });
  translatePage();
  renderHistory();
  updatePhaseDetails();
  updateToolUI();
  if (state.mode === 'result') showResult(validateCurrentLevel());
  if (state.loadError) dom.loadError.textContent = t(state.loadError);
  state.scene?.redraw();
}

async function initialize() {
  dom.languagePicker.addEventListener('click', (event) => {
    const button = event.target.closest('[data-language]');
    if (!button) return;
    setLanguage(button.dataset.language);
    refreshLanguage();
  });
  refreshLanguage();
  try {
    if (!window.Phaser) throw new Error('phaserError');
    const response = await fetch(CONFIG_URL);
    if (!response.ok) throw new Error('levelError');
    const data = await response.json();
    const settings = data.config;
    if (!settings || typeof settings !== 'object' || Array.isArray(settings)) throw new Error('invalidLevels');
    state.level = generateRandomLevel(settings);
    connectControls();
    state.game = new Phaser.Game({
      type: Phaser.AUTO,
      parent: 'game',
      width: CANVAS_SIZE,
      height: CANVAS_SIZE,
      backgroundColor: '#fffdf7',
      scene: [RestaurantScene],
      scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH,
        width: CANVAS_SIZE,
        height: CANVAS_SIZE
      },
      render: { antialias: true, pixelArt: false, roundPixels: true }
    });
    resetLevel();
  } catch (error) {
    state.loadError = ['phaserError', 'invalidLevels'].includes(error.message) ? error.message : 'levelError';
    dom.loadError.textContent = t(state.loadError);
    dom.loadError.hidden = false;
    document.querySelector('.game-layout').hidden = true;
  }
}

initialize();
