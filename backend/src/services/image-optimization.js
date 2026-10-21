import path from 'node:path';
import sharp from 'sharp';

const MAX_PIXELS = 40_000_000;
const MAX_SIDE = 2560;
const MAX_QUEUED = 8;
sharp.cache({ memory: 16, files: 0, items: 40 });
sharp.concurrency(1);
const imageFormats = new Map([['image/jpeg', 'jpeg'], ['image/png', 'png'], ['image/webp', 'webp']]);
let processing = false;
const waiting = [];

// Limit decoded images in memory independently of libvips' worker threads.
// The queue is bounded so simultaneous uploads cannot queue unlimited decodes.
function runLimited(operation) {
  if (processing && waiting.length >= MAX_QUEUED) {
    return Promise.reject(Object.assign(new Error('Hay varias imágenes procesándose. Intenta subirla nuevamente en unos segundos.'), { status: 503 }));
  }
  return new Promise((resolve, reject) => {
    const run = async () => {
      processing = true;
      try { resolve(await operation()); }
      catch (error) { reject(error); }
      finally {
        const next = waiting.shift();
        if (next) next();
        else processing = false;
      }
    };
    if (processing) waiting.push(run);
    else run();
  });
}

const invalidImage = (message) => Object.assign(new Error(message), { status: 400 });

/** Return a new upload with the exact bytes and metadata that must be stored. */
export async function optimizeImageUpload(file) {
  if (file.mimetype === 'application/pdf') return file;
  if (!imageFormats.has(file.mimetype)) throw invalidImage('Selecciona una imagen JPG, PNG o WEBP.');
  return runLimited(async () => {
    try {
      const image = sharp(file.buffer, { limitInputPixels: MAX_PIXELS, failOn: 'warning', sequentialRead: true });
      const metadata = await image.metadata();
      if (metadata.format !== imageFormats.get(file.mimetype)) throw invalidImage('El contenido de la imagen no coincide con su formato.');
      if (!metadata.width || !metadata.height || metadata.width * metadata.height > MAX_PIXELS) {
        throw invalidImage('La imagen supera el límite de 40 megapíxeles. Selecciona una foto de menor resolución.');
      }
      if ((metadata.pages || 1) > 1) throw invalidImage('Selecciona una fotografía estática. Las imágenes animadas o con varias páginas no están permitidas.');
      const optimized = await image.rotate()
        .resize({ width: MAX_SIDE, height: MAX_SIDE, fit: 'inside', withoutEnlargement: true })
        .webp({ quality: 90, alphaQuality: 100, effort: 4, smartSubsample: true })
        .toBuffer();
      // Tiny/already compressed images may be lighter than a new encoding.
      // Decoding above still verifies the full input before retaining it.
      if (optimized.length >= file.buffer.length || file.buffer.length < 1024) return { ...file, size: file.buffer.length };
      const name = path.basename(file.originalname || 'imagen').replace(/[\x00-\x1f\x7f]/g, '');
      const stem = path.parse(name).name.slice(0, 249) || 'imagen';
      return { ...file, buffer: optimized, size: optimized.length, mimetype: 'image/webp', originalname: `${stem}.webp` };
    } catch (error) {
      if (error.status) throw error;
      if (/pixel limit|image dimensions|exceeds.*limit/i.test(error.message)) {
        throw invalidImage('La imagen supera el límite de 40 megapíxeles. Selecciona una foto de menor resolución.');
      }
      throw invalidImage('No se pudo leer la imagen. Selecciona una foto JPG, PNG o WEBP válida y completa.');
    }
  });
}
