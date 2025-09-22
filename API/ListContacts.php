<?php
$inData = getRequestInfo();

$userId = $inData["userId"];
$offset = $inData["offset"];
$limit = $inData["limit"];

$conn = new mysqli("localhost", "barryb", "buzzbuzz35!", "contactmgr");
if ($conn->connect_error) {
    returnWithError($conn->connect_error);
} else {
    $stmt = $conn->prepare("SELECT ID, FirstName, LastName, Phone, Email FROM Contacts WHERE UserID=? ORDER BY FirstName ASC LIMIT ?, ?");
    $stmt->bind_param("iii", $userId, $offset, $limit);
    $stmt->execute();
    $result = $stmt->get_result();

    $contacts = [];
    while ($row = $result->fetch_assoc()) {
        $contacts[] = $row;
    }
    returnWithInfo($contacts);

    $stmt->close();
    $conn->close();
}

function getRequestInfo() { return json_decode(file_get_contents('php://input'), true); }
function sendAsJson($obj) { header('Content-type: application/json'); echo json_encode($obj); }
function returnWithError($err) { sendAsJson(["results"=>[], "error"=>$err]); }
function returnWithInfo($results) { sendAsJson(["results"=>$results, "error"=>""]); }
?>
