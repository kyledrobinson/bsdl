<?php
declare(strict_types=1);
require_once __DIR__ . '/db.php';

header('Content-Type: application/json; charset=utf-8');
if (!headers_sent()) {
  header('Access-Control-Allow-Origin: *');
  header('Vary: Origin');
}

// Enable debug output (remove in production)
ini_set('display_errors', '1');
ini_set('display_startup_errors', '1');
error_reporting(E_ALL);

mysqli_report(MYSQLI_REPORT_OFF);
$mysqli = @new mysqli($DB_HOST, $DB_USER, $DB_PASS, $DB_NAME);

if ($mysqli->connect_errno) {
  echo json_encode([
    'error' => 'DB connection failed',
    'code'  => $mysqli->connect_errno,
    'msg'   => $mysqli->connect_error,
    'host'  => $DB_HOST,
    'user'  => $DB_USER,
    'db'    => $DB_NAME
  ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
  exit;
}

$mysqli->set_charset('utf8mb4');

// Optional filters
$team   = isset($_GET['team'])   ? trim($_GET['team'])   : '';
$player = isset($_GET['player']) ? trim($_GET['player']) : '';

$whereNew  = [];
$paramsNew = [];
$typesNew  = '';
if ($team !== '')   { $whereNew[]  = 'team   LIKE ?'; $paramsNew[]  = '%'.$team.'%';   $typesNew  .= 's'; }
if ($player !== '') { $whereNew[]  = 'player LIKE ?'; $paramsNew[]  = '%'.$player.'%'; $typesNew  .= 's'; }

$whereOld  = [];
$paramsOld = [];
$typesOld  = '';
if ($team !== '')   { $whereOld[]  = 'Team   LIKE ?'; $paramsOld[]  = '%'.$team.'%';   $typesOld  .= 's'; }
if ($player !== '') { $whereOld[]  = 'Player LIKE ?'; $paramsOld[]  = '%'.$player.'%'; $typesOld  .= 's'; }

// 1) Preferred: players_stats (snake_case -> aliased display names)
$sqlNew = "SELECT
  pos           AS `Pos`,
  team          AS `Team`,
  player        AS `Player`,
  wp            AS `WP`,
  gp            AS `GP`,
  gw            AS `GW`,
  dbl_in        AS `DBL IN`,
  gf            AS `GF`,
  win_pct       AS `Win %`,
  finish_pct    AS `Finish %`,
  skunk_win     AS `Skunk Win`,
  b_open        AS `B. Open`,
  b_fin         AS `B. Fin.`,
  high_start    AS `High Start`,
  high_finish   AS `High Finish`,
  high_score    AS `High Score`,
  four_fin      AS `4 Fin.`,
  five_fin      AS `5 Fin.`,
  busts         AS `Busts`,
  fewest_darts  AS `Fewest Darts`,
  lft_fin       AS `LFT FIN`
FROM players_stats";
if (!empty($whereNew)) { $sqlNew .= ' WHERE ' . implode(' AND ', $whereNew); }
$sqlNew .= ' ORDER BY Team ASC, Pos ASC, Player ASC';

// 2) Fallback: players (already has display-name columns)
$sqlOld = "SELECT 
  Pos, Team, Player, WP, GP, GW, `DBL IN`, GF, `Win %`, `Finish %`,
  `Skunk Win`, `B. Open`, `B. Fin.`, `High Start`, `High Finish`,
  `High Score`, `4 Fin.`, `5 Fin.`, Busts, `Fewest Darts`, `LFT FIN`
FROM players";
if (!empty($whereOld)) { $sqlOld .= ' WHERE ' . implode(' AND ', $whereOld); }
$sqlOld .= ' ORDER BY Team ASC, Pos ASC, Player ASC';

// Helper to run a prepared query
function run_query(mysqli $db, string $sql, string $types, array $params) {
  $stmt = $db->prepare($sql);
  if (!$stmt) {
    return [false, 'prepare: '.$db->error, []];
  }
  if ($types !== '' && !empty($params)) {
    $stmt->bind_param($types, ...$params);
  }
  if (!$stmt->execute()) {
    $err = 'execute: '.$stmt->error;
    $stmt->close();
    return [false, $err, []];
  }
  $res = $stmt->get_result();
  $out = [];
  while ($row = $res->fetch_assoc()) $out[] = $row;
  $stmt->close();
  return [true, '', $out];
}

// Try NEW schema first
list($ok, $err, $rows) = run_query($mysqli, $sqlNew, $typesNew, $paramsNew);

if ($ok) {
  echo json_encode($rows, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
} else {
  // Fallback to OLD schema
  list($ok2, $err2, $rows2) = run_query($mysqli, $sqlOld, $typesOld, $paramsOld);
  if ($ok2) {
    echo json_encode($rows2, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
  } else {
    echo json_encode([
      'error' => 'Both queries failed',
      'new_schema_error' => $err,
      'old_schema_error' => $err2
    ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
  }
}

$mysqli->close();
