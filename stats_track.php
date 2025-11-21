<?php
declare(strict_types=1);

/**
 * Lightweight cross‑domain analytics collector.
 * Accepts events from exported static sites and stores them in SQLite.
 * 
 * POST action: track
 *  - token      : string  (site/project token to group stats)
 *  - type       : visit|link|download
 *  - domain     : current site host (location.hostname)
 *  - url        : page URL
 *  - referrer   : document.referrer
 *  - uid        : per‑browser anonymous id (from localStorage)
 *  - sid        : per‑tab/session id (from sessionStorage)
 *  - user_agent : navigator.userAgent
 *  - page_title : document.title
 *  - link_url   : (for type=link)
 *  - file_url   : (for type=download)
 *  - file_name  : (for type=download)
 * 
 * GET action: getSettings — used by tracker to learn whether tracking is enabled.
 */

// --- CORS ---
$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
if ($origin) {
    header('Access-Control-Allow-Origin: ' . $origin);
    header('Vary: Origin');
} else {
    header('Access-Control-Allow-Origin: *');
}
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

// Preflight
if (($_SERVER['REQUEST_METHOD'] ?? '') === 'OPTIONS') {
    http_response_code(204);
    exit;
}

header('Content-Type: application/json; charset=utf-8');

// SQLite
$dbPath = __DIR__ . '/data/zerro_blog.db';
@mkdir(dirname($dbPath), 0775, true);
$pdo = new PDO('sqlite:' . $dbPath, null, null, [
    PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
    PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
]);

// Migrations
$pdo->exec("CREATE TABLE IF NOT EXISTS stats_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ts INTEGER NOT NULL,
    token TEXT NOT NULL,
    domain TEXT NOT NULL,
    path TEXT DEFAULT '',
    type TEXT NOT NULL,           -- visit|link|download
    link_url TEXT DEFAULT NULL,
    file_url TEXT DEFAULT NULL,
    file_name TEXT DEFAULT NULL,
    uid TEXT DEFAULT NULL,        -- anonymous browser id
    sid TEXT DEFAULT NULL,        -- session id
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
    ip_hash TEXT DEFAULT NULL     -- SHA256(ip + salt)
);
CREATE INDEX IF NOT EXISTS idx_stats_token_ts   ON stats_events(token, ts);
CREATE INDEX IF NOT EXISTS idx_stats_domain_ts  ON stats_events(domain, ts);
CREATE INDEX IF NOT EXISTS idx_stats_type_ts    ON stats_events(type, ts);
CREATE INDEX IF NOT EXISTS idx_stats_uid_ts     ON stats_events(uid, ts);

CREATE TABLE IF NOT EXISTS stats_settings (
    key TEXT PRIMARY KEY,
    value TEXT
);

CREATE TABLE IF NOT EXISTS stats_ip_cache (
    ip TEXT PRIMARY KEY,
    country TEXT,
    city TEXT,
    ts INTEGER
);");

// Read salt (for IP hashing)
$saltFile = __DIR__ . '/data/.stats_salt';
if (!file_exists($saltFile)) {
    file_put_contents($saltFile, bin2hex(random_bytes(16)));
}
$salt = trim(@file_get_contents($saltFile)) ?: 'x';

// Router
$action = $_REQUEST['action'] ?? '';

