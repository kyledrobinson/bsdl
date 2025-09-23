<?php
declare(strict_types=1);

// DEBUG (you can turn off later)
ini_set('display_errors','1');
ini_set('display_startup_errors','1');
error_reporting(E_ALL);

header('Content-Type: application/json; charset=utf-8');
if (!headers_sent()) {
  header('Access-Control-Allow-Origin: *');
  header('Vary: Origin');
}

require_once __DIR__ . '/db.php';

// --- Config ---
const EXPECTED_TOKEN = 'SHIMM3R_bsdl_2025'; // must match your Apps Script
$mode = isset($_GET['mode']) ? strtolower(trim($_GET['mode'])) : 'replace';
$token = $_GET['token'] ?? '';
if ($token !== EXPECTED_TOKEN) {
  http_response_code(401);
  echo json_encode(['error' => 'unauthorized (bad token)']);
  exit;
}
if (!in_array($mode, ['replace','append'], true)) {
  http_response_code(400);
  echo json_encode(['error' => 'bad mode (use replace|append)']);
  exit;
}

// --- DB connect ---
mysqli_report(MYSQLI_REPORT_OFF);
$mysqli = @new mysqli($DB_HOST, $DB_USER, $DB_PASS, $DB_NAME);
if ($mysqli->connect_errno) {
  http_response_code(500);
  echo json_encode(['error' => 'DB connection failed', 'msg' => $mysqli->connect_error]);
  exit;
}
$mysqli->set_charset('utf8mb4');

// --- Read CSV from body ---
$raw = file_get_contents('php://input') ?: '';
// strip possible UTF-8 BOM
if (substr($raw, 0, 3) === "\xEF\xBB\xBF") $raw = substr($raw, 3);
if ($raw === '') {
  http_response_code(400);
  echo json_encode(['error'=>'no csv payload']);
  exit;
}

// Put into temp stream for fgetcsv (handles quotes/commas properly)
$fp = fopen('php://temp', 'r+');
fwrite($fp, $raw);
rewind($fp);

// --- Expected header order (must match your Sheet) ---
$EXPECTED = [
  "Pos","Team","Player","WP","GP","GW","DBL IN","GF","Win %","Finish %",
  "Skunk Win","B. Open","B. Fin.","High Start","High Finish","High Score",
  "4 Fin.","5 Fin.","Busts","Fewest Darts","LFT FIN"
];

// parse header
$header = fgetcsv($fp);
if (!$header) {
  http_response_code(400);
  echo json_encode(['error'=>'csv header missing']);
  exit;
}
// normalize header cells
$norm = function($s){ return trim((string)$s); };
$header = array_map($norm, $header);

// Validate header (exact match)
if ($header !== $EXPECTED) {
  http_response_code(400);
  echo json_encode([
    'error' => 'header mismatch',
    'got'   => $header,
    'want'  => $EXPECTED
  ]);
  exit;
}

// --- Ensure table exists ---
$createSql = <<<SQL
CREATE TABLE IF NOT EXISTS `players` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `Pos` INT NULL,
  `Team` VARCHAR(128) NOT NULL,
  `Player` VARCHAR(128) NOT NULL,
  `WP` DECIMAL(6,2) NULL,
  `GP` INT NULL,
  `GW` INT NULL,
  `DBL IN` INT NULL,
  `GF` INT NULL,
  `Win %` DECIMAL(6,2) NULL,
  `Finish %` DECIMAL(6,2) NULL,
  `Skunk Win` INT NULL,
  `B. Open` INT NULL,
  `B. Fin.` INT NULL,
  `High Start` INT NULL,
  `High Finish` INT NULL,
  `High Score` INT NULL,
  `4 Fin.` INT NULL,
  `5 Fin.` INT NULL,
  `Busts` INT NULL,
  `Fewest Darts` INT NULL,
  `LFT FIN` INT NULL,
  PRIMARY KEY (`id`)
) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
SQL;

if (!$mysqli->query($createSql)) {
  http_response_code(500);
  echo json_encode(['error'=>'create table failed','msg'=>$mysqli->error]);
  exit;
}

