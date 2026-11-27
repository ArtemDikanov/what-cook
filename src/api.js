import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseKey);

// 1. Получить все блюда (сначала самые новые)
export async function getDishes() {
  const { data, error } = await supabase
    .from('dishes')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Ошибка при загрузке блюд:', error);
    throw error;
  }

  return data;
}

// 2. Загрузить фото в Storage и получить публичную ссылку
// Вспомогательная функция сжатия фото через Canvas
function compressImage(file, maxSize = 900, quality = 0.8) {
  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(url);

      let { width, height } = img;
      // Уменьшаем пропорционально, только если картинка больше maxSize
      if (width > maxSize || height > maxSize) {
        if (width > height) {
          height = Math.round((height * maxSize) / width);
          width = maxSize;
        } else {
          width = Math.round((width * maxSize) / height);
          height = maxSize;
        }
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, width, height);

      canvas.toBlob(
        (blob) => {
          // Если вдруг браузер не смог сжать (например, редкий формат), отдаем оригинал
          resolve(blob || file);
        },
        'image/jpeg',
        quality
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(file);
    };

    img.src = url;
  });
}

// 2. Загрузить сжатое фото в Storage и получить публичную ссылку
export async function uploadDishImage(file) {
  if (!file) return null;

  const compressedBlob = await compressImage(file);
  const fileName = `${Date.now()}-${Math.random().toString(36).substring(2, 8)}.jpg`;

  const { error: uploadError } = await supabase.storage
    .from('dish-images')
    .upload(fileName, compressedBlob, {
      contentType: 'image/jpeg',
    });

  if (uploadError) {
    console.error('Ошибка при загрузке фото:', uploadError);
    throw uploadError;
  }

  const { data } = supabase.storage
    .from('dish-images')
    .getPublicUrl(fileName);

  return data.publicUrl;
}


// 3. Добавить новое блюдо в таблицу
export async function addDish({ title, source, description, imageFile }) {
  const imageUrl = await uploadDishImage(imageFile);

  const { data, error } = await supabase
    .from('dishes')
    .insert([
      {
        title,
        source,
        description: description || null,
        image_url: imageUrl,
      },
    ])
    .select()
    .single();

  if (error) {
    console.error('Ошибка при сохранении блюда:', error);
    throw error;
  }

  return data;
}


// Вспомогательная функция: удаляет файл из бакета по его публичной ссылке
export async function deleteDishImage(imageUrl) {
  if (!imageUrl || !imageUrl.includes('/dish-images/')) return;

  // Вырезаем имя файла из конца ссылки (например, "1795793884381-yj3rzl.jpg")
  const fileName = imageUrl.split('/dish-images/').pop();

  const { error } = await supabase.storage
    .from('dish-images')
    .remove([fileName]);

  if (error) {
    console.error('Не удалось удалить старое фото из Storage:', error);
  }
}

// 4. Обновить существующее блюдо (и удалить старое фото, если загрузили новое)
export async function updateDish(id, { title, source, description, imageFile, existingImageUrl }) {
  const imageUrl = imageFile ? await uploadDishImage(imageFile) : existingImageUrl;

  const { data, error } = await supabase
    .from('dishes')
    .update({
      title,
      source,
      description: description || null,
      image_url: imageUrl,
    })
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('Ошибка при обновлении блюда:', error);
    throw error;
  }

  // Если загрузили новое фото и раньше было старое — удаляем старое из Storage
  if (imageFile && existingImageUrl) {
    await deleteDishImage(existingImageUrl);
  }

  return data;
}

// 5. Удалить блюдо (вместе с его фото в Storage)
export async function deleteDish(id, imageUrl) {
  const { error } = await supabase
    .from('dishes')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('Ошибка при удалении блюда:', error);
    throw error;
  }

  if (imageUrl) {
    await deleteDishImage(imageUrl);
  }
}
