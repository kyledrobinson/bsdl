<?php
// db.php — simple config
declare(strict_types=1);

$DB_HOST = 'localhost';
$DB_NAME = 'shimbeld_bsdl';
$DB_USER = 'shimbeld_bsdlUser';
$DB_PASS = 'Dart!2025$League';

// If your frontend runs on another origin, set it here (or leave empty for none).
// If your frontend runs on a different domain, allow it here.
$allowed_origins = [
    'https://bloorstreetdartleague.com',
    'https://www.bloorstreetdartleague.com'
  ];
  
  if (isset($_SERVER['HTTP_ORIGIN']) && in_array($_SERVER['HTTP_ORIGIN'], $allowed_origins, true)) {
    header('Access-Control-Allow-Origin: ' . $_SERVER['HTTP_ORIGIN']);
    header('Vary: Origin');
  }
  