// --- Replace mode uses DELETE (avoids TRUNCATE privilege issues) ---
if ($mode === 'replace') {
  if (!$mysqli->query("DELETE FROM `players`")) {
    http_response_code(500);
    echo json_encode(['error'=>'delete failed','msg'=>$mysqli->error]);
    exit;
  }
  // reset autoincrement (optional)
  $mysqli->query("ALTER TABLE `players` AUTO_INCREMENT=1");
}

// --- Prepare insert ---
$colsBackticked = '`Pos`,`Team`,`Player`,`WP`,`GP`,`GW`,`DBL IN`,`GF`,`Win %`,`Finish %`,`Skunk Win`,`B. Open`,`B. Fin.`,`High Start`,`High Finish`,`High Score`,`4 Fin.`,`5 Fin.`,`Busts`,`Fewest Darts`,`LFT FIN`';
$placeholders = implode(',', array_fill(0, count($EXPECTED), '?'));
$sqlIns = "INSERT INTO `players` ($colsBackticked) VALUES ($placeholders)";
$stmt = $mysqli->prepare($sqlIns);
if (!$stmt) {
  http_response_code(500);
  echo json_encode(['error'=>'prepare failed','msg'=>$mysqli->error, 'sql'=>$sqlIns]);
  exit;
}

// bind as strings; MySQL will coerce to numeric columns
$types = str_repeat('s', count($EXPECTED));

$inserted = 0;
$skipped  = 0;
$lineNo   = 1; // header consumed
$errors   = [];

// helper: trim & normalize numeric-ish values
$cleanNum = function($v) {
  $v = trim((string)$v);
  if ($v === '') return null;
  // remove % and commas
  $v = str_replace(['%', ','], '', $v);
  return $v;
};

while (($row = fgetcsv($fp)) !== false) {
  $lineNo++;
  // Skip empty lines
  if (count(array_filter($row, fn($x)=>trim((string)$x)!=='')) === 0) continue;

  // Pad/trim to expected length
  if (count($row) < count($EXPECTED)) {
    $row = array_pad($row, count($EXPECTED), '');
  } elseif (count($row) > count($EXPECTED)) {
    $row = array_slice($row, 0, count($EXPECTED));
  }

  // Clean numeric fields where appropriate (keeps strings for Team/Player)
  $row[0]  = $cleanNum($row[0]);   // Pos
  $row[3]  = $cleanNum($row[3]);   // WP
  $row[4]  = $cleanNum($row[4]);   // GP
  $row[5]  = $cleanNum($row[5]);   // GW
  $row[6]  = $cleanNum($row[6]);   // DBL IN
  $row[7]  = $cleanNum($row[7]);   // GF
  $row[8]  = $cleanNum($row[8]);   // Win %
  $row[9]  = $cleanNum($row[9]);   // Finish %
  $row[10] = $cleanNum($row[10]);  // Skunk Win
  $row[11] = $cleanNum($row[11]);  // B. Open
  $row[12] = $cleanNum($row[12]);  // B. Fin.
  $row[13] = $cleanNum($row[13]);  // High Start
  $row[14] = $cleanNum($row[14]);  // High Finish
  $row[15] = $cleanNum($row[15]);  // High Score
  $row[16] = $cleanNum($row[16]);  // 4 Fin.
  $row[17] = $cleanNum($row[17]);  // 5 Fin.
  $row[18] = $cleanNum($row[18]);  // Busts
  $row[19] = $cleanNum($row[19]);  // Fewest Darts
  $row[20] = $cleanNum($row[20]);  // LFT FIN

  if (!$stmt->bind_param($types, ...$row)) {
    $skipped++;
    $errors[] = ['line'=>$lineNo,'bind_error'=>$stmt->error,'row'=>$row];
    continue;
  }
  if (!$stmt->execute()) {
    $skipped++;
    $errors[] = ['line'=>$lineNo,'exec_error'=>$stmt->error,'row'=>$row];
    continue;
  }
  $inserted++;
}

fclose($fp);
$stmt->close();
$mysqli->close();

echo json_encode([
  'ok'       => true,
  'mode'     => $mode,
  'inserted' => $inserted,
  'skipped'  => $skipped,
  'errors'   => $errors, // will be [] on success
], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
