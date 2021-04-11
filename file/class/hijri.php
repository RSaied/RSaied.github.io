<?php
include_once 'hijri.class.php';
echo (new hijri\datetime("2019-10-22 23:45:57", NULL,"ar" ))->format("_Y/_m/_d هـ (d-m-Yم) h:i a");
