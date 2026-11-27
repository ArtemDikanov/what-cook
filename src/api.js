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
export async function uploadDishImage(file) {
  if (!file) return null;

  // Генерируем уникальное имя файла, чтобы кириллица и пробелы не ломали ссылку
  const fileExt = file.name.split('.').pop();
  const fileName = `${Date.now()}-${Math.random().toString(36).substring(2, 8)}.${fileExt}`;

  const { error: uploadError } = await supabase.storage
    .from('dish-images')
    .upload(fileName, file);

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


export async function updateDish(id, { title, source, description, imageFile, existingImageUrl }) {
  // Если выбрали новое фото — грузим его, иначе оставляем старую ссылку
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

  return data;
}

// 5. Удалить блюдо
export async function deleteDish(id) {
  const { error } = await supabase
    .from('dishes')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('Ошибка при удалении блюда:', error);
    throw error;
  }
}