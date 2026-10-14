(function () {
    const root = document.getElementById('coursePage');
    const client = window.supabaseClient;
    const slug = new URLSearchParams(window.location.search).get('slug');
    const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (character) => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[character]);

    if (!client || !slug) {
        root.innerHTML = '<div class="empty">Не удалось загрузить курс. Вернитесь на страницу курсов.</div>';
        return;
    }

    async function loadCourse() {
        const { data: course, error } = await client.from('courses')
            .select('*').eq('slug', slug).eq('is_published', true).maybeSingle();
        if (error || !course) {
            root.innerHTML = '<div class="empty">Курс не найден или пока не опубликован. <a href="index.html#courses">Все курсы</a></div>';
            return;
        }

        document.title = `${course.title} | ProUchet`;
        const curriculum = Array.isArray(course.curriculum) ? course.curriculum : [];
        const qr = course.kaspi_qr_url
            ? `<img class="qr" src="${escapeHtml(course.kaspi_qr_url)}" alt="QR-код для оплаты курса">`
            : '';
        const methods = Array.isArray(course.payment_methods) ? course.payment_methods : [];
        const paymentMethods = methods.length
            ? `<ul>${methods.map((method) => `<li>${escapeHtml(method.name || method)}</li>`).join('')}</ul>`
            : '';

        root.innerHTML = `
            <div class="hero">
                <section class="intro">
                    <span class="category">${escapeHtml(course.category)}</span>
                    <h1>${escapeHtml(course.title)}</h1>
                    <p class="lead">${escapeHtml(course.description || course.short_description)}</p>
                    <div class="price">${Number(course.price).toLocaleString('ru-RU')} ${escapeHtml(course.currency)}</div>
                    ${course.duration ? `<div class="duration">Длительность: ${escapeHtml(course.duration)}</div>` : ''}
                    <div class="section"><h2>Программа курса</h2><ul class="curriculum">${curriculum.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul></div>
                </section>
                <aside class="payment">
                    <h2>Оплата</h2>
                    ${qr}
                    <div class="instructions">${escapeHtml(course.payment_instructions || 'Свяжитесь с нами, чтобы уточнить реквизиты для оплаты.')}</div>
                    ${paymentMethods}
                    <p><small>Оплата проверяется администратором вручную. Отправка заявки не подтверждает оплату.</small></p>
                </aside>
            </div>
            <section class="application">
                <h2>Оставить заявку на курс</h2>
                <form id="courseApplicationForm">
                    <input name="full_name" type="text" autocomplete="name" placeholder="ФИО" minlength="2" maxlength="160" required>
                    <input name="phone" type="tel" autocomplete="tel" placeholder="Номер телефона" minlength="7" maxlength="32" required>
                    <button type="submit">Отправить заявку</button>
                    <div class="message" role="status" aria-live="polite"></div>
                </form>
            </section>
        `;

        document.getElementById('courseApplicationForm').addEventListener('submit', async (event) => {
            event.preventDefault();
            const form = event.currentTarget;
            const button = form.querySelector('button');
            const message = form.querySelector('.message');
            const values = new FormData(form);
            button.disabled = true;
            message.textContent = 'Отправляем…';
            const { error: insertError } = await client.from('applications').insert({
                full_name: String(values.get('full_name')).trim(),
                phone: String(values.get('phone')).trim(),
                course_id: course.id,
                course_title: course.title
            });
            button.disabled = false;
            if (insertError) {
                console.error(insertError);
                message.textContent = 'Не удалось отправить заявку. Попробуйте позже или свяжитесь с нами в WhatsApp.';
                return;
            }
            form.reset();
            message.textContent = 'Заявка отправлена. Администратор свяжется с вами для подтверждения.';
        });
    }

    loadCourse().catch((error) => {
        console.error('Ошибка загрузки курса:', error);
        root.innerHTML = '<div class="empty">Ошибка загрузки курса. Попробуйте обновить страницу.</div>';
    });
})();