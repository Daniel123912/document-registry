<?php
/**
 * Plugin Name: Bakor Docflow MVP
 * Description: Frontend-first document flow MVP: documents, versions, acknowledgements.
 * Version: 0.2.0
 * Author: Bakor
 */

if (!defined('ABSPATH')) {
    exit;
}

final class Bakor_Docflow_MVP {
    private const VERSION = '0.2.0';
    private const CPT = 'bakor_document';
    private const VERSION_TABLE = 'bakor_document_versions';
    private const ACK_TABLE = 'bakor_document_acks';

    public function __construct() {
        add_action('init', [$this, 'register_post_type']);

        add_action('admin_post_bakor_create_document', [$this, 'handle_create_document']);
        add_action('admin_post_bakor_publish_document', [$this, 'handle_publish_document']);
        add_action('admin_post_bakor_create_version', [$this, 'handle_create_version']);
        add_action('admin_post_bakor_ack_document', [$this, 'handle_acknowledgement']);

        add_shortcode('bakor_docflow_app', [$this, 'render_app_shortcode']);
    }

    public static function activate(): void {
        self::create_tables();
        self::create_roles();
        flush_rewrite_rules();
    }

    public static function deactivate(): void {
        flush_rewrite_rules();
    }

    public function register_post_type(): void {
        register_post_type(self::CPT, [
            'label' => 'Documents',
            'public' => false,
            'show_ui' => false,
            'show_in_menu' => false,
            'supports' => ['title', 'editor', 'author'],
            'has_archive' => false,
            'show_in_rest' => false,
            'capability_type' => ['bakor_document', 'bakor_documents'],
            'map_meta_cap' => true,
        ]);
    }

    public function render_app_shortcode(): string {
        if (!is_user_logged_in()) {
            return '<div class="bakor-wrap"><div class="bakor-alert">Войдите в систему, чтобы открыть приложение.</div></div>';
        }

        wp_enqueue_style(
            'bakor-docflow-app',
            plugin_dir_url(__FILE__) . 'assets/app.css',
            [],
            self::VERSION
        );

        wp_enqueue_script(
            'bakor-docflow-app',
            plugin_dir_url(__FILE__) . 'assets/app.js',
            [],
            self::VERSION,
            true
        );

        $current_user_id = get_current_user_id();
        $is_responsible = $this->can_manage_documents();

        $all_documents = get_posts([
            'post_type' => self::CPT,
            'post_status' => ['draft', 'publish'],
            'numberposts' => 200,
            'orderby' => 'date',
            'order' => 'DESC',
            'author' => $is_responsible && current_user_can('manage_options') ? 0 : $current_user_id,
        ]);

        $assigned_documents = $this->get_assigned_documents($current_user_id);

        $msg = isset($_GET['bakor_msg']) ? sanitize_text_field(wp_unslash($_GET['bakor_msg'])) : '';
        $notice = $this->message_by_code($msg);

        $stats = [
            'my_docs' => count($all_documents),
            'assigned' => count($assigned_documents),
            'pending' => $this->count_pending_for_user($assigned_documents, $current_user_id),
        ];

        ob_start();
        ?>
        <div class="bakor-wrap">
            <div class="bakor-bg-shape bakor-bg-shape-a"></div>
            <div class="bakor-bg-shape bakor-bg-shape-b"></div>

            <div class="bakor-header">
                <div>
                    <h1>Реестр документов</h1>
                    <p>Единое место для публикации документов, версий и подтверждения ознакомления.</p>
                </div>
                <div class="bakor-user-pill">
                    <?php echo esc_html(wp_get_current_user()->display_name); ?>
                </div>
            </div>

            <?php if ($notice !== ''): ?>
                <div class="bakor-alert"><?php echo esc_html($notice); ?></div>
            <?php endif; ?>

            <div class="bakor-stats">
                <div class="bakor-card">
                    <span class="bakor-stat-label">Мои документы</span>
                    <strong><?php echo (int) $stats['my_docs']; ?></strong>
                </div>
                <div class="bakor-card">
                    <span class="bakor-stat-label">Назначено мне</span>
                    <strong><?php echo (int) $stats['assigned']; ?></strong>
                </div>
                <div class="bakor-card">
                    <span class="bakor-stat-label">Ждут ознакомления</span>
                    <strong><?php echo (int) $stats['pending']; ?></strong>
                </div>
            </div>

            <div class="bakor-tabs" data-bakor-tabs>
                <?php if ($is_responsible): ?>
                    <button class="is-active" data-tab="create">Создать документ</button>
                    <button data-tab="manage">Управление документами</button>
                    <button data-tab="report">Отчет</button>
                <?php endif; ?>
                <button <?php echo $is_responsible ? '' : 'class="is-active"'; ?> data-tab="inbox">Мое ознакомление</button>
            </div>

            <?php if ($is_responsible): ?>
                <section class="bakor-panel is-active" data-panel="create">
                    <?php echo $this->render_create_document_form(); ?>
                </section>

                <section class="bakor-panel" data-panel="manage">
                    <?php echo $this->render_manage_documents_panel($all_documents); ?>
                </section>

                <section class="bakor-panel" data-panel="report">
                    <?php echo $this->render_report_panel($all_documents); ?>
                </section>
            <?php endif; ?>

            <section class="bakor-panel <?php echo !$is_responsible ? 'is-active' : ''; ?>" data-panel="inbox">
                <?php echo $this->render_user_inbox_panel($assigned_documents, $current_user_id); ?>
            </section>
        </div>
        <?php

        return (string) ob_get_clean();
    }

