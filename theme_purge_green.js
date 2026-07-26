const fs = require('fs');
const path = require('path');

const filesToFix = [
  'frontend/src/app/globals.css',
  'frontend/src/app/(dashboard)/incidents/page.tsx',
  'frontend/src/app/(dashboard)/mission-control/page.tsx',
  'frontend/src/app/(dashboard)/replay/page.tsx',
  'frontend/src/app/connect/page.tsx'
];

for (const relPath of filesToFix) {
  const fullPath = path.join(__dirname, relPath);
  if (fs.existsSync(fullPath)) {
    let content = fs.readFileSync(fullPath, 'utf8');
    content = content.replace(/emerald/g, 'orange');
    content = content.replace(/teal/g, 'amber');
    fs.writeFileSync(fullPath, content);
    console.log(`Purged green from ${fullPath}`);
  }
}
console.log('Complete');
