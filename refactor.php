<?php

$files = new RecursiveIteratorIterator(new RecursiveDirectoryIterator('app'));
$count = 0;
foreach ($files as $file) {
    if (! $file->isFile() || $file->getExtension() !== 'php') {
        continue;
    }
    $path = $file->getPathname();
    if (strpos($path, 'Enums') !== false) {
        continue;
    }

    $content = file_get_contents($path);
    $newContent = preg_replace('/(CloudProvider|CloudTaskStatus|CloudTaskType|ConnectionStatus)::([A-Z0-9_]+)\(\)/', '$1::$2', $content);
    $newContent = preg_replace('/->is\((CloudProvider|CloudTaskStatus|CloudTaskType|ConnectionStatus)::([A-Z0-9_]+)\)/', ' === $1::$2', $newContent);
    $newContent = preg_replace('/->isNot\((CloudProvider|CloudTaskStatus|CloudTaskType|ConnectionStatus)::([A-Z0-9_]+)\)/', ' !== $1::$2', $newContent);
    $newContent = str_replace('->description', '->getDescription()', $newContent);

    if ($newContent !== $content) {
        file_put_contents($path, $newContent);
        echo 'Updated: '.$path.PHP_EOL;
        $count++;
    }
}
echo 'Total app: '.$count.PHP_EOL;

$files = new RecursiveIteratorIterator(new RecursiveDirectoryIterator('database'));
$countDB = 0;
foreach ($files as $file) {
    if (! $file->isFile() || $file->getExtension() !== 'php') {
        continue;
    }
    $path = $file->getPathname();

    $content = file_get_contents($path);
    $newContent = preg_replace('/(CloudProvider|CloudTaskStatus|CloudTaskType|ConnectionStatus)::([A-Z0-9_]+)\(\)/', '$1::$2', $content);
    $newContent = preg_replace('/->is\((CloudProvider|CloudTaskStatus|CloudTaskType|ConnectionStatus)::([A-Z0-9_]+)\)/', ' === $1::$2', $newContent);
    $newContent = str_replace('->description', '->getDescription()', $newContent);

    if ($newContent !== $content) {
        file_put_contents($path, $newContent);
        echo 'Updated: '.$path.PHP_EOL;
        $countDB++;
    }
}
echo 'Total database: '.$countDB.PHP_EOL;

$files = new RecursiveIteratorIterator(new RecursiveDirectoryIterator('resources/js'));
$countRes = 0;
foreach ($files as $file) {
    if (! $file->isFile()) {
        continue;
    }
    $path = $file->getPathname();

    $content = file_get_contents($path);
    $newContent = str_replace('.description', '.getDescription()', $content);
    if (strpos($path, '.tsx') !== false || strpos($path, '.ts') !== false || strpos($path, '.js') !== false) {
        // Enums on frontend are usually mapped as strings/integers by Inertia, but in case they use objects
        // In our case, the frontend was actually given primitive values. So let's just ignore JS.
    }
}
