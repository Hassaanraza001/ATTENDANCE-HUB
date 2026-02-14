
// Is file ko terminal mein `node create-zip.js` command se chalayein.
// Yah aapke poore project ki ek `Final_Project.zip` file bana degi.

const fs = require('fs');
const path = require('path');
const JSZip = require('jszip');

const zip = new JSZip();

// IMPORTANT: List of files and folders to ignore.
const ignoreList = [
  'node_modules',
  '.next',
  '.git',
  'dist',
  'Final_Project.zip',
  'project.zip',
  '.DS_Store'
];

/**
 * Recursively adds files and folders to the zip object.
 * @param {string} dirPath - The path of the directory to add.
 * @param {JSZip} zipInstance - The JSZip instance.
 */
function addFolderToZip(dirPath, zipInstance) {
  const items = fs.readdirSync(dirPath);

  for (const item of items) {
    if (ignoreList.includes(item)) {
      continue;
    }
    
    const fullPath = path.join(dirPath, item);
    const stats = fs.statSync(fullPath);

    if (stats.isDirectory()) {
      const folderZip = zipInstance.folder(item);
      addFolderToZip(fullPath, folderZip);
    } else {
      zipInstance.file(item, fs.readFileSync(fullPath));
    }
  }
}

console.log('Zipping project files (Ready for GitHub/Vercel)...');

addFolderToZip(__dirname, zip);

zip
  .generateNodeStream({ type: 'nodebuffer', streamFiles: true })
  .pipe(fs.createWriteStream('Final_Project.zip'))
  .on('finish', function () {
    console.log("-----------------------------------------");
    console.log("✅ 'Final_Project.zip' successfully ban gayi hai!");
    console.log("1. Ise download karke GitHub par upload karein.");
    console.log("2. Vercel par host karte waqt 'docs/HOSTING_GUIDE.md' zaroor padhein.");
    console.log("-----------------------------------------");
  })
  .on('error', function (err) {
    console.error("Error creating zip file:", err);
  });
