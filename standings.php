<?php
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');

// Your Apps Script (teamstandings) Web App URL:
$UPSTREAM = 'https://script.google.com/macros/s/AKfycbywGlWYpnERMxo58t741L_IsH_neNyM97pDYpbsz8T4S8E02Jfe7Xt4juum4oNheyI0-g/exec';

$ch = curl_init($UPSTREAM);
curl_setopt_array($ch, [
  CURLOPT_RETURNTRANSFER => true,
  CURLOPT_FOLLOWLOCATION => true,
  CURLOPT_TIMEOUT => 12,
  CURLOPT_SSL_VERIFYPEER => true,
  CURLOPT_SSL_VERIFYHOST => 2,
  CURLOPT_USERAGENT => 'BSDL-Proxy/1.0'
]);
$body = curl_exec($ch);
$code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);

if ($code !== 200 || !$body) {
  http_response_code(502);
  echo json_encode(['error'=>'Failed to fetch Apps Script','status'=>$code]);
  exit;
}
if ($body[0] !== '{' && $body[0] !== '[') {
  http_response_code(502);
  echo json_encode(['error'=>'Apps Script returned non-JSON (HTML/login?)']);
  exit;
}
echo $body;
