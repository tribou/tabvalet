const fs = require('fs');
const { createCanvas } = require('canvas');

if (!fs.existsSync('icons')) {
  fs.mkdirSync('icons');
}

const sizes = [16, 48, 128];
sizes.forEach(size => {
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext('2d');
  
  const grad = ctx.createLinearGradient(0, 0, size, size);
  grad.addColorStop(0, '#0a84ff');
  grad.addColorStop(1, '#0059b3');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = size / 8;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(size * 0.35, size * 0.7);
  ctx.lineTo(size * 0.65, size * 0.3);
  ctx.stroke();
  
  const buffer = canvas.toBuffer('image/png');
  fs.writeFileSync(`icons/icon${size}.png`, buffer);
  console.log(`Generated icons/icon${size}.png`);
});
