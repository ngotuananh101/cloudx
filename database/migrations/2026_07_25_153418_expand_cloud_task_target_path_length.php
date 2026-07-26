<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('cloud_task', function (Blueprint $table) {
            $table->string('target_path', 2048)->default('')->change();
        });
    }

    public function down(): void
    {
        Schema::table('cloud_task', function (Blueprint $table) {
            $table->string('target_path', 255)->default('')->change();
        });
    }
};
