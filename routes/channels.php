<?php

use Illuminate\Support\Facades\Broadcast;

Broadcast::channel('App.Models.User.{id}', function ($user, $id) {
    return (int) $user->id === (int) $id;
});

Broadcast::channel('users.{userId}.cloud-tasks', function ($user, $userId): bool {
    if (! is_numeric($userId)) {
        return false;
    }

    return (int) $user->id === (int) $userId;
});

Broadcast::channel('users.{userId}.video-jobs', function ($user, $userId): bool {
    if (! is_numeric($userId)) {
        return false;
    }

    return (int) $user->id === (int) $userId;
});
