const fs = require('fs');
const path = require('path');

const targetDir = path.join(__dirname, 'frontend/src/app/(dashboard)');

const classMap = {
  'bg-gray-900': 'bg-white shadow-sm',
  'bg-gray-950': 'bg-gray-50',
  'bg-gray-800': 'bg-gray-100',
  'bg-gray-700': 'bg-gray-200',
  'border-gray-800': 'border-gray-200',
  'border-gray-700': 'border-gray-300',
  'text-gray-400': 'text-gray-500',
  'text-gray-300': 'text-gray-600',
  'text-gray-200': 'text-gray-700',
  'text-gray-100': 'text-gray-800',
  'text-white': 'text-gray-900',
  'bg-\\[#0a0a0b\\]': 'bg-[#f8f9fa]',
  'hover:bg-gray-800': 'hover:bg-gray-50',
  'hover:bg-gray-800/20': 'hover:bg-gray-50',
  'bg-gray-800/20': 'bg-gray-50',
  'bg-gray-800/50': 'bg-gray-100',
  'text-indigo-300': 'text-indigo-600',
  'text-indigo-400': 'text-indigo-600',
  'text-emerald-400': 'text-emerald-600',
  'text-red-400': 'text-red-600',
  'text-amber-400': 'text-amber-600',
  'text-cyan-400': 'text-cyan-600',
  'text-blue-400': 'text-blue-600',
  'text-purple-400': 'text-purple-600',
};

function processDirectory(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      processDirectory(fullPath);
    } else if (fullPath.endsWith('.tsx') && !fullPath.includes('cost-firewall') && !fullPath.includes('agent-dna') && !fullPath.includes('mission-control') && !fullPath.includes('layout.tsx')) {
      let content = fs.readFileSync(fullPath, 'utf8');
      
      // Perform replacements
      for (const [oldClass, newClass] of Object.entries(classMap)) {
        // Use regex to match exact class names (with boundaries)
        const regex = new RegExp(`\\b${oldClass}\\b`, 'g');
        content = content.replace(regex, newClass);
      }
      // Handle the escaped brackets manually
      content = content.replace(/bg-\[\#0a0a0b\]/g, 'bg-[#f8f9fa]');
      
      fs.writeFileSync(fullPath, content);
      console.log(`Updated theme for ${fullPath}`);
    }
  }
}

processDirectory(targetDir);
console.log('Theme flip complete!');
