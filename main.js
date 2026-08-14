const { app, BrowserWindow, Tray, Menu, ipcMain, screen, nativeImage } = require('electron');
const path = require('path');

let win = null;
let tray = null;
let visible = true;
let interactive = false;
let lastApplied = 0;
let cursorTimer = null;
let ballRegion = { x: -9999, y: -9999, r: 0, holding: false };

// Tray icons must be real bitmaps; draw a tiny "ball on a string" into a BGRA buffer.
function createTrayIcon() {
  const size = 32;
  const buf = Buffer.alloc(size * size * 4, 0);
  const put = (x, y, r, g, b) => {
    if (x < 0 || y < 0 || x >= size || y >= size) return;
    const i = (y * size + x) * 4;
    buf[i] = b;
    buf[i + 1] = g;
    buf[i + 2] = r;
    buf[i + 3] = 255;
  };

  for (let y = 2; y <= 18; y++) {
    put(size / 2 - 1, y, 200, 210, 225);
    put(size / 2, y, 200, 210, 225);
  }

  const cx = size / 2 - 0.5;
  const cy = 22.5;
  const radius = 7;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const d = Math.hypot(x - cx, y - cy);
      if (d <= radius - 2) put(x, y, 96, 200, 255);
      else if (d <= radius) put(x, y, 40, 130, 200);
    }
  }

  return nativeImage.createFromBitmap(buf, { width: size, height: size, scaleFactor: 1 });
}

function createWindow() {
  const bounds = screen.getPrimaryDisplay().bounds;

  win = new BrowserWindow({
    x: bounds.x,
    y: bounds.y,
    width: bounds.width,
    height: bounds.height,
    frame: false,
    transparent: true,
    resizable: false,
    movable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    skipTaskbar: true,
    focusable: true,
    hasShadow: false,
    alwaysOnTop: true,
    backgroundColor: '#00000000',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      backgroundThrottling: false
    }
  });

  win.setAlwaysOnTop(true, 'screen-saver');
  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  setInteractive(false, true);
  win.loadFile(path.join(__dirname, 'renderer', 'index.html'));

  win.on('show', () => setInteractive(interactive, true));
  win.on('restore', () => setInteractive(interactive, true));

  win.on('closed', () => {
    win = null;
  });
}

// The window is click-through except when the cursor is over the ball. Windows silently resets
// this ex-style behind our back (tray menus, show/hide), so re-apply it at least twice a second.
function setInteractive(next, force = false) {
  if (!win || win.isDestroyed()) return;
  if (!force && next === interactive && Date.now() - lastApplied < 400) return;
  interactive = next;
  lastApplied = Date.now();
  win.setIgnoreMouseEvents(!next);
}

// Cursor position comes straight from the OS, so it keeps working no matter what happens to the
// window's input state.
function pollCursor() {
  if (!win || win.isDestroyed() || !visible) return;

  const point = screen.getCursorScreenPoint();
  const bounds = win.getBounds();
  const x = point.x - bounds.x;
  const y = point.y - bounds.y;
  const inside = x >= 0 && y >= 0 && x < bounds.width && y < bounds.height;
  const overBall = inside && Math.hypot(x - ballRegion.x, y - ballRegion.y) <= ballRegion.r;

  setInteractive(ballRegion.holding || overBall);
  win.webContents.send('overlay:cursor', { x, y, inside });
}

function repositionToPrimaryDisplay() {
  if (!win) return;
  const bounds = screen.getPrimaryDisplay().bounds;
  win.setBounds(bounds);
}

function send(command) {
  if (win) win.webContents.send('overlay:command', command);
}

function setVisible(next) {
  if (!win) return;
  visible = next;
  if (visible) {
    win.showInactive();
    win.setAlwaysOnTop(true, 'screen-saver');
    setInteractive(false, true);
  } else {
    win.hide();
  }
  buildTrayMenu();
}

function buildTrayMenu() {
  if (!tray) return;
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: visible ? 'Hide the ball' : 'Show the ball', click: () => setVisible(!visible) },
      { type: 'separator' },
      { label: 'Reset position', click: () => send('reset') },
      { label: 'Give it a swing', click: () => send('swing') },
      { label: 'Longer string', click: () => send('longer') },
      { label: 'Shorter string', click: () => send('shorter') },
      { type: 'separator' },
      { label: 'Quit', click: () => app.quit() }
    ])
  );
}

function createTray() {
  tray = new Tray(createTrayIcon());
  tray.setToolTip('Fidgetball - drag the ball, it swings.');
  tray.on('click', () => setVisible(!visible));
  buildTrayMenu();
}

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.whenReady().then(() => {
    createWindow();
    createTray();
    cursorTimer = setInterval(pollCursor, 16);

    screen.on('display-metrics-changed', repositionToPrimaryDisplay);
    screen.on('display-added', repositionToPrimaryDisplay);
    screen.on('display-removed', repositionToPrimaryDisplay);
  });
}

ipcMain.on('overlay:ball', (_event, region) => {
  ballRegion = region;
});

app.on('before-quit', () => {
  if (cursorTimer) clearInterval(cursorTimer);
});

// Keep running in the tray even if the overlay window goes away.
app.on('window-all-closed', () => {});
