<?php
// Created by: Riley Parkin, Kobi Corney, Christian Jones, and Terrence Freeman
$in = getJson();
$userId    = (int)($in["userId"] ?? 0);
$firstName = trim($in["firstName"] ?? "");
$lastName  = trim($in["lastName"]  ?? "");
$email     = trim($in["email"]     ?? "");
$phone     = trim($in["phone"]     ?? "");

if ($userId<=0 || $firstName==="" || $lastName==="") {
  returnJson(["results"=>null,"error"=>"userId, firstName, lastName are required"]);
  exit;
}

$conn = new mysqli("localhost","barryb","buzzbuzz35!","contactmgr");
if ($conn->connect_error) { returnJson(["results"=>null,"error"=>$conn->connect_error]); exit; }

$stmt = $conn->prepare(
  "INSERT INTO Contacts(UserID, FirstName, LastName, Email, Phone, CreatedAt, UpdatedAt)
   VALUES(?,?,?,?,?, NOW(), NOW())"
);
$stmt->bind_param("issss", $userId, $firstName, $lastName, $email, $phone);

if (!$stmt->execute()) {
  returnJson(["results"=>null,"error"=>$stmt->error]);
} else {
  returnJson(["results"=>["contactId"=>$conn->insert_id], "error"=>""]);
}
$stmt->close(); $conn->close();

function getJson(){ return json_decode(file_get_contents('php://input'), true) ?? []; }
function returnJson($obj){ header('Content-Type: application/json; charset=utf-8'); echo json_encode($obj); }

