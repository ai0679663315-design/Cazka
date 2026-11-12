// Робить шляхи в dist/index.html відносними, щоб сайт працював і в корені домену, і в підпапці
// (наприклад, GitHub Pages: https://<user>.github.io/Cazka/).
const fs = require('fs');
const path = require('path');
const file = path.join(__dirname, '..', 'dist', 'index.html');
const html = fs.readFileSync(file, 'utf8').replace(/(src|href)="\/(?!\/)/g, '$1="./');
fs.writeFileSync(file, html);
console.log('dist/index.html: шляхи зроблено відносними');
