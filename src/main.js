import FALLBACK_IMAGE from "./placeholder.svg";
import '@fontsource/nunito/500.css';
import '@fontsource/nunito/700.css';
import '@fontsource/nunito/800.css';
import './style.scss';

import { getDishes, addDish, updateDish, deleteDish } from './api.js';


let dishes = [];
let recentPickedIds = [];
let editingDishId = null; 

const dishesCountEl = document.getElementById('dishes-count');
const dishesGridEl = document.getElementById('dishes-grid');
const overlayAllEl = document.getElementById('overlay-all');

const modalPick = document.getElementById('modal-pick');
const modalDetail = document.getElementById('modal-detail');
const modalAdd = document.getElementById('modal-add');

const pickerLoader = document.getElementById('picker-loader');
const pickerResult = document.getElementById('picker-result');

const formAdd = document.getElementById('form-add');
const btnSubmit = document.getElementById('btn-submit');
const modalAddTitle = modalAdd.querySelector('.modal__title');
const inputTitle = document.getElementById('input-title');
const inputSource = document.getElementById('input-source');
const inputDesc = document.getElementById('input-desc');
const inputImage = document.getElementById('input-image');

document.querySelectorAll('dialog.modal').forEach((dialog) => {
  dialog.querySelectorAll('[data-close]').forEach((btn) => {
    btn.addEventListener('click', () => dialog.close());
  });

  dialog.addEventListener('click', (e) => {
    if (e.target === dialog) {
      dialog.close();
    }
  });
});

async function init() {
  try {
    dishes = await getDishes();
    updateUI();
  } catch (err) {
    dishesCountEl.textContent = 'Ошибка загрузки базы 😢';
  }
}

function updateUI() {
  const count = dishes.length;
  dishesCountEl.textContent =
    count === 0 ? 'Пока пусто — добавь первый!' : `В коллекции: ${count} шт.`;
  renderGrid();
}

function renderGrid() {
  if (dishes.length === 0) {
    dishesGridEl.innerHTML =
      '<p style="grid-column: 1/-1; text-align: center; color: var(--text-muted); padding: 40px 0;">Здесь пока нет рецептов. Нажми «Добавить рецепт» на главном экране!</p>';
    return;
  }

  dishesGridEl.innerHTML = dishes
    .map(
      (dish) => `
      <article class="dish-card" data-id="${dish.id}">
        <div class="dish-card__actions">
          <button type="button" class="dish-card__action-btn" data-action="edit" title="Изменить">✏️</button>
          <button type="button" class="dish-card__action-btn dish-card__action-btn--delete" data-action="delete" title="Удалить">🗑️</button>
        </div>
        <img class="dish-card__img" src="${dish.image_url || FALLBACK_IMAGE}" alt="${dish.title}" loading="lazy" />
        <div class="dish-card__body">
          <h3 class="dish-card__title">${dish.title}</h3>
          <span class="dish-card__badge">${dish.source}</span>
        </div>
      </article>
    `
    )
    .join('');

  dishesGridEl.querySelectorAll('.dish-card').forEach((card) => {
    const id = Number(card.dataset.id);
    const dish = dishes.find((d) => d.id === id);
    if (!dish) return;

    card.addEventListener('click', () => openDetailModal(dish));

    card.querySelector('[data-action="edit"]').addEventListener('click', (e) => {
      e.stopPropagation();
      openEditModal(dish);
    });

    card.querySelector('[data-action="delete"]').addEventListener('click', async (e) => {
      e.stopPropagation();
      if (!confirm(`Удалить блюдо «${dish.title}»?`)) return;

      try {
        await deleteDish(id, dish.image_url);
        dishes = dishes.filter((d) => d.id !== id);
        recentPickedIds = recentPickedIds.filter((pickedId) => pickedId !== id);
        updateUI();
      } catch (err) {
        alert('Не удалось удалить блюдо. Попробуй еще раз.');
      }
    });
  });
}

function openDetailModal(dish) {
  document.getElementById('detail-img').src = dish.image_url || FALLBACK_IMAGE;
  document.getElementById('detail-source').textContent = `📍 Где искать: ${dish.source}`;
  document.getElementById('detail-title').textContent = dish.title;
  document.getElementById('detail-desc').textContent = dish.description || 'Без дополнительных заметок';
  modalDetail.showModal();
}

function openCreateModal() {
  editingDishId = null;
  formAdd.reset();
  modalAddTitle.textContent = 'Новый рецепт';
  btnSubmit.textContent = 'Сохранить рецепт';
  modalAdd.showModal();
}

