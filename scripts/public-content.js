(function () {
    const client = window.supabaseClient;
    if (!client) return;

    const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (character) => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[character]);
    const defaultFooter = {
        brand: 'ProUchet',
        description: 'Профессиональное обучение бухгалтерии в Казахстане. От азов до уровня главного бухгалтера за 2 месяца.',
        navigation_title: 'Навигация',
        navigation_links: [{ label: 'Главная', href: '#home' }, { label: 'Преимущества', href: '#features' }, { label: 'Курсы', href: '#courses' }, { label: 'Вопросы и ответы', href: '#faq' }],
        support_title: 'Поддержка',
        support_links: [{ label: 'Конфиденциальность', href: 'privacy-policy.html' }, { label: 'Задать вопрос', href: '#contact' }, { label: 'Наш канал', href: 'https://t.me/buh_kursy_1C' }],
        contacts_title: 'Контакты',
        address: 'г. Кокшетау, Улица Рахымжана Кошкарбаева, 58',
        phone: '+7 777 515 95 66',
        email: 'prouchet2@gmail.com',
        copyright: '© 2026 ProUchet. Все права защищены.',
        telegram_url: 'https://t.me/buh_kursy_1C',
        whatsapp_url: 'https://wa.me/+77775159566',
        instagram_url: 'https://instagram.com/rakhimova_buh?mdxt=NDJ4N2pqc3poMGli'
    };

    function safeHref(value) {
        const href = String(value || '').trim();
        if (/^(#|\/|\.\/|\.\.\/)/.test(href)) return href;
        try {
            const url = new URL(href, window.location.href);
            return ['http:', 'https:', 'mailto:', 'tel:'].includes(url.protocol) ? href : '#';
        } catch {
            return '#';
        }
    }

    function renderFooter(settings) {
        const footer = document.querySelector('footer');
        if (!footer) return;
        const values = { ...defaultFooter, ...(settings || {}) };
        const setText = (selector, value) => {
            const element = footer.querySelector(selector);
            if (element) element.textContent = value || '';
        };
        setText('.footer-brand .logo-text', values.brand);
        setText('.footer-brand p', values.description);
        setText('.footer-bottom .copyright', values.copyright);
        const titles = footer.querySelectorAll('.footer-title');
        if (titles[0]) titles[0].textContent = values.navigation_title;
        if (titles[1]) titles[1].textContent = values.support_title;
        if (titles[2]) titles[2].textContent = values.contacts_title;
        const linkLists = footer.querySelectorAll('.footer-links');
        [values.navigation_links, values.support_links].forEach((links, index) => {
            const list = linkLists[index];
            if (!list) return;
            list.replaceChildren(...(Array.isArray(links) ? links : []).map((link) => {
                const item = document.createElement('li');
                const anchor = document.createElement('a');
                anchor.textContent = link.label || '';
                anchor.href = safeHref(link.href);
                item.append(anchor);
                return item;
            }));
        });
        const contacts = footer.querySelectorAll('.footer-contact-item span');
        [values.address, values.phone, values.email].forEach((value, index) => {
            if (contacts[index]) contacts[index].textContent = value || '';
        });
        const mapAddress = values.address || defaultFooter.address;
        const locationAddress = footer.querySelector('.footer-location-address-text');
        if (locationAddress) locationAddress.textContent = mapAddress;
        const locationLink = footer.querySelector('.footer-location-address');
        if (locationLink) {
            const mapUrl = new URL('https://www.google.com/maps/search/');
            mapUrl.searchParams.set('api', '1');
            mapUrl.searchParams.set('query', mapAddress);
            locationLink.href = mapUrl.toString();
        }
        const mapFrame = footer.querySelector('.footer-location-map');
        if (mapFrame) {
            const mapUrl = new URL('https://maps.google.com/maps');
            mapUrl.searchParams.set('q', mapAddress);
            mapUrl.searchParams.set('output', 'embed');
            mapFrame.src = mapUrl.toString();
            mapFrame.title = `Карта: ${mapAddress}`;
        }
        const socialLinks = footer.querySelectorAll('.footer-legal a');
        [values.telegram_url, values.whatsapp_url, values.instagram_url].forEach((value, index) => {
            if (socialLinks[index]) socialLinks[index].href = safeHref(value);
        });
    }

    async function loadFooter() {
        const { data, error } = await client.from('site_settings').select('value').eq('key', 'footer').maybeSingle();
        if (error) {
            console.error('Не удалось загрузить настройки футера:', error);
            return;
        }
        renderFooter(data?.value);
    }

    async function renderBenefits() {
        const { data, error } = await client.from('content_cards')
            .select('id,icon,title,body,sort_order')
            .eq('section', 'benefits').eq('is_published', true).order('sort_order');
        const grid = document.querySelector('.features-grid');
        if (!grid) return;
        if (error) {
            console.error('Не удалось загрузить преимущества:', error);
            return;
        }
        if (!data?.length) {
            if (document.body.classList.contains('admin-mode')) grid.replaceChildren();
            return;
        }
        grid.innerHTML = data.map((card) => `
            <article class="glass-card">
                <span class="admin-content-marker" data-admin-type="content_cards" data-admin-section="benefits" data-admin-id="${escapeHtml(card.id)}"></span>
                <div class="icon-box"><i class="${escapeHtml(card.icon)}" aria-hidden="true"></i></div>
                <h3>${escapeHtml(card.title)}</h3>
                <p>${escapeHtml(card.body)}</p>
            </article>
        `).join('');
    }

    async function renderFaq() {
        const { data, error } = await client.from('content_cards')
            .select('id,icon,title,body,sort_order')
            .eq('section', 'faq').eq('is_published', true).order('sort_order');
        const container = document.querySelector('.faq-container');
        if (!container) return;
        if (error) {
            console.error('Не удалось загрузить вопросы и ответы:', error);
            return;
        }
        if (!data?.length) {
            if (document.body.classList.contains('admin-mode')) container.replaceChildren();
            return;
        }
        container.innerHTML = data.map((card) => `
            <article class="faq-item" data-admin-type="content_cards" data-admin-section="faq" data-admin-id="${escapeHtml(card.id)}">
                <button class="faq-question" type="button" aria-expanded="false">
                    <span>${escapeHtml(card.title)}</span><i class="${escapeHtml(card.icon)}" aria-hidden="true"></i>
                </button>
                <div class="faq-answer"><div class="faq-answer-content">${escapeHtml(card.body)}</div></div>
            </article>
        `).join('');
        container.onclick = (event) => {
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
        };
    }

    async function renderCourses() {
        const { data, error } = await client.from('courses')
            .select('id,slug,title,short_description,curriculum,price,currency,sort_order')
            .eq('is_published', true).order('sort_order');
        const grid = document.querySelector('.courses-grid');
        if (!grid) return;
        if (error) {
            console.error('Не удалось загрузить курсы:', error);
            return;
        }
        if (!data?.length) {
            if (document.body.classList.contains('admin-mode')) grid.replaceChildren();
            return;
        }
        grid.innerHTML = data.map((course) => {
            const curriculum = Array.isArray(course.curriculum) ? course.curriculum : [];
            const price = Number(course.price).toLocaleString('ru-RU').replace(/[\s\u00a0\u202f]+/g, '.');
            const currency = course.currency === 'KZT' ? 'тг' : escapeHtml(course.currency);
            return `
                <article class="glass-card course-card" data-admin-type="courses" data-admin-section="" data-admin-id="${escapeHtml(course.id)}">
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

    function refreshContent() {
        return Promise.all([renderBenefits(), renderFaq(), renderCourses(), loadFooter()]).then(() => {
            window.dispatchEvent(new Event('prouchet:content-rendered'));
        }).catch((error) => {
            console.error('Не удалось загрузить опубликованный контент Supabase:', error);
        });
    }

    window.addEventListener('prouchet:content-refresh', refreshContent);
    window.addEventListener('prouchet:footer-updated', (event) => renderFooter(event.detail));
    refreshContent();
})();