    private function render_create_document_form(): string {
        $users = get_users([
            'fields' => ['ID', 'display_name', 'user_email'],
            'orderby' => 'display_name',
            'order' => 'ASC',
        ]);

        ob_start();
        ?>
        <div class="bakor-panel-head">
            <h2>Новый документ</h2>
            <p>Документ создается в черновике. Публикация выполняется отдельно.</p>
        </div>

        <form class="bakor-form-grid" method="post" action="<?php echo esc_url(admin_url('admin-post.php')); ?>" enctype="multipart/form-data">
            <input type="hidden" name="action" value="bakor_create_document" />
            <?php wp_nonce_field('bakor_create_document', 'bakor_create_nonce'); ?>

            <label>
                Название
                <input type="text" name="doc_title" required />
            </label>

            <label>
                Тип
                <select name="doc_type" required>
                    <option value="order">Приказ</option>
                    <option value="regulation">Регламент</option>
                    <option value="instruction">Инструкция</option>
                    <option value="new_goods">Новые товары</option>
                    <option value="other">Другое</option>
                </select>
            </label>

            <label>
                Номер
                <input type="text" name="doc_number" />
            </label>

            <label>
                Дата документа
                <input type="date" name="doc_date" required />
            </label>

            <label>
                Срок ознакомления
                <input type="date" name="due_date" required />
            </label>

            <label>
                Файл
                <input type="file" name="doc_file" accept=".pdf,.doc,.docx" required />
            </label>

            <label class="bakor-span-2">
                Краткое описание
                <textarea name="doc_content" rows="4" placeholder="Что изменилось и что нужно знать сотрудникам"></textarea>
            </label>

            <fieldset class="bakor-span-2">
                <legend>Назначить ознакомление</legend>
                <div class="bakor-users-grid">
                    <?php foreach ($users as $user): ?>
                        <label class="bakor-user-check">
                            <input type="checkbox" name="assigned_users[]" value="<?php echo (int) $user->ID; ?>" />
                            <span><?php echo esc_html($user->display_name); ?> <small><?php echo esc_html($user->user_email); ?></small></span>
                        </label>
                    <?php endforeach; ?>
                </div>
            </fieldset>

            <div class="bakor-span-2">
                <button type="submit" class="bakor-btn bakor-btn-primary">Сохранить черновик</button>
            </div>
        </form>
        <?php

        return (string) ob_get_clean();
    }

