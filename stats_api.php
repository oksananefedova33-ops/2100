<?php
declare(strict_types=1);
header('Content-Type: application/json; charset=utf-8');

$dbPath = dirname(__DIR__) . '/data/zerro_blog.db';
$pdo = new PDO('sqlite:' . $dbPath, null, null, [
    PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
    PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
]);

// Ensure tables exist (mirrors stats_track.php)
$pdo->exec("CREATE TABLE IF NOT EXISTS stats_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ts INTEGER NOT NULL,
    token TEXT NOT NULL,
    domain TEXT NOT NULL,
    path TEXT DEFAULT '',
    type TEXT NOT NULL,
    link_url TEXT DEFAULT NULL,
    file_url TEXT DEFAULT NULL,
    file_name TEXT DEFAULT NULL,
    uid TEXT DEFAULT NULL,
    sid TEXT DEFAULT NULL,
    country TEXT DEFAULT NULL,
    device TEXT DEFAULT NULL,
    os TEXT DEFAULT NULL,
    browser TEXT DEFAULT NULL,
    ref_domain TEXT DEFAULT NULL,
    ref_url TEXT DEFAULT NULL,
    utm_source TEXT DEFAULT NULL,
    utm_medium TEXT DEFAULT NULL,
    utm_campaign TEXT DEFAULT NULL,
    utm_content TEXT DEFAULT NULL,
    utm_term TEXT DEFAULT NULL,
    ip_hash TEXT DEFAULT NULL
);
CREATE INDEX IF NOT EXISTS idx_stats_token_ts   ON stats_events(token, ts);
CREATE INDEX IF NOT EXISTS idx_stats_domain_ts  ON stats_events(domain, ts);
CREATE INDEX IF NOT EXISTS idx_stats_type_ts    ON stats_events(type, ts);
CREATE INDEX IF NOT EXISTS idx_stats_uid_ts     ON stats_events(uid, ts);
");

$action = $_REQUEST['action'] ?? 'overview';

// Date range
$from = isset($_GET['from']) ? strtotime($_GET['from'] . ' 00:00:00') : (time() - 30*24*3600);
$to   = isset($_GET['to'])   ? strtotime($_GET['to'] . ' 23:59:59') : time();

// Domains filter (optional)
$domains = [];
if (!empty($_GET['domains'])) {
    $domains = array_map('normalizeHost', explode(',', (string)$_GET['domains']));
}

switch ($action) {
    case 'overview':
        echo json_encode(['ok'=>true, 'data'=>overview($pdo, $from, $to, $domains)]);
        break;
    case 'events':
        echo json_encode(['ok'=>true, 'data'=>events($pdo, $from, $to, $domains)]);
        break;
    default:
        echo json_encode(['ok'=>false, 'error'=>'unknown action']);
}

