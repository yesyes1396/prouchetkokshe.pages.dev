(function () {
    const client = window.supabaseClient;
    if (!client) return;

    const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (character) => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[character]);

    async function renderBenefits() {
        const { data, error } = await client.from('content_cards')
            .select('icon,title,body,sort_order')
            .eq('section', 'benefits').eq('is_published', true).order('sort_order');
        if (error || !data?.length) return;

        const grid = document.querySelector('.features-grid');
        if (!grid) return;
        grid.innerHTML = data.map((card) => `
            <article class="glass-card">
                <div class="icon-box"><i class="${escapeHtml(card.icon)}" aria-hidden="true"></i></div>
                <h3>${escapeHtml(card.title)}</h3>
                <p>${escapeHtml(card.body)}</p>
            </article>
        `).join('');
    }

    async function renderFaq() {
        const { data, error } = await client.from('content_cards')
            .select('icon,title,body,sort_order')
            .eq('section', 'faq').eq('is_published', true).order('sort_order');
        if (error || !data?.length) return;

        const container = document.querySelector('.faq-container');
        if (!container) return;
        container.innerHTML = data.map((card) => `
            <article class="faq-item">
                <button class="faq-question" type="button" aria-expanded="false">
                    <span>${escapeHtml(card.title)}</span><i class="${escapeHtml(card.icon)}" aria-hidden="true"></i>
                </button>
                <div class="faq-answer"><div class="faq-answer-content">${escapeHtml(card.body)}</div></div>
            </article>
        `).join('');
        container.addEventListener('click', (event) => {
            const question = event.target.closest('.faq-question');
            if (!question) return;
            const item = question.closest('.faq-item');
            const shouldOpen = !item.classList.contains('active');
            container.querySelectorAll('.faq-item').forEach((entry) => {
                entry.classList.remove('active');
                entry.querySelector('.faq-question')?.setAttribute('aria-expanded', 'false');
            });
            if (shouldOpen) {
                item.classList.add('active');
                question.setAttribute('aria-expanded', 'true');
            }
        });
    }

    async function renderCourses() {
        const { data, error } = await client.from('courses')
            .select('slug,title,short_description,curriculum,price,currency,sort_order')
            .eq('is_published', true).order('sort_order');
        if (error || !data?.length) return;

        const grid = document.querySelector('.courses-grid');
        if (!grid) return;
        grid.innerHTML = data.map((course) => {
            const curriculum = Array.isArray(course.curriculum) ? course.curriculum : [];
            const price = Number(course.price).toLocaleString('ru-RU').replace(/[\s\u00a0\u202f]+/g, '.');
            const currency = course.currency === 'KZT' ? 'тг' : escapeHtml(course.currency);
            return `
                <article class="glass-card course-card">
                    ${course.slug === 'pro' ? '<span class="course-tag">Популярный</span>' : ''}
                    <h3>${escapeHtml(course.title)}</h3>
                    <p>${escapeHtml(course.short_description)}</p>
                    <span class="price">${price} ${currency}</span>
                    <ul class="course-features">
                        ${curriculum.map((item) => `<li><i class="fa-solid fa-check" aria-hidden="true"></i><span>${escapeHtml(item)}</span></li>`).join('')}
                    </ul>
                    <a href="course.html?slug=${encodeURIComponent(course.slug)}" class="btn btn-primary full-width"><i class="fa-solid fa-cart-shopping" aria-hidden="true"></i>&nbsp; Купить курс</a>
                </article>
            `;
        }).join('');
    }

    Promise.all([renderBenefits(), renderFaq(), renderCourses()]).catch((error) => {
        console.error('Не удалось загрузить опубликованный контент Supabase:', error);
    });
})();