    private function render_manage_documents_panel(array $documents): string {
        if (empty($documents)) {
            return '<div class="bakor-empty">Пока нет документов.</div>';
        }

        ob_start();
        ?>
        <div class="bakor-panel-head">
            <h2>Управление документами</h2>
            <p>Публикуйте черновики и создавайте новые версии у опубликованных документов.</p>
        </div>

        <div class="bakor-table-wrap">
            <table class="bakor-table">
                <thead>
                    <tr>
                        <th>Документ</th>
                        <th>Статус</th>
                        <th>Версия</th>
                        <th>Срок</th>
                        <th>Действия</th>
                    </tr>
                </thead>
                <tbody>
                    <?php foreach ($documents as $document): ?>
                        <?php
                        $status = $document->post_status === 'publish' ? 'Опубликован' : 'Черновик';
                        $status_class = $document->post_status === 'publish' ? 'ok' : 'warn';
                        $active_version = (int) get_post_meta($document->ID, '_bakor_active_version', true);
                        $due_date = (string) get_post_meta($document->ID, '_bakor_due_date', true);
                        ?>
                        <tr>
                            <td>
                                <strong><?php echo esc_html($document->post_title); ?></strong>
                            </td>
                            <td><span class="bakor-status <?php echo esc_attr($status_class); ?>"><?php echo esc_html($status); ?></span></td>
                            <td><?php echo (int) $active_version; ?></td>
                            <td><?php echo esc_html($due_date !== '' ? $due_date : '-'); ?></td>
                            <td>
                                <?php if ($document->post_status !== 'publish'): ?>
                                    <form method="post" action="<?php echo esc_url(admin_url('admin-post.php')); ?>" class="bakor-inline-form">
                                        <input type="hidden" name="action" value="bakor_publish_document" />
                                        <input type="hidden" name="document_id" value="<?php echo (int) $document->ID; ?>" />
                                        <?php wp_nonce_field('bakor_publish_document_' . $document->ID, 'bakor_publish_nonce'); ?>
                                        <button type="submit" class="bakor-btn">Опубликовать</button>
                                    </form>
                                <?php else: ?>
                                    <form method="post" action="<?php echo esc_url(admin_url('admin-post.php')); ?>" class="bakor-inline-form" enctype="multipart/form-data">
                                        <input type="hidden" name="action" value="bakor_create_version" />
                                        <input type="hidden" name="document_id" value="<?php echo (int) $document->ID; ?>" />
                                        <?php wp_nonce_field('bakor_create_version_' . $document->ID, 'bakor_version_nonce'); ?>
                                        <input type="text" name="change_reason" placeholder="Причина изменения" required />
                                        <input type="file" name="version_file" accept=".pdf,.doc,.docx" required />
                                        <button type="submit" class="bakor-btn">Новая версия</button>
                                    </form>
                                <?php endif; ?>
                            </td>
                        </tr>
                    <?php endforeach; ?>
                </tbody>
            </table>
        </div>
        <?php

        return (string) ob_get_clean();
    }

    private function render_report_panel(array $documents): string {
        if (empty($documents)) {
            return '<div class="bakor-empty">Нет данных для отчета.</div>';
        }

        ob_start();
        ?>
        <div class="bakor-panel-head">
            <h2>Отчет по ознакомлению</h2>
            <p>Показывается только активная версия каждого документа.</p>
        </div>

        <div class="bakor-table-wrap">
            <table class="bakor-table">
                <thead>
                    <tr>
                        <th>Документ</th>
                        <th>Версия</th>
                        <th>Назначено</th>
                        <th>Ознакомились</th>
                        <th>Ожидают</th>
                    </tr>
                </thead>
                <tbody>
                <?php foreach ($documents as $document): ?>
                    <?php
                    $active_version = (int) get_post_meta($document->ID, '_bakor_active_version', true);
                    $assigned_users = get_post_meta($document->ID, '_bakor_assigned_users', true);
                    $assigned_users = is_array($assigned_users) ? array_map('intval', $assigned_users) : [];

                    $assigned_count = count($assigned_users);
                    $ack_count = $this->count_acknowledgements($document->ID, $active_version);
                    $pending_count = max($assigned_count - $ack_count, 0);
                    ?>
                    <tr>
                        <td><?php echo esc_html($document->post_title); ?></td>
                        <td><?php echo (int) $active_version; ?></td>
                        <td><?php echo (int) $assigned_count; ?></td>
                        <td><?php echo (int) $ack_count; ?></td>
                        <td><?php echo (int) $pending_count; ?></td>
                    </tr>
                <?php endforeach; ?>
                </tbody>
            </table>
        </div>
        <?php

        return (string) ob_get_clean();
    }

