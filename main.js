
// main.js - Electron App Brain

const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const { SerialPort } = require('serialport');
const { ReadlineParser } = require('@serialport/parser-readline');

// ======================= CONFIGURATION =======================
const WEBSITE_URL = 'https://attendance-hub-alpha.vercel.app'; 
// =============================================================

let mainWindow;
let port;
let parser;
let arduinoPortPath = null;

let commandQueue = [];
let isArduinoReadyForCommand = true; 

const isDev = !app.isPackaged;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
    },
    icon: path.join(__dirname, 'public/icon.png'),
    autoHideMenuBar: true,
  });

  mainWindow.loadURL(WEBSITE_URL);

  mainWindow.webContents.on('did-finish-load', () => {
    findAndConnectArduino();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

async function findAndConnectArduino() {
    if (!mainWindow || mainWindow.isDestroyed()) return;

    try {
        const ports = await SerialPort.list();
        
        const arduinoPortInfo = ports.find(p => {
            const manufacturer = (p.manufacturer || '').toLowerCase();
            const pnpId = (p.pnpId || '').toLowerCase();
            return pnpId.includes('vid_2341') || 
                   manufacturer.includes('arduino') ||
                   pnpId.includes('usb-serial') || 
                   pnpId.includes('ch340') ||      
                   pnpId.includes('cp210x') ||     
                   pnpId.includes('ftdi');        
        });

        if (arduinoPortInfo) {
            arduinoPortPath = arduinoPortInfo.path;
            setupSerialPort(arduinoPortPath);
        } else {
            if (mainWindow && !mainWindow.isDestroyed()) {
              mainWindow.webContents.send('arduino-status', { connected: false, message: 'Arduino Not Found. Please connect it.' });
            }
            setTimeout(findAndConnectArduino, 5000);
        }
    } catch (error) {
        if (mainWindow && !mainWindow.isDestroyed()) {
             dialog.showErrorBox('Serial Port Error', `An error occurred while searching for devices: ${error.message}`);
        }
    }
}

function setupSerialPort(portPath) {
    if (port && port.isOpen) {
        if (port.path === portPath) return; 
        port.close();
    }

    port = new SerialPort({ path: portPath, baudRate: 9600 });
    parser = port.pipe(new ReadlineParser({ delimiter: '\r\n' }));

    port.on('open', () => {
        console.log(`Serial Port ${portPath} opened.`);
    });

    port.on('error', (err) => {
        if (mainWindow && !mainWindow.isDestroyed()) {
             dialog.showErrorBox('Serial Port Error', `Could not connect to Attendance System on ${portPath}.`);
        }
    });
    
    port.on('close', () => {
        port = null; 
        if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('arduino-status', { connected: false, message: 'Disconnected. Re-scanning...' });
            setTimeout(findAndConnectArduino, 3000); 
        }
    });

    parser.on('data', (line) => {
        const response = line.trim();
        if (response) {
            if (response.includes("ARDUINO_READY")) {
                if (mainWindow && !mainWindow.isDestroyed()) {
                    mainWindow.webContents.send('arduino-status', { connected: true, message: `Connected to Attendance System.` });
                }
                isArduinoReadyForCommand = true;
                processCommandQueue();
            } else if (response.includes("SMS_SENT_OK") || response.includes("SMS_SENT_FAIL") || response.includes("ERR:Timeout_for")) {
                isArduinoReadyForCommand = true; 
                processCommandQueue();
            }

            if (mainWindow && !mainWindow.isDestroyed()) {
                mainWindow.webContents.send('arduino-response', response);
            }
        }
    });
}

function writeToArduino(command) {
    if (port && port.isOpen) {
        port.write(command + '\n', (err) => {
            if (err) {
                isArduinoReadyForCommand = true; 
            } else {
                const isSmsCommand = command.startsWith("P,") || command.startsWith("A,");
                if (isSmsCommand) {
                    isArduinoReadyForCommand = false; 
                }
            }
        });
    }
}

function processCommandQueue() {
    if (isArduinoReadyForCommand && commandQueue.length > 0) {
        const command = commandQueue.shift(); 
        writeToArduino(command);
    }
}

app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    if (port && port.isOpen) {
        port.close();
    }
    app.quit();
  }
});

ipcMain.on('send-sms-via-electron', (event, { students }) => {
    if (!port || !port.isOpen) return;
    
    commandQueue = []; 
    isArduinoReadyForCommand = true;

    if (students && students.length > 0) {
        const studentCommands = students.map(student => {
            const status_tag = student.status === 'present' ? 'P' : 'A';
            const name = student.name.replace(/\s/g, '_');
            const phone = student.phone.replace('+91', '');
            return `${status_tag},${name},${phone}`;
        });
        commandQueue.push(...studentCommands);
    }
    
    if (commandQueue.length > 0) {
        processCommandQueue(); 
    }
});

ipcMain.on('send-to-arduino', (event, command) => {
    writeToArduino(command);
});
