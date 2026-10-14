const API_URL = "https://prouchet-api.ilasestakov642.workers.dev/"; // Твой актуальный URL

const formsGrid = document.getElementById('formsGrid');
const loader = document.getElementById('loader');
const totalCountDisplay = document.getElementById('totalCount');

// Функция для получения данных
async function loadEntries() {
    try {
        loader.style.display = 'block';
        const response = await fetch(`${API_URL}/admin-get-data`);
        const data = await response.json();

        loader.style.display = 'none';
        formsGrid.innerHTML = '';

        if (!data || data.length === 0) {
            formsGrid.innerHTML = '<div class="empty-msg">Заявок пока нет :(</div>';
            totalCountDisplay.innerText = '0';
            return;
        }

        totalCountDisplay.innerText = data.length;

        data.forEach((info) => {
            const card = document.createElement('div');
            card.className = 'form-card';
            card.innerHTML = `
                <button class="delete-btn" onclick="deleteEntry('${info.id}')">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <polyline points="3 6 5 6 21 6"></polyline>
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                    </svg>
                </button>
                <h3>${info.name || 'Без имени'}</h3>
                <p><strong>Телефон:</strong> ${info.phone || '—'}</p>
                <p><strong>IP:</strong> ${info.userIp || '—'}</p> 
                <div class="date">${info.date || 'Дата не указана'}</div>
            `;
            formsGrid.appendChild(card);
        });
    } catch (err) {
        console.error("Ошибка загрузки:", err);
        alert("Не удалось загрузить данные");
    }
}

// Функция для удаления
window.deleteEntry = async (id) => {
    if (confirm("Вы уверены, что хотите удалить эту заявку?")) {
        try {
            const response = await fetch(`${API_URL}/delete/${id}`, {
                method: 'DELETE'
            });

            if (response.ok) {
                alert("Удалено успешно");
                loadEntries(); // Перезагружаем список
            } else {
                throw new Error("Ошибка при удалении");
            }
        } catch (err) {
            alert(err.message);
        }
    }
};

// Запускаем загрузку при открытии страницы
loadEntries();