    private function render_user_inbox_panel(array $documents, int $current_user_id): string {
        if (empty($documents)) {
            return '<div class="bakor-empty">Сейчас нет назначенных документов.</div>';
        }

        ob_start();
        ?>
        <div class="bakor-panel-head">
            <h2>Мои документы на ознакомление</h2>
            <p>Ознакомление фиксируется отдельно для каждой версии.</p>
        </div>

        <div class="bakor-table-wrap">
            <table class="bakor-table">
                <thead>
                    <tr>
                        <th>Документ</th>
                        <th>Версия</th>
                        <th>Срок</th>
                        <th>Статус</th>
                        <th></th>
                    </tr>
                </thead>
                <tbody>
                <?php foreach ($documents as $document): ?>
                    <?php
                    $active_version = (int) get_post_meta($document->ID, '_bakor_active_version', true);
                    $due_date = (string) get_post_meta($document->ID, '_bakor_due_date', true);
                    $attachment_id = (int) get_post_meta($document->ID, '_bakor_attachment_id', true);
                    $attachment_url = $attachment_id > 0 ? wp_get_attachment_url($attachment_id) : '';
                    $acked = $this->is_acknowledged($document->ID, $active_version, $current_user_id);
                    ?>
                    <tr>
                        <td>
                            <?php if ($attachment_url): ?>
                                <a href="<?php echo esc_url($attachment_url); ?>" target="_blank" rel="noopener noreferrer"><?php echo esc_html($document->post_title); ?></a>
                            <?php else: ?>
                                <?php echo esc_html($document->post_title); ?>
                            <?php endif; ?>
                        </td>
                        <td><?php echo (int) $active_version; ?></td>
                        <td><?php echo esc_html($due_date !== '' ? $due_date : '-'); ?></td>
                        <td>
                            <?php if ($acked): ?>
                                <span class="bakor-status ok">Ознакомлен</span>
                            <?php else: ?>
                                <span class="bakor-status warn">Ожидается</span>
                            <?php endif; ?>
                        </td>
                        <td>
                            <?php if (!$acked): ?>
                                <form method="post" action="<?php echo esc_url(admin_url('admin-post.php')); ?>" class="bakor-inline-form">
                                    <input type="hidden" name="action" value="bakor_ack_document" />
                                    <input type="hidden" name="document_id" value="<?php echo (int) $document->ID; ?>" />
                                    <input type="hidden" name="version_no" value="<?php echo (int) $active_version; ?>" />
                                    <?php wp_nonce_field('bakor_ack_document_' . $document->ID . '_' . $active_version, 'bakor_ack_nonce'); ?>
                                    <button type="submit" class="bakor-btn bakor-btn-primary">Ознакомлен</button>
                                </form>
                            <?php endif; ?>
                        </td>
                    </tr>
                <?php endforeach; ?>
                </tbody>
            </table>
        </div>
        <?php

        return (string) ob_get_clean();
    }

    public function handle_create_document(): void {
        if (!$this->can_manage_documents()) {
            wp_die('Недостаточно прав.');
        }

        $nonce = isset($_POST['bakor_create_nonce']) ? sanitize_text_field(wp_unslash($_POST['bakor_create_nonce'])) : '';
        if (!wp_verify_nonce($nonce, 'bakor_create_document')) {
            wp_die('Некорректный запрос.');
        }

        $title = isset($_POST['doc_title']) ? sanitize_text_field(wp_unslash($_POST['doc_title'])) : '';
        $content = isset($_POST['doc_content']) ? wp_kses_post(wp_unslash($_POST['doc_content'])) : '';

        if ($title === '') {
            $this->redirect_with_msg('error_title');
        }

        $post_id = wp_insert_post([
            'post_type' => self::CPT,
            'post_title' => $title,
            'post_content' => $content,
            'post_status' => 'draft',
            'post_author' => get_current_user_id(),
        ], true);

        if (is_wp_error($post_id)) {
            $this->redirect_with_msg('error_create');
        }

        $attachment_id = $this->upload_document_file('doc_file', $post_id);

        $this->save_document_fields($post_id, $attachment_id);

        $this->redirect_with_msg('created');
    }