function overview(PDO $pdo, int $from, int $to, array $domains): array {
    $where = "ts BETWEEN :from AND :to";
    $params = ['from'=>$from, 'to'=>$to];
    if ($domains) {
        $in = implode(',', array_fill(0, count($domains), '?'));
        $where .= " AND domain IN ($in)";
        $params = array_merge([$from, $to], $domains);
    }

    // Unique visitors per domain (by uid; fallback to ip_hash when uid is null)
    $sql = "SELECT domain,
                   COUNT(DISTINCT COALESCE(NULLIF(uid,''), ip_hash)) AS unique_visitors,
                   COUNT(*) AS pageviews,
                   SUM(CASE WHEN type='link' THEN 1 ELSE 0 END) AS link_clicks,
                   SUM(CASE WHEN type='download' THEN 1 ELSE 0 END) AS file_downloads
            FROM stats_events
            WHERE $where
            GROUP BY domain
            ORDER BY unique_visitors DESC";
    $st = $pdo->prepare($sql);
    $st->execute($params);
    $rows = $st->fetchAll();

    // Countries with more details
    $sqlC = "SELECT domain, country, COUNT(DISTINCT COALESCE(NULLIF(uid,''), ip_hash)) cnt 
             FROM stats_events 
             WHERE $where AND country IS NOT NULL 
             GROUP BY domain, country
             ORDER BY cnt DESC";
    $stc = $pdo->prepare($sqlC);
    $stc->execute($params);
    $countries = [];
    while ($r = $stc->fetch()) {
        $d = $r['domain'] ?: 'unknown';
        $countries[$d][] = ['country'=>$r['country'], 'count'=>(int)$r['cnt']];
    }

    // Devices
    $sqlD = "SELECT domain, device, COUNT(DISTINCT COALESCE(NULLIF(uid,''), ip_hash)) cnt 
             FROM stats_events 
             WHERE $where AND device IS NOT NULL 
             GROUP BY domain, device";
    $std = $pdo->prepare($sqlD);
    $std->execute($params);
    $devices = [];
    while ($r = $std->fetch()) {
        $d = $r['domain'] ?: 'unknown';
        if (!isset($devices[$d])) $devices[$d] = [];
        $devices[$d][$r['device']] = (int)$r['cnt'];
    }

    // Referrers
    $sqlR = "SELECT domain, COALESCE(ref_domain,'direct') AS src, COUNT(DISTINCT COALESCE(NULLIF(uid,''), ip_hash)) cnt 
             FROM stats_events 
             WHERE $where 
             GROUP BY domain, src
             ORDER BY cnt DESC";
    $str = $pdo->prepare($sqlR);
    $str->execute($params);
    $refs = [];
    while ($r = $str->fetch()) {
        $d = $r['domain'] ?: 'unknown';
        $refs[$d][] = ['source'=>$r['src'], 'count'=>(int)$r['cnt']];
    }

    // Build final array
    $byDomain = [];
    foreach ($rows as $r) {
        $d = $r['domain'] ?: 'unknown';
        $byDomain[] = [
            'domain'          => $d,
            'unique_visitors' => (int)$r['unique_visitors'],
            'pageviews'       => (int)$r['pageviews'],
            'link_clicks'     => (int)$r['link_clicks'],
            'file_downloads'  => (int)$r['file_downloads'],
            'countries'       => topN($countries[$d] ?? [], 10, 'count'),
            'devices'         => $devices[$d] ?? [],
            'sources'         => topN($refs[$d] ?? [], 10, 'count'),
        ];
    }

    // Include domains with only ref/country/device but no main row
    $extraDomains = array_unique(array_merge(array_keys($countries), array_keys($devices), array_keys($refs)));
    foreach ($extraDomains as $d) {
        if (!array_filter($byDomain, fn($x)=>$x['domain']===$d)) {
            $byDomain[] = [
                'domain'=>$d, 'unique_visitors'=>0, 'pageviews'=>0, 'link_clicks'=>0, 'file_downloads'=>0,
                'countries'=>topN($countries[$d] ?? [], 10, 'count'),
                'devices'=>$devices[$d] ?? [],
                'sources'=>topN($refs[$d] ?? [], 10, 'count'),
            ];
        }
    }

    // Sort by unique_visitors desc
    usort($byDomain, fn($a,$b)=>$b['unique_visitors']<=>$a['unique_visitors']);
    return ['from'=>$from, 'to'=>$to, 'domains'=>$byDomain];
}

function events(PDO $pdo, int $from, int $to, array $domains): array {
    $where = "ts BETWEEN ? AND ?";
    $params = [$from, $to];
    if ($domains) {
        $in = implode(',', array_fill(0, count($domains), '?'));
        $where .= " AND domain IN ($in)";
        $params = array_merge($params, $domains);
    }
    $sql = "SELECT ts, domain, type, path, link_url, file_url, file_name, country, device, os, browser, ref_domain, ref_url
            FROM stats_events
            WHERE $where
            ORDER BY ts DESC
            LIMIT 1000";
    $st = $pdo->prepare($sql);
    $st->execute($params);
    $out = [];
    while ($r = $st->fetch()) {
        $out[] = $r;
    }
    return $out;
}

function normalizeHost(string $h): string {
    $h = strtolower(trim($h));
    $h = preg_replace('/^www\./', '', $h);
    return preg_replace('/[^a-z0-9\.\-\:]/', '', $h);
}

function topN(array $arr, int $n, string $key): array {
    usort($arr, fn($a,$b)=>($b[$key]??0)<=>($a[$key]??0));
    return array_slice($arr, 0, $n);
}
