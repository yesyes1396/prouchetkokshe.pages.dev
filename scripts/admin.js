(function () {
    const client = window.supabaseClient;
    const authGate = document.getElementById('authGate');
    const adminShell = document.querySelector('.admin-shell');
    const authForm = document.getElementById('adminAuthForm');
    const authMessage = document.getElementById('authMessage');
    const state = { cards: [], courses: [], applications: [] };
    const sectionNames = { benefits: 'Преимущества', faq: 'FAQ' };

    const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (character) => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[character]);
    const safeIcon = (value) => escapeHtml(value || 'fa-solid fa-circle');
    const showMessage = (message, isError = true) => {
        authMessage.textContent = message;
        authMessage.style.color = isError ? '#dc2626' : '#16a34a';
    };

    if (!client) {
        showMessage('Supabase не загружен. Проверьте подключение к интернету и config.js.');
        return;
    }

    authForm.addEventListener('submit', async (event) => {
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
        if (sessionError || !user) return;

        const { data: admin, error } = await client.from('admin_users')
            .select('user_id').eq('user_id', user.id).maybeSingle();
        if (error || !admin) {
            await client.auth.signOut();
            showMessage('У этой учётной записи нет прав администратора.');
            return;
        }

        authGate.style.display = 'none';
        adminShell.style.display = 'block';
        authMessage.textContent = '';
        await loadEverything();
    }

    async function loadEverything() {
        const results = await Promise.all([
            client.from('content_cards').select('*').order('sort_order'),
            client.from('courses').select('*').order('sort_order'),
            client.from('applications').select('*').order('created_at', { ascending: false })
        ]);
        const [cards, courses, applications] = results;
        const failed = results.find((result) => result.error);
        if (failed) {
            console.error('Ошибка загрузки данных:', failed.error);
            alert('Не удалось загрузить данные. Проверьте, что supabase/schema.sql выполнен и учётка добавлена в admin_users.');
            return;
        }
        state.cards = cards.data || [];
        state.courses = courses.data || [];
        state.applications = applications.data || [];
        renderContent();
        renderApplications();
        updateStats();
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
        }).join('');
    }

    function statusOptions(value, options) {
        return options.map(([key, label]) => `<option value="${key}" ${key === value ? 'selected' : ''}>${label}</option>`).join('');
    }

    function normalizePhone(phone) {
        let digits = String(phone || '').replace(/\D/g, '');
        if (digits.startsWith('8') && digits.length === 11) digits = `7${digits.slice(1)}`;
        return digits;
    }

    function renderApplications() {
        const statusFilter = document.getElementById('applicationFilter').value;
        const paymentFilter = document.getElementById('paymentFilter').value;
        const sort = document.getElementById('applicationSort').value;
        const query = document.getElementById('applicationSearch').value.trim().toLocaleLowerCase();
        const rows = state.applications.filter((application) => {
            const matchesStatus = statusFilter === 'all' || application.status === statusFilter;
            const matchesPayment = paymentFilter === 'all' || application.payment_status === paymentFilter;
            const searchable = `${application.full_name} ${application.phone}`.toLocaleLowerCase();
            return matchesStatus && matchesPayment && (!query || searchable.includes(query));
        });
        if (sort === 'alpha') rows.sort((a, b) => a.full_name.localeCompare(b.full_name, 'ru'));
        else if (sort === 'date-asc') rows.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
        else rows.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
        document.getElementById('applicationsBody').innerHTML = rows.map((application) => {
            const phone = normalizePhone(application.phone);
            const date = new Date(application.created_at).toLocaleString('ru-RU');
            return `
                <tr>
                    <td>${escapeHtml(application.full_name)}</td>
                    <td><a href="https://wa.me/${escapeHtml(phone)}" target="_blank" rel="noopener" data-view-application="${application.id}">${escapeHtml(application.phone)}</a></td>
                    <td>${escapeHtml(application.course_title || 'Консультация')}</td>
                    <td>${escapeHtml(date)}</td>
                    <td><select class="application-status" data-application-id="${application.id}" data-column="status">${statusOptions(application.status, [['unread', 'Не прочитано'], ['viewed', 'Просмотрено'], ['archived', 'Архив']])}</select></td>
                    <td><select class="application-status" data-application-id="${application.id}" data-column="payment_status">${statusOptions(application.payment_status, [['pending', 'Ожидает оплаты'], ['paid', 'Оплачено'], ['rejected', 'Отклонено']])}</select></td>
                </tr>`;
        }).join('') || '<tr><td colspan="6">Заявок по выбранным условиям нет.</td></tr>';
    }

    function updateStats() {
        document.getElementById('totalSections').textContent = '3';
        document.getElementById('totalCards').textContent = String(state.cards.length + state.courses.length);
        document.getElementById('newRequests').textContent = String(state.applications.filter((item) => item.status === 'unread').length);
    }

    function editorField(label, name, value, options = {}) {
        const safeValue = escapeHtml(value ?? '');
        if (options.type === 'checkbox') {
            return `<label>${label}<input type="checkbox" name="${name}" ${value ? 'checked' : ''}></label>`;
        }
        if (options.type === 'textarea') {
            return `<label>${label}<textarea name="${name}" rows="${options.rows || 3}" ${options.required ? 'required' : ''}>${safeValue}</textarea></label>`;
        }
        if (options.type === 'file') {
            return `<label>${label}<input name="${name}" type="file" accept="image/png,image/jpeg,image/webp"></label>`;
        }
        return `<label>${label}<input name="${name}" type="${options.type || 'text'}" value="${safeValue}" ${options.required ? 'required' : ''} ${options.min !== undefined ? `min="${options.min}"` : ''}></label>`;
    }

    async function editItem(type, item = null, section = null) {
        const isCourse = type === 'courses';
        const editor = document.createElement('dialog');
        editor.style.cssText = 'border:0;border-radius:14px;width:min(680px,calc(100% - 24px));max-height:90vh;padding:24px;box-shadow:0 20px 60px #0f172a40';
        const itemValues = item || { icon: 'fa-solid fa-circle-check', is_published: true, sort_order: isCourse ? state.courses.length + 1 : state.cards.filter((card) => card.section === section).length + 1 };
        const fields = isCourse
            ? [editorField('Название', 'title', itemValues.title, { required: true }), editorField('Ссылка slug', 'slug', itemValues.slug, { required: true }), editorField('Категория', 'category', itemValues.category || 'Бухгалтерия', { required: true }), editorField('Короткое описание', 'short_description', itemValues.short_description, { type: 'textarea' }), editorField('Описание страницы', 'description', itemValues.description, { type: 'textarea', rows: 5 }), editorField('Программа, один пункт на строку', 'curriculum', (itemValues.curriculum || []).join('\n'), { type: 'textarea', rows: 6 }), editorField('Длительность', 'duration', itemValues.duration), editorField('Цена', 'price', itemValues.price, { type: 'number', min: 0, required: true }), editorField('Валюта', 'currency', itemValues.currency || 'KZT'), editorField('Инструкция по оплате', 'payment_instructions', itemValues.payment_instructions, { type: 'textarea', rows: 4 }), editorField('Публичная ссылка на Kaspi QR', 'kaspi_qr_url', itemValues.kaspi_qr_url), editorField('Загрузить/заменить QR (PNG, JPG или WebP)', 'kaspi_qr_file', '', { type: 'file' }), editorField('Порядок', 'sort_order', itemValues.sort_order, { type: 'number' }), editorField('Опубликовано', 'is_published', itemValues.is_published, { type: 'checkbox' })]
            : [editorField('Иконка Font Awesome', 'icon', itemValues.icon), editorField('Заголовок', 'title', itemValues.title, { required: true }), editorField('Текст', 'body', itemValues.body, { type: 'textarea', rows: 5, required: true }), editorField('Порядок', 'sort_order', itemValues.sort_order, { type: 'number' }), editorField('Опубликовано', 'is_published', itemValues.is_published, { type: 'checkbox' })];
        editor.innerHTML = `
            <form method="dialog" class="editor-form">
                <style>.editor-form{display:grid;gap:12px}.editor-form h2{margin:0 0 6px}.editor-form label{display:grid;gap:6px;font-weight:600}.editor-form input:not([type=checkbox]),.editor-form textarea{width:100%;padding:10px;border:1px solid #cbd5e1;border-radius:8px;font:inherit}.editor-form [type=checkbox]{justify-self:start}.editor-actions{display:flex;gap:10px;justify-content:flex-end;margin-top:10px}</style>
                <h2>${item ? 'Изменить' : 'Добавить'} ${isCourse ? 'курс' : sectionNames[section]}</h2>
                ${fields.join('')}
                <div class="editor-actions"><button type="button" class="soft-btn" data-close>Отмена</button><button type="submit" class="primary-btn">Сохранить</button></div>
            </form>`;
        document.body.append(editor);
        const form = editor.querySelector('form');
        editor.querySelector('[data-close]').addEventListener('click', () => editor.close());
        editor.addEventListener('close', () => editor.remove());
        form.addEventListener('submit', async (event) => {
            event.preventDefault();
            const data = new FormData(form);
            const published = data.has('is_published');
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
                sort_order: Number(data.get('sort_order')) || 0,
                is_published: published
            } : {
                section,
                icon: String(data.get('icon')).trim(),
                title: String(data.get('title')).trim(),
                body: String(data.get('body')).trim(),
                sort_order: Number(data.get('sort_order')) || 0,
                is_published: published
            };
            if (isCourse) {
                const qrFile = data.get('kaspi_qr_file');
                if (qrFile instanceof File && qrFile.size > 0) {
                    if (!['image/png', 'image/jpeg', 'image/webp'].includes(qrFile.type) || qrFile.size > 5 * 1024 * 1024) {
                        alert('QR-файл должен быть PNG, JPG или WebP и не больше 5 МБ.');
                        return;
                    }
                    const filePath = `${crypto.randomUUID()}-${qrFile.name.replace(/[^a-zA-Z0-9._-]/g, '-')}`;
                    const { error: uploadError } = await client.storage.from('course-payment-qr').upload(filePath, qrFile, { upsert: true });
                    if (uploadError) {
                        alert(`Не удалось загрузить QR: ${uploadError.message}`);
                        return;
                    }
                    values.kaspi_qr_url = client.storage.from('course-payment-qr').getPublicUrl(filePath).data.publicUrl;
                }
            }
            const query = item
                ? client.from(type).update(values).eq('id', item.id)
                : client.from(type).insert(values);
            const { error } = await query;
            if (error) {
                alert(`Не удалось сохранить: ${error.message}`);
                return;
            }
            editor.close();
            await loadEverything();
        });
        editor.showModal();
    }

    async function handleContentAction(button) {
        const { action, type, section, id, direction } = button.dataset;
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
        const application = state.applications.find((item) => item.id === id);
        if (application) Object.assign(application, update);
        renderApplications();
        updateStats();
    }

    document.body.addEventListener('click', async (event) => {
        const actionButton = event.target.closest('[data-action]');
        if (actionButton) await handleContentAction(actionButton);
        const phoneLink = event.target.closest('[data-view-application]');
        if (phoneLink) {
            const application = state.applications.find((item) => item.id === phoneLink.dataset.viewApplication);
            if (application?.status === 'unread') await updateApplication(application.id, 'status', 'viewed');
        }
    });
    document.body.addEventListener('change', (event) => {
        const select = event.target.closest('[data-application-id][data-column]');
        if (select) updateApplication(select.dataset.applicationId, select.dataset.column, select.value);
    });

    document.getElementById('searchInput').addEventListener('input', renderContent);
    document.getElementById('sortSelect').addEventListener('change', renderContent);
    document.getElementById('applicationFilter').addEventListener('change', renderApplications);
    document.getElementById('paymentFilter').addEventListener('change', renderApplications);
    document.getElementById('applicationSort').addEventListener('change', renderApplications);
    document.getElementById('applicationSearch').addEventListener('input', renderApplications);
    document.getElementById('syncBtn').addEventListener('click', loadEverything);
    document.getElementById('logoutBtn').addEventListener('click', async () => {
        await client.auth.signOut();
        window.location.href = 'index.html';
    });

    startAdmin();
})();