    public function handle_publish_document(): void {
        if (!$this->can_manage_documents()) {
            wp_die('Недостаточно прав.');
        }

        $document_id = isset($_POST['document_id']) ? (int) $_POST['document_id'] : 0;
        $nonce = isset($_POST['bakor_publish_nonce']) ? sanitize_text_field(wp_unslash($_POST['bakor_publish_nonce'])) : '';

        if (!wp_verify_nonce($nonce, 'bakor_publish_document_' . $document_id)) {
            wp_die('Некорректный запрос.');
        }

        if (!$this->can_edit_document($document_id)) {
            wp_die('Нет доступа к документу.');
        }

        wp_update_post([
            'ID' => $document_id,
            'post_status' => 'publish',
        ]);

        $attachment_id = (int) get_post_meta($document_id, '_bakor_attachment_id', true);
        $this->ensure_version($document_id, $attachment_id, 'Первичная публикация');

        $this->redirect_with_msg('published');
    }

    public function handle_create_version(): void {
        if (!$this->can_manage_documents()) {
            wp_die('Недостаточно прав.');
        }

        $document_id = isset($_POST['document_id']) ? (int) $_POST['document_id'] : 0;
        $nonce = isset($_POST['bakor_version_nonce']) ? sanitize_text_field(wp_unslash($_POST['bakor_version_nonce'])) : '';

        if (!wp_verify_nonce($nonce, 'bakor_create_version_' . $document_id)) {
            wp_die('Некорректный запрос.');
        }

        if (!$this->can_edit_document($document_id)) {
            wp_die('Нет доступа к документу.');
        }

        $reason = isset($_POST['change_reason']) ? sanitize_text_field(wp_unslash($_POST['change_reason'])) : '';
        if ($reason === '') {
            $this->redirect_with_msg('error_reason');
        }

        $attachment_id = $this->upload_document_file('version_file', $document_id);
        if ($attachment_id <= 0) {
            $this->redirect_with_msg('error_file');
        }

        update_post_meta($document_id, '_bakor_attachment_id', $attachment_id);

        $this->ensure_version($document_id, $attachment_id, $reason);

        $this->redirect_with_msg('version_created');
    }

    public function handle_acknowledgement(): void {
        if (!is_user_logged_in()) {
            wp_die('Требуется авторизация.');
        }

        $document_id = isset($_POST['document_id']) ? (int) $_POST['document_id'] : 0;
        $version_no = isset($_POST['version_no']) ? (int) $_POST['version_no'] : 0;

        $nonce = isset($_POST['bakor_ack_nonce']) ? sanitize_text_field(wp_unslash($_POST['bakor_ack_nonce'])) : '';
        if (!wp_verify_nonce($nonce, 'bakor_ack_document_' . $document_id . '_' . $version_no)) {
            wp_die('Некорректный запрос.');
        }

        if ($document_id <= 0 || $version_no <= 0) {
            wp_die('Некорректные параметры.');
        }

        $assigned_users = get_post_meta($document_id, '_bakor_assigned_users', true);
        $assigned_users = is_array($assigned_users) ? array_map('intval', $assigned_users) : [];
        $current_user_id = get_current_user_id();

        if (!in_array($current_user_id, $assigned_users, true)) {
            wp_die('Документ не назначен вам.');
        }

        global $wpdb;
        $table = $wpdb->prefix . self::ACK_TABLE;

        $wpdb->query(
            $wpdb->prepare(
                "INSERT INTO {$table} (document_id, version_no, user_id, acknowledged_at)
                 VALUES (%d, %d, %d, %s)
                 ON DUPLICATE KEY UPDATE acknowledged_at = VALUES(acknowledged_at)",
                $document_id,
                $version_no,
                $current_user_id,
                current_time('mysql', true)
            )
        );

        $this->redirect_with_msg('acknowledged');
    }

