import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { storage } from './firebase';

export interface CuratedImageOption {
  label: string;
  url: string;
}

export const CURATED_FOOD_IMAGES: CuratedImageOption[] = [
  {
    label: 'برجر سماش كلاسيك',
    url: '/src/assets/images/burger_smash_signature_1794967836686.jpg',
  },
  {
    label: 'ستيك واغيو مشوي',
    url: '/src/assets/images/steak_wagyu_luxury_1794967837741.jpg',
  },
  {
    label: 'باستا ترافل بالبارميزان',
    url: '/src/assets/images/pasta_truffle_modern_1794967837266.jpg',
  },
  {
    label: 'سبانش لاتيه وكروسان',
    url: '/src/assets/images/coffee_latte_croissant_1794967837713.jpg',
  },
  {
    label: 'بيتزا نابولي على الحطب',
    url: '/src/assets/images/pizza_neapolitan_story_1794967838282.jpg',
  },
];

async function compressImageToDataUrl(file: File, maxDimension = 720, quality = 0.78): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('تعذر قراءة ملف الصورة'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('ملف الصورة غير صالح'));
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let { width, height } = img;
        if (width > maxDimension || height > maxDimension) {
          if (width >= height) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          } else {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('تعذر معالجة الصورة'));
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}

/**
 * Uploads restaurant logo to `restaurants/{uid}/logo` or menu assets to `restaurants/{uid}/{folder}/{filename}`.
 * Gracefully falls back to compressed JPEG data URL if Storage CORS/rules are unavailable.
 */
export async function uploadRestaurantAsset(
  file: File,
  ownerUid: string,
  folder: 'logo' | 'categories' | 'items'
): Promise<string> {
  const safeName = `${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
  const storagePath =
    folder === 'logo'
      ? `restaurants/${ownerUid}/logo`
      : `restaurants/${ownerUid}/${folder}/${safeName}`;

  try {
    const storageRef = ref(storage, storagePath);
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('storage-timeout')), 4500)
    );
    await Promise.race([uploadBytes(storageRef, file), timeoutPromise]);
    return await getDownloadURL(storageRef);
  } catch {
    const compressed = await compressImageToDataUrl(file, folder === 'logo' ? 420 : 680, 0.76);
    if (compressed.length > 280000) {
      return compressImageToDataUrl(file, 480, 0.62);
    }
    return compressed;
  }
}
