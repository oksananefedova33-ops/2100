<?php
declare(strict_types=1);
header('Content-Type: application/json; charset=utf-8');

$dbPath = dirname(__DIR__, 2) . '/data/zerro_blog.db';
$pdo = new PDO('sqlite:' . $dbPath, null, null, [
    PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
    PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
]);

$action = $_REQUEST['action'] ?? '';

// Список доменов
if ($action === 'domains') {
    $stmt = $pdo->query("SELECT DISTINCT domain FROM form_submissions ORDER BY domain");
    $domains = [];
    while ($row = $stmt->fetch()) {
        if ($row['domain']) $domains[] = $row['domain'];
    }
    echo json_encode(['ok' => true, 'domains' => $domains]);
    exit;
}

// Список отправок
if ($action === 'list') {
    $from = isset($_GET['from']) ? strtotime($_GET['from'] . ' 00:00:00') : (time() - 30*24*3600);
    $to = isset($_GET['to']) ? strtotime($_GET['to'] . ' 23:59:59') : time();
    $domain = $_GET['domain'] ?? '';

    $where = "ts BETWEEN :from AND :to";
    $params = ['from' => $from, 'to' => $to];

    if ($domain) {
        $where .= " AND domain = :domain";
        $params['domain'] = $domain;
    }

    // Статистика
    $statsSql = "SELECT 
        COUNT(*) as total,
        COUNT(DISTINCT domain) as domains,
        COUNT(DISTINCT form_title) as forms
        FROM form_submissions WHERE $where";
    $statsStmt = $pdo->prepare($statsSql);
    $statsStmt->execute($params);
    $stats = $statsStmt->fetch();

    // Отправки
    $sql = "SELECT * FROM form_submissions WHERE $where ORDER BY ts DESC LIMIT 1000";
    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    $submissions = $stmt->fetchAll();

    echo json_encode([
        'ok' => true,
        'stats' => $stats,
        'submissions' => $submissions
    ]);
    exit;
}

// Получить одну отправку
if ($action === 'get') {
    $id = (int)($_GET['id'] ?? 0);
    $stmt = $pdo->prepare("SELECT * FROM form_submissions WHERE id = ?");
    $stmt->execute([$id]);
    $sub = $stmt->fetch();

    if (!$sub) {
        echo json_encode(['ok' => false, 'error' => 'Not found']);
        exit;
    }

    echo json_encode(['ok' => true, 'submission' => $sub]);
    exit;
}

// Скачать одну отправку как .txt
if ($action === 'download') {
    $id = (int)($_GET['id'] ?? 0);
    $stmt = $pdo->prepare("SELECT * FROM form_submissions WHERE id = ?");
    $stmt->execute([$id]);
    $sub = $stmt->fetch();

    if (!$sub) {
        header('HTTP/1.1 404 Not Found');
        echo 'Not found';
        exit;
    }

    header('Content-Type: text/plain; charset=utf-8');
    header('Content-Disposition: attachment; filename="form_' . $id . '_' . date('Y-m-d') . '.txt"');

    echo "Отправка формы #" . $id . "\n";
    echo str_repeat("=", 50) . "\n\n";
    echo "Дата/Время: " . date('d.m.Y H:i:s', $sub['ts']) . "\n";
    echo "Домен: " . $sub['domain'] . "\n";
    echo "Форма: " . $sub['form_title'] . "\n";
    echo "Страница: " . $sub['url'] . "\n";
    echo "Реферер: " . ($sub['referrer'] ?: 'Прямой заход') . "\n\n";

    echo str_repeat("=", 50) . "\n";
    echo "ПОСЕТИТЕЛЬ\n";
    echo str_repeat("=", 50) . "\n";
    echo "IP: " . $sub['ip'] . "\n";
    echo "Страна: " . $sub['country'] . "\n";
    echo "Город: " . $sub['city'] . "\n";
    echo "Устройство: " . $sub['device'] . "\n";
    echo "ОС: " . $sub['os'] . "\n";
    echo "Браузер: " . $sub['browser'] . "\n\n";

    echo str_repeat("=", 50) . "\n";
    echo "ДАННЫЕ ФОРМЫ\n";
    echo str_repeat("=", 50) . "\n\n";

    $fields = json_decode($sub['fields_json'] ?? '{}', true);
    if ($fields && is_array($fields)) {
        foreach ($fields as $name => $value) {
            if (is_array($value)) {
                $value = implode(', ', $value);
            }
            echo $name . ":\n";
            echo "  " . $value . "\n\n";
        }
    } else {
        echo "Нет данных\n";
    }

    exit;
}