    private function save_document_fields(int $post_id, int $attachment_id): void {
        $document_type = isset($_POST['doc_type']) ? sanitize_key(wp_unslash($_POST['doc_type'])) : 'other';
        $document_number = isset($_POST['doc_number']) ? sanitize_text_field(wp_unslash($_POST['doc_number'])) : '';
        $document_date = isset($_POST['doc_date']) ? sanitize_text_field(wp_unslash($_POST['doc_date'])) : '';
        $due_date = isset($_POST['due_date']) ? sanitize_text_field(wp_unslash($_POST['due_date'])) : '';
        $assigned_users = isset($_POST['assigned_users']) ? array_map('intval', (array) $_POST['assigned_users']) : [];

        update_post_meta($post_id, '_bakor_document_type', $document_type);
        update_post_meta($post_id, '_bakor_document_number', $document_number);
        update_post_meta($post_id, '_bakor_document_date', $document_date);
        update_post_meta($post_id, '_bakor_due_date', $due_date);
        update_post_meta($post_id, '_bakor_attachment_id', $attachment_id);
        update_post_meta($post_id, '_bakor_assigned_users', $assigned_users);
    }

    private function upload_document_file(string $file_key, int $post_id): int {
        if (!isset($_FILES[$file_key]) || !isset($_FILES[$file_key]['size']) || (int) $_FILES[$file_key]['size'] <= 0) {
            return 0;
        }

        require_once ABSPATH . 'wp-admin/includes/file.php';
        require_once ABSPATH . 'wp-admin/includes/image.php';
        require_once ABSPATH . 'wp-admin/includes/media.php';

        $attachment_id = media_handle_upload($file_key, $post_id);

        if (is_wp_error($attachment_id)) {
            return 0;
        }

        return (int) $attachment_id;
    }

    private function ensure_version(int $document_id, int $attachment_id, string $change_reason): void {
        global $wpdb;

        $table = $wpdb->prefix . self::VERSION_TABLE;
        $latest_version = (int) $wpdb->get_var(
            $wpdb->prepare(
                "SELECT MAX(version_no) FROM {$table} WHERE document_id = %d",
                $document_id
            )
        );

        if ($latest_version > 0 && $change_reason === '') {
            return;
        }

        $new_version_no = $latest_version + 1;

        $wpdb->insert(
            $table,
            [
                'document_id' => $document_id,
                'version_no' => $new_version_no,
                'attachment_id' => $attachment_id,
                'change_reason' => $change_reason,
                'created_by' => get_current_user_id(),
                'created_at' => current_time('mysql', true),
            ],
            ['%d', '%d', '%d', '%s', '%d', '%s']
        );

        update_post_meta($document_id, '_bakor_active_version', $new_version_no);
    }

    private function get_assigned_documents(int $user_id): array {
        return get_posts([
            'post_type' => self::CPT,
            'post_status' => 'publish',
            'numberposts' => 200,
            'orderby' => 'date',
            'order' => 'DESC',
            'meta_query' => [
                [
                    'key' => '_bakor_assigned_users',
                    'value' => '"' . $user_id . '"',
                    'compare' => 'LIKE',
                ],
            ],
        ]);
    }

    private function count_pending_for_user(array $documents, int $user_id): int {
        $pending = 0;
        foreach ($documents as $document) {
            $active_version = (int) get_post_meta($document->ID, '_bakor_active_version', true);
            if (!$this->is_acknowledged((int) $document->ID, $active_version, $user_id)) {
                $pending++;
            }
        }

        return $pending;
    }

    private function can_manage_documents(): bool {
        return current_user_can('publish_bakor_documents') || current_user_can('manage_options');
    }

    private function can_edit_document(int $document_id): bool {
        return current_user_can('edit_post', $document_id) || current_user_can('manage_options');
    }

    private function redirect_with_msg(string $code): void {
        $referer = wp_get_referer();
        $url = $referer ? $referer : home_url('/');
        $url = add_query_arg('bakor_msg', $code, $url);
        wp_safe_redirect($url);
        exit;
    }

    private function message_by_code(string $code): string {
        $map = [
            'created' => 'Документ сохранен как черновик.',
            'published' => 'Документ опубликован.',
            'version_created' => 'Новая версия создана и активирована.',
            'acknowledged' => 'Ознакомление зафиксировано.',
            'error_title' => 'Укажите название документа.',
            'error_file' => 'Не удалось загрузить файл.',
            'error_reason' => 'Укажите причину изменения версии.',
            'error_create' => 'Не удалось создать документ.',
        ];

        return $map[$code] ?? '';
    }

