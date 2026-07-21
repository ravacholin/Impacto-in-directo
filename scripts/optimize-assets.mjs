// Optimización de imágenes de la PWA.
//
// A partir del `public/logo.png` original (arte de alta resolución), genera todas
// las variantes que la app necesita, ya comprimidas: el logo de la home y los
// iconos del manifest / favicon. El objetivo es bajar el peso de `dist/` de ~12 MB
// a menos de 1 MB sin que el logo pierda calidad visible.
//
// Uso: `node scripts/optimize-assets.mjs`. El script queda en el repo por si se
// cambia el arte de origen; los archivos que produce se commitean.

import sharp from 'sharp';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC = path.resolve(__dirname, '..', 'public');
const SOURCE = path.join(PUBLIC, 'logo.png');

// Fondo transparente para los recortes cuadrados (el logo es un wordmark que se
// muestra con mix-blend-screen sobre el fondo oscuro).
const TRANSPARENT = { r: 0, g: 0, b: 0, alpha: 0 };

const out = (name) => path.join(PUBLIC, name);

const run = async () => {
    const source = await sharp(SOURCE).toBuffer();

    // Logo de la home: ancho máx. 900 px, PNG con paleta (< 80 KB). La home lo
    // muestra a ~576 px, así que el reescalado no se nota y baja el peso ~75×.
    await sharp(source)
        .resize({ width: 900, withoutEnlargement: true })
        .png({ compressionLevel: 9, quality: 80, palette: true, colors: 128, dither: 0.5 })
        .toFile(out('logo.png'));

    // Iconos cuadrados del manifest y del sistema. `fit: contain` conserva la
    // proporción del wordmark centrado sobre fondo transparente.
    const square = (size, name, opts = {}) =>
        sharp(source)
            .resize({ width: size, height: size, fit: 'contain', background: TRANSPARENT })
            .png({ compressionLevel: 9, palette: true, ...opts })
            .toFile(out(name));

    await square(64, 'favicon.png', { quality: 70 });   // < 10 KB
    await square(180, 'apple-touch-icon.png');
    await square(192, 'pwa-192.png');
    await square(512, 'pwa-512.png');

    console.log('Assets optimizados en public/.');
};

run().catch((err) => {
    console.error(err);
    process.exit(1);
});
