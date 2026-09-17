const fs = require('fs');
const path = require('path');

// Generate valid minimal PNGs for Chrome extension icons
const assetsDir = path.join(__dirname);

// Base64 valid 1x1 transparent PNG expanded to standard PNG headers
const validPngBase64 = 'iVBORw0KGgoAAAANSUh0AKgAAAAgAAAABCAYAAAB17FzkAAAABHNCSVQICAgIfAhkiAAAAAlwSFlzAAALEwAACxMBAJqcGAAAABl0RVh0U29mdHdhcmUAd3d3Lmlua3NjYXBlLm9yZ5vuPBoAAAAQTFRFAAAA////AAAA/wD/AP///wCE08EAAAAD0lEQVQI12NgGAWjYBSMglEADAAA//8D9wGv4p+8yAAAAABJRU5ErkJggg==';
const buffer = Buffer.from(validPngBase64, 'base64');

['16', '48', '128'].forEach(size => {
  const filePath = path.join(assetsDir, `icon${size}.png`);
  fs.writeFileSync(filePath, buffer);
  console.log(`Creado ${filePath}`);
});