    private function count_acknowledgements(int $document_id, int $version_no): int {
        if ($version_no <= 0) {
            return 0;
        }

        global $wpdb;
        $table = $wpdb->prefix . self::ACK_TABLE;

        return (int) $wpdb->get_var(
            $wpdb->prepare(
                "SELECT COUNT(*) FROM {$table} WHERE document_id = %d AND version_no = %d",
                $document_id,
                $version_no
            )
        );
    }

    private function is_acknowledged(int $document_id, int $version_no, int $user_id): bool {
        if ($version_no <= 0 || $user_id <= 0) {
            return false;
        }

        global $wpdb;
        $table = $wpdb->prefix . self::ACK_TABLE;

        $exists = $wpdb->get_var(
            $wpdb->prepare(
                "SELECT id FROM {$table} WHERE document_id = %d AND version_no = %d AND user_id = %d",
                $document_id,
                $version_no,
                $user_id
            )
        );

        return !empty($exists);
    }

    private static function create_tables(): void {
        global $wpdb;

        require_once ABSPATH . 'wp-admin/includes/upgrade.php';

        $charset_collate = $wpdb->get_charset_collate();
        $versions_table = $wpdb->prefix . self::VERSION_TABLE;
        $acks_table = $wpdb->prefix . self::ACK_TABLE;

        $sql_versions = "CREATE TABLE {$versions_table} (
            id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
            document_id BIGINT UNSIGNED NOT NULL,
            version_no INT UNSIGNED NOT NULL,
            attachment_id BIGINT UNSIGNED DEFAULT 0,
            change_reason VARCHAR(255) NOT NULL,
            created_by BIGINT UNSIGNED NOT NULL,
            created_at DATETIME NOT NULL,
            PRIMARY KEY (id),
            UNIQUE KEY unique_document_version (document_id, version_no),
            KEY idx_document (document_id)
        ) {$charset_collate};";

        $sql_acks = "CREATE TABLE {$acks_table} (
            id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
            document_id BIGINT UNSIGNED NOT NULL,
            version_no INT UNSIGNED NOT NULL,
            user_id BIGINT UNSIGNED NOT NULL,
            acknowledged_at DATETIME NOT NULL,
            PRIMARY KEY (id),
            UNIQUE KEY unique_ack (document_id, version_no, user_id),
            KEY idx_user (user_id),
            KEY idx_document_version (document_id, version_no)
        ) {$charset_collate};";

        dbDelta($sql_versions);
        dbDelta($sql_acks);
    }

    private static function create_roles(): void {
        $responsible = get_role('bakor_responsible');
        if (!$responsible) {
            add_role('bakor_responsible', 'Bakor Responsible', ['read' => true]);
            $responsible = get_role('bakor_responsible');
        }

        if ($responsible) {
            $caps = [
                'read',
                'edit_bakor_document',
                'read_bakor_document',
                'delete_bakor_document',
                'edit_bakor_documents',
                'edit_others_bakor_documents',
                'publish_bakor_documents',
                'read_private_bakor_documents',
                'delete_bakor_documents',
                'delete_private_bakor_documents',
                'delete_published_bakor_documents',
                'delete_others_bakor_documents',
                'edit_private_bakor_documents',
                'edit_published_bakor_documents',
            ];

            foreach ($caps as $cap) {
                $responsible->add_cap($cap);
            }
        }

        $administrator = get_role('administrator');
        if ($administrator) {
            $admin_caps = [
                'edit_bakor_document',
                'read_bakor_document',
                'delete_bakor_document',
                'edit_bakor_documents',
                'edit_others_bakor_documents',
                'publish_bakor_documents',
                'read_private_bakor_documents',
                'delete_bakor_documents',
                'delete_private_bakor_documents',
                'delete_published_bakor_documents',
                'delete_others_bakor_documents',
                'edit_private_bakor_documents',
                'edit_published_bakor_documents',
            ];

            foreach ($admin_caps as $cap) {
                $administrator->add_cap($cap);
            }
        }
    }
}

register_activation_hook(__FILE__, ['Bakor_Docflow_MVP', 'activate']);
register_deactivation_hook(__FILE__, ['Bakor_Docflow_MVP', 'deactivate']);
new Bakor_Docflow_MVP();
