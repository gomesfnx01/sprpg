/* ============================================================
   generate-cards-manifest.js

   Faz DUAS coisas, nessa ordem, sempre que você rodar:

   1) OTIMIZA os cards grandes automaticamente (redimensiona para
      no máximo 900px no lado maior e comprime), pra manter o site
      leve e rápido. Só mexe em arquivos acima de ~350KB — cards
      que já estão leves são deixados exatamente como estão.

   2) GERA o CARDS/manifest.json — o índice que o app usa pra saber
      quais cards existem (o navegador sozinho não consegue "listar"
      arquivos de uma pasta quando o site está no GitHub Pages).

   Como rodar (uma vez só, na pasta do projeto):
     npm install
   Depois, toda vez que adicionar/remover/trocar cards:
     node generate-cards-manifest.js

   Depois é só commitar tudo (inclusive os cards otimizados e o
   manifest.json atualizado) e subir pro GitHub normalmente.
   ============================================================ */
const fs = require('fs');
const path = require('path');
const { Jimp } = require('jimp');

const CARDS_DIR = path.join(__dirname, 'CARDS');
const RARITIES = ['comuns', 'raras', 'epicas', 'lendarias'];
const VALID_EXT = ['.png', '.jpg', '.jpeg', '.webp'];

const MAX_DIMENSION = 900;       // lado maior, em pixels
const JPEG_QUALITY = 85;
const SIZE_THRESHOLD_KB = 350;   // só otimiza acima disso

function listFiles(folder) {
  const full = path.join(CARDS_DIR, folder);
  if (!fs.existsSync(full)) {
    console.warn('Aviso: pasta não encontrada -> ' + full);
    return [];
  }
  return fs.readdirSync(full)
    .filter((name) => VALID_EXT.includes(path.extname(name).toLowerCase()))
    .sort();
}

// Checa (por amostragem, pra ser rápido) se a imagem tem transparência real.
function hasRealAlpha(image) {
  const data = image.bitmap.data;
  const totalPixels = image.bitmap.width * image.bitmap.height;
  const step = Math.max(1, Math.floor(totalPixels / 5000)); // amostra ~5000 pixels
  for (let p = 0; p < totalPixels; p += step) {
    const alpha = data[p * 4 + 3];
    if (alpha < 250) return true;
  }
  return false;
}

async function optimizeFile(rarity, filename) {
  const filePath = path.join(CARDS_DIR, rarity, filename);
  const sizeKB = fs.statSync(filePath).size / 1024;
  const ext = path.extname(filename).toLowerCase();

  if (ext === '.webp') {
    if (sizeKB > SIZE_THRESHOLD_KB) {
      console.log('  ⚠ ' + rarity + '/' + filename + ' (' + sizeKB.toFixed(0) + 'KB) — .webp não é otimizado automaticamente aqui. Use squoosh.app se quiser reduzir.');
    }
    return filename;
  }

  if (sizeKB <= SIZE_THRESHOLD_KB) {
    return filename; // já leve, não mexe
  }

  const image = await Jimp.read(filePath);
  if (image.bitmap.width > MAX_DIMENSION || image.bitmap.height > MAX_DIMENSION) {
    image.scaleToFit({ w: MAX_DIMENSION, h: MAX_DIMENSION });
  }

  let finalFilename = filename;
  if (ext === '.png' && !hasRealAlpha(image)) {
    // PNG sem transparência real -> converte pra JPEG (bem mais leve)
    finalFilename = filename.replace(/\.png$/i, '.jpg');
    const newPath = path.join(CARDS_DIR, rarity, finalFilename);
    await image.write(newPath, { quality: JPEG_QUALITY });
    fs.unlinkSync(filePath);
  } else if (ext === '.jpg' || ext === '.jpeg') {
    await image.write(filePath, { quality: JPEG_QUALITY });
  } else {
    // PNG com transparência real -> mantém PNG, só redimensiona
    await image.write(filePath);
  }

  const newSizeKB = fs.statSync(path.join(CARDS_DIR, rarity, finalFilename)).size / 1024;
  console.log('  ✓ ' + rarity + '/' + filename + ': ' + sizeKB.toFixed(0) + 'KB -> ' + newSizeKB.toFixed(0) + 'KB' +
    (finalFilename !== filename ? ' (renomeado para ' + finalFilename + ')' : ''));
  return finalFilename;
}

async function main() {
  console.log('Etapa 1/2 — otimizando cards grandes...');
  const manifest = {};
  let total = 0;

  for (const rarity of RARITIES) {
    const files = listFiles(rarity);
    const finalNames = [];
    for (const file of files) {
      const finalName = await optimizeFile(rarity, file);
      finalNames.push(finalName);
    }
    manifest[rarity] = finalNames.sort();
    total += finalNames.length;
  }

  fs.writeFileSync(path.join(CARDS_DIR, 'manifest.json'), JSON.stringify(manifest, null, 2));

  console.log('\nEtapa 2/2 — manifest.json atualizado:');
  RARITIES.forEach((r) => console.log('  ' + r + ': ' + manifest[r].length + ' card(s)'));
  console.log('\nTotal: ' + total + ' card(s). Pronto pra commitar!');
}

main().catch((err) => {
  console.error('Erro ao processar os cards:', err);
  process.exit(1);
});
