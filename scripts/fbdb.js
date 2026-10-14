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

        if (contactForm.elements.website?.value) return;

        const originalText = submitBtn.innerText;
        submitBtn.disabled = true;
        submitBtn.innerText = 'Отправка...';

        try {
            const client = window.supabaseClient;
            if (!client) {
                throw new Error('Supabase не настроен');
            }

            const { error } = await client.from('applications').insert({
                full_name: nameValue,
                phone: phoneValue
            });
            if (error) {
                throw error;
            }

            submitBtn.innerText = 'Заявка отправлена';
            submitBtn.style.backgroundColor = '#28a745';
            contactForm.reset();
        } catch (error) {
            console.error('Ошибка отправки заявки:', error);
            submitBtn.innerText = 'Не удалось отправить';
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