function openEditModal(dish) {
  editingDishId = dish.id;
  formAdd.reset();
  modalAddTitle.textContent = 'Изменить рецепт';
  btnSubmit.textContent = 'Сохранить изменения';

  inputTitle.value = dish.title;
  inputSource.value = dish.source;
  inputDesc.value = dish.description || '';
  modalAdd.showModal();
}

function pickRandomDish() {
  if (dishes.length === 0) {
    alert('Сначала добавь хотя бы один рецепт в базу!');
    return;
  }

  modalPick.showModal();
  pickerLoader.classList.remove('hidden');
  pickerResult.classList.add('hidden');

  const historyLimit = Math.min(3, dishes.length - 1);
  const blockedIds = recentPickedIds.slice(-historyLimit);
  const candidates = dishes.filter((d) => !blockedIds.includes(d.id));
  const pool = candidates.length > 0 ? candidates : dishes;

  const chosen = pool[Math.floor(Math.random() * pool.length)];
  recentPickedIds.push(chosen.id);

  setTimeout(() => {
    document.getElementById('pick-img').src = chosen.image_url || FALLBACK_IMAGE;
    document.getElementById('pick-source').textContent = `📍 Где искать: ${chosen.source}`;
    document.getElementById('pick-title').textContent = chosen.title;
    document.getElementById('pick-desc').textContent = chosen.description || '';

    pickerLoader.classList.add('hidden');
    pickerResult.classList.remove('hidden');
  }, 700);
}

document.getElementById('btn-pick').addEventListener('click', pickRandomDish);
document.getElementById('btn-pick-again').addEventListener('click', pickRandomDish);

document.getElementById('btn-all').addEventListener('click', () => {
  overlayAllEl.classList.add('is-open');
  overlayAllEl.inert = false;
});

document.getElementById('btn-close-all').addEventListener('click', () => {
  overlayAllEl.classList.remove('is-open');
  overlayAllEl.inert = true;
});

document.getElementById('btn-add').addEventListener('click', openCreateModal);

// Быстрые чипсы
document.querySelectorAll('#source-chips .chip').forEach((chip) => {
  chip.addEventListener('click', () => {
    inputSource.value = chip.dataset.value;
    inputSource.focus();
  });
});

formAdd.addEventListener('submit', async (e) => {
  e.preventDefault();

  const title = inputTitle.value.trim();
  const source = inputSource.value.trim();
  const description = inputDesc.value.trim();
  const imageFile = inputImage.files[0] || null;

  if (!title || !source) return;

  btnSubmit.disabled = true;
  btnSubmit.textContent = 'Сохраняю...';

  try {
    if (editingDishId !== null) {
      const existingDish = dishes.find((d) => d.id === editingDishId);
      const updated = await updateDish(editingDishId, {
        title,
        source,
        description,
        imageFile,
        existingImageUrl: existingDish?.image_url || null,
      });
      dishes = dishes.map((d) => (d.id === editingDishId ? updated : d));
    } else {
      const created = await addDish({ title, source, description, imageFile });
      dishes.unshift(created);
    }

    updateUI();
    formAdd.reset();
    modalAdd.close();
  } catch (err) {
    alert('Не удалось сохранить рецепт. Проверь интернет и попробуй снова.');
  } finally {
    btnSubmit.disabled = false;
    btnSubmit.textContent = editingDishId !== null ? 'Сохранить изменения' : 'Сохранить рецепт';
  }
});

const modalGift = document.getElementById('modal-gift');
const GIFT_SEEN_KEY = 'what_cook_bday_seen_v1';

document.getElementById('btn-gift').addEventListener('click', () => {
  modalGift.showModal();
});

document.getElementById('btn-gift-start').addEventListener('click', () => {
  localStorage.setItem(GIFT_SEEN_KEY, 'true');
  modalGift.close();
});

if (!localStorage.getItem(GIFT_SEEN_KEY)) {
  modalGift.showModal();
}

// Генерация PNG-иконки 180x180 для ярлыка на рабочий стол iOS/Android
(function generateAppIcon() {
  const img = new Image();
  img.onload = () => {
    const canvas = document.createElement('canvas');
    canvas.width = 180;
    canvas.height = 180;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0, 180, 180);
    const appleIcon = document.getElementById('apple-icon');
    if (appleIcon) appleIcon.href = canvas.toDataURL('image/png');
  };
  img.src = './favicon.svg?v=2';
})();


init();
