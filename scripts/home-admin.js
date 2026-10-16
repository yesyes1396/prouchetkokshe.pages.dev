(function () {
    const button = (label, action, type, section, id, direction) => {
        const control = document.createElement('button');
        control.type = 'button';
        control.textContent = label;
        control.dataset.action = action;
        control.dataset.type = type;
        control.dataset.section = section || '';
        if (id) control.dataset.id = id;
        if (direction) control.dataset.direction = direction;
        return control;
    };

    function addActions(target, type, section, id) {
        const actions = document.createElement('div');
        actions.className = 'admin-inline-actions';
        actions.setAttribute('aria-label', 'Действия администратора');
        actions.append(
            button('Изменить', 'edit', type, section, id),
            button('↑', 'move', type, section, id, '-1'),
            button('↓', 'move', type, section, id, '1'),
            button('Скрыть', 'publish', type, section, id),
            button('Удалить', 'delete', type, section, id)
        );
        target.append(actions);
    }

    function addSectionButton(grid, type, section, label) {
        if (!grid || !grid.parentElement) return;
        const actions = document.createElement('div');
        actions.className = 'admin-add-actions';
        actions.append(button(`+ Добавить: ${label}`, 'add', type, section));
        grid.parentElement.insertBefore(actions, grid);
    }

    function renderControls() {
        if (!document.body.classList.contains('admin-mode')) return;
        document.querySelectorAll('.admin-inline-actions, .admin-add-actions').forEach((node) => node.remove());

        document.querySelectorAll('[data-admin-type][data-admin-id]').forEach((marker) => {
            const target = marker.matches('.admin-content-marker') ? marker.parentElement : marker;
            if (!target) return;
            addActions(target, marker.dataset.adminType, marker.dataset.adminSection, marker.dataset.adminId);
        });

        addSectionButton(document.querySelector('.features-grid'), 'content_cards', 'benefits', 'преимущество');
        addSectionButton(document.querySelector('.faq-container'), 'content_cards', 'faq', 'вопрос');
        addSectionButton(document.querySelector('.courses-grid'), 'courses', '', 'курс');
    }

    window.addEventListener('prouchet:admin-data', renderControls);
    window.addEventListener('prouchet:content-rendered', renderControls);
    window.addEventListener('prouchet:admin-login', () => {
        document.body.classList.add('admin-mode');
        renderControls();
    });
})();
