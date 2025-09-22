<?php
// Created by: Riley Parkin, Kobi Corney, Christian Jones, and Terrence Freeman
$in = getJson();
$first = trim($in["firstName"] ?? "");
$last  = trim($in["lastName"]  ?? "");
$login = trim($in["login"]     ?? "");
$pass  = (string)($in["password"] ?? "");

if ($first === "" || $last === "" || $login === "" || $pass === "") {
  returnJson(["results"=>null, "error"=>"Missing required fields"]);
  exit;
}

$conn = new mysqli("localhost","barryb","buzzbuzz35!","contactmgr");
if ($conn->connect_error) { returnJson(["results"=>null,"error"=>$conn->connect_error]); exit; }

$stmt = $conn->prepare("INSERT INTO Users(FirstName, LastName, Login, Password) VALUES(?,?,?,?)");
$stmt->bind_param("ssss", $first, $last, $login, $pass);


if (!$stmt->execute()) {
  // likely duplicate login
  returnJson(["results"=>null, "error"=>$stmt->error]);
} else {
  $id = $conn->insert_id;
  returnJson(["results"=>["userId"=>$id,"firstName"=>$first,"lastName"=>$last], "error"=>""]);
}
$stmt->close(); $conn->close();

function getJson(){ return json_decode(file_get_contents('php://input'), true) ?? []; }
function returnJson($obj){ header('Content-Type: application/json; charset=utf-8'); echo json_encode($obj); }

