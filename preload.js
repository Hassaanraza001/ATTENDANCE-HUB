// preload.js

const { contextBridge, ipcRenderer } = require('electron');

// 'api' object ko window object par expose karna
contextBridge.exposeInMainWorld('api', {
  // === NEW: Generic function to send any command to Arduino ===
  sendToArduino: (command) => {
    ipcRenderer.send('send-to-arduino', command);
  },
  
  // Function to send SMS data specifically
  sendSms: (data) => {
    ipcRenderer.send('send-sms-via-electron', data);
  },
  
  // === NEW: Listener for ALL responses from Arduino ===
  handleArduinoResponse: (callback) => {
      const handler = (event, ...args) => callback(...args);
      ipcRenderer.on('arduino-response', handler);
      // Return a cleanup function
      return () => ipcRenderer.removeListener('arduino-response', handler);
  },

  // === NEW: Listener for device connection status ===
  handleArduinoStatus: (callback) => {
      const handler = (event, ...args) => callback(...args);
      ipcRenderer.on('arduino-status', handler);
      return () => ipcRenderer.removeListener('arduino-status', handler);
  }
});
