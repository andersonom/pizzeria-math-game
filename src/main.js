import { getLanguage, setLanguage, t, translatePage } from './i18n.js';

const LEVELS_URL = new URL('../data/levels.json', import.meta.url);
const CANVAS_SIZE = 720;
const CELL_SIZE = 42;
const BOARD_X = (CANVAS_SIZE - CELL_SIZE * 15) / 2;
const BOARD_Y = BOARD_X;

const state = {
  levels: [],
  levelIndex: 0,
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
  levelSelect: document.querySelector('#level-select'),
  timer: document.querySelector('#timer'),
  timerCard: document.querySelector('.timer-card'),
  phaseKicker: document.querySelector('#phase-kicker'),
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
  stars: document.querySelector('#stars'),
  nextButton: document.querySelector('#next-button'),
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
  }

  create() {
    state.scene = this;
    this.graphics = this.add.graphics();
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
        height: target.object.height
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
      state.drawing = { type: state.activeTool, start: cell, end: cell };
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
      state.rooms.push({
        id: createId(),
        type: state.drawing.type,
        ...rect
      });
      state.drawing = null;
      this.redraw();
      return;
    }
    if (state.moving) {
      state.moving = null;
      this.redraw();
    }
  }

  redraw() {
    if (!this.graphics) return;
    this.graphics.clear();
    this.labels.forEach((label) => label.destroy());
    this.labels = [];

    const level = currentLevel();
    if (!level) return;
    const width = level.grid.width;
    const height = level.grid.height;
    const g = this.graphics;

    g.fillStyle(0xfffdf7, 1).fillRect(BOARD_X, BOARD_Y, width * CELL_SIZE, height * CELL_SIZE);
    g.lineStyle(1, 0xe6e3d8, 1);
    for (let x = 0; x <= width; x++) {
      const lineX = BOARD_X + x * CELL_SIZE;
      g.lineBetween(lineX, BOARD_Y, lineX, BOARD_Y + height * CELL_SIZE);
    }
    for (let y = 0; y <= height; y++) {
      const lineY = BOARD_Y + y * CELL_SIZE;
      g.lineBetween(BOARD_X, lineY, BOARD_X + width * CELL_SIZE, lineY);
    }

    for (const room of state.rooms) this.drawRoom(room);
    for (const table of state.tables) this.drawTable(table);
    if (state.drawing) this.drawRoomPreview(state.drawing);
    if ((state.activeTool === 'table8' || state.activeTool === 'table4') && state.hoverCell && state.mode === 'playing') {
      this.drawTablePreview(state.activeTool, state.hoverCell);
    }
    this.drawBoardBorder(width, height);
  }

  drawRoom(room) {
    const style = roomColors[room.type];
    if (!style) return;
    const x = BOARD_X + room.x * CELL_SIZE + 2;
    const y = BOARD_Y + room.y * CELL_SIZE + 2;
    const w = room.width * CELL_SIZE - 4;
    const h = room.height * CELL_SIZE - 4;
    this.graphics.fillStyle(style.fill, .92).fillRoundedRect(x, y, w, h, 5);
    this.graphics.lineStyle(2, style.line, .95).strokeRoundedRect(x, y, w, h, 5);
    const text = room.width * room.height <= 4 ? style.icon : t(room.type).toLocaleUpperCase(getLanguage());
    const fontSize = Math.max(8, Math.min(11, Math.floor(Math.min(w, h) / (text.length > 3 ? 5.5 : 2.2))));
    this.addLabel(text, x + w / 2, y + h / 2, fontSize, '#473f36', Math.max(18, w - 5));
  }

  drawTable(table) {
    const x = BOARD_X + table.x * CELL_SIZE + 4;
    const y = BOARD_Y + table.y * CELL_SIZE + 4;
    const w = table.width * CELL_SIZE - 8;
    const h = table.height * CELL_SIZE - 8;
    this.graphics.fillStyle(table.type === 'table8' ? 0xf4d16e : 0xf8df91, 1).fillRoundedRect(x, y, w, h, 7);
    this.graphics.lineStyle(2, 0xa8752d, 1).strokeRoundedRect(x, y, w, h, 7);
    this.addLabel(table.seats, x + w / 2, y + h / 2, 15, '#6e4d20', w - 4);
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
    const measure = `${rect.width} × ${rect.height} m\n${area} m²`;
    this.addLabel(measure, x + w / 2, y + h / 2, Math.max(9, Math.min(13, CELL_SIZE / 3)), '#3b4538', Math.max(26, w - 4));
  }

  drawTablePreview(type, cell) {
    const size = getTableSize(type);
    const x = BOARD_X + cell.x * CELL_SIZE + 4;
    const y = BOARD_Y + cell.y * CELL_SIZE + 4;
    const w = size.width * CELL_SIZE - 8;
    const h = size.height * CELL_SIZE - 8;
    this.graphics.fillStyle(0xf4d16e, .48).fillRoundedRect(x, y, w, h, 7);
    this.graphics.lineStyle(2, 0xa8752d, .8).strokeRoundedRect(x, y, w, h, 7);
    this.addLabel(type === 'table8' ? '8' : '4', x + w / 2, y + h / 2, 14, '#6e4d20', w - 3);
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
    }).setOrigin(.5);
    this.labels.push(label);
  }
}

