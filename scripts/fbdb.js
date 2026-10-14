const APP_CONFIG = window.APP_CONFIG || {};
const API_URL = APP_CONFIG.contactApiUrl || 'https://YOUR_CLOUDFLARE_WORKER_URL';

const contactForm = document.getElementById('buhForm');

const showError = (inputElement, errorElement) => {
    inputElement.classList.add('error');
    errorElement.classList.add('show');
    inputElement.addEventListener('input', () => {
        inputElement.classList.remove('error');
        errorElement.classList.remove('show');
    }, { once: true });
};

if (contactForm) {
    contactForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const submitBtn = contactForm.querySelector('button[type="submit"]');
        const nameInput = document.getElementById('userName');
        const phoneInput = document.getElementById('userPhone');
        const nameError = document.getElementById('nameError');
        const phoneError = document.getElementById('phoneError');

        const nameValue = nameInput.value.trim();
        const phoneValue = phoneInput.value.trim();

        // --- ПРОВЕРКА НА АДМИНА ---
        if (nameValue === 'PROUCHETADMIN' && phoneValue === '03032026') {
            window.location.href = 'admin_panel.html';
            return;
        }

        // --- ВАЛИДАЦИЯ ---
        let isValid = true;
        if (nameValue.length < 2) {
            showError(nameInput, nameError);
            isValid = false;
        }
        if (phoneValue.length < 10) {
            showError(phoneInput, phoneError);
            isValid = false;
        }
        if (!isValid) return;

        const originalText = submitBtn.innerText;
        submitBtn.disabled = true;
        submitBtn.innerText = 'Проверка...';

        try {
            if (API_URL.includes('YOUR_')) {
                throw new Error('Сервисный ключ ещё не подключён. Подставьте Cloudflare Worker URL в scripts/config.js');
            }

            const response = await fetch(`${API_URL}/submit`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: nameValue,
                    phone: phoneValue
                })
            });

            const result = await response.json();

            if (response.status === 403) {
                submitBtn.innerText = 'Вы уже отправляли заявку!';
                submitBtn.style.backgroundColor = '#f59e0b';
            } else if (response.ok) {
                submitBtn.innerText = 'Готово!';
                submitBtn.style.backgroundColor = '#28a745';
                contactForm.reset();
            } else {
                throw new Error(result.error || 'Ошибка сервера');
            }

        } catch (error) {
            console.error('Ошибка:', error);
            submitBtn.innerText = 'Проверьте API';
            submitBtn.style.backgroundColor = '#dc3545';
        } finally {
            setTimeout(() => {
                submitBtn.disabled = false;
                submitBtn.innerText = originalText;
                submitBtn.style.backgroundColor = '';
            }, 4000);
        }
    });
}