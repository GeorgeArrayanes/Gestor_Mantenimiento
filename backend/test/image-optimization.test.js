import { describe, expect, it } from 'vitest';
import sharp from 'sharp';
import { prepareUpload, prepareUploads } from '../src/services/storage.js';

function upload(buffer, mimetype, originalname) {
  return { buffer, size: buffer.length, mimetype, originalname, fieldname: 'files' };
}

async function solid(width, height, format = 'png', options = {}) {
  return sharp({ create: { width, height, channels: 3, background: '#5686b7' } })[format](options).toBuffer();
}

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

describe('preparación de imágenes antes de almacenarlas', () => {
  it.each([
    ['png', 'image/png', { compressionLevel: 0 }],
    ['jpeg', 'image/jpeg', { quality: 100 }],
    ['webp', 'image/webp', { lossless: true }]
  ])('conserva bytes y metadatos coherentes al preparar %s', async (format, mimetype, options) => {
    const buffer = await solid(640, 480, format, options);
    const file = upload(buffer, mimetype, `evidencia.${format}`);
    const prepared = await prepareUpload(file);
    const metadata = await sharp(prepared.buffer).metadata();

    expect(prepared.size).toBe(prepared.buffer.length);
    expect(prepared.size).toBeLessThanOrEqual(buffer.length);
    expect(metadata.format).toBe(prepared.mimetype.split('/')[1]);
    expect(prepared.originalname.endsWith(`.${metadata.format}`)).toBe(true);
    expect(metadata.width).toBe(640);
    expect(metadata.height).toBe(480);
    expect(file.buffer).toBe(buffer);
    expect(file.originalname).toBe(`evidencia.${format}`);
  });

  it('convierte PNG a WebP con un nombre y tamaño que corresponden a los bytes optimizados', async () => {
    const buffer = await solid(320, 180, 'png', { compressionLevel: 0 });
    const prepared = await prepareUpload(upload(buffer, 'image/png', 'inspeccion.final.png'));

    expect(prepared.mimetype).toBe('image/webp');
    expect(prepared.originalname).toBe('inspeccion.final.webp');
    expect(prepared.buffer.toString('ascii', 8, 12)).toBe('WEBP');
    expect(prepared.size).toBe(prepared.buffer.length);
    expect(prepared.size).toBeLessThan(buffer.length);
  });

  it('limita el lado mayor a 2560 píxeles y conserva la proporción', async () => {
    const buffer = await solid(3000, 1500, 'png', { compressionLevel: 1 });
    const prepared = await prepareUpload(upload(buffer, 'image/png', 'panorama.png'));
    const metadata = await sharp(prepared.buffer).metadata();

    expect(metadata.width).toBe(2560);
    expect(metadata.height).toBe(1280);
    expect(prepared.size).toBeLessThan(buffer.length);
  });

  it('no amplía imágenes pequeñas', async () => {
    const buffer = await solid(17, 11, 'png', { compressionLevel: 0 });
    const prepared = await prepareUpload(upload(buffer, 'image/png', 'pequena.png'));
    const metadata = await sharp(prepared.buffer).metadata();

    expect(metadata.width).toBe(17);
    expect(metadata.height).toBe(11);
  });

  it('conserva la transparencia y las zonas opacas', async () => {
    const square = await solid(32, 32);
    const buffer = await sharp({ create: { width: 128, height: 96, channels: 4, background: '#00000000' } })
      .composite([{ input: square, left: 48, top: 32 }])
      .png({ compressionLevel: 0 }).toBuffer();
    const prepared = await prepareUpload(upload(buffer, 'image/png', 'transparente.png'));
    const { data, info } = await sharp(prepared.buffer).ensureAlpha().raw().toBuffer({ resolveWithObject: true });

    expect((await sharp(prepared.buffer).metadata()).hasAlpha).toBe(true);
    expect(data[3]).toBe(0);
    expect(data[(48 * info.width + 64) * info.channels + 3]).toBe(255);
    expect(prepared.size).toBeLessThan(buffer.length);
  });

  it('aplica la orientación EXIF y conserva la imagen vertical al eliminar metadatos', async () => {
    const buffer = await sharp({ create: { width: 1600, height: 800, channels: 3, background: '#5686b7' } })
      .withMetadata({ orientation: 6 }).jpeg({ quality: 100 }).toBuffer();
    expect((await sharp(buffer).metadata()).orientation).toBe(6);
    const prepared = await prepareUpload(upload(buffer, 'image/jpeg', 'vertical.jpg'));
    const metadata = await sharp(prepared.buffer).metadata();

    expect(prepared.mimetype).toBe('image/webp');
    expect(metadata.width).toBe(800);
    expect(metadata.height).toBe(1600);
    expect(metadata.orientation).toBeUndefined();
  });

  it('retiene una imagen ya comprimida cuando una nueva codificación pesa más', async () => {
    const buffer = await sharp({ create: { width: 1, height: 1, channels: 3, background: '#ffffff' } }).webp().toBuffer();
    const file = upload(buffer, 'image/webp', 'minima.webp');
    const prepared = await prepareUpload(file);

    expect(prepared.buffer).toEqual(buffer);
    expect(prepared.mimetype).toBe('image/webp');
    expect(prepared.originalname).toBe('minima.webp');
    expect(prepared.size).toBe(buffer.length);
  });

  it('rechaza imágenes truncadas aunque su cabecera sea válida', async () => {
    const buffer = (await solid(16, 16)).subarray(0, 33);
    await expect(prepareUpload(upload(buffer, 'image/png', 'incompleta.png'))).rejects.toMatchObject({ status: 400 });
  });

  it('rechaza WebP animado en vez de conservar únicamente su primer fotograma', async () => {
    const pixels = Buffer.alloc(3 * 6 * 3, 255);
    pixels.fill(0, 0, 3 * 3 * 3);
    const buffer = await sharp(pixels, { raw: { width: 3, height: 6, channels: 3, pageHeight: 3 } })
      .webp({ loop: 0, delay: [100, 100] }).toBuffer();
    expect((await sharp(buffer, { animated: true }).metadata()).pages).toBe(2);

    await expect(prepareUpload(upload(buffer, 'image/webp', 'animada.webp'))).rejects.toMatchObject({ status: 400 });
  });

  it('rechaza una cabecera de más de 40 megapíxeles antes de decodificar los píxeles', async () => {
    // Alter only a tiny PNG header, including its CRC, to avoid a large test allocation.
    const buffer = Buffer.from(await solid(1, 1));
    buffer.writeUInt32BE(8001, 16);
    buffer.writeUInt32BE(5000, 20);
    buffer.writeUInt32BE(crc32(buffer.subarray(12, 29)), 29);

    await expect(prepareUpload(upload(buffer, 'image/png', 'enorme.png')))
      .rejects.toMatchObject({ status: 400, message: expect.stringMatching(/40 megapíxeles/) });
  });

  it('mantiene los PDF intactos y conserva el orden en lotes mixtos', async () => {
    const pdf = upload(Buffer.from('%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\n%%EOF'), 'application/pdf', 'acta.pdf');
    const png = upload(await solid(32, 24, 'png', { compressionLevel: 0 }), 'image/png', 'foto.png');
    const prepared = await prepareUploads([pdf, png]);

    expect(prepared).toHaveLength(2);
    expect(prepared[0]).toBe(pdf);
    expect(prepared[0].buffer).toEqual(pdf.buffer);
    expect(prepared[0].size).toBe(pdf.buffer.length);
    expect(prepared[0].mimetype).toBe('application/pdf');
    expect(prepared[0].originalname).toBe('acta.pdf');
    expect(prepared[1].mimetype).toBe('image/webp');
    expect(prepared[1].originalname).toBe('foto.webp');
    expect(await prepareUploads()).toEqual([]);
  });
});
