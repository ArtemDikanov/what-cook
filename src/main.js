import './style.scss';
import { getDishes, addDish } from './api.js';

// Встроенная аккуратная заглушка на случай, если блюдо добавили без фото
const FALLBACK_IMAGE =
  "data:image/svg+xml;utf8,<svg xmlns='http://w3.org' width='600' height='400' viewBox='0 0 600 400'><rect width='600' height='400' fill='%23ffedd5'/><text x='50%' y='52%' dominant-baseline='middle' text-anchor='middle' font-size='96'>🍽️</text></svg>";

let dishes = [];
let recentPickedIds = [];

// Элементы DOM
const dishesCountEl = document.getElementById('dishes-count');
const dishesGridEl = document.getElementById('dishes-grid');
const overlayAllEl = document.getElementById('overlay-all');

const modalPick = document.getElementById('modal-pick');
const modalDetail = document.getElementById('modal-detail');
const modalAdd = document.getElementById('modal-add');

const pickerLoader = document.getElementById('picker-loader');
const pickerResult = document.getElementById('picker-result');

// 1. Универсальное закрытие для всех <dialog> (крестик + клик мимо окна)
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

// 2. Загрузка блюд из Supabase при старте
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

// 3. Рендер сетки "Все рецепты"
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
        <img class="dish-card__img" src="${dish.image_url || FALLBACK_IMAGE}" alt="${dish.title}" loading="lazy" />
        <div class="dish-card__body">
          <h3 class="dish-card__title">${dish.title}</h3>
          <span class="dish-card__badge">${dish.source}</span>
        </div>
      </article>
    `
    )
    .join('');

  // Клик по карточке открывает детали
  dishesGridEl.querySelectorAll('.dish-card').forEach((card) => {
    card.addEventListener('click', () => {
      const id = Number(card.dataset.id);
      const dish = dishes.find((d) => d.id === id);
      if (dish) openDetailModal(dish);
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

// 4. Логика кнопки "Подобрать рецепт" (с защитой от повторов)
function pickRandomDish() {
  if (dishes.length === 0) {
    alert('Сначала добавь хотя бы один рецепт в базу!');
    return;
  }

  modalPick.showModal();
  pickerLoader.classList.remove('hidden');
  pickerResult.classList.add('hidden');

  // Фильтруем недавно выпавшие блюда (если всего блюд больше, чем история)
  const historyLimit = Math.min(3, dishes.length - 1);
  const blockedIds = recentPickedIds.slice(-historyLimit);
  const candidates = dishes.filter((d) => !blockedIds.includes(d.id));
  const pool = candidates.length > 0 ? candidates : dishes;

  const chosen = pool[Math.floor(Math.random() * pool.length)];
  recentPickedIds.push(chosen.id);

  // Небольшая пауза для красивой анимации сковородки
  setTimeout(() => {
    document.getElementById('pick-img').src = chosen.image_url || FALLBACK_IMAGE;
    document.getElementById('pick-source').textContent = `📍 Где искать: ${chosen.source}`;
    document.getElementById('pick-title').textContent = chosen.title;
    document.getElementById('pick-desc').textContent = chosen.description || '';

    pickerLoader.classList.add('hidden');
    pickerResult.classList.remove('hidden');
  }, 700);
}

// 5. Навигация главного экрана
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

document.getElementById('btn-add').addEventListener('click', () => {
  modalAdd.showModal();
});

// Быстрые чипсы для поля "Где искать"
const inputSource = document.getElementById('input-source');
document.querySelectorAll('#source-chips .chip').forEach((chip) => {
  chip.addEventListener('click', () => {
    inputSource.value = chip.dataset.value;
    inputSource.focus();
  });
});

// 6. Отправка формы добавления рецепта
const formAdd = document.getElementById('form-add');
const btnSubmit = document.getElementById('btn-submit');

formAdd.addEventListener('submit', async (e) => {
  e.preventDefault();

  const title = document.getElementById('input-title').value.trim();
  const source = inputSource.value.trim();
  const description = document.getElementById('input-desc').value.trim();
  const imageFile = document.getElementById('input-image').files[0] || null;

  if (!title || !source) return;

  btnSubmit.disabled = true;
  btnSubmit.textContent = 'Сохраняю...';

  try {
    const created = await addDish({ title, source, description, imageFile });
    dishes.unshift(created); // Добавляем в начало локального списка
    updateUI();
    formAdd.reset();
    modalAdd.close();
  } catch (err) {
    alert('Не удалось сохранить рецепт. Проверь интернет и попробуй снова.');
  } finally {
    btnSubmit.disabled = false;
    btnSubmit.textContent = 'Сохранить рецепт';
  }
});

init();

getDishes().then(console.log);