function currentLevel() {
  return state.levels[state.levelIndex] ?? null;
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
  target.collection.splice(target.index, 1);
}

function toggleTableRotation() {
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

function levelText(level, field) {
  return level.translations?.[getLanguage()]?.[field] ?? level[field];
}

function populateLevelSelect() {
  dom.levelSelect.replaceChildren();
  state.levels.forEach((level, index) => {
    const option = document.createElement('option');
    option.value = String(index);
    option.textContent = `${t('level')} ${index + 1} · ${levelText(level, 'title')}`;
    dom.levelSelect.append(option);
  });
  dom.levelSelect.value = String(state.levelIndex);
}

function selectLevel(index) {
  state.levelIndex = Number(index);
  state.rooms = [];
  state.tables = [];
  state.remainingMs = (currentLevel()?.timeLimitSeconds ?? 60) * 1000;
  state.mode = 'ready';
  state.activeTool = 'move';
  state.rotatedLargeTable = false;
  state.drawing = null;
  state.moving = null;
  state.hoverCell = null;
  dom.startOverlay.hidden = false;
  dom.resultOverlay.hidden = true;
  dom.levelSelect.value = String(index);
  updatePhaseDetails();
  updateTimerDisplay();
  updateToolUI();
  state.scene?.redraw();
}

function updatePhaseDetails() {
  const level = currentLevel();
  if (!level) return;
  const stageNumber = state.levelIndex + 1;
  dom.phaseKicker.textContent = `${t('level').toLocaleUpperCase(getLanguage())} ${stageNumber}`;
  dom.phaseTitle.textContent = levelText(level, 'title');
  dom.missionTitle.textContent = levelText(level, 'title');
  dom.missionDescription.textContent = levelText(level, 'description');
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
  dom.nextButton.hidden = state.levelIndex >= state.levels.length - 1;
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
  dom.levelSelect.disabled = state.mode === 'playing';
}

function startLevel() {
  state.remainingMs = currentLevel().timeLimitSeconds * 1000;
  state.mode = 'playing';
  dom.startOverlay.hidden = true;
  dom.resultOverlay.hidden = true;
  updateTimerDisplay();
  state.scene?.redraw();
}

function resetLevel() {
  selectLevel(state.levelIndex);
}

function finishLevel() {
  if (state.mode !== 'playing') return;
  state.remainingMs = 0;
  state.mode = 'result';
  const result = validateCurrentLevel();
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
  dom.nextButton.hidden = state.levelIndex >= state.levels.length - 1;
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
  document.querySelector('#retry-button').addEventListener('click', resetLevel);
  dom.nextButton.addEventListener('click', () => selectLevel((state.levelIndex + 1) % state.levels.length));
  dom.levelSelect.addEventListener('change', (event) => selectLevel(event.target.value));
}

function refreshLanguage() {
  document.querySelectorAll('[data-language]').forEach((button) => {
    const selected = button.dataset.language === getLanguage();
    button.classList.toggle('is-active', selected);
    button.setAttribute('aria-pressed', String(selected));
  });
  translatePage();
  populateLevelSelect();
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
    const response = await fetch(LEVELS_URL);
    if (!response.ok) throw new Error('levelError');
    const data = await response.json();
    if (!Array.isArray(data.levels) || data.levels.length === 0) throw new Error('invalidLevels');
    state.levels = data.levels;
    populateLevelSelect();
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
    selectLevel(0);
  } catch (error) {
    state.loadError = ['phaserError', 'invalidLevels'].includes(error.message) ? error.message : 'levelError';
    dom.loadError.textContent = t(state.loadError);
    dom.loadError.hidden = false;
    document.querySelector('.game-layout').hidden = true;
  }
}

initialize();
