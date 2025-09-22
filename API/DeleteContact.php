<?php
// Created by: Riley Parkin, Kobi Corney, Christian Jones, and Terrence Freeman
$in = getJson();
$contactId = (int)($in["contactId"] ?? 0);
$userId    = (int)($in["userId"]    ?? 0);

if ($contactId<=0 || $userId<=0) {
  returnJson(["results"=>null,"error"=>"contactId and userId are required"]);
  exit;
}

$conn = new mysqli("localhost","barryb","buzzbuzz35!","contactmgr");
if ($conn->connect_error) { returnJson(["results"=>null,"error"=>$conn->connect_error]); exit; }

$stmt = $conn->prepare("DELETE FROM Contacts WHERE ID=? AND UserID=?");
$stmt->bind_param("ii", $contactId, $userId);
$stmt->execute();

$ok = $stmt->affected_rows > 0;
returnJson(["results"=>["deleted"=>$ok], "error"=>$ok ? "" : "Not found"]);

$stmt->close(); $conn->close();

function getJson(){ return json_decode(file_get_contents('php://input'), true) ?? []; }
function returnJson($obj){ header('Content-Type: application/json; charset=utf-8'); echo json_encode($obj); }

