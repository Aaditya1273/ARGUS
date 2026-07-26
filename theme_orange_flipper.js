const fs = require('fs');
const path = require('path');

const targetDirs = [
  path.join(__dirname, 'frontend/src/app/(dashboard)'),
  path.join(__dirname, 'frontend/src/components')
];

// Hex codes in cost-firewall
const hexMap = {
  '#1a5b3a': '#ea580c', // Dark Green -> Orange 600
  '#13442a': '#c2410c', // Darker Green -> Orange 700
  '#82c99a': '#fdba74', // Light Green -> Orange 300
  '#2d7d52': '#f97316', // Gradient start -> Orange 500
  '#1e5837': '#c2410c', // Gradient end -> Orange 700
};

function processDirectory(dir) {
  if (!fs.existsSync(dir)) return;
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      processDirectory(fullPath);
    } else if (fullPath.endsWith('.tsx') || fullPath.endsWith('.ts')) {
      let content = fs.readFileSync(fullPath, 'utf8');
      
      let originalContent = content;
      
      // Replace Tailwind 'emerald' with 'orange'
      content = content.replace(/emerald/g, 'orange');
      
      // Replace Hex colors
      for (const [oldHex, newHex] of Object.entries(hexMap)) {
        content = content.split(oldHex).join(newHex);
      }
      
      if (content !== originalContent) {
        fs.writeFileSync(fullPath, content);
        console.log(`Updated to orange theme for ${fullPath}`);
      }
    }
  }
}

for (const dir of targetDirs) {
  processDirectory(dir);
}
console.log('Orange theme flip complete!');
