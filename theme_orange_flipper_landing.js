const fs = require('fs');
const path = require('path');

const targetFile = path.join(__dirname, 'frontend/src/app/page.tsx');

let content = fs.readFileSync(targetFile, 'utf8');

// Replace Tailwind 'emerald' with 'orange'
content = content.replace(/emerald/g, 'orange');
content = content.replace(/teal/g, 'red'); // since gradients go to teal

fs.writeFileSync(targetFile, content);
console.log('Orange theme flip complete for landing page!');