if ($action === 'getSettings') {
    // In the simplest form we always allow tracking. You may add additional checks here.
    echo json_encode(['ok' => true, 'settings' => ['enabled' => true, 'version' => '1.0']]);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] === 'POST' && ($action === 'track' || $action === '')) {
    $type = $_POST['type'] ?? '';
    $token = substr((string)($_POST['token'] ?? ''), 0, 128);
    $domain = sanitizeHost($_POST['domain'] ?? '');
    $url = substr((string)($_POST['url'] ?? ''), 0, 2048);
    $referrer = substr((string)($_POST['referrer'] ?? ''), 0, 2048);
    $uid = substr((string)($_POST['uid'] ?? ''), 0, 64);
    $sid = substr((string)($_POST['sid'] ?? ''), 0, 64);
    $userAgent = substr((string)($_POST['user_agent'] ?? ($_SERVER['HTTP_USER_AGENT'] ?? '')), 0, 512);
    $pageTitle = substr((string)($_POST['page_title'] ?? ''), 0, 512);

    $linkUrl = substr((string)($_POST['link_url'] ?? ''), 0, 2048);
    $fileUrl = substr((string)($_POST['file_url'] ?? ''), 0, 2048);
    $fileName = substr((string)($_POST['file_name'] ?? ''), 0, 512);

    if (!in_array($type, ['visit','link','download'], true) || !$domain) {
        echo json_encode(['ok' => false, 'error' => 'Bad request']);
        exit;
    }

    // Parse URL path + UTM
    $path = '/';
    $utm = ['utm_source'=>null,'utm_medium'=>null,'utm_campaign'=>null,'utm_content'=>null,'utm_term'=>null];
    if ($url) {
        $p = @parse_url($url);
        $path = isset($p['path']) ? $p['path'] : '/';
        if (!empty($p['query'])) {
            parse_str($p['query'], $q);
            foreach ($utm as $k => $_) {
                if (isset($q[$k])) $utm[$k] = substr((string)$q[$k], 0, 255);
            }
        }
    }

    $refDomain = '';
    if ($referrer) {
        $rp = @parse_url($referrer);
        $refDomain = $rp && isset($rp['host']) ? normalizeHost($rp['host']) : '';
    }

    // Get visitor info on server side to keep client payload minimal
    $ip = clientIp();
    $ipHash = hash('sha256', $ip . $salt);
    $device = parseUserAgent($userAgent);
    $geo = geoByIp($pdo, $ip);

    // Insert
    $st = $pdo->prepare("INSERT INTO stats_events 
        (ts, token, domain, path, type, link_url, file_url, file_name, uid, sid, country, device, os, browser, ref_domain, ref_url,
         utm_source, utm_medium, utm_campaign, utm_content, utm_term, ip_hash)
        VALUES (:ts, :token, :domain, :path, :type, :link_url, :file_url, :file_name, :uid, :sid, :country, :device, :os, :browser, :ref_domain, :ref_url,
                :utm_source, :utm_medium, :utm_campaign, :utm_content, :utm_term, :ip_hash)");
    $st->execute([
        'ts'         => time(),
        'token'      => $token ?: 'default',
        'domain'     => $domain,
        'path'       => $path,
        'type'       => $type,
        'link_url'   => $linkUrl ?: null,
        'file_url'   => $fileUrl ?: null,
        'file_name'  => $fileName ?: null,
        'uid'        => $uid ?: null,
        'sid'        => $sid ?: null,
        'country'    => $geo['country'] ?? null,
        'device'     => $device['device'] ?? null,
        'os'         => $device['os'] ?? null,
        'browser'    => $device['browser'] ?? null,
        'ref_domain' => $refDomain ?: null,
        'ref_url'    => $referrer ?: null,
        'utm_source' => $utm['utm_source'],
        'utm_medium' => $utm['utm_medium'],
        'utm_campaign'=> $utm['utm_campaign'],
        'utm_content'=> $utm['utm_content'],
        'utm_term'   => $utm['utm_term'],
        'ip_hash'    => $ipHash,
    ]);

    echo json_encode(['ok' => true]);
    exit;
}

echo json_encode(['ok' => false, 'error' => 'Unknown action']);

// ===== Helpers =====

function sanitizeHost(string $h): string {
    $h = strtolower(trim($h));
    $h = preg_replace('/[^a-z0-9\.\-\:]/', '', $h);
    return normalizeHost($h);
}
function normalizeHost(?string $h): string {
    $h = (string)$h;
    // remove leading www.
    return preg_replace('/^www\./', '', $h);
}

function clientIp(): string {
    $keys = ['HTTP_CF_CONNECTING_IP','HTTP_X_REAL_IP','HTTP_X_FORWARDED_FOR','REMOTE_ADDR'];
    foreach ($keys as $k) {
        $v = $_SERVER[$k] ?? '';
        if ($v) {
            if ($k === 'HTTP_X_FORWARDED_FOR') {
                $v = trim(explode(',', $v)[0]);
            }
            return $v;
        }
    }
    return '0.0.0.0';
}

function parseUserAgent(string $ua): array {
    $device = 'Desktop';
    if (preg_match('/(tablet|ipad|playbook)|(android(?!.*(mobi|opera mini)))/i', $ua)) {
        $device = 'Tablet';
    } elseif (preg_match('/(mobi|iphone|ipod|phone|android|iemobile)/i', $ua)) {
        $device = 'Mobile';
    }
    $os = 'Unknown';
    if (preg_match('/Windows NT/i',$ua)) $os='Windows';
    elseif (preg_match('/Android/i',$ua)) $os='Android';
    elseif (preg_match('/iPhone|iPad|iOS/i',$ua)) $os='iOS';
    elseif (preg_match('/Macintosh|Mac OS X/i',$ua)) $os='macOS';
    elseif (preg_match('/Linux/i',$ua)) $os='Linux';
    $browser = 'Unknown';
    if (preg_match('/Edg\//i',$ua)) $browser='Edge';
    elseif (preg_match('/OPR|Opera/i',$ua)) $browser='Opera';
    elseif (preg_match('/Chrome/i',$ua)) $browser='Chrome';
    elseif (preg_match('/Firefox/i',$ua)) $browser='Firefox';
    elseif (preg_match('/Safari/i',$ua)) $browser='Safari';
    return ['device'=>$device,'os'=>$os,'browser'=>$browser];
}

function geoByIp(PDO $pdo, string $ip): array {
    // Cache for 7 days
    $now = time();
    $st = $pdo->prepare("SELECT country, city, ts FROM stats_ip_cache WHERE ip=:ip");
    $st->execute(['ip'=>$ip]);
    $row = $st->fetch();
    if ($row && ($now - (int)$row['ts']) < 7*24*3600) {
        return ['country'=>$row['country']?:'Unknown','city'=>$row['city']?:'Unknown'];
    }
    // Fallback to external API (you can replace with your own DB or Cloudflare Workers geo)
    $country = 'Unknown';
    $city = 'Unknown';
    $ctx = stream_context_create(['http'=>['timeout'=>3]]);
    $resp = @file_get_contents("https://ipapi.co/{$ip}/json/", false, $ctx);
    if ($resp) {
        $data = @json_decode($resp, true);
        $country = $data['country_name'] ?? 'Unknown';
        $city    = $data['city'] ?? 'Unknown';
    }
    $st = $pdo->prepare("REPLACE INTO stats_ip_cache(ip,country,city,ts) VALUES(:ip,:country,:city,:ts)");
    $st->execute(['ip'=>$ip,'country'=>$country,'city'=>$city,'ts'=>$now]);
    return ['country'=>$country,'city'=>$city];
}
