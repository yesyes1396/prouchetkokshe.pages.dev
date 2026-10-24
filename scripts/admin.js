(function () {
    const client = window.supabaseClient;
    const authGate = document.getElementById('authGate');
    const adminShell = document.querySelector('.admin-shell');
    const authForm = document.getElementById('adminAuthForm');
    const authMessage = document.getElementById('authMessage');
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
    const state = {
        cards: [], courses: [], applications: [], footer: defaultFooter,
        unreadApplicationsCount: 0, applicationTotalCount: 0, applicationPage: 1,
        applicationPageSize: 25, selectedApplicationIds: new Set()
    };
    const sectionNames = { benefits: 'Преимущества', faq: 'FAQ' };

    const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (character) => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[character]);
    const safeIcon = (value) => escapeHtml(value || 'fa-solid fa-circle');
    const showMessage = (message, isError = true) => {
        if (!authMessage) return;
        authMessage.textContent = message;
        authMessage.style.color = isError ? '#dc2626' : '#16a34a';
    };
    const courseQrStoragePath = (publicUrl) => {
        if (!publicUrl) return null;
        try {
            const url = new URL(publicUrl);
            const projectUrl = new URL(window.APP_CONFIG.supabaseUrl);
            const prefix = '/storage/v1/object/public/course-payment-qr/';
            if (url.origin !== projectUrl.origin || !url.pathname.startsWith(prefix)) return null;
            return decodeURIComponent(url.pathname.slice(prefix.length));
        } catch {
            return null;
        }
    };

    if (!client) {
        showMessage('Supabase не загружен. Проверьте подключение к интернету и config.js.');
        return;
    }

    authForm?.addEventListener('submit', async (event) => {
        event.preventDefault();
        const form = new FormData(authForm);
        const { error } = await client.auth.signInWithPassword({
            email: String(form.get('email')).trim(),
            password: String(form.get('password'))
        });
        if (error) {
            showMessage('Не удалось войти. Проверьте данные администратора.');
            return;
        }
        await startAdmin();
    });

    async function startAdmin() {
        showMessage('Проверяем доступ…', false);
        const { data: sessionData, error: sessionError } = await client.auth.getSession();
        const user = sessionData?.session?.user;
        if (sessionError) {
            console.error('Не удалось проверить сессию администратора:', sessionError);
            showMessage('Не удалось проверить вход. Обновите страницу и попробуйте снова.');
            return;
        }
        if (!user) return;

        const { data: admin, error } = await client.from('admin_users')
            .select('user_id').eq('user_id', user.id).maybeSingle();
        if (error) {
            console.error('Не удалось проверить права администратора:', error);
            showMessage('Не удалось проверить права доступа. Попробуйте обновить страницу.');
            return;
        }
        if (!admin) {
            await client.auth.signOut();
            showMessage('У этой учётной записи нет прав администратора.');
            return;
        }

        if (authGate) authGate.style.display = 'none';
        if (adminShell) adminShell.style.display = 'block';
        if (authMessage) authMessage.textContent = '';
        document.body.classList.add('admin-mode');
        await loadEverything();
    }

    async function loadEverything() {
        const results = await Promise.all([
            client.from('content_cards').select('*').order('sort_order'),
            client.from('courses').select('*').order('sort_order'),
            client.from('site_settings').select('value').eq('key', 'footer').maybeSingle()
        ]);
        const [cards, courses, footer] = results;
        const failed = [
            ['карточек', cards],
            ['курсов', courses],
            ['настроек футера', footer]
        ].find(([, result]) => result.error);
        if (failed) {
            const [resource, result] = failed;
            console.error(`Ошибка загрузки ${resource}:`, result.error);
            alert(`Не удалось загрузить ${resource}: ${result.error.message} (код ${result.error.code || 'не указан'}). Проверьте схему Supabase и права администратора.`);
            return;
        }
        state.cards = cards.data || [];
        state.courses = courses.data || [];
        state.footer = { ...defaultFooter, ...(footer.data?.value || {}) };
        if (document.getElementById('contentSections')) renderContent();
        if (document.getElementById('applicationsBody')) await loadApplications();
        updateStats();
        window.dispatchEvent(new CustomEvent('prouchet:admin-data', {
            detail: { cards: state.cards, courses: state.courses, applications: state.applications }
        }));
        window.dispatchEvent(new Event('prouchet:content-refresh'));
    }

    function contentSearchText(item) {
        return `${item.title} ${item.body || ''} ${item.short_description || ''} ${item.category || ''} ${item.price || ''}`.toLocaleLowerCase();
    }

    function renderCard(item, type) {
        const isCourse = type === 'courses';
        const details = isCourse
            ? `${item.category} · ${Number(item.price).toLocaleString('ru-RU')} ${item.currency}`
            : item.body;
        const order = item.sort_order;
        return `
            <article class="content-card">
                ${isCourse ? '' : `<div class="icon-box"><i class="${safeIcon(item.icon)}" aria-hidden="true"></i></div>`}
                <h4>${escapeHtml(item.title)}</h4>
                <p>${escapeHtml(details)}</p>
                <div class="meta"><span>${item.is_published ? 'Опубликовано' : 'Скрыто'}</span><strong>№ ${order}</strong></div>
                <div class="card-actions">
                    <button class="mini-btn primary" data-action="edit" data-type="${type}" data-section="${item.section || ''}" data-id="${item.id}">Изменить</button>
                    <button class="mini-btn" data-action="move" data-type="${type}" data-section="${item.section || ''}" data-id="${item.id}" data-direction="-1" aria-label="Переместить выше">↑</button>
                    <button class="mini-btn" data-action="move" data-type="${type}" data-section="${item.section || ''}" data-id="${item.id}" data-direction="1" aria-label="Переместить ниже">↓</button>
                    <button class="mini-btn" data-action="publish" data-type="${type}" data-section="${item.section || ''}" data-id="${item.id}">${item.is_published ? 'Скрыть' : 'Опубликовать'}</button>
                    <button class="mini-btn danger" data-action="delete" data-type="${type}" data-section="${item.section || ''}" data-id="${item.id}">Удалить</button>
                </div>
            </article>`;
    }

    function renderContent() {
        const container = document.getElementById('contentSections');
        if (!container) return;
        const search = document.getElementById('searchInput').value.trim().toLocaleLowerCase();
        const sort = document.getElementById('sortSelect').value;
        const groups = [
            ...Object.entries(sectionNames).map(([section, title]) => ({
                type: 'content_cards', key: section, title,
                items: state.cards.filter((item) => item.section === section)
            })),
            { type: 'courses', key: 'courses', title: 'Курсы', items: state.courses }
        ];

        container.innerHTML = groups.map((group) => {
            let items = group.items.filter((item) => !search || contentSearchText(item).includes(search));
            if (sort === 'alpha') items = [...items].sort((a, b) => a.title.localeCompare(b.title, 'ru'));
            else if (sort === 'date-asc') items = [...items].sort((a, b) => new Date(a.updated_at || a.created_at || 0) - new Date(b.updated_at || b.created_at || 0));
            else if (sort === 'date-desc') items = [...items].sort((a, b) => new Date(b.updated_at || b.created_at || 0) - new Date(a.updated_at || a.created_at || 0));
            else items = [...items].sort((a, b) => a.sort_order - b.sort_order);
            return `
                <section class="section-box" id="section-${group.key}">
                    <div class="section-box-header">
                        <h3>${group.title}</h3>
                        <button class="primary-btn" type="button" data-action="add" data-type="${group.type}" data-section="${group.key}">+ Добавить</button>
                    </div>
                    <div class="cards-grid">
                        ${items.map((item) => renderCard(item, group.type)).join('')}
                    </div>
                </section>`;
        }).join('') + `
            <section class="section-box" id="section-footer">
                <div class="section-box-header">
                    <h3>Футер сайта</h3>
                    <button class="primary-btn" type="button" data-action="edit-footer">Изменить футер</button>
                </div>
                <p>Бренд, описание, ссылки, контакты и социальные сети.</p>
            </section>`;
    }

    function statusOptions(value, options) {
        return options.map(([key, label]) => `<option value="${key}" ${key === value ? 'selected' : ''}>${label}</option>`).join('');
    }

    function normalizePhone(phone) {
        let digits = String(phone || '').replace(/\D/g, '');
        if (digits.startsWith('8') && digits.length === 11) digits = `7${digits.slice(1)}`;
        return digits;
    }

    async function loadApplications() {
        const statusFilter = document.getElementById('applicationFilter').value;
        const paymentFilter = document.getElementById('paymentFilter').value;
        const sort = document.getElementById('applicationSort').value;
        const search = document.getElementById('applicationSearch').value.trim()
            .replace(/[^\p{L}\p{N}+@ _-]/gu, ' ')
            .replace(/\s+/g, ' ').trim();
        const offset = (state.applicationPage - 1) * state.applicationPageSize;
        const order = sort === 'alpha'
            ? { column: 'full_name', ascending: true }
            : { column: 'created_at', ascending: sort === 'date-asc' };
        let applicationsQuery = client.from('applications').select('*', { count: 'exact' })
            .order(order.column, { ascending: order.ascending })
            .order('id', { ascending: true })
            .range(offset, offset + state.applicationPageSize - 1);
        if (statusFilter !== 'all') applicationsQuery = applicationsQuery.eq('status', statusFilter);
        if (paymentFilter !== 'all') applicationsQuery = applicationsQuery.eq('payment_status', paymentFilter);
        if (search) applicationsQuery = applicationsQuery.or(`full_name.ilike.%${search}%,phone.ilike.%${search}%`);

        const [applications, unread] = await Promise.all([
            applicationsQuery,
            client.from('applications').select('id', { count: 'exact', head: true }).eq('status', 'unread')
        ]);
        const failed = [applications, unread].find((result) => result.error);
        if (failed) {
            console.error('Ошибка загрузки заявок:', failed.error);
            alert(`Не удалось загрузить заявки: ${failed.error.message}`);
            return;
        }
        state.applicationTotalCount = applications.count || 0;
        state.unreadApplicationsCount = unread.count || 0;
        const pageCount = Math.max(1, Math.ceil(state.applicationTotalCount / state.applicationPageSize));
        if (state.applicationPage > pageCount) {
            state.applicationPage = pageCount;
            return loadApplications();
        }
        state.applications = applications.data || [];
        renderApplications();
        updateStats();
    }

    function renderApplications() {
        if (!document.getElementById('applicationsBody')) return;
        const statusFilter = document.getElementById('applicationFilter').value;
        const rows = state.applications;
        const count = document.getElementById('applicationCount');
        if (count) count.textContent = String(state.applicationTotalCount);
        document.querySelectorAll('[data-application-filter-button]').forEach((button) => {
            button.classList.toggle('active', button.dataset.applicationFilterButton === statusFilter);
        });
        const start = state.applicationTotalCount ? (state.applicationPage - 1) * state.applicationPageSize + 1 : 0;
        const end = Math.min(state.applicationPage * state.applicationPageSize, state.applicationTotalCount);
        document.getElementById('applicationPageInfo').textContent = `${start}–${end} из ${state.applicationTotalCount}`;
        document.getElementById('previousApplicationPage').disabled = state.applicationPage <= 1;
        document.getElementById('nextApplicationPage').disabled = end >= state.applicationTotalCount;
        const pageIds = rows.map((application) => String(application.id));
        const selectAll = document.getElementById('selectAllApplications');
        selectAll.checked = pageIds.length > 0 && pageIds.every((id) => state.selectedApplicationIds.has(id));
        selectAll.disabled = pageIds.length === 0;
        document.getElementById('applicationBulkActions').hidden = state.selectedApplicationIds.size === 0;
        document.getElementById('selectedApplicationCount').textContent = String(state.selectedApplicationIds.size);
        document.getElementById('applicationsBody').innerHTML = rows.map((application) => {
            const phone = normalizePhone(application.phone);
            const date = new Date(application.created_at).toLocaleString('ru-RU');
            return `
                <tr data-status="${escapeHtml(application.status)}">
                    <td class="application-select-cell"><input class="application-select" type="checkbox" data-application-select="${escapeHtml(application.id)}" aria-label="Выбрать заявку ${escapeHtml(application.full_name)}" ${state.selectedApplicationIds.has(String(application.id)) ? 'checked' : ''}></td>
                    <td>${escapeHtml(application.full_name)}</td>
                    <td>${escapeHtml(application.phone)}</td>
                    <td>${escapeHtml(application.course_title || 'Консультация')}</td>
                    <td>${escapeHtml(date)}</td>
                    <td><select class="application-status" data-application-id="${application.id}" data-column="status">${statusOptions(application.status, [['unread', 'Не прочитано'], ['viewed', 'Просмотрено'], ['archived', 'Архив']])}</select></td>
                    <td><select class="application-status" data-application-id="${application.id}" data-column="payment_status">${statusOptions(application.payment_status, [['pending', 'Ожидает оплаты'], ['paid', 'Оплачено'], ['rejected', 'Отклонено']])}</select></td>
                    <td class="application-actions">
                        <a class="mini-btn application-contact" href="https://wa.me/${escapeHtml(phone)}" target="_blank" rel="noopener" data-view-application="${application.id}"><i class="fa-brands fa-whatsapp" aria-hidden="true"></i> Написать</a>
                        ${application.status !== 'archived' ? `<button class="mini-btn" type="button" data-application-action="archive" data-application-id="${application.id}">В архив</button>` : ''}
                        ${application.payment_status !== 'paid' ? `<button class="mini-btn primary" type="button" data-application-action="paid" data-application-id="${application.id}">Оплачено</button>` : ''}
                    </td>
                </tr>`;
        }).join('') || '<tr><td colspan="8">Заявок по выбранным условиям нет.</td></tr>';
    }

    function updateStats() {
        const totalSections = document.getElementById('totalSections');
        const totalCards = document.getElementById('totalCards');
        const newRequests = document.getElementById('newRequests');
        if (totalSections) totalSections.textContent = '4';
        if (totalCards) totalCards.textContent = String(state.cards.length + state.courses.length);
        if (newRequests) newRequests.textContent = String(state.unreadApplicationsCount);
        const inlineCount = document.getElementById('adminInlineNewRequests');
        if (inlineCount) inlineCount.textContent = String(state.unreadApplicationsCount);
    }

    function editorField(label, name, value, options = {}) {
        const safeValue = escapeHtml(value ?? '');
        if (options.type === 'checkbox') {
            return `<label class="editor-checkbox">${label}<input type="checkbox" name="${name}" ${value ? 'checked' : ''}><span class="editor-switch" aria-hidden="true"></span></label>`;
        }
        if (options.type === 'textarea') {
            return `<label>${label}<textarea name="${name}" rows="${options.rows || 3}" ${options.required ? 'required' : ''}>${safeValue}</textarea></label>`;
        }
        if (options.type === 'file') {
            return `<label>${label}<input name="${name}" type="file" accept="image/png,image/jpeg,image/webp"></label>`;
        }
        return `<label>${label}<input name="${name}" type="${options.type || 'text'}" value="${safeValue}" ${options.required ? 'required' : ''} ${options.min !== undefined ? `min="${options.min}"` : ''}></label>`;
    }

    const editorStyles = `
        .admin-editor-dialog{position:fixed;inset:auto;top:50%;left:50%;transform:translate(-50%,-50%);margin:0;width:min(720px,calc(100% - 28px));max-width:none;max-height:92vh;padding:0;overflow:hidden;border:1px solid #dce5e7;border-radius:12px;background:#fff;color:#172a32;box-shadow:0 28px 90px #10252c40}
        .admin-editor-dialog::backdrop{background:#10252c99;backdrop-filter:blur(3px)}
        .editor-form{display:grid;grid-template-rows:auto minmax(0,1fr) auto;max-height:92vh;font-family:Manrope,'Segoe UI',sans-serif}
        .editor-head{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:20px 24px;border-bottom:1px solid #e4ebec;background:#f8faf9}
        .editor-kicker{display:block;margin-bottom:5px;color:#087e78;font-size:.65rem;font-weight:800;letter-spacing:.12em}
        .editor-form h2{margin:0;color:#172a32;font-size:1.2rem;letter-spacing:0}
        .editor-close{display:grid;place-items:center;width:36px;height:36px;border:1px solid #dce5e7;border-radius:7px;background:#fff;color:#506168;font:inherit;font-size:1rem;cursor:pointer}
        .editor-fields{display:grid;align-content:start;gap:15px;overflow:auto;padding:22px 24px}
        .editor-form label{display:grid;gap:7px;color:#34484f;font-size:.83rem;font-weight:700}
        .editor-form input:not([type=checkbox]),.editor-form textarea{width:100%;min-height:42px;padding:10px 12px;border:1px solid #d6e0e2;border-radius:7px;background:#fff;color:#172a32;font:500 .9rem Manrope,'Segoe UI',sans-serif;transition:border-color 150ms ease,box-shadow 150ms ease}
        .editor-form textarea{min-height:92px;resize:vertical;line-height:1.5}
        .editor-form input:focus,.editor-form textarea:focus{outline:0;border-color:#087e78;box-shadow:0 0 0 3px #d6eeea}
        .editor-form input[type=file]{padding:8px}
        .editor-checkbox{position:relative;display:flex!important;align-items:center;gap:12px!important;min-height:42px;width:fit-content;cursor:pointer}
        .editor-checkbox input{position:absolute;width:1px;height:1px;opacity:0}
        .editor-switch{position:relative;width:42px;height:24px;border-radius:99px;background:#cbd5d7;transition:background 160ms ease}
        .editor-switch::after{position:absolute;top:3px;left:3px;width:18px;height:18px;border-radius:50%;background:#fff;box-shadow:0 1px 3px #172a3233;content:'';transition:transform 160ms ease}
        .editor-checkbox input:checked+.editor-switch{background:#087e78}
        .editor-checkbox input:checked+.editor-switch::after{transform:translateX(18px)}
        .editor-checkbox input:focus-visible+.editor-switch{outline:3px solid #c8e8e3;outline-offset:2px}
        .editor-actions{display:flex;justify-content:flex-end;gap:9px;padding:14px 24px;border-top:1px solid #e4ebec;background:#fff}
        .editor-actions button{min-width:108px;border-radius:7px;font:700 .84rem Manrope,'Segoe UI',sans-serif}
        .editor-actions .soft-btn{border:1px solid #dce5e7;background:#fff;color:#43565c}
        .editor-actions .primary-btn{border:1px solid #087e78;background:#087e78;color:#fff}
        @media(max-width:560px){.admin-editor-dialog{width:calc(100% - 16px);max-height:94vh}.editor-form{max-height:94vh}.editor-head{padding:16px}.editor-fields{gap:12px;padding:16px}.editor-actions{padding:12px 16px}.editor-actions button{flex:1}}
    `;

    function prepareEditor(editor, title, fields) {
        editor.className = 'admin-editor-dialog';
        editor.innerHTML = `
            <style>${editorStyles}</style>
            <form method="dialog" class="editor-form">
                <header class="editor-head">
                    <div><span class="editor-kicker">PROUCHET · РЕДАКТОР</span><h2>${title}</h2></div>
                    <button type="button" class="editor-close" data-close aria-label="Закрыть"><i class="fa-solid fa-xmark" aria-hidden="true"></i></button>
                </header>
                <div class="editor-fields">${fields.join('')}</div>
                <div class="editor-actions"><button type="button" class="soft-btn" data-cancel>Отмена</button><button type="submit" class="primary-btn"><i class="fa-solid fa-check" aria-hidden="true"></i> Сохранить</button></div>
            </form>`;
        document.body.append(editor);
        const form = editor.querySelector('form');
        editor.querySelectorAll('[data-close], [data-cancel]').forEach((button) => button.addEventListener('click', () => editor.close()));
        editor.addEventListener('close', () => editor.remove());
        return form;
    }

    async function applyOrder(type, section, savedItem, requestedPosition) {
        const group = type === 'courses'
            ? state.courses
            : state.cards.filter((card) => card.section === section);
        const ordered = group
            .filter((record) => record.id !== savedItem.id)
            .sort((first, second) => first.sort_order - second.sort_order);
        const requested = Number(requestedPosition);
        const position = Math.min(Math.max(Number.isFinite(requested) ? Math.trunc(requested) : ordered.length + 1, 1), ordered.length + 1);
        ordered.splice(position - 1, 0, savedItem);

        for (let index = 0; index < ordered.length; index += 1) {
            const { error } = await client.from(type)
                .update({ sort_order: index + 1 })
                .eq('id', ordered[index].id);
            if (error) return error;
        }
        return null;
    }

    async function editItem(type, item = null, section = null) {
        const isCourse = type === 'courses';
        const editor = document.createElement('dialog');
        const itemValues = item || { icon: 'fa-solid fa-circle-check', is_published: true, sort_order: isCourse ? state.courses.length + 1 : state.cards.filter((card) => card.section === section).length + 1 };
        const fields = isCourse
            ? [editorField('Название', 'title', itemValues.title, { required: true }), editorField('Ссылка slug', 'slug', itemValues.slug, { required: true }), editorField('Категория', 'category', itemValues.category || 'Бухгалтерия', { required: true }), editorField('Короткое описание', 'short_description', itemValues.short_description, { type: 'textarea' }), editorField('Описание страницы', 'description', itemValues.description, { type: 'textarea', rows: 5 }), editorField('Программа, один пункт на строку', 'curriculum', (itemValues.curriculum || []).join('\n'), { type: 'textarea', rows: 6 }), editorField('Длительность', 'duration', itemValues.duration), editorField('Цена', 'price', itemValues.price, { type: 'number', min: 0, required: true }), editorField('Валюта', 'currency', itemValues.currency || 'KZT'), editorField('Инструкция по оплате', 'payment_instructions', itemValues.payment_instructions, { type: 'textarea', rows: 4 }), editorField('Публичная ссылка на Kaspi QR', 'kaspi_qr_url', itemValues.kaspi_qr_url), editorField('Загрузить/заменить QR (PNG, JPG или WebP)', 'kaspi_qr_file', '', { type: 'file' }), editorField('Порядок', 'sort_order', itemValues.sort_order, { type: 'number', min: 1 }), editorField('Опубликовано', 'is_published', itemValues.is_published, { type: 'checkbox' })]
            : [editorField('Иконка Font Awesome', 'icon', itemValues.icon), editorField('Заголовок', 'title', itemValues.title, { required: true }), editorField('Текст', 'body', itemValues.body, { type: 'textarea', rows: 5, required: true }), editorField('Порядок', 'sort_order', itemValues.sort_order, { type: 'number', min: 1 }), editorField('Опубликовано', 'is_published', itemValues.is_published, { type: 'checkbox' })];
        const form = prepareEditor(editor, `${item ? 'Изменить' : 'Добавить'} ${isCourse ? 'курс' : sectionNames[section]}`, fields);
        form.addEventListener('submit', async (event) => {
            event.preventDefault();
            const data = new FormData(form);
            const published = data.has('is_published');
            let uploadedQrPath = null;
            const previousQrPath = isCourse ? courseQrStoragePath(item?.kaspi_qr_url) : null;
            const values = isCourse ? {
                slug: String(data.get('slug')).trim().toLowerCase().replace(/\s+/g, '-'),
                category: String(data.get('category')).trim(),
                title: String(data.get('title')).trim(),
                short_description: String(data.get('short_description')).trim(),
                description: String(data.get('description')).trim(),
                curriculum: String(data.get('curriculum')).split('\n').map((line) => line.trim()).filter(Boolean),
                duration: String(data.get('duration')).trim(),
                price: Number(data.get('price')),
                currency: String(data.get('currency')).trim() || 'KZT',
                payment_instructions: String(data.get('payment_instructions')).trim(),
                kaspi_qr_url: String(data.get('kaspi_qr_url')).trim(),
                sort_order: data.get('sort_order') === '' ? (item?.sort_order || state.courses.length + 1) : Number(data.get('sort_order')),
                is_published: published
            } : {
                section,
                icon: String(data.get('icon')).trim(),
                title: String(data.get('title')).trim(),
                body: String(data.get('body')).trim(),
                sort_order: data.get('sort_order') === '' ? (item?.sort_order || state.cards.filter((card) => card.section === section).length + 1) : Number(data.get('sort_order')),
                is_published: published
            };
            if (isCourse) {
                const qrFile = data.get('kaspi_qr_file');
                if (qrFile instanceof File && qrFile.size > 0) {
                    if (!['image/png', 'image/jpeg', 'image/webp'].includes(qrFile.type) || qrFile.size > 5 * 1024 * 1024) {
                        alert('QR-файл должен быть PNG, JPG или WebP и не больше 5 МБ.');
                        return;
                    }
                    uploadedQrPath = `${crypto.randomUUID()}-${qrFile.name.replace(/[^a-zA-Z0-9._-]/g, '-')}`;
                    const { error: uploadError } = await client.storage.from('course-payment-qr').upload(uploadedQrPath, qrFile, { upsert: true });
                    if (uploadError) {
                        uploadedQrPath = null;
                        alert(`Не удалось загрузить QR: ${uploadError.message}`);
                        return;
                    }
                    values.kaspi_qr_url = client.storage.from('course-payment-qr').getPublicUrl(uploadedQrPath).data.publicUrl;
                }
            }
            const query = item
                ? client.from(type).update(values).eq('id', item.id).select().single()
                : client.from(type).insert(values).select().single();
            const { data: savedItem, error } = await query;
            if (error) {
                if (uploadedQrPath) await client.storage.from('course-payment-qr').remove([uploadedQrPath]);
                alert(`Не удалось сохранить: ${error.message}`);
                return;
            }
            if (uploadedQrPath && previousQrPath && previousQrPath !== uploadedQrPath) {
                const { error: removeError } = await client.storage.from('course-payment-qr').remove([previousQrPath]);
                if (removeError) console.error('Курс сохранён, но предыдущий QR не удалось удалить:', removeError);
            }
            const orderError = await applyOrder(type, section, savedItem, values.sort_order);
            if (orderError) {
                alert(`Данные сохранены, но порядок обновить не удалось: ${orderError.message}`);
                await loadEverything();
                return;
            }
            editor.close();
            await loadEverything();
        });
        editor.showModal();
    }

    function linkLines(links) {
        return (Array.isArray(links) ? links : []).map((link) => `${link.label || ''} | ${link.href || ''}`).join('\n');
    }

    function parseLinkLines(value) {
        return String(value || '').split('\n').map((line) => {
            const separator = line.indexOf('|');
            if (separator < 0) return null;
            const label = line.slice(0, separator).trim();
            const href = line.slice(separator + 1).trim();
            return label && href ? { label, href } : null;
        }).filter(Boolean);
    }

    async function editFooter() {
        const footer = state.footer;
        const fields = [
            editorField('Название бренда', 'brand', footer.brand, { required: true }),
            editorField('Описание', 'description', footer.description, { type: 'textarea', rows: 3 }),
            editorField('Заголовок навигации', 'navigation_title', footer.navigation_title),
            editorField('Ссылки навигации (название | адрес, по одной на строку)', 'navigation_links', linkLines(footer.navigation_links), { type: 'textarea', rows: 4 }),
            editorField('Заголовок поддержки', 'support_title', footer.support_title),
            editorField('Ссылки поддержки (название | адрес, по одной на строку)', 'support_links', linkLines(footer.support_links), { type: 'textarea', rows: 4 }),
            editorField('Заголовок контактов', 'contacts_title', footer.contacts_title),
            editorField('Адрес', 'address', footer.address),
            editorField('Телефон', 'phone', footer.phone),
            editorField('Электронная почта', 'email', footer.email),
            editorField('Текст копирайта', 'copyright', footer.copyright),
            editorField('Ссылка Telegram', 'telegram_url', footer.telegram_url),
            editorField('Ссылка WhatsApp', 'whatsapp_url', footer.whatsapp_url),
            editorField('Ссылка Instagram', 'instagram_url', footer.instagram_url)
        ];
        const editor = document.createElement('dialog');
        const form = prepareEditor(editor, 'Редактировать футер', fields);
        form.addEventListener('submit', async (event) => {
            event.preventDefault();
            const data = new FormData(form);
            const values = {
                brand: String(data.get('brand')).trim(),
                description: String(data.get('description')).trim(),
                navigation_title: String(data.get('navigation_title')).trim(),
                navigation_links: parseLinkLines(data.get('navigation_links')),
                support_title: String(data.get('support_title')).trim(),
                support_links: parseLinkLines(data.get('support_links')),
                contacts_title: String(data.get('contacts_title')).trim(),
                address: String(data.get('address')).trim(),
                phone: String(data.get('phone')).trim(),
                email: String(data.get('email')).trim(),
                copyright: String(data.get('copyright')).trim(),
                telegram_url: String(data.get('telegram_url')).trim(),
                whatsapp_url: String(data.get('whatsapp_url')).trim(),
                instagram_url: String(data.get('instagram_url')).trim()
            };
            const { error } = await client.from('site_settings').upsert({ key: 'footer', value: values });
            if (error) {
                alert(`Не удалось сохранить футер: ${error.message}`);
                return;
            }
            state.footer = values;
            editor.close();
            window.dispatchEvent(new CustomEvent('prouchet:footer-updated', { detail: values }));
        });
        editor.showModal();
    }

    async function handleContentAction(button) {
        const { action, type, section, id, direction } = button.dataset;
        if (action === 'edit-footer') return editFooter();
        const list = type === 'courses' ? state.courses : state.cards.filter((card) => card.section === section);
        const item = list.find((record) => String(record.id) === String(id));
        if (action === 'add') return editItem(type, null, section);
        if (!item) return;
        if (action === 'edit') return editItem(type, item, item.section);
        if (action === 'delete') {
            if (!window.confirm(`Удалить «${item.title}»?`)) return;
            const { error } = await client.from(type).delete().eq('id', item.id);
            if (error) alert(`Не удалось удалить: ${error.message}`);
            return loadEverything();
        }
        if (action === 'publish') {
            const { error } = await client.from(type).update({ is_published: !item.is_published }).eq('id', item.id);
            if (error) alert(`Не удалось изменить публикацию: ${error.message}`);
            return loadEverything();
        }
        if (action === 'move') {
            const ordered = [...list].sort((a, b) => a.sort_order - b.sort_order);
            const index = ordered.findIndex((record) => record.id === item.id);
            const target = index + Number(direction);
            if (target < 0 || target >= ordered.length) return;
            [ordered[index], ordered[target]] = [ordered[target], ordered[index]];
            const updates = await Promise.all([index, target].map((position) => client.from(type)
                .update({ sort_order: position + 1 }).eq('id', ordered[position].id)));
            const failed = updates.find((result) => result.error);
            if (failed) alert(`Не удалось переместить: ${failed.error.message}`);
            return loadEverything();
        }
    }

    async function updateApplication(id, column, value) {
        const update = { [column]: value };
        if (column === 'status' && value === 'viewed') update.viewed_at = new Date().toISOString();
        const { error } = await client.from('applications').update(update).eq('id', id);
        if (error) {
            alert(`Не удалось обновить заявку: ${error.message}`);
            return;
        }
        state.selectedApplicationIds.delete(String(id));
        await loadApplications();
    }

    async function updateSelectedApplications(status) {
        const ids = [...state.selectedApplicationIds];
        if (!ids.length) return;
        const update = { status };
        if (status === 'viewed') update.viewed_at = new Date().toISOString();
        const { error } = await client.from('applications').update(update).in('id', ids);
        if (error) {
            alert(`Не удалось обновить выбранные заявки: ${error.message}`);
            return;
        }
        state.selectedApplicationIds.clear();
        await loadApplications();
    }

    document.body.addEventListener('click', async (event) => {
        const actionButton = event.target.closest('[data-action]');
        if (actionButton) await handleContentAction(actionButton);
        const applicationAction = event.target.closest('[data-application-action]');
        if (applicationAction) {
            if (applicationAction.dataset.applicationAction === 'archive') {
                await updateApplication(applicationAction.dataset.applicationId, 'status', 'archived');
            } else if (applicationAction.dataset.applicationAction === 'paid') {
                await updateApplication(applicationAction.dataset.applicationId, 'payment_status', 'paid');
            }
            return;
        }
        const phoneLink = event.target.closest('[data-view-application]');
        if (phoneLink) {
            const application = state.applications.find((item) => item.id === phoneLink.dataset.viewApplication);
            if (application?.status === 'unread') await updateApplication(application.id, 'status', 'viewed');
        }
    });
    document.body.addEventListener('change', (event) => {
        const selectAll = event.target.closest('#selectAllApplications');
        if (selectAll) {
            state.applications.forEach((application) => {
                const id = String(application.id);
                if (selectAll.checked) state.selectedApplicationIds.add(id);
                else state.selectedApplicationIds.delete(id);
            });
            renderApplications();
            return;
        }
        const selectedRow = event.target.closest('[data-application-select]');
        if (selectedRow) {
            const id = selectedRow.dataset.applicationSelect;
            if (selectedRow.checked) state.selectedApplicationIds.add(id);
            else state.selectedApplicationIds.delete(id);
            renderApplications();
            return;
        }
        const select = event.target.closest('[data-application-id][data-column]');
        if (select) updateApplication(select.dataset.applicationId, select.dataset.column, select.value);
    });

    document.getElementById('applicationShortcuts')?.addEventListener('click', (event) => {
        const filterButton = event.target.closest('[data-application-filter-button]');
        if (!filterButton) return;
        document.getElementById('applicationFilter').value = filterButton.dataset.applicationFilterButton;
        refreshApplicationsFromFirstPage();
    });
    document.getElementById('resetApplications')?.addEventListener('click', () => {
        document.getElementById('applicationFilter').value = 'unread';
        document.getElementById('paymentFilter').value = 'all';
        document.getElementById('applicationSort').value = 'date-desc';
        document.getElementById('applicationSearch').value = '';
        refreshApplicationsFromFirstPage();
    });

    document.getElementById('applicationBulkActions')?.addEventListener('click', (event) => {
        const action = event.target.closest('[data-bulk-application-action]')?.dataset.bulkApplicationAction;
        if (action === 'viewed' || action === 'archived') updateSelectedApplications(action);
        if (event.target.closest('#clearApplicationSelection')) {
            state.selectedApplicationIds.clear();
            renderApplications();
        }
    });
    document.getElementById('applicationPageSize')?.addEventListener('change', (event) => {
        state.applicationPageSize = Number(event.target.value);
        state.applicationPage = 1;
        state.selectedApplicationIds.clear();
        loadApplications();
    });
    document.getElementById('previousApplicationPage')?.addEventListener('click', () => {
        if (state.applicationPage <= 1) return;
        state.applicationPage -= 1;
        state.selectedApplicationIds.clear();
        loadApplications();
    });
    document.getElementById('nextApplicationPage')?.addEventListener('click', () => {
        const pageCount = Math.ceil(state.applicationTotalCount / state.applicationPageSize);
        if (state.applicationPage >= pageCount) return;
        state.applicationPage += 1;
        state.selectedApplicationIds.clear();
        loadApplications();
    });

    document.getElementById('searchInput')?.addEventListener('input', renderContent);
    document.getElementById('sortSelect')?.addEventListener('change', renderContent);
    function refreshApplicationsFromFirstPage() {
        state.applicationPage = 1;
        state.selectedApplicationIds.clear();
        loadApplications();
    }
    document.getElementById('applicationFilter')?.addEventListener('change', refreshApplicationsFromFirstPage);
    document.getElementById('paymentFilter')?.addEventListener('change', refreshApplicationsFromFirstPage);
    document.getElementById('applicationSort')?.addEventListener('change', refreshApplicationsFromFirstPage);
    let applicationSearchTimer;
    document.getElementById('applicationSearch')?.addEventListener('input', () => {
        window.clearTimeout(applicationSearchTimer);
        applicationSearchTimer = window.setTimeout(refreshApplicationsFromFirstPage, 250);
    });
    document.getElementById('syncBtn')?.addEventListener('click', loadEverything);
    document.getElementById('siteBtn')?.addEventListener('click', () => {
        if (adminShell) {
            window.location.href = 'index.html';
            return;
        }
        document.body.classList.remove('admin-mode');
        document.querySelectorAll('.admin-inline-actions, .admin-add-actions').forEach((node) => node.remove());
    });
    document.getElementById('logoutBtn')?.addEventListener('click', async () => {
        await client.auth.signOut();
        window.location.href = 'index.html';
    });

    window.addEventListener('prouchet:admin-login', startAdmin);
    startAdmin();
})();