// Экспорт всех отправок за период
if ($action === 'export') {
    $from = isset($_GET['from']) ? strtotime($_GET['from'] . ' 00:00:00') : (time() - 30*24*3600);
    $to = isset($_GET['to']) ? strtotime($_GET['to'] . ' 23:59:59') : time();
    $domain = $_GET['domain'] ?? '';

    $where = "ts BETWEEN :from AND :to";
    $params = ['from' => $from, 'to' => $to];

    if ($domain) {
        $where .= " AND domain = :domain";
        $params['domain'] = $domain;
    }

    $sql = "SELECT * FROM form_submissions WHERE $where ORDER BY ts DESC";
    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    $submissions = $stmt->fetchAll();

    header('Content-Type: text/plain; charset=utf-8');
    header('Content-Disposition: attachment; filename="forms_export_' . date('Y-m-d') . '.txt"');

    echo "ЭКСПОРТ ОТПРАВОК ФОРМ\n";
    echo "Период: " . date('d.m.Y', $from) . " - " . date('d.m.Y', $to) . "\n";
    echo "Всего отправок: " . count($submissions) . "\n";
    echo str_repeat("=", 80) . "\n\n";

    foreach ($submissions as $sub) {
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n";
        echo "Отправка #" . $sub['id'] . "\n";
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n";
        
        echo "Дата/Время: " . date('d.m.Y H:i:s', $sub['ts']) . "\n";
        echo "Домен: " . $sub['domain'] . "\n";
        echo "Форма: " . $sub['form_title'] . "\n";
        echo "Страница: " . $sub['url'] . "\n";
        echo "Реферер: " . ($sub['referrer'] ?: 'Прямой заход') . "\n\n";

        echo "ПОСЕТИТЕЛЬ:\n";
        echo "  IP: " . $sub['ip'] . "\n";
        echo "  Страна: " . $sub['country'] . " / Город: " . $sub['city'] . "\n";
        echo "  Устройство: " . $sub['device'] . "\n";
        echo "  ОС: " . $sub['os'] . " / Браузер: " . $sub['browser'] . "\n\n";

        echo "ДАННЫЕ ФОРМЫ:\n";
        $fields = json_decode($sub['fields_json'] ?? '{}', true);
        if ($fields && is_array($fields)) {
            foreach ($fields as $name => $value) {
                if (is_array($value)) {
                    $value = implode(', ', $value);
                }
                echo "  " . $name . ": " . $value . "\n";
            }
        } else {
            echo "  Нет данных\n";
        }
        echo "\n\n";
    }

    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n";
    echo "Конец экспорта\n";
    exit;
}

// Удалить одну отправку
if ($action === 'delete' && $_SERVER['REQUEST_METHOD'] === 'POST') {
    $id = (int)($_POST['id'] ?? 0);
    $stmt = $pdo->prepare("DELETE FROM form_submissions WHERE id = ?");
    $stmt->execute([$id]);
    echo json_encode(['ok' => true]);
    exit;
}

// Удалить все за период
if ($action === 'deleteAll' && $_SERVER['REQUEST_METHOD'] === 'POST') {
    $from = isset($_POST['from']) ? strtotime($_POST['from'] . ' 00:00:00') : 0;
    $to = isset($_POST['to']) ? strtotime($_POST['to'] . ' 23:59:59') : time();

    $stmt = $pdo->prepare("DELETE FROM form_submissions WHERE ts BETWEEN ? AND ?");
    $stmt->execute([$from, $to]);
    $deleted = $stmt->rowCount();

    echo json_encode(['ok' => true, 'deleted' => $deleted]);
    exit;
}

echo json_encode(['ok' => false, 'error' => 'Unknown action']);