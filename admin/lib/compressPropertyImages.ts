import {
  PROPERTY_IMAGE_MAX_BYTES,
  PROPERTY_IMAGE_MAX_TOTAL_BYTES,
} from '../../src/utils/imageUploadValidation';

const COMPRESSION_STEPS = [
  { maxDimension: 1600, quality: 0.76 },
  { maxDimension: 1400, quality: 0.66 },
  { maxDimension: 1200, quality: 0.56 },
  { maxDimension: 1100, quality: 0.48 },
  { maxDimension: 1000, quality: 0.42 },
  { maxDimension: 900, quality: 0.36 },
  { maxDimension: 800, quality: 0.31 },
  { maxDimension: 720, quality: 0.27 },
];

const loadImage = (file: File): Promise<{ image: HTMLImageElement; objectUrl: string }> =>
  new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => resolve({ image, objectUrl });
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error(`Impossible de lire la photo « ${file.name} ».`));
    };
    image.src = objectUrl;
  });

const canvasToBlob = (canvas: HTMLCanvasElement, quality: number): Promise<Blob | null> =>
  new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', quality));

export async function compressPropertyImages(files: readonly File[]): Promise<File[]> {
  if (!files.length) return [];

  const maxBytesPerImage = Math.min(
    PROPERTY_IMAGE_MAX_BYTES,
    Math.floor(PROPERTY_IMAGE_MAX_TOTAL_BYTES / files.length)
  );
  const compressed: File[] = [];

  for (const file of files) {
    const { image, objectUrl } = await loadImage(file);
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    if (!context) {
      URL.revokeObjectURL(objectUrl);
      throw new Error('La compression des photos n’est pas disponible dans ce navigateur.');
    }

    try {
      let result: File | null = null;
      for (const step of COMPRESSION_STEPS) {
        const scale = Math.min(1, step.maxDimension / Math.max(image.naturalWidth, image.naturalHeight));
        canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
        canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
        context.drawImage(image, 0, 0, canvas.width, canvas.height);

        const blob = await canvasToBlob(canvas, step.quality);
        if (blob && blob.size <= maxBytesPerImage) {
          const name = `${file.name.replace(/\.[^.]+$/, '')}.jpg`;
          result = new File([blob], name, { type: 'image/jpeg', lastModified: file.lastModified });
          break;
        }
      }

      if (!result) {
        throw new Error(
          `Impossible de réduire « ${file.name} » sous 200 Ko. Choisissez une autre photo.`
        );
      }
      compressed.push(result);
    } finally {
      URL.revokeObjectURL(objectUrl);
      canvas.width = 0;
      canvas.height = 0;
    }
  }

  return